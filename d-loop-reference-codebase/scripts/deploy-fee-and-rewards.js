const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Initial fee percentages (in basis points)
  const INVEST_FEE_PERCENTAGE = 100; // 1%
  const DIVEST_FEE_PERCENTAGE = 50; // 0.5%
  const RAGEQUIT_FEE_PERCENTAGE = 200; // 2%
  
  // Fee distribution percentages
  const TREASURY_PERCENTAGE = 7000; // 70%
  const REWARD_DIST_PERCENTAGE = 3000; // 30%
  
  // Deploy MockERC20 (DLOOP token) for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const dloopToken = await MockERC20.deploy("DLOOP Token", "DLOOP", 18);
  await dloopToken.deployed();
  console.log("DLOOP Token deployed to:", dloopToken.address);
  
  // Mint initial tokens to the deployer
  const initialMint = ethers.utils.parseEther("21000000"); // 21 million DLOOP
  await dloopToken.mint(deployer.address, initialMint);
  console.log("Minted", ethers.utils.formatEther(initialMint), "DLOOP tokens to deployer");
  
  // Deploy SoulboundNFT for AI Node identification
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy("AI Node NFT", "AINFT");
  await soulboundNFT.deployed();
  console.log("SoulboundNFT deployed to:", soulboundNFT.address);
  
  // Deploy AINodeIdentifier
  const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
  const aiNodeIdentifier = await AINodeIdentifier.deploy(soulboundNFT.address);
  await aiNodeIdentifier.deployed();
  console.log("AINodeIdentifier deployed to:", aiNodeIdentifier.address);
  
  // Grant minter role to AINodeIdentifier
  await soulboundNFT.grantMinterRole(aiNodeIdentifier.address);
  console.log("Granted minter role to AINodeIdentifier");
  
  // Deploy FeeCalculator
  const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
  const feeCalculator = await FeeCalculator.deploy(
    INVEST_FEE_PERCENTAGE,
    DIVEST_FEE_PERCENTAGE,
    RAGEQUIT_FEE_PERCENTAGE
  );
  await feeCalculator.deployed();
  console.log("FeeCalculator deployed to:", feeCalculator.address);
  
  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.deployed();
  console.log("Treasury deployed to:", treasury.address);
  
  // Deploy RewardDistributor
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await RewardDistributor.deploy(dloopToken.address, aiNodeIdentifier.address);
  await rewardDistributor.deployed();
  console.log("RewardDistributor deployed to:", rewardDistributor.address);
  
  // Transfer initial rewards to RewardDistributor
  const rewardAmount = ethers.utils.parseEther("20016000"); // 20,016,000 DLOOP
  await dloopToken.transfer(rewardDistributor.address, rewardAmount);
  console.log("Transferred", ethers.utils.formatEther(rewardAmount), "DLOOP to RewardDistributor");
  
  // Deploy FeeCollector
  const FeeCollector = await ethers.getContractFactory("FeeCollector");
  const feeCollector = await FeeCollector.deploy(
    treasury.address,
    rewardDistributor.address,
    feeCalculator.address,
    TREASURY_PERCENTAGE,
    REWARD_DIST_PERCENTAGE
  );
  await feeCollector.deployed();
  console.log("FeeCollector deployed to:", feeCollector.address);
  
  // Set up roles for Treasury
  await treasury.addWithdrawalRole(deployer.address);
  console.log("Granted withdrawal role to deployer in Treasury");
  
  // Set up roles for FeeCollector
  await feeCollector.addAssetDAORole(deployer.address);
  console.log("Granted Asset DAO role to deployer in FeeCollector");
  
  // Set up roles for RewardDistributor
  await rewardDistributor.addAssetDAORole(deployer.address);
  console.log("Granted Asset DAO role to deployer in RewardDistributor");
  
  console.log("Fee structure and governance rewards setup complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });