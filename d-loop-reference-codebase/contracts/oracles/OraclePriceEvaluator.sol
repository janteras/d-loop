// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/IPriceOracle.sol";

/**
 * @title OraclePriceEvaluator
 * @dev Evaluates governance decisions based on price movement data from oracles
 */
contract OraclePriceEvaluator is AccessControl, Pausable {
    // Access control roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE = keccak256("REWARD_DISTRIBUTOR_ROLE");
    
    // Event types
    enum EventType { Invest, Divest, Ragequit }
    
    // Decision data
    struct Decision {
        bytes32 id;
        EventType eventType;
        address assetAddress;
        uint256 initialPrice;
        uint256 finalPrice;
        bool evaluated;
        bool priceIncreased;
        uint256 evaluationTime;
    }
    
    // Evaluation window
    uint256 public evaluationDelay = 1 days;
    uint256 public evaluationWindow = 7 days;
    
    // Oracle contract
    IPriceOracle public oracle;
    
    // Decision storage
    mapping(bytes32 => Decision) public decisions;
    bytes32[] public pendingDecisions;
    
    // Events
    event DecisionRecorded(
        bytes32 indexed decisionId,
        EventType indexed eventType,
        address indexed assetAddress,
        uint256 initialPrice,
        uint256 timestamp
    );
    
    event DecisionEvaluated(
        bytes32 indexed decisionId,
        bool priceIncreased,
        uint256 initialPrice,
        uint256 finalPrice,
        uint256 timestamp
    );
    
    event OracleUpdated(address indexed newOracleAddress);
    event EvaluationWindowUpdated(uint256 delay, uint256 window);
    
    /**
     * @dev Constructor
     * @param admin Address of the admin
     * @param _oracle Address of the price oracle
     */
    constructor(address admin, address _oracle) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        oracle = IPriceOracle(_oracle);
    }
    
    /**
     * @dev Records a new decision for later evaluation
     * @param decisionId Unique identifier for the decision
     * @param eventType Type of event (Invest, Divest, Ragequit)
     * @param assetAddress Asset address the decision relates to
     */
    function recordDecision(
        bytes32 decisionId,
        EventType eventType,
        address assetAddress
    ) external onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        require(decisions[decisionId].id == bytes32(0), "Decision already recorded");
        require(oracle.isAssetSupported(assetAddress), "Asset not supported by oracle");
        
        // Get current price
        (uint256 price, ) = oracle.getAssetPrice(assetAddress);
        require(price > 0, "Invalid price from oracle");
        
        // Store decision
        decisions[decisionId] = Decision({
            id: decisionId,
            eventType: eventType,
            assetAddress: assetAddress,
            initialPrice: price,
            finalPrice: 0,
            evaluated: false,
            priceIncreased: false,
            evaluationTime: 0
        });
        
        // Add to pending decisions
        pendingDecisions.push(decisionId);
        
        emit DecisionRecorded(decisionId, eventType, assetAddress, price, block.timestamp);
    }
    
    /**
     * @dev Evaluates a specific decision
     * @param decisionId ID of the decision to evaluate
     * @return success Whether the evaluation was successful
     * @return priceIncreased Whether the price increased since initial recording
     */
    function evaluateDecision(bytes32 decisionId) external whenNotPaused returns (bool success, bool priceIncreased) {
        Decision storage decision = decisions[decisionId];
        
        require(decision.id != bytes32(0), "Decision not found");
        require(!decision.evaluated, "Decision already evaluated");
        require(
            block.timestamp >= decision.evaluationTime + evaluationDelay,
            "Evaluation delay not passed"
        );
        
        // Get current price
        (uint256 currentPrice, ) = oracle.getAssetPrice(decision.assetAddress);
        require(currentPrice > 0, "Invalid price from oracle");
        
        // Determine if price increased
        bool increased = currentPrice > decision.initialPrice;
        
        // Update decision
        decision.evaluated = true;
        decision.finalPrice = currentPrice;
        decision.priceIncreased = increased;
        decision.evaluationTime = block.timestamp;
        
        emit DecisionEvaluated(
            decisionId,
            increased,
            decision.initialPrice,
            currentPrice,
            block.timestamp
        );
        
        return (true, increased);
    }
    
    /**
     * @dev Evaluates all eligible pending decisions
     * @return evaluated Number of decisions evaluated
     */
    function evaluatePendingDecisions() external whenNotPaused returns (uint256 evaluated) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < pendingDecisions.length; i++) {
            bytes32 decisionId = pendingDecisions[i];
            
            if (decisions[decisionId].evaluated) {
                // Skip already evaluated decisions
                continue;
            }
            
            if (block.timestamp < decisions[decisionId].evaluationTime + evaluationDelay) {
                // Skip decisions that are not ready for evaluation
                continue;
            }
            
            // Try to evaluate
            (bool success, ) = this.evaluateDecision(decisionId);
            
            if (success) {
                count++;
            }
        }
        
        // Clean up evaluated decisions from pending list
        _cleanupPendingDecisions();
        
        return count;
    }
    
    /**
     * @dev Request evaluation of a decision from the reward distributor
     * @param decisionId ID of the decision to evaluate
     */
    function requestRewardEvaluation(bytes32 decisionId) external onlyRole(REWARD_DISTRIBUTOR_ROLE) {
        Decision storage decision = decisions[decisionId];
        
        require(decision.id != bytes32(0), "Decision not found");
        require(decision.evaluated, "Decision not yet evaluated");
        
        // Logic to trigger reward evaluation goes here
        // This would typically call a function in the EnhancedGovernanceRewards contract
    }
    
    /**
     * @dev Was the vote on a decision correct?
     * This evaluates based on:
     * 1. For Invest events - "Yes" is correct if price increased, "No" is correct if price decreased
     * 2. For Divest/Ragequit events - "Yes" is correct if price decreased, "No" is correct if price increased
     * @param decisionId ID of the decision
     * @param votedYes Whether the voter voted "Yes"
     * @return correct Whether the vote was correct based on price movement
     */
    function isVoteCorrect(bytes32 decisionId, bool votedYes) external view returns (bool correct) {
        Decision storage decision = decisions[decisionId];
        
        require(decision.id != bytes32(0), "Decision not found");
        require(decision.evaluated, "Decision not yet evaluated");
        
        if (decision.eventType == EventType.Invest) {
            // For investments, "Yes" is correct if price increased
            return votedYes == decision.priceIncreased;
        } else {
            // For divestments and ragequits, "Yes" is correct if price decreased
            return votedYes != decision.priceIncreased;
        }
    }
    
    /**
     * @dev Gets details about a decision
     * @param decisionId ID of the decision
     * @return eventType Type of event
     * @return assetAddress Asset address
     * @return initialPrice Initial price
     * @return finalPrice Final price
     * @return evaluated Whether the decision was evaluated
     * @return priceIncreased Whether the price increased
     */
    function getDecision(bytes32 decisionId) external view returns (
        EventType eventType,
        address assetAddress,
        uint256 initialPrice,
        uint256 finalPrice,
        bool evaluated,
        bool priceIncreased
    ) {
        Decision storage decision = decisions[decisionId];
        require(decision.id != bytes32(0), "Decision not found");
        
        return (
            decision.eventType,
            decision.assetAddress,
            decision.initialPrice,
            decision.finalPrice,
            decision.evaluated,
            decision.priceIncreased
        );
    }
    
    /**
     * @dev Gets all pending decision IDs
     * @return decisionIds Array of pending decision IDs
     */
    function getPendingDecisions() external view returns (bytes32[] memory decisionIds) {
        return pendingDecisions;
    }
    
    /**
     * @dev Updates the oracle address
     * @param newOracle Address of the new oracle
     */
    function updateOracle(address newOracle) external onlyRole(ADMIN_ROLE) {
        require(newOracle != address(0), "Invalid oracle address");
        oracle = IPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }
    
    /**
     * @dev Updates the evaluation window parameters
     * @param delay New evaluation delay
     * @param window New evaluation window
     */
    function updateEvaluationWindow(uint256 delay, uint256 window) external onlyRole(ADMIN_ROLE) {
        require(delay > 0, "Delay must be positive");
        require(window > delay, "Window must be greater than delay");
        
        evaluationDelay = delay;
        evaluationWindow = window;
        
        emit EvaluationWindowUpdated(delay, window);
    }
    
    /**
     * @dev Grants the governance role
     * @param governance Address to grant the role to
     */
    function grantGovernanceRole(address governance) external onlyRole(ADMIN_ROLE) {
        _grantRole(GOVERNANCE_ROLE, governance);
    }
    
    /**
     * @dev Grants the reward distributor role
     * @param distributor Address to grant the role to
     */
    function grantRewardDistributorRole(address distributor) external onlyRole(ADMIN_ROLE) {
        _grantRole(REWARD_DISTRIBUTOR_ROLE, distributor);
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Removes evaluated decisions from the pending list
     */
    function _cleanupPendingDecisions() internal {
        uint256 i = 0;
        
        while (i < pendingDecisions.length) {
            if (decisions[pendingDecisions[i]].evaluated) {
                // Replace with the last element and reduce the array length
                pendingDecisions[i] = pendingDecisions[pendingDecisions.length - 1];
                pendingDecisions.pop();
            } else {
                i++;
            }
        }
    }
}