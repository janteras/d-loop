# D-Loop Protocol Mock Contracts Standards

## Overview
This document provides standards and guidelines for mock contract development in the D-Loop Protocol codebase.

## Mock Contract Standards

### Naming Conventions
- All mock contracts must be prefixed with `Mock` (e.g., `MockAssetDAO.sol`)
- Mock contracts should have descriptive names that clearly indicate which contract they are mocking
- Test-specific mock variants should include a descriptive suffix (e.g., `MockAssetDAOWithRevert.sol`)

### Implementation Standards
- All mock contracts must extend `BaseMock.sol` to leverage standard mock functionality
- Use `_recordFunctionCall()` to track function calls for testing purposes
- Implement the same interface as the contract being mocked
- Include all essential functions from the original contract
- Add test-specific helper functions as needed

### Organization
- All mock contracts must be placed in `/test/mocks/`
- Specialized mock variants should be grouped in appropriate subdirectories
- Mock contracts should not be duplicated across the codebase

## Current Issues to Address

### Naming Convention Issues
- `MockStandardPriceOracle.sol` should be renamed to `MockStandardizedPriceOracle.sol`

### Duplicate Functionality
- `MockPriceOracle.sol` and `MockStandardPriceOracle.sol` have overlapping functionality
- `MockAssetDAOTest.sol` and `MockAssetDAO.sol` have overlapping functionality
- `MockTokenOptimizerTest.sol` and `MockTokenApprovalOptimizer.sol` have overlapping functionality

### Missing Mocks
- `MockAINodeGovernance.sol`
- `MockGovernanceRewards.sol`
- `MockSimplifiedAdminControls.sol`

## Implementation Guidelines

### Creating a New Mock
1. Identify the contract to be mocked
2. Create a new file in `/test/mocks/` with the appropriate name
3. Extend `BaseMock.sol`
4. Implement the same interface as the original contract
5. Add test-specific helper functions as needed
6. Document the purpose and usage of the mock

### Updating Existing Mocks
1. Ensure the mock extends `BaseMock.sol`
2. Verify that all essential functions are implemented
3. Add `_recordFunctionCall()` to track function calls
4. Update documentation as needed

## Testing Guidelines
- Use mock contracts to isolate the contract under test
- Verify function calls using `getFunctionCallCount()` and `getFunctionCallArgs()`
- Test both success and failure scenarios
- Ensure all mock functions are properly tested

## Validation
Run the mock validation script to ensure compliance with these standards:
```
node scripts/validate-mocks.js
```
