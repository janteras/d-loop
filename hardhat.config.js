require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");
require("solidity-coverage");
require("hardhat-abi-exporter");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
// Import required modules
const path = require('path');

// Get environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/ca485bd6567e4c5fb5693ee66a5885d8";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "HG7DAYXKN5B6AZE35WRDVQRSNN5IDC3ZG6";

// Register the ethers-shim for global usage
// This is done without importing hardhat to avoid circular dependencies
require('./test/utils/register-ethers-shim');

module.exports = {
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      sepolina: ETHERSCAN_API_KEY
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
    overrides: {
      "test/mocks/*.sol": {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    }
  },
  
  // Path aliases for standardized imports
  paths: {
    sources: ["./contracts", "./test/mocks"],
    tests: "./test",
    artifacts: "./artifacts",
    cache: "./cache"
  },
  networks: {
    hardhat: {
      hardfork: "london",
      gasPrice: "auto",
      initialBaseFeePerGas: 1000000000,
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 300000
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 'auto',
      gas: 6000000,
      timeout: 300000,
      confirmations: 2,
      saveDeployments: true
    },
    sepolina: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,  // Same as Sepolia for compatibility
      gasPrice: 'auto',
      gas: 6000000,
      timeout: 300000,
      confirmations: 2,
      saveDeployments: true
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    artifacts: "./artifacts"
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true
  },
  abiExporter: {
    path: "./abi",
    clear: true,
    flat: true,
    only: [':AssetDAO$', ':ProtocolDAO$', ':Treasury$', ':DLoopToken$', ':DAIToken$', ':FeeProcessor$', ':AINodeRegistry$', ':SoulboundNFT$'],
    spacing: 2,
    format: "json"
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: 'USD',
    gasPrice: 30,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: ['mocks/'],
    src: './contracts',
    showMethodSig: true,
    showTimeSpent: true,
    noColors: false,
    outputFile: process.env.GAS_REPORT_FILE
  },
  coverage: {
    exclude: [
      'mocks/**/*',
      'test/**/*',
      'scripts/**/*',
      'interfaces/**/*'
    ],
    include: [
      'contracts/core/**/*',
      'contracts/fees/**/*',
      'contracts/governance/**/*',
      'contracts/identity/**/*',
      'contracts/oracles/**/*',
      'contracts/token/**/*',
      'contracts/utils/**/*'
    ],
    statements: 95,
    branches: 95,
    functions: 100,
    lines: 95,
    reporterOptions: {
      html: {
        outdir: './reports/coverage'
      },
      json: {
        outdir: './reports/coverage',
        file: 'coverage-summary.json'
      }
    }
  }
};
