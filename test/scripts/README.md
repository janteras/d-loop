# DLOOP Protocol Test Suite

This directory contains comprehensive tests for the DLOOP Protocol smart contracts. The test suite is designed to ensure complete coverage of all contract functionality, with a specific focus on role-based access control, integration points, and security.

## Directory Structure

- **approvalPattern/**: Tests for the approval pattern implementations
- **backward-compatibility/**: Tests for backward compatibility with previous versions
- **core/**: Tests for core protocol contracts (AssetDAO, ProtocolDAO)
- **fees/**: Tests for fee-related contracts (FeeCalculator, Treasury)
- **gas/**: Gas usage profiling tests
- **identity/**: Tests for identity-related contracts (SoulboundNFT)
- **integration/**: Integration tests for ensuring contracts work together
- **oracles/**: Tests for oracle-related contracts (PriceOracle)
- **utils/**: Utility modules for testing

## Testing Strategies

### Unit Testing

Unit tests focus on individual contract functionality, ensuring that each contract works correctly in isolation. These tests verify:

1. Contract initialization with correct parameters
2. Role-based access control for all functions
3. Business logic for core functionality
4. Error handling for invalid inputs
5. Event emission for key operations

### Integration Testing

Integration tests focus on contract interactions, ensuring that contracts work together as a cohesive system. These tests verify:

1. Contract interfaces are compatible
2. Role-based access control works across contract boundaries
3. Integration points function correctly under various scenarios
4. Event handling across contract interactions

### Gas Usage Profiling

Gas usage tests focus on measuring the gas cost of various operations, helping to identify optimization opportunities. These tests measure:

1. Gas cost for common operations
2. Gas cost for role management operations
3. Gas efficiency of different implementation approaches

## Test Configuration

Multiple Hardhat configurations are available to support different testing needs:

- **hardhat.config.simple.js**: Simplified configuration for basic tests
- **hardhat.config.gas.js**: Configuration with gas reporting enabled
- **hardhat.config.basic.v2.js**: Basic configuration for most tests

## Ethers v6 Compatibility

All tests use Ethers v6, which introduces several changes from Ethers v5. To ensure compatibility, we provide several shim files:

- **ethers-v6-shim.js**: Basic compatibility shim for Ethers v6
- **ethers-v6-shim.enhanced.js**: Enhanced shim with additional compatibility fixes
- **ethers-v6-shim.stable.js**: Stable shim with reliable compatibility fixes

## Testing Utilities

Several utilities are provided to support testing:

- **direct-contract-deployer.js**: Reliable contract deployment utility
- **ethers-helpers.js**: Helpers for common Ethers v6 operations
- **test-utils.js**: General testing utilities

## SoulboundNFT Integration Testing

SoulboundNFT integration tests focus on role management and integration with AINodeRegistry. These tests verify:

1. Proper role assignment during SoulboundNFT deployment
2. AINodeRegistry can mint tokens when it has MINTER_ROLE
3. Role revocation prevents unauthorized minting
4. ABI compatibility between contracts

## FeeCalculator and Treasury Integration Testing

FeeCalculator and Treasury integration tests focus on fee calculation and treasury operations. These tests verify:

1. Fee calculation based on PriceOracle data
2. Treasury operations with proper role-based access control
3. Fee updates when price or fee percentage changes

## Running Tests

To run all tests:

```bash
npx hardhat test --config hardhat.config.simple.js
```

To run a specific test:

```bash
npx hardhat test test/integration/Treasury.FeeCalculator.integration.js --config hardhat.config.simple.js
```

To run gas profiling tests:

```bash
npx hardhat test --network hardhat --config hardhat.config.gas.js
```

## Test Coverage

The test suite aims for 100% coverage of critical methods and at least 85% coverage for approval functionality. To generate a coverage report:

```bash
npx hardhat coverage
```

## Solhint Security Checks

Solhint security checks are available to verify contract security. To run security checks:

```bash
npx solhint -c .solhint-security.json 'contracts/**/*.sol'
```