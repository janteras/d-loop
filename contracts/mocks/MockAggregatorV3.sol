// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";

/**
 * @title MockAggregatorV3
 * @dev Mock implementation of Chainlink's AggregatorV3Interface for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockAggregatorV3 is BaseMock {
    uint8 public decimals;
    string public description;
    uint256 public version = 1;
    uint80 private roundId = 1;
    int256 private price;
    uint256 private timestamp;
    uint256 private s_updatedAt;
    uint256 private s_version;

    // Events
    event PriceUpdated(int256 price, uint256 timestamp, uint80 roundId);
    event TimestampUpdated(uint256 timestamp);

    /**
     * @dev Constructor
     * @param _decimals Number of decimals
     * @param _description Description of the price feed
     * @param _initialPrice Initial price value
     */
    constructor(
        uint8 _decimals,
        string memory _description,
        int256 _initialPrice
    ) BaseMock() {
        decimals = _decimals;
        description = _description;
        price = _initialPrice;
        timestamp = block.timestamp;
    }

    /**
     * @dev Get data for a specific round
     * @param _roundId Round ID to get data for
     * @return roundId_ Round ID
     * @return answer Price
     * @return startedAt Timestamp when the round started
     * @return updatedAt Timestamp when the round was updated
     * @return answeredInRound Round ID in which the answer was computed
     */
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, price, timestamp, timestamp, _roundId);
    }

    /**
     * @dev Get data for the latest round
     * @return roundId_ Round ID
     * @return answer Price
     * @return startedAt Timestamp when the round started
     * @return updatedAt Timestamp when the round was updated
     * @return answeredInRound Round ID in which the answer was computed
     */
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (roundId, price, timestamp, timestamp, roundId);
    }

    /**
     * @dev Set the price
     * @param _price New price value
     */
    function setPrice(int256 _price) external {
        _recordFunctionCall(
            "setPrice",
            abi.encode(_price)
        );
        
        price = _price;
        timestamp = block.timestamp;
        roundId++;
        
        emit PriceUpdated(price, timestamp, roundId);
    }

    /**
     * @dev Set the timestamp
     * @param _timestamp New timestamp value
     */
    function setTimestamp(uint256 _timestamp) external {
        _recordFunctionCall(
            "setTimestamp",
            abi.encode(_timestamp)
        );
        
        timestamp = _timestamp;
        
        emit TimestampUpdated(timestamp);
    }

    /**
     * @dev Set the updatedAt timestamp
     * @param timestamp New updatedAt timestamp value
     */
    function setUpdatedAt(uint256 timestamp) external {
        _recordFunctionCall(
            "setUpdatedAt",
            abi.encode(timestamp)
        );
        
        s_updatedAt = timestamp;
    }

    /**
     * @dev Update the version
     * @param newVersion New version value
     */
    function updateVersion(uint256 newVersion) external {
        _recordFunctionCall(
            "updateVersion",
            abi.encode(newVersion)
        );
        
        s_version = newVersion;
    }
}
