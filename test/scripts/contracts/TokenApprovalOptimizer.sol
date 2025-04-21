// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenApprovalOptimizer {
    function optimizedApprove(IERC20 token, address spender, uint256 amount) public returns (bool) {
        uint256 currentAllowance = token.allowance(address(this), spender);
        
        if (currentAllowance != amount) {
            return token.approve(spender, amount);
        }
        
        return true;
    }
}