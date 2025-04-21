// SPDX-License-Identifier: MIT
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

/**
 * @notice Deploys the consolidated D-Loop contract system to Sepolia testnet
 * This script adapts the deployment process to work with the consolidated contract structure
 */
async function main() {
  console.log("Starting deployment of consolidated D-Loop contracts to Sepolia testnet...");
  
  // Get the network information
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (${network.chainId})`);
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);

  // Deploy the DLoopToken from consolidated/tokens folder
  console.log("\nDeploying DLoopToken...");
  const DLoopToken = await ethers.getContractFactory("consolidated-contracts/tokens/DLoopToken");
  const dloopToken = await upgrades.deployProxy(DLoopToken, 
    ["D-Loop Governance Token", "DLOOP"], 
    { kind: 'uups', initializer: 'initialize' }
  );
  await dloopToken.deployed();
  console.log(`DLoopToken deployed to: ${dloopToken.address}`);
  
  // Deploy the ChainlinkPriceOracle (replacement for RateQuoterV2)
  console.log("\nDeploying ChainlinkPriceOracle...");
  const ChainlinkPriceOracle = await ethers.getContractFactory("consolidated-contracts/oracles/ChainlinkPriceOracle");
  const priceOracle = await upgrades.deployProxy(ChainlinkPriceOracle, 
    [deployer.address, "0x0000000000000000000000000000000000000000"], // Default admin & initial pauser
    { kind: 'uups', initializer: 'initialize' }
  );
  await priceOracle.deployed();
  console.log(`ChainlinkPriceOracle deployed to: ${priceOracle.address}`);
  
  // Deploy the MultiOracleConsensus
  console.log("\nDeploying MultiOracleConsensus...");
  const MultiOracleConsensus = await ethers.getContractFactory("consolidated-contracts/oracles/MultiOracleConsensus");
  const oracleConsensus = await upgrades.deployProxy(MultiOracleConsensus, 
    [deployer.address, priceOracle.address], 
    { kind: 'uups', initializer: 'initialize' }
  );
  await oracleConsensus.deployed();
  console.log(`MultiOracleConsensus deployed to: ${oracleConsensus.address}`);
  
  // Deploy the Treasury from fees folder
  console.log("\nDeploying Treasury...");
  const Treasury = await ethers.getContractFactory("consolidated-contracts/fees/Treasury");
  const treasury = await upgrades.deployProxy(Treasury, 
    [deployer.address, "0x0000000000000000000000000000000000000000"], // Default admin & initial pauser
    { kind: 'uups', initializer: 'initialize' }
  );
  await treasury.deployed();
  console.log(`Treasury deployed to: ${treasury.address}`);
  
  // Deploy the FeeCalculator
  console.log("\nDeploying FeeCalculator...");
  const FeeCalculator = await ethers.getContractFactory("consolidated-contracts/fees/FeeCalculator");
  const feeCalculator = await upgrades.deployProxy(FeeCalculator, 
    [deployer.address, treasury.address], 
    { kind: 'uups', initializer: 'initialize' }
  );
  await feeCalculator.deployed();
  console.log(`FeeCalculator deployed to: ${feeCalculator.address}`);
  
  // Deploy the AssetDAOWithFees
  console.log("\nDeploying AssetDAOWithFees...");
  const AssetDAOWithFees = await ethers.getContractFactory("consolidated-contracts/fees/AssetDAOWithFees");
  // Note: AssetDAOWithFees uses a constructor rather than initializer
  const assetDAO = await AssetDAOWithFees.deploy(
    feeCalculator.address,
    deployer.address
  );
  await assetDAO.deployed();
  console.log(`AssetDAOWithFees deployed to: ${assetDAO.address}`);
  
  // Deploy the ProtocolDAO from governance folder
  console.log("\nDeploying ProtocolDAO...");
  const ProtocolDAO = await ethers.getContractFactory("consolidated-contracts/governance/ProtocolDAO");
  const protocolDAO = await upgrades.deployProxy(ProtocolDAO, 
    [
      deployer.address, 
      dloopToken.address,
      assetDAO.address
    ], 
    { kind: 'uups', initializer: 'initialize' }
  );
  await protocolDAO.deployed();
  console.log(`ProtocolDAO deployed to: ${protocolDAO.address}`);
  
  // Setup initial configuration
  console.log("\nSetting up initial configuration...");
  
  // Grant roles to Treasury and FeeCalculator
  const CALCULATOR_ROLE = await feeCalculator.FEE_MANAGER_ROLE();
  await feeCalculator.grantRole(CALCULATOR_ROLE, deployer.address);
  console.log("Granted FEE_MANAGER_ROLE to deployer in FeeCalculator");
  
  // Setup fee percentages
  await feeCalculator.setFeePercentages(1000, 500, 2000); // 10% invest, 5% divest, 20% ragequit
  console.log("Set fee percentages in FeeCalculator");
  
  // Grant ADMIN_ROLE to the deployer in PriceOracle
  const ORACLE_ADMIN_ROLE = await priceOracle.DEFAULT_ADMIN_ROLE();
  await priceOracle.grantRole(ORACLE_ADMIN_ROLE, deployer.address);
  console.log("Granted ADMIN_ROLE to deployer in ChainlinkPriceOracle");
  
  // Register the MultiOracleConsensus with the ChainlinkPriceOracle
  await priceOracle.setOracleConsensus(oracleConsensus.address);
  console.log("Set Oracle Consensus in ChainlinkPriceOracle");
  
  // Register the Treasury in the FeeCalculator
  await treasury.grantRole(await treasury.TREASURY_MANAGER_ROLE(), feeCalculator.address);
  console.log("Granted TREASURY_MANAGER_ROLE to FeeCalculator in Treasury");
  
  // Setup protocol governance
  const GOVERNANCE_ROLE = await protocolDAO.GOVERNANCE_MANAGER_ROLE();
  await protocolDAO.grantRole(GOVERNANCE_ROLE, deployer.address);
  console.log("Granted GOVERNANCE_MANAGER_ROLE to deployer in ProtocolDAO");
  
  // Grant UPGRADER_ROLE to the deployer in all contracts that support it
  await protocolDAO.grantRole(await protocolDAO.UPGRADER_ROLE(), deployer.address);
  await dloopToken.grantRole(await dloopToken.UPGRADER_ROLE(), deployer.address);
  await treasury.grantRole(await treasury.UPGRADER_ROLE(), deployer.address);
  await priceOracle.grantRole(await priceOracle.UPGRADER_ROLE(), deployer.address);
  await oracleConsensus.grantRole(await oracleConsensus.UPGRADER_ROLE(), deployer.address);
  await feeCalculator.grantRole(await feeCalculator.UPGRADER_ROLE(), deployer.address);
  console.log("Granted UPGRADER_ROLE to deployer in all upgradeable contracts");
  
  // Save deployment information to file
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString()
    },
    deployer: deployer.address,
    contracts: {
      dloopToken: dloopToken.address,
      priceOracle: priceOracle.address,
      oracleConsensus: oracleConsensus.address,
      treasury: treasury.address,
      feeCalculator: feeCalculator.address,
      assetDAO: assetDAO.address,
      protocolDAO: protocolDAO.address
    },
    timestamp: new Date().toISOString()
  };
  
  // Save to JSON file
  fs.writeFileSync(
    "deployment-consolidated-info.json", 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment information saved to deployment-consolidated-info.json");
  
  console.log("\nDeployment of consolidated contracts completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });