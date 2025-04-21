# Sepolia Test Network Guide

## Overview

This guide provides comprehensive instructions for developing, testing, and deploying the D-Loop Protocol on the Sepolia Test Network. The guide is designed to help developers understand the testing pipeline, finalize development, and prepare for a successful Sepolia testnet release.

## Table of Contents

1. [Introduction](#introduction)
2. [Sepolia Test Network Requirements](#sepolia-test-network-requirements)
3. [Development Environment Setup](#development-environment-setup)
4. [Testing Pipeline](#testing-pipeline)
5. [Deployment Process](#deployment-process)
6. [Testnet-Specific Deviations](#testnet-specific-deviations)
7. [Verification and Validation](#verification-and-validation)
8. [Troubleshooting](#troubleshooting)
9. [Resources](#resources)

## Introduction

The D-Loop Protocol is a decentralized asset index DAO optimized for both AI and human participation. It leverages AI-powered nodes to govern the protocol, ensuring continuous index optimization. The protocol consists of two main components:

1. **Asset DAO**: Responsible for governing investing/divesting decisions
2. **Protocol DAO**: Responsible for community-controlled protocol governance

This guide focuses on preparing the protocol for deployment on the Sepolia Test Network, which serves as the final validation step before mainnet deployment.

## Sepolia Test Network Requirements

The Sepolia deployment focuses on core functionality with testnet-friendly simplifications:

### Core Requirements

1. **Simplified Admin Controls**
   - Single Sepolia deployer address for admin operations
   - Direct approval of AI Governance Node deployments
   - *Note*: Mainnet will use 2-of-3 multisig per whitepaper

2. **Gas-Critical Implementations**
   - Token Approval Optimizer with focus on `delegateTokens` and `withdrawDelegation`
   - Target 15-20% gas savings on key operations

3. **Identity Verification**
   - SoulboundNFT integration with `AINodeRegistry` for node identity
   - Simplified verification without cross-chain checks

4. **Governance & Economics**
   - Proposal execution with simplified quorum (10% for testnet)
   - Mock price oracles for DLOOP rewards
   - 1:1 D-AI mint/burn verification against test deposits

### Testnet Simplifications

- **Mock Components**: Oracles, Treasury, Fee Distributor
- **Deferred Features**: Complex access control, multisig requirements, cross-chain checks
- **Documentation**: All deviations documented in `sepolia-deviations.md`

## Development Environment Setup

### Prerequisites

1. **Node.js and npm**
   ```bash
   node -v  # Should be v16.x or higher
   npm -v   # Should be v8.x or higher
   ```

2. **Hardhat Development Environment**
   ```bash
   npm install --save-dev hardhat
   ```

3. **Sepolia Testnet Access**
   - Create an Infura or Alchemy account for Sepolia RPC access
   - Configure `.env` file with API keys and private keys

### Configuration

1. **Update Hardhat Config**
   ```javascript
   // hardhat.config.js
   module.exports = {
     networks: {
       sepolia: {
         url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
         accounts: [process.env.PRIVATE_KEY],
         gasPrice: 8000000000  // 8 gwei
       }
     }
   };
   ```

2. **Obtain Test ETH**
   - Use Sepolia faucets to obtain test ETH for deployment
   - Recommended faucets: Alchemy Faucet, Infura Faucet, or Sepolia Faucet

## Testing Pipeline

The D-Loop Protocol testing pipeline ensures comprehensive validation before Sepolia deployment:

### Test Structure

```
test/
├── unit/                   # Unit tests for individual contracts
├── integration/            # Integration tests for contract interactions
│   ├── flows/              # End-to-end workflow tests
│   └── security/           # Security-focused tests
├── performance/            # Performance and gas usage tests
├── validation/             # Validation tests for interfaces and mocks
├── fixtures/               # Reusable test fixtures
└── mocks/                  # Mock contracts for testing
```

### Running Tests

1. **Unit Tests**
   ```bash
   npx hardhat test test/unit/**/*.test.js
   ```

2. **Integration Tests**
   ```bash
   npx hardhat test test/integration/flows/**/*.test.js
   ```

3. **ABI Compatibility Tests**
   ```bash
   npx hardhat test test/validation/*.ABI.compatibility.test.js
   ```

4. **Gas Profiling**
   ```bash
   npx hardhat test test/performance/gas-profiles/critical-functions.gas.test.js
   node scripts/check-gas-limits.js
   ```

5. **Coverage Analysis**
   ```bash
   npx hardhat coverage
   # Report available at ./reports/coverage/index.html
   ```

### Test Fixtures

Utilize test fixtures for consistent contract deployment:

```javascript
// Example fixture usage
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployContractsFixture } = require("../fixtures/protocol.fixture");

describe("Protocol Test", function() {
  it("Should deploy correctly", async function() {
    const { protocolDAO, assetDAO } = await loadFixture(deployContractsFixture);
    // Test with deployed contracts
  });
});
```

### Mock Contracts

The protocol uses various mock contracts for testing:

- `MockPriceOracle`: Simulates price feeds
- `MockTreasury`: Simulates treasury operations
- `MockFeeProcessor`: Simulates fee collection and distribution
- `MockERC20`: Standard ERC20 token for testing

## Deployment Process

### Pre-Deployment Checklist

1. **Contract Verification**
   - All tests pass successfully
   - Gas profiling within acceptable limits
   - ABI compatibility verified

2. **Environment Configuration**
   - `.env` file configured with Sepolia credentials
   - Deployment account funded with sufficient test ETH

3. **Deployment Scripts**
   - Verify deployment scripts in `scripts/deploy/`
   - Ensure correct contract initialization parameters

### Deployment Steps

1. **Deploy Core Contracts**
   ```bash
   npx hardhat run scripts/deploy/deploy-core.js --network sepolia
   ```

2. **Deploy Token Contracts**
   ```bash
   npx hardhat run scripts/deploy/deploy-tokens.js --network sepolia
   ```

3. **Deploy Governance Contracts**
   ```bash
   npx hardhat run scripts/deploy/deploy-governance.js --network sepolia
   ```

4. **Initialize Protocol**
   ```bash
   npx hardhat run scripts/deploy/initialize-protocol.js --network sepolia
   ```

5. **Verify Contracts on Etherscan**
   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

### Post-Deployment Verification

1. **Functional Testing**
   - Verify proposal submission/voting/execution
   - Test token minting/burning mechanics
   - Validate reward distribution

2. **Integration Testing**
   - Test interactions between deployed contracts
   - Verify correct event emissions
   - Validate access control mechanisms

## Testnet-Specific Deviations

The Sepolia deployment includes several simplifications compared to the planned mainnet implementation:

### Administrative Controls

- **Simplified Admin Structure**: Single deployer address instead of multi-signature wallets
- **Direct Approvals**: Streamlined approval process for AI Governance Nodes
- **Implementation**: `SimplifiedAdminControls.sol`

### Governance Parameters

- **Reduced Quorum**: 10% quorum requirement (vs. 51%+ for mainnet)
- **Shortened Timeframes**: Faster voting and execution periods
- **Simplified Execution**: Reduced delays for governance actions

### External Integrations

- **Mock Oracles**: Simplified price oracle implementation
- **Simplified Treasury**: Basic treasury functionality
- **No Cross-Chain Verification**: Omitted for testnet simplicity

### Gas Optimizations

- **Focused Optimization**: Prioritized for token operations
- **Target Savings**: 15-20% gas reduction on key functions
- **Validation**: Gas profiling to verify optimization effectiveness

## Verification and Validation

### Key Validation Points

1. **Proposal Flow**
   - Can users submit proposals?
   - Does voting work correctly?
   - Are proposals executed properly?

2. **Rewards Calculation**
   - Are rewards calculated correctly?
   - Does the quality multiplier work?
   - Are rewards distributed to the right participants?

3. **Token Mechanics**
   - Is the 1:1 backing maintained?
   - Do mint/burn operations work correctly?
   - Are token approvals optimized?

### Validation Tools

1. **Block Explorer**
   - Use Sepolia Etherscan to verify transactions
   - Monitor contract interactions
   - Check event emissions

2. **Testing Dashboard**
   - Deploy a simple dashboard for monitoring
   - Track key metrics and contract states
   - Visualize protocol performance

## Troubleshooting

### Common Issues

1. **Transaction Reverted**
   - Check that contract state is properly set up
   - Verify correct function parameters
   - Ensure sufficient gas is provided

2. **Permission Errors**
   - Verify caller has the correct role
   - Check role assignments in admin contracts
   - Confirm transaction signer matches required role

3. **Oracle Issues**
   - Verify mock oracle is providing expected values
   - Check price update frequency
   - Validate price data format

### Debug Tools

1. **Hardhat Console**
   ```javascript
   console.log("Debug value:", value);
   ```

2. **Hardhat Traces**
   ```bash
   npx hardhat test --trace
   ```

3. **Event Monitoring**
   - Monitor contract events for debugging
   - Use Etherscan to view emitted events

## Resources

- [D-Loop Whitepaper](./d-loop-whitepaper.md)
- [Technical Documentation](./docs/technical-docs/)
- [Testing Guide](./docs/testing/TESTING_GUIDE.md)
- [Sepolia Requirements](./SEPOLIA_REQUIREMENTS.md)
- [Sepolia Deviations](./docs/technical-docs/references/sepolia-deviations.md)
- [Contributing Guidelines](./CONTRIBUTING.md)

---

*This guide is maintained by the D-Loop Protocol team and will be updated as the protocol evolves.*
