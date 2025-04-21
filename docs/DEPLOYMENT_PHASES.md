# D-Loop Protocol Deployment Phases

This document outlines the phased deployment approach for the D-Loop Protocol smart contracts on the Sepolia testnet.

## Phase 1: Core Protocol Infrastructure (Deployed)

The following core contracts have been successfully deployed to the Sepolia testnet as part of Phase 1:

| Contract Name | Address | Purpose |
|---------------|---------|---------|
| SoulboundNFT | `0x97cCBDc8c4Fb46Bf2cB61E076EB7864799203913` | Non-transferable identity verification NFT |
| DLoopToken | `0x65F8c541502938cF019400a2841d2C87F0bD2B5E` | Protocol governance token with delegation capabilities |
| ProtocolDAO | `0xFaA472e6C2353e863CA1Dd38fA6E77f2b3e9A215` | Central governance mechanism for protocol parameters and upgrades |
| AINodeRegistry | `0x8D2fbeC846AeAe61b7bD3A5E1d07e9C7912A1F80` | Registry for AI node operators and verification |
| Treasury | `0xf42d1a2c608a4508F22d2a9C42Cea41E3eDe34Fc` | Protocol treasury for fund management and distribution |
| GovernanceRewards | `0x4606594957d209fbc2C4B24e47990F6dFDAba69A` | Rewards distribution for governance participation |
| PriceOracle | `0x24323B8fE6AC34842Dc5624e9e1729CDdB5e7AB0` | Price data provider for protocol operations |

All Phase 1 contracts have been verified on Etherscan and can be accessed via the following format:
`https://sepolia.etherscan.io/address/{CONTRACT_ADDRESS}#code`

## Phase 2: Extended Protocol Functionality (Pending)

The following contracts will be deployed in Phase 2 to extend the protocol's functionality:

| Contract Name            | Purpose                                                               | Dependencies                | Status   |
|-------------------------|-----------------------------------------------------------------------|-----------------------------|----------|
| AssetDAO                | Manages digital assets and related governance                         | ProtocolDAO, Treasury       | Pending  |
| AINodeGovernance        | Specialized governance for AI node operators                          | AINodeRegistry, ProtocolDAO | Pending  |
| FeeCalculator           | Calculates protocol fees based on usage and market conditions         | PriceOracle                 | Pending  |
| FeeProcessor            | Processes and distributes fees to various protocol stakeholders       | Treasury, FeeCalculator     | Pending  |
| PriceOracleAdapter      | Adapter for connecting to various price feed sources                  | PriceOracle                 | Pending  |
| ChainlinkPriceOracle    | Provides on-chain price data using Chainlink oracles                  | Chainlink, PriceOracle      | Developed |
| SoulboundNFTAdapter     | Adapter for SoulboundNFT integration with external systems            | SoulboundNFT                | Pending  |
| SimplifiedAdminControls | Streamlined administrative controls for protocol management           | ProtocolDAO                 | Pending  |
| TokenApprovalOptimizer  | Gas optimization for token approvals                                  | N/A                         | Pending  |
| TokenOptimizer          | Additional token optimization utilities                               | N/A                         | Pending  |

**Chainlink Integration:**
- The protocol now includes a dedicated `ChainlinkPriceOracle` contract, which sources secure and reliable price data from Chainlink feeds. This enhances the robustness of protocol fee calculations and asset pricing. The `ChainlinkPriceOracle` is fully developed and integrated as a core dependency for price-sensitive modules such as `FeeCalculator` and `PriceOracleAdapter`.
|---------------|---------|-------------|--------|
| AssetDAO | Manages digital assets and related governance | ProtocolDAO, Treasury | Pending |
| AINodeGovernance | Specialized governance for AI node operators | AINodeRegistry, ProtocolDAO | Pending |
| FeeCalculator | Calculates protocol fees based on usage and market conditions | PriceOracle | Pending |
| FeeProcessor | Processes and distributes fees to various protocol stakeholders | Treasury, FeeCalculator | Pending |
| PriceOracleAdapter | Adapter for connecting to various price feed sources | PriceOracle | Pending |
| SoulboundNFTAdapter | Adapter for SoulboundNFT integration with external systems | SoulboundNFT | Pending |
| SimplifiedAdminControls | Streamlined administrative controls for protocol management | ProtocolDAO | Pending |
| TokenApprovalOptimizer | Gas optimization for token approvals | N/A | Pending |
| TokenOptimizer | Additional token optimization utilities | N/A | Pending |

### Phase 2 Deployment Instructions

To deploy Phase 2 contracts, follow these steps:

1. **Pre-Deployment Testing**:
   ```bash
   # Run specific tests for Phase 2 contracts
   npx hardhat test test/unit/assetDAO.test.js
   npx hardhat test test/unit/aiNodeGovernance.test.js
   npx hardhat test test/unit/feeCalculator.test.js
   npx hardhat test test/unit/feeProcessor.test.js
   
   # Run integration tests
   npx hardhat test test/integration/phase2Integration.test.js
   
   # Run validation tests to ensure ABI compatibility
   npx hardhat test test/validation/phase2.ABI.compatibility.test.js
   ```

