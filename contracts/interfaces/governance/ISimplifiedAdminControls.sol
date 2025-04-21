// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ISimplifiedAdminControls
 * @dev Interface for the SimplifiedAdminControls contract which consolidates admin functionality
 * @notice This interface defines the standard functions for administrative controls
 */
interface ISimplifiedAdminControls {
    // Events
    event ContractRegistered(string indexed name, address indexed contractAddress);
    event ContractApproved(address indexed contractAddress, address indexed approver);
    event OperationScheduled(bytes32 indexed operationId, address indexed target, uint256 timestamp);
    event OperationExecuted(bytes32 indexed operationId);
    event AdminParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    event RoleAssigned(bytes32 indexed role, address indexed account, address indexed grantor);

    /**
     * @dev Register a contract to be managed
     * @param name Name identifier for the contract
     * @param contractAddress Address of the contract
     */
    function registerContract(string memory name, address contractAddress) external;

    /**
     * @dev Approve a contract for operations
     * @param contractAddress Address of the contract to approve
     */
    function approveContract(address contractAddress) external;

    /**
     * @dev Schedule an operation to be executed after timelock
     * @param target Address of the contract to call
     * @param callData Encoded function call data
     * @return operationId ID of the scheduled operation
     */
    function scheduleOperation(address target, bytes memory callData) external returns (bytes32 operationId);

    /**
     * @dev Execute a scheduled operation
     * @param operationId ID of the operation to execute
     */
    function executeOperation(bytes32 operationId) external;

    /**
     * @dev Update the approval threshold
     * @param newThreshold New approval threshold value
     */
    function updateApprovalThreshold(uint256 newThreshold) external;

    /**
     * @dev Update the timelock period
     * @param newTimelock New timelock period in seconds
     */
    function updateTimelock(uint256 newTimelock) external;

    /**
     * @dev Assign a role to an account
     * @param role Role to assign
     * @param account Account to receive the role
     */
    function assignRole(bytes32 role, address account) external;

    /**
     * @dev Revoke a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) external;

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) external view returns (bool);

    /**
     * @dev Get a managed contract address by name
     * @param name Name of the contract
     * @return Address of the contract
     */
    function getContractAddress(string memory name) external view returns (address);

    /**
     * @dev Check if a contract is approved
     * @param contractAddress Address of the contract
     * @return bool Whether the contract is approved
     */
    function isContractApproved(address contractAddress) external view returns (bool);

    /**
     * @dev Get details of a pending operation
     * @param operationId ID of the operation
     * @return target Address of the target contract
     * @return callData Encoded function call data
     * @return timestamp Time when the operation was scheduled
     * @return executed Whether the operation has been executed
     */
    function getPendingOperation(bytes32 operationId) external view returns (
        address target,
        bytes memory callData,
        uint256 timestamp,
        bool executed
    );
}
