# AssetDAOWithFees Contract Upgrade Guide

This document explains the upgrade from the previous version of `AssetDAOWithFees` to the new enhanced version.

## Overview

The `AssetDAOWithFees` contract has been significantly enhanced with new features and improved architecture. The contract is now located exclusively in the `contracts/governance/` directory, replacing the previous version that was in the `contracts/asset/` directory.

## Key Differences

### Architecture Changes

1. **Upgradeability**: The new version implements UUPS upgradeability pattern
2. **Security**: Added ReentrancyGuard protection against reentrancy attacks
3. **Flexibility**: Enhanced role-based access control with more specific roles

### Feature Enhancements

1. **Token Management**: Now uses an external token (daiToken) instead of implementing ERC20 directly
2. **Price Oracle**: Integrates with a price oracle system for token valuations
3. **Asset Management**: More detailed tracking and management of assets
4. **Investment Records**: Comprehensive tracking of investments and divestments
5. **Fee Handling**: Direct fee transfers to treasury instead of using a separate processor

## Integration Changes

### For Tests

The test files need to be updated to use the new contract interface:

- Replace ERC20 function calls with the new interface
- Update initialization parameters
- Use the new investment/divestment approach

### For Deployment Scripts

Deployment scripts need to be updated to:

- Include the price oracle parameter
- Use the DAI token address
- Configure treasury directly

## Migration Steps

1. Update imports to reference `contracts/governance/AssetDAOWithFees.sol`
2. Update contract initialization calls to include all required parameters
3. Modify investment/divestment calls to match the new interface
4. Update fee calculation calls to use the new method signatures

## Example Test Updates

```javascript
// Old initialization
assetDAO = await upgrades.deployProxy(
  AssetDAOWithFees,
  ["D-AI Asset Token", "D-AI", feeCalculator.address, feeProcessor.address]
);

// New initialization
assetDAO = await upgrades.deployProxy(
  AssetDAOWithFees,
  [daiToken.address, feeCalculator.address, treasury.address, priceOracle.address]
);

// Old investment call
await assetDAO.invest(assetToken, amount);

// New investment call
await assetDAO.invest(assetToken, amount);

// Old divestment call
await assetDAO.divest(tokens, assetToken);

// New divestment call
await assetDAO.divest(assetToken, shareAmount, isRagequit);
```

## Affected Components

The following components may need updates to work with the new version:

1. Test suites
2. Deployment scripts
3. Frontend integration
4. Documentation