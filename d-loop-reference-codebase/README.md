# DLOOP Smart Contract System v1.2.6

This package contains the complete DLOOP smart contract system with reorganized files for improved local development and testing.

## Latest Updates

- Renamed "AssetDAOWithFees (copy).sol" to "AssetDAOWithFeesRefOnly.sol"
  - Added clear documentation that it's for reference only
  - Updated contract name and error messages to match
  - Added note that it should be removed before deployment
- Created new documentation for reference implementations in docs/ReferenceImplementations.md
- Fixed directory structure by standardizing to singular "bridge" directory
- Fixed import paths for all contract files:
  - Changed "../libraries/Errors.sol" to "../utils/Errors.sol"
  - Changed "../libraries/DiamondStorage.sol" to "../utils/DiamondStorage.sol"
- Generated new production-ready bundle with all fixes (DLOOP_PRODUCTION_READY_BUNDLE.zip)

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Repository Organization](#repository-organization)
- [Setup Instructions](#setup-instructions)
- [Testing](#testing)
- [Contract Structure](#contract-structure)
- [Version History](#version-history)

## Overview

DLOOP is a decentralized asset index DAO optimized for both AI and human participation. It leverages AI-powered nodes to govern the protocol, ensuring continuous index optimization. This repository contains the smart contract implementation for the DLOOP ecosystem.

## Repository Organization

The repository is organized into several main directories:

- `/contracts` - Contains all the original smart contract code (.sol files)
- `/consolidated-contracts` - Contains the production-ready consolidated contracts organized by domain
- `/user-environment` - Contains environment configuration files for local development
- `/scripts` - Contains deployment and configuration scripts

This organization allows for cleaner development workflows and easier updates:

## Features

1. **Asset Governance Rewards**
   - Merit-based reward system for governance participants
   - Oracle integration for price evaluation
   - Voting reward mechanism based on correct decisions

2. **Protocol DAO with AI Node Integration**
   - Minimalist design with whitelisted executors
   - Different voting periods for AI nodes (1 day) vs humans (7 days)
   - Implementation of executor contracts

3. **Asset DAO Fee Structure**
   - Fee collection on invest (10%), divest (5%), and ragequit (20%) operations
   - Treasury contract to store 70% of fees
   - RewardDistributor to handle the remaining 30%

4. **Hedera Bridge Implementation**
   - Cross-chain bridge functionality
   - Token transfer between Ethereum and Hedera networks
   - Message verification mechanism

5. **AI Node Identification System**
   - SoulboundNFT implementation for AI node credentials
   - AINodeRegistry for management and verification
   - Integration with governance for differentiated voting

## Setup Instructions

### Prerequisites
- Node.js (v14+)
- npm (v7+)

### Installation

#### For Development:

1. Clone the repository
```bash
git clone https://github.com/dloop-protocol/contracts.git
cd contracts
```

2. Install dependencies from the user-environment directory
```bash
cd user-environment
npm install
```

3. Set up environment variables
```bash
cp .env.sample .env
# Edit .env with your specific configuration
```

4. Compile the contracts (from the user-environment directory)
```bash
# This will compile the contracts from the parent directory
./verify-compilation.sh
```

#### For Users:

1. Download the reorganized bundle from the web interface
2. Extract the bundle
```bash
unzip dloop-smart-contracts-reorganized.zip
cd dloop-smart-contracts
```

3. Set up the environment
```bash
cd user-environment
cp .env.sample .env
# Edit .env with your configuration
npm install
```

4. Verify compilation
```bash
./verify-compilation.sh
```

## Testing

### Running Unit Tests

All testing commands should be run from the `user-environment` directory:

```bash
cd user-environment

# Run all tests
npx hardhat test

# Run specific test
npx hardhat test ../test/governance/ProtocolDAO.test.js

# Run syntax fixes test
./test-syntax-fixes.sh
```

### Running Integration Tests

The integration tests verify how all components work together in a production-like environment:

```bash
# Run all integration tests
./run-integration-tests.sh

# Run integration tests with coverage reporting
./run-integration-coverage.sh
```

For more information on the integration testing system, see [Integration Testing Guide](./docs/INTEGRATION_TESTING.md).

### Test Coverage

```bash
# For unit tests
cd user-environment
npx hardhat coverage

# For integration tests (consolidated contracts)
./run-integration-coverage.sh
```

### Deployment

#### Original Contracts

```bash
cd user-environment

# Deploy to local network
npx hardhat run ../scripts/deploy.js

# Deploy to Sepolia testnet (original contracts)
npx hardhat run ../scripts/deploy-sepolia.js --network sepolia

# Deploy to Hedera testnet (coming soon)
# npx hardhat run ../scripts/deploy-hedera.js --network hedera
```

#### Consolidated Contracts (Production-Ready)

The consolidated contracts are optimized and production-ready. Use these for actual deployments:

```bash
cd user-environment

# Deploy consolidated contracts to Sepolia testnet
npx hardhat run ../scripts/deploy-sepolia-consolidated.js --network sepolia

# Configure price feeds for the deployed contracts
npx hardhat run ../scripts/configure-sepolia-price-feeds.js --network sepolia
```

For detailed instructions on deploying and configuring the consolidated contracts, please refer to the [Sepolia Deployment Guide](./docs/SEPOLIA_DEPLOYMENT_GUIDE.md).

### Creating Download Bundles

You can create downloadable bundles that include both contract files and environment configuration:

```bash
# From the project root
./create-download-bundles.sh
```

This will create:
- `dloop-contracts-[timestamp].zip` - Contains only the contracts
- `dloop-project-[timestamp].zip` - Contains the full project with contracts and environment files
- `dloop-contracts-latest.zip` - Latest version of contracts only
- `dloop-project-complete.zip` - Latest version of the full project

## Contract Structure

### Original Contracts

- `contracts/governance/` - Protocol DAO and voting mechanisms
  - `ProtocolDAOWithAINodes.sol` - Core governance with AI node integration
  - `Executor.sol` - Contract execution interfaces
  - `SoulboundNFT.sol` - Non-transferable credentials for AI nodes
  
- `contracts/identity/` - AI node identification system
  - `AINodeRegistry.sol` - AI node management and verification
  - `AINodeIdentifier.sol` - Verification of AI node credentials
  
- `contracts/fees/` - Fee structure implementation
  - `FeeCalculator.sol` - Fee percentage calculations (10% invest, 5% divest, 20% ragequit)
  - `FeeProcessor.sol` - Fee collection and distribution
  - `Treasury.sol` - Storage for 70% of collected fees
  - `AssetDAOWithFees.sol` - Asset DAO with integrated fee functionality
  - `AssetDAOWithFeesRefOnly.sol` - Reference implementation (to be removed before deployment)
  
- `contracts/bridge/` - Hedera bridge implementation
  - `HederaBridge.sol` - Cross-chain asset transfers
  - `HederaTokenManager.sol` - Token mapping between chains
  - `IHederaTokenService.sol` - Interface to Hedera token service
  
- `contracts/rewards/` - Asset governance rewards
  - `RewardDistributor.sol` - Distribution of rewards to governance participants
  - `RewardCalculator.sol` - Calculates rewards based on voting decisions
  
- `contracts/oracles/` - Price oracle integration
  - `ChainlinkPriceOracle.sol` - Price data retrieval
  - `CrossChainOracleAdapter.sol` - Cross-chain oracle functionality
  
- `contracts/interfaces/` - Core interfaces
- `contracts/libraries/` - Shared utilities and helper functions
- `contracts/mocks/` - Mock contracts for testing

### Consolidated Contracts (Production-Ready)

The consolidated contracts are organized by domain with clearer interfaces and better separation of concerns:

- `consolidated-contracts/tokens/` - Core token implementations
  - `DLoopToken.sol` - Governance token with voting capabilities
  
- `consolidated-contracts/governance/` - Enhanced governance with AI integration
  - `ProtocolDAO.sol` - Protocol-level governance with AI voting
  - `ExecutorRegistry.sol` - Registry for approved executor contracts
  
- `consolidated-contracts/identity/` - Advanced AI node identification
  - `SoulboundNFT.sol` - Non-transferable credentials for AI nodes
  - `AINodeRegistry.sol` - Registry and verification for AI nodes
  
- `consolidated-contracts/fees/` - Comprehensive fee structure
  - `FeeCalculator.sol` - Configurable fee percentages
  - `AssetDAOWithFees.sol` - Asset management with fee integration
  - `Treasury.sol` - Fee storage and distribution
  
- `consolidated-contracts/bridge/` - Cross-chain bridge infrastructure
  - `HederaBridge.sol` - Hedera-Ethereum bridge with security features
  - `MessageVerifier.sol` - Cross-chain message verification
  
- `consolidated-contracts/oracles/` - Enhanced oracle system
  - `ChainlinkPriceOracle.sol` - Standardized access to Chainlink price data
  - `MultiOracleConsensus.sol` - Weighted aggregation of multiple oracle sources
  
- `consolidated-contracts/rewards/` - Merit-based reward system
  - `RewardDistributor.sol` - Automated reward distribution
  - `ReputationTracker.sol` - AI node reputation tracking

The consolidated structure includes additional features:
- Built-in fee collection integrated with asset management
- Enhanced security features for cross-chain operations
- More streamlined interfaces with better documentation
- Optimized gas usage and better upgradeability patterns

### Environment Configuration (user-environment/)

- `hardhat.config.js` - Hardhat configuration for network settings, compiler options
- `package.json` - Node.js package dependencies
- `.env.sample` - Template for environment variables
- `verify-compilation.sh` - Script to verify contracts compile correctly

## Version History

See [VERSION.md](./VERSION.md) for detailed version information.

## License

MIT