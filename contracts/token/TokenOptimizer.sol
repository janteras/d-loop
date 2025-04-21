// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title TokenOptimizer
 * @dev Contract for optimizing token operations
 */
contract TokenOptimizer {
    using SafeERC20 for IERC20;
    
    // Custom errors
    error LengthMismatch(uint256 recipientsLength, uint256 amountsLength);

    function batchTransfer(
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        if (recipients.length != amounts.length) revert LengthMismatch(recipients.length, amounts.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            token.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }
    }

    function delegateTokens(
        IERC20 token,
        address delegatee,
        uint256 amount
    ) external {
        token.safeTransferFrom(msg.sender, delegatee, amount);
    }

    function withdrawDelegation(
        IERC20 token,
        address delegator,
        uint256 amount
    ) external {
        token.safeTransferFrom(delegator, msg.sender, amount);
    }
}
