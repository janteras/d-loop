// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GovernanceTracker.sol";
import "../libraries/Errors.sol";

/**
 * @title GovernanceOracle
 * @notice Evaluates the outcome of governance proposals
 * @dev Provides off-chain assessment of proposal impact
 */
contract GovernanceOracle is AccessControl {
    // GovernanceTracker contract
    GovernanceTracker public governanceTracker;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Events
    event ProposalEvaluated(uint256 indexed proposalId, bool hadPositiveOutcome, string reason);
    event GovernanceTrackerUpdated(address indexed tracker);
    
    // Proposal evaluation state
    struct ProposalEvaluation {
        bool evaluated;         // Whether the proposal has been evaluated
        bool outcome;           // The outcome (positive or negative)
        string reason;          // Reason for the evaluation
        uint256 timestamp;      // When the evaluation was made
    }
    
    // Mapping of proposal evaluations
    mapping(uint256 => ProposalEvaluation) public evaluations;
    
    /**
     * @notice Constructor
     * @param _governanceTracker Address of the GovernanceTracker contract
     */
    constructor(address _governanceTracker) {
        if (_governanceTracker == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
        
        governanceTracker = GovernanceTracker(_governanceTracker);
    }
    
    /**
     * @notice Updates the governance tracker contract
     * @param _newTracker Address of the new GovernanceTracker contract
     */
    function updateGovernanceTracker(address _newTracker) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_newTracker == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        governanceTracker = GovernanceTracker(_newTracker);
        
        emit GovernanceTrackerUpdated(_newTracker);
    }
    
    /**
     * @notice Evaluates a proposal outcome
     * @param _proposalId ID of the proposal to evaluate
     * @param _hadPositiveOutcome Whether the proposal had a positive impact
     * @param _reason Reason for the evaluation
     */
    function evaluateProposal(
        uint256 _proposalId,
        bool _hadPositiveOutcome,
        string memory _reason
    ) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        if (evaluations[_proposalId].evaluated) {
            revert Errors.AlreadyEvaluated();
        }
        
        // Record evaluation
        evaluations[_proposalId] = ProposalEvaluation({
            evaluated: true,
            outcome: _hadPositiveOutcome,
            reason: _reason,
            timestamp: block.timestamp
        });
        
        // Notify governance tracker
        governanceTracker.evaluateProposalImpact(_proposalId, _hadPositiveOutcome);
        
        emit ProposalEvaluated(_proposalId, _hadPositiveOutcome, _reason);
    }
    
    /**
     * @notice Gets the evaluation for a proposal
     * @param _proposalId ID of the proposal
     * @return evaluated Whether the proposal has been evaluated
     * @return outcome The outcome (positive or negative)
     * @return reason Reason for the evaluation
     * @return timestamp When the evaluation was made
     */
    function getEvaluation(uint256 _proposalId) 
        external 
        view 
        returns (
            bool evaluated,
            bool outcome,
            string memory reason,
            uint256 timestamp
        ) 
    {
        ProposalEvaluation storage eval = evaluations[_proposalId];
        
        return (
            eval.evaluated,
            eval.outcome,
            eval.reason,
            eval.timestamp
        );
    }
}