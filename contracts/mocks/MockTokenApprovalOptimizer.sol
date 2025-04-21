// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";


/**
 * @title MockTokenApprovalOptimizer
 * @dev Mock implementation of the TokenApprovalOptimizer for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockTokenApprovalOptimizer is BaseMock {
    // Events
    event TokenApproved(address indexed token, address indexed spender, uint256 amount);
    event AllowanceIncreased(address indexed token, address indexed spender, uint256 addedValue);
    event AllowanceDecreased(address indexed token, address indexed spender, uint256 subtractedValue);
    event BatchApproval(address[] tokens, address indexed spender, uint256[] amounts);
    
    /**
     * @dev Constructor
     */
    constructor() BaseMock() {}
    
    /**
     * @dev Optimized function to approve tokens only when necessary
     * @param token Address of the ERC20 token
     * @param spender Address that will be allowed to spend tokens
     * @param amount Amount of tokens to approve
     * @return success True if the approval was successful
     */
    function optimizedApprove(address token, address spender, uint256 amount) public returns (bool success) {
        _recordFunctionCall(
            "optimizedApprove",
            abi.encode(token, spender, amount)
        );
        // Check if spender address is valid
        if (spender == address(0)) revert ZeroAddress();
        
        // Check current allowance first
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        
        // Only approve if the allowance has changed
        if (currentAllowance != amount) {
            // If decreasing allowance, use decreaseAllowance pattern where available
            // otherwise, directly approve the new amount
            success = IERC20(token).approve(spender, amount);
            
            // Verify the approval was successful
            require(success, "Token approval failed");
            emit TokenApproved(token, spender, amount);
        } else {
            // Allowance already set to the requested amount
            success = true;
        }
        
        return success;
    }
    
    /**
     * @dev Safely increases the allowance granted to spender by the caller
     * @param token The token to increase allowance for
     * @param spender The address which will spend the funds
     * @param addedValue The amount of tokens to increase the allowance by
     * @return success True if the increase was successful
     */
    function safeIncreaseAllowance(address token, address spender, uint256 addedValue) public returns (bool success) {
        _recordFunctionCall(
            "safeIncreaseAllowance",
            abi.encode(token, spender, addedValue)
        );
        // Check if spender address is valid
        if (spender == address(0)) revert ZeroAddress();
        
        // Get current allowance
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        
        // Calculate new allowance
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) revert InvalidAmount();
        
        // Approve new allowance
        success = IERC20(token).approve(spender, newAllowance);
        require(success, "Increase allowance failed");
        
        emit AllowanceIncreased(token, spender, addedValue);
        return success;
    }
    
    /**
     * @dev Safely decreases the allowance granted to spender by the caller
     * @param token The token to decrease allowance for
     * @param spender The address which will spend the funds
     * @param subtractedValue The amount of tokens to decrease the allowance by
     * @return success True if the decrease was successful
     */
    function safeDecreaseAllowance(address token, address spender, uint256 subtractedValue) public returns (bool success) {
        _recordFunctionCall(
            "safeDecreaseAllowance",
            abi.encode(token, spender, subtractedValue)
        );
        // Check if spender address is valid
        if (spender == address(0)) revert ZeroAddress();
        
        // Get current allowance
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        
        // Ensure we don't underflow
        if (subtractedValue > currentAllowance) revert InvalidAmount();
        
        // Calculate new allowance
        uint256 newAllowance = currentAllowance - subtractedValue;
        
        // Approve new allowance
        success = IERC20(token).approve(spender, newAllowance);
        require(success, "Decrease allowance failed");
        
        emit AllowanceDecreased(token, spender, subtractedValue);
        return success;
    }
    
    /**
     * @dev Gas-efficient batch approval for multiple tokens
     * @param tokens Array of token addresses to approve
     * @param spender The address which will spend the tokens
     * @param amounts Array of amounts to approve for each token
     * @return results Array of booleans indicating success for each approval
     */
    function batchApprove(
        IERC20[] memory tokens,
        address spender,
        uint256[] memory amounts
    ) external returns (bool[] memory results) {
        // Check input validity
        if (tokens.length != amounts.length) revert InvalidArrayLength();
        if (spender == address(0)) revert ZeroAddress();
        
        // Create results array
        results = new bool[](tokens.length);
        
        // Perform approvals
        for (uint256 i = 0; i < tokens.length; i++) {
            if (address(tokens[i]) == address(0)) {
                results[i] = false;
                continue;
            }
            
            // Use optimized approval
            results[i] = optimizedApprove(address(tokens[i]), spender, amounts[i]);
        }
        
        return results;
    }
    
    /**
     * @dev Optimize token approval to avoid unnecessary approvals
     * @param token ERC20 token to approve
     * @param spender Address that will spend the tokens
     * @param amount Amount to approve
     * @return success True if the operation was successful
     */
    function optimizeApproval(IERC20 token, address spender, uint256 amount) external returns (bool success) {
        _recordFunctionCall(
            "optimizeApproval",
            abi.encode(token, spender, amount)
        );
        
        return optimizedApprove(address(token), spender, amount);
    }
    
    /**
     * @dev Safely increase token allowance
     * @param token ERC20 token to approve
     * @param spender Address that will spend the tokens
     * @param addedValue Amount to add to the current allowance
     * @return success True if the operation was successful
     */

    
    /**
     * @dev Approve token in a single transaction (no allowance check)
     * @param token ERC20 token to approve
     * @param spender Address that will spend the tokens
     * @param amount Amount to approve
     * @return success True if the operation was successful
     */
    function singleTransactionApprove(IERC20 token, address spender, uint256 amount) external returns (bool success) {
        _recordFunctionCall(
            "singleTransactionApprove",
            abi.encode(token, spender, amount)
        );
        
        return token.approve(spender, amount);
    }
    
    /**
     * @dev Clear token approval by setting it to zero
     * @param token ERC20 token to clear approval for
     * @param spender Address to clear approval for
     * @return success True if the operation was successful
     */
    function clearApproval(IERC20 token, address spender) external returns (bool success) {
        _recordFunctionCall(
            "clearApproval",
            abi.encode(token, spender)
        );
        
        return optimizedApprove(address(token), spender, 0);
    }
}