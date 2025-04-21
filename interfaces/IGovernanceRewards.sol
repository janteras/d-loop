// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IGovernanceRewards
 * @dev Interface for the GovernanceRewards contract which manages rewards for governance participants
 */
interface IGovernanceRewards {
    /**
     * @dev Emitted when rewards are distributed to a participant
     */
    event RewardsDistributed(address indexed participant, uint256 amount);
    
    /**
     * @dev Emitted when a new epoch begins
     */
    event EpochStarted(uint256 indexed epochId, uint256 startTime);
    
    /**
     * @dev Emitted when an epoch ends
     */
    event EpochEnded(uint256 indexed epochId, uint256 endTime, uint256 totalRewards);
    
    /**
     * @dev Emitted when a participant claims their rewards
     */
    event RewardsClaimed(address indexed participant, uint256 amount);

    /**
     * @dev Starts a new rewards epoch
     * @return epochId The ID of the new epoch
     */
    function startEpoch() external returns (uint256 epochId);
    
    /**
     * @dev Ends the current rewards epoch
     * @return totalRewards The total rewards distributed in the epoch
     */
    function endEpoch() external returns (uint256 totalRewards);
    
    /**
     * @dev Calculates rewards for a participant
     * @param participant Address of the participant
     * @return amount The calculated reward amount
     */
    function calculateRewards(address participant) external view returns (uint256 amount);
    
    /**
     * @dev Distributes rewards to a participant
     * @param participant Address of the participant
     * @param amount Amount of rewards to distribute
     */
    function distributeRewards(address participant, uint256 amount) external;
    
    /**
     * @dev Allows a participant to claim their accumulated rewards
     * @return amount The amount of rewards claimed
     */
    function claimRewards() external returns (uint256 amount);
    
    /**
     * @dev Gets the current epoch ID
     * @return epochId The current epoch ID
     */
    function getCurrentEpoch() external view returns (uint256 epochId);
    
    /**
     * @dev Gets the start time of an epoch
     * @param epochId ID of the epoch
     * @return startTime The start time of the epoch
     */
    function getEpochStartTime(uint256 epochId) external view returns (uint256 startTime);
    
    /**
     * @dev Gets the end time of an epoch
     * @param epochId ID of the epoch
     * @return endTime The end time of the epoch
     */
    function getEpochEndTime(uint256 epochId) external view returns (uint256 endTime);
    
    /**
     * @dev Gets the total rewards distributed in an epoch
     * @param epochId ID of the epoch
     * @return totalRewards The total rewards distributed
     */
    function getEpochTotalRewards(uint256 epochId) external view returns (uint256 totalRewards);
    
    /**
     * @dev Gets the unclaimed rewards for a participant
     * @param participant Address of the participant
     * @return amount The unclaimed rewards amount
     */
    function getUnclaimedRewards(address participant) external view returns (uint256 amount);
}
