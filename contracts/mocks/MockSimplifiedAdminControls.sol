// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../interfaces/governance/ISimplifiedAdminControls.sol";

/**
 * @title MockSimplifiedAdminControls
 * @dev Mock implementation of the SimplifiedAdminControls contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockSimplifiedAdminControls is BaseMock, ISimplifiedAdminControls {
    // Role constants
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Role management mapping
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    // Addresses of controlled contracts
    mapping(string => address) public managedContracts;
    
    // Contract status
    mapping(address => bool) public approvedContracts;
    
    // Admin parameters
    uint256 public approvalThreshold;  // Number of required approvals (testnet = 1)
    uint256 public timelock;           // Time delay for sensitive operations (can be 0 for testnet)
    
    // Pending operations for timelock
    struct PendingOperation {
        bytes32 operationId;
        address target;
        bytes callData;
        uint256 timestamp;
        bool executed;
    }
    
    // Pending operations storage
    mapping(bytes32 => PendingOperation) public pendingOperations;
    bytes32[] public pendingOperationIds;

    /**
     * @dev Constructor
     */
    constructor() BaseMock() {
        _grantRole(DEPLOYER_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        approvalThreshold = 1;
        timelock = 0;
    }

    /**
     * @dev Register a contract to be managed
     * @param name Name identifier for the contract
     * @param contractAddress Address of the contract
     */
    function registerContract(string memory name, address contractAddress) external {
        _recordFunctionCall(
            "registerContract",
            abi.encode(name, contractAddress)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(contractAddress != address(0), "Zero address not allowed");
        
        managedContracts[name] = contractAddress;
        
        emit ContractRegistered(name, contractAddress);
    }

    /**
     * @dev Approve a contract for operations
     * @param contractAddress Address of the contract to approve
     */
    function approveContract(address contractAddress) external {
        _recordFunctionCall(
            "approveContract",
            abi.encode(contractAddress)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(contractAddress != address(0), "Zero address not allowed");
        
        approvedContracts[contractAddress] = true;
        
        emit ContractApproved(contractAddress, msg.sender);
    }

    /**
     * @dev Schedule an operation to be executed after timelock
     * @param target Address of the contract to call
     * @param callData Encoded function call data
     * @return operationId ID of the scheduled operation
     */
    function scheduleOperation(address target, bytes memory callData) external returns (bytes32 operationId) {
        _recordFunctionCall(
            "scheduleOperation",
            abi.encode(target, callData)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(target != address(0), "Zero address not allowed");
        require(approvedContracts[target], "Contract not approved");
        
        operationId = keccak256(abi.encodePacked(target, callData, block.timestamp));
        
        PendingOperation storage operation = pendingOperations[operationId];
        operation.operationId = operationId;
        operation.target = target;
        operation.callData = callData;
        operation.timestamp = block.timestamp;
        operation.executed = false;
        
        pendingOperationIds.push(operationId);
        
        emit OperationScheduled(operationId, target, block.timestamp);
        
        return operationId;
    }

    /**
     * @dev Execute a scheduled operation
     * @param operationId ID of the operation to execute
     */
    function executeOperation(bytes32 operationId) external {
        _recordFunctionCall(
            "executeOperation",
            abi.encode(operationId)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        PendingOperation storage operation = pendingOperations[operationId];
        
        require(operation.operationId == operationId, "Operation not found");
        require(!operation.executed, "Already executed");
        require(block.timestamp >= operation.timestamp + timelock, "Timelock not expired");
        
        operation.executed = true;
        
        // Mock execution - in a real contract, this would execute the operation
        
        emit OperationExecuted(operationId);
    }

    /**
     * @dev Update the approval threshold
     * @param newThreshold New approval threshold value
     */
    function updateApprovalThreshold(uint256 newThreshold) external {
        _recordFunctionCall(
            "updateApprovalThreshold",
            abi.encode(newThreshold)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(newThreshold > 0, "Threshold must be greater than zero");
        
        uint256 oldThreshold = approvalThreshold;
        approvalThreshold = newThreshold;
        
        emit AdminParameterUpdated("approvalThreshold", oldThreshold, newThreshold);
    }

    /**
     * @dev Update the timelock period
     * @param newTimelock New timelock period in seconds
     */
    function updateTimelock(uint256 newTimelock) external {
        _recordFunctionCall(
            "updateTimelock",
            abi.encode(newTimelock)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        uint256 oldTimelock = timelock;
        timelock = newTimelock;
        
        emit AdminParameterUpdated("timelock", oldTimelock, newTimelock);
    }

    /**
     * @dev Assign a role to an account
     * @param role Role to assign
     * @param account Account to receive the role
     */
    function assignRole(bytes32 role, address account) external {
        _recordFunctionCall(
            "assignRole",
            abi.encode(role, account)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(account != address(0), "Zero address not allowed");
        
        _grantRole(role, account);
        
        emit RoleAssigned(role, account, msg.sender);
    }

    /**
     * @dev Revoke a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override(AccessControl, ISimplifiedAdminControls) {
        _recordFunctionCall(
            "revokeRole",
            abi.encode(role, account)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(account != address(0), "Zero address not allowed");
        
        _roles[role][account] = false;
        
        emit RoleAssigned(role, account, msg.sender);
    }

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    /**
     * @dev Internal function to check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function _hasRole(bytes32 role, address account) internal view returns (bool) {
        return _roles[role][account];
    }
    
    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function hasRole(bytes32 role, address account) public view override(AccessControl, ISimplifiedAdminControls) returns (bool) {
        return _hasRole(role, account);
    }

    /**
     * @dev Get a managed contract address by name
     * @param name Name of the contract
     * @return Address of the contract
     */
    /**
     * @dev Get a managed contract address by name
     * @param name Name of the contract
     * @return Address of the contract
     */
    function getContractAddress(string memory name) external view override returns (address) {
        return managedContracts[name];
    }

    /**
     * @dev Check if a contract is approved
     * @param contractAddress Address of the contract
     * @return bool Whether the contract is approved
     */
    function isContractApproved(address contractAddress) external view returns (bool) {
        return approvedContracts[contractAddress];
    }

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
    ) {
        PendingOperation storage operation = pendingOperations[operationId];
        
        require(operation.operationId == operationId, "Operation not found");
        
        return (
            operation.target,
            operation.callData,
            operation.timestamp,
            operation.executed
        );
    }

    /**
     * @dev Grant a role to an account
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        _roles[role][account] = true;
        return true;
    }

    // Test helper functions

    /**
     * @dev Get all pending operation IDs (test helper)
     * @return Array of operation IDs
     */
    function getAllPendingOperationIds() external view returns (bytes32[] memory) {
        return pendingOperationIds;
    }

    /**
     * @dev Force execute an operation (test helper)
     * @param operationId ID of the operation
     */
    function forceExecuteOperation(bytes32 operationId) external {
        _recordFunctionCall(
            "forceExecuteOperation",
            abi.encode(operationId)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        PendingOperation storage operation = pendingOperations[operationId];
        
        require(operation.operationId == operationId, "Operation not found");
        require(!operation.executed, "Already executed");
        
        operation.executed = true;
        
        emit OperationExecuted(operationId);
    }
}
