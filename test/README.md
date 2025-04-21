# D-Loop Protocol Testing Guide

This document outlines the testing structure, naming conventions, and best practices for the D-Loop Protocol test suite.

## Test Directory Structure

```
test/
├── unit/               # Unit tests for individual contract components
├── integration/        # Integration tests for contract interactions
├── security/           # Security-focused tests (Echidna, Manticore)
├── deployment/         # Deployment and migration tests
├── performance/        # Gas profiling and benchmark tests
├── validation/         # ABI compatibility and interface validation
├── fixtures/           # Reusable test fixtures
├── mocks/              # Mock contract implementations
└── foundry/            # Foundry-based tests including invariant tests
```

## Test Naming Conventions

All test files should follow the format: `{Contract}.{testType}.test.js`

Examples:
- `ProtocolDAO.unit.test.js` - Unit tests for ProtocolDAO
- `Treasury.integration.test.js` - Integration tests for Treasury
- `AINodeRegistry.gas.test.js` - Gas profiling for AINodeRegistry
- `SoulboundNFT.deployment.test.js` - Deployment tests for SoulboundNFT

For Solidity-based tests (Foundry):
- `{Contract}.t.sol` - Standard tests
- `{Contract}.invariant.t.sol` - Invariant tests

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run security tests
npm run test:security

# Run deployment tests
npm run test:deployment

# Run performance tests
npm run test:performance

# Run just the gas usage tests
npm run test:performance:gas

# Run just the benchmark tests
npm run test:performance:benchmark

# Generate coverage reports
npm run coverage
npm run test:performance

# Run just the gas usage tests
npm run test:performance:gas

# Run just the benchmark tests
npm run test:performance:benchmark

# Generate coverage reports for performance tests
# D-Loop Protocol Test Suite

This directory contains all test files for the D-Loop Protocol. The structure is organized according to test types and contract categories.

## Directory Organization

```
/test/
├── unit/                   # Unit tests for individual contracts
│   ├── core/               # Core contract tests
│   ├── governance/         # Governance contract tests
│   ├── token/              # Token contract tests
│   ├── fees/               # Fee system tests
│   └── identity/           # Identity and NFT tests
│
├── integration/            # Integration tests between multiple contracts
│   ├── flows/              # End-to-end workflow tests
│   ├── governance/         # Governance integration tests
│   └── fees/               # Fee system integration tests
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
├── deployment/             # Deployment tests
│   ├── sepolia/            # Sepolia testnet deployment tests
│   └── mainnet/            # Mainnet deployment tests
│
├── backward-compatibility/ # Tests for backward compatibility
│
├── fixtures/               # Test fixtures and shared setup
│
├── helpers/                # Test helper functions
│
├── mocks/                  # Mock contracts for testing
│   ├── base/               # Base mock contracts
│   └── [contract-type]/    # Specialized mock contracts
│
└── utils/                  # Utility functions for testing
```

## Test Naming Convention

All test files should follow this naming pattern:

```
{ContractName}.{testType}.test.js
```

Examples:
- `ProtocolDAO.unit.test.js`
- `AssetDAO.integration.test.js`
- `DLoopToken.security.test.js`
- `AINodeRegistry.performance.test.js`
    - `/scripts/performance/helpers` - Shared utilities for performance testing
  - Naming patterns:
    - `{ContractName}.performance.test.js` - Gas usage tests
    - `{ContractName}.benchmark.js` - Detailed benchmarks
  - Tests interactions between multiple contracts
  - Naming pattern: `{Feature}.integration.test.js`

- `/security` - Security and vulnerability tests
  - Focus on attack vectors and edge cases
  - Includes reentrancy, access control, and other security tests
  - Naming pattern: `{ContractName}.security.test.js`

## Running Performance Tests

```bash
# Run all performance tests with the new structure
npm run test:performance

# Run just the gas usage tests
npm run test:performance:gas

# Run just the benchmark tests
npm run test:performance:benchmark

# Generate coverage reports for performance tests
npm run coverage:performance
```
  - Naming pattern: `{ContractName}.gas.test.js`

- `/deployment` - Deployment scripts and configuration tests
  - Deployment sequence verification
  - Configuration validation
  - Naming pattern: `{Stage}.deploy.test.js`

- `/fixtures` - Shared test fixtures and utilities
  - Common setup functions
  - Shared testing utilities
  - Test helpers and mock data

## Mock Contracts

All mock contracts are located in the `/mocks` directory and follow these conventions:

1. Naming Convention:
   - All mock contracts must start with "Mock" prefix
   - Example: `MockPriceOracle.sol`

2. Base Mock:
   - Most mocks should extend `BaseMock.sol`
   - Located in `/mocks/base/BaseMock.sol`

3. Documentation:
   - Each mock must include inline documentation
   - Purpose and usage examples must be provided
   - Override behaviors must be documented

## Coverage Requirements

- Core Contracts: 95% line coverage minimum
- Critical Functions: 100% coverage required
- Uncovered code must be documented with TODO comments

## CI Integration

### Workflow Artifacts
1. `gas-report.txt` - Available after integration tests
2. `lcov.info` - Uploaded to Codecov

### Failure Handling
- Unit test failures stop parallel jobs immediately
- Integration tests only run after unit tests pass

## Running Tests

```bash
# Run all tests
npm test

# Run specific test category
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# Generate coverage report
npm run coverage
```

## Migration Status

The test suite is currently being migrated from the legacy structure to this new organization. During the migration:

1. New tests should be written in the new structure
2. Existing tests will be gradually moved to appropriate directories
3. Both structures will coexist until migration is complete

## Contributing

When adding new tests:

1. Follow the appropriate naming convention
2. Add tests to the correct directory based on their type
3. Include proper documentation and descriptions
4. Ensure coverage requirements are met
