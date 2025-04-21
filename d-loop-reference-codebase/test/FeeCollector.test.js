const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeCollector", function () {
  let feeCalculator;
  let feeCollector;
  let treasury;
  let rewardDistributor;
  let mockToken;
  let owner, assetDao, user;
  
  const INVEST_FEE_PERCENTAGE = 100; // 1%
  const DIVEST_FEE_PERCENTAGE = 50; // 0.5%
  const RAGEQUIT_FEE_PERCENTAGE = 200; // 2%
  
  const TREASURY_PERCENTAGE = 7000; // 70%
  const REWARD_DIST_PERCENTAGE = 3000; // 30%
  
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
  const ASSET_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ASSET_DAO_ROLE"));
  const PROTOCOL_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROTOCOL_DAO_ROLE"));
  const FEE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_ADMIN_ROLE"));
  
  beforeEach(async function () {
    [owner, assetDao, user, treasuryAddress, rewardDistAddress] = await ethers.getSigners();
    
    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK", 18);
    await mockToken.deployed();
    
    // Mint tokens to AssetDAO
    await mockToken.mint(assetDao.address, ethers.utils.parseEther("10000"));
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      INVEST_FEE_PERCENTAGE,
      DIVEST_FEE_PERCENTAGE,
      RAGEQUIT_FEE_PERCENTAGE
    );
    await feeCalculator.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.deployed();
    
    // Mock RewardDistributor for testing purposes
    const MockRewardDistributor = await ethers.getContractFactory("Treasury"); // Reusing Treasury as a mock
    rewardDistributor = await MockRewardDistributor.deploy();
    await rewardDistributor.deployed();
    
    // Deploy FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      treasury.address,
      rewardDistributor.address,
      feeCalculator.address,
      TREASURY_PERCENTAGE,
      REWARD_DIST_PERCENTAGE
    );
    await feeCollector.deployed();
    
    // Grant ASSET_DAO_ROLE to assetDao
    await feeCollector.addAssetDAORole(assetDao.address);
    
    // Approve FeeCollector to spend AssetDAO's tokens
    await mockToken.connect(assetDao).approve(feeCollector.address, ethers.constants.MaxUint256);
  });
  
  describe("Deployment", function () {
    it("Should set the right addresses and percentages", async function () {
      expect(await feeCollector.treasury()).to.equal(treasury.address);
      expect(await feeCollector.rewardDistributor()).to.equal(rewardDistributor.address);
      expect(await feeCollector.feeCalculator()).to.equal(feeCalculator.address);
      expect(await feeCollector.treasuryPercentage()).to.equal(TREASURY_PERCENTAGE);
      expect(await feeCollector.rewardDistPercentage()).to.equal(REWARD_DIST_PERCENTAGE);
    });
    
    it("Should assign the default admin role to the deployer", async function () {
      expect(await feeCollector.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
    });
    
    it("Should assign the fee admin role to the deployer", async function () {
      expect(await feeCollector.hasRole(FEE_ADMIN_ROLE, owner.address)).to.equal(true);
    });
  });
  
  describe("Fee Collection", function () {
    it("Should correctly collect and distribute invest fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Calculate expected fees
      const totalFee = amount.mul(INVEST_FEE_PERCENTAGE).div(10000);
      const treasuryFee = totalFee.mul(TREASURY_PERCENTAGE).div(10000);
      const rewardFee = totalFee.mul(REWARD_DIST_PERCENTAGE).div(10000);
      
      // Check balances before
      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceBefore = await mockToken.balanceOf(rewardDistributor.address);
      
      // Collect fee
      await expect(feeCollector.connect(assetDao).collectInvestFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeCollected")
        .withArgs("Invest", mockToken.address, totalFee, treasuryFee, rewardFee);
      
      // Check balances after
      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceAfter = await mockToken.balanceOf(rewardDistributor.address);
      
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(treasuryFee);
      expect(rewardDistBalanceAfter.sub(rewardDistBalanceBefore)).to.equal(rewardFee);
    });
    
    it("Should correctly collect and distribute divest fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Calculate expected fees
      const totalFee = amount.mul(DIVEST_FEE_PERCENTAGE).div(10000);
      const treasuryFee = totalFee.mul(TREASURY_PERCENTAGE).div(10000);
      const rewardFee = totalFee.mul(REWARD_DIST_PERCENTAGE).div(10000);
      
      // Check balances before
      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceBefore = await mockToken.balanceOf(rewardDistributor.address);
      
      // Collect fee
      await expect(feeCollector.connect(assetDao).collectDivestFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeCollected")
        .withArgs("Divest", mockToken.address, totalFee, treasuryFee, rewardFee);
      
      // Check balances after
      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceAfter = await mockToken.balanceOf(rewardDistributor.address);
      
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(treasuryFee);
      expect(rewardDistBalanceAfter.sub(rewardDistBalanceBefore)).to.equal(rewardFee);
    });
    
    it("Should correctly collect and distribute ragequit fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Calculate expected fees
      const totalFee = amount.mul(RAGEQUIT_FEE_PERCENTAGE).div(10000);
      const treasuryFee = totalFee.mul(TREASURY_PERCENTAGE).div(10000);
      const rewardFee = totalFee.mul(REWARD_DIST_PERCENTAGE).div(10000);
      
      // Check balances before
      const treasuryBalanceBefore = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceBefore = await mockToken.balanceOf(rewardDistributor.address);
      
      // Collect fee
      await expect(feeCollector.connect(assetDao).collectRagequitFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeCollected")
        .withArgs("Ragequit", mockToken.address, totalFee, treasuryFee, rewardFee);
      
      // Check balances after
      const treasuryBalanceAfter = await mockToken.balanceOf(treasury.address);
      const rewardDistBalanceAfter = await mockToken.balanceOf(rewardDistributor.address);
      
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(treasuryFee);
      expect(rewardDistBalanceAfter.sub(rewardDistBalanceBefore)).to.equal(rewardFee);
    });
    
    it("Should reject fee collection from non-AssetDAO role", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      await expect(feeCollector.connect(user).collectInvestFee(mockToken.address, amount))
        .to.be.reverted;
      
      await expect(feeCollector.connect(user).collectDivestFee(mockToken.address, amount))
        .to.be.reverted;
      
      await expect(feeCollector.connect(user).collectRagequitFee(mockToken.address, amount))
        .to.be.reverted;
    });
  });
  
  describe("Configuration Updates", function () {
    beforeEach(async function () {
      await feeCollector.addProtocolDAORole(user.address);
    });
    
    it("Should allow ProtocolDAO to update treasury address", async function () {
      await expect(feeCollector.connect(user).updateTreasury(treasuryAddress.address))
        .to.emit(feeCollector, "TreasuryUpdated")
        .withArgs(treasury.address, treasuryAddress.address);
      
      expect(await feeCollector.treasury()).to.equal(treasuryAddress.address);
    });
    
    it("Should allow ProtocolDAO to update reward distributor address", async function () {
      await expect(feeCollector.connect(user).updateRewardDistributor(rewardDistAddress.address))
        .to.emit(feeCollector, "RewardDistributorUpdated")
        .withArgs(rewardDistributor.address, rewardDistAddress.address);
      
      expect(await feeCollector.rewardDistributor()).to.equal(rewardDistAddress.address);
    });
    
    it("Should allow ProtocolDAO to update distribution percentages", async function () {
      const newTreasuryPercentage = 6000; // 60%
      const newRewardPercentage = 4000; // 40%
      
      await expect(feeCollector.connect(user).updateDistribution(newTreasuryPercentage, newRewardPercentage))
        .to.emit(feeCollector, "DistributionUpdated")
        .withArgs(TREASURY_PERCENTAGE, REWARD_DIST_PERCENTAGE, newTreasuryPercentage, newRewardPercentage);
      
      expect(await feeCollector.treasuryPercentage()).to.equal(newTreasuryPercentage);
      expect(await feeCollector.rewardDistPercentage()).to.equal(newRewardPercentage);
    });
    
    it("Should require that distribution percentages add up to 100%", async function () {
      await expect(feeCollector.connect(user).updateDistribution(6000, 3000))
        .to.be.revertedWith("Percentages must add up to 100%");
      
      await expect(feeCollector.connect(user).updateDistribution(6000, 5000))
        .to.be.revertedWith("Percentages must add up to 100%");
    });
    
    it("Should reject updates from non-ProtocolDAO role", async function () {
      await expect(feeCollector.connect(assetDao).updateTreasury(treasuryAddress.address))
        .to.be.reverted;
      
      await expect(feeCollector.connect(assetDao).updateRewardDistributor(rewardDistAddress.address))
        .to.be.reverted;
      
      await expect(feeCollector.connect(assetDao).updateDistribution(6000, 4000))
        .to.be.reverted;
    });
  });
  
  describe("Pause / Unpause", function () {
    it("Should allow FeeAdmin to pause and unpause", async function () {
      await feeCollector.pause();
      expect(await feeCollector.paused()).to.equal(true);
      
      await feeCollector.unpause();
      expect(await feeCollector.paused()).to.equal(false);
    });
    
    it("Should reject fee collection when paused", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      await feeCollector.pause();
      
      await expect(feeCollector.connect(assetDao).collectInvestFee(mockToken.address, amount))
        .to.be.reverted;
      
      await expect(feeCollector.connect(assetDao).collectDivestFee(mockToken.address, amount))
        .to.be.reverted;
      
      await expect(feeCollector.connect(assetDao).collectRagequitFee(mockToken.address, amount))
        .to.be.reverted;
    });
    
    it("Should reject pause/unpause from non-FeeAdmin role", async function () {
      await expect(feeCollector.connect(user).pause())
        .to.be.reverted;
      
      await feeCollector.pause();
      
      await expect(feeCollector.connect(user).unpause())
        .to.be.reverted;
    });
  });
  
  describe("Role Management", function () {
    it("Should allow admin to add AssetDAO role", async function () {
      await feeCollector.addAssetDAORole(user.address);
      expect(await feeCollector.hasRole(ASSET_DAO_ROLE, user.address)).to.equal(true);
    });
    
    it("Should allow admin to remove AssetDAO role", async function () {
      await feeCollector.addAssetDAORole(user.address);
      await feeCollector.removeAssetDAORole(user.address);
      expect(await feeCollector.hasRole(ASSET_DAO_ROLE, user.address)).to.equal(false);
    });
    
    it("Should allow admin to add ProtocolDAO role", async function () {
      await feeCollector.addProtocolDAORole(user.address);
      expect(await feeCollector.hasRole(PROTOCOL_DAO_ROLE, user.address)).to.equal(true);
    });
    
    it("Should allow admin to remove ProtocolDAO role", async function () {
      await feeCollector.addProtocolDAORole(user.address);
      await feeCollector.removeProtocolDAORole(user.address);
      expect(await feeCollector.hasRole(PROTOCOL_DAO_ROLE, user.address)).to.equal(false);
    });
  });
});