# DLOOP Protocol Integration Tests

This directory contains integration tests for the DLOOP Protocol smart contracts. These tests ensure that contract components interact correctly with each other and maintain proper access control across all integration points.

## Overview

The integration tests are designed to verify:

1. Role-based access control functions correctly across all contracts
2. All contracts maintain proper ABI compatibility with each other
3. Integration points between contracts function as expected
4. Contract behavior with real-world scenarios involving multiple contracts

## Test Files

### SoulboundNFT.role.integration.js

This test file focuses on role management and integration of the SoulboundNFT contract with AINodeRegistry. It verifies:

- Proper role assignment during SoulboundNFT deployment
- Role-based access control for all key functions
- Role management operations (grant, revoke, renounce)
- Integration compatibility with AINodeRegistry

Key tests include:
- Verifying that AINodeRegistry can mint tokens when it has the MINTER_ROLE
- Testing role revocation prevents unauthorized minting

### ABI.compatibility.test.js

This test file focuses on ensuring ABI compatibility between all contracts in the protocol. It verifies:

- Core interface detection using EIP-165
- Role management method compatibility
- Event compatibility
- Error handling compatibility
- Integration function testing

Key tests include:
- Verifying that contracts correctly implement expected interfaces
- Ensuring function signatures are compatible for integration
- Testing event signatures for integration compatibility

### Treasury.FeeCalculator.integration.js

This test file focuses on the integration between Treasury, FeeCalculator, and PriceOracle contracts. It verifies:

- Proper role configuration across all contracts
- Configuration integrity between contracts
- Fee calculation accuracy using price oracle data
- Treasury operations with appropriate role-based access control

Key tests include:
- Ensuring fee calculations update correctly when price or fee percentage changes
- Verifying deposit and withdrawal operations function as expected
- Testing role-based access control for treasury operations

## Running the Tests

The integration tests use standalone test runners to avoid issues with Hardhat's network providers. You can run them using either of the following methods:

### Method 1: Using Hardhat with the Simple Configuration

```bash
npx hardhat test test/integration/Treasury.FeeCalculator.integration.js --config hardhat.config.simple.js
```

### Method 2: Using Standalone Node.js Runner

```bash
npx hardhat compile && (npx hardhat node & sleep 5 && node test/integration/SoulboundNFT.role.integration.js)
```

## Utilities

The integration tests use several utility libraries:

- `test/utils/direct-contract-deployer.js` - Provides reliable contract deployment utilities
- `test/utils/ethers-helpers.js` - Contains helper functions for Ethers v6 compatibility

## Adding New Integration Tests

When adding new integration tests, follow these guidelines:

1. Use the `direct-contract-deployer.js` utility for deploying contracts
2. Use the `ethers-helpers.js` utility for common operations
3. Verify role assignment and role-based access control
4. Check event emission for key operations
5. Verify function behavior with both valid and invalid inputs
6. Test integration points under various scenarios

## Contract Dependencies

The integration tests focus on verifying the following contract dependencies:

- SoulboundNFT ↔ AINodeRegistry
- PriceOracle ↔ FeeCalculator 
- FeeCalculator ↔ Treasury
- Treasury ↔ Token contracts

## Ethers v6 Compatibility

All integration tests are designed to work with Ethers v6, which is the latest version of the Ethers.js library. The helper utilities ensure proper compatibility with BigInt values and other Ethers v6 features.