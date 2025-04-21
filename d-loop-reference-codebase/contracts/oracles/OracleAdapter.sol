// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IPriceOracle.sol";
import "./IOracleProvider.sol";

/**
 * @title OracleAdapter
 * @dev Adapter to bridge between existing IOracleProvider and new IPriceOracle interfaces
 * This contract translates between the two oracle interfaces, allowing seamless integration
 * of existing components with the new oracle system
 */
contract OracleAdapter is IPriceOracle, AccessControl {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Original oracle provider
    IOracleProvider public originalOracle;
    
    // Asset address to asset identifier mapping
    mapping(address => string) private _assetIdentifiers;
    
    // Supported assets list
    address[] private _supportedAssets;
    
    // Events
    event AssetMapped(address indexed assetAddress, string identifier);
    event OracleUpdated(address indexed newOracle);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param _originalOracle Address of the original oracle
     */
    constructor(address admin, address _originalOracle) {
        require(admin != address(0), "OracleAdapter: Zero admin address");
        require(_originalOracle != address(0), "OracleAdapter: Zero oracle address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        originalOracle = IOracleProvider(_originalOracle);
    }
    
    /**
     * @dev Get the current price of an asset
     * @param asset The address of the asset token
     * @return price The current price (scaled to 18 decimals)
     * @return timestamp The timestamp of the last price update
     */
    function getAssetPrice(address asset) external view override returns (uint256 price, uint256 timestamp) {
        require(_assetIdentifiers[asset].length > 0, "OracleAdapter: Asset not mapped");
        
        // Get price from original oracle with the mapped identifier
        return originalOracle.getLatestPrice(_assetIdentifiers[asset]);
    }
    
    /**
     * @dev Check if an asset is supported
     * @param asset The address of the asset token
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) external view override returns (bool supported) {
        return _assetIdentifiers[asset].length > 0;
    }
    
    /**
     * @dev Get all supported assets
     * @return assets Array of supported asset addresses
     */
    function getSupportedAssets() external view override returns (address[] memory assets) {
        return _supportedAssets;
    }
    
    /**
     * @dev Get the price decimals
     * @return decimals Number of decimals used for price representation
     */
    function getPriceDecimals() external view override returns (uint8 decimals) {
        return 18; // Always use 18 decimals for price normalization
    }
    
    /**
     * @dev Map an asset address to its identifier in the original oracle
     * @param asset Asset address
     * @param identifier Asset identifier string
     */
    function mapAsset(address asset, string calldata identifier) external onlyRole(ADMIN_ROLE) {
        require(asset != address(0), "OracleAdapter: Zero asset address");
        require(bytes(identifier).length > 0, "OracleAdapter: Empty identifier");
        
        bool isNewAsset = bytes(_assetIdentifiers[asset]).length == 0;
        
        _assetIdentifiers[asset] = identifier;
        
        if (isNewAsset) {
            _supportedAssets.push(asset);
        }
        
        emit AssetMapped(asset, identifier);
    }
    
    /**
     * @dev Check if an identifier is supported by the original oracle
     * @param identifier Asset identifier string
     * @return isSupported Whether the identifier is supported
     */
    function checkIdentifierSupported(string calldata identifier) external view returns (bool isSupported) {
        string[] memory supportedAssets = originalOracle.supportedAssets();
        
        for (uint256 i = 0; i < supportedAssets.length; i++) {
            if (keccak256(bytes(supportedAssets[i])) == keccak256(bytes(identifier))) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Update the original oracle address
     * @param _originalOracle New oracle address
     */
    function updateOriginalOracle(address _originalOracle) external onlyRole(ADMIN_ROLE) {
        require(_originalOracle != address(0), "OracleAdapter: Zero oracle address");
        originalOracle = IOracleProvider(_originalOracle);
        
        emit OracleUpdated(_originalOracle);
    }
    
    /**
     * @dev Get the original oracle's supported assets
     * @return assets Array of supported asset identifiers
     */
    function getOriginalOracleAssets() external view returns (string[] memory assets) {
        return originalOracle.supportedAssets();
    }
}