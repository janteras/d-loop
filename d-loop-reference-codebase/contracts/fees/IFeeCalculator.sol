// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFeeCalculator
 * @dev Interface for FeeCalculator contract
 */
interface IFeeCalculator {
    /**
     * @notice Calculate investment fee for a given amount
     * @param user Address of the user making the investment
     * @param amount Amount being invested
     * @return feeAmount Total fee amount
     * @return treasuryFee Portion of fee going to treasury
     * @return rewardDistributorFee Portion of fee going to reward distributor
     */
    function calculateInvestmentFee(address user, uint256 amount)
        external
        returns (uint256, uint256, uint256);
    
    /**
     * @notice Calculate divestment fee for a given amount
     * @param user Address of the user making the divestment
     * @param amount Amount being divested
     * @return feeAmount Total fee amount
     * @return treasuryFee Portion of fee going to treasury
     * @return rewardDistributorFee Portion of fee going to reward distributor
     */
    function calculateDivestmentFee(address user, uint256 amount)
        external
        returns (uint256, uint256, uint256);
    
    /**
     * @notice Calculate ragequit fee for a given amount
     * @param user Address of the user executing ragequit
     * @param amount Amount being withdrawn via ragequit
     * @return feeAmount Total fee amount
     * @return treasuryFee Portion of fee going to treasury
     * @return rewardDistributorFee Portion of fee going to reward distributor
     */
    function calculateRagequitFee(address user, uint256 amount)
        external
        returns (uint256, uint256, uint256);
}