// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ITreasury
 * @dev Interface for the DLOOP protocol treasury management
 * @notice This interface defines the standard treasury operations and token management functions
 */
interface ITreasury {
    /**
     * @dev Emitted when funds are received by the treasury
     * @param token The token address received
     * @param amount The amount received
     * @param from The address that sent the funds
     */
    event FundsReceived(
        address indexed token,
        uint256 amount,
        address indexed from
    );

    /**
     * @dev Emitted when funds are distributed from the treasury
     * @param token The token address distributed
     * @param recipient The recipient of the funds
     * @param amount The amount distributed
     */
    event FundsDistributed(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    /**
     * @dev Emitted when a token approval is optimized
     * @param token The token address
     * @param spender The approved spender
     * @param amount The approved amount
     */
    event ApprovalOptimized(
        address indexed token,
        address indexed spender,
        uint256 amount
    );

    /**
     * @dev Receives funds into the treasury
     * @param token The token address to receive
     * @param amount The amount to receive
     * @return success True if the operation succeeded
     */
    function receiveFunds(
        address token,
        uint256 amount
    ) external returns (bool success);

    /**
     * @dev Distributes funds from the treasury
     * @param token The token address to distribute
     * @param recipient The recipient address
     * @param amount The amount to distribute
     * @return success True if the operation succeeded
     */
    function distributeFunds(
        address token,
        address recipient,
        uint256 amount
    ) external returns (bool success);
    
    /**
     * @dev Performs batch transfer of multiple tokens
     * @param tokens Array of token addresses
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     * @return results Array of boolean results for each transfer
     */
    function batchTransfer(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external returns (bool[] memory results);
    
    /**
     * @dev Optimizes token approval for a spender
     * @param token The token address to approve
     * @param spender The address to approve for
     * @param amount The amount to approve
     * @return success True if the operation succeeded
     */
    function optimizeApproval(
        address token,
        address spender,
        uint256 amount
    ) external returns (bool success);
    
    /**
     * @dev Returns the balance of a token in the treasury
     * @param token The token address to check
     * @return The current balance
     */
    function getBalance(
        address token
    ) external view returns (uint256);

    /**
     * @dev Checks if a spender is approved for a token
     * @param token The token address to check
     * @param spender The spender address to check
     * @return True if the spender is approved
     */
    function isApproved(
        address token,
        address spender
    ) external view returns (bool);

    /**
     * @dev Returns the treasury configuration
     * @return admin The treasury admin address
     * @return protocolDAO The protocol DAO address
     */
    function getTreasuryConfig() external view returns (
        address admin,
        address protocolDAO
    );
}
