// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("AssetDAO with Fees Integration", function () {
  let deployer, user1, user2, user3;
  let feeCalculator, feeProcessor, treasury, rewardDistributor, assetDAO, mockERC20;

  const ZERO_ADDRESS = ethers.constants.AddressZero;
  
  // Fee percentages
  const INVEST_FEE_PERCENTAGE = ethers.utils.parseEther("0.1"); // 10%
  const DIVEST_FEE_PERCENTAGE = ethers.utils.parseEther("0.05"); // 5%
  const RAGEQUIT_FEE_PERCENTAGE = ethers.utils.parseEther("0.2"); // 20%
  
  // Fee distribution
  const TREASURY_SHARE = ethers.utils.parseEther("0.7"); // 70%
  const REWARDS_SHARE = ethers.utils.parseEther("0.3"); // 30%
  
  // Test values
  const INITIAL_MINT = ethers.utils.parseEther("1000000"); // 1M tokens
  const INVESTMENT_AMOUNT = ethers.utils.parseEther("1000"); // 1000 tokens

  beforeEach(async function () {
    // Get signers
    [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy MockERC20 for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Mock USDC", "USDC", 18);
    await mockERC20.deployed();
    
    // Mint initial tokens to users
    await mockERC20.mint(user1.address, INITIAL_MINT);
    await mockERC20.mint(user2.address, INITIAL_MINT);
    await mockERC20.mint(user3.address, INITIAL_MINT);
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await upgrades.deployProxy(
      FeeCalculator,
      [INVEST_FEE_PERCENTAGE, DIVEST_FEE_PERCENTAGE, RAGEQUIT_FEE_PERCENTAGE]
    );
    await feeCalculator.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await upgrades.deployProxy(
      Treasury,
      [86400] // 24 hours emergency delay
    );
    await treasury.deployed();
    
    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(
      RewardDistributor,
      [2592000] // 30 days distribution cycle
    );
    await rewardDistributor.deployed();
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await upgrades.deployProxy(
      FeeProcessor,
      [TREASURY_SHARE, REWARDS_SHARE, treasury.address, rewardDistributor.address]
    );
    await feeProcessor.deployed();
    
    // Deploy AssetDAOWithFees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAO = await upgrades.deployProxy(
      AssetDAOWithFees,
      ["D-AI Asset Token", "D-AI", feeCalculator.address, feeProcessor.address]
    );
    await assetDAO.deployed();
    
    // Grant ASSET_DAO_ROLE to AssetDAO in FeeProcessor
    await feeProcessor.grantAssetDAORole(assetDAO.address);
    
    // Add supported asset
    await assetDAO.addAsset(mockERC20.address, ethers.utils.parseEther("1")); // 100% weight
    
    // Set up reward participants
    await rewardDistributor.addParticipant(user1.address, 5000); // 50%
    await rewardDistributor.addParticipant(user2.address, 5000); // 50%
  });
  
  describe("Fee System Setup", function () {
    it("Should have correct fee percentages", async function () {
      const fees = await feeCalculator.getFeePercentages();
      expect(fees._investFeePercentage).to.equal(INVEST_FEE_PERCENTAGE);
      expect(fees._divestFeePercentage).to.equal(DIVEST_FEE_PERCENTAGE);
      expect(fees._ragequitFeePercentage).to.equal(RAGEQUIT_FEE_PERCENTAGE);
    });
    
    it("Should have correct fee distribution", async function () {
      const distribution = await feeProcessor.getFeeDistribution();
      expect(distribution._treasuryShare).to.equal(TREASURY_SHARE);
      expect(distribution._rewardsShare).to.equal(REWARDS_SHARE);
    });
    
    it("Should have correct distribution addresses", async function () {
      const addresses = await feeProcessor.getDistributionAddresses();
      expect(addresses._treasury).to.equal(treasury.address);
      expect(addresses._rewardDistributor).to.equal(rewardDistributor.address);
    });
  });
  
  describe("Investment Flow", function () {
    it("Should correctly handle investment with fees", async function () {
      // Approve tokens for investment
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      
      // Record initial balances
      const initialUserBalance = await mockERC20.balanceOf(user1.address);
      const initialAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const initialTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const initialRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // Execute investment
      const investTx = await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Get expected values
      const expectedFee = INVESTMENT_AMOUNT.mul(INVEST_FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const expectedNetAmount = INVESTMENT_AMOUNT.sub(expectedFee);
      const expectedTreasuryAmount = expectedFee.mul(TREASURY_SHARE).div(ethers.utils.parseEther("1"));
      const expectedRewardAmount = expectedFee.sub(expectedTreasuryAmount);
      
      // Check balances after investment
      const finalUserBalance = await mockERC20.balanceOf(user1.address);
      const finalAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const finalTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const finalRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // User should have their tokens deducted
      expect(finalUserBalance).to.equal(initialUserBalance.sub(INVESTMENT_AMOUNT));
      
      // AssetDAO should have the net amount
      expect(finalAssetDAOBalance).to.equal(initialAssetDAOBalance.add(expectedNetAmount));
      
      // Treasury should have its share of the fee
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.add(expectedTreasuryAmount));
      
      // RewardDistributor should have its share of the fee
      expect(finalRewardDistributorBalance).to.equal(initialRewardDistributorBalance.add(expectedRewardAmount));
      
      // Check user received the correct number of D-AI tokens
      const userDaiBalance = await assetDAO.balanceOf(user1.address);
      expect(userDaiBalance).to.equal(expectedNetAmount);
      
      // Check for the Invested event
      await expect(investTx)
        .to.emit(assetDAO, "Invested")
        .withArgs(user1.address, INVESTMENT_AMOUNT, expectedNetAmount, expectedFee);
    });
  });
  
  describe("Divestment Flow", function () {
    beforeEach(async function () {
      // Set up: invest first
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Calculate expected values from investment
      const investFee = INVESTMENT_AMOUNT.mul(INVEST_FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const netInvestmentAmount = INVESTMENT_AMOUNT.sub(investFee);
      
      // Store the net amount for use in tests
      this.netInvestmentAmount = netInvestmentAmount;
    });
    
    it("Should correctly handle divestment with fees", async function () {
      const divestAmount = this.netInvestmentAmount;
      
      // Record initial balances
      const initialUserBalance = await mockERC20.balanceOf(user1.address);
      const initialAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const initialTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const initialRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // Execute divestment
      const divestTx = await assetDAO.connect(user1).divest(divestAmount, mockERC20.address);
      
      // Get expected values
      const expectedFee = divestAmount.mul(DIVEST_FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const expectedNetAmount = divestAmount.sub(expectedFee);
      const expectedTreasuryAmount = expectedFee.mul(TREASURY_SHARE).div(ethers.utils.parseEther("1"));
      const expectedRewardAmount = expectedFee.sub(expectedTreasuryAmount);
      
      // Check balances after divestment
      const finalUserBalance = await mockERC20.balanceOf(user1.address);
      const finalAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const finalTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const finalRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // User should have received the net amount
      expect(finalUserBalance).to.equal(initialUserBalance.add(expectedNetAmount));
      
      // AssetDAO should have reduced its balance by the divested amount
      // Be careful with the exact calculation due to fee transfers
      expect(finalAssetDAOBalance).to.be.closeTo(
        initialAssetDAOBalance.sub(divestAmount), 
        ethers.utils.parseEther("0.000001") // Small delta for rounding
      );
      
      // Treasury should have its share of the fee
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.add(expectedTreasuryAmount));
      
      // RewardDistributor should have its share of the fee
      expect(finalRewardDistributorBalance).to.equal(initialRewardDistributorBalance.add(expectedRewardAmount));
      
      // User should have no D-AI tokens left
      const userDaiBalance = await assetDAO.balanceOf(user1.address);
      expect(userDaiBalance).to.equal(0);
      
      // Check for the Divested event
      await expect(divestTx)
        .to.emit(assetDAO, "Divested")
        .withArgs(user1.address, divestAmount, expectedNetAmount, expectedFee);
    });
  });
  
  describe("RageQuit Flow", function () {
    beforeEach(async function () {
      // Set up: invest first
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Calculate expected values from investment
      const investFee = INVESTMENT_AMOUNT.mul(INVEST_FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const netInvestmentAmount = INVESTMENT_AMOUNT.sub(investFee);
      
      // Store the net amount for use in tests
      this.netInvestmentAmount = netInvestmentAmount;
    });
    
    it("Should correctly handle ragequit with higher fees", async function () {
      const ragequitAmount = this.netInvestmentAmount;
      
      // Record initial balances
      const initialUserBalance = await mockERC20.balanceOf(user1.address);
      const initialAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const initialTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const initialRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // Execute ragequit
      const ragequitTx = await assetDAO.connect(user1).rageQuit(ragequitAmount, mockERC20.address);
      
      // Get expected values
      const expectedFee = ragequitAmount.mul(RAGEQUIT_FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const expectedNetAmount = ragequitAmount.sub(expectedFee);
      const expectedTreasuryAmount = expectedFee.mul(TREASURY_SHARE).div(ethers.utils.parseEther("1"));
      const expectedRewardAmount = expectedFee.sub(expectedTreasuryAmount);
      
      // Check balances after ragequit
      const finalUserBalance = await mockERC20.balanceOf(user1.address);
      const finalAssetDAOBalance = await mockERC20.balanceOf(assetDAO.address);
      const finalTreasuryBalance = await mockERC20.balanceOf(treasury.address);
      const finalRewardDistributorBalance = await mockERC20.balanceOf(rewardDistributor.address);
      
      // User should have received the net amount (less than with normal divest)
      expect(finalUserBalance).to.equal(initialUserBalance.add(expectedNetAmount));
      
      // AssetDAO should have reduced its balance by the divested amount
      // Be careful with the exact calculation due to fee transfers
      expect(finalAssetDAOBalance).to.be.closeTo(
        initialAssetDAOBalance.sub(ragequitAmount), 
        ethers.utils.parseEther("0.000001") // Small delta for rounding
      );
      
      // Treasury should have its share of the fee
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance.add(expectedTreasuryAmount));
      
      // RewardDistributor should have its share of the fee
      expect(finalRewardDistributorBalance).to.equal(initialRewardDistributorBalance.add(expectedRewardAmount));
      
      // User should have no D-AI tokens left
      const userDaiBalance = await assetDAO.balanceOf(user1.address);
      expect(userDaiBalance).to.equal(0);
      
      // Check for the RageQuit event
      await expect(ragequitTx)
        .to.emit(assetDAO, "RageQuit")
        .withArgs(user1.address, ragequitAmount, expectedNetAmount, expectedFee);
    });
  });
  
  describe("Reward Distribution", function () {
    beforeEach(async function () {
      // Generate fees by having multiple users invest
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await mockERC20.connect(user2).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await mockERC20.connect(user3).approve(assetDAO.address, INVESTMENT_AMOUNT);
      
      await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      await assetDAO.connect(user2).invest(mockERC20.address, INVESTMENT_AMOUNT);
      await assetDAO.connect(user3).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Fast forward time to end the distribution cycle
      await ethers.provider.send("evm_increaseTime", [2592000]); // 30 days
      await ethers.provider.send("evm_mine");
      
      // Distribute rewards
      await rewardDistributor.connect(deployer).distributeRewards();
    });
    
    it("Should allow participants to claim rewards", async function () {
      // Record initial balances
      const initialUser1Balance = await mockERC20.balanceOf(user1.address);
      const initialUser2Balance = await mockERC20.balanceOf(user2.address);
      
      // Claim rewards
      await rewardDistributor.connect(user1).claimRewards(mockERC20.address, 1);
      await rewardDistributor.connect(user2).claimRewards(mockERC20.address, 1);
      
      // Check final balances
      const finalUser1Balance = await mockERC20.balanceOf(user1.address);
      const finalUser2Balance = await mockERC20.balanceOf(user2.address);
      
      // Users should have received rewards
      expect(finalUser1Balance).to.be.gt(initialUser1Balance);
      expect(finalUser2Balance).to.be.gt(initialUser2Balance);
      
      // With equal shares, rewards should be approximately equal
      const user1Reward = finalUser1Balance.sub(initialUser1Balance);
      const user2Reward = finalUser2Balance.sub(initialUser2Balance);
      
      expect(user1Reward).to.be.closeTo(user2Reward, ethers.utils.parseEther("0.000001"));
    });
  });
  
  describe("Asset Management", function () {
    it("Should allow adding and removing assets", async function () {
      // Deploy a second mock token
      const MockERC20B = await ethers.getContractFactory("MockERC20");
      const mockERC20B = await MockERC20B.deploy("Mock DAI", "DAI", 18);
      await mockERC20B.deployed();
      
      // Add the new asset
      await assetDAO.addAsset(mockERC20B.address, ethers.utils.parseEther("0.5")); // 50% weight
      
      // Check supported assets
      const supportedAssets = await assetDAO.getSupportedAssets();
      expect(supportedAssets.length).to.equal(2);
      expect(supportedAssets[0]).to.equal(mockERC20.address);
      expect(supportedAssets[1]).to.equal(mockERC20B.address);
      
      // Check asset weights
      const weight1 = await assetDAO.assetWeights(mockERC20.address);
      const weight2 = await assetDAO.assetWeights(mockERC20B.address);
      expect(weight1).to.equal(ethers.utils.parseEther("1"));
      expect(weight2).to.equal(ethers.utils.parseEther("0.5"));
      
      // Update weight of first asset
      await assetDAO.updateAssetWeight(mockERC20.address, ethers.utils.parseEther("0.5"));
      const updatedWeight1 = await assetDAO.assetWeights(mockERC20.address);
      expect(updatedWeight1).to.equal(ethers.utils.parseEther("0.5"));
      
      // Remove the second asset
      await assetDAO.removeAsset(mockERC20B.address);
      
      // Check supported assets again
      const updatedSupportedAssets = await assetDAO.getSupportedAssets();
      expect(updatedSupportedAssets.length).to.equal(1);
      expect(updatedSupportedAssets[0]).to.equal(mockERC20.address);
      
      // Check is supported flag
      const isSupported = await assetDAO.isAssetSupported(mockERC20B.address);
      expect(isSupported).to.be.false;
    });
  });
  
  describe("Access Control", function () {
    it("Should restrict sensitive functions to authorized roles", async function () {
      // Attempt to call governance functions as a regular user
      await expect(
        assetDAO.connect(user1).addAsset(mockERC20.address, ethers.utils.parseEther("1"))
      ).to.be.reverted;
      
      await expect(
        assetDAO.connect(user1).updateFeeSystem(feeCalculator.address, feeProcessor.address)
      ).to.be.reverted;
      
      await expect(
        feeCalculator.connect(user1).updateInvestFeePercentage(ethers.utils.parseEther("0.05"))
      ).to.be.reverted;
      
      await expect(
        treasury.connect(user1).allocateFunds(mockERC20.address, user1.address, 100, "Test")
      ).to.be.reverted;
      
      await expect(
        rewardDistributor.connect(user1).addParticipant(user3.address, 1000)
      ).to.be.reverted;
    });
  });
  
  describe("Emergency Controls", function () {
    it("Should allow pausing and unpausing the AssetDAO", async function () {
      // Pause the AssetDAO
      await assetDAO.connect(deployer).pause();
      
      // Verify it's paused
      expect(await assetDAO.paused()).to.be.true;
      
      // Attempt to invest while paused
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await expect(
        assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT)
      ).to.be.reverted;
      
      // Unpause the AssetDAO
      await assetDAO.connect(deployer).unpause();
      
      // Verify it's not paused
      expect(await assetDAO.paused()).to.be.false;
      
      // Invest after unpausing should work
      await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Check the investment was successful
      expect(await assetDAO.balanceOf(user1.address)).to.be.gt(0);
    });
    
    it("Should allow emergency withdrawal from Treasury after delay", async function () {
      // Generate some fees to fund the Treasury
      await mockERC20.connect(user1).approve(assetDAO.address, INVESTMENT_AMOUNT);
      await assetDAO.connect(user1).invest(mockERC20.address, INVESTMENT_AMOUNT);
      
      // Request emergency withdrawal
      const withdrawalAmount = ethers.utils.parseEther("10");
      const requestTx = await treasury.connect(deployer).requestEmergencyWithdrawal(
        mockERC20.address,
        deployer.address,
        withdrawalAmount
      );
      
      // Get the request ID from event
      const receipt = await requestTx.wait();
      const event = receipt.events.find(e => e.event === 'EmergencyWithdrawalRequested');
      const requestId = event.args.requestId;
      
      // Try to execute immediately (should fail due to delay)
      await expect(
        treasury.connect(deployer).executeEmergencyWithdrawal(
          requestId,
          mockERC20.address,
          deployer.address,
          withdrawalAmount
        )
      ).to.be.revertedWith("Delay not met");
      
      // Fast forward time past the delay
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      // Initial balance
      const initialBalance = await mockERC20.balanceOf(deployer.address);
      
      // Now execute should work
      await treasury.connect(deployer).executeEmergencyWithdrawal(
        requestId,
        mockERC20.address,
        deployer.address,
        withdrawalAmount
      );
      
      // Check balance increased
      const finalBalance = await mockERC20.balanceOf(deployer.address);
      expect(finalBalance).to.equal(initialBalance.add(withdrawalAmount));
    });
  });
});