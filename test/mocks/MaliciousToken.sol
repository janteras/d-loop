// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousToken
 * @dev A token that attempts to perform reentrancy attacks during transfers
 * Used for security testing of contracts
 */
contract MaliciousToken is ERC20 {
    address public targetContract;
    bool public attackActive;

    constructor(address _targetContract) ERC20("Malicious", "MAL") {
        targetContract = _targetContract;
        attackActive = true;
        _mint(msg.sender, 1000000 * 10**18);
    }

    function balanceOf(address account) public view override returns (uint256) {
        // Always return a positive balance for the contract itself
        if (account == address(this)) {
            return 1000 * 10**18;
        }
        return super.balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        // Attempt reentrancy during transfer if attack is active
        if (attackActive && msg.sender == targetContract) {
            attackActive = false; // Prevent infinite recursion
            
            // Call back into the target contract to attempt reentrancy
            (bool success, ) = targetContract.call(
                abi.encodeWithSignature("recoverTokens(address,uint256)", address(this), amount)
            );
            
            attackActive = true; // Reset for future attacks
        }
        
        return super.transfer(recipient, amount);
    }

    function setAttackActive(bool _attackActive) external {
        attackActive = _attackActive;
    }

    function setTargetContract(address _targetContract) external {
        targetContract = _targetContract;
    }
}
