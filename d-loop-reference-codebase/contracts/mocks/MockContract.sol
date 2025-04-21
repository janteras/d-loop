// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title MockContract
 * @notice A simple mock contract for testing
 * @dev Used when we need a contract instance but don't need any specific functionality
 */
contract MockContract {
    // State for tracking calls
    uint256 public callCount;
    
    // Event emitted when a function is called
    event FunctionCalled(string name, address caller);
    
    // Fallback function to track calls
    fallback() external {
        callCount++;
        emit FunctionCalled("fallback", msg.sender);
    }
    
    // Receive function to accept ETH
    receive() external payable {
        callCount++;
        emit FunctionCalled("receive", msg.sender);
    }
    
    // Reset the call counter
    function reset() external {
        callCount = 0;
    }
}