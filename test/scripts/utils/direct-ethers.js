/**
 * Direct Ethers v6 Testing Helper
 * 
 * This module provides reliable, direct implementations of Ethers functionality
 * without relying on Hardhat's wrapper. This helps bypass compatibility issues.
 */

const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

// Use a direct provider connection
const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// Define test accounts with same private keys as Hardhat default accounts
const TEST_ACCOUNTS = [
  {
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  },
  {
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  },
  {
    privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
  },
  {
    privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
  },
  {
    privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  }
];

/**
 * Get signers (wallets) for testing
 * @returns {Promise<Array<Wallet>>} Array of connected wallet instances
 */
async function getSigners() {
  try {
    // Create wallet instances connected to provider
    return TEST_ACCOUNTS.map(account => {
      const wallet = new ethers.Wallet(account.privateKey);
      return wallet.connect(provider);
    });
  } catch (error) {
    console.error("Error creating signers:", error.message);
    
    // Fallback: return mock signers with addresses
    return TEST_ACCOUNTS.map(account => ({
      address: account.address,
      getAddress: () => account.address,
      provider: provider,
      connect: (provider) => ({ ...this, provider })
    }));
  }
}

/**
 * Get a contract factory for direct deployment
 * @param {string} contractName Name of the contract
 * @returns {Promise<ContractFactory>} A contract factory connected to a signer
 */
async function getContractFactory(contractName) {
  try {
    // Find the artifact file
    const possiblePaths = [
      path.join(process.cwd(), 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'core', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'mocks', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'tokens', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'fees', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'oracles', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'identity', `${contractName}.sol`, `${contractName}.json`),
      path.join(process.cwd(), 'artifacts', 'contracts', 'governance', `${contractName}.sol`, `${contractName}.json`),
    ];
    
    // Find first existing artifact path
    let artifactPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        artifactPath = p;
        break;
      }
    }
    
    if (!artifactPath) {
      // Try to find it recursively as a fallback
      const findArtifact = (dir, name) => {
        if (!fs.existsSync(dir)) return null;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            const found = findArtifact(fullPath, name);
            if (found) return found;
          } else if (entry.name === `${name}.json`) {
            return fullPath;
          }
        }
        
        return null;
      };
      
      artifactPath = findArtifact(path.join(process.cwd(), 'artifacts'), contractName);
    }
    
    if (!artifactPath) {
      throw new Error(`Artifact not found for ${contractName}`);
    }
    
    console.log(`Found artifact for ${contractName} at: ${artifactPath}`);
    
    // Load the artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;
    const bytecode = artifact.bytecode;
    
    if (!abi || !bytecode) {
      throw new Error(`Invalid artifact for ${contractName} - missing abi or bytecode`);
    }
    
    // Get the first signer
    const [signer] = await getSigners();
    
    // Create and return the factory
    return new ethers.ContractFactory(abi, bytecode, signer);
  } catch (error) {
    console.error(`Error creating contract factory for ${contractName}:`, error.message);
    throw error;
  }
}

/**
 * Get a deployed contract instance at an address
 * @param {string} address Contract address
 * @param {Array} abi Contract ABI
 * @param {Signer} [signer] Optional signer to connect with
 * @returns {Promise<Contract>} Contract instance
 */
async function getContractAt(address, abi, signer) {
  try {
    if (!signer) {
      const signers = await getSigners();
      signer = signers[0];
    }
    
    return new ethers.Contract(address, abi, signer);
  } catch (error) {
    console.error(`Error getting contract at ${address}:`, error.message);
    throw error;
  }
}

/**
 * Convenience function to parse ether units
 * @param {string} value Amount as string
 * @returns {bigint} Value in wei
 */
function parseEther(value) {
  return ethers.parseEther(value);
}

/**
 * Convenience function to format ether units
 * @param {bigint|string} value Wei amount
 * @returns {string} Formatted ether amount
 */
function formatEther(value) {
  return ethers.formatEther(value);
}

/**
 * Convenience function to parse units
 * @param {string} value Amount as string
 * @param {number} decimals Number of decimals
 * @returns {bigint} Value in smallest units
 */
function parseUnits(value, decimals = 18) {
  return ethers.parseUnits(value, decimals);
}

/**
 * Convenience function to format units
 * @param {bigint|string} value Amount in smallest units
 * @param {number} decimals Number of decimals
 * @returns {string} Formatted amount
 */
function formatUnits(value, decimals = 18) {
  return ethers.formatUnits(value, decimals);
}

/**
 * Get gas price
 * @returns {Promise<bigint>} Current gas price
 */
async function getGasPrice() {
  return await provider.getGasPrice();
}

/**
 * Send a transaction and wait for it to be mined
 * @param {Object} tx Transaction to send
 * @returns {Promise<TransactionReceipt>} Transaction receipt
 */
async function sendTransaction(tx) {
  const [signer] = await getSigners();
  const txResponse = await signer.sendTransaction(tx);
  return await txResponse.wait();
}

// Export the functions
module.exports = {
  provider,
  getSigners,
  getContractFactory,
  getContractAt,
  parseEther,
  formatEther,
  parseUnits,
  formatUnits,
  getGasPrice,
  sendTransaction,
  TEST_ACCOUNTS, // Export accounts for direct use if needed
  ethers // Export ethers for convenience
};