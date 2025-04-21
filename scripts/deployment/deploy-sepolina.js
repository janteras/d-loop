/**
 * @title D-Loop Protocol Sepolina Testnet Deployment Script
 * @dev Script to deploy the D-Loop Protocol to the Sepolina Testnet
 * @notice This script handles the deployment and verification of all protocol contracts
 */

const { ethers, network, run } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Deployment configuration
const config = {
  // Contract deployment order matters due to dependencies
  contracts: [
    { name: 'SoulboundNFT', args: ['$ADMIN_ADDRESS'] }, // Requires admin address
    { name: 'DLoopToken', args: ['$ADMIN_ADDRESS'] }, // $ADMIN_ADDRESS will be replaced with actual address
    { name: 'ProtocolDAO', args: ['$TOKEN_ADDRESS'] },
    { name: 'AINodeRegistry', args: ['$ADMIN_ADDRESS', '$DAO_ADDRESS', '$SOULBOUND_ADDRESS'] },
    { name: 'Treasury', args: ['$DAO_ADDRESS'] },
    { name: 'GovernanceRewards', args: ['$TOKEN_ADDRESS', '$DAO_ADDRESS'] },
    { name: 'PriceOracle', args: ['$DAO_ADDRESS'] }
  ],
  // Post-deployment configuration steps
  postDeployment: [
    { contract: 'SoulboundNFT', method: 'grantMinterRole', args: ['$REGISTRY_ADDRESS'] },
    { contract: 'DLoopToken', method: 'grantMinterRole', args: ['$DAO_ADDRESS'] },
    { contract: 'ProtocolDAO', method: 'setTreasury', args: ['$TREASURY_ADDRESS'] },
    { contract: 'ProtocolDAO', method: 'setRegistry', args: ['$REGISTRY_ADDRESS'] },
    { contract: 'ProtocolDAO', method: 'setRewards', args: ['$REWARDS_ADDRESS'] }
  ]
};

// Deployment results storage
const deploymentResults = {
  network: '',
  contracts: {},
  transactions: []
};

/**
 * Main deployment function
 */
