// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/tokens/IERC20.sol";

/**
 * @title MockLegacyConsumer
 * @dev Mock implementation of a legacy contract that interacts with ERC20 tokens
 * Used for backward compatibility testing
 */
contract MockLegacyConsumer {
    event TransferExecuted(address token, address from, address to, uint256 amount);
    event ApprovalChecked(address token, address owner, address spender, uint256 amount, bool sufficient);
    
    /**
     * @dev Execute a transferFrom operation using the token
     * @param token The token address
     * @param from Address to transfer from
     * @param to Address to transfer to
     * @param amount Amount to transfer
     */
    function executeTransfer(address token, address from, address to, uint256 amount) external {
        // Use legacy IERC20 interface
        IERC20(token).transferFrom(from, to, amount);
        
        emit TransferExecuted(token, from, to, amount);
    }
    
    /**
     * @dev Check if allowance is sufficient
     * @param token The token address
     * @param owner Token owner
     * @param spender Token spender
     * @param amount Amount to check
     * @return sufficient Whether allowance is sufficient
     */
    function checkAllowance(address token, address owner, address spender, uint256 amount) external returns (bool) {
        uint256 allowance = IERC20(token).allowance(owner, spender);
        bool sufficient = allowance >= amount;
        
        emit ApprovalChecked(token, owner, spender, amount, sufficient);
        
        return sufficient;
    }
    
    /**
     * @dev Check if the token is paused
     * @param token The token address
     * @return paused Whether the token is paused
     */
    function checkIfPaused(address token) external view returns (bool) {
        // Need to use low-level call for non-standard function
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("paused()")
        );
        
        if (success && data.length == 32) {
            return abi.decode(data, (bool));
        }
        
        return false;
    }
    
    /**
     * @dev Get decimals from token (legacy style)
     * @param token The token address
     * @return tokenDecimals The token decimals
     */
    function getDecimals(address token) external view returns (uint8) {
        // Need to use low-level call for older compatibility
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        
        if (success && data.length > 0) {
            return abi.decode(data, (uint8));
        }
        
        return 18; // Default fallback
    }
}