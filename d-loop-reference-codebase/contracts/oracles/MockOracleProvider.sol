// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../oracles/IOracleProvider.sol";

/**
 * @title MockOracleProvider
 * @dev A mock implementation of IOracleProvider for testing
 */
contract MockOracleProvider is IOracleProvider {
    mapping(string => uint256) private prices;
    mapping(string => uint256) private timestamps;
    string[] private assets;
    bool private active = true;
    
    event AssetAdded(string asset);
    
    constructor() {
        // Initialize with some default assets
        addAsset("BTC", 60000 * 1e18);
        addAsset("ETH", 3000 * 1e18);
        addAsset("USDC", 1 * 1e18);
    }
    
    function addAsset(string memory asset, uint256 price) public {
        bool exists = false;
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            assets.push(asset);
            emit AssetAdded(asset);
        }
        
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function updatePrice(string memory asset, uint256 price) public {
        require(price > 0, "Price must be positive");
        bool found = false;
        
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                found = true;
                break;
            }
        }
        
        require(found, "Asset not supported");
        
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function getLatestPrice(string calldata asset) external view override returns (uint256 price, uint256 timestamp) {
        bool found = false;
        
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                found = true;
                break;
            }
        }
        
        require(found, "Asset not supported");
        
        return (prices[asset], timestamps[asset]);
    }
    
    function supportedAssets() external view override returns (string[] memory) {
        return assets;
    }
    
    function isActive() external view override returns (bool status) {
        return active;
    }
    
    function setActive(bool _active) external {
        active = _active;
    }
    
    function decimals() external pure override returns (uint8) {
        return 18;
    }
}