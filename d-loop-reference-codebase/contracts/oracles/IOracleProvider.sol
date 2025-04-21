// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IOracleProvider
 * @dev Interface for Oracle Providers in the DLOOP ecosystem
 * This interface defines the standard methods for requesting and receiving data
 * from oracle services, providing a consistent API across different types of oracles.
 */
interface IOracleProvider {
    /**
     * @dev Returns the latest price data for a given asset
     * @param asset The asset identifier (token address or symbol)
     * @return price The current price of the asset (with 18 decimals)
     * @return timestamp The timestamp when the price was last updated
     */
    function getLatestPrice(string calldata asset) external view returns (uint256 price, uint256 timestamp);
    
    /**
     * @dev Returns a list of supported assets
     * @return assets Array of supported asset identifiers
     */
    function supportedAssets() external view returns (string[] memory assets);
    
    /**
     * @dev Returns the current status of the oracle
     * @return status True if the oracle is active and operating correctly
     */
    function isActive() external view returns (bool status);
    
    /**
     * @dev Number of decimal places in the returned price data
     * @return decimals The number of decimal places
     */
    function decimals() external view returns (uint8 decimals);
    
    /**
     * @dev Event emitted when a new price is available
     * @param asset The asset identifier
     * @param price The new price
     * @param timestamp The timestamp of the update
     */
    event PriceUpdated(string indexed asset, uint256 price, uint256 timestamp);
}