# Foundry Fuzz Testing Guide for D-Loop Protocol

This guide outlines how to implement property-based testing using Foundry for the D-Loop Protocol. Fuzz testing helps discover edge cases and vulnerabilities that might be missed by traditional unit tests.

## Setup Instructions

### 1. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Initialize Git Repository (if not already done)

Foundry works best with Git repositories. If your project isn't already a Git repository:

```bash
git init
git add .
git commit -m "Initial commit"
```

### 3. Install Foundry Dependencies

```bash
forge install foundry-rs/forge-std
```

### 4. Configure Foundry

Create or update `foundry.toml` with the following configuration:

```toml
[profile.default]
src = 'contracts'
out = 'out'
libs = ['node_modules', 'lib']
test = 'test/foundry'
cache_path = 'forge-cache'

# Compilation settings
solc_version = '0.8.24'
optimizer = true
optimizer_runs = 200
verbosity = 2

# Testing settings
fuzz = { runs = 1000 }
invariant = { runs = 100, depth = 10 }

[profile.ci]
fuzz = { runs = 5000 }
invariant = { runs = 200, depth = 15 }

[profile.gas]
fuzz = { runs = 100 }
invariant = { runs = 10, depth = 5 }
gas_reports = ["*"]
```

### 5. Create Foundry Test Directory Structure

```bash
mkdir -p test/foundry/core
mkdir -p test/foundry/governance
mkdir -p test/foundry/token
```

## Writing Fuzz Tests

Fuzz tests should focus on critical functions that handle user funds, access control, or complex state transitions. Here's an example for the GovernanceRewards contract:

```solidity
// test/foundry/governance/GovernanceRewards.t.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/governance/GovernanceRewards.sol";
import "../../../contracts/token/DLoopToken.sol";

contract GovernanceRewardsTest is Test {
    // Contracts
    GovernanceRewards public governanceRewards;
    DLoopToken public dloopToken;
    
    // Test accounts
    address public admin;
    address public user1;
    address public user2;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant REWARDS_POOL = 100_000 ether;
    
    function setUp() public {
        // Setup accounts
        admin = makeAddr("admin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy token with admin as owner
        vm.startPrank(admin);
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            admin
        );
        
        // Deploy governance rewards contract
        governanceRewards = new GovernanceRewards(
            address(dloopToken),
            admin
        );
        
        // Fund governance rewards contract
        dloopToken.transfer(address(governanceRewards), REWARDS_POOL);
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test for distributing rewards with various amounts
     */
    function testFuzz_DistributeRewards(
        uint256 proposalId,
        uint256 amount1,
        uint256 amount2
    ) public {
        // Bound inputs to realistic values
        proposalId = bound(proposalId, 1, 1000);
        amount1 = bound(amount1, 1 ether, 1000 ether);
        amount2 = bound(amount2, 1 ether, 1000 ether);
        
        // Ensure total rewards don't exceed pool
        uint256 totalAmount = amount1 + amount2;
        if (totalAmount > REWARDS_POOL) {
            amount1 = (amount1 * REWARDS_POOL) / totalAmount;
            amount2 = (amount2 * REWARDS_POOL) / totalAmount;
            totalAmount = amount1 + amount2;
        }
        
        // Setup reward distribution parameters
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount1;
        amounts[1] = amount2;
        
        string memory description = "Test reward distribution";
        
        // Record balances before distribution
        uint256 user1BalanceBefore = dloopToken.balanceOf(user1);
        uint256 user2BalanceBefore = dloopToken.balanceOf(user2);
        uint256 contractBalanceBefore = dloopToken.balanceOf(address(governanceRewards));
        
        // Distribute rewards
        vm.prank(admin);
        governanceRewards.distributeRewards(proposalId, recipients, amounts, description);
        
        // Verify balances after distribution
        assertEq(dloopToken.balanceOf(user1), user1BalanceBefore + amount1);
        assertEq(dloopToken.balanceOf(user2), user2BalanceBefore + amount2);
        assertEq(
            dloopToken.balanceOf(address(governanceRewards)), 
            contractBalanceBefore - totalAmount
        );
    }
}
```

## Key Fuzz Testing Patterns

### 1. Input Bounding

Always bound fuzzed inputs to realistic ranges to avoid wasting test cycles on unrealistic values:

```solidity
amount = bound(amount, 1 ether, 1000 ether);
```

### 2. Property Verification

Focus on testing properties that should hold true regardless of input values:

```solidity
// Property: Total rewards distributed should never exceed the initial rewards pool
assertGe(REWARDS_POOL, REWARDS_POOL - remainingBalance);
```

### 3. Invariant Testing

Test properties that should remain true throughout state changes:

```solidity
// Invariant: Sum of all user balances + contract balance = initial total supply
assertEq(
    dloopToken.balanceOf(user1) + 
    dloopToken.balanceOf(user2) + 
    dloopToken.balanceOf(address(governanceRewards)),
    INITIAL_SUPPLY
);
```

### 4. State Transition Testing

Verify that contract state transitions correctly under various inputs:

```solidity
// Before state
uint256 balanceBefore = token.balanceOf(user);

// Action with fuzzed input
vm.prank(admin);
contract.transfer(user, fuzzedAmount);

// After state - verify property holds
assertEq(token.balanceOf(user), balanceBefore + fuzzedAmount);
```

## Running Fuzz Tests

```bash
# Run all fuzz tests
forge test

# Run specific test file
forge test --match-path test/foundry/governance/GovernanceRewards.t.sol

# Increase fuzz runs for more thorough testing
forge test --fuzz-runs 10000

# Run with gas reporting
forge test --gas-report
```

## Recommended Fuzz Tests for D-Loop Protocol

### Core Contracts

1. **AssetDAO**
   - Fuzz test investment amounts and verify share calculations
   - Test proposal creation with various parameters
   - Verify voting mechanisms with different voter distributions

2. **ProtocolDAO**
   - Test proposal execution with various action parameters
   - Verify quorum calculations with different voter distributions
   - Test access control with various account combinations

### Token Contracts

1. **DLoopToken**
   - Test transfers with various amounts
   - Verify approval mechanisms with different allowance values
   - Test minting/burning with boundary values

2. **TokenApprovalOptimizer**
   - Test optimization logic with various token amounts
   - Verify gas savings across different transaction patterns

### Governance Contracts

1. **GovernanceRewards**
   - Test reward distribution with various recipient counts and amounts
   - Verify claiming mechanisms with different reward structures
   - Test reward accounting invariants

2. **AINodeGovernance**
   - Test node removal proposals with various voting patterns
   - Verify voting power calculations with different stake distributions

## Integration with Hardhat Tests

Foundry tests should complement, not replace, the existing Hardhat test suite:

1. Use Hardhat for unit tests, integration tests, and gas profiling
2. Use Foundry for property-based testing and invariant testing
3. Run both test suites in CI/CD pipelines
4. Combine coverage reports from both test suites

## Best Practices

1. **Start with critical functions**: Focus on functions that handle user funds, access control, or complex state transitions
2. **Test properties, not implementations**: Focus on what the contract should guarantee, not how it's implemented
3. **Use realistic input ranges**: Bound inputs to realistic values to avoid wasting test cycles
4. **Test edge cases explicitly**: While fuzzing helps find edge cases, also test known edge cases explicitly
5. **Combine with traditional tests**: Use fuzz testing to complement, not replace, traditional unit and integration tests
