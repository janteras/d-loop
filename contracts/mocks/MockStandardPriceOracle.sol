// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";

/**
 * @title MockStandardPriceOracle
 * @dev Standardized mock implementation of a price oracle for testing
 * @notice This contract follows the D-Loop mock standards as outlined in /docs/MOCK_STANDARDS.md and /docs/MOCK_CONTRACTS.md
 */
contract MockStandardPriceOracle is BaseMock {
    // Mapping from token address to price (18 decimals)
    mapping(address => uint256) private _prices;
    mapping(address => uint8) private _decimals;
    mapping(address => uint256) private _lastUpdate;


    // Events
    event PriceUpdated(address indexed token, uint256 price, uint8 decimals);

    // --- Mocked Oracle Functions ---

    function updatePrice(address token, uint256 price) external {
        _recordFunctionCall("updatePrice", abi.encode(token, price));
        _prices[token] = price;
        _decimals[token] = 18;
        _lastUpdate[token] = block.timestamp;
        emit PriceUpdated(token, price, 18);
    }

    // NOTE: This function is view and does not modify state. Do not add _recordFunctionCall here.
    function getPrice(address token) external view returns (uint256 price, uint8 decimals, uint256 lastUpdate) {
        price = _prices[token];
        decimals = _decimals[token];
        lastUpdate = _lastUpdate[token];
    }

    function setDecimals(address token, uint8 decimals_) external {
        _recordFunctionCall("setDecimals", abi.encode(token, decimals_));
        _decimals[token] = decimals_;
    }

    // --- Mock State Management ---

    function resetPrice(address token) external {
        _recordFunctionCall("resetPrice", abi.encode(token));
        _prices[token] = 0;
        _lastUpdate[token] = 0;
    }

    // --- Mock Helper Functions for Test Validation ---

    // For function call history, use getFunctionCallHistory from BaseMock
    // For function call history, use getFunctionCallHistory from BaseMock
    // function getFunctionCallHistory(string memory functionName) external view returns (uint256 count, address lastCaller_, bytes memory lastData);
    // function getFunctionCallCount(string memory functionName) external view returns (uint256);
    // function wasFunctionCalled(string memory functionName) external view returns (bool);
    // These are available via the BaseMock interface.
    // These are available via the BaseMock interface.
    
}
