// SPDX-License-Identifier: MIT
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AssetDAO with Fees with the account:", deployer.address);

  // Deploy Fee Calculator
  console.log("Deploying FeeCalculator...");
  const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
  
  // Setting up initial fee percentages:
  // 10% for investment (0.1 * 1e18 = 1e17)
  // 5% for divestment (0.05 * 1e18 = 5e16)
  // 20% for ragequit (0.2 * 1e18 = 2e17)
  const feeCalculator = await upgrades.deployProxy(
    FeeCalculator,
    [
      ethers.utils.parseEther("0.1"), // invest fee: 10%
      ethers.utils.parseEther("0.05"), // divest fee: 5%
      ethers.utils.parseEther("0.2"), // ragequit fee: 20%
    ]
  );
  await feeCalculator.deployed();
  console.log("FeeCalculator deployed to:", feeCalculator.address);

  // Deploy Treasury
  console.log("Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  
  // 24 hours (86400 seconds) emergency delay
  const treasury = await upgrades.deployProxy(
    Treasury,
    [86400]
  );
  await treasury.deployed();
  console.log("Treasury deployed to:", treasury.address);

  // Deploy RewardDistributor
  console.log("Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  
  // 30 days (2592000 seconds) distribution cycle
  const rewardDistributor = await upgrades.deployProxy(
    RewardDistributor,
    [2592000]
  );
  await rewardDistributor.deployed();
  console.log("RewardDistributor deployed to:", rewardDistributor.address);

  // Deploy FeeProcessor
  console.log("Deploying FeeProcessor...");
  const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
  
  // 70% to Treasury, 30% to RewardDistributor
  const feeProcessor = await upgrades.deployProxy(
    FeeProcessor,
    [
      ethers.utils.parseEther("0.7"), // treasury share: 70%
      ethers.utils.parseEther("0.3"), // rewards share: 30%
      treasury.address,
      rewardDistributor.address,
    ]
  );
  await feeProcessor.deployed();
  console.log("FeeProcessor deployed to:", feeProcessor.address);

  // Deploy AssetDAOWithFees
  console.log("Deploying AssetDAOWithFees...");
  const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
  
  const assetDAO = await upgrades.deployProxy(
    AssetDAOWithFees,
    [
      "D-AI Asset Token", // token name
      "D-AI", // token symbol
      feeCalculator.address,
      feeProcessor.address,
    ]
  );
  await assetDAO.deployed();
  console.log("AssetDAOWithFees deployed to:", assetDAO.address);

  // Grant ASSET_DAO_ROLE to AssetDAO in FeeProcessor
  console.log("Granting ASSET_DAO_ROLE to AssetDAO...");
  const ASSET_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ASSET_DAO_ROLE"));
  await feeProcessor.grantAssetDAORole(assetDAO.address);
  console.log("ASSET_DAO_ROLE granted to AssetDAO");

  // Set up example participants in the RewardDistributor
  console.log("Setting up example participants in RewardDistributor...");
  await rewardDistributor.addParticipant(deployer.address, 3000); // 30%
  
  // Example addresses (replace with real addresses in production)
  const participant1 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const participant2 = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const participant3 = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
  
  await rewardDistributor.addParticipant(participant1, 3000); // 30%
  await rewardDistributor.addParticipant(participant2, 2000); // 20%
  await rewardDistributor.addParticipant(participant3, 2000); // 20%
  console.log("Example participants added");

  console.log("-------------");
  console.log("System deployed successfully!");
  console.log("-------------");
  console.log("FeeCalculator:", feeCalculator.address);
  console.log("FeeProcessor:", feeProcessor.address);
  console.log("Treasury:", treasury.address);
  console.log("RewardDistributor:", rewardDistributor.address);
  console.log("AssetDAOWithFees:", assetDAO.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });