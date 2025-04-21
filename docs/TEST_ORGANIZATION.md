# D-Loop Protocol Test Organization

This document outlines the test organization structure for the D-Loop Protocol, providing guidelines for organizing and implementing tests. The test suite is designed to ensure comprehensive coverage of all protocol components while maintaining a clear and consistent structure.

## Test Directory Structure

```
/test/
├── unit/                   # Unit tests for individual contracts
│   ├── core/               # Core contract tests (AssetDAO, ProtocolDAO)
│   ├── governance/         # Governance contract tests (SimplifiedAdminControls, AINodeGovernance)
│   ├── token/              # Token contract tests (DLoopToken, TokenApprovalOptimizer)
│   ├── fees/               # Fee system tests (FeeCalculator, FeeProcessor, Treasury)
│   ├── identity/           # Identity and NFT tests (SoulboundNFT, AINodeRegistry)
│   └── other/              # Miscellaneous tests that don't fit in other categories
│
├── integration/            # Integration tests between multiple contracts
│   ├── flows/              # End-to-end workflow tests
│   ├── governance/         # Governance integration tests
│   ├── fees/               # Fee system integration tests
│   └── token-flows/        # Token flow integration tests
│
├── security/               # Security-focused tests
│   ├── access-control/     # Access control tests
│   ├── reentrancy/         # Reentrancy protection tests
│   └── edge-cases/         # Edge case and boundary tests
│
├── performance/            # Performance and gas optimization tests
│   ├── gas-profiles/       # Gas usage profiles
│   ├── benchmarks/         # Performance benchmarks
│   └── optimizations/      # Optimization verifications
│
├── approvalPattern/        # Token approval pattern tests
│
├── backward-compatibility/ # Backward compatibility tests
│
├── critical/               # Critical function tests
│
├── validation/             # Validation tests for interfaces and mock implementations
│   ├── ABI.compatibility.test.js  # ABI compatibility tests
│   └── mock.validation.test.js    # Mock contract validation tests
│
├── fixtures/               # Test fixtures and shared setup
│   ├── protocol.fixture.js # Full protocol deployment fixture
│   ├── token.fixture.js    # Token-specific fixtures
│   └── governance.fixture.js # Governance-specific fixtures
│
├── helpers/                # Test helper functions
│   ├── error-handlers.js   # Standardized error handling
│   └── gas-measurement.js  # Gas usage measurement utilities
│
├── mocks/                  # Mock contracts for testing
│   ├── base/               # Base mock contracts (BaseMock)
│   ├── aggregator/         # Specialized mock contracts for price feeds
│   └── README.md           # Documentation for mock contract standards
│
└── utils/                  # Utility functions for testing
    ├── constants.js        # Test constants and thresholds
    └── formatters.js       # Output formatting utilities
```

## Test Naming Convention

All test files should follow this naming pattern:

```
{ContractName}.{testType}.test.js
```

Where:
- `ContractName` is the name of the contract being tested (e.g., `AssetDAO`, `FeeCalculator`)
- `testType` indicates the type of test (e.g., `unit`, `integration`, `security`, `performance`)

Examples:
- `AssetDAO.unit.test.js` - Unit tests for the AssetDAO contract
- `TokenApprovalOptimizer.performance.test.js` - Performance tests for the TokenApprovalOptimizer
- `AINodeRegistry.integration.test.js` - Integration tests for the AINodeRegistry

## Mock Contract Standards

### General Requirements

All mock contracts must adhere to the following standards:

1. **Naming Convention**: Use `Mock{ContractName}.sol` format consistently
   - Example: `MockPriceOracle.sol` instead of `StandardMockPriceOracle.sol`
   - Avoid prefixes like `Standard`, `Test`, or `Fake` in the contract name

2. **Base Class Extension**: Extend `BaseMock.sol` for all mock contracts
   - Import the base mock: `import "./base/BaseMock.sol";`
   - Inherit from BaseMock: `contract MockContractName is BaseMock, IContractName`

3. **Function Call Recording**: Use `_recordFunctionCall()` in all mock functions
   ```solidity
   function mockFunction(uint256 param) external override returns (bool) {
       _recordFunctionCall("mockFunction", param);
       return mockReturnValue;
   }
   ```

4. **Constructor Implementation**: Always call the BaseMock constructor
   ```solidity
   constructor() BaseMock() {}
   ```

5. **Interface Compliance**: Implement all functions from the corresponding interface
   - Include all required functions with matching signatures
   - Provide meaningful mock implementations for each function

6. **Location**: Place all mock contracts in the `/test/mocks/` directory
   - Base mock contracts go in `/test/mocks/base/`
   - Specialized mocks (like price feeds) go in `/test/mocks/aggregator/`

### Mock Implementation Guidelines

1. **State Management**:
   - Use public variables to track mock state
   - Provide setter functions to control mock behavior
   - Example: `function setMockPrice(uint256 _price) external { mockPrice = _price; }`

