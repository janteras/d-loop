// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PriceOracle
 * @notice Manages price feeds for various tokens in the DLOOP ecosystem
 */
contract PriceOracle is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PRICE_FEEDER_ROLE = keccak256("PRICE_FEEDER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Price data structure
    struct PriceData {
        uint256 price;      // Price in USD with 8 decimals (e.g., 100000000 = $1.00)
        uint256 timestamp;  // Timestamp when the price was last updated
        bool active;        // Whether the price feed is active
    }
    
    // Mapping from token address to price data
    mapping(address => PriceData) private _priceFeeds;
    
    // Array of all tracked token addresses
    address[] private _trackedTokens;
    
    // Price update thresholds
    uint256 public maxPriceDeviationPercent; // Maximum allowed price deviation in percent (e.g., 10 = 10%)
    uint256 public stalePriceThreshold;      // Time period after which prices are considered stale (in seconds)
    
    // Events
    event PriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice);
    event PriceFeedAdded(address indexed token, uint256 initialPrice);
    event PriceFeedDeactivated(address indexed token);
    event PriceFeedReactivated(address indexed token);
    event ThresholdUpdated(string name, uint256 oldValue, uint256 newValue);
    
    /**
     * @notice Initializes the contract with default thresholds
     */
    function initialize() public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_FEEDER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        // Default thresholds
        maxPriceDeviationPercent = 10; // 10%
        stalePriceThreshold = 1 hours;
    }
    
    /**
     * @notice Adds a new price feed
     * @param token Address of the token
     * @param initialPrice Initial price in USD with 8 decimals
     */
    function addPriceFeed(address token, uint256 initialPrice) external onlyRole(ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        require(initialPrice > 0, "Price must be greater than 0");
        require(!_priceFeeds[token].active, "Price feed already exists and is active");
        
        if (_priceFeeds[token].timestamp == 0) {
            // New token
            _trackedTokens.push(token);
        }
        
        _priceFeeds[token] = PriceData({
            price: initialPrice,
            timestamp: block.timestamp,
            active: true
        });
        
        emit PriceFeedAdded(token, initialPrice);
    }
    
    /**
     * @notice Updates the price of a token
     * @param token Address of the token
     * @param newPrice New price in USD with 8 decimals
     */
    function updatePrice(address token, uint256 newPrice) external onlyRole(PRICE_FEEDER_ROLE) {
        require(newPrice > 0, "Price must be greater than 0");
        require(_priceFeeds[token].active, "Price feed not active");
        
        uint256 oldPrice = _priceFeeds[token].price;
        
        // Check for excessive price deviation
        if (oldPrice > 0) {
            uint256 deviation;
            if (newPrice > oldPrice) {
                deviation = ((newPrice - oldPrice) * 100) / oldPrice;
            } else {
                deviation = ((oldPrice - newPrice) * 100) / oldPrice;
            }
            
            require(
                deviation <= maxPriceDeviationPercent,
                "Price deviation exceeds maximum allowed"
            );
        }
        
        // Update the price data
        _priceFeeds[token].price = newPrice;
        _priceFeeds[token].timestamp = block.timestamp;
        
        emit PriceUpdated(token, oldPrice, newPrice);
    }
    
    /**
     * @notice Deactivates a price feed
     * @param token Address of the token
     */
    function deactivatePriceFeed(address token) external onlyRole(ADMIN_ROLE) {
        require(_priceFeeds[token].active, "Price feed already inactive");
        
        _priceFeeds[token].active = false;
        
        emit PriceFeedDeactivated(token);
    }
    
    /**
     * @notice Reactivates a price feed
     * @param token Address of the token
     * @param initialPrice New initial price in USD with 8 decimals
     */
    function reactivatePriceFeed(
        address token, 
        uint256 initialPrice
    ) external onlyRole(ADMIN_ROLE) {
        require(!_priceFeeds[token].active, "Price feed already active");
        require(initialPrice > 0, "Price must be greater than 0");
        
        _priceFeeds[token].price = initialPrice;
        _priceFeeds[token].timestamp = block.timestamp;
        _priceFeeds[token].active = true;
        
        emit PriceFeedReactivated(token);
        emit PriceUpdated(token, 0, initialPrice);
    }
    
    /**
     * @notice Sets the maximum allowed price deviation percentage
     * @param newDeviation New maximum deviation percentage
     */
    function setMaxPriceDeviationPercent(uint256 newDeviation) external onlyRole(ADMIN_ROLE) {
        require(newDeviation > 0, "Deviation must be greater than 0");
        
        uint256 oldDeviation = maxPriceDeviationPercent;
        maxPriceDeviationPercent = newDeviation;
        
        emit ThresholdUpdated("MaxPriceDeviation", oldDeviation, newDeviation);
    }
    
    /**
     * @notice Sets the stale price threshold
     * @param newThreshold New stale price threshold in seconds
     */
    function setStalePriceThreshold(uint256 newThreshold) external onlyRole(ADMIN_ROLE) {
        require(newThreshold > 0, "Threshold must be greater than 0");
        
        uint256 oldThreshold = stalePriceThreshold;
        stalePriceThreshold = newThreshold;
        
        emit ThresholdUpdated("StalePriceThreshold", oldThreshold, newThreshold);
    }
    
    /**
     * @notice Gets the price of a token
     * @param token Address of the token
     * @return price Price in USD with 8 decimals
     */
    function getPrice(address token) external view returns (uint256) {
        require(_priceFeeds[token].active, "Price feed not active");
        require(
            block.timestamp <= _priceFeeds[token].timestamp + stalePriceThreshold,
            "Price is stale"
        );
        
        return _priceFeeds[token].price;
    }
    
    /**
     * @notice Gets detailed price data for a token
     * @param token Address of the token
     * @return price Price in USD with 8 decimals
     * @return timestamp Timestamp when the price was last updated
     * @return active Whether the price feed is active
     * @return isStale Whether the price is considered stale
     */
    function getPriceData(address token) external view returns (
        uint256 price,
        uint256 timestamp,
        bool active,
        bool isStale
    ) {
        PriceData memory data = _priceFeeds[token];
        return (
            data.price,
            data.timestamp,
            data.active,
            block.timestamp > data.timestamp + stalePriceThreshold
        );
    }
    
    /**
     * @notice Gets all tracked token addresses
     * @return Array of tracked token addresses
     */
    function getAllTrackedTokens() external view returns (address[] memory) {
        return _trackedTokens;
    }
    
    /**
     * @notice Gets all active token addresses
     * @return Array of active token addresses
     */
    function getActiveTokens() external view returns (address[] memory) {
        uint256 count = 0;
        
        // Count active tokens
        for (uint256 i = 0; i < _trackedTokens.length; i++) {
            if (_priceFeeds[_trackedTokens[i]].active) {
                count++;
            }
        }
        
        // Create and populate the result array
        address[] memory activeTokens = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _trackedTokens.length; i++) {
            if (_priceFeeds[_trackedTokens[i]].active) {
                activeTokens[index] = _trackedTokens[i];
                index++;
            }
        }
        
        return activeTokens;
    }
    
    /**
     * @dev Required override for UUPSUpgradeable - restrict upgrades to UPGRADER_ROLE
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}