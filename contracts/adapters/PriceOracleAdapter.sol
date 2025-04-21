// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPriceOracle } from "../interfaces/oracle/IPriceOracle.sol";
import { PriceOracle } from "../oracles/PriceOracle.sol";
import "../utils/Errors.sol";


/**
 * @title PriceOracleAdapter
 * @dev Adapter to make PriceOracle compatible with IPriceOracle interface
 * @notice This contract allows systems expecting the IPriceOracle interface to work with the PriceOracle implementation
 */
contract PriceOracleAdapter is IPriceOracle {
    // The PriceOracle implementation
    PriceOracle public oracle;
    
    // Default decimals for prices
    uint8 private constant DEFAULT_DECIMALS = 8;
    
    // Mapping to store token decimals
    mapping(address => uint8) private tokenDecimals;
    
    /**
     * @dev Constructor to initialize the PriceOracleAdapter contract
     * @param _oracle Address of the PriceOracle implementation
     */
    constructor(address _oracle) {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = PriceOracle(_oracle);
    }
    
    /**
     * @dev Gets the price of an asset
     * @param _asset Address of the asset
     * @return The price of the asset
     */
    function getAssetPrice(address _asset) external view override returns (uint256) {
        return oracle.getPrice(_asset);
    }
    
    /**
     * @dev Gets the decimals for an asset price
     * @param _asset Address of the asset
     * @return The number of decimals
     */
    function getAssetDecimals(address _asset) external view override returns (uint8) {
        // If we have stored custom decimals, return those
        uint8 decimals = tokenDecimals[_asset];
        
        // Otherwise return the default
        return decimals > 0 ? decimals : DEFAULT_DECIMALS;
    }
    
    /**
     * @dev Sets decimals for a token
     * @param _asset Address of the asset
     * @param _decimals Number of decimals
     */
    function setTokenDecimals(address _asset, uint8 _decimals) external {
        if (_asset == address(0)) revert ZeroAddress();
        tokenDecimals[_asset] = _decimals;
    }
}