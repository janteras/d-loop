// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../utils/Errors.sol";

/**
 * @title MockPreviousVersionDAO
 * @dev Simulates a previous version of a protocol contract that expects direct approvals
 * Used for testing backward compatibility with older contract versions
 */
contract MockPreviousVersionDAO is Ownable {
    // Track successful uses of approval
    event ApprovalUsed(address token, address from, address to, uint256 amount, string purpose);
    
    // Map token to delegated accounts
    mapping(address => mapping(address => bool)) public delegatedAccounts;
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Set an account as delegated for a token
     * @param token The token address
     * @param account The account to delegate
     * @param status Whether the account is delegated
     */
    function setDelegatedAccount(address token, address account, bool status) external onlyOwner {
        delegatedAccounts[token][account] = status;
    }
    
    /**
     * @dev Use an approval to transfer tokens
     * @param token The token address
     * @param from The token owner who approved this contract
     * @param to The recipient of the tokens
     * @param amount The amount to transfer
     * @return Whether the operation was successful
     */
    function useApproval(
        address token, 
        address from, 
        address to, 
        uint256 amount
    ) external returns (bool) {
        // Check token validity
        if (token == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Here we're simulating an older implementation that doesn't use optimized approvals
        bool success = IERC20(token).transferFrom(from, to, amount);
        if (!success) revert TokenTransferFailed();
        
        emit ApprovalUsed(token, from, to, amount, "Legacy operation");
        
        return true;
    }
    
    /**
     * @dev Older contracts often had direct approval functions
     * @param token The token address
     * @param spender The spender to approve
     * @param amount The amount to approve
     */
    function legacyApprove(address token, address spender, uint256 amount) external onlyOwner {
        bool success = IERC20(token).approve(spender, amount);
        if (!success) revert OperationFailed();
    }
    
    /**
     * @dev Previous contract version might have had custom allowance check
     * @param token The token address
     * @param owner The token owner
     * @param spender The spender address
     * @return The allowance amount
     */
    function legacyCheckAllowance(
        address token, 
        address owner, 
        address spender
    ) external view returns (uint256) {
        return IERC20(token).allowance(owner, spender);
    }
}