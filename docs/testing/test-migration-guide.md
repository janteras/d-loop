# D-Loop Protocol Test Migration Guide

## Introduction

This guide provides instructions for migrating existing tests to the new D-Loop Protocol testing framework. The new framework emphasizes a structured approach with specialized test types, including fuzz testing and invariant testing.

## Table of Contents

1. [New Testing Structure](#new-testing-structure)
2. [Migration Steps](#migration-steps)
3. [Converting Unit Tests to Fuzz Tests](#converting-unit-tests-to-fuzz-tests)
4. [Creating Invariant Tests](#creating-invariant-tests)
5. [Using Test Fixtures](#using-test-fixtures)
6. [Backward Compatibility Testing](#backward-compatibility-testing)
7. [Migration Checklist](#migration-checklist)

## New Testing Structure

The D-Loop Protocol testing framework is now organized as follows:

```
test/
├── unit/                    # Unit tests for individual contract functions
│   ├── core/                # Core protocol contracts
│   ├── governance/          # Governance contracts
│   ├── token/               # Token contracts
│   └── fees/                # Fee-related contracts
├── integration/             # Integration tests for contract interactions
│   ├── token-flows/         # Token flow integration tests
│   └── governance-flows/    # Governance flow integration tests
├── validation/              # Interface validation tests
│   └── ABI.compatibility.test.js  # ABI compatibility tests
├── backward-compatibility/  # Backward compatibility tests
├── critical/                # Tests for critical functions
├── fixtures/                # Reusable test fixtures
├── mocks/                   # Mock contracts for testing
└── foundry/                 # Foundry-based fuzz and invariant tests
    ├── core/                # Core contract fuzz tests
    ├── governance/          # Governance contract fuzz tests
    ├── fees/                # Fee-related contract fuzz tests
    ├── token/               # Token contract fuzz tests
    ├── integration/         # Integration fuzz tests
    └── invariants/          # System-wide invariant tests
```

## Migration Steps

Follow these steps to migrate existing tests to the new framework:

### 1. Identify Test Type

Determine the appropriate category for each existing test:

- **Unit Tests**: Tests for individual contract functions
- **Integration Tests**: Tests for interactions between contracts
- **Validation Tests**: Tests for interface compatibility
- **Critical Tests**: Tests for high-risk functions

### 2. Move to Appropriate Directory

Move each test file to the appropriate directory based on its type and the contract it tests:

```bash
# Example: Move a ProtocolDAO unit test
mv test/ProtocolDAO.test.js test/unit/core/ProtocolDAO.test.js

# Example: Move a token integration test
mv test/TokenIntegration.test.js test/integration/token-flows/TokenIntegration.test.js
```

### 3. Update Imports and Paths

Update import paths in the test files to reflect the new structure:

```javascript
// Old import
const { ProtocolDAO } = require("../contracts/core/ProtocolDAO");

// New import
const { ProtocolDAO } = require("../../../contracts/core/ProtocolDAO");
```

### 4. Use Test Fixtures

Refactor tests to use the new test fixtures:

```javascript
// Old setup
beforeEach(async function () {
  // Setup code
});

// New setup using fixtures
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployProtocolFixture() {
  // Setup code
  return { protocolDAO, owner, user1, ... };
}

describe("ProtocolDAO", function () {
  it("should work correctly", async function () {
    const { protocolDAO, owner } = await loadFixture(deployProtocolFixture);
    // Test code
  });
});
```

### 5. Update Naming Conventions

Update test file names to follow the new conventions:

```
{ContractName}.{testType}.test.js
```

Example:
```
ProtocolDAO.unit.test.js
GovernanceRewards.integration.test.js
```

## Converting Unit Tests to Fuzz Tests

Convert traditional unit tests to fuzz tests for better coverage:

### JavaScript Unit Test

```javascript
it("should transfer tokens correctly", async function () {
  const { token, owner, user1 } = await loadFixture(deployTokenFixture);
  
  // Test with specific values
  await token.transfer(user1.address, 100);
  expect(await token.balanceOf(user1.address)).to.equal(100);
});
```

### Solidity Fuzz Test

```solidity
function testFuzz_Transfer(uint256 amount) public {
  // Bound input to realistic values
  amount = bound(amount, 1, token.balanceOf(owner));
  
  // Record initial state
  uint256 initialOwnerBalance = token.balanceOf(owner);
  uint256 initialRecipientBalance = token.balanceOf(user1);
  
  // Execute transfer
  vm.prank(owner);
  token.transfer(user1, amount);
  
  // Verify properties
  assertEq(token.balanceOf(owner), initialOwnerBalance - amount);
  assertEq(token.balanceOf(user1), initialRecipientBalance + amount);
}
```

## Creating Invariant Tests

Create invariant tests from existing integration tests:

### JavaScript Integration Test

```javascript
it("should maintain total supply", async function () {
  const { token, owner, user1 } = await loadFixture(deployTokenFixture);
  
  const initialTotalSupply = await token.totalSupply();
  
  // Perform multiple operations
  await token.transfer(user1.address, 100);
  await token.connect(user1).transfer(owner.address, 50);
  
  // Check total supply hasn't changed
  expect(await token.totalSupply()).to.equal(initialTotalSupply);
});
```

### Solidity Invariant Test

```solidity
function invariant_TotalSupplyConstant() public {
  assertEq(token.totalSupply(), INITIAL_SUPPLY);
}
```

## Using Test Fixtures

Replace repetitive setup code with fixtures:

### Old Approach

```javascript
describe("ProtocolDAO", function () {
  let protocolDAO;
  let owner;
  let user1;
  
  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy();
    await protocolDAO.initialize(
      3 days,
      1 days,
      10,
      owner.address,
      treasury.address
    );
  });
  
  it("test 1", async function () {
    // Test code
  });
  
  it("test 2", async function () {
    // Test code
  });
});
```

### New Approach with Fixtures

```javascript
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ProtocolDAO", function () {
  async function deployProtocolFixture() {
    const [owner, user1] = await ethers.getSigners();
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy();
    await protocolDAO.initialize(
      3 days,
      1 days,
      10,
      owner.address,
      treasury.address
    );
    
    return { protocolDAO, owner, user1 };
  }
  
  it("test 1", async function () {
    const { protocolDAO, owner } = await loadFixture(deployProtocolFixture);
    // Test code
  });
  
  it("test 2", async function () {
    const { protocolDAO, user1 } = await loadFixture(deployProtocolFixture);
    // Test code
  });
});
```

## Backward Compatibility Testing

Ensure backward compatibility tests follow the new structure:

```javascript
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("GovernanceRewards Backward Compatibility", function () {
  async function deployContractsFixture() {
    // Deploy previous version
    const PreviousGovernanceRewards = await ethers.getContractFactory("MockPreviousGovernanceRewards");
    const previousGovernanceRewards = await PreviousGovernanceRewards.deploy();
    
    // Deploy current version
    const CurrentGovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const currentGovernanceRewards = await CurrentGovernanceRewards.deploy(
      token.address,
      admin.address,
      treasury.address
    );
    
    return { previousGovernanceRewards, currentGovernanceRewards };
  }
  
  it("should maintain function signatures", async function () {
    const { previousGovernanceRewards, currentGovernanceRewards } = await loadFixture(deployContractsFixture);
    
    // Compare function signatures
    const previousABI = previousGovernanceRewards.interface.format();
    const currentABI = currentGovernanceRewards.interface.format();
    
    // Verify key functions exist with same signatures
    expect(currentABI).to.include(previousABI.find(item => item.includes("distributeRewards")));
    expect(currentABI).to.include(previousABI.find(item => item.includes("claimRewards")));
  });
});
```

## Migration Checklist

Use this checklist to ensure a complete migration:

- [ ] Move test files to appropriate directories
- [ ] Update import paths
- [ ] Refactor to use test fixtures
- [ ] Update naming conventions
- [ ] Convert unit tests to fuzz tests where beneficial
- [ ] Create invariant tests for system properties
- [ ] Update backward compatibility tests
- [ ] Verify all tests pass in the new structure
- [ ] Update CI/CD configuration for the new structure
- [ ] Document any changes to testing approach

## Conclusion

By following this migration guide, you can successfully transition existing tests to the new D-Loop Protocol testing framework. The new structure provides better organization, more comprehensive testing through fuzz and invariant tests, and improved maintainability through test fixtures.
