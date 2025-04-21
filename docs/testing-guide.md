# D-Loop Protocol Testing Guide

This guide outlines the testing approach, structure, and best practices for the D-Loop Protocol.

## Table of Contents

1. [Testing Structure](#testing-structure)
2. [Test Categories](#test-categories)
3. [Testing Best Practices](#testing-best-practices)
4. [Ethers v6 Compatibility](#ethers-v6-compatibility)
5. [Mock Contracts](#mock-contracts)
6. [Test Fixtures](#test-fixtures)
7. [Running Tests](#running-tests)

## Testing Structure

The D-Loop Protocol test suite is organized into the following directory structure:

```
test/
├── unit/                   # Tests for individual contract functions in isolation
│   ├── core/               # Core contract unit tests
│   ├── token/              # Token contract unit tests
│   ├── identity/           # Identity contract unit tests
│   ├── fees/               # Fee-related contract unit tests
│   ├── governance/         # Governance contract unit tests
│   └── other/              # Other contract unit tests
├── integration/            # Tests for interactions between multiple contracts
│   └── flows/              # End-to-end workflow tests
├── security/               # Tests focused on security vulnerabilities
│   ├── reentrancy/         # Reentrancy attack tests
│   ├── access-control/     # Access control vulnerability tests
│   └── overflow/           # Arithmetic overflow tests
├── performance/            # Tests for gas optimization and performance
│   └── gas-profiles/       # Detailed gas usage analysis
├── backward-compatibility/ # Tests to ensure compatibility with previous versions
├── approvalPattern/        # Tests for token approval patterns
├── scripts/                # Test scripts organized by contract category
├── critical/               # Tests for mission-critical contract functions
├── validation/             # Tests for validating mock implementations
└── mocks/                  # Mock contract implementations for testing
```

## Test Categories

### Unit Tests

Unit tests verify the functionality of individual contract functions in isolation. They should:
- Test each function with valid inputs
- Test each function with invalid inputs
- Verify function reverts with expected error messages
- Test edge cases

Example:
```javascript
describe("DAIToken", function() {
  describe("mint", function() {
    it("should mint tokens when called by minter", async function() {
      // Test implementation
    });
    
    it("should revert when called by non-minter", async function() {
      // Test implementation
    });
  });
});
```

### Integration Tests

Integration tests verify interactions between multiple contracts. They should:
- Test complete workflows
- Verify contract interactions work as expected
- Test state changes across multiple contracts

Example:
```javascript
describe("D-AI Token Flow Integration Tests", function() {
  describe("D-AI Token Deposit → Governance → Reward Cycle", function() {
    it("Should complete full deposit→governance→reward cycle", async function() {
      // Test implementation
    });
  });
});
```

### Security Tests

Security tests focus on identifying and preventing vulnerabilities. They should:
- Test for common attack vectors
- Verify security mechanisms work as expected
- Test access control restrictions

Example:
```javascript
describe("Reentrancy Protection", function() {
  it("should prevent reentrancy attacks during token operations", async function() {
    // Test implementation
  });
});
```

### Performance Tests

Performance tests measure gas usage and optimize contract efficiency. They should:
- Measure gas usage for key operations
- Compare gas usage between different implementations
- Identify gas optimization opportunities

Example:
```javascript
describe("Gas Usage", function() {
  it("should measure gas usage for investment operations", async function() {
    // Test implementation with gas reporting
  });
});
```

## Testing Best Practices

1. **Use descriptive test names**: Test names should clearly describe what is being tested and the expected outcome.

2. **Isolate tests**: Each test should be independent and not rely on the state from previous tests.

3. **Use fixtures**: Use test fixtures to set up common test environments and reduce code duplication.

4. **Test error conditions**: Verify that functions revert with the expected error messages when called with invalid inputs.

5. **Test edge cases**: Test boundary conditions and edge cases to ensure robust contract behavior.

6. **Use consistent naming**: Follow the pattern `{Contract}.{testType}.test.js` for test files.

7. **Add comments**: Document complex test scenarios with clear comments.

8. **Use assertions effectively**: Make assertions specific and include meaningful error messages.

## Ethers v6 Compatibility

The D-Loop Protocol uses ethers.js v6 for contract interactions. Key differences from v5 include:

1. **Contract Deployment**:
```javascript
// ethers v6
const contract = await ContractFactory.deploy(arg1, arg2);
await contract.waitForDeployment();
const address = await contract.getAddress();
```

2. **BigNumber Operations**:
```javascript
// ethers v6
const sum = value1 + value2; // Native BigInt operations
```

3. **Event Handling**:
```javascript
// ethers v6
const receipt = await tx.wait();
const eventLog = receipt.logs.find(log => 
  log.topics[0] === contract.interface.getEvent("EventName").topicHash
);
const parsedLog = contract.interface.parseLog({
  topics: eventLog.topics,
  data: eventLog.data
});
```

4. **Address Handling**:
```javascript
// ethers v6
const zeroAddress = ethers.ZeroAddress;
```

## Mock Contracts

Mock contracts are used to simulate contract behavior in tests. They should:

1. Follow consistent naming: `Mock{ContractName}.sol`
2. Extend `BaseMock.sol` where applicable
3. Implement only the functions needed for testing
4. Be located in the `/test/mocks` directory

## Test Fixtures

Test fixtures provide reusable setup code for tests. They should:

1. Deploy necessary contracts
2. Set up initial state
3. Return all deployed contracts and relevant state

Example:
```javascript
async function deployDLoopProtocolFixture() {
  // Deploy contracts
  // Set up initial state
  return { contract1, contract2, owner, user1 };
}

it("should test something", async function() {
  const { contract1, contract2 } = await loadFixture(deployDLoopProtocolFixture);
  // Test implementation
});
```

## Running Tests

### Running All Tests

```bash
npx hardhat test
```

### Running Specific Test Files

```bash
npx hardhat test test/integration/token-flows/DAIToken.flow.test.js
```

### Running Tests with Gas Reporting

```bash
REPORT_GAS=true npx hardhat test
```

### Running Tests with Coverage

```bash
npx hardhat coverage
```

---

This testing guide is a living document and will be updated as the D-Loop Protocol evolves.
