// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TokenApprovalOptimizer
 * @dev Optimizes token approvals to reduce gas costs for repeated operations
 */

// Custom errors for gas optimization
/// @notice Thrown when an invalid threshold value is provided
error InvalidThresholdValue(uint256 providedValue);
/// @notice Thrown when an invalid token address is provided
error InvalidTokenAddress();
/// @notice Thrown when an invalid owner address is provided
error InvalidOwnerAddress();
/// @notice Thrown when an invalid spender address is provided
error InvalidSpenderAddress();
/// @notice Thrown when an invalid recipient address is provided
error InvalidRecipientAddress();
/// @notice Thrown when an invalid transfer amount is provided
error InvalidTransferAmount();
/// @notice Thrown when there is insufficient balance for a transfer
error InsufficientBalance(uint256 available, uint256 required);
/// @notice Thrown when a caller lacks the required role
error UnauthorizedCaller(address caller, bytes32 requiredRole);
contract TokenApprovalOptimizer is Ownable, AccessControl {
    using SafeERC20 for IERC20;

    // Approval threshold in percentage (e.g. 20 means 20%)
    uint256 public approvalThreshold;
    
    // Default max approval value
    uint256 public constant MAX_APPROVAL = 2**256 - 1;
    
    // Role definitions
    bytes32 public constant OPTIMIZER_ROLE = keccak256("OPTIMIZER_ROLE");
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");
    
    // Events
    event ThresholdUpdated(uint256 newThreshold);
    event ApprovalOptimized(address indexed token, address indexed spender, uint256 amount);
    event TokenTransferred(address indexed token, address indexed recipient, uint256 amount);
    // Note: RoleGranted event is already defined in AccessControl
    
    /**
     * @dev Constructor with optional threshold parameter
     * @param threshold Initial approval threshold percentage (defaults to 20 if not provided)
     */
    constructor(uint256 threshold) Ownable(msg.sender) {
        // Setup initial roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPTIMIZER_ROLE, msg.sender);
        _grantRole(TRANSFER_ROLE, msg.sender);
        if (threshold == 0) {
            approvalThreshold = 20;
        } else {
            if (threshold > 100) revert InvalidThresholdValue(threshold);
            approvalThreshold = threshold;
        }
    }
    
    /**
     * @dev Update approval threshold
     * @param newThreshold New threshold value (1-100)
     */
    function setApprovalThreshold(uint256 newThreshold) external onlyOwner {
        if (newThreshold == 0 || newThreshold > 100) revert InvalidThresholdValue(newThreshold);
        approvalThreshold = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }
    
    /**
     * @dev Optimizes token approval by checking current allowance first
     * @param token Token to approve
     * @param owner Token owner
     * @param spender Address to approve
     * @param amount Amount to approve
     * @return True if operation successful
     */
    /**
     * @dev Grants a role to an account
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function grantOptimizationRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
        emit RoleGranted(role, account, msg.sender);
    }

    /**
     * @dev Revokes a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeOptimizationRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }
    
    function optimizeApproval(
        address token,
        address owner,
        address spender,
        uint256 amount
    ) external onlyRole(OPTIMIZER_ROLE) returns (bool) {
        if (token == address(0)) revert InvalidTokenAddress();
        if (owner == address(0)) revert InvalidOwnerAddress();
        if (spender == address(0)) revert InvalidSpenderAddress();
        
        // Get current allowance
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(owner, spender);
        
        // If current allowance is less than the threshold percentage of the amount,
        // approve the max amount
        if (currentAllowance < (amount * approvalThreshold) / 100) {
            // Reset approval to 0 first if needed (for tokens like USDT)
            if (currentAllowance > 0) {
                // For token approvals from this contract, we can use forceApprove from SafeERC20
                SafeERC20.forceApprove(tokenContract, spender, 0);
            }
            
            // Set new approval to max value
            SafeERC20.forceApprove(tokenContract, spender, MAX_APPROVAL);
            emit ApprovalOptimized(token, spender, MAX_APPROVAL);
        }
        
        return true;
    }
    
    /**
     * @dev Simple approval method for direct use
     * @param token Token to approve
     * @param spender Address to approve
     * @param amount Amount to approve
     */
    function approve(
        address token,
        address spender,
        uint256 amount
    ) external onlyOwner {
        if (token == address(0)) revert InvalidTokenAddress();
        if (spender == address(0)) revert InvalidSpenderAddress();
        
        // Use SafeERC20 for approvals
        IERC20 tokenContract = IERC20(token);
        
        // Use forceApprove which handles the zero-approval issue safely
        SafeERC20.forceApprove(tokenContract, spender, amount);
    }
    
    /**
     * @dev Transfers tokens from the contract to a recipient
     * @param token Token to transfer
     * @param recipient Address to receive tokens
     * @param amount Amount to transfer
     * @return True if operation successful
     */
    function transferTokens(
        address token,
        address recipient,
        uint256 amount
    ) external onlyRole(TRANSFER_ROLE) returns (bool) {
        if (token == address(0)) revert InvalidTokenAddress();
        if (recipient == address(0)) revert InvalidRecipientAddress();
        if (amount == 0) revert InvalidTransferAmount();
        
        // Transfer tokens from contract to recipient
        IERC20 tokenContract = IERC20(token);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        
        // Check if we have enough balance
        if (contractBalance < amount) revert InsufficientBalance(contractBalance, amount);
        
        // Use SafeERC20 for the transfer
        tokenContract.safeTransfer(recipient, amount);
        
        emit TokenTransferred(token, recipient, amount);
        return true;
    }
}