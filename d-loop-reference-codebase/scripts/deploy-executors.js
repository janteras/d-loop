// SPDX-License-Identifier: MIT
const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying DAO Executors with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get contract addresses from existing deployment
  // These would be populated with your actual deployed contract addresses
  const protocolDAOAddress = "0x..."; // Replace with actual address
  const assetDAOAddress = "0x...";    // Replace with actual address
  const feeCalculatorAddress = "0x..."; // Replace with actual address
  const daoIntegratorAddress = "0x..."; // Replace with actual address
  const governanceRewardsAddress = "0x..."; // Replace with actual address
  const hederaBridgeAddress = "0x..."; // Replace with actual address
  
  // Emergency team address (multisig wallet)
  const emergencyTeamAddress = "0x..."; // Replace with actual address

  // Deploy UpgradeExecutor
  console.log("\nDeploying UpgradeExecutor...");
  const UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
  const upgradeExecutor = await UpgradeExecutor.deploy(
    deployer.address, // admin
    protocolDAOAddress // protocolDAO
  );
  await upgradeExecutor.deployed();
  console.log("UpgradeExecutor deployed to:", upgradeExecutor.address);

  // Deploy ParameterAdjuster
  console.log("\nDeploying ParameterAdjuster...");
  const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
  const parameterAdjuster = await ParameterAdjuster.deploy(
    deployer.address, // admin
    protocolDAOAddress, // protocolDAO
    assetDAOAddress, // assetDAO
    feeCalculatorAddress // feeCalculator
  );
  await parameterAdjuster.deployed();
  console.log("ParameterAdjuster deployed to:", parameterAdjuster.address);

  // Deploy EmergencyPauser
  console.log("\nDeploying EmergencyPauser...");
  const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
  const emergencyPauser = await EmergencyPauser.deploy(
    deployer.address, // admin
    protocolDAOAddress, // protocolDAO
    emergencyTeamAddress // emergencyTeam
  );
  await emergencyPauser.deployed();
  console.log("EmergencyPauser deployed to:", emergencyPauser.address);

  // Set target contracts in EmergencyPauser
  console.log("\nSetting target contracts in EmergencyPauser...");
  await emergencyPauser.setAssetDAO(assetDAOAddress);
  await emergencyPauser.setDAOIntegrator(daoIntegratorAddress);
  await emergencyPauser.setHederaBridge(hederaBridgeAddress);
  await emergencyPauser.setGovernanceRewards(governanceRewardsAddress);
  console.log("Target contracts set in EmergencyPauser");

  // Write out all deployment addresses
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("UpgradeExecutor:", upgradeExecutor.address);
  console.log("ParameterAdjuster:", parameterAdjuster.address);
  console.log("EmergencyPauser:", emergencyPauser.address);

  // Verify contracts (if not on a local network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    
    // Wait a bit for contracts to be indexed by Etherscan
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second delay
    
    try {
      await hre.run("verify:verify", {
        address: upgradeExecutor.address,
        constructorArguments: [
          deployer.address,
          protocolDAOAddress
        ],
      });
      
      await hre.run("verify:verify", {
        address: parameterAdjuster.address,
        constructorArguments: [
          deployer.address,
          protocolDAOAddress,
          assetDAOAddress,
          feeCalculatorAddress
        ],
      });
      
      await hre.run("verify:verify", {
        address: emergencyPauser.address,
        constructorArguments: [
          deployer.address,
          protocolDAOAddress,
          emergencyTeamAddress
        ],
      });
      
    } catch (error) {
      console.error("Error during verification:", error);
    }
  }

  console.log("\nDeployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });