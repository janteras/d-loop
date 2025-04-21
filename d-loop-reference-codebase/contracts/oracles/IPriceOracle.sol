// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPriceOracle
 * @notice Interface for price oracles in the D-Loop system
 * @dev Used for standardized price data access across the protocol
 */
interface IPriceOracle {
    /**
     * @notice Gets the price of an asset in USD
     * @param asset The address of the asset
     * @return price The price of the asset in USD with 8 decimals (e.g., 100000000 = 1 USD)
     */
    function getAssetPriceUSD(address asset) external view returns (uint256);
    
    /**
     * @notice Gets the latest update timestamp for the price of an asset
     * @param asset The address of the asset
     * @return timestamp The timestamp of the last price update
     */
    function getLastUpdateTimestamp(address asset) external view returns (uint256);
    
    /**
     * @notice Gets the reliability score of the price data
     * @param asset The address of the asset
     * @return score The reliability score (0-100)
     */
    function getReliabilityScore(address asset) external view returns (uint8);
    
    /**
     * @notice Checks if the oracle supports an asset
     * @param asset The address of the asset
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) external view returns (bool);
}