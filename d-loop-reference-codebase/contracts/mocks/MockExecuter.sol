// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockExecuter
 * @dev Mock contract for testing proposal execution
 */
contract MockExecuter {
    bool public executed = false;
    
    /**
     * @dev Execute the proposal
     */
    function execute() external {
        executed = true;
    }
    
    /**
     * @dev Check if the proposal was executed
     * @return Whether the proposal was executed
     */
    function wasExecuted() external view returns (bool) {
        return executed;
    }
}