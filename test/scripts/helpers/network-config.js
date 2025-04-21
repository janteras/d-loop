/**
 * Network Configuration Helper
 * 
 * This file provides consistent network configuration for standalone tests
 * to ensure they all connect to the same Hardhat node instance.
 */

// Network configuration
const networkConfig = {
  // Use 0.0.0.0 instead of localhost/127.0.0.1 for consistent connections
  url: 'http://0.0.0.0:8545',
  chainId: 31337,
  // Standard Hardhat network accounts
  accounts: [
    {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      balance: '10000000000000000000000'
    },
    {
      privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      balance: '10000000000000000000000'
    },
    {
      privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
      balance: '10000000000000000000000'
    }
  ]
};

// Create a consistent helper for connecting to the network
async function createProvider(retries = 10, ethers) {
  console.log(`Attempting to connect to the network at ${networkConfig.url}`);
  
  // Function to create a provider with proper configuration
  const initProvider = () => {
    try {
      // Check if we're using ethers v5 or v6
      if (ethers.providers && ethers.providers.JsonRpcProvider) {
        // Ethers v5 style
        return new ethers.providers.JsonRpcProvider(networkConfig.url);
      } else if (ethers.JsonRpcProvider) {
        // Ethers v6 style
        return new ethers.JsonRpcProvider(networkConfig.url);
      } else {
        // Hardhat's built-in provider
        return ethers.provider;
      }
    } catch (error) {
      console.error('Error creating provider:', error.message);
      return null;
    }
  };
  
  // Try to create and connect with retries
  let provider = initProvider();
  let connected = false;
  let attemptsLeft = retries;
  
  while (!connected && attemptsLeft > 0) {
    try {
      // Test the connection
      await provider.getBlockNumber();
      connected = true;
      console.log('Successfully connected to the network!');
    } catch (error) {
      attemptsLeft--;
      console.log(`Connection failed: ${error.message}`);
      if (attemptsLeft > 0) {
        console.log(`Attempting to connect to the network (${attemptsLeft} retries left)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        provider = initProvider();
      }
    }
  }
  
  if (!connected) {
    throw new Error('Failed to connect to the network after multiple attempts');
  }
  
  return provider;
}

module.exports = {
  networkConfig,
  createProvider
};