// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../governance/AINodeRegistry.sol";

/**
 * @title EnhancedGovernanceRewards
 * @dev Distributes rewards to AI Nodes based on governance participation
 * and accuracy of decisions over time.
 */
contract EnhancedGovernanceRewards is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Contracts
    IERC20 public immutable rewardToken;
    AINodeRegistry public immutable aiNodeRegistry;
    
    // Reward epochs
    uint256 public epochDuration; // Duration of each reward epoch in seconds
    uint256 public currentEpoch;  // Current epoch number
    uint256 public epochStartTime; // Start time of the current epoch
    
    // Weights for time-weighted rewards (scale 100-500)
    uint256 public minWeight = 100;
    uint256 public maxWeight = 500;
    
    // Reward data structure
    struct RewardInfo {
        uint256 pendingRewards;
        uint256 lastClaimedEpoch;
        uint256 consecutiveCorrectVotes;
        uint256 weightMultiplier;
    }
    
    // Mapping of node address to reward info
    mapping(address => RewardInfo) private _rewards;
    
    // Mapping of epoch to total reward for that epoch
    mapping(uint256 => uint256) private _epochRewards;
    
    // Mapping of epoch to participants in that epoch
    mapping(uint256 => address[]) private _epochParticipants;
    
    // Mapping of epoch to node address to weighted score
    mapping(uint256 => mapping(address => uint256)) private _weightedScores;
    
    // Total weighted score for each epoch
    mapping(uint256 => uint256) private _totalWeightedScores;
    
    // Events
    event RewardAdded(uint256 indexed epoch, uint256 amount);
    event NodeScoreUpdated(address indexed node, uint256 indexed epoch, uint256 score, bool correct);
    event RewardClaimed(address indexed node, uint256 amount, uint256 epoch);
    event EpochAdvanced(uint256 indexed newEpoch, uint256 startTime);
    event WeightRangeUpdated(uint256 minWeight, uint256 maxWeight);
    event EpochDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event BatchRewardDistributed(uint256 indexed epoch, uint256 nodesProcessed);
    
    /**
     * @dev Constructor
     * @param admin Address that will be granted the admin role
     * @param _rewardToken Address of the token used for rewards
     * @param _aiNodeRegistry Address of the AINodeRegistry
     * @param _epochDuration Duration of each reward epoch in seconds
     */
    constructor(
        address admin,
        address _rewardToken,
        address _aiNodeRegistry,
        uint256 _epochDuration
    ) {
        require(admin != address(0), "Admin cannot be zero address");
        require(_rewardToken != address(0), "Reward token cannot be zero address");
        require(_aiNodeRegistry != address(0), "AINodeRegistry cannot be zero address");
        require(_epochDuration > 0, "Epoch duration must be positive");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REWARD_MANAGER_ROLE, admin);
        
        rewardToken = IERC20(_rewardToken);
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
        
        epochDuration = _epochDuration;
        currentEpoch = 1;
        epochStartTime = block.timestamp;
    }
    
    /**
     * @dev Add rewards for the current epoch
     * @param amount Amount of reward tokens to add
     */
    function addRewards(uint256 amount) external onlyRole(REWARD_MANAGER_ROLE) whenNotPaused {
        require(amount > 0, "Amount must be positive");
        
        // Check for epoch advancement
        _checkAndAdvanceEpoch();
        
        // Transfer tokens from the sender to this contract
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Add to current epoch rewards
        _epochRewards[currentEpoch] += amount;
        
        emit RewardAdded(currentEpoch, amount);
    }
    
    /**
     * @dev Update a node's score for the current epoch
     * @param node Address of the AI Node
     * @param score Raw score (will be weighted by multiplier)
     * @param correct Whether the node's decision was correct
     */
    function updateNodeScore(address node, uint256 score, bool correct) 
        external 
        onlyRole(ORACLE_ROLE) 
        whenNotPaused 
    {
        require(aiNodeRegistry.isRegisteredNode(node), "Not a registered AI node");
        
        // Check for epoch advancement
        _checkAndAdvanceEpoch();
        
        RewardInfo storage reward = _rewards[node];
        
        // Update consecutive correct votes count
        if (correct) {
            reward.consecutiveCorrectVotes++;
        } else {
            reward.consecutiveCorrectVotes = 0;
        }
        
        // Calculate weight multiplier based on consecutive correct votes
        // The more consecutive correct votes, the higher the multiplier
        uint256 multiplier = minWeight;
        
        if (reward.consecutiveCorrectVotes > 0) {
            uint256 increase = reward.consecutiveCorrectVotes * 20; // 20 points per consecutive correct vote
            uint256 maxIncrease = maxWeight - minWeight;
            
            multiplier += (increase > maxIncrease) ? maxIncrease : increase;
        }
        
        reward.weightMultiplier = multiplier;
        
        // Calculate weighted score
        uint256 weightedScore = (score * multiplier) / 100;
        
        // Record weighted score for the current epoch
        _weightedScores[currentEpoch][node] = weightedScore;
        _totalWeightedScores[currentEpoch] += weightedScore;
        
        // Add node to epoch participants if not already included
        bool found = false;
        for (uint256 i = 0; i < _epochParticipants[currentEpoch].length; i++) {
            if (_epochParticipants[currentEpoch][i] == node) {
                found = true;
                break;
            }
        }
        
        if (!found) {
            _epochParticipants[currentEpoch].push(node);
        }
        
        emit NodeScoreUpdated(node, currentEpoch, weightedScore, correct);
    }
    
    /**
     * @dev Claim accumulated rewards
     */
    function claimRewards() external nonReentrant whenNotPaused {
        address node = msg.sender;
        require(aiNodeRegistry.isRegisteredNode(node), "Not a registered AI node");
        
        // Check for epoch advancement
        _checkAndAdvanceEpoch();
        
        RewardInfo storage reward = _rewards[node];
        uint256 lastClaimed = reward.lastClaimedEpoch;
        uint256 pendingAmount = reward.pendingRewards;
        
        // Process all unclaimed epochs
        for (uint256 epoch = lastClaimed + 1; epoch < currentEpoch; epoch++) {
            if (_weightedScores[epoch][node] > 0 && _totalWeightedScores[epoch] > 0) {
                uint256 epochReward = _epochRewards[epoch];
                uint256 nodeShare = (epochReward * _weightedScores[epoch][node]) / _totalWeightedScores[epoch];
                pendingAmount += nodeShare;
            }
        }
        
        // Update reward state
        reward.pendingRewards = 0;
        reward.lastClaimedEpoch = currentEpoch - 1;
        
        // Transfer rewards if any
        if (pendingAmount > 0) {
            rewardToken.safeTransfer(node, pendingAmount);
            emit RewardClaimed(node, pendingAmount, currentEpoch - 1);
        }
    }
    
    /**
     * @dev Distribute rewards in batch to optimize gas
     * @param epoch Epoch to distribute rewards for
     * @param maxNodes Maximum number of nodes to process in this batch
     */
    function batchDistributeRewards(uint256 epoch, uint256 maxNodes) 
        external 
        onlyRole(REWARD_MANAGER_ROLE) 
        whenNotPaused 
    {
        require(epoch < currentEpoch, "Cannot distribute for current or future epoch");
        require(_epochRewards[epoch] > 0, "No rewards for this epoch");
        
        address[] memory participants = _epochParticipants[epoch];
        require(participants.length > 0, "No participants in this epoch");
        
        uint256 nodesProcessed = 0;
        uint256 totalParticipants = participants.length;
        uint256 nodesToProcess = (maxNodes == 0 || maxNodes > totalParticipants) ? 
            totalParticipants : maxNodes;
        
        for (uint256 i = 0; i < nodesToProcess; i++) {
            address node = participants[i];
            
            // Skip if node is no longer registered
            if (!aiNodeRegistry.isRegisteredNode(node)) {
                continue;
            }
            
            if (_weightedScores[epoch][node] > 0 && _totalWeightedScores[epoch] > 0) {
                uint256 epochReward = _epochRewards[epoch];
                uint256 nodeShare = (epochReward * _weightedScores[epoch][node]) / _totalWeightedScores[epoch];
                
                if (nodeShare > 0) {
                    _rewards[node].pendingRewards += nodeShare;
                    nodesProcessed++;
                }
            }
        }
        
        // Mark epoch as fully distributed if all nodes processed
        if (nodesToProcess == totalParticipants) {
            // Zero out the epoch reward to prevent double distribution
            _epochRewards[epoch] = 0;
        }
        
        emit BatchRewardDistributed(epoch, nodesProcessed);
    }
    
    /**
     * @dev Check current epoch and advance if necessary
     */
    function _checkAndAdvanceEpoch() internal {
        if (block.timestamp >= epochStartTime + epochDuration) {
            uint256 epochsPassed = (block.timestamp - epochStartTime) / epochDuration;
            
            currentEpoch += epochsPassed;
            epochStartTime += epochsPassed * epochDuration;
            
            emit EpochAdvanced(currentEpoch, epochStartTime);
        }
    }
    
    /**
     * @dev Force advance to the next epoch
     * Only callable by admin or reward manager
     */
    function forceAdvanceEpoch() external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || 
            hasRole(REWARD_MANAGER_ROLE, msg.sender),
            "Not authorized"
        );
        
        currentEpoch++;
        epochStartTime = block.timestamp;
        
        emit EpochAdvanced(currentEpoch, epochStartTime);
    }
    
    /**
     * @dev Set the weight range for reward multipliers
     * @param _minWeight Minimum weight multiplier (100 = 1x)
     * @param _maxWeight Maximum weight multiplier
     */
    function setWeightRange(uint256 _minWeight, uint256 _maxWeight) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_minWeight > 0, "Min weight must be positive");
        require(_maxWeight > _minWeight, "Max weight must be greater than min weight");
        
        minWeight = _minWeight;
        maxWeight = _maxWeight;
        
        emit WeightRangeUpdated(_minWeight, _maxWeight);
    }
    
    /**
     * @dev Set the epoch duration
     * @param _epochDuration New epoch duration in seconds
     */
    function setEpochDuration(uint256 _epochDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_epochDuration > 0, "Epoch duration must be positive");
        
        uint256 oldDuration = epochDuration;
        epochDuration = _epochDuration;
        
        emit EpochDurationUpdated(oldDuration, _epochDuration);
    }
    
    /**
     * @dev Grant oracle role to an address
     * @param oracle Address to grant the oracle role to
     */
    function grantOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, oracle);
    }
    
    /**
     * @dev Revoke oracle role from an address
     * @param oracle Address to revoke the oracle role from
     */
    function revokeOracleRole(address oracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, oracle);
    }
    
    /**
     * @dev Grant reward manager role to an address
     * @param manager Address to grant the reward manager role to
     */
    function grantRewardManagerRole(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REWARD_MANAGER_ROLE, manager);
    }
    
    /**
     * @dev Revoke reward manager role from an address
     * @param manager Address to revoke the reward manager role from
     */
    function revokeRewardManagerRole(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(REWARD_MANAGER_ROLE, manager);
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get the pending rewards for a node
     * @param node Address of the AI Node
     * @return Pending rewards amount
     */
    function getPendingRewards(address node) external view returns (uint256) {
        if (!aiNodeRegistry.isRegisteredNode(node)) {
            return 0;
        }
        
        RewardInfo storage reward = _rewards[node];
        uint256 pendingAmount = reward.pendingRewards;
        
        // Add unclaimed epoch rewards
        for (uint256 epoch = reward.lastClaimedEpoch + 1; epoch < currentEpoch; epoch++) {
            if (_weightedScores[epoch][node] > 0 && _totalWeightedScores[epoch] > 0) {
                uint256 epochReward = _epochRewards[epoch];
                uint256 nodeShare = (epochReward * _weightedScores[epoch][node]) / _totalWeightedScores[epoch];
                pendingAmount += nodeShare;
            }
        }
        
        return pendingAmount;
    }
    
    /**
     * @dev Get reward info for a node
     * @param node Address of the AI Node
     * @return Reward info struct components
     */
    function getRewardInfo(address node) external view returns (
        uint256 pendingRewards,
        uint256 lastClaimedEpoch,
        uint256 consecutiveCorrectVotes,
        uint256 weightMultiplier
    ) {
        RewardInfo storage reward = _rewards[node];
        return (
            reward.pendingRewards,
            reward.lastClaimedEpoch,
            reward.consecutiveCorrectVotes,
            reward.weightMultiplier
        );
    }
    
    /**
     * @dev Get total rewards for an epoch
     * @param epoch Epoch number
     * @return Total rewards for the epoch
     */
    function getEpochRewards(uint256 epoch) external view returns (uint256) {
        return _epochRewards[epoch];
    }
    
    /**
     * @dev Get weighted score for a node in an epoch
     * @param epoch Epoch number
     * @param node Address of the AI Node
     * @return Weighted score for the node in the epoch
     */
    function getWeightedScore(uint256 epoch, address node) external view returns (uint256) {
        return _weightedScores[epoch][node];
    }
    
    /**
     * @dev Get total weighted scores for an epoch
     * @param epoch Epoch number
     * @return Total weighted scores for the epoch
     */
    function getTotalWeightedScores(uint256 epoch) external view returns (uint256) {
        return _totalWeightedScores[epoch];
    }
    
    /**
     * @dev Get participants for an epoch
     * @param epoch Epoch number
     * @return Array of participant addresses
     */
    function getEpochParticipants(uint256 epoch) external view returns (address[] memory) {
        return _epochParticipants[epoch];
    }
    
    /**
     * @dev Get current epoch information
     * @return Current epoch, epoch start time, and time until next epoch
     */
    function getCurrentEpochInfo() external view returns (
        uint256 epoch,
        uint256 startTime,
        uint256 timeRemaining
    ) {
        uint256 endTime = epochStartTime + epochDuration;
        uint256 remaining = block.timestamp >= endTime ? 0 : endTime - block.timestamp;
        
        return (currentEpoch, epochStartTime, remaining);
    }
    
    /**
     * @dev Recover any ERC20 tokens accidentally sent to this contract
     * @param token Address of the token to recover
     * @param amount Amount to recover
     */
    function recoverERC20(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(rewardToken), "Cannot recover reward token");
        
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}