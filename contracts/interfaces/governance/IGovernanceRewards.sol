// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IGovernanceRewards
 * @dev Interface for the GovernanceRewards contract which manages distribution of rewards for governance participation
 */
interface IGovernanceRewards {
    // Events
    event RewardDistributed(address indexed recipient, uint256 amount, string reason);
    /**
     * @dev Legacy batch reward event for backward compatibility
     */
    event RewardsDistributed(address[] recipients, uint256[] amounts);
    event RewardConfigUpdated(
        uint256 baseReward,
        uint256 votingParticipationBonus,
        uint256 proposalQualityMultiplier,
        uint256 aiNodeMultiplier,
        uint256 rewardCap
    );


    event EpochRewarded(uint256 epochId, uint256 totalAmount, uint256 participantCount);
    event ParticipantRegistered(address indexed participant, uint256 initialReputation);
    event ReputationUpdated(address indexed participant, uint256 oldReputation, uint256 newReputation);

    /// @notice Address of the reward token contract
    function rewardToken() external view returns (address);
    /// @notice Returns the total rewards earned by a user
    function totalRewardsEarned(address user) external view returns (uint256);

    // Reward structure
    struct RewardConfig {
        uint256 baseReward;                // Base reward amount
        uint256 votingParticipationBonus;  // Bonus for high voting participation (percentage)
        uint256 proposalQualityMultiplier; // Multiplier for high-quality proposals (10000 = 1x)
        uint256 aiNodeMultiplier;          // Multiplier for AI nodes (10000 = 1x)
        uint256 rewardCap;                 // Maximum reward per distribution
    }

    // Reward record
    struct RewardRecord {
        address recipient;
        uint256 amount;
        uint256 timestamp;
        string reason;
    }

    /**
     * @dev Distribute rewards to a participant
     * @param _recipient Address of the reward recipient
     * @param _amount Amount of tokens to distribute
     * @param _reason Reason for the reward
     */
    function distributeReward(address _recipient, uint256 _amount, string memory _reason) external;

    /**
     * @dev Distribute rewards to multiple recipients (legacy signature for backward compatibility)
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     */
    function distributeRewards(address[] memory recipients, uint256[] memory amounts) external;

    /**
     * @dev Distribute rewards to multiple recipients (newer signature for backward compatibility)
     * @param proposalId ID of the proposal
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param description Description of the reward distribution
     */
    function distributeRewards(uint256 proposalId, address[] calldata recipients, uint256[] calldata amounts, string calldata description) external;

    /**
     * @dev Claims rewards for the caller (for backward compatibility)
     * @return amount The amount of rewards claimed
     */
    function claimRewards() external returns (uint256 amount);

    /**
     * @dev Distribute rewards for a proposal
     * @param _proposer Address of the proposal creator
     * @param _proposalId ID of the proposal
     * @param _quality Quality score of the proposal (0-100)
     * @param _voterParticipation Percentage of voters who participated (0-100)
     */
    function distributeProposalReward(
        address _proposer,
        uint256 _proposalId,
        uint256 _quality,
        uint256 _voterParticipation
    ) external;

    /**
     * @dev Distribute epoch rewards to all participants
     * @param _epochId ID of the epoch
     * @return totalDistributed Total amount distributed
     */
    function distributeEpochRewards(uint256 _epochId) external returns (uint256 totalDistributed);

    /**
     * @dev Update the reward configuration
     * @param _baseReward Base reward amount
     * @param _votingParticipationBonus Bonus for high voting participation
     * @param _proposalQualityMultiplier Multiplier for high-quality proposals
     * @param _aiNodeMultiplier Multiplier for AI nodes
     * @param _rewardCap Maximum reward per distribution
     */
    function updateRewardConfig(
        uint256 _baseReward,
        uint256 _votingParticipationBonus,
        uint256 _proposalQualityMultiplier,
        uint256 _aiNodeMultiplier,
        uint256 _rewardCap
    ) external;

    /**
     * @dev Register a participant for rewards
     * @param _participant Address of the participant
     * @param _initialReputation Initial reputation score
     */
    function registerParticipant(address _participant, uint256 _initialReputation) external;

    /**
     * @dev Update a participant's reputation
     * @param _participant Address of the participant
     * @param _newReputation New reputation score
     */
    function updateReputation(address _participant, uint256 _newReputation) external;

    /**
     * @dev Calculate reward for a participant
     * @param _participant Address of the participant
     * @return reward Amount of reward tokens
     */
    function calculateReward(address _participant) external view returns (uint256 reward);

    /**
     * @dev Checks if user is eligible for rewards
     * @param _user Address to check
     * @return True if eligible
     */
    function isEligibleForRewards(address _user) external view returns (bool);

    /**
     * @dev Gets the current reward configuration
     * @return config Current reward configuration
     */
    function getRewardConfig() external view returns (RewardConfig memory config);

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) external view returns (bool);
}
