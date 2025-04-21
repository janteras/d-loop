// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import { IPriceOracle } from "../interfaces/oracle/IPriceOracle.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ChainlinkPriceOracle
 * @dev Price oracle that reads prices from Chainlink feeds, with staleness and fallback logic.
 */
contract ChainlinkPriceOracle is IPriceOracle, AccessControl {
    // Custom errors
    error InvalidAggregator();
    error ReliabilityOutOfRange();
    error FallbackPriceStale();
    error InvalidPriceOrUpdate();
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FEED_MANAGER_ROLE = keccak256("FEED_MANAGER_ROLE");
    struct FeedInfo {
        AggregatorV3Interface aggregator;
        uint256 maxStaleness; // max time in seconds before data is considered stale
        uint256 heartbeat; // expected heartbeat interval in seconds
        uint8 reliabilityScore; // 0-100 reliability score
        bool exists;
    }

    mapping(address => FeedInfo) public feeds; // token => feed info
    uint8 public defaultDecimals = 8;
    mapping(address => uint256) public fallbackPrices;
    mapping(address => uint8) public fallbackDecimals;
    mapping(address => uint256) public fallbackLastUpdated;
    uint256 public fallbackStaleness = 1 days;

    // Events
    event FeedSet(address indexed token, address indexed aggregator, uint256 maxStaleness, uint256 heartbeat, uint8 reliabilityScore);
    event FallbackPriceSet(address indexed token, uint256 price, uint8 decimals);
    event PriceStale(address indexed token, uint256 updatedAt, uint256 maxStaleness);
    event FallbackUsed(address indexed token, uint256 price, uint8 decimals);
    event FeedRemoved(address indexed token);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(FEED_MANAGER_ROLE, admin);
    }

    // External functions first
    function setFeed(address token, address aggregator, uint256 maxStaleness, uint256 heartbeat, uint8 reliabilityScore) external onlyRole(FEED_MANAGER_ROLE) {
        if (aggregator == address(0)) revert InvalidAggregator();
        if (reliabilityScore > 100) revert ReliabilityOutOfRange();
        feeds[token] = FeedInfo({
            aggregator: AggregatorV3Interface(aggregator),
            maxStaleness: maxStaleness,
            heartbeat: heartbeat,
            reliabilityScore: reliabilityScore,
            exists: true
        });
        emit FeedSet(token, aggregator, maxStaleness, heartbeat, reliabilityScore);
    }

    function removeFeed(address token) external onlyRole(FEED_MANAGER_ROLE) {
        delete feeds[token];
        emit FeedRemoved(token);
    }

    function setFallbackPrice(address token, uint256 price, uint8 decimals) external onlyRole(ADMIN_ROLE) {
        fallbackPrices[token] = price;
        fallbackDecimals[token] = decimals;
        fallbackLastUpdated[token] = block.timestamp;
        emit FallbackPriceSet(token, price, decimals);
    }

    function setFallbackStaleness(uint256 newStaleness) external onlyRole(ADMIN_ROLE) {
        fallbackStaleness = newStaleness;
    }

    // Public view functions next
    function getAssetPrice(address token) external view override returns (uint256) {
        FeedInfo memory info = feeds[token];
        if (info.exists && address(info.aggregator) != address(0)) {
            return _getAggregatorPrice(info);
        }
        return _getFallbackPrice(token);
    }

    function getAssetDecimals(address token) external view override returns (uint8) {
        FeedInfo memory info = feeds[token];
        if (info.exists) {
            return 18; // Always normalize output to 18 decimals
        }
        return 18;
    }

    function supportsAsset(address token) external view returns (bool) {
        return feeds[token].exists || fallbackPrices[token] != 0;
    }

    // Internal functions last
    function _getAggregatorPrice(FeedInfo memory info) private view returns (uint256) {
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
            
        ) = info.aggregator.latestRoundData();
        if (answer <= 0 || updatedAt == 0) {
            revert InvalidPriceOrUpdate();
        }
        if (block.timestamp - updatedAt > info.maxStaleness) {
            // Price is stale, fallback will be used
            revert FallbackPriceStale();
        }
        uint8 feedDecimals = info.aggregator.decimals();
        return _normalize(uint256(answer), feedDecimals);
    }

    function _getFallbackPrice(address token) private view returns (uint256) {
        if (block.timestamp - fallbackLastUpdated[token] > fallbackStaleness) {
            revert FallbackPriceStale();
        }
        uint8 decimalsToUse = fallbackDecimals[token] == 0 ? defaultDecimals : fallbackDecimals[token];
        return _normalize(fallbackPrices[token], decimalsToUse);
    }

    function _normalize(uint256 value, uint8 decimals) internal pure returns (uint256) {
        if (decimals == 18) return value;
        if (decimals > 18) return value / (10 ** (decimals - 18));
        return value * (10 ** (18 - decimals));
    }
}
