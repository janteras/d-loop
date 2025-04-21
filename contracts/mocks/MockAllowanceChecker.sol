// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";

/**
 * @title MockAllowanceChecker
 * @dev Mocks a system that checks allowance before every operation
 * @notice This contract follows the standard mock pattern using BaseMock
 * Used for testing backward compatibility with systems that don't cache allowances
 */
contract MockAllowanceChecker is Ownable, BaseMock {
    // Track operations
    event OperationPerformed(address token, address from, address to, uint256 amount, uint256 operationId);
    
    uint256 private _operationCounter;
    
    constructor() Ownable(msg.sender) BaseMock() {
        _operationCounter = 0;
    }
    
    /**
     * @dev Perform an operation that checks allowance every time
     * @param token The token address
     * @param from The token owner who approved this contract
     * @param to The recipient of the tokens
     * @param amount The amount to transfer
     * @return The operation ID
     */
    function performOperation(
        address token, 
        address from, 
        address to, 
        uint256 amount
    ) external returns (uint256) {
        _recordFunctionCall(
            "performOperation",
            abi.encode(token, from, to, amount)
        );
        
        // Always check current allowance first
        uint256 currentAllowance = IERC20(token).allowance(from, address(this));
        if (currentAllowance < amount) revert InsufficientAllowance();
        
        // Perform the transfer
        bool success = IERC20(token).transferFrom(from, to, amount);
        if (!success) revert TokenTransferFailed();
        
        // Increment operation counter
        _operationCounter++;
        
        emit OperationPerformed(token, from, to, amount, _operationCounter);
        
        return _operationCounter;
    }
    
    /**
     * @dev Get current operation counter
     * @return The current operation counter
     */
    function getOperationCount() external view returns (uint256) {
        return _operationCounter;
    }
    
    /**
     * @dev Emergency function to recover tokens sent directly to this contract
     * @param token The token address
     * @param to The recipient address
     * @param amount The amount to recover
     */
    function recoverTokens(address token, address to, uint256 amount) external onlyOwner {
        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert TokenTransferFailed();
    }
}