async function main() {
  // Ensure we're on the Sepolina network
  if (network.name !== 'sepolina' && network.name !== 'sepolia') {
    console.error('This script is intended to be run on the Sepolina/Sepolia testnet only');
    console.error(`Current network: ${network.name}`);
    process.exit(1);
  }
  
  console.log(`Deploying D-Loop Protocol to ${network.name} testnet...`);
  
  // Get deployer account
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  console.log(`Deployer address: ${deployerAddress}`);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  
  // Ensure deployer has enough ETH
  if (balance < ethers.parseEther('0.5')) {
    console.error(`Insufficient ETH balance for deployment. Need at least 0.5 ETH`);
    process.exit(1);
  }
  
  // Store network info
  deploymentResults.network = {
    name: network.name,
    chainId: network.config.chainId,
    deployer: deployerAddress,
    timestamp: new Date().toISOString()
  };
  
  // Deploy all contracts in order
  const deployedContracts = {};
  
  for (const contractConfig of config.contracts) {
    const { name, args } = contractConfig;
    console.log(`Deploying ${name}...`);
    
    // Replace placeholder args with actual addresses
    const resolvedArgs = args.map(arg => {
      if (typeof arg !== 'string') return arg;
      if (arg === '$ADMIN_ADDRESS') return deployerAddress;
      if (arg === '$TOKEN_ADDRESS' && deployedContracts.DLoopToken) return deployedContracts.DLoopToken.target;
      if (arg === '$DAO_ADDRESS' && deployedContracts.ProtocolDAO) return deployedContracts.ProtocolDAO.target;
      if (arg === '$SOULBOUND_ADDRESS' && deployedContracts.SoulboundNFT) return deployedContracts.SoulboundNFT.target;
      if (arg === '$REGISTRY_ADDRESS' && deployedContracts.AINodeRegistry) return deployedContracts.AINodeRegistry.target;
      if (arg === '$TREASURY_ADDRESS' && deployedContracts.Treasury) return deployedContracts.Treasury.target;
      if (arg === '$REWARDS_ADDRESS' && deployedContracts.GovernanceRewards) return deployedContracts.GovernanceRewards.target;
      return arg;
    });
    
    // Deploy the contract
    const Contract = await ethers.getContractFactory(name);
    console.log(`Deploying ${name} with args:`, resolvedArgs);
    
    // Deploy with proper error handling
    let contract;
    try {
      contract = await Contract.deploy(...resolvedArgs);
      // Wait for deployment to complete (ethers v6 syntax)
      const receipt = await contract.deploymentTransaction().wait(2); // Wait for 2 confirmations
      console.log(`${name} deployed to: ${contract.target} in tx: ${receipt.hash}`);
    } catch (error) {
      console.error(`Error deploying ${name}:`, error.message);
      process.exit(1);
    }
    
    // Store deployment info
    deployedContracts[name] = contract;
    deploymentResults.contracts[name] = {
      address: contract.target,
      args: resolvedArgs,
      transaction: contract.deploymentTransaction().hash
    };
    
    // Add deployment transaction to list
    deploymentResults.transactions.push({
      hash: contract.deploymentTransaction().hash,
      type: 'deployment',
      contract: name,
      timestamp: new Date().toISOString()
    });
    
    // Verify contract on Etherscan
    try {
      console.log(`Waiting 30 seconds before verification...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds for the contract to be indexed
      
      console.log(`Verifying ${name} on Etherscan...`);
      await run('verify:verify', {
        address: contract.target,
        constructorArguments: resolvedArgs
      });
      console.log(`${name} verified successfully`);
    } catch (error) {
      console.error(`Error verifying ${name}:`, error.message);
      // Continue with deployment even if verification fails
    }
    
    // Wait a bit between deployments to avoid nonce issues
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Execute post-deployment configuration
  console.log('\nExecuting post-deployment configuration...');
  
  for (const step of config.postDeployment) {
    const { contract, method, args } = step;
    console.log(`Configuring ${contract}.${method}...`);
    
    // Replace placeholder args with actual addresses
    const resolvedArgs = args.map(arg => {
      if (typeof arg !== 'string') return arg;
      if (arg === '$ADMIN_ADDRESS') return deployerAddress;
      if (arg === '$TOKEN_ADDRESS' && deployedContracts.DLoopToken) return deployedContracts.DLoopToken.target;
      if (arg === '$DAO_ADDRESS' && deployedContracts.ProtocolDAO) return deployedContracts.ProtocolDAO.target;
      if (arg === '$SOULBOUND_ADDRESS' && deployedContracts.SoulboundNFT) return deployedContracts.SoulboundNFT.target;
      if (arg === '$REGISTRY_ADDRESS' && deployedContracts.AINodeRegistry) return deployedContracts.AINodeRegistry.target;
      if (arg === '$TREASURY_ADDRESS' && deployedContracts.Treasury) return deployedContracts.Treasury.target;
      if (arg === '$REWARDS_ADDRESS' && deployedContracts.GovernanceRewards) return deployedContracts.GovernanceRewards.target;
      return arg;
    });
    
    // Execute the configuration method with proper error handling
    try {
      console.log(`Executing ${contract}.${method} with args:`, resolvedArgs);
      const tx = await deployedContracts[contract][method](...resolvedArgs);
      const receipt = await tx.wait(1); // Wait for 1 confirmation
      
      console.log(`${contract}.${method} executed successfully in tx: ${receipt.hash}`);
      
      // Add configuration transaction to list
      deploymentResults.transactions.push({
        hash: receipt.hash,
        type: 'configuration',
        contract: contract,
        method: method,
        args: resolvedArgs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error executing ${contract}.${method}:`, error.message);
      // Continue with other configuration steps even if one fails
    }
    
    // Wait a bit between transactions to avoid nonce issues
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save deployment results to file
  const deploymentPath = path.join(__dirname, '../../deployments');
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  
  const filename = `deployment-${network.name}-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(
    path.join(deploymentPath, filename),
    JSON.stringify(deploymentResults, null, 2)
  );
  
  console.log(`\nDeployment complete! Results saved to deployments/${filename}`);
  console.log('\nDeployed Contracts:');
  Object.entries(deploymentResults.contracts).forEach(([name, info]) => {
    console.log(`${name}: ${info.address}`);
  });
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
