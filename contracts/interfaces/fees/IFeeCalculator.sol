// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IFeeCalculator
 * @dev Interface for the FeeCalculator contract.
 * Calculates fees for various operations in the protocol.
 */
interface IFeeCalculator {
    /**
     * @dev Calculates the investment fee for a given amount
     * @param _amount The amount to calculate the fee for
     * @return The calculated fee amount
     */
    function calculateInvestmentFee(uint256 _amount) external view returns (uint256);

    /**
     * @dev Calculates the divestment fee for a given amount
     * @param _amount The amount to calculate the fee for
     * @return The calculated fee amount
     */
    function calculateDivestmentFee(uint256 _amount) external view returns (uint256);
}
