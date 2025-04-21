# D-Loop Protocol Stateful Fuzzing Guide

## Introduction

This guide explains how to implement stateful fuzzing for the D-Loop Protocol, focusing on modeling complex attack vectors and system state transitions.

## What is Stateful Fuzzing?

Unlike traditional fuzz testing that tests functions in isolation, stateful fuzzing:
- Executes sequences of actions
- Maintains and tracks system state
- Models realistic user behaviors and attack patterns
- Discovers vulnerabilities that emerge from specific state sequences

## Implementation with Foundry

### Basic Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "./Handler.sol";

contract StatefulTest is Test {
    // Target contracts
    TargetContract public target;
    
    // Handler contract
    Handler public handler;
    
    function setUp() public {
        // Deploy target contract
        target = new TargetContract();
        
        // Deploy handler
        handler = new Handler(target);
        
        // Target the handler for invariant testing
        targetContract(address(handler));
    }
    
    function invariant_PropertyName() public {
        // Verify properties after sequence of actions
    }
}
```

### Handler Contract

The handler contract models user actions:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";

contract Handler is Test {
    TargetContract public target;
    
    // State tracking variables
    mapping(address => uint256) public userBalances;
    address[] public actors;
    uint256 public actionCount;
    
    constructor(TargetContract _target) {
        target = _target;
        
        // Create test actors
        for (uint i = 0; i < 5; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", i))));
        }
    }
    
    // Action functions called by the fuzzer
    function deposit(uint256 actorSeed, uint256 amount) public {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 0.1 ether, 10 ether);
        
        vm.deal(actor, amount);
        vm.prank(actor);
        target.deposit{value: amount}();
        
        userBalances[actor] += amount;
        actionCount++;
    }
    
    function withdraw(uint256 actorSeed, uint256 amount) public {
        address actor = actors[actorSeed % actors.length];
        uint256 balance = target.balanceOf(actor);
        if (balance == 0) return;
        
        amount = bound(amount, 0, balance);
        
        vm.prank(actor);
        target.withdraw(amount);
        
        userBalances[actor] -= amount;
        actionCount++;
    }
}
```

## Attack Sequence Modeling

Model specific attack patterns:

```solidity
// Flash loan attack sequence
function flashLoanAttack(uint256 amountSeed) public {
    uint256 amount = bound(amountSeed, 1000 ether, 10000 ether);
    
    // Setup attacker
    address attacker = makeAddr("attacker");
    vm.deal(attacker, 1 ether); // Initial funds
    
    // 1. Take flash loan
    vm.startPrank(attacker);
    target.flashLoan(amount);
    
    // 2. Manipulate price
    target.swapLargeAmount(amount);
    
    // 3. Exploit vulnerable function
    target.vulnerableFunction();
    
    // 4. Repay flash loan
    target.repayFlashLoan(amount);
    vm.stopPrank();
    
    actionCount++;
}
```

## Reentrancy Attack Modeling

```solidity
// Malicious contract for reentrancy
contract ReentrancyAttacker {
    TargetContract public target;
    uint256 public attackCount;
    
    constructor(TargetContract _target) {
        target = _target;
    }
    
    // Fallback function for reentrancy
    receive() external payable {
        if (attackCount < 5) {
            attackCount++;
            target.withdraw(1 ether);
        }
    }
    
    function attack() external payable {
        // Initial deposit
        target.deposit{value: msg.value}();
        
        // Trigger reentrancy
        target.withdraw(1 ether);
    }
}

// In Handler contract
function reentrancyAttack(uint256 amountSeed) public {
    uint256 amount = bound(amountSeed, 1 ether, 5 ether);
    
    // Deploy attacker contract
    ReentrancyAttacker attacker = new ReentrancyAttacker(target);
    
    // Fund attacker
    vm.deal(address(attacker), amount);
    
    // Execute attack
    attacker.attack{value: amount}();
    
    actionCount++;
}
```

## Governance Attack Modeling

```solidity
function governanceAttack(uint256 proposalIdSeed, uint256 tokenAmountSeed) public {
    uint256 proposalId = bound(proposalIdSeed, 1, 100);
    uint256 tokenAmount = bound(tokenAmountSeed, 100000 ether, 1000000 ether);
    
    // Setup attacker
    address attacker = makeAddr("attacker");
    
    // 1. Flash loan tokens to gain voting power
    vm.startPrank(attacker);
    target.flashLoanTokens(tokenAmount);
    
    // 2. Vote on proposal
    target.castVote(proposalId, true);
    
    // 3. Execute proposal if possible
    if (target.canExecute(proposalId)) {
        target.executeProposal(proposalId);
    }
    
    // 4. Return flash loaned tokens
    target.returnFlashLoanedTokens(tokenAmount);
    vm.stopPrank();
    
    actionCount++;
}
```

## Configuration in foundry.toml

```toml
[profile.stateful]
# Higher depth for more complex sequences
invariant = { runs = 100, depth = 50, fail_on_revert = false }

# Longer sequences for attack patterns
[profile.attack_simulation]
invariant = { runs = 50, depth = 100, fail_on_revert = false }
```

## Running Stateful Tests

```bash
# Run all stateful tests
forge test --match-path "test/foundry/stateful/**/*.sol" --profile stateful -vvv

# Run specific attack simulation
forge test --match-test "testAttackSequence" --profile attack_simulation -vvv
```

## Best Practices

1. **State Tracking**: Maintain accurate state tracking in handlers
2. **Realistic Sequences**: Model realistic user behaviors and attack patterns
3. **Invariant Verification**: Verify critical properties after each sequence
4. **Failure Analysis**: Carefully analyze sequence failures to understand attack vectors
5. **Sequence Visualization**: Log action sequences for better understanding
6. **Deterministic Reproduction**: Save seeds to reproduce discovered vulnerabilities

## Integration with Security Tools

Combine stateful fuzzing with other security tools:

```bash
# Run Echidna for smart contract fuzzing
echidna-test ContractName.sol --config echidna.yaml

# Run Manticore for symbolic execution
manticore ContractName.sol --contract ContractName
```

## Conclusion

Stateful fuzzing is a powerful technique for discovering complex vulnerabilities in the D-Loop Protocol. By modeling realistic attack sequences, we can identify and mitigate potential security issues before they impact users.
