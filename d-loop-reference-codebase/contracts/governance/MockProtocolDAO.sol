// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title MockProtocolDAO
 * @notice Mock implementation of ProtocolDAO for testing executors
 * @dev Simplified version that only implements the functions needed for testing
 */
contract MockProtocolDAO {
    /**
     * @notice Calls an executor contract
     * @param _executor Address of the executor
     * @param _calldata Calldata to send to the executor
     * @return success Success status
     * @return result Return data
     */
    function callExecutor(address _executor, bytes memory _calldata) 
        external 
        returns (bool success, bytes memory result) 
    {
        (success, result) = _executor.call(_calldata);
        require(success, "Call to executor failed");
        return (success, result);
    }
}