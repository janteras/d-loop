/**
 * DLOOP Protocol Full System Deployment Script
 * 
 * This script deploys the complete DLOOP protocol system including:
 * - Core tokens (DLoop Token)
 * - Oracle system (ChainlinkPriceOracle, MultiOracleConsensus)
 * - Governance system (Protocol DAO, Asset DAO)
 * - Reward system (Governance Rewards)
 * - Identity system (AI Node Registry, Soulbound NFT)
 * - Fee system (Fee Calculator, Treasury)
 */
const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

// Wait function to avoid rate limits and errors
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Deployment helper
async function deploy(contractName, constructorArgs = [], logMessage = "") {
  console.log(`Deploying ${contractName}${logMessage ? ': ' + logMessage : ''}...`);
  
  const Factory = await ethers.getContractFactory(contractName);
  const contract = await Factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  
  console.log(`${contractName} deployed to: ${contract.target}`);
  return contract;
}

// Deployment helper for upgradeable contracts
async function deployUpgradeable(contractName, constructorArgs = [], logMessage = "") {
  console.log(`Deploying Upgradeable ${contractName}${logMessage ? ': ' + logMessage : ''}...`);
  
  const Factory = await ethers.getContractFactory(contractName);
  const contract = await upgrades.deployProxy(Factory, constructorArgs);
  await contract.waitForDeployment();
  
  console.log(`Upgradeable ${contractName} deployed to: ${contract.target}`);
  return contract;
}

