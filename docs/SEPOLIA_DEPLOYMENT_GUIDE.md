# D-Loop Protocol Sepolia Deployment Guide

This guide provides a step-by-step process for deploying the D-Loop Protocol to the Sepolia testnet.

## Prerequisites

Before beginning the deployment process, ensure you have the following:

1. **Development Environment**:
   - Node.js (v16+)
   - npm or yarn
   - Git

2. **Required Accounts and API Keys**:
   - Ethereum wallet with Sepolia ETH (at least 0.5 ETH)
   - Infura API key for Sepolia RPC URL
   - Etherscan API key for contract verification

3. **Repository Setup**:
   - Clone the D-Loop Protocol repository
   - Install dependencies with `npm install`

## Environment Configuration

1. Create a `.env` file in the root directory with the following variables:

```
# Network RPC URLs
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

# Deployment keys - KEEP THESE SECURE!
PRIVATE_KEY=YOUR_PRIVATE_KEY_WITHOUT_0x_PREFIX

# Etherscan API Key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY

# Deployer address (optional, will be derived from private key if not provided)
DEPLOYER_ADDRESS=YOUR_DEPLOYER_ADDRESS
```

2. Ensure your `.env` file is added to `.gitignore` to prevent exposing sensitive information.

## Pre-Deployment Testing

Before deploying to Sepolia, it's recommended to run the full test suite and a dry run deployment:

1. **Run Full Test Suite**:

```bash
npm run test:full
```

2. **Run Dry Deployment**:

```bash
npx hardhat run scripts/deployment/dry-run-deployment.js
```

The dry run will provide estimated gas costs and generate mock addresses for all contracts.

## Deployment Process

### Step 1: Deploy Contracts

Run the deployment script to deploy all contracts to the Sepolia testnet:

```bash
npx hardhat run scripts/deployment/deploy-sepolia-v6.js --network sepolia
```

This script will:
- Connect to the Sepolia network using the provided RPC URL
- Use the private key to sign transactions
- Deploy all contracts in the correct order with proper constructor arguments
- Save deployment information to a file in the `deployments` directory

### Step 2: Verify Contracts on Etherscan

After deployment, verify all contracts on Etherscan:

```bash
npx hardhat run scripts/deployment/verify-deployed-contracts.js --network sepolia
```

This script will:
- Find the latest deployment file for Sepolia
- Verify each contract using the Etherscan API
- Report verification status for each contract

### Step 3: Post-Deployment Configuration

Run the post-deployment configuration script to set up contract relationships:

```bash
npx hardhat run scripts/deployment/post-deployment-configuration.js --network sepolia
```

This script will:
- Grant the minter role on DLoopToken to the Treasury
- Update Treasury address in ProtocolDAO
- Set up contract relationships and permissions

## Deployment Verification

After completing the deployment process, verify that all contracts are properly deployed and configured:

1. **Check Deployment File**:
   - Examine the generated deployment file in the `deployments` directory
   - Verify all contract addresses are present

2. **Verify on Etherscan**:
   - Visit each contract on Etherscan to ensure it's verified
   - Check that the contract code matches the expected implementation

3. **Test Basic Functionality**:
   - Use the Hardhat console to interact with deployed contracts
   - Verify that key functions work as expected

```bash
npx hardhat console --network sepolia
```

Example console commands:
```javascript
// Get contract instances
const DLoopToken = await ethers.getContractFactory("DLoopToken");
const dloopToken = await DLoopToken.attach("0x65F8c541502938cF019400a2841d2C87F0bD2B5E");

// Test basic functionality
const name = await dloopToken.name();
console.log("Token name:", name);
```

## Troubleshooting

### Common Deployment Issues

1. **Insufficient Funds**:
   - Ensure your wallet has enough Sepolia ETH for deployment
   - Estimated cost: ~0.5 ETH for all contracts

2. **RPC Connection Issues**:
   - Verify your Infura API key is valid
   - Try an alternative RPC provider if Infura is experiencing issues

3. **Contract Verification Failures**:
   - Ensure your Etherscan API key is correct
   - Check that the compiler version in Hardhat matches the one used for deployment
   - Verify that constructor arguments are correctly formatted

4. **Post-Deployment Configuration Errors**:
   - Check contract interfaces to ensure function names are correct
   - Verify that the caller has the necessary permissions

## Deployment Checklist

Use this checklist to ensure a successful deployment:

- [ ] Environment variables properly configured
- [ ] Full test suite passes
- [ ] Dry run deployment completed successfully
- [ ] Wallet has sufficient Sepolia ETH
- [ ] All contracts deployed successfully
- [ ] Deployment file generated with all contract addresses
- [ ] All contracts verified on Etherscan
- [ ] Post-deployment configuration completed successfully
- [ ] Basic functionality tested and working

## Recent Deployments

The most recent deployment to Sepolia was completed on April 15, 2025, with the following contract addresses:

| Contract | Address |
|----------|---------|
| SoulboundNFT | `0x97cCBDc8c4Fb46Bf2cB61E076EB7864799203913` |
| DLoopToken | `0x65F8c541502938cF019400a2841d2C87F0bD2B5E` |
| ProtocolDAO | `0xFaA472e6C2353e863CA1Dd38fA6E77f2b3e9A215` |
| AINodeRegistry | `0x8D2fbeC846AeAe61b7bD3A5E1d07e9C7912A1F80` |
| Treasury | `0xf42d1a2c608a4508F22d2a9C42Cea41E3eDe34Fc` |
| GovernanceRewards | `0x4606594957d209fbc2C4B24e47990F6dFDAba69A` |
| PriceOracle | `0x24323B8fE6AC34842Dc5624e9e1729CDdB5e7AB0` |