2. **Error Simulation**:
   - Include functions to trigger specific error conditions
   - Example: `function setMockShouldRevert(bool _shouldRevert) external { shouldRevert = _shouldRevert; }`

3. **Event Emission**:
   - Emit the same events as the real contract
   - Use identical event signatures and parameters

### Validation

Mock contracts should be validated using the validation script to ensure they implement all required standards:

```bash
node scripts/validate-mock-implementations.js
```

This script checks for:
- Proper naming convention
- BaseMock extension
- Function call recording
- Constructor implementation
- Interface compliance

## Test Coverage Requirements

The D-Loop Protocol maintains high test coverage standards:

1. **Line Coverage**: 
   - Core Contracts: Minimum 95%
   - Governance Contracts: Minimum 90%
   - Utility Contracts: Minimum 85%

2. **Function Coverage**: 
   - Public/External Functions: 100%
   - Critical Functions: 100%
   - Internal Functions: 90%

3. **Branch Coverage**: 
   - Security-Critical Logic: Minimum 95%
   - General Conditional Logic: Minimum 85%

4. **Statement Coverage**:
   - Access Control Logic: 100%
   - Error Handling: 100%
   - State Transitions: 95%

### Coverage Verification

Coverage can be checked using:

```bash
npx hardhat coverage
```

### Coverage Report Analysis

After running the coverage command, analyze the report to identify gaps:

1. **Uncovered Functions**: Prioritize adding tests for any uncovered public/external functions
2. **Branch Coverage Gaps**: Focus on complex conditional logic with low coverage
3. **Critical Path Coverage**: Ensure all critical paths (like fund transfers, governance actions) have 100% coverage

### Coverage Exemptions

The following may be exempted from coverage requirements with proper documentation:

1. Unreachable defensive code (e.g., additional checks that can never fail due to prior validations)
2. Test-only code or debugging functions
3. External library code that is already well-tested

## Test Categories

### Unit Tests
Test individual contract functions in isolation with these characteristics:
- Mock all external dependencies using standardized mock contracts
- Test each function's success and failure paths independently
- Verify state changes, event emissions, and return values
- Focus on edge cases and boundary conditions

### Integration Tests
Test interactions between multiple contracts with these characteristics:
- Verify end-to-end workflows across contract boundaries
- Test realistic user journeys from start to finish
- Validate complex state transitions involving multiple contracts
- Ensure proper event propagation between contracts

### Security Tests
Focus on security vulnerabilities with these characteristics:
- Test access control mechanisms for all privileged functions
- Verify reentrancy protection on state-changing functions
- Test for integer overflow/underflow vulnerabilities
- Validate input validation and error handling
- Simulate attack vectors and exploit attempts

### Performance Tests
Measure gas consumption with these characteristics:
- Profile gas usage for all critical functions
- Establish baseline measurements for gas consumption
- Compare optimizations against baseline implementations
- Verify gas usage stays within acceptable thresholds
- Test batch operations for gas efficiency

### Validation Tests
Verify contract interfaces and implementations with these characteristics:
- Test ABI compatibility to ensure consistent interfaces
- Validate mock implementations against real contracts
- Verify event signatures match expected formats
- Ensure no breaking changes are introduced to interfaces

### Backward Compatibility Tests
Ensure new versions maintain compatibility with these characteristics:
- Test upgrade paths from previous versions
- Verify state migrations preserve data integrity
- Validate that existing integrations continue to work
- Test against previous contract ABIs

## Test Implementation Guidelines

### 1. Test Structure

Each test file should follow this structure:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContractName", function () {
  // Test variables
  let contract, owner, user1, user2;
  
  // Setup before each test
  beforeEach(async function () {
    // Deploy contracts and set up test environment
  });
  
  describe("Function Category", function () {
    it("should do something specific", async function () {
      // Test implementation
    });
    
    // More tests...
  });
  
  // More function categories...
});
```

### 2. Test Organization

Organize tests by function categories and scenarios:

- Group related functions together
- Test happy paths first, then edge cases
- Include failure cases to verify proper error handling
- Test events and state changes

### 3. Test Naming

Use descriptive test names that clearly indicate what is being tested:

- "should revert when caller is not admin"
- "should update state correctly when valid parameters are provided"
- "should emit the correct event with proper parameters"

### 4. Documentation

All test files should include a header comment explaining what is being tested:

```javascript
/**
 * @title ContractName Tests
 * @dev Tests for the ContractName contract functionality
 * - Function category 1
 * - Function category 2
 */
