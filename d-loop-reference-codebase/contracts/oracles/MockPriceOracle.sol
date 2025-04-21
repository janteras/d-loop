// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IPriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceOracle
 * @notice A mock price oracle for testing purposes
 */
contract MockPriceOracle is IPriceOracle, Ownable {
    // Mapping from asset address to price (with 8 decimals precision)
    mapping(address => int256) private _prices;
    
    // Mapping from asset address to historical prices
    mapping(address => mapping(uint256 => int256)) private _historicalPrices;
    
    // Mapping from asset address to supported status
    mapping(address => bool) private _supportedAssets;
    
    // Events
    event PriceSet(address indexed asset, int256 price);
    event HistoricalPriceSet(address indexed asset, uint256 timestamp, int256 price);
    event AssetSupportUpdated(address indexed asset, bool isSupported);

    /**
     * @notice Set the latest price for an asset
     * @param asset Address of the asset
     * @param price Price with 8 decimals precision
     */
    function setPrice(address asset, int256 price) external onlyOwner {
        require(price > 0, "Price must be positive");
        
        _prices[asset] = price;
        _supportedAssets[asset] = true;
        
        emit PriceSet(asset, price);
    }
    
    /**
     * @notice Set a historical price for an asset
     * @param asset Address of the asset
     * @param timestamp Timestamp to set the price at
     * @param price Price with 8 decimals precision
     */
    function setHistoricalPrice(address asset, uint256 timestamp, int256 price) external onlyOwner {
        require(timestamp <= block.timestamp, "Cannot set future price");
        require(price > 0, "Price must be positive");
        
        _historicalPrices[asset][timestamp] = price;
        _supportedAssets[asset] = true;
        
        emit HistoricalPriceSet(asset, timestamp, price);
    }
    
    /**
     * @notice Set support status for an asset
     * @param asset Address of the asset
     * @param isSupported Whether the asset is supported
     */
    function setAssetSupport(address asset, bool isSupported) external onlyOwner {
        _supportedAssets[asset] = isSupported;
        
        emit AssetSupportUpdated(asset, isSupported);
    }
    
    /**
     * @dev Gets the latest price of an asset
     * @param asset Address of the asset
     * @return Latest price of the asset with 8 decimals precision
     */
    function getLatestPrice(address asset) external view override returns (int256) {
        require(_supportedAssets[asset], "Asset not supported");
        require(_prices[asset] > 0, "No price data available");
        
        return _prices[asset];
    }
    
    /**
     * @dev Gets the asset price (wrapper for getLatestPrice that returns uint256)
     * @param asset Address of the asset
     * @return Latest price of the asset as a uint256 with 8 decimals precision
     */
    function getAssetPrice(address asset) external view override returns (uint256) {
        require(_supportedAssets[asset], "Asset not supported");
        require(_prices[asset] > 0, "No price data available");
        
        int256 price = _prices[asset];
        require(price > 0, "Price must be positive");
        
        return uint256(price);
    }
    
    /**
     * @dev Gets the price of an asset at a specific timestamp
     * @param asset Address of the asset
     * @param timestamp Timestamp to get the price at
     * @return Price of the asset at the timestamp with 8 decimals precision
     */
    function getPriceAt(address asset, uint256 timestamp) external view override returns (int256) {
        require(_supportedAssets[asset], "Asset not supported");
        
        // If we have a specific historical price, return it
        if (_historicalPrices[asset][timestamp] > 0) {
            return _historicalPrices[asset][timestamp];
        }
        
        // Otherwise, fall back to latest price
        require(_prices[asset] > 0, "No price data available");
        return _prices[asset];
    }
    
    /**
     * @dev Checks if an asset is supported by the oracle
     * @param asset Address of the asset
     * @return True if supported, false otherwise
     */
    function isAssetSupported(address asset) external view override returns (bool) {
        return _supportedAssets[asset];
    }
}