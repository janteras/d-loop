// Include the ethers v6 adapter for compatibility
require('../../shims/ethers-v6-adapter');

const { expect } = require("chai");

// Import ethers directly first
const ethersLib = require("ethers");
// Add compatibility utilities from ethers
const { keccak256, toUtf8Bytes } = ethersLib;
const parseEther = ethersLib.parseEther;
const parseUnits = ethersLib.parseUnits;

// Then import hardhat runtime 
const { ethers } = require("hardhat");

describe("FeeCalculator", function () {
  let feeCalculator;
  let treasury;
  let rewardDistributor;
  let owner;
  let admin;
  let user;
  
  // Fee percentages in basis points
  const INVEST_FEE = 1000;      // 10%
  const DIVEST_FEE = 500;       // 5%
  const RAGEQUIT_FEE = 40;      // 0.4% (0.3% standard + 0.1% emergency)
  const TREASURY_PERCENTAGE = 7000;  // 70%
  const REWARDS_PERCENTAGE = 3000;   // 30%
  
  beforeEach(async function () {
    [owner, admin, treasuryAddr, rewardDistAddr, user] = await ethers.getSigners();
    
    // Deploy Treasury contract
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address, admin.address);
    await treasury.waitForDeployment();
    
    // For simplicity, we'll use the treasury address for reward distributor as well
    // In a real scenario, we would deploy a RewardDistributor contract
    rewardDistributor = treasuryAddr;
    
    // Deploy FeeCalculator contract
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      admin.address,
      treasury.address,
      rewardDistributor.address,
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    
    await feeCalculator.waitForDeployment();
  });
  
  describe("Initialization", function () {
    it("should set the correct owner", async function () {
      expect(await feeCalculator.owner()).to.equal(owner.address);
    });
    
    it("should set the correct admin", async function () {
      expect(await feeCalculator.feeAdmin()).to.equal(admin.address);
    });
    
    it("should set the correct fee percentages", async function () {
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
      expect(await feeCalculator.divestFeePercentage()).to.equal(DIVEST_FEE);
      expect(await feeCalculator.ragequitFeePercentage()).to.equal(RAGEQUIT_FEE);
    });
  });
  
  describe("Fee Calculations", function () {
    it("should calculate the correct investment fee", async function () {
      const amount = ethers.parseEther("100");
      const expectedFee = amount * BigInt(INVEST_FEE) / 10000n;
      
      expect(await feeCalculator.calculateInvestFee(amount)).to.equal(expectedFee);
    });
    
    it("should calculate the correct divestment fee", async function () {
      const amount = ethers.parseEther("100");
      const expectedFee = amount * BigInt(DIVEST_FEE) / 10000n;
      
      expect(await feeCalculator.calculateDivestFee(amount)).to.equal(expectedFee);
    });
    
    it("should calculate the correct ragequit fee", async function () {
      const amount = ethers.parseEther("100");
      const expectedFee = amount * BigInt(RAGEQUIT_FEE) / 10000n;
      
      expect(await feeCalculator.calculateRagequitFee(amount)).to.equal(expectedFee);
    });
    
    it("should return 0 for zero amount", async function () {
      expect(await feeCalculator.calculateInvestFee(0)).to.equal(0);
      expect(await feeCalculator.calculateDivestFee(0)).to.equal(0);
      expect(await feeCalculator.calculateRagequitFee(0)).to.equal(0);
    });
  });
  
  describe("Fee Parameter Updates", function () {
    it("should allow admin to update invest fee percentage", async function () {
      const newFeePercentage = 1200; // 12%
      
      await feeCalculator.connect(admin).updateInvestFeePercentage(newFeePercentage);
      
      expect(await feeCalculator.investFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("should allow admin to update divest fee percentage", async function () {
      const newFeePercentage = 600; // 6%
      
      await feeCalculator.connect(admin).updateDivestFeePercentage(newFeePercentage);
      
      expect(await feeCalculator.divestFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("should allow admin to update ragequit fee percentage", async function () {
      const newFeePercentage = 60; // 0.6% (0.4% + additional 0.2%)
      
      await feeCalculator.connect(admin).updateRagequitFeePercentage(newFeePercentage);
      
      expect(await feeCalculator.ragequitFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("should emit FeeParameterUpdated event when updating fee percentage", async function () {
      const newFeePercentage = 1200; // 12%
      
      await expect(feeCalculator.connect(admin).updateInvestFeePercentage(newFeePercentage))
        .to.emit(feeCalculator, "FeeParameterUpdated")
        .withArgs("Invest", INVEST_FEE, newFeePercentage);
    });
    
    it("should revert when non-admin tries to update fee percentage", async function () {
      const newFeePercentage = 1200; // 12%
      
      await expect(feeCalculator.connect(user).updateInvestFeePercentage(newFeePercentage))
        .to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
    });
    
    it("should revert when fee percentage is greater than 100%", async function () {
      const invalidFeePercentage = 10001; // 100.01%
      
      await expect(feeCalculator.connect(admin).updateInvestFeePercentage(invalidFeePercentage))
        .to.be.revertedWithCustomError(feeCalculator, "InvalidFeePercentage");
    });
  });
  
  describe("Distribution Functions", function () {
    it("should have the correct initial distribution percentages", async function () {
      const [treasuryPct, rewardPct] = await feeCalculator.getDistributionPercentages();
      expect(treasuryPct).to.equal(7000); // 70%
      expect(rewardPct).to.equal(3000);   // 30%
    });
    
    it("should allow admin to update distribution percentages", async function () {
      const newTreasuryPct = 6000; // 60%
      const newRewardPct = 4000;   // 40%
      
      await feeCalculator.connect(admin).updateDistributionPercentages(newTreasuryPct, newRewardPct);
      
      const [treasuryPct, rewardPct] = await feeCalculator.getDistributionPercentages();
      expect(treasuryPct).to.equal(newTreasuryPct);
      expect(rewardPct).to.equal(newRewardPct);
    });
    
    it("should revert when distribution percentages don't add up to 100%", async function () {
      const invalidTreasuryPct = 6000; // 60%
      const invalidRewardPct = 3000;   // 30% (total 90%)
      
      await expect(feeCalculator.connect(admin).updateDistributionPercentages(invalidTreasuryPct, invalidRewardPct))
        .to.be.revertedWithCustomError(feeCalculator, "InvalidDistributionPercentages");
    });
    
    it("should revert when non-admin tries to update distribution percentages", async function () {
      await expect(feeCalculator.connect(user).updateDistributionPercentages(6000, 4000))
        .to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
    });
  });
  
  describe("Treasury and Reward Distribution", function () {
    it("should allow owner to update treasury address", async function () {
      const newTreasury = user.address;
      
      await feeCalculator.connect(owner).updateTreasury(newTreasury);
      
      expect(await feeCalculator.treasury()).to.equal(newTreasury);
    });
    
    it("should allow owner to update reward distributor address", async function () {
      const newRewardDist = user.address;
      
      await feeCalculator.connect(owner).updateRewardDistributor(newRewardDist);
      
      expect(await feeCalculator.rewardDistributor()).to.equal(newRewardDist);
    });
    
    it("should revert when updating treasury to zero address", async function () {
      await expect(feeCalculator.connect(owner).updateTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
    });
    
    it("should revert when updating reward distributor to zero address", async function () {
      await expect(feeCalculator.connect(owner).updateRewardDistributor(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
    });
  });

  describe("Admin Functions", function () {
    it("should allow owner to update fee admin", async function () {
      await feeCalculator.connect(owner).updateFeeAdmin(user.address);
      
      expect(await feeCalculator.feeAdmin()).to.equal(user.address);
    });
    
    it("should allow owner to transfer ownership", async function () {
      await feeCalculator.connect(owner).transferOwnership(user.address);
      
      expect(await feeCalculator.owner()).to.equal(user.address);
    });
    
    it("should revert when non-owner tries to update fee admin", async function () {
      await expect(feeCalculator.connect(user).updateFeeAdmin(user.address))
        .to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
    });
    
    it("should revert when non-owner tries to transfer ownership", async function () {
      await expect(feeCalculator.connect(user).transferOwnership(user.address))
        .to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
    });
    
    it("should revert when updating fee admin to zero address", async function () {
      await expect(feeCalculator.connect(owner).updateFeeAdmin(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
    });
    
    it("should revert when transferring ownership to zero address", async function () {
      await expect(feeCalculator.connect(owner).transferOwnership(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
    });
  });
  
  describe("Fee Recovery", function () {
    let mockERC20;
    const STUCK_FEE_AMOUNT = ethers.parseEther("10");
    
    beforeEach(async function () {
      // Deploy a mock ERC20 token for testing
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      mockERC20 = await MockERC20.deploy("Mock Token", "MOCK", 18);
      await mockERC20.waitForDeployment();
      
      // Mint tokens to the feeCalculator contract address to simulate stuck fees
      await mockERC20.mint(await feeCalculator.getAddress(), STUCK_FEE_AMOUNT);
    });
    
    it("Recovers stuck fees with admin approval", async function () {
      // Get treasury's initial balance
      const treasuryAddress = await feeCalculator.treasury();
      const initialTreasuryBalance = await mockERC20.balanceOf(treasuryAddress);
      
      // Admin recovers stuck fees
      await feeCalculator.connect(admin).recoverStuckFees(await mockERC20.getAddress());
      
      // Check that treasury received the fees
      const finalTreasuryBalance = await mockERC20.balanceOf(treasuryAddress);
      const recoveredAmount = finalTreasuryBalance - initialTreasuryBalance;
      
      expect(recoveredAmount).to.equal(STUCK_FEE_AMOUNT);
      expect(await mockERC20.balanceOf(await feeCalculator.getAddress())).to.equal(0);
    });
    
    it("Emits FeeCollected event when recovering fees", async function () {
      const tokenAddress = await mockERC20.getAddress();
      
      await expect(feeCalculator.connect(admin).recoverStuckFees(tokenAddress))
        .to.emit(feeCalculator, "FeeCollected")
        .withArgs("Recovery", tokenAddress, STUCK_FEE_AMOUNT, STUCK_FEE_AMOUNT, 0);
    });
    
    it("Rejects recovery requests from non-admin users", async function () {
      await expect(feeCalculator.connect(user).recoverStuckFees(await mockERC20.getAddress()))
        .to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
    });
    
    it("Rejects recovery for zero address", async function () {
      await expect(feeCalculator.connect(admin).recoverStuckFees(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
    });
    
    it("Rejects recovery when no fees are stuck", async function () {
      // Deploy a new token with no balance in the fee calculator
      const NewMockERC20 = await ethers.getContractFactory("MockERC20");
      const emptyToken = await NewMockERC20.deploy("Empty Token", "EMPTY", 18);
      await emptyToken.waitForDeployment();
      
      await expect(feeCalculator.connect(admin).recoverStuckFees(await emptyToken.getAddress()))
        .to.be.revertedWithCustomError(feeCalculator, "OperationFailed");
    });
  });
});