```

### 5. Gas Optimization Tests

For performance tests, include gas usage assertions:

```javascript
it("should optimize gas usage", async function () {
  const tx = await contract.someFunction();
  const receipt = await tx.wait();
  expect(receipt.gasUsed).to.be.at.most(expectedGasLimit);
});
```

### 6. Test Categories in Detail

#### Unit Tests
- Test individual functions in isolation
- Mock all external dependencies
- Focus on function-level behavior
- Verify error conditions and edge cases

#### Integration Tests
- Test interactions between multiple contracts
- Verify end-to-end workflows
- Test contract state transitions
- Validate event emissions

#### Security Tests
- Test access control mechanisms
- Verify reentrancy protection
- Test boundary conditions
- Validate input validation

### Performance Tests
- Measure gas consumption
- Compare optimizations
- Benchmark critical functions
- Validate gas efficiency

### Deployment Tests
- Verify deployment scripts
- Test initialization parameters
- Validate contract addresses
- Check network-specific configurations

## Test Implementation Guidelines

### Test Structure

Each test file should follow this structure:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ContractName", function() {
  // Test variables
  let contract;
  let owner;
  let user1;
  let user2;
  
  // Setup before each test
  beforeEach(async function() {
    // Deploy contracts
    // Setup test environment
  });
  
  // Test cases grouped by function or feature
  describe("Function: functionName", function() {
    it("should do something when condition", async function() {
      // Test implementation
    });
    
    it("should revert when condition", async function() {
      // Test implementation
    });
  });
});
```

### Test Coverage Requirements

- Core Contracts: 95% coverage
- Critical Functions: 100% coverage
- Governance Contracts: 90% coverage
- Utility Functions: 85% coverage

### Documentation

Each test file should include:
- Brief description of what's being tested
- Any special setup requirements
- Test coverage metrics
- Known limitations or edge cases not covered

## Foundry Integration for Fuzz Testing

Integrating Foundry provides powerful property-based testing capabilities to discover edge cases and vulnerabilities that might be missed by traditional unit tests.

### Setup Instructions

1. **Install Foundry**:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Initialize Foundry in the Project**:
   ```bash
   forge init --no-commit
   ```

3. **Configure Foundry**:
   Create a `foundry.toml` file with the following configuration:
   ```toml
   [profile.default]
   src = 'contracts'
   test = 'test/foundry'
   out = 'out'
   libs = ['node_modules']
   solc_version = '0.8.24'
   optimizer = true
   optimizer_runs = 200
   ```

4. **Create Foundry Test Directory**:
   ```bash
   mkdir -p test/foundry/core
   mkdir -p test/foundry/governance
   mkdir -p test/foundry/token
   ```

### Writing Fuzz Tests

Fuzz tests should focus on critical functions that handle user funds, access control, or complex state transitions:

```solidity
// test/foundry/core/AssetDAO.t.sol
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/core/AssetDAO.sol";

contract AssetDAOTest is Test {
    AssetDAO public assetDAO;
    
    function setUp() public {
        // Setup code
    }
    
    function testFuzz_Invest(uint256 amount) public {
        // Bound the input to realistic values
        amount = bound(amount, 1, 1e30);
        
        // Test investment with fuzzed amount
        // ...
    }
}
```

### Running Fuzz Tests

```bash
# Run all fuzz tests
forge test

# Run specific test file
forge test --match-path test/foundry/core/AssetDAO.t.sol

# Increase fuzz runs for more thorough testing
forge test --fuzz-runs 10000
```

### Integration with Existing Test Suite

Foundry tests should complement, not replace, the existing Hardhat test suite:

1. Use Hardhat for unit tests, integration tests, and gas profiling
2. Use Foundry for property-based testing and invariant testing
3. Run both test suites in CI/CD pipelines
4. Combine coverage reports from both test suites

## Continuous Integration

The test suite should be integrated with CI/CD pipelines to ensure consistent quality and prevent regressions.

### CI Pipeline Configuration

The CI pipeline should perform the following tasks:

1. **Test Execution**:
   - Run unit tests on every commit
   - Run integration tests on pull requests
   - Run full test suite including performance tests before merges
   - Execute backward compatibility tests on version changes

2. **Coverage Analysis**:
   - Generate coverage reports for all test runs
   - Fail builds that don't meet minimum coverage thresholds
   - Track coverage trends over time
   - Highlight newly uncovered code in pull requests

3. **Gas Profiling**:
   - Run gas profiling tests on all pull requests
   - Compare gas usage against established baselines
   - Fail builds that exceed gas thresholds for critical functions
   - Generate gas usage reports for review

4. **Contract Validation**:
   - Verify ABI compatibility on interface changes
   - Validate mock implementations against interfaces
   - Check for breaking changes in public interfaces
   - Ensure backward compatibility with previous versions

5. **Security Scanning**:
   - Run automated security analysis tools
   - Check for common vulnerabilities
   - Validate access control implementations
   - Perform static analysis for code quality

### CI/CD Integration Points

- **GitHub Actions**: Primary CI/CD platform for automated testing
- **Hardhat**: Test execution and coverage reporting
- **Slither/Mythril**: Security analysis integration
- **Foundry**: Fuzz testing and property-based testing
- **Gas Reporter**: Gas usage tracking and reporting
