# D-Loop Protocol Testing Standards

## Introduction

This document establishes the official testing standards for the D-Loop Protocol. It serves as the primary reference for all testing activities and ensures consistency, quality, and comprehensive coverage across the codebase.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Directory Structure](#test-directory-structure)
3. [Test Types](#test-types)
4. [Naming Conventions](#naming-conventions)
5. [Coverage Requirements](#coverage-requirements)
6. [Foundry Configuration](#foundry-configuration)
7. [CI/CD Integration](#cicd-integration)
8. [Documentation Requirements](#documentation-requirements)
9. [Related Documents](#related-documents)

## Testing Philosophy

The D-Loop Protocol testing strategy is built on these core principles:

1. **Defense in Depth**: Multiple test types should validate critical functionality
2. **Property-Based Testing**: Focus on properties that should hold true rather than specific scenarios
3. **Comprehensive Coverage**: Every contract function should have corresponding tests
4. **Backward Compatibility**: Ensure upgrades don't break existing functionality
5. **Security First**: Prioritize tests that verify security properties
6. **Automation**: Maximize automation in the testing pipeline
7. **Performance**: Optimize test execution for developer productivity

## Test Directory Structure

The D-Loop Protocol test suite is organized as follows:

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

## Test Types

### Unit Tests

- **Purpose**: Test individual contract functions in isolation
- **Framework**: Hardhat + Chai
- **Location**: `test/unit/{category}/`
- **Naming**: `{ContractName}.unit.test.js`
- **Requirements**: 
  - Test each function with normal inputs
  - Test each function with edge case inputs
  - Test each function with invalid inputs
  - Verify all revert conditions

### Integration Tests

- **Purpose**: Test interactions between multiple contracts
- **Framework**: Hardhat + Chai
- **Location**: `test/integration/{category}/`
- **Naming**: `{Scenario}.integration.test.js`
- **Requirements**:
  - Test complete user flows
  - Verify contract interactions work as expected
  - Test realistic scenarios

### Backward Compatibility Tests

- **Purpose**: Ensure contract upgrades maintain backward compatibility
- **Framework**: Hardhat + Chai
- **Location**: `test/backward-compatibility/`
- **Naming**: `{ContractName}BackwardCompatibility.test.js`
- **Requirements**:
  - Verify function signatures remain consistent
  - Verify event signatures remain consistent
  - Verify behavior remains consistent for existing functionality

### ABI Compatibility Tests

- **Purpose**: Verify contract interfaces remain consistent
- **Framework**: Hardhat + Chai
- **Location**: `test/validation/`
- **Naming**: `{Category}.ABI.compatibility.test.js`
- **Requirements**:
  - Verify function signatures match expected formats
  - Verify event signatures match expected formats
  - Verify no breaking changes to public interfaces

### Fuzz Tests

- **Purpose**: Test contract properties with randomized inputs
- **Framework**: Foundry
- **Location**: `test/foundry/{category}/`
- **Naming**: `{ContractName}.t.sol` or `{ContractName}.fuzz.t.sol`
- **Requirements**:
  - Test properties that should hold true regardless of inputs
  - Bound inputs to realistic values
  - Test interactions between multiple randomized inputs

### Invariant Tests

- **Purpose**: Verify system-wide properties hold under all conditions
- **Framework**: Foundry
- **Location**: `test/foundry/invariants/`
- **Naming**: `{ContractName}.invariant.t.sol` or `{SystemName}.invariant.t.sol`
- **Requirements**:
  - Define clear invariants that should always hold true
  - Use handler contracts to model complex interactions
  - Track state to verify invariants

### Critical Function Tests

- **Purpose**: Provide extra scrutiny for high-risk functions
- **Framework**: Hardhat + Chai
- **Location**: `test/critical/`
- **Naming**: `CriticalFunctions{Category}.test.js`
- **Requirements**:
  - Test all possible execution paths
  - Verify security properties
  - Test with extreme input values

## Naming Conventions

### JavaScript Tests

- **Test Files**: `{ContractName}.{testType}.test.js`
- **Test Fixtures**: `deploy{ContractName}Fixture` or `{category}Fixture`
- **Test Suites**: `describe("{ContractName}", function () { ... })`
- **Test Cases**: `it("should {expected behavior}", function () { ... })`

### Solidity Tests

- **Test Files**: `{ContractName}.t.sol` or `{ContractName}.{testType}.t.sol`
- **Test Contracts**: `contract {ContractName}Test is Test { ... }`
- **Test Functions**: `function test{FunctionName}_{Scenario}() public { ... }`
- **Fuzz Tests**: `function testFuzz_{FunctionName}(uint256 input) public { ... }`
- **Invariant Tests**: `function invariant_{PropertyName}() public { ... }`

### Mock Contracts

- **Files**: `Mock{ContractName}.sol`
- **Contracts**: `contract Mock{ContractName} is BaseMock { ... }`

## Coverage Requirements

The D-Loop Protocol requires the following test coverage:

| Contract Type | Line Coverage | Branch Coverage | Function Coverage |
|---------------|--------------|----------------|-------------------|
| Core          | 95%          | 90%            | 100%              |
| Governance    | 95%          | 90%            | 100%              |
| Token         | 95%          | 90%            | 100%              |
| Fees          | 95%          | 90%            | 100%              |
| Utilities     | 90%          | 85%            | 100%              |

Additionally:
- All public and external functions must have dedicated tests
- All revert conditions must be tested
- All events must be verified
- All critical functions must have 100% line and branch coverage

## Foundry Configuration

The D-Loop Protocol uses the following Foundry profiles:

```toml
# Standard testing profile
[profile.default]
fuzz = { runs = 1000, max_test_rejects = 65536 }
invariant = { runs = 100, depth = 15, fail_on_revert = false }

# Quick testing profile for development
[profile.quick]
fuzz = { runs = 50, max_test_rejects = 10000 }
invariant = { runs = 10, depth = 5, fail_on_revert = true }

# Deep testing profile for security audits
[profile.deep]
fuzz = { runs = 10000, max_test_rejects = 1000000 }
invariant = { runs = 500, depth = 50, fail_on_revert = false }

# CI/CD pipeline profile
[profile.ci]
fuzz = { runs = 5000, max_test_rejects = 262144 }
invariant = { runs = 250, depth = 25, fail_on_revert = false }
```

## CI/CD Integration

The D-Loop Protocol testing pipeline is integrated with CI/CD:

### Pull Request Workflow

1. **Quick Tests**: Run unit tests and quick fuzz tests
2. **Coverage Check**: Verify coverage requirements are met
3. **Lint Check**: Verify code style and documentation

### Main Branch Workflow

1. **Full Test Suite**: Run all tests including deep fuzz tests
2. **Security Analysis**: Run security tools (Slither, Mythril)
3. **Coverage Report**: Generate and publish coverage report
4. **Gas Report**: Generate and publish gas usage report

### Release Workflow

1. **Full Test Suite**: Run all tests with maximum parameters
2. **Backward Compatibility**: Verify backward compatibility
3. **ABI Compatibility**: Verify ABI compatibility
4. **Security Analysis**: Run comprehensive security analysis

## Documentation Requirements

All tests must be properly documented:

### JavaScript Tests

```javascript
/**
 * @title ContractName Tests
 * @dev Tests for the ContractName contract
 * 
 * These tests focus on:
 * 1. Function A behavior
 * 2. Function B edge cases
 * 3. Integration with Contract X
 */
describe("ContractName", function () {
  /**
   * @dev Test fixture for deploying ContractName
   * @return {Object} Deployed contracts and accounts
   */
  async function deployContractFixture() {
    // Setup code
  }
  
  /**
   * @dev Tests for functionName
   * @notice This function has critical security implications
   */
  describe("functionName", function () {
    // Test cases
  });
});
```

### Solidity Tests

```solidity
/**
 * @title ContractName Fuzz Test
 * @dev Property-based tests for the ContractName contract
 * 
 * This test focuses on:
 * 1. First focus area
 * 2. Second focus area
 * 3. Third focus area
 */
contract ContractNameTest is Test {
    // Contract setup
    
    /**
     * @dev Fuzz test for specific function with randomized inputs
     * @param param1 Description of first parameter
     * @param param2 Description of second parameter
     */
    function testFuzz_FunctionName(uint256 param1, address param2) public {
        // Test code
    }
}
```

## Related Documents

For more detailed guidance, refer to these specialized documents:

- [Developer Testing Guide](./developer-guide.md) - Comprehensive guide for developers
- [Fuzz Testing Standards](./fuzz-testing-standards.md) - Detailed standards for fuzz testing
- [Stateful Fuzzing Guide](./stateful-fuzzing-guide.md) - Guide for implementing stateful fuzzing
- [Performance Optimization](./performance-optimization.md) - Strategies for optimizing test performance
- [Test Migration Guide](./test-migration-guide.md) - Guide for migrating existing tests
- [Fuzz Testing Report](../fuzz-testing-report.md) - Report on fuzz testing findings
