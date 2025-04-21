# DLOOP Smart Contract Deployment Guide

## Overview

This guide outlines the deployment process for the DLOOP smart contract system, covering the AI Node Identification and Governance Rewards components.

## Prerequisites

Before deployment, ensure you have:

- A funded account for deployment gas costs
- Access to the target network (Ethereum Mainnet, Sepolia Testnet, Hedera, etc.)
- Ethers.js or Web3.js setup for deployment scripts
- Hardhat configuration with network settings

## Deployment Sequence

The contracts should be deployed in a specific order to ensure proper integration:

### 1. Deploy SoulboundNFT

```javascript
const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
const soulboundNFT = await SoulboundNFT.deploy();
await soulboundNFT.deployed();
console.log("SoulboundNFT deployed to:", soulboundNFT.address);
```

### 2. Deploy AINodeRegistry

```javascript
const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
const aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
await aiNodeRegistry.deployed();
console.log("AINodeRegistry deployed to:", aiNodeRegistry.address);
```

### 3. Grant Minter Role to Registry

```javascript
const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
await soulboundNFT.grantRole(MINTER_ROLE, aiNodeRegistry.address);
console.log("Granted MINTER_ROLE to AINodeRegistry");
```

### 4. Deploy AINodeGovernance

```javascript
const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
const aiNodeGovernance = await AINodeGovernance.deploy(aiNodeRegistry.address);
await aiNodeGovernance.deployed();
console.log("AINodeGovernance deployed to:", aiNodeGovernance.address);
```

### 5. Deploy MockERC20 (for testing) or Use Existing DLOOP Token

```javascript
// For testing
const MockERC20 = await ethers.getContractFactory("MockERC20");
const dloopToken = await MockERC20.deploy(
  "DLOOP Token", 
  "DLOOP", 
  ethers.parseUnits("100000000", 18)
);
await dloopToken.deployed();
console.log("MockERC20 (DLOOP) deployed to:", dloopToken.address);

// For production
// Use existing token address
const dloopTokenAddress = "0x..."; // Replace with actual address
```

### 6. Deploy Price Oracle or Use Existing Oracle

```javascript
// For testing
const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
const priceOracle = await MockPriceOracle.deploy();
await priceOracle.deployed();
console.log("MockPriceOracle deployed to:", priceOracle.address);

// For production
// Use existing price oracle address
const priceOracleAddress = "0x..."; // Replace with actual address
```

### 7. Deploy GovernanceRewards

```javascript
const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
const governanceRewards = await GovernanceRewards.deploy(
  dloopToken.address,
  priceOracle.address
);
await governanceRewards.deployed();
console.log("GovernanceRewards deployed to:", governanceRewards.address);
```

### 8. Set Up Roles and Permissions

```javascript
// Grant GOVERNANCE_ROLE to ProtocolDAO
const GOVERNANCE_ROLE = await governanceRewards.GOVERNANCE_ROLE();
await governanceRewards.grantRole(GOVERNANCE_ROLE, protocolDAOAddress);

// Grant DISTRIBUTOR_ROLE to Treasury or automated distributor
const DISTRIBUTOR_ROLE = await governanceRewards.DISTRIBUTOR_ROLE();
await governanceRewards.grantRole(DISTRIBUTOR_ROLE, treasuryAddress);

// Grant GOVERNANCE_ROLE to ProtocolDAO in AINodeRegistry
const REGISTRY_GOVERNANCE_ROLE = await aiNodeRegistry.GOVERNANCE_ROLE();
await aiNodeRegistry.grantRole(REGISTRY_GOVERNANCE_ROLE, protocolDAOAddress);

// Grant ADMIN_ROLE to ProtocolDAO in AINodeGovernance
const ADMIN_ROLE = await aiNodeGovernance.ADMIN_ROLE();
await aiNodeGovernance.grantRole(ADMIN_ROLE, protocolDAOAddress);
```

## Contract Verification

After deployment, verify the contracts on Etherscan or the appropriate block explorer:

```bash
npx hardhat verify --network mainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Example:

```bash
npx hardhat verify --network mainnet 0xContractAddress "0xDloopTokenAddress" "0xPriceOracleAddress"
```

## Post-Deployment Steps

1. Register initial AI nodes through the AINodeRegistry
2. Transfer DLOOP tokens to the GovernanceRewards contract for distribution
3. Set up the initial governance proposals for testing
4. Monitor the first reward distribution cycle

## Cross-Chain Deployment (Ethereum & Hedera)

For Hedera deployment, additional steps are required:

1. Deploy the Hedera Token Service (HTS) version of the DLOOP token
2. Connect to the Hedera network using the Hedera JavaScript SDK
3. Deploy proxy contracts for cross-chain integration

## Security Considerations

- Use multi-sig wallets for administrative roles
- Perform a thorough audit before mainnet deployment
- Start with lower reward amounts to test distribution logic
- Implement circuit breakers for emergency pausing