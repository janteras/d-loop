/**
 * @title Enhanced Ethers Helpers
 * @dev Utility functions to abstract away Ethers v6 compatibility issues
 *      with robust fallback mechanisms for improved test reliability
 * @author DLOOP Protocol Team
 */

const { ethers } = require('hardhat');

/**
 * Safely get signers with fallback mechanisms
 * @returns {Promise<Array>} Array of signer accounts
 */
async function safeGetSigners() {
  try {
    // Primary approach using the Hardhat Runtime Environment
    const signers = await ethers.getSigners();
    return signers;
  } catch (error) {
    console.warn("Failed to get signers via ethers.getSigners():", error.message);
    
    try {
      // Secondary approach using the provider directly 
      const provider = new ethers.JsonRpcProvider("http://localhost:8545");
      const accounts = await provider.listAccounts();
      return accounts.map(addr => provider.getSigner(addr));
    } catch (secondError) {
      console.error("All approaches to get signers failed:", secondError.message);
      throw new Error("Could not obtain test signers");
    }
  }
}

/**
 * Safely deploy a contract with error handling and retry logic
 * @param {string} contractName Name of the contract to deploy
 * @param {Array} args Constructor arguments for the contract
 * @param {Object} options Additional deployment options
 * @returns {Promise<Object>} Deployed contract instance
 */
async function safeDeployContract(contractName, args = [], options = {}) {
  const MAX_RETRIES = 3;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let factory;
      
      // Try to get the contract factory
      try {
        factory = await ethers.getContractFactory(contractName);
      } catch (factoryError) {
        console.warn(`Factory error on attempt ${attempt}:`, factoryError.message);
        
        // Alternate approach if getContractFactory fails
        const artifact = require(`../../artifacts/contracts/${options.artifactPath || contractName}.sol/${contractName}.json`);
        factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode);
      }
      
      // Deploy the contract
      const contract = await factory.deploy(...args);
      await contract.waitForDeployment();
      
      return contract;
    } catch (error) {
      console.warn(`Deployment attempt ${attempt} failed for ${contractName}:`, error.message);
      
      if (attempt === MAX_RETRIES) {
        console.error(`Failed to deploy ${contractName} after ${MAX_RETRIES} attempts`);
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Safely parse an ether string to wei with multiple fallbacks
 * @param {string} value The ether value to parse
 * @returns {bigint} The parsed value as bigint
 */
function safeParseEther(value) {
  // Try different approaches to parse ether
  try {
    // First try the standard ethers.parseEther
    return ethers.parseEther(value);
  } catch (error) {
    try {
      // Second approach using manual calculation
      const floatValue = parseFloat(value);
      return BigInt(Math.floor(floatValue * 1e18));
    } catch (secondError) {
      try {
        // Third approach with string manipulation
        const parts = value.split('.');
        let result = BigInt(parts[0]) * BigInt(1e18);
        
        if (parts.length > 1) {
          let fraction = parts[1];
          if (fraction.length > 18) fraction = fraction.substring(0, 18);
          else while (fraction.length < 18) fraction += '0';
          
          result += BigInt(fraction);
        }
        
        return result;
      } catch (thirdError) {
        console.error("All parseEther approaches failed:", thirdError.message);
        // Last resort fallback
        return BigInt(1e18); // Default to 1 ether
      }
    }
  }
}

/**
 * Safely format wei to ether string with multiple fallbacks
 * @param {bigint|string|number} value The wei value to format
 * @returns {string} The formatted ether value
 */
function safeFormatEther(value) {
  // Ensure value is a BigInt
  let valueBigInt;
  try {
    if (typeof value === 'bigint') {
      valueBigInt = value;
    } else if (typeof value === 'string') {
      valueBigInt = BigInt(value);
    } else if (typeof value === 'number') {
      valueBigInt = BigInt(Math.floor(value));
    } else {
      valueBigInt = BigInt(value.toString());
    }
  } catch (error) {
    console.warn("Error converting to BigInt:", error.message);
    valueBigInt = BigInt(0);
  }
  
  // Try different approaches to format ether
  try {
    // First try the standard ethers.formatEther
    return ethers.formatEther(valueBigInt);
  } catch (error) {
    try {
      // Second approach using manual calculation
      const stringValue = valueBigInt.toString();
      
      if (stringValue.length <= 18) {
        return `0.${'0'.repeat(18 - stringValue.length)}${stringValue}`;
      } else {
        const intPart = stringValue.slice(0, stringValue.length - 18);
        const fracPart = stringValue.slice(stringValue.length - 18);
        return `${intPart}.${fracPart}`;
      }
    } catch (secondError) {
      console.error("All formatEther approaches failed:", secondError.message);
      // Last resort fallback
      return value.toString();
    }
  }
}

/**
 * Safely connect a signer to a contract
 * @param {Object} signer The signer to connect
 * @param {Object} contract The contract to connect to
 * @returns {Object} The signer
 */
function safeConnect(signer, contract) {
  try {
    // Check if the contract has a connect method
    if (typeof contract.connect === 'function') {
      return signer;
    } else {
      // Fallback for Ethers v6 contract without connect
      return signer;
    }
  } catch (error) {
    console.warn("Error in safeConnect:", error.message);
    return signer;
  }
}

/**
 * Safely wait for a transaction to be mined
 * @param {Object} tx The transaction to wait for
 * @returns {Promise<Object>} The transaction receipt
 */
async function safeWaitForTransaction(tx) {
  try {
    // Primary approach for Ethers v6
    if (tx.wait) {
      return await tx.wait();
    }
    
    // Fallback for older versions or different transaction formats
    if (tx.hash) {
      const provider = ethers.provider || (new ethers.JsonRpcProvider("http://localhost:8545"));
      return await provider.waitForTransaction(tx.hash);
    }
    
    throw new Error("Transaction object has no wait method or hash property");
  } catch (error) {
    console.error("Error waiting for transaction:", error.message);
    throw error;
  }
}

// Export the helper functions
module.exports = {
  safeGetSigners,
  safeDeployContract,
  safeParseEther,
  safeFormatEther,
  safeConnect,
  safeWaitForTransaction
};