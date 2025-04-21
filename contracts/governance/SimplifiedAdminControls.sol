// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ZeroAddress, EmptyName, NameAlreadyRegistered, AlreadyApproved, OperationNotFound, AlreadyExecuted, TimelockNotExpired, OperationFailed, InvalidAmount } from "../utils/Errors.sol";


/**
 * @title SimplifiedAdminControls
 * @dev Testnet implementation of simplified administrative controls
 * @notice This contract consolidates admin functionality for Sepolia testnet deployment
 */
contract SimplifiedAdminControls is AccessControl {
    // ========== State Variables ========== //
    // Role constants
    bytes32 public constant DEPLOYER_ROLE = keccak256("DEPLOYER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

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

    
    // ========== Events ========== //
    event ContractRegistered(string indexed name, address indexed contractAddress);
    event ContractApproved(address indexed contractAddress, address indexed approver);
    event OperationScheduled(bytes32 indexed operationId, address indexed target, uint256 timestamp);
    event OperationExecuted(bytes32 indexed operationId);
    event AdminParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    event RoleAssigned(bytes32 indexed role, address indexed account, address indexed grantor);
    
    // ========== Constructor ========== //
    /**
     * @dev Constructor initializes the contract with default admin
     * @param _deployer Address of the deployer
     * @param _approvalThreshold Number of approvals required (testnet = 1)
     * @param _timelock Timelock period in seconds (can be 0 for testnet)
     */
    constructor(
        address _deployer,
        uint256 _approvalThreshold,
        uint256 _timelock
    ) {
        if (_deployer == address(0)) revert ZeroAddress();
        
        // Set up default roles
        _grantRole(DEFAULT_ADMIN_ROLE, _deployer);
        _grantRole(DEPLOYER_ROLE, _deployer);
        _grantRole(ADMIN_ROLE, _deployer);
        _grantRole(GOVERNANCE_ROLE, _deployer);
        
        // Set admin parameters
        approvalThreshold = _approvalThreshold;
        timelock = _timelock;
    }
    
    // ========== External Functions ========== //

    /**
     * @dev Register a contract for management
     * @param name Identifier for the contract
     * @param contractAddress Address of the contract
     */
    function registerContract(
        string memory name,
        address contractAddress
    ) external onlyRole(ADMIN_ROLE) {
        if (bytes(name).length == 0) revert EmptyName();
        if (contractAddress == address(0)) revert ZeroAddress();
        if (managedContracts[name] != address(0)) revert NameAlreadyRegistered();
        
        managedContracts[name] = contractAddress;
        
        emit ContractRegistered(name, contractAddress);
    }
    
    /**
     * @dev Approve a contract for integration
     * @param contractAddress Address of the contract to approve
     */
    function approveContract(
        address contractAddress
    ) external onlyRole(ADMIN_ROLE) {
        if (contractAddress == address(0)) revert ZeroAddress();
        if (approvedContracts[contractAddress]) revert AlreadyApproved();
        
        approvedContracts[contractAddress] = true;
        
        emit ContractApproved(contractAddress, msg.sender);
    }
    
    /**
     * @dev Schedule an operation with timelock
     * @param target Target contract address
     * @param callData Function call data
     * @return operationId ID of the scheduled operation
     */
    function scheduleOperation(
        address target,
        bytes memory callData
    ) external onlyRole(ADMIN_ROLE) returns (bytes32) {
        if (target == address(0)) revert ZeroAddress();
        
        bytes32 operationId = keccak256(abi.encode(target, callData, block.timestamp));
        
        pendingOperations[operationId] = PendingOperation({
            operationId: operationId,
            target: target,
            callData: callData,
            timestamp: block.timestamp,
            executed: false
        });
        
        pendingOperationIds.push(operationId);
        
        emit OperationScheduled(operationId, target, block.timestamp);
        
        return operationId;
    }
    
    /**
     * @dev Execute a pending operation after timelock
     * @param operationId ID of the operation to execute
     */
    function executeOperation(
        bytes32 operationId
    ) external onlyRole(ADMIN_ROLE) {
        PendingOperation storage operation = pendingOperations[operationId];
        
        if (operation.operationId != operationId) revert OperationNotFound();
        if (operation.executed) revert AlreadyExecuted();
        if (block.timestamp < operation.timestamp + timelock) revert TimelockNotExpired();
        
        // Mark as executed
        operation.executed = true;
        
        // Execute the call
        (bool success,) = operation.target.call(operation.callData);
        if (!success) revert OperationFailed();
        
        emit OperationExecuted(operationId);
    }
    
    /**
     * @dev Update the approval threshold
     * @param _approvalThreshold New approval threshold
     */
    function updateApprovalThreshold(
        uint256 _approvalThreshold
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (_approvalThreshold == 0) revert InvalidAmount();
        
        uint256 oldThreshold = approvalThreshold;
        approvalThreshold = _approvalThreshold;
        
        emit AdminParameterUpdated("ApprovalThreshold", oldThreshold, _approvalThreshold);
    }
    
    /**
     * @dev Update the timelock period
     * @param _timelock New timelock period in seconds
     */
    function updateTimelock(
        uint256 _timelock
    ) external onlyRole(GOVERNANCE_ROLE) {
        uint256 oldTimelock = timelock;
        timelock = _timelock;
        
        emit AdminParameterUpdated("Timelock", oldTimelock, _timelock);
    }
    
    /**
     * @dev Assign a role to an account (admin only)
     * @param role Role to assign
     * @param account Account to receive the role
     */
    function assignRole(
        bytes32 role,
        address account
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        
        grantRole(role, account);
        
        emit RoleAssigned(role, account, msg.sender);
    }
    
    /**
     * @dev Check if an account has a specific role
     * @param role Role to check
     * @param account Account to check
     * @return True if account has the role
     */
    function hasAdminRole(
        bytes32 role,
        address account
    ) external view returns (bool) {
        return hasRole(role, account);
    }
    
    /**
     * @dev Get all pending operation IDs
     * @return Array of pending operation IDs
     */
    function getPendingOperationIds() external view returns (bytes32[] memory) {
        return pendingOperationIds;
    }
    
    /**
     * @dev Get contract address by name
     * @param name Name of the contract
     * @return Contract address
     */
    function getContractAddress(
        string memory name
    ) external view returns (address) {
        return managedContracts[name];
    }
    
    /**
     * @dev Check if a contract is approved
     * @param contractAddress Contract address to check
     * @return True if approved
     */
    function isApprovedContract(
        address contractAddress
    ) external view returns (bool) {
        return approvedContracts[contractAddress];
    }
}