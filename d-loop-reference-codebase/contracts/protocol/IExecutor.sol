// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IExecutor
 * @notice Interface for proposal executors
 * @dev Used by the Protocol DAO to execute proposals
 */
interface IExecutor {
    /**
     * @notice Execute the proposal
     * @return success Whether the execution was successful
     * @return message Success or error message
     */
    function execute() external returns (bool success, string memory message);
}