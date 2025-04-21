# D-Loop Protocol Mock Contract Standards

## Overview

This document outlines the standards and best practices for mock contracts in the D-Loop Protocol codebase.

## Mock Contract Guidelines

### Naming Conventions

- All mock contracts should be named with the `Mock` prefix followed by the name of the contract they are mocking
- Example: `MockAssetDAO.sol` for a mock of `AssetDAO.sol`

### Location

- All mock contracts must be located in the `/contracts/mocks/` directory
- No mock contracts should be present in the `/test/mocks/` directory or any other directory

### Implementation

- All mock contracts should inherit from `BaseMock.sol`
- Mock contracts should implement the same interface as the contract they are mocking
- Function calls should be tracked using the `_recordFunctionCall` method from `BaseMock.sol`

### Example

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../../interfaces/IAssetDAO.sol";

/**
 * @title MockAssetDAO
 * @dev Mock implementation of the AssetDAO contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockAssetDAO is IAssetDAO, BaseMock {
    // Implementation details...
    
    function someFunction(uint256 param) external override {
        _recordFunctionCall(
            "someFunction",
            abi.encode(param)
        );
        // Mock implementation...
    }
}
```

## Usage in Tests

When using mock contracts in tests, import them from the `/test/mocks/` directory:

```javascript
const MockAssetDAO = await ethers.getContractFactory("MockAssetDAO");
const mockAssetDAO = await MockAssetDAO.deploy();
```

## Validation

Run the mock validation script to ensure all mock contracts follow these standards:

```bash
node scripts/validate-mocks.js
```

This script will check for:
- Proper naming conventions
- Correct location
- No duplicate implementations

## Troubleshooting

If you encounter issues with mock contracts:

1. Check that the mock contract follows the naming convention
2. Ensure the mock contract inherits from `BaseMock.sol`
3. Verify that all function calls are tracked using `_recordFunctionCall`
4. Make sure the mock contract is located in the `/test/mocks/` directory
