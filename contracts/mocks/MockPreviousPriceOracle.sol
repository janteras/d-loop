// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/oracle/IPriceOracle.sol";
import "../utils/Errors.sol";

/**
 * @title MockPreviousPriceOracle
 * @dev Simulates a previous version of PriceOracle with slightly different API
 * @notice Used for backward compatibility testing
 */
contract MockPreviousPriceOracle is IPriceOracle {
    // Mapping of token address to USD price (scaled by 10^8)
    mapping(address => uint256) private assetPrices;
    
    // Mapping of token address to decimals
    mapping(address => uint8) private assetDecimals;
    
    // Role management
    address public owner;
    
    /**
     * @dev Constructor to initialize the MockPreviousPriceOracle contract
     */
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Sets the price for an asset
     * @param _asset Address of the asset
     * @param _price Price of the asset in USD (scaled by 10^8)
     * @param _decimals Number of decimals for the price
     */
    function setAssetPrice(address _asset, uint256 _price, uint8 _decimals) external {
        require(_asset != address(0), "Zero address not allowed");
        
        assetPrices[_asset] = _price;
        assetDecimals[_asset] = _decimals;
    }
    
    /**
     * @dev Gets the price of an asset
     * @param _asset Address of the asset
     * @return The price of the asset
     */
    function getAssetPrice(address _asset) external view override returns (uint256) {
        require(_asset != address(0), "Zero address not allowed");
        require(assetPrices[_asset] > 0, "Price not set");
        
        return assetPrices[_asset];
    }
    
    /**
     * @dev Gets the decimals for an asset price
     * @param _asset Address of the asset
     * @return The number of decimals
     */
    function getAssetDecimals(address _asset) external view override returns (uint8) {
        require(_asset != address(0), "Zero address not allowed");
        
        return assetDecimals[_asset];
    }
}