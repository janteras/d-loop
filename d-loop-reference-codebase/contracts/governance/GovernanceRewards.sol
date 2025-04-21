// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../identity/AINodeRegistry.sol";

/**
 * @title GovernanceRewards
 * @notice Manages rewards for governance participation, with special rules for AI nodes
 */
contract GovernanceRewards is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable, 
    UUPSUpgradeable 
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARDS_MANAGER_ROLE = keccak256("REWARDS_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Reference to the AI node registry
    AINodeRegistry public aiNodeRegistry;
    
    // Reward period data
    struct RewardPeriod {
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewardAmount;
        uint256 aiNodeRewardShare; // Percentage in basis points (1/100 of a percent)
        uint256 humanRewardShare;  // Percentage in basis points
        bool finalized;
        mapping(address => bool) hasParticipated;
        mapping(address => bool) hasClaimedReward;
        address[] participants;
        address[] aiNodeParticipants;
        address[] humanParticipants;
    }
    
    // Mapping from period ID to reward period data
    mapping(uint256 => RewardPeriod) private _rewardPeriods;
    
    // Current period ID
    uint256 private _currentPeriodId;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000; // 100% in basis points
    
    // AI node vote criteria
    uint256 public aiVotingPeriod;      // Voting period for AI nodes (in seconds)
    uint256 public humanVotingPeriod;   // Voting period for humans (in seconds)
    
    // Events
    event RewardPeriodCreated(uint256 indexed periodId, uint256 startTime, uint256 endTime, uint256 totalReward);
    event ParticipationRecorded(uint256 indexed periodId, address indexed participant, bool isAINode);
    event RewardClaimed(uint256 indexed periodId, address indexed participant, uint256 amount);
    event RewardPeriodFinalized(uint256 indexed periodId, uint256 aiNodeParticipants, uint256 humanParticipants);
    event VotingPeriodUpdated(string votingType, uint256 oldPeriod, uint256 newPeriod);
    
    /**
     * @notice Initializes the contract
     * @param aiNodeRegistryAddress Address of the AINodeRegistry contract
     */
    function initialize(address aiNodeRegistryAddress) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(REWARDS_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        aiNodeRegistry = AINodeRegistry(aiNodeRegistryAddress);
        
        // Default voting periods
        aiVotingPeriod = 1 days;       // 1 day for AI nodes
        humanVotingPeriod = 7 days;    // 7 days for humans
        
        _currentPeriodId = 0;
    }
    
    /**
     * @notice Creates a new reward period
     * @param startTime Start time of the period
     * @param endTime End time of the period
     * @param totalReward Total reward amount for the period
     * @param aiNodeShare Percentage of rewards allocated to AI nodes (in basis points)
     * @param humanShare Percentage of rewards allocated to humans (in basis points)
     * @return periodId ID of the newly created period
     */
    function createRewardPeriod(
        uint256 startTime,
        uint256 endTime,
        uint256 totalReward,
        uint256 aiNodeShare,
        uint256 humanShare
    ) external onlyRole(REWARDS_MANAGER_ROLE) returns (uint256) {
        require(startTime < endTime, "Start time must be before end time");
        require(startTime >= block.timestamp, "Start time must be in the future");
        require(totalReward > 0, "Total reward must be greater than 0");
        require(aiNodeShare + humanShare == BASIS_POINTS, "Shares must sum to 100%");
        
        uint256 periodId = _currentPeriodId + 1;
        _currentPeriodId = periodId;
        
        RewardPeriod storage period = _rewardPeriods[periodId];
        period.startTime = startTime;
        period.endTime = endTime;
        period.totalRewardAmount = totalReward;
        period.aiNodeRewardShare = aiNodeShare;
        period.humanRewardShare = humanShare;
        period.finalized = false;
        
        emit RewardPeriodCreated(periodId, startTime, endTime, totalReward);
        
        return periodId;
    }
    
    /**
     * @notice Records participation in governance for a reward period
     * @param periodId ID of the reward period
     * @param participant Address of the participant
     */
    function recordParticipation(
        uint256 periodId, 
        address participant
    ) external onlyRole(REWARDS_MANAGER_ROLE) {
        RewardPeriod storage period = _rewardPeriods[periodId];
        
        require(block.timestamp >= period.startTime, "Reward period has not started");
        require(block.timestamp <= period.endTime, "Reward period has ended");
        require(!period.hasParticipated[participant], "Participant already recorded");
        
        bool isAINode = aiNodeRegistry.isVerifiedNode(participant);
        
        // Check if the voting period is still open based on participant type
        if (isAINode) {
            require(
                block.timestamp <= period.startTime + aiVotingPeriod,
                "AI node voting period has ended"
            );
            period.aiNodeParticipants.push(participant);
        } else {
            require(
                block.timestamp <= period.startTime + humanVotingPeriod,
                "Human voting period has ended"
            );
            period.humanParticipants.push(participant);
        }
        
        period.hasParticipated[participant] = true;
        period.participants.push(participant);
        
        emit ParticipationRecorded(periodId, participant, isAINode);
    }
    
    /**
     * @notice Finalizes a reward period
     * @param periodId ID of the reward period to finalize
     */
    function finalizeRewardPeriod(uint256 periodId) external onlyRole(REWARDS_MANAGER_ROLE) {
        RewardPeriod storage period = _rewardPeriods[periodId];
        
        require(block.timestamp > period.endTime, "Reward period has not ended");
        require(!period.finalized, "Reward period already finalized");
        
        period.finalized = true;
        
        emit RewardPeriodFinalized(
            periodId, 
            period.aiNodeParticipants.length, 
            period.humanParticipants.length
        );
    }
    
    /**
     * @notice Allows a participant to claim their reward for a period
     * @param periodId ID of the reward period
     * @param participant Address of the participant claiming the reward
     * @return rewardAmount Amount of reward tokens the participant is entitled to
     */
    function claimReward(
        uint256 periodId, 
        address participant
    ) external onlyRole(REWARDS_MANAGER_ROLE) nonReentrant returns (uint256) {
        RewardPeriod storage period = _rewardPeriods[periodId];
        
        require(period.finalized, "Reward period not finalized");
        require(period.hasParticipated[participant], "Participant did not participate");
        require(!period.hasClaimedReward[participant], "Reward already claimed");
        
        bool isAINode = aiNodeRegistry.isVerifiedNode(participant);
        uint256 rewardAmount;
        
        if (isAINode) {
            if (period.aiNodeParticipants.length > 0) {
                // Calculate AI node's share of the reward
                uint256 aiNodeTotalReward = (period.totalRewardAmount * period.aiNodeRewardShare) / BASIS_POINTS;
                rewardAmount = aiNodeTotalReward / period.aiNodeParticipants.length;
            }
        } else {
            if (period.humanParticipants.length > 0) {
                // Calculate human's share of the reward
                uint256 humanTotalReward = (period.totalRewardAmount * period.humanRewardShare) / BASIS_POINTS;
                rewardAmount = humanTotalReward / period.humanParticipants.length;
            }
        }
        
        period.hasClaimedReward[participant] = true;
        
        emit RewardClaimed(periodId, participant, rewardAmount);
        
        return rewardAmount;
    }
    
    /**
     * @notice Sets the voting period for AI nodes
     * @param newPeriod New voting period in seconds
     */
    function setAIVotingPeriod(uint256 newPeriod) external onlyRole(ADMIN_ROLE) {
        require(newPeriod > 0, "Voting period must be greater than 0");
        
        uint256 oldPeriod = aiVotingPeriod;
        aiVotingPeriod = newPeriod;
        
        emit VotingPeriodUpdated("AI", oldPeriod, newPeriod);
    }
    
    /**
     * @notice Sets the voting period for humans
     * @param newPeriod New voting period in seconds
     */
    function setHumanVotingPeriod(uint256 newPeriod) external onlyRole(ADMIN_ROLE) {
        require(newPeriod > 0, "Voting period must be greater than 0");
        
        uint256 oldPeriod = humanVotingPeriod;
        humanVotingPeriod = newPeriod;
        
        emit VotingPeriodUpdated("Human", oldPeriod, newPeriod);
    }
    
    /**
     * @notice Gets the current reward period ID
     * @return Current period ID
     */
    function getCurrentPeriodId() external view returns (uint256) {
        return _currentPeriodId;
    }
    
    /**
     * @notice Gets basic information about a reward period
     * @param periodId ID of the reward period
     * @return startTime Start time of the period
     * @return endTime End time of the period
     * @return totalReward Total reward amount for the period
     * @return aiNodeShare Percentage of rewards allocated to AI nodes
     * @return humanShare Percentage of rewards allocated to humans
     * @return finalized Whether the period has been finalized
     */
    function getRewardPeriodInfo(uint256 periodId) external view returns (
        uint256 startTime,
        uint256 endTime,
        uint256 totalReward,
        uint256 aiNodeShare,
        uint256 humanShare,
        bool finalized
    ) {
        RewardPeriod storage period = _rewardPeriods[periodId];
        return (
            period.startTime,
            period.endTime,
            period.totalRewardAmount,
            period.aiNodeRewardShare,
            period.humanRewardShare,
            period.finalized
        );
    }
    
    /**
     * @notice Gets participation information for a reward period
     * @param periodId ID of the reward period
     * @return totalParticipants Total number of participants
     * @return aiNodeParticipants Number of AI node participants
     * @return humanParticipants Number of human participants
     */
    function getParticipationInfo(uint256 periodId) external view returns (
        uint256 totalParticipants,
        uint256 aiNodeParticipants,
        uint256 humanParticipants
    ) {
        RewardPeriod storage period = _rewardPeriods[periodId];
        return (
            period.participants.length,
            period.aiNodeParticipants.length,
            period.humanParticipants.length
        );
    }
    
    /**
     * @notice Checks if an address has participated in a reward period
     * @param periodId ID of the reward period
     * @param participant Address to check
     * @return True if the address has participated
     */
    function hasParticipated(uint256 periodId, address participant) external view returns (bool) {
        return _rewardPeriods[periodId].hasParticipated[participant];
    }
    
    /**
     * @notice Checks if an address has claimed their reward for a period
     * @param periodId ID of the reward period
     * @param participant Address to check
     * @return True if the address has claimed their reward
     */
    function hasClaimedReward(uint256 periodId, address participant) external view returns (bool) {
        return _rewardPeriods[periodId].hasClaimedReward[participant];
    }
    
    /**
     * @dev Required override for UUPSUpgradeable - restrict upgrades to UPGRADER_ROLE
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}