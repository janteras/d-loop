// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../utils/Errors.sol";
import "./base/BaseMock.sol";
import "../interfaces/oracle/IPriceOracle.sol";

/**
 * @title MockPriceOracle
 * @dev Comprehensive mock implementation of a price oracle for testing purposes
 * @notice This contract follows the standard mock pattern using BaseMock and implements IPriceOracle
 */
contract MockPriceOracle is BaseMock, IPriceOracle {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    // Token address => USD price (scaled by 1e18)
    mapping(address => uint256) private tokenPrices;

    // Token address => last update timestamp
    mapping(address => uint256) private lastUpdateTime;
    
    // Token address => historical prices (index => price)
    mapping(address => mapping(uint256 => uint256)) private historicalPrices;
    
    // Token address => historical timestamps (index => timestamp)
    mapping(address => mapping(uint256 => uint256)) private historicalTimestamps;
    
    // Token address => history count
    mapping(address => uint256) private historyCount;
    
    // Price feed configuration
    uint256 public updateFrequency;
    uint256 public maxPriceDeviation;
    bool public emergencyMode;

    // Events
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event OracleAdminChanged(address indexed newAdmin);
    event PriceUpdaterAdded(address indexed updater);
    event PriceUpdaterRemoved(address indexed updater);
    event EmergencyModeChanged(bool enabled);
    event ConfigUpdated(uint256 updateFrequency, uint256 maxPriceDeviation);

    /**
     * @dev Constructor sets up roles and initializes the mock
     */
    constructor() BaseMock() {
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
        updateFrequency = 3600; // 1 hour default
        maxPriceDeviation = 500; // 5% default
        emergencyMode = false;
    }

    /**
     * @dev Update price for a token
     * @param token Token address
     * @param price Price in USD, scaled by 1e18
     */
    function updatePrice(address token, uint256 price) external onlyRole(PRICE_UPDATER_ROLE) {
        _recordFunctionCall(
            "updatePrice",
            abi.encode(token, price)
        );
        
        // Store historical price data
        uint256 index = historyCount[token];
        historicalPrices[token][index] = price;
        historicalTimestamps[token][index] = block.timestamp;
        historyCount[token] = index + 1;
        
        // Check price deviation if not in emergency mode
        if (!emergencyMode && tokenPrices[token] > 0) {
            uint256 previousPrice = tokenPrices[token];
            uint256 deviation = 0;
            
            if (price > previousPrice) {
                deviation = ((price - previousPrice) * 10000) / previousPrice;
            } else {
                deviation = ((previousPrice - price) * 10000) / previousPrice;
            }
            
            require(deviation <= maxPriceDeviation, "Price deviation too high");
        }
        
        tokenPrices[token] = price;
        lastUpdateTime[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }

    /**
     * @dev Update prices for multiple tokens
     * @param tokens Array of token addresses
     * @param prices Array of prices in USD, scaled by 1e18
     */
    function updatePrices(address[] calldata tokens, uint256[] calldata prices) 
        external 
        onlyRole(PRICE_UPDATER_ROLE)
    {
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
        require(tokenPrices[token] > 0, "Price not set");
        return tokenPrices[token];
    }
    
    /**
     * @dev Get price and timestamp for a token
     * @param token Token address
     * @return price Price in USD, scaled by 1e18
     * @return timestamp Last update timestamp
     */
    function getPriceWithTimestamp(address token) external view returns (uint256 price, uint256 timestamp) {
        require(tokenPrices[token] > 0, "Price not set");
        return (tokenPrices[token], lastUpdateTime[token]);
    }
    
    /**
     * @dev Get historical price data for a token
     * @param token Token address
     * @param index Index in the history (0 is oldest)
     * @return price Historical price
     * @return timestamp Timestamp when the price was recorded
     */
    function getHistoricalPrice(address token, uint256 index) external view returns (uint256 price, uint256 timestamp) {
        require(index < historyCount[token], "Index out of bounds");
        return (historicalPrices[token][index], historicalTimestamps[token][index]);
    }
    
    /**
     * @dev Get the number of historical price entries for a token
     * @param token Token address
     * @return count Number of historical entries
     */
    function getHistoryCount(address token) external view returns (uint256 count) {
        return historyCount[token];
    }
    
    /**
     * @dev Get the time-weighted average price (TWAP) for a token
     * @param token Token address
     * @param period Period in seconds to calculate TWAP
     * @return twap Time-weighted average price
     */
    function getTWAP(address token, uint256 period) external view returns (uint256 twap) {
        require(tokenPrices[token] > 0, "Price not set");
        require(historyCount[token] > 1, "Insufficient price history");
        
        // Mock TWAP calculation - in a real implementation this would calculate based on historical data
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
     * @dev Update oracle configuration
     * @param _updateFrequency New update frequency in seconds
     * @param _maxPriceDeviation New maximum price deviation (10000 = 100%)
     */
    function updateConfig(uint256 _updateFrequency, uint256 _maxPriceDeviation) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "updateConfig",
            abi.encode(_updateFrequency, _maxPriceDeviation)
        );
        
        updateFrequency = _updateFrequency;
        maxPriceDeviation = _maxPriceDeviation;
        
        emit ConfigUpdated(_updateFrequency, _maxPriceDeviation);
    }
    
    /**
     * @dev Toggle emergency mode
     * @param _enabled Whether emergency mode should be enabled
     */
    function setEmergencyMode(bool _enabled) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "setEmergencyMode",
            abi.encode(_enabled)
        );
        
        emergencyMode = _enabled;
        
        emit EmergencyModeChanged(_enabled);
    }
    
    /**
     * @dev Check if a token has a price
     * @param token Token address
     * @return exists Whether the token has a price
     */
    function priceExists(address token) external view returns (bool) {
        return tokenPrices[token] > 0;
    }
    
    /**
     * @dev Grant a role to an account
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function grantRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "grantRole",
            abi.encode(role, account)
        );
        
        require(hasRole(ORACLE_ADMIN_ROLE, msg.sender), "Not authorized");
        _roles[role][account] = true;
    }
    
    /**
     * @dev Revoke a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "revokeRole",
            abi.encode(role, account)
        );
        
        require(hasRole(ORACLE_ADMIN_ROLE, msg.sender), "Not authorized");
        _roles[role][account] = false;
    }
    
    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view override(AccessControl) returns (bool) {
        return _roles[role][account];
    }
    

    
    // Role management mapping
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    /**
     * @dev Get the current price of an asset
     * @param _asset The asset address
     * @return The current price of the asset (scaled by 1e18)
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getAssetPrice(address _asset) external view returns (uint256) {
        return tokenPrices[_asset];
    }
    
    /**
     * @dev Get the decimals of an asset
     * @param _asset The asset address
     * @return The number of decimals for the asset
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getAssetDecimals(address _asset) external view override returns (uint8) {
        // Default to 18 decimals for most tokens
        return 18;
    }
}