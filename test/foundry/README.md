# D-Loop Protocol Fuzz Testing Framework

This directory contains the fuzz testing framework for the D-Loop protocol, implemented using Foundry.

## Overview

The fuzz testing framework is organized into the following directories:

- `core/`: Fuzz tests for core contracts (ProtocolDAO, AssetDAO)
- `governance/`: Fuzz tests for governance contracts (AINodeRegistry, GovernanceRewards)
- `fees/`: Fuzz tests for fee-related contracts (FeeProcessor)
- `token/`: Fuzz tests for token contracts (DLoopToken, DAIToken)
- `integration/`: Integration fuzz tests for contract interactions
- `invariants/`: Invariant tests for system-wide properties

## Running Tests

To run the fuzz tests, you need to have Foundry installed. You can run the tests using the following commands:

```bash
# Run all fuzz tests
forge test

# Run tests for a specific contract
forge test --match-path "test/foundry/core/ProtocolDAO.t.sol"

# Run tests with increased verbosity
forge test -vvv

# Run tests with a specific profile
forge test --profile ci
```

## Profiles

The fuzz testing framework includes several profiles in the `foundry.toml` file:

- `default`: Standard testing (1,000 fuzz runs)
- `ci`: CI/CD pipeline (5,000 fuzz runs)
- `gas`: Gas optimization (100 fuzz runs with gas reporting)
- `coverage`: Test coverage (500 fuzz runs)
- `quick`: Rapid development (50 fuzz runs)
- `deep`: Security audits (10,000 fuzz runs)
- `integration`: Contract interactions (2,000 fuzz runs)
- `core`: Critical contracts (3,000 fuzz runs)

## Documentation

For more information about the fuzz testing framework, see the [Fuzz Testing Report](../docs/fuzz-testing-report.md).
