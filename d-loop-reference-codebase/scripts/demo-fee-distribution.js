const { ethers } = require("hardhat");

async function main() {
  const [deployer, investor1, investor2, assetDao] = await ethers.getSigners();
  console.log("Demonstrating fee distribution with the account:", deployer.address);
  
  // Initial fee percentages (in basis points)
  const INVEST_FEE_PERCENTAGE = 100; // 1%
  const DIVEST_FEE_PERCENTAGE = 50; // 0.5%
  const RAGEQUIT_FEE_PERCENTAGE = 200; // 2%
  
  // Fee distribution percentages
  const TREASURY_PERCENTAGE = 7000; // 70%
  const REWARD_DIST_PERCENTAGE = 3000; // 30%
  
  // Deploy MockERC20 (USDC token) for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);
  await usdcToken.deployed();
  console.log("USDC Token deployed to:", usdcToken.address);
  
  // Deploy MockERC20 (DLOOP token) for testing
  const dloopToken = await MockERC20.deploy("DLOOP Token", "DLOOP", 18);
  await dloopToken.deployed();
  console.log("DLOOP Token deployed to:", dloopToken.address);
  
  // Mint USDC to investors
  const investor1Amount = ethers.utils.parseUnits("100000", 6); // 100,000 USDC
  const investor2Amount = ethers.utils.parseUnits("250000", 6); // 250,000 USDC
  await usdcToken.mint(investor1.address, investor1Amount);
  await usdcToken.mint(investor2.address, investor2Amount);
  console.log("Minted", ethers.utils.formatUnits(investor1Amount, 6), "USDC to investor1");
  console.log("Minted", ethers.utils.formatUnits(investor2Amount, 6), "USDC to investor2");
  
  // Mint initial DLOOP tokens to the deployer
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
  
  // Set up roles for FeeCollector
  await feeCollector.addAssetDAORole(assetDao.address);
  
  // Set up roles for RewardDistributor
  await rewardDistributor.addAssetDAORole(deployer.address);
  
  console.log("\n--- Demonstration Setup Complete ---\n");
  
  // ======= DEMONSTRATION STARTS HERE =======
  
  // Investor 1 invests 100,000 USDC
  console.log("\n=== Investor 1 Invests 100,000 USDC ===");
  const invest1Amount = ethers.utils.parseUnits("100000", 6);
  
  // Transfer USDC to Asset DAO
  await usdcToken.connect(investor1).transfer(assetDao.address, invest1Amount);
  console.log("Investor 1 transferred 100,000 USDC to Asset DAO");
  
  // Asset DAO approves fee collector to take fees
  await usdcToken.connect(assetDao).approve(feeCollector.address, ethers.constants.MaxUint256);
  console.log("Asset DAO approved FeeCollector to spend USDC");
  
  // Check balances before fee collection
  const treasuryBalanceBefore = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceBefore = await usdcToken.balanceOf(rewardDistributor.address);
  
  // Asset DAO collects invest fee
  const investFee = await feeCalculator.calculateInvestFee(invest1Amount);
  console.log("Calculated invest fee:", ethers.utils.formatUnits(investFee, 6), "USDC");
  
  const investTx = await feeCollector.connect(assetDao).collectInvestFee(usdcToken.address, invest1Amount);
  await investTx.wait();
  console.log("Asset DAO collected invest fee");
  
  // Check balances after fee collection
  const treasuryBalanceAfter = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceAfter = await usdcToken.balanceOf(rewardDistributor.address);
  
  const treasuryFee = investFee.mul(TREASURY_PERCENTAGE).div(10000);
  const rewardFee = investFee.mul(REWARD_DIST_PERCENTAGE).div(10000);
  
  console.log("Treasury received:", ethers.utils.formatUnits(treasuryBalanceAfter.sub(treasuryBalanceBefore), 6), "USDC");
  console.log("RewardDistributor received:", ethers.utils.formatUnits(rewardDistBalanceAfter.sub(rewardDistBalanceBefore), 6), "USDC");
  
  // ======= INVESTOR 2 INVESTS =======
  
  console.log("\n=== Investor 2 Invests 250,000 USDC ===");
  const invest2Amount = ethers.utils.parseUnits("250000", 6);
  
  // Transfer USDC to Asset DAO
  await usdcToken.connect(investor2).transfer(assetDao.address, invest2Amount);
  console.log("Investor 2 transferred 250,000 USDC to Asset DAO");
  
  // Check balances before fee collection
  const treasuryBalanceBefore2 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceBefore2 = await usdcToken.balanceOf(rewardDistributor.address);
  
  // Asset DAO collects invest fee
  const investFee2 = await feeCalculator.calculateInvestFee(invest2Amount);
  console.log("Calculated invest fee:", ethers.utils.formatUnits(investFee2, 6), "USDC");
  
  const invest2Tx = await feeCollector.connect(assetDao).collectInvestFee(usdcToken.address, invest2Amount);
  await invest2Tx.wait();
  console.log("Asset DAO collected invest fee");
  
  // Check balances after fee collection
  const treasuryBalanceAfter2 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceAfter2 = await usdcToken.balanceOf(rewardDistributor.address);
  
  const treasuryFee2 = investFee2.mul(TREASURY_PERCENTAGE).div(10000);
  const rewardFee2 = investFee2.mul(REWARD_DIST_PERCENTAGE).div(10000);
  
  console.log("Treasury received:", ethers.utils.formatUnits(treasuryBalanceAfter2.sub(treasuryBalanceBefore2), 6), "USDC");
  console.log("RewardDistributor received:", ethers.utils.formatUnits(rewardDistBalanceAfter2.sub(rewardDistBalanceBefore2), 6), "USDC");
  
  // ======= INVESTOR 1 DIVESTS PARTIAL =======
  
  console.log("\n=== Investor 1 Divests 50,000 USDC ===");
  const divest1Amount = ethers.utils.parseUnits("50000", 6);
  
  // Check balances before fee collection
  const treasuryBalanceBefore3 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceBefore3 = await usdcToken.balanceOf(rewardDistributor.address);
  
  // Asset DAO collects divest fee
  const divestFee1 = await feeCalculator.calculateDivestFee(divest1Amount);
  console.log("Calculated divest fee:", ethers.utils.formatUnits(divestFee1, 6), "USDC");
  
  const divest1Tx = await feeCollector.connect(assetDao).collectDivestFee(usdcToken.address, divest1Amount);
  await divest1Tx.wait();
  console.log("Asset DAO collected divest fee");
  
  // Check balances after fee collection
  const treasuryBalanceAfter3 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceAfter3 = await usdcToken.balanceOf(rewardDistributor.address);
  
  console.log("Treasury received:", ethers.utils.formatUnits(treasuryBalanceAfter3.sub(treasuryBalanceBefore3), 6), "USDC");
  console.log("RewardDistributor received:", ethers.utils.formatUnits(rewardDistBalanceAfter3.sub(rewardDistBalanceBefore3), 6), "USDC");
  
  // ======= INVESTOR 2 RAGEQUITS =======
  
  console.log("\n=== Investor 2 Rage Quits with 250,000 USDC ===");
  const ragequitAmount = ethers.utils.parseUnits("250000", 6);
  
  // Check balances before fee collection
  const treasuryBalanceBefore4 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceBefore4 = await usdcToken.balanceOf(rewardDistributor.address);
  
  // Asset DAO collects ragequit fee
  const ragequitFee = await feeCalculator.calculateRagequitFee(ragequitAmount);
  console.log("Calculated ragequit fee:", ethers.utils.formatUnits(ragequitFee, 6), "USDC");
  
  const ragequitTx = await feeCollector.connect(assetDao).collectRagequitFee(usdcToken.address, ragequitAmount);
  await ragequitTx.wait();
  console.log("Asset DAO collected ragequit fee");
  
  // Check balances after fee collection
  const treasuryBalanceAfter4 = await usdcToken.balanceOf(treasury.address);
  const rewardDistBalanceAfter4 = await usdcToken.balanceOf(rewardDistributor.address);
  
  console.log("Treasury received:", ethers.utils.formatUnits(treasuryBalanceAfter4.sub(treasuryBalanceBefore4), 6), "USDC");
  console.log("RewardDistributor received:", ethers.utils.formatUnits(rewardDistBalanceAfter4.sub(rewardDistBalanceBefore4), 6), "USDC");
  
  // ======= SUMMARY =======
  
  console.log("\n=== Fee Collection Summary ===");
  console.log("Total fees collected:", ethers.utils.formatUnits(
    treasuryBalanceAfter4.add(rewardDistBalanceAfter4), 6
  ), "USDC");
  console.log("Treasury total:", ethers.utils.formatUnits(treasuryBalanceAfter4, 6), "USDC");
  console.log("RewardDistributor total:", ethers.utils.formatUnits(rewardDistBalanceAfter4, 6), "USDC");
  
  const treasuryPercentage = treasuryBalanceAfter4.mul(10000).div(treasuryBalanceAfter4.add(rewardDistBalanceAfter4));
  const rewardPercentage = rewardDistBalanceAfter4.mul(10000).div(treasuryBalanceAfter4.add(rewardDistBalanceAfter4));
  
  console.log("Treasury percentage:", treasuryPercentage.toNumber() / 100, "%");
  console.log("RewardDistributor percentage:", rewardPercentage.toNumber() / 100, "%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });