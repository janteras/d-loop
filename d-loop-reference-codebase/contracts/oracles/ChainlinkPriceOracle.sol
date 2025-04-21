// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./IPriceOracle.sol";

/**
 * @title ChainlinkPriceOracle
 * @notice Oracle implementation that uses Chainlink price feeds
 * @dev Provides standardized access to Chainlink price data
 */
contract ChainlinkPriceOracle is IPriceOracle, AccessControl, Pausable {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant FEED_MANAGER_ROLE = keccak256("FEED_MANAGER_ROLE");
    
    struct FeedConfig {
        address chainlinkFeed;        // Chainlink price feed address
        uint256 heartbeatWindow;      // Maximum time (in seconds) since last update to consider data fresh
        bool active;                  // Whether the feed is active
        uint8 tokenDecimals;          // Decimals of the token
        uint8 reliabilityScore;       // Reliability score (0-100)
    }
    
    // Asset address => Feed configuration
    mapping(address => FeedConfig) public feedConfigs;
    
    // Chainlink-supported assets
    mapping(address => bool) public supportedAssets;
    
    // Maximum staleness tolerance (in seconds)
    uint256 public maxStalenessThreshold = 86400; // 24 hours
    
    // Events
    event FeedAdded(address indexed asset, address indexed chainlinkFeed, uint8 reliabilityScore);
    event FeedUpdated(address indexed asset, address indexed chainlinkFeed, uint8 reliabilityScore);
    event FeedRemoved(address indexed asset);
    event MaxStalenessChanged(uint256 oldThreshold, uint256 newThreshold);
    
    /**
     * @notice Constructor for the Chainlink price oracle
     * @param admin Address to grant admin role
     */
    constructor(address admin) {
        require(admin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
        _grantRole(FEED_MANAGER_ROLE, admin);
    }
    
    /**
     * @notice Adds a new price feed configuration
     * @param asset Address of the asset
     * @param chainlinkFeed Address of the Chainlink price feed
     * @param heartbeatWindow Maximum time since last update
     * @param tokenDecimals Decimals of the token
     * @param reliabilityScore Reliability score of the feed
     */
    function addFeed(
        address asset,
        address chainlinkFeed,
        uint256 heartbeatWindow,
        uint8 tokenDecimals,
        uint8 reliabilityScore
    ) 
        external 
        onlyRole(FEED_MANAGER_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(chainlinkFeed != address(0), "Invalid feed address");
        require(heartbeatWindow > 0, "Heartbeat must be positive");
        require(reliabilityScore <= 100, "Score must be 0-100");
        require(!supportedAssets[asset], "Feed already exists");
        
        // Verify the Chainlink feed is valid by querying it
        AggregatorV3Interface feed = AggregatorV3Interface(chainlinkFeed);
        feed.latestRoundData(); // Will revert if invalid
        
        feedConfigs[asset] = FeedConfig({
            chainlinkFeed: chainlinkFeed,
            heartbeatWindow: heartbeatWindow,
            active: true,
            tokenDecimals: tokenDecimals,
            reliabilityScore: reliabilityScore
        });
        
        supportedAssets[asset] = true;
        
        emit FeedAdded(asset, chainlinkFeed, reliabilityScore);
    }
    
    /**
     * @notice Updates an existing price feed configuration
     * @param asset Address of the asset
     * @param chainlinkFeed Address of the Chainlink price feed
     * @param heartbeatWindow Maximum time since last update
     * @param active Whether the feed is active
     * @param reliabilityScore Reliability score of the feed
     */
    function updateFeed(
        address asset,
        address chainlinkFeed,
        uint256 heartbeatWindow,
        bool active,
        uint8 reliabilityScore
    ) 
        external 
        onlyRole(FEED_MANAGER_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(chainlinkFeed != address(0), "Invalid feed address");
        require(heartbeatWindow > 0, "Heartbeat must be positive");
        require(reliabilityScore <= 100, "Score must be 0-100");
        require(supportedAssets[asset], "Feed does not exist");
        
        // Verify the Chainlink feed is valid by querying it
        AggregatorV3Interface feed = AggregatorV3Interface(chainlinkFeed);
        feed.latestRoundData(); // Will revert if invalid
        
        FeedConfig storage config = feedConfigs[asset];
        config.chainlinkFeed = chainlinkFeed;
        config.heartbeatWindow = heartbeatWindow;
        config.active = active;
        config.reliabilityScore = reliabilityScore;
        
        emit FeedUpdated(asset, chainlinkFeed, reliabilityScore);
    }
    
    /**
     * @notice Removes a price feed configuration
     * @param asset Address of the asset
     */
    function removeFeed(address asset) 
        external 
        onlyRole(FEED_MANAGER_ROLE) 
    {
        require(supportedAssets[asset], "Feed does not exist");
        
        delete feedConfigs[asset];
        supportedAssets[asset] = false;
        
        emit FeedRemoved(asset);
    }
    
    /**
     * @notice Sets the maximum staleness threshold
     * @param newThreshold New staleness threshold in seconds
     */
    function setMaxStalenessThreshold(uint256 newThreshold) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(newThreshold > 0, "Threshold must be positive");
        
        uint256 oldThreshold = maxStalenessThreshold;
        maxStalenessThreshold = newThreshold;
        
        emit MaxStalenessChanged(oldThreshold, newThreshold);
    }
    
    /**
     * @notice Pauses the oracle
     */
    function pause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the oracle
     */
    function unpause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets the price of an asset in USD
     * @param asset The address of the asset
     * @return price The price of the asset in USD with 8 decimals
     */
    function getAssetPriceUSD(address asset) 
        external 
        view 
        override 
        whenNotPaused 
        returns (uint256) 
    {
        require(supportedAssets[asset], "Asset not supported");
        require(feedConfigs[asset].active, "Feed not active");
        
        FeedConfig storage config = feedConfigs[asset];
        AggregatorV3Interface feed = AggregatorV3Interface(config.chainlinkFeed);
        
        (
            ,
            int256 price,
            ,
            uint256 updatedAt,
            
        ) = feed.latestRoundData();
        
        require(price > 0, "Negative or zero price");
        require(
            block.timestamp - updatedAt <= config.heartbeatWindow,
            "Data outdated"
        );
        
        // Chainlink typically returns prices with 8 decimals
        // We need to adjust the price based on the asset's decimals
        
        // Standard output is 8 decimals
        uint8 feedDecimals = feed.decimals();
        uint256 adjustedPrice;
        
        if (feedDecimals > 8) {
            adjustedPrice = uint256(price) / (10 ** (feedDecimals - 8));
        } else if (feedDecimals < 8) {
            adjustedPrice = uint256(price) * (10 ** (8 - feedDecimals));
        } else {
            adjustedPrice = uint256(price);
        }
        
        return adjustedPrice;
    }
    
    /**
     * @notice Gets the latest update timestamp for the price of an asset
     * @param asset The address of the asset
     * @return timestamp The timestamp of the last price update
     */
    function getLastUpdateTimestamp(address asset) 
        external 
        view 
        override 
        returns (uint256) 
    {
        require(supportedAssets[asset], "Asset not supported");
        
        FeedConfig storage config = feedConfigs[asset];
        AggregatorV3Interface feed = AggregatorV3Interface(config.chainlinkFeed);
        
        (
            ,
            ,
            ,
            uint256 updatedAt,
            
        ) = feed.latestRoundData();
        
        return updatedAt;
    }
    
    /**
     * @notice Gets the reliability score of the price data
     * @param asset The address of the asset
     * @return score The reliability score (0-100)
     */
    function getReliabilityScore(address asset) 
        external 
        view 
        override 
        returns (uint8) 
    {
        require(supportedAssets[asset], "Asset not supported");
        
        FeedConfig storage config = feedConfigs[asset];
        
        // Adjust reliability based on data freshness
        uint256 lastUpdateTime;
        
        try this.getLastUpdateTimestamp(asset) returns (uint256 timestamp) {
            lastUpdateTime = timestamp;
        } catch {
            return 0; // If the feed is broken, reliability is 0
        }
        
        uint256 timeSinceUpdate = block.timestamp - lastUpdateTime;
        
        // If the data is fresh, return the configured reliability
        if (timeSinceUpdate <= config.heartbeatWindow) {
            return config.reliabilityScore;
        }
        
        // If the data is stale but within max threshold, reduce reliability linearly
        if (timeSinceUpdate <= maxStalenessThreshold) {
            uint256 staleFactor = (maxStalenessThreshold - timeSinceUpdate) * 100 / 
                                  (maxStalenessThreshold - config.heartbeatWindow);
            
            return uint8((config.reliabilityScore * staleFactor) / 100);
        }
        
        // If the data is too stale, reliability is 0
        return 0;
    }
    
    /**
     * @notice Checks if the oracle supports an asset
     * @param asset The address of the asset
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) 
        external 
        view 
        override 
        returns (bool) 
    {
        return supportedAssets[asset] && feedConfigs[asset].active;
    }
    
    /**
     * @notice Gets detailed feed configuration
     * @param asset Address of the asset
     * @return chainlinkFeed Address of the Chainlink feed
     * @return heartbeatWindow Maximum time since last update
     * @return active Whether the feed is active
     * @return tokenDecimals Decimals of the token
     * @return reliabilityScore Reliability score of the feed
     */
    function getFeedConfig(address asset) 
        external 
        view 
        returns (
            address chainlinkFeed,
            uint256 heartbeatWindow,
            bool active,
            uint8 tokenDecimals,
            uint8 reliabilityScore
        ) 
    {
        require(supportedAssets[asset], "Asset not supported");
        
        FeedConfig storage config = feedConfigs[asset];
        
        return (
            config.chainlinkFeed,
            config.heartbeatWindow,
            config.active,
            config.tokenDecimals,
            config.reliabilityScore
        );
    }
}