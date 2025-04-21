# Dependency Resolution Guide

## Common Dependency Issues

When working with the DLOOP smart contract project, you may encounter dependency conflicts, particularly between different versions of `ethers` and Hardhat plugins. This guide helps resolve these issues.

## Main Issue: Ethers Version Conflict

The primary conflict occurs between:
- `ethers@^5.7.2` (required by the original project)
- `ethers@^6.1.0+` (required by `@nomicfoundation/hardhat-ethers@3.0.0+`)

This results in the error:
```
npm error ERESOLVE unable to resolve dependency tree
```

## Solution 1: Use the Final Project Bundle

The easiest solution is to use our prepared project bundle with resolved dependencies:

1. Download the "Final Project Bundle" from the website
2. This bundle includes:
   - Updated `package.json` with compatible dependencies
   - Configured `hardhat.config.js` for ethers v6
   - All necessary OpenZeppelin contracts (including `@openzeppelin/contracts-upgradeable`)

## Solution 2: Manual Resolution (For Existing Projects)

If you need to fix an existing project:

1. Update your `package.json` to use ethers v6:
```json
"dependencies": {
  "@nomicfoundation/hardhat-toolbox": "^3.0.0",
  "@openzeppelin/contracts": "^4.9.3",
  "@openzeppelin/contracts-upgradeable": "^4.9.3",
  "@openzeppelin/hardhat-upgrades": "^2.3.3",
  "chai": "^4.3.7",
  "ethers": "^6.6.2",
  "hardhat": "^2.17.3",
  "hardhat-gas-reporter": "^1.0.9",
  "hardhat-storage-layout": "^0.1.7",
  "solidity-coverage": "^0.8.4"
},
"devDependencies": {
  "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
  "@nomicfoundation/hardhat-ethers": "^3.0.0",
  "@nomicfoundation/hardhat-network-helpers": "^1.0.0", 
  "@nomicfoundation/hardhat-verify": "^1.0.0",
  "@typechain/ethers-v6": "^0.4.0",
  "@typechain/hardhat": "^8.0.0",
  "typechain": "^8.2.0"
}
```

2. Update your Hardhat config to be compatible with ethers v6:
```javascript
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    },
    // other networks...
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  }
};
```

3. Install dependencies:
```bash
npm install
```

## Solution 3: Using Legacy Peer Dependencies

If you can't update to ethers v6 due to specific compatibility requirements:

```bash
npm install --legacy-peer-deps
```

This will install packages even with conflicting peer dependencies, but may result in functionality issues.

## Important Notes

1. Upgrading from ethers v5 to v6 may require code changes in your test files and scripts
2. The updated hardhat.config.js is optimized for the new dependency versions
3. Make sure all OpenZeppelin contracts are installed, including `@openzeppelin/contracts-upgradeable`

## Running Tests After Fixing Dependencies

Once dependencies are resolved, run tests with:

```bash
npx hardhat test
```

For comprehensive testing:

```bash
npm run test:comprehensive
```

## Troubleshooting

If you encounter issues after dependency resolution:

1. Try clearing your node_modules folder and reinstalling:
```bash
rm -rf node_modules
npm install
```

2. Check for compatibility with Solidity version in hardhat.config.js
3. Ensure all import statements in your contracts use the correct paths

For further assistance, refer to the project documentation.