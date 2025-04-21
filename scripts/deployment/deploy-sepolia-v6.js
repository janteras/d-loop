/**
 * @title D-Loop Protocol Sepolia Testnet Deployment Script (ethers.js v6 compatible)
 * @dev Script to deploy the D-Loop Protocol to the Sepolia Testnet
 * @notice This script handles the deployment and verification of all protocol contracts
 */

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Deployment configuration
const config = {
  // Contract deployment order matters due to dependencies
  contracts: [
    { name: 'SoulboundNFT', args: ['$ADMIN_ADDRESS'] }, // Requires admin address
    { name: 'DLoopToken', args: [
      'D-Loop Protocol Token', // name
      'DLOOP', // symbol
      '1000000000000000000000000', // initialSupply (1 million tokens with 18 decimals)
      18, // tokenDecimals
      '100000000000000000000000000', // maxSupply (100 million tokens with 18 decimals)
      '$ADMIN_ADDRESS' // admin address
    ]},
    { name: 'ProtocolDAO', args: [
      '$ADMIN_ADDRESS', // admin
      '$ADMIN_ADDRESS', // treasury (will be updated later)
      '604800', // votingPeriod (7 days in seconds)
      '172800', // executionDelay (2 days in seconds)
      '51' // quorum (51%)
    ] },
    { name: 'AINodeRegistry', args: ['$ADMIN_ADDRESS', '$DAO_ADDRESS', '$SOULBOUND_ADDRESS'] },
    { name: 'Treasury', args: ['$ADMIN_ADDRESS', '$DAO_ADDRESS'] },
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
  const { ethers, network } = hre;
  
  // Ensure we're on the Sepolia network
  if (network.name !== 'sepolia' && network.name !== 'sepolina') {
    console.error('This script is intended to be run on the Sepolia testnet only');
    console.error(`Current network: ${network.name}`);
    process.exit(1);
  }
  
  console.log(`Deploying D-Loop Protocol to ${network.name} testnet...`);
  
  // Get deployer account
  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error('No signers available. Check your network configuration.');
    process.exit(1);
  }
  
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  console.log(`Deployer address: ${deployerAddress}`);
  
  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
  
  // Ensure deployer has enough ETH
  if (balance < ethers.parseEther('0.4')) {
    console.error(`Insufficient ETH balance for deployment. Need at least 0.4 ETH`);
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
    const resolvedArgs = [];
    for (const arg of args) {
      if (typeof arg !== 'string') {
        resolvedArgs.push(arg);
        continue;
      }
      
      if (arg === '$ADMIN_ADDRESS') {
        resolvedArgs.push(deployerAddress);
      } else if (arg === '$TOKEN_ADDRESS' && deployedContracts.DLoopToken) {
        const tokenAddress = await deployedContracts.DLoopToken.getAddress();
        resolvedArgs.push(tokenAddress);
      } else if (arg === '$DAO_ADDRESS' && deployedContracts.ProtocolDAO) {
        const daoAddress = await deployedContracts.ProtocolDAO.getAddress();
        resolvedArgs.push(daoAddress);
      } else if (arg === '$SOULBOUND_ADDRESS' && deployedContracts.SoulboundNFT) {
        const soulboundAddress = await deployedContracts.SoulboundNFT.getAddress();
        resolvedArgs.push(soulboundAddress);
      } else if (arg === '$REGISTRY_ADDRESS' && deployedContracts.AINodeRegistry) {
        const registryAddress = await deployedContracts.AINodeRegistry.getAddress();
        resolvedArgs.push(registryAddress);
      } else if (arg === '$TREASURY_ADDRESS' && deployedContracts.Treasury) {
        const treasuryAddress = await deployedContracts.Treasury.getAddress();
        resolvedArgs.push(treasuryAddress);
      } else if (arg === '$REWARDS_ADDRESS' && deployedContracts.GovernanceRewards) {
        const rewardsAddress = await deployedContracts.GovernanceRewards.getAddress();
        resolvedArgs.push(rewardsAddress);
      } else {
        resolvedArgs.push(arg);
      }
    }
    
    // Deploy the contract
    const ContractFactory = await ethers.getContractFactory(name);
    console.log(`Deploying ${name} with args:`, resolvedArgs);
    
    // Deploy with proper error handling
    let contract;
    try {
      contract = await ContractFactory.deploy(...resolvedArgs);
      // Wait for deployment to complete
      await contract.waitForDeployment();
      const receipt = await contract.deploymentTransaction().wait(2); // Wait for 2 confirmations
      console.log(`${name} deployed to: ${await contract.getAddress()} in tx: ${receipt.hash}`);
    } catch (error) {
      console.error(`Error deploying ${name}:`, error.message);
      process.exit(1);
    }
    
    // Store deployment info
    deployedContracts[name] = contract;
    deploymentResults.contracts[name] = {
      address: await contract.getAddress(),
      args: resolvedArgs,
      transaction: contract.deploymentTransaction().hash
    };
    
    // Add deployment transaction to list
    deploymentResults.transactions.push({
      hash: contract.deploymentTransaction().hash,
      type: 'deploy',
      contract: name,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('All contracts deployed successfully!');
  console.log('Running post-deployment configuration...');
  
  // Execute post-deployment configuration
  for (const step of config.postDeployment) {
    const { contract, method, args } = step;
    console.log(`Configuring ${contract}.${method}...`);
    
    // Replace placeholder args with actual addresses
    const resolvedArgs = [];
    for (const arg of args) {
      if (typeof arg !== 'string') {
        resolvedArgs.push(arg);
        continue;
      }
      
      if (arg === '$ADMIN_ADDRESS') {
        resolvedArgs.push(deployerAddress);
      } else if (arg === '$TOKEN_ADDRESS' && deployedContracts.DLoopToken) {
        resolvedArgs.push(await deployedContracts.DLoopToken.getAddress());
      } else if (arg === '$DAO_ADDRESS' && deployedContracts.ProtocolDAO) {
        resolvedArgs.push(await deployedContracts.ProtocolDAO.getAddress());
      } else if (arg === '$SOULBOUND_ADDRESS' && deployedContracts.SoulboundNFT) {
        resolvedArgs.push(await deployedContracts.SoulboundNFT.getAddress());
      } else if (arg === '$REGISTRY_ADDRESS' && deployedContracts.AINodeRegistry) {
        resolvedArgs.push(await deployedContracts.AINodeRegistry.getAddress());
      } else if (arg === '$TREASURY_ADDRESS' && deployedContracts.Treasury) {
        resolvedArgs.push(await deployedContracts.Treasury.getAddress());
      } else if (arg === '$REWARDS_ADDRESS' && deployedContracts.GovernanceRewards) {
        resolvedArgs.push(await deployedContracts.GovernanceRewards.getAddress());
      } else {
        resolvedArgs.push(arg);
      }
    }
    
    // Execute the configuration method
    try {
      const tx = await deployedContracts[contract][method](...resolvedArgs);
      const receipt = await tx.wait(1);
      console.log(`${contract}.${method} executed in tx: ${receipt.hash}`);
      
      // Store transaction info
      deploymentResults.transactions.push({
        hash: receipt.hash,
        type: 'configure',
        contract: contract,
        method: method,
        args: resolvedArgs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error executing ${contract}.${method}:`, error.message);
      // Continue with other steps even if one fails
    }
  }
  
  // Save deployment results to file
  const deploymentPath = path.join(__dirname, '..', '..', 'deployments');
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  
  const filename = `${network.name}-deployment-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(
    path.join(deploymentPath, filename),
    JSON.stringify(deploymentResults, null, 2)
  );
  
  console.log(`Deployment complete! Results saved to deployments/${filename}`);
  
  // Verify contracts on Etherscan if API key is available
  if (process.env.ETHERSCAN_API_KEY) {
    console.log('Verifying contracts on Etherscan...');
    
    for (const [name, contractInfo] of Object.entries(deploymentResults.contracts)) {
      console.log(`Verifying ${name} at ${contractInfo.address}...`);
      
      try {
        await hre.run('verify:verify', {
          address: contractInfo.address,
          constructorArguments: contractInfo.args
        });
        console.log(`${name} verified successfully!`);
      } catch (error) {
        console.error(`Error verifying ${name}:`, error.message);
        // Continue with other verifications even if one fails
      }
    }
  } else {
    console.log('Etherscan API key not found. Skipping contract verification.');
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
