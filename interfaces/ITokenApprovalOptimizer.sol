// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IERC20.sol";

/**
 * @title ITokenApprovalOptimizer
 * @dev Interface for the token approval optimizer
 */
interface ITokenApprovalOptimizer {
    /**
     * @dev Optimize token approval for a spender by checking current allowance
     * @param token The token to optimize approval for
     * @param spender The address to approve
     * @param amount The amount to approve
     * @return success Whether the optimization was successful
     */
    function optimizeApproval(IERC20 token, address spender, uint256 amount) external returns (bool success);
    
    /**
     * @dev Safely increase token allowance
     * @param token The token to increase allowance for
     * @param spender The spender to increase allowance for
     * @param addedValue The amount to add to the allowance
     * @return success Whether the operation was successful
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 addedValue) external returns (bool success);
    
    /**
     * @dev Safely decrease token allowance
     * @param token The token to decrease allowance for
     * @param spender The spender to decrease allowance for
     * @param subtractedValue The amount to subtract from the allowance
     * @return success Whether the operation was successful
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 subtractedValue) external returns (bool success);
    
    /**
     * @dev Batch approve function for multiple tokens
     * @param tokens Array of ERC20 tokens
     * @param spender The address allowed to spend the tokens
     * @param amounts Array of amounts to approve
     * @return results Array of success flags
     */
    function batchApprove(IERC20[] memory tokens, address spender, uint256[] memory amounts) external returns (bool[] memory results);
    
    /**
     * @dev Efficiently approve exactly what's needed for a single transaction then reset to 0
     * Useful for protocols that want to avoid persistent approvals
     * @param token The ERC20 token to approve
     * @param spender The address to approve
     * @param amount The amount to approve
     * @return success Whether the approval was successful
     */
    function singleTransactionApprove(IERC20 token, address spender, uint256 amount) external returns (bool success);
    
    /**
     * @dev Zero out an approval after it's been used
     * Call this after a transferFrom operation to clear the approval
     * @param token The ERC20 token to clear approval for
     * @param spender The address to remove approval from
     * @return success Whether the operation was successful
     */
    function clearApproval(IERC20 token, address spender) external returns (bool success);
}