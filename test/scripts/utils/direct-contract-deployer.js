/**
 * Direct Contract Deployer
 * 
 * This utility provides functions for directly deploying contracts
 * without relying on Hardhat's provider, which can cause compatibility
 * issues with Ethers v6.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Creates a provider connected to a local node
 * @returns {ethers.JsonRpcProvider} The provider
 */
function createProvider() {
  return new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
}

/**
 * Loads a contract artifact by name
 * @param {string} contractName The name of the contract
 * @returns {Object} The contract artifact
 */
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let files = [];
  
  // Search for the contract file recursively
  function searchForArtifact(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          searchForArtifact(itemPath);
        } else if (item.name === `${contractName}.json`) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${dir}:`, error);
    }
  }
  
  searchForArtifact(artifactPath);
  
  if (files.length === 0) {
    throw new Error(`Artifact for ${contractName} not found`);
  }
  
  console.log(`Found artifact for ${contractName} at: ${files[0]}`);
  return JSON.parse(fs.readFileSync(files[0], 'utf8'));
}

/**
 * Safely executes a function with proper error handling
 * @param {string} operationName Name of the operation
 * @param {Function} func The function to execute
 * @returns {Promise<any>} The result of the function
 */
async function safeExecute(operationName, func) {
  console.log(`\n[${operationName}] Starting...`);
  try {
    const result = await func();
    console.log(`[${operationName}] Completed successfully`);
    return result;
  } catch (error) {
    console.error(`[${operationName}] Failed:`, error);
    throw error;
  }
}

/**
 * Deploys a contract with robust error handling for Ethers v6
 * @param {string} contractName The name of the contract
 * @param {Signer} signer The signer to use for deployment
 * @param {Array} constructorArgs The constructor arguments
 * @param {Object} options Additional deployment options
 * @returns {Promise<Contract>} The deployed contract
 */
async function deployContract(contractName, signer, constructorArgs = [], options = {}) {
  return safeExecute(`Deploy ${contractName}`, async () => {
    const artifact = loadArtifact(contractName);
    
    console.log(`Deploying ${contractName} with args:`, constructorArgs);
    
    try {
      // First attempt using ContractFactory
      const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        signer
      );
      
      const contract = await factory.deploy(...constructorArgs, { 
        ...options,
        gasLimit: options.gasLimit || 9000000  // Default high gas limit
      });
      
      await contract.waitForDeployment();
      
      const address = await contract.getAddress();
      console.log(`${contractName} deployed to: ${address}`);
      
      return contract;
    } catch (error) {
      // Check if it's the transaction sending error
      if (error.code === 'UNSUPPORTED_OPERATION' && 
          error.operation === 'sendTransaction') {
        console.log(`Using alternative deployment method for ${contractName}`);
        
        // Use low-level deployment as fallback
        // First, encode constructor arguments
        let encodedArgs = '0x';
        if (constructorArgs.length > 0) {
          // Find the constructor ABI
          const constructorAbi = artifact.abi.find(item => item.type === 'constructor');
          
          if (constructorAbi && constructorAbi.inputs.length > 0) {
            // Create Interface to encode constructor parameters
            const contractInterface = new ethers.Interface(artifact.abi);
            
            // Get parameter types from constructor inputs
            const types = constructorAbi.inputs.map(input => input.type);
            
            // Encode constructor arguments
            encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(types, constructorArgs)
              .slice(2); // Remove '0x' prefix
          }
        }
        
        // Combine bytecode with encoded constructor arguments
        const deploymentData = artifact.bytecode + encodedArgs;
        
        // Send transaction
        const tx = await signer.sendTransaction({
          data: deploymentData,
          gasLimit: options.gasLimit || 9000000
        });
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        // Get the deployed contract address from receipt
        const contractAddress = receipt.contractAddress;
        
        console.log(`${contractName} deployed to: ${contractAddress} (using alternative method)`);
        
        // Create contract instance
        return new ethers.Contract(contractAddress, artifact.abi, signer);
      }
      
      // If it's a different error, rethrow it
      throw error;
    }
  });
}

/**
 * Gets the contract at an existing address
 * @param {string} contractName The name of the contract
 * @param {string} address The contract address
 * @param {Signer|Provider} signerOrProvider The signer or provider
 * @returns {Promise<Contract>} The contract instance
 */
async function getContractAt(contractName, address, signerOrProvider) {
  return safeExecute(`Get ${contractName} at ${address}`, async () => {
    const artifact = loadArtifact(contractName);
    return new ethers.Contract(address, artifact.abi, signerOrProvider);
  });
}

/**
 * Gets all contract artifacts needed for integration tests
 * @returns {Promise<Object>} Object containing all contract artifacts
 */
async function getAllContractArtifacts() {
  return {
    SoulboundNFT: loadArtifact('SoulboundNFT'),
    MockToken: loadArtifact('MockToken'),
    AINodeRegistry: loadArtifact('AINodeRegistry'),
    Treasury: loadArtifact('Treasury'),
    PriceOracle: loadArtifact('PriceOracle'),
    FeeCalculator: loadArtifact('FeeCalculator')
  };
}

/**
 * Deploys all core contracts for integration testing
 * @param {Signer} deployer The deployer signer
 * @param {Object} addresses Optional addresses for constructor args
 * @returns {Promise<Object>} The deployed contracts
 */
async function deployAllContracts(deployer, addresses = {}) {
  return safeExecute('Deploy all contracts', async () => {
    // Deploy SoulboundNFT
    const soulboundNFT = await deployContract('SoulboundNFT', deployer, [
      addresses.admin || await deployer.getAddress()
    ]);
    
    // Deploy MockToken
    const mockToken = await deployContract('MockToken', deployer, [
      "DLOOP Test Token", 
      "DTEST", 
      18
    ]);
    
    // Deploy AINodeRegistry
    const aiNodeRegistry = await deployContract('AINodeRegistry', deployer, [
      addresses.admin || await deployer.getAddress(),
      await mockToken.getAddress(),
      await soulboundNFT.getAddress()
    ]);
    
    // Deploy Treasury
    const treasury = await deployContract('Treasury', deployer, [
      addresses.admin || await deployer.getAddress(),
      await mockToken.getAddress()
    ]);
    
    // Deploy PriceOracle
    const priceOracle = await deployContract('PriceOracle', deployer, [
      addresses.admin || await deployer.getAddress()
    ]);
    
    // Deploy FeeCalculator
    const feeCalculator = await deployContract('FeeCalculator', deployer, [
      addresses.admin || await deployer.getAddress(),
      await priceOracle.getAddress()
    ]);
    
    return {
      soulboundNFT,
      mockToken,
      aiNodeRegistry,
      treasury,
      priceOracle,
      feeCalculator
    };
  });
}

module.exports = {
  createProvider,
  loadArtifact,
  safeExecute,
  deployContract,
  getContractAt,
  getAllContractArtifacts,
  deployAllContracts
};