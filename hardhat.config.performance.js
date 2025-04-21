require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-chai-matchers");
require("@nomicfoundation/hardhat-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 30,
    showTimeSpent: true,
    excludeContracts: ['mocks/'],
    outputFile: 'reports/gas-report.txt',
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: 'ETH',
    gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    showMethodSig: true,
    showMethodName: true
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      gas: 12000000,
      blockGasLimit: 12000000,
      mining: {
        auto: true,
        interval: 0
      },
      throwOnTransactionFailures: true,
      throwOnCallFailures: true
    }
  },
  paths: {
    tests: './test/performance',
    cache: './cache',
    artifacts: './artifacts',
    reports: './reports/performance'
  }
};
