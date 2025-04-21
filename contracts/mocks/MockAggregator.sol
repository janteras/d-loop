// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockAggregator is AggregatorV3Interface {
    uint8 public decimals;
    int256 private price;
    uint256 private updatedAt;
    string public description;
    uint256 private versionNumber;

    constructor() {
        decimals = 8;
        price = 100 * 10**8; // $100
        updatedAt = block.timestamp;
        description = "Mock Chainlink Aggregator";
        versionNumber = 2;
    }

    error InvalidPrice();
    error InvalidTimestamp();
    error NotImplemented();

    function setPrice(int256 _price) external {
        if (_price <= 0) revert InvalidPrice();
        price = _price;
        updatedAt = block.timestamp;
        emit PriceUpdated(_price, block.timestamp);
    }

    function setUpdatedAt(uint256 timestamp) external {
        if (timestamp > block.timestamp) revert InvalidTimestamp();
        updatedAt = timestamp;
        emit TimestampUpdated(timestamp);
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (0, price, 0, updatedAt, 0);
    }

    function getRoundData(uint80 /*_roundId*/) external pure returns (
        uint80 /*roundId*/,
        int256 /*answer*/,
        uint256 /*startedAt*/,
        uint256 /*updatedAt*/,
        uint80 /*answeredInRound*/
    ) {
        revert NotImplemented();
    }

    /**
     * @notice Returns the mock version number
     * @dev Increment this when making breaking changes to the mock
     */
    function version() external view returns (uint256) {
      return versionNumber;
    }

    function updateVersion(uint256 newVersion) external {
        versionNumber = newVersion;
        emit VersionUpdated(newVersion);
    }

    event PriceUpdated(int256 indexed price, uint256 timestamp);
    event TimestampUpdated(uint256 timestamp);
    event VersionUpdated(uint256 newVersion);
}
