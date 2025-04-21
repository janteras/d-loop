// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ITokenOptimizer
 * @dev Interface for the TokenOptimizer contract which optimizes token operations
 */
interface ITokenOptimizer {
    /**
     * @dev Emitted when a token operation is optimized
     */
    event TokenOperationOptimized(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 gasSaved
    );

    /**
     * @dev Optimizes a token transfer operation
     * @param token Address of the token
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return success Whether the operation was successful
     */
    function optimizeTransfer(
        address token,
        address to,
        uint256 amount
    ) external returns (bool success);

    /**
     * @dev Gets the estimated gas savings for a token operation
     * @param token Address of the token
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return gasSavings The estimated gas savings
     */
    function estimateGasSavings(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (uint256 gasSavings);
}
