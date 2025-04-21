// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title IFeeProcessor
 * @notice Interface for fee processing
 * @dev Used to process collected fees, distributing them to the Treasury and RewardDistributor
 */
interface IFeeProcessor {
    /**
     * @notice Process a collected fee
     * @param token Address of the token being processed
     * @param amount Amount of the fee to process
     */
    function processFee(address token, uint256 amount) external;
    
    /**
     * @notice Get the current fee distribution breakdown
     * @return treasuryShare Percentage of fees going to Treasury (scaled by 1e18)
     * @return rewardsShare Percentage of fees going to RewardDistributor (scaled by 1e18)
     */
    function getFeeDistribution() external view returns (
        uint256 treasuryShare,
        uint256 rewardsShare
    );
    
    /**
     * @notice Get the addresses of the Treasury and RewardDistributor
     * @return treasury Address of the Treasury contract
     * @return rewardDistributor Address of the RewardDistributor contract
     */
    function getDistributionAddresses() external view returns (
        address treasury,
        address rewardDistributor
    );
}