async function main() {
  console.log("Starting deployment of DLOOP Protocol full system...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Deployer balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  
  // Deploy addresses object to store all deployed contracts
  const deployedAddresses = {};
  
  try {
    // Step 1: Deploy DLoop token first
    console.log("\n--- Step 1: Deploying Core Token ---");
    const initialSupply = ethers.parseEther("1000000"); // 1 million tokens
    const dloopToken = await deploy(
      "DLoopToken", 
      [deployer.address, initialSupply],
      "Initial supply: 1 million tokens"
    );
    deployedAddresses.DLoopToken = dloopToken.target;
    
    // Wait a bit to avoid transaction nonce issues
    await wait(3000);
    
    // Step 2: Deploy Oracle System
    console.log("\n--- Step 2: Deploying Oracle System ---");
    
    // Deploy ChainlinkPriceOracle
    const chainlinkOracle = await deploy("ChainlinkPriceOracle");
    deployedAddresses.ChainlinkPriceOracle = chainlinkOracle.target;
    
    await wait(3000);
    
    // Deploy MultiOracleConsensus
    const multiOracle = await deploy("MultiOracleConsensus");
    deployedAddresses.MultiOracleConsensus = multiOracle.target;
    
    await wait(3000);
    
    // Step 3: Deploy Identity System
    console.log("\n--- Step 3: Deploying Identity System ---");
    
    // Deploy SoulboundNFT for AI Node credentials
    const soulboundNFT = await deploy(
      "SoulboundNFT", 
      ["DLOOP AI Node Credential", "DAIC"]
    );
    deployedAddresses.SoulboundNFT = soulboundNFT.target;
    
    await wait(3000);
    
    // Deploy AINodeRegistry
    const aiNodeRegistry = await deploy(
      "AINodeRegistry", 
      [soulboundNFT.target, multiOracle.target]
    );
    deployedAddresses.AINodeRegistry = aiNodeRegistry.target;
    
    // Grant minter role to the registry
    console.log("Granting MINTER_ROLE to AINodeRegistry on SoulboundNFT...");
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    await soulboundNFT.grantRole(MINTER_ROLE, aiNodeRegistry.target);
    
    await wait(3000);
    
    // Step 4: Deploy Fee System
    console.log("\n--- Step 4: Deploying Fee System ---");
    
    // Deploy Treasury
    const treasury = await deploy("Treasury", [dloopToken.target]);
    deployedAddresses.Treasury = treasury.target;
    
    await wait(3000);
    
    // Deploy FeeCalculator
    const feeCalculator = await deploy(
      "FeeCalculator", 
      [
        treasury.target, 
        multiOracle.target,
        1000, // 10% invest fee (in basis points)
        500,  // 5% divest fee (in basis points)
        2000  // 20% ragequit fee (in basis points)
      ]
    );
    deployedAddresses.FeeCalculator = feeCalculator.target;
    
    await wait(3000);
    
    // Step 5: Deploy Governance System
    console.log("\n--- Step 5: Deploying Governance System ---");
    
    // Deploy ProtocolDAO
    const protocolDAO = await deployUpgradeable(
      "ProtocolDAOEnhanced", 
      [
        dloopToken.target, 
        aiNodeRegistry.target,
        multiOracle.target,
        86400,  // 1 day for AI votes 
        604800  // 7 days for human votes
      ]
    );
    deployedAddresses.ProtocolDAO = protocolDAO.target;
    
    await wait(3000);
    
    // Deploy AssetDAO with fee calculation
    const assetDAO = await deployUpgradeable(
      "AssetDAOWithFees", 
      [
        dloopToken.target, 
        feeCalculator.target,
        treasury.target,
        multiOracle.target
      ]
    );
    deployedAddresses.AssetDAO = assetDAO.target;
    
    await wait(3000);
    
    // Step 6: Deploy Reward System
    console.log("\n--- Step 6: Deploying Reward System ---");
    
    // Deploy AdvancedGovernanceRewards
    const governanceRewards = await deploy(
      "AdvancedGovernanceRewards", 
      [
        dloopToken.target,
        multiOracle.target,
        protocolDAO.target,
        aiNodeRegistry.target,
        assetDAO.target
      ]
    );
    deployedAddresses.GovernanceRewards = governanceRewards.target;
    
    await wait(3000);
    
    // Deploy RewardDistributor for monthly rewards
    const rewardDistributor = await deploy(
      "RewardDistributor", 
      [
        dloopToken.target,
        governanceRewards.target,
        2592000, // 30 days in seconds
        72       // 6 years in months
      ]
    );
    deployedAddresses.RewardDistributor = rewardDistributor.target;
    
    await wait(3000);
    
    // Step 7: Configure system components
    console.log("\n--- Step 7: Configuring System Components ---");
    
    // Transfer tokens to reward distributor
    const rewardAmount = ethers.parseEther("600000"); // 600k tokens for 6-year distribution
    console.log(`Transferring ${ethers.formatEther(rewardAmount)} DLoop tokens to RewardDistributor...`);
    await dloopToken.transfer(rewardDistributor.target, rewardAmount);
    
    // Set GovernanceRewards in ProtocolDAO
    console.log("Setting GovernanceRewards in ProtocolDAO...");
    await protocolDAO.setGovernanceRewards(governanceRewards.target);
    
    // Set AssetDAO in ProtocolDAO
    console.log("Setting AssetDAO in ProtocolDAO...");
    await protocolDAO.setAssetDAO(assetDAO.target);
    
    // Set RewardDistributor address in GovernanceRewards
    console.log("Setting RewardDistributor in GovernanceRewards...");
    await governanceRewards.setRewardDistributor(rewardDistributor.target);
    
    // Set authorized contracts in Treasury
    console.log("Setting authorized contracts in Treasury...");
    await treasury.addAuthorizedAddress(feeCalculator.target);
    await treasury.addAuthorizedAddress(assetDAO.target);
    
    // Print all deployed addresses
    console.log("\n--- Deployment Summary ---");
    console.log(JSON.stringify(deployedAddresses, null, 2));
    
    // Save addresses to a file
    const fs = require("fs");
    fs.writeFileSync(
      "deployed-addresses.json",
      JSON.stringify(deployedAddresses, null, 2)
    );
    console.log("Addresses saved to deployed-addresses.json");
    
    console.log("\nDLOOP Protocol full system deployment complete!");
    
  } catch (error) {
    console.error("Error during deployment:", error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });