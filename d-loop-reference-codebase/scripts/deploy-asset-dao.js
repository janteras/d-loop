// SPDX-License-Identifier: MIT
const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Asset DAO System with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy Fee Calculator
  console.log("\nDeploying FeeCalculator...");
  const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
  const feeCalculator = await FeeCalculator.deploy(
    deployer.address, // admin
    deployer.address, // temporary treasury - will update later
    ethers.utils.parseEther("0.1"), // investFee (10%)
    ethers.utils.parseEther("0.05"), // divestFee (5%)
    ethers.utils.parseEther("0.2")  // ragequitFee (20%)
  );
  await feeCalculator.deployed();
  console.log("FeeCalculator deployed to:", feeCalculator.address);

  // Deploy Treasury
  console.log("\nDeploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    deployer.address, // admin
    70, // treasuryShare (70%)
    30  // rewardsShare (30%)
  );
  await treasury.deployed();
  console.log("Treasury deployed to:", treasury.address);

  // Update fee recipient in FeeCalculator
  console.log("\nUpdating fee recipient in FeeCalculator...");
  await feeCalculator.setFeeRecipient(treasury.address);
  console.log("Fee recipient updated to:", treasury.address);

  // Deploy DAI Token (upgradeable)
  console.log("\nDeploying DAI Token...");
  const DAIToken = await ethers.getContractFactory("DAIToken");
  const daiToken = await upgrades.deployProxy(DAIToken, [
    deployer.address, // admin
    deployer.address, // temporary assetDAO - will update later
    treasury.address, // treasury
    ethers.utils.parseEther("10000000") // mintingCap (10M tokens)
  ]);
  await daiToken.deployed();
  console.log("DAI Token deployed to:", daiToken.address);

  // Deploy Protocol DAO (simplified for testing)
  console.log("\nDeploying Protocol DAO...");
  const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
  const protocolDAO = await ProtocolDAO.deploy(deployer.address);
  await protocolDAO.deployed();
  console.log("Protocol DAO deployed to:", protocolDAO.address);

  // Deploy Price Oracle
  console.log("\nDeploying Price Oracle...");
  const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
  const priceOracle = await ChainlinkPriceOracle.deploy(deployer.address);
  await priceOracle.deployed();
  console.log("Price Oracle deployed to:", priceOracle.address);

  // Deploy Asset DAO (upgradeable)
  console.log("\nDeploying Asset DAO...");
  const AssetDAO = await ethers.getContractFactory("AssetDAO");
  const assetDAO = await upgrades.deployProxy(AssetDAO, [
    deployer.address, // admin
    protocolDAO.address, // protocolDAO
    daiToken.address, // daiToken
    feeCalculator.address, // feeCalculator
    priceOracle.address, // priceOracle
    treasury.address, // treasury
    3000, // quorum (30%)
    86400, // votingPeriod (1 day in seconds)
    43200  // executionDelay (12 hours in seconds)
  ]);
  await assetDAO.deployed();
  console.log("Asset DAO deployed to:", assetDAO.address);

  // Update DAI token's AssetDAO role
  console.log("\nUpdating DAI token roles...");
  const ASSET_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ASSET_DAO_ROLE"));
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  
  await daiToken.grantRole(ASSET_DAO_ROLE, assetDAO.address);
  await daiToken.grantRole(MINTER_ROLE, assetDAO.address);
  console.log("DAI token roles updated for Asset DAO");

  // Deploy Ragequit Handler (upgradeable)
  console.log("\nDeploying Ragequit Handler...");
  const RagequitHandler = await ethers.getContractFactory("RagequitHandler");
  const ragequitHandler = await upgrades.deployProxy(RagequitHandler, [
    deployer.address, // admin
    assetDAO.address, // assetDAO
    daiToken.address, // daiToken
    feeCalculator.address, // feeCalculator
    priceOracle.address, // priceOracle
    604800, // ragequitCooldown (7 days in seconds)
    1000    // maxRagequitAmount (10% of total supply per day)
  ]);
  await ragequitHandler.deployed();
  console.log("Ragequit Handler deployed to:", ragequitHandler.address);

  // Deploy DAO Integrator (upgradeable)
  console.log("\nDeploying DAO Integrator...");
  const DAOIntegrator = await ethers.getContractFactory("DAOIntegrator");
  const daoIntegrator = await upgrades.deployProxy(DAOIntegrator, [
    deployer.address, // admin
    protocolDAO.address, // protocolDAO
    assetDAO.address // assetDAO
  ]);
  await daoIntegrator.deployed();
  console.log("DAO Integrator deployed to:", daoIntegrator.address);

  // Write out all deployment addresses
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("DAI Token:", daiToken.address);
  console.log("Asset DAO:", assetDAO.address);
  console.log("Protocol DAO:", protocolDAO.address);
  console.log("Fee Calculator:", feeCalculator.address);
  console.log("Treasury:", treasury.address);
  console.log("Price Oracle:", priceOracle.address);
  console.log("Ragequit Handler:", ragequitHandler.address);
  console.log("DAO Integrator:", daoIntegrator.address);

  // Verify contracts (if not on a local network)
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    
    // Wait a bit for contracts to be indexed by Etherscan
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second delay
    
    try {
      await hre.run("verify:verify", {
        address: feeCalculator.address,
        constructorArguments: [
          deployer.address,
          treasury.address,
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("0.05"),
          ethers.utils.parseEther("0.2")
        ],
      });
      
      await hre.run("verify:verify", {
        address: treasury.address,
        constructorArguments: [
          deployer.address,
          70,
          30
        ],
      });
      
      await hre.run("verify:verify", {
        address: protocolDAO.address,
        constructorArguments: [deployer.address],
      });
      
      await hre.run("verify:verify", {
        address: priceOracle.address,
        constructorArguments: [deployer.address],
      });
      
      // Note: For upgradeable contracts, verification is different
      console.log("Upgradeable contracts (DAI Token, Asset DAO, Ragequit Handler, DAO Integrator) require manual verification");
      
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