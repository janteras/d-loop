// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IFeeSystem
 * @dev Interface for the fee system functionality
 */
interface IFeeSystem {
    struct FeeConfig {
        uint256 baseFee;
        uint256 variableFee;
        uint256 minimumFee;
        uint256 maximumFee;
    }

    /**
     * @dev Calculate the total fee for a transaction
     * @param amount The transaction amount
     * @param feeType The type of fee to calculate
     * @return uint256 The calculated fee amount
     */
    function calculateFee(uint256 amount, uint8 feeType) external view returns (uint256);

    /**
     * @dev Get the current fee configuration
     * @param feeType The type of fee configuration to retrieve
     * @return FeeConfig The current fee configuration
     */
    function getFeeConfig(uint8 feeType) external view returns (FeeConfig memory);

    /**
     * @dev Update the fee configuration
     * @param feeType The type of fee configuration to update
     * @param config The new fee configuration
     */
    function updateFeeConfig(uint8 feeType, FeeConfig calldata config) external;

    /**
     * @dev Check if a fee type is supported
     * @param feeType The fee type to check
     * @return bool True if the fee type is supported
     */
    function isFeeTypeSupported(uint8 feeType) external view returns (bool);

    /**
     * @dev Event emitted when a fee configuration is updated
     */
    event FeeConfigUpdated(uint8 indexed feeType, FeeConfig config);

    /**
     * @dev Event emitted when a fee is calculated
     */
    event FeeCalculated(uint8 indexed feeType, uint256 amount, uint256 fee);
}
