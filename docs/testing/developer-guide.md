# D-Loop Protocol Testing Guide for Developers

## Introduction

This guide provides standards and best practices for writing effective tests for the D-Loop Protocol. Following these guidelines ensures consistent, maintainable, and comprehensive test coverage across the codebase.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [Test Structure](#test-structure)
4. [Naming Conventions](#naming-conventions)
5. [Mock Contracts](#mock-contracts)
6. [Test Fixtures](#test-fixtures)
7. [Fuzz Testing](#fuzz-testing)
8. [Invariant Testing](#invariant-testing)
9. [Coverage Requirements](#coverage-requirements)
10. [Continuous Integration](#continuous-integration)

## Testing Philosophy

The D-Loop Protocol testing strategy follows these core principles:

1. **Comprehensive Coverage**: Every contract function should have corresponding tests.
2. **Defense in Depth**: Multiple test types should validate critical functionality.
3. **Property-Based Testing**: Focus on properties that should hold true rather than specific scenarios.
4. **Backward Compatibility**: Ensure upgrades don't break existing functionality.
5. **Security First**: Prioritize tests that verify security properties.

## Test Types

The D-Loop Protocol uses the following test types:

### Unit Tests

- Test individual contract functions in isolation
- Located in `test/unit/` directory
- Focus on function-level behavior and edge cases

### Integration Tests

- Test interactions between multiple contracts
- Located in `test/integration/` directory
- Verify contracts work together as expected

### Backward Compatibility Tests

- Verify contract upgrades maintain backward compatibility
- Located in `test/backward-compatibility/` directory
- Ensure function signatures and event emissions remain consistent

### ABI Compatibility Tests

- Verify contract interfaces remain consistent
- Located in `test/validation/` directory
- Check function and event signatures match expected formats

### Fuzz Tests

- Property-based tests with randomized inputs
- Located in `test/foundry/` directory
- Discover edge cases and vulnerabilities

### Invariant Tests

- Verify system-wide properties hold under all conditions
- Located in `test/foundry/invariants/` directory
- Test complex interactions between contracts

### Critical Function Tests

- Focus on high-risk functions with significant impact
- Located in `test/critical/` directory
- Provide extra scrutiny for security-critical code

## Test Structure

Each test file should follow this structure:

```javascript
// For JavaScript tests
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ContractName", function () {
  // Test fixtures
  async function deployContractFixture() {
    // Setup code
    return { contract, owner, user1, ... };
  }

  describe("FunctionName", function () {
    it("should behave as expected in normal conditions", async function () {
      const { contract, owner } = await loadFixture(deployContractFixture);
      // Test code
      expect(await contract.someFunction()).to.equal(expectedValue);
    });

    it("should revert when conditions are not met", async function () {
      const { contract, user1 } = await loadFixture(deployContractFixture);
      // Test code
      await expect(contract.connect(user1).restrictedFunction())
        .to.be.revertedWith("Expected error message");
    });
  });
});
```

```solidity
// For Solidity tests (Foundry)
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../contracts/ContractName.sol";

contract ContractNameTest is Test {
    ContractName public contractName;
    address public owner;
    address public user1;
    
    function setUp() public {
        // Setup code
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        vm.prank(owner);
        contractName = new ContractName();
    }
    
    function testFunctionName() public {
        // Test code
        assertEq(contractName.someFunction(), expectedValue);
    }
    
    function testFuzz_FunctionName(uint256 randomInput) public {
        // Bound inputs to realistic values
        randomInput = bound(randomInput, minValue, maxValue);
        
        // Test code with randomized input
        assertEq(contractName.someFunction(randomInput), expectedValue);
    }
}
```

## Naming Conventions

### JavaScript Tests

- Test files: `{ContractName}.{testType}.test.js`
- Test fixtures: `deploy{ContractName}Fixture`
- Test cases: descriptive of expected behavior

### Solidity Tests

- Test files: `{ContractName}.t.sol` or `{ContractName}.{testType}.t.sol`
- Test functions: `test{FunctionName}_{Scenario}` or `testFuzz_{FunctionName}`
- Invariant tests: `invariant_{PropertyName}`

## Mock Contracts

- All mock contracts should extend `BaseMock.sol` where applicable
- Located in `test/mocks/` directory
- Follow naming convention: `Mock{ContractName}.sol`
- Document interface in contract comments
- Implement only the functionality needed for testing

## Test Fixtures

- Use fixtures to reduce redundancy in test setup
- Located in `test/fixtures/` directory
- Follow naming convention: `{category}.fixture.js`
- Return all relevant deployed contracts and accounts
- Use with `loadFixture` from hardhat-network-helpers

## Fuzz Testing

Fuzz testing uses randomized inputs to discover edge cases:

1. **Input Bounds**: Always bound fuzz inputs to realistic values
2. **Property Verification**: Focus on properties that should hold true
3. **Multiple Inputs**: Test interactions between multiple randomized inputs
4. **Edge Cases**: Pay special attention to boundary conditions

Example:

```solidity
function testFuzz_TokenTransfer(address recipient, uint256 amount) public {
    // Bound inputs
    vm.assume(recipient != address(0));
    amount = bound(amount, 1, token.balanceOf(owner));
    
    // Record initial state
    uint256 initialOwnerBalance = token.balanceOf(owner);
    uint256 initialRecipientBalance = token.balanceOf(recipient);
    
    // Execute transfer
    vm.prank(owner);
    token.transfer(recipient, amount);
    
    // Verify properties
    assertEq(token.balanceOf(owner), initialOwnerBalance - amount);
    assertEq(token.balanceOf(recipient), initialRecipientBalance + amount);
}
```

## Invariant Testing

Invariant tests verify system-wide properties:

1. **State Tracking**: Maintain tracking variables to verify invariants
2. **Handler Contracts**: Use handler contracts to manage complex interactions
3. **Depth Configuration**: Adjust invariant depth based on complexity
4. **Failure Analysis**: Carefully analyze invariant failures

Example:

```solidity
function invariant_TotalSupplyMatchesSum() public {
    uint256 totalSupply = token.totalSupply();
    uint256 sumOfBalances = 0;
    
    for (uint i = 0; i < accounts.length; i++) {
        sumOfBalances += token.balanceOf(accounts[i]);
    }
    
    assertEq(totalSupply, sumOfBalances, "Total supply must match sum of balances");
}
```

## Coverage Requirements

The D-Loop Protocol requires the following test coverage:

- **Line Coverage**: Minimum 90% for all contracts
- **Branch Coverage**: Minimum 85% for all contracts
- **Function Coverage**: 100% for all public and external functions
- **Critical Functions**: 100% line and branch coverage

Run coverage reports regularly:

```bash
# For JavaScript tests
npx hardhat coverage

# For Solidity tests
forge coverage --report lcov
```

## Continuous Integration

All tests must pass in the CI pipeline before merging:

1. **Pre-commit Hook**: Run unit tests before committing
2. **Pull Requests**: Run full test suite on pull requests
3. **Main Branch**: Run full test suite with coverage reports

The CI pipeline includes:

- Unit and integration tests
- Fuzz tests with standard parameters
- Invariant tests with standard parameters
- Coverage reports
- Gas usage reports
- Security analysis tools

## Best Practices

1. **Test Independence**: Each test should be independent of others
2. **Realistic Scenarios**: Test realistic usage scenarios
3. **Negative Tests**: Always test failure conditions
4. **Gas Optimization**: Monitor gas usage in tests
5. **Clear Assertions**: Use descriptive assertion messages
6. **Comprehensive Setup**: Ensure test setup covers all necessary conditions
7. **Clean Teardown**: Reset state between tests
8. **Documentation**: Document test purpose and approach

By following these guidelines, we ensure the D-Loop Protocol maintains high-quality, comprehensive test coverage that enhances security and reliability.
