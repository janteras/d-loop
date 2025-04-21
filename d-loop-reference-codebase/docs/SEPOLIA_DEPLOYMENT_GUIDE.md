# DLOOP Sepolia Deployment Guide

This guide explains how to deploy the DLOOP smart contract system to the Sepolia testnet using the consolidated contract structure.

## Consolidated Contract Structure

The DLOOP smart contract system has been organized into a consolidated structure where contracts are grouped by their functional domain. This provides better organization and separation of concerns.

### Contract Mapping (Original → Consolidated)

| Original Contract | Consolidated Equivalent | Notes |
|-------------------|-------------------------|-------|
| DLoopToken.sol | consolidated-contracts/tokens/DLoopToken.sol | Token functionality remains the same |
| RateQuoterV2.sol | consolidated-contracts/oracles/ChainlinkPriceOracle.sol + consolidated-contracts/oracles/MultiOracleConsensus.sol | Oracle functionality has been split into two contracts for better separation of concerns |
| Treasury.sol | consolidated-contracts/fees/Treasury.sol | Fee collection destination |
| AssetDAO.sol | consolidated-contracts/fees/AssetDAOWithFees.sol | Enhanced with fee collection capabilities |
| ProtocolDAO.sol | consolidated-contracts/governance/ProtocolDAO.sol | Main governance contract |
| N/A | consolidated-contracts/fees/FeeCalculator.sol | New contract for fee calculations |

## Deployment Process

### Prerequisites

1. Ensure you have a `.env` file with the following variables:
   - `PRIVATE_KEY`: Your Ethereum wallet private key
   - `SEPOLIA_RPC_URL`: Sepolia testnet RPC URL
   - `ETHERSCAN_API_KEY`: Etherscan API key for contract verification

2. Make sure you have sufficient Sepolia ETH in your deployer wallet.

### Deployment Steps

1. Run the Sepolia deployment script:

```bash
npx hardhat run scripts/deploy-sepolia-consolidated.js --network sepolia
```

2. The script will:
   - Deploy all the consolidated contracts
   - Configure their relationships and permissions
   - Save deployment information to `deployment-consolidated-info.json`

3. Verify contracts on Etherscan (optional):

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

For proxy contracts, use:

```bash
npx hardhat verify:verify-proxy --network sepolia <PROXY_ADDRESS>
```

## Contract Functionality Overview

### DLoopToken
The governance token for the DLOOP ecosystem.

### ChainlinkPriceOracle
Provides access to Chainlink price feeds with standardized interfaces.

### MultiOracleConsensus
Aggregates prices from multiple sources with weighted consensus algorithms.

### Treasury
Stores collected fees and manages their distribution.

### FeeCalculator
Calculates fees for various operations (invest: 10%, divest: 5%, ragequit: 20%).

### AssetDAOWithFees
Manages assets with fee collection capabilities.

### ProtocolDAO
Provides governance functionality for the protocol.

## Post-Deployment Configuration

After deployment, you'll need to:

1. Register price feeds for tokens:
   ```javascript
   await priceOracle.registerPriceFeed(tokenAddress, priceFeedAddress, "TOKEN_SYMBOL");
   ```

2. Set up governance parameters:
   ```javascript
   await protocolDAO.setVotingPeriod(aiNodeVotingPeriod, humanVotingPeriod);
   ```

3. Register supported assets in the AssetDAO:
   ```javascript
   await assetDAO.addSupportedAsset(tokenAddress);
   ```

## Troubleshooting

- **Error: Contract not found**: Ensure you're using the correct import paths with the `consolidated-contracts/` prefix
- **Error: Function not found**: Check if the function name or signature has changed in the consolidated version
- **Error: Missing role**: Verify that all necessary roles have been granted to the correct addresses

## Additional Resources

- [DLOOP Contract Architecture Overview](/docs/contract_structure.html)
- [Consolidated Contract Documentation](/docs/consolidated_structure.html)