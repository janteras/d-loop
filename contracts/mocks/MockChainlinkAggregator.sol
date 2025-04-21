// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockChainlinkAggregator
 * @dev Mocks Chainlink's AggregatorV3Interface for testing Chainlink-based oracles.
 */
import "./base/BaseMock.sol";

contract MockChainlinkAggregator is BaseMock {
    int256 private _answer;
    uint8 private _decimals;
    uint256 private _timestamp;
    uint80 private _roundId;
    uint80 private _answeredInRound;
    uint256 public heartbeat;
    uint8 public reliabilityScore;

    event AnswerUpdated(int256 indexed current, uint256 indexed roundId, uint256 updatedAt);
    event HeartbeatUpdated(uint256 newHeartbeat);
    event ReliabilityScoreUpdated(uint8 newScore);
    event StalenessSimulated(uint256 simulatedTimestamp);
    event FallbackSimulated();

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _timestamp = block.timestamp;
        _roundId = 1;
        _answeredInRound = 1;
        heartbeat = 0;
        reliabilityScore = 100;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _timestamp, _timestamp, _answeredInRound);
    }

    function setAnswer(int256 newAnswer) external {
        _recordFunctionCall("setAnswer(int256)", abi.encode(newAnswer));
        _answer = newAnswer;
        _timestamp = block.timestamp;
        _roundId++;
        _answeredInRound = _roundId;
        emit AnswerUpdated(newAnswer, _roundId, _timestamp);
    }

    function setHeartbeat(uint256 newHeartbeat) external {
        heartbeat = newHeartbeat;
        emit HeartbeatUpdated(newHeartbeat);
    }

    function setReliabilityScore(uint8 newScore) external {
        reliabilityScore = newScore;
        emit ReliabilityScoreUpdated(newScore);
    }

    function simulateStaleness(uint256 simulatedTimestamp) external {
        _timestamp = simulatedTimestamp;
        emit StalenessSimulated(simulatedTimestamp);
    }

    function simulateFallback() external {
        emit FallbackSimulated();
    }

    function setTimestamp(uint256 newTimestamp) external {
        _recordFunctionCall("setTimestamp(uint256)", abi.encode(newTimestamp));
        _timestamp = newTimestamp;
    }

    function setDecimals(uint8 newDecimals) external {
        _recordFunctionCall("setDecimals(uint8)", abi.encode(newDecimals));
        _decimals = newDecimals;
    }
}
