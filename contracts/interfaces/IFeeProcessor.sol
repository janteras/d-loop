// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IFeeProcessor
 * @dev Interface for fee processing functionality
 */
interface IFeeProcessor {
    /**
     * @dev Process fees for a transaction
     * @param amount The amount of tokens to process fees for
     * @return uint256 The amount of fees collected
     */
    function processFees(uint256 amount) external returns (uint256);

    /**
     * @dev Get the current fee rate
     * @return uint256 The current fee rate (in basis points)
     */
    function getFeeRate() external view returns (uint256);

    /**
     * @dev Calculate fees for a given amount
     * @param amount The amount to calculate fees for
     * @return uint256 The calculated fee amount
     */
    function calculateFees(uint256 amount) external view returns (uint256);

    /**
     * @dev Event emitted when fees are processed
     */
    event FeesProcessed(uint256 amount, uint256 feeAmount);

    /**
     * @dev Event emitted when fee rate is updated
     */
    event FeeRateUpdated(uint256 oldRate, uint256 newRate);
}
