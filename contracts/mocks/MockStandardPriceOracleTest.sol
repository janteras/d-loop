// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";

/**
 * @title MockStandardPriceOracle
 * @dev Standardized mock implementation of the price oracle for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockStandardPriceOracle is BaseMock {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    // Token address => USD price (scaled by 1e18)
    mapping(address => uint256) private tokenPrices;
    
    // Token address => last update timestamp
    mapping(address => uint256) private lastUpdateTime;

    // Events
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event OracleAdminChanged(address indexed newAdmin);
    event PriceUpdaterAdded(address indexed updater);
    event PriceUpdaterRemoved(address indexed updater);

    /**
     * @dev Constructor sets up roles and initializes the mock
     */
    constructor() BaseMock() {
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }

    /**
     * @dev Update price for a token
     * @param token Token address
     * @param price Price in USD, scaled by 1e18
     */
    function updatePrice(
        address token,
        uint256 price
    ) external onlyRole(PRICE_UPDATER_ROLE) {
        _recordFunctionCall(
            "updatePrice",
            abi.encode(token, price)
        );
        
        tokenPrices[token] = price;
        lastUpdateTime[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }

    /**
     * @dev Update prices for multiple tokens
     * @param tokens Array of token addresses
     * @param prices Array of prices in USD, scaled by 1e18
     */
    function updatePrices(
        address[] calldata tokens,
        uint256[] calldata prices
    ) external onlyRole(PRICE_UPDATER_ROLE) {
        _recordFunctionCall(
            "updatePrices",
            abi.encode(tokens, prices)
        );
        
        require(tokens.length == prices.length, "Arrays length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenPrices[tokens[i]] = prices[i];
            lastUpdateTime[tokens[i]] = block.timestamp;
            emit PriceUpdated(tokens[i], prices[i], block.timestamp);
        }
    }

    /**
     * @dev Get price for a token
     * @param token Token address
     * @return price Price in USD, scaled by 1e18
     */
    function getPrice(address token) external view returns (uint256) {
        return tokenPrices[token];
    }

    /**
     * @dev Get the last update time for a token
     * @param token Token address
     * @return timestamp Last update timestamp
     */
    function getLastUpdateTime(address token) external view returns (uint256) {
        return lastUpdateTime[token];
    }

    /**
     * @dev Add a price updater
     * @param updater Address of the updater
     */
    function addPriceUpdater(address updater) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "addPriceUpdater",
            abi.encode(updater)
        );
        
        grantRole(PRICE_UPDATER_ROLE, updater);
        emit PriceUpdaterAdded(updater);
    }

    /**
     * @dev Remove a price updater
     * @param updater Address of the updater to remove
     */
    function removePriceUpdater(address updater) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "removePriceUpdater",
            abi.encode(updater)
        );
        
        revokeRole(PRICE_UPDATER_ROLE, updater);
        emit PriceUpdaterRemoved(updater);
    }

    /**
     * @dev Mock-specific function to set multiple prices instantly
     * @param tokens Array of token addresses
     * @param prices Array of prices
     * @param timestamps Array of timestamps
     */
    function mockSetPricesWithTimestamps(
        address[] calldata tokens,
        uint256[] calldata prices,
        uint256[] calldata timestamps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _recordFunctionCall(
            "mockSetPricesWithTimestamps",
            abi.encode(tokens, prices, timestamps)
        );
        
        require(
            tokens.length == prices.length && 
            prices.length == timestamps.length,
            "Arrays length mismatch"
        );
        
        for (uint256 i = 0; i < tokens.length; i++) {
            tokenPrices[tokens[i]] = prices[i];
            lastUpdateTime[tokens[i]] = timestamps[i];
            emit PriceUpdated(tokens[i], prices[i], timestamps[i]);
        }
    }
}
