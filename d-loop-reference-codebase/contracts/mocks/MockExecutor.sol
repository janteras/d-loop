// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../protocol/IExecutor.sol";

/**
 * @title MockExecutor
 * @notice Mock implementation of IExecutor for testing
 * @dev Simplified version that just records execution
 */
contract MockExecutor is IExecutor {
    // State
    bool public executed;
    uint256 public executionCount;
    
    // Events
    event Executed(uint256 count);
    
    /**
     * @notice Constructor
     */
    constructor() {
        executed = false;
        executionCount = 0;
    }
    
    /**
     * @notice Execute the operation
     * @dev Implements IExecutor interface
     */
    function execute() external override {
        executed = true;
        executionCount += 1;
        
        emit Executed(executionCount);
    }
    
    /**
     * @notice Get description of the operation
     * @dev Implements IExecutor interface
     * @return Description string
     */
    function getDescription() external pure override returns (string memory) {
        return "Mock Executor for testing";
    }
}