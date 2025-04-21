// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/tokens/IERC20.sol";
import "../interfaces/tokens/ITokenApprovalOptimizer.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";

/**
 * @title MockTokenOptimizerTest
 * @dev Test implementation of TokenApprovalOptimizer for direct testing
 * @notice Implements the ITokenApprovalOptimizer interface with test functions
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockTokenOptimizerTest is ITokenApprovalOptimizer, BaseMock {
    bool[] private _batchResults;
    bool private _lastApprovalWasOptimized;
    
    /**
     * @dev Implementation of optimizeApproval from ITokenApprovalOptimizer
     */
    constructor() BaseMock() {}
    
    function optimizeApproval(IERC20 token, address spender, uint256 amount) external override returns (bool success) {
        _recordFunctionCall(
            "optimizeApproval",
            abi.encode(token, spender, amount)
        );
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        
        // If allowance is already set correctly, skip
        if (currentAllowance == amount) {
            return true;
        }
        
        // Reset to 0 first if needed to prevent front-running
        if (currentAllowance > 0 && amount > 0) {
            success = token.approve(spender, 0);
            if (!success) revert ApprovalFailed();
        }
        
        // Set to desired amount
        return token.approve(spender, amount);
    }
    
    /**
     * @dev Implementation of batchApprove from ITokenApprovalOptimizer
     */
    function batchApprove(
        IERC20[] memory tokens,
        address spender,
        uint256[] memory amounts
    ) external override returns (bool[] memory results) {
        _recordFunctionCall(
            "batchApprove",
            abi.encode(tokens, spender, amounts)
        );
        if (tokens.length != amounts.length) revert InvalidArrayLength();
        if (spender == address(0)) revert ZeroAddress();
        
        results = new bool[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (address(tokens[i]) == address(0)) revert ZeroAddress();
            
            // Optimize each approval
            uint256 currentAllowance = tokens[i].allowance(address(this), spender);
            uint256 amount = amounts[i];
            
            // Skip if allowance is already correct
            if (currentAllowance == amount) {
                results[i] = true;
                continue;
            }
            
            // Reset to 0 first if needed
            if (currentAllowance > 0 && amount > 0) {
                bool resetSuccess = tokens[i].approve(spender, 0);
                if (!resetSuccess) {
                    results[i] = false;
                    continue;
                }
            }
            
            // Set to desired amount
            results[i] = tokens[i].approve(spender, amount);
        }
        
        _batchResults = results;
        return results;
    }
    
    /**
     * @dev Implementation of safeIncreaseAllowance from ITokenApprovalOptimizer
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 addedValue) external override returns (bool success) {
        _recordFunctionCall(
            "safeIncreaseAllowance",
            abi.encode(token, spender, addedValue)
        );
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) revert MathOverflow();
        
        success = token.approve(spender, newAllowance);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Implementation of safeDecreaseAllowance from ITokenApprovalOptimizer
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 subtractedValue) external override returns (bool success) {
        _recordFunctionCall(
            "safeDecreaseAllowance",
            abi.encode(token, spender, subtractedValue)
        );
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        
        if (subtractedValue > currentAllowance) {
            revert InsufficientAllowance();
        }
        
        success = token.approve(spender, currentAllowance - subtractedValue);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Test function for ensuring tokens are approved
     */
    function ensureTokensApproved(IERC20 token, address spender, uint256 amount) external returns (bool) {
        _recordFunctionCall(
            "ensureTokensApproved",
            abi.encode(token, spender, amount)
        );
        uint256 currentAllowance = token.allowance(address(this), spender);
        if (currentAllowance >= amount) {
            return true;
        }
        
        return token.approve(spender, amount);
    }
    
    /**
     * @dev Implementation of singleTransactionApprove from ITokenApprovalOptimizer
     */
    function singleTransactionApprove(IERC20 token, address spender, uint256 amount) external override returns (bool success) {
        _recordFunctionCall(
            "singleTransactionApprove",
            abi.encode(token, spender, amount)
        );
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Approve the exact amount
        success = token.approve(spender, amount);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Implementation of clearApproval from ITokenApprovalOptimizer
     */
    function clearApproval(IERC20 token, address spender) external override returns (bool success) {
        _recordFunctionCall(
            "clearApproval",
            abi.encode(token, spender)
        );
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Set allowance to 0
        success = token.approve(spender, 0);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Get the last batch results
     */
    function getLastBatchResults() external view returns (bool[] memory) {
        return _batchResults;
    }
    
    /**
     * @dev Check if the last approval was optimized
     */
    function lastApprovalWasOptimized() external view returns (bool) {
        return _lastApprovalWasOptimized;
    }
    
    /**
     * @dev Test function for optimizedApprove
     */
    function testOptimizedApprove(address token, address spender, uint256 amount) external returns (bool) {
        _recordFunctionCall(
            "testOptimizedApprove",
            abi.encode(token, spender, amount)
        );
        // Get current allowance
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        
        // Check if optimization is possible (same allowance)
        if (currentAllowance == amount) {
            _lastApprovalWasOptimized = true;
            return true;
        }
        
        _lastApprovalWasOptimized = false;
        
        // Do what optimizeApproval would do
        if (currentAllowance > 0 && amount > 0) {
            bool resetSuccess = IERC20(token).approve(spender, 0);
            if (!resetSuccess) return false;
        }
        
        // Set to desired amount
        return IERC20(token).approve(spender, amount);
    }
    
    /**
     * @dev Test function for batchApprove
     */
    function testBatchApprove(address[] calldata tokens, address spender, uint256[] calldata amounts) external returns (bool[] memory) {
        _recordFunctionCall(
            "testBatchApprove",
            abi.encode(tokens, spender, amounts)
        );
        // Validate inputs
        if (tokens.length != amounts.length) revert InvalidArrayLength();
        if (spender == address(0)) revert ZeroAddress();
        
        // Prepare results array
        bool[] memory results = new bool[](tokens.length);
        
        // Process each token approval
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) revert ZeroAddress();
            
            IERC20 token = IERC20(tokens[i]);
            uint256 currentAllowance = token.allowance(address(this), spender);
            uint256 amount = amounts[i];
            
            // Skip if allowance is already correct
            if (currentAllowance == amount) {
                results[i] = true;
                continue;
            }
            
            // Reset to 0 first if needed
            if (currentAllowance > 0 && amount > 0) {
                bool resetSuccess = token.approve(spender, 0);
                if (!resetSuccess) {
                    results[i] = false;
                    continue;
                }
            }
            
            // Set to desired amount
            results[i] = token.approve(spender, amount);
        }
        
        _batchResults = results;
        return results;
    }
    
    /**
     * @dev Test function for safeIncreaseAllowance
     */
    function testIncreaseAllowance(address token, address spender, uint256 addedValue) external returns (bool) {
        _recordFunctionCall(
            "testIncreaseAllowance",
            abi.encode(token, spender, addedValue)
        );
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) revert MathOverflow();
        
        bool success = tokenContract.approve(spender, newAllowance);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Test function for safeDecreaseAllowance
     */
    function testDecreaseAllowance(address token, address spender, uint256 subtractedValue) external returns (bool) {
        _recordFunctionCall(
            "testDecreaseAllowance",
            abi.encode(token, spender, subtractedValue)
        );
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        
        if (subtractedValue > currentAllowance) {
            revert InsufficientAllowance();
        }
        
        bool success = tokenContract.approve(spender, currentAllowance - subtractedValue);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
}