2. **Dry Run Deployment**:
   ```bash
   npx hardhat run scripts/deployment/phase2-dry-run.js
   ```

3. **Deploy Phase 2 Contracts**:
   ```bash
   npx hardhat run scripts/deployment/deploy-phase2.js --network sepolia
   ```

4. **Verify Contracts on Etherscan**:
   ```bash
   npx hardhat run scripts/deployment/verify-phase2-contracts.js --network sepolia
   ```

5. **Post-Deployment Configuration**:
   ```bash
   npx hardhat run scripts/deployment/phase2-post-deployment.js --network sepolia
   ```

### Phase 2 Testing Scripts

The following testing scripts are available for Phase 2 contracts:

| Script | Purpose | Command |
|--------|---------|---------|
| `test/unit/assetDAO.test.js` | Unit tests for AssetDAO contract | `npx hardhat test test/unit/assetDAO.test.js` |
| `test/unit/aiNodeGovernance.test.js` | Unit tests for AINodeGovernance contract | `npx hardhat test test/unit/aiNodeGovernance.test.js` |
| `test/unit/feeCalculator.test.js` | Unit tests for FeeCalculator contract | `npx hardhat test test/unit/feeCalculator.test.js` |
| `test/unit/feeProcessor.test.js` | Unit tests for FeeProcessor contract | `npx hardhat test test/unit/feeProcessor.test.js` |
| `test/integration/phase2Integration.test.js` | Integration tests for Phase 2 contracts | `npx hardhat test test/integration/phase2Integration.test.js` |
| `test/validation/phase2.ABI.compatibility.test.js` | ABI compatibility tests for Phase 2 contracts | `npx hardhat test test/validation/phase2.ABI.compatibility.test.js` |

### Phase 2 Deployment Scripts

The following deployment scripts are available for Phase 2 contracts:

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/deployment/phase2-dry-run.js` | Simulates Phase 2 deployment without actual contract deployment | `npx hardhat run scripts/deployment/phase2-dry-run.js` |
| `scripts/deployment/deploy-phase2.js` | Deploys Phase 2 contracts to the specified network | `npx hardhat run scripts/deployment/deploy-phase2.js --network sepolia` |
| `scripts/deployment/verify-phase2-contracts.js` | Verifies Phase 2 contracts on Etherscan | `npx hardhat run scripts/deployment/verify-phase2-contracts.js --network sepolia` |
| `scripts/deployment/phase2-post-deployment.js` | Configures Phase 2 contracts after deployment | `npx hardhat run scripts/deployment/phase2-post-deployment.js --network sepolia` |

## Deployment Dependencies

The Phase 2 deployment has dependencies on the Phase 1 contracts. The deployment scripts will automatically use the addresses of the Phase 1 contracts from the deployment file:

```
deployments/sepolia-deployment-2025-04-15T22-38-02.087Z.json
```

## Gas Estimates for Phase 2 Deployment

Based on dry run simulations, the estimated gas costs for Phase 2 deployment are:

| Contract | Estimated Gas | Approximate ETH Cost (20 gwei) |
|----------|---------------|-------------------------------|
| AssetDAO | 3,865,421 | 0.0773 ETH |
| AINodeGovernance | 2,546,782 | 0.0509 ETH |
| FeeCalculator | 2,128,945 | 0.0426 ETH |
| FeeProcessor | 3,438,291 | 0.0688 ETH |
| PriceOracleAdapter | 1,230,421 | 0.0246 ETH |
| SoulboundNFTAdapter | 1,328,105 | 0.0266 ETH |
| SimplifiedAdminControls | 2,165,289 | 0.0433 ETH |
| TokenApprovalOptimizer | 1,764,000 | 0.0353 ETH |
| TokenOptimizer | 935,000 | 0.0187 ETH |
| **Total** | **19,402,254** | **0.3880 ETH** |

Ensure the deployment wallet has at least 0.5 ETH to cover deployment costs and post-deployment configuration.

## Verification Checklist for Phase 2

- [ ] All Phase 1 contracts are properly configured and operational
- [ ] All Phase 2 tests pass successfully
- [ ] Dry run deployment completes without errors
- [ ] Deployment wallet has sufficient ETH
- [ ] All Phase 2 contracts deploy successfully
- [ ] All Phase 2 contracts are verified on Etherscan
- [ ] Post-deployment configuration completes successfully
- [ ] Integration with Phase 1 contracts is validated

## Future Phases

After the successful deployment of Phase 2, future phases will focus on:

1. **Phase 3**: Advanced protocol features and optimizations
2. **Phase 4**: Cross-chain functionality and expanded integrations
3. **Phase 5**: Mainnet deployment preparation

Details for these phases will be provided in future documentation updates.
