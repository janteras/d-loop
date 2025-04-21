# Token Approval Pattern Tests

## Overview

This directory contains test files for validating the token approval pattern implementation across core contracts in the DLOOP protocol. The tests follow a test-driven development (TDD) approach, where test files are created first with failing tests that define the expected behavior of the contracts.

## Test Files

- **BaseApprovalTest.js**: Common utilities and helper functions shared across test files
- **AssetDAO.test.js**: Tests for token approval in the AssetDAO contract
- **ProtocolDAO.test.js**: Tests for token approval in the ProtocolDAO contract
- **FeeProcessor.test.js**: Tests for token approval in the FeeProcessor contract
- **Treasury.test.js**: Tests for token approval in the Treasury contract
- **GovernanceRewards.test.js**: Tests for token approval in the GovernanceRewards contract
- **GasUsage.test.js**: Dedicated tests for measuring gas optimization

## Test Categories

The test suites cover several categories of test cases:

1. **Security Tests**
   - Access control verification
   - Parameter validation
   - Error handling
   - Reentrancy protection

2. **Functional Tests**
   - Basic approval functionality
   - Redundant approval optimization
   - Batch approval support

3. **Gas Optimization Tests**
   - Measurement of gas savings for redundant approvals
   - Comparison between batch and individual approvals
   - Gas consistency across implementations

4. **Integration Tests**
   - Compatibility with existing protocol functionality
   - Interaction with other contracts
   - Cross-contract interactions

5. **Edge Cases**
   - Zero value approvals
   - Very large value approvals
   - Approvals with changing values

## Test-Driven Development Process

1. **Phase 1: Test Suite Setup**
   - Scaffold test structure with BaseApprovalTest.js utilities
   - Define failing tests for all required functionality
   - Document expected behavior in approval_checks.yml

2. **Phase 2: Implementation**
   - Implement token approval functionality in contracts
   - Run tests to identify issues
   - Iterate on implementation until all tests pass

3. **Phase 3: Gas Optimization Verification**
   - Run gas usage tests to measure optimization effectiveness
   - Ensure compliance with minimum gas savings requirements
   - Document optimization results

4. **Phase 4: Security Verification**
   - Run security-focused tests
   - Verify reentrancy protection
   - Test access control constraints

## Security Invariants

The tests verify these critical security invariants:

1. **Access Control**
   - Only authorized roles can approve tokens
   - Proper role separation across contract functionality

2. **Input Validation**
   - Rejects zero addresses for tokens and spenders
   - Validates array lengths in batch operations
   - Handles edge cases like zero and max values properly

3. **Reentrancy Protection**
   - Tests against mock reentrancy attacks
   - Verifies protection across all approval patterns

4. **State Consistency**
   - Verifies approval state after operations
   - Ensures approvals match expected values
   - Checks integration with existing functionality

## Running Tests

Tests can be run using the following workflow:

```bash
npx hardhat test test/approvalPattern/AssetDAO.test.js test/approvalPattern/ProtocolDAO.test.js --config hardhat.config.basic.v2.js
```

To run all approval pattern tests:

```bash
npx hardhat test test/approvalPattern/*.test.js --config hardhat.config.basic.v2.js
```

For gas usage measurement:

```bash
npx hardhat test test/approvalPattern/GasUsage.test.js --config hardhat.config.basic.v2.js
```

## Verification Checklist

Before finalizing implementation:

- [ ] All tests pass
- [ ] No duplicated files in codebase
- [ ] Registry.json properly updated
- [ ] Gas optimization targets met
- [ ] Token transfers work correctly
- [ ] Access control requirements satisfied
- [ ] All revert conditions properly tested
- [ ] Documentation updated to reflect implementation

## References

- approval_checks.yml: Configuration for expected test behavior
- ../docs/token_approval_pattern.md: Implementation documentation
- ../errors/duplicate_attempts.md: Tracking for duplicate file prevention