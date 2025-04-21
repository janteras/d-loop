const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;

describe("Fee Collection System Stress Tests", function () {
  let feeCalculator;
  let feeCollector;
  let treasury;
  let rewardDistributor;
  let assetDAOWithFees;
  let mockToken;
  let owner;
  let users;
  
  // Test parameters
  const INVEST_FEE_RATE = 50;    // 0.5% in basis points
  const DIVEST_FEE_RATE = 50;    // 0.5% in basis points
  const RAGEQUIT_FEE_RATE = 200; // 2.0% in basis points
  const TREASURY_SHARE = 70;     // 70% to Treasury
  const REWARD_SHARE = 30;       // 30% to RewardDistributor
  
  // Large amounts for stress testing
  const LARGE_AMOUNT = ethers.utils.parseEther("1000000"); // 1 million tokens
  const MICRO_AMOUNT = ethers.utils.parseEther("0.000001"); // Very small amount
  const MAX_AMOUNT = ethers.utils.parseEther("1000000000"); // 1 billion tokens
  
  before(async function () {
    [owner, ...users] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // Deploy mock token with large supply
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Fee Test Token", "FEE");
    await mockToken.mint(owner.address, MAX_AMOUNT);
    
    // Deploy fee system contracts
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      INVEST_FEE_RATE,
      DIVEST_FEE_RATE,
      RAGEQUIT_FEE_RATE
    );
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address);
    
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(owner.address, owner.address);
    
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      feeCalculator.address,
      treasury.address,
      rewardDistributor.address,
      TREASURY_SHARE,
      REWARD_SHARE
    );
    
    // Grant REWARD_SOURCE_ROLE to FeeCollector
    const REWARD_SOURCE_ROLE = await rewardDistributor.REWARD_SOURCE_ROLE();
    await rewardDistributor.grantRole(REWARD_SOURCE_ROLE, feeCollector.address);
    
    // Deploy AssetDAOWithFees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAOWithFees = await AssetDAOWithFees.deploy(
      feeCollector.address,
      owner.address
    );
    
    // Transfer tokens to AssetDAO for fee collection
    await mockToken.transfer(assetDAOWithFees.address, LARGE_AMOUNT);
    
    // Approve tokens for FeeCollector
    await mockToken.approve(feeCollector.address, MAX_AMOUNT);
  });

  describe("High Volume Fee Collection", function () {
    it("should handle large volume fee collection", async function () {
      // Collect a large fee amount
      await feeCollector.collectFees(mockToken.address, LARGE_AMOUNT);
      
      // Verify treasury and reward distributor received correct amounts
      const treasuryAmount = await mockToken.balanceOf(treasury.address);
      const rewardAmount = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTreasuryAmount = LARGE_AMOUNT.mul(TREASURY_SHARE).div(100);
      const expectedRewardAmount = LARGE_AMOUNT.mul(REWARD_SHARE).div(100);
      
      // Allow for rounding
      expect(treasuryAmount).to.be.closeTo(expectedTreasuryAmount, 10);
      expect(rewardAmount).to.be.closeTo(expectedRewardAmount, 10);
    });

    it("should handle repeated fee collections efficiently", async function () {
      // Perform 10 consecutive fee collections to check for gas efficiency
      const amount = ethers.utils.parseEther("10000"); // 10,000 tokens each time
      
      // Track gas usage for analysis
      let gasUsed = [];
      
      for (let i = 0; i < 10; i++) {
        const tx = await feeCollector.collectFees(mockToken.address, amount);
        const receipt = await tx.wait();
        gasUsed.push(receipt.gasUsed);
      }
      
      // Verify total collected
      const treasuryTotal = await mockToken.balanceOf(treasury.address);
      const rewardTotal = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTotal = amount.mul(10); // 10 collections
      const expectedTreasuryTotal = expectedTotal.mul(TREASURY_SHARE).div(100);
      const expectedRewardTotal = expectedTotal.mul(REWARD_SHARE).div(100);
      
      expect(treasuryTotal).to.be.closeTo(expectedTreasuryTotal, 100);
      expect(rewardTotal).to.be.closeTo(expectedRewardTotal, 100);
      
      // Gas usage should be consistent (not increasing significantly)
      for (let i = 1; i < gasUsed.length; i++) {
        // Gas shouldn't increase more than 5% between transactions
        const gasDiff = gasUsed[i].sub(gasUsed[i-1]).abs();
        const gasPercent = gasDiff.mul(100).div(gasUsed[i-1]);
        expect(gasPercent.lt(5)).to.be.true;
      }
    });
  });

  describe("Edge Cases", function () {
    it("should handle micro-amount fee collection correctly", async function () {
      // Collect a very small fee amount
      await feeCollector.collectFees(mockToken.address, MICRO_AMOUNT);
      
      // Verify treasury and reward distributor received correct amounts
      const treasuryAmount = await mockToken.balanceOf(treasury.address);
      const rewardAmount = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTreasuryAmount = MICRO_AMOUNT.mul(TREASURY_SHARE).div(100);
      const expectedRewardAmount = MICRO_AMOUNT.mul(REWARD_SHARE).div(100);
      
      // For very small amounts, rounding may cause issues, so check if distribution is reasonable
      // We check that we have non-zero values if expected values are non-zero
      if (!expectedTreasuryAmount.isZero()) {
        expect(treasuryAmount).to.not.equal(0);
      }
      
      if (!expectedRewardAmount.isZero()) {
        expect(rewardAmount).to.not.equal(0);
      }
      
      // Check that total distribution equals the fee amount (minus potential dust due to rounding)
      const totalDistributed = treasuryAmount.add(rewardAmount);
      const diff = MICRO_AMOUNT.sub(totalDistributed).abs();
      // Allow for rounding error of 1 wei per share (worst case)
      expect(diff.lte(2)).to.be.true;
    });

    it("should handle zero fee collection gracefully", async function () {
      // Initial balances
      const initialTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const initialRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      // Collect zero fees
      await feeCollector.collectFees(mockToken.address, 0);
      
      // Verify balances didn't change
      const finalTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const finalRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance);
      expect(finalRewardBalance).to.equal(initialRewardBalance);
    });

    it("should handle maximum potential fee collection", async function () {
      // Transfer a large amount to test with maximum values
      await mockToken.transfer(assetDAOWithFees.address, MAX_AMOUNT);
      
      // Calculate maximum fees for a large transaction
      const maxFee = await feeCalculator.calculateRagequitFee(MAX_AMOUNT);
      
      // Collect the fee
      await feeCollector.collectFees(mockToken.address, maxFee);
      
      // Verify treasury and reward distributor received correct amounts
      const treasuryAmount = await mockToken.balanceOf(treasury.address);
      const rewardAmount = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTreasuryAmount = maxFee.mul(TREASURY_SHARE).div(100);
      const expectedRewardAmount = maxFee.mul(REWARD_SHARE).div(100);
      
      // Allow for reasonable rounding with large numbers
      expect(treasuryAmount).to.be.closeTo(expectedTreasuryAmount, 1000);
      expect(rewardAmount).to.be.closeTo(expectedRewardAmount, 1000);
    });
  });

  describe("AssetDAO Integration", function () {
    it("should correctly collect and distribute fees on invest operations", async function () {
      // Pretend someone is investing into the AssetDAO
      const investAmount = ethers.utils.parseEther("10000");
      await mockToken.transfer(users[0].address, investAmount);
      await mockToken.connect(users[0]).approve(assetDAOWithFees.address, investAmount);
      
      // Record balances before
      const beforeTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const beforeRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      // Perform invest operation that collects fees
      await assetDAOWithFees.connect(users[0]).investWithFees(mockToken.address, investAmount);
      
      // Verify fees were collected and distributed
      const afterTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const afterRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      // Calculate expected fee and distributions
      const expectedFee = investAmount.mul(INVEST_FEE_RATE).div(10000);
      const expectedTreasuryIncrease = expectedFee.mul(TREASURY_SHARE).div(100);
      const expectedRewardIncrease = expectedFee.mul(REWARD_SHARE).div(100);
      
      const actualTreasuryIncrease = afterTreasuryBalance.sub(beforeTreasuryBalance);
      const actualRewardIncrease = afterRewardBalance.sub(beforeRewardBalance);
      
      expect(actualTreasuryIncrease).to.be.closeTo(expectedTreasuryIncrease, 10);
      expect(actualRewardIncrease).to.be.closeTo(expectedRewardIncrease, 10);
    });

    it("should handle concurrent fee collection operations", async function () {
      // Set up multiple users to perform operations concurrently
      const userCount = 5;
      const amount = ethers.utils.parseEther("1000");
      
      // Give each user tokens
      for (let i = 0; i < userCount; i++) {
        await mockToken.transfer(users[i].address, amount);
        await mockToken.connect(users[i]).approve(assetDAOWithFees.address, amount);
      }
      
      // Record balances before
      const beforeTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const beforeRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      // Perform concurrent operations
      // Using Promise.all to simulate concurrent transactions
      await Promise.all(
        users.slice(0, userCount).map(user => 
          assetDAOWithFees.connect(user).investWithFees(mockToken.address, amount)
        )
      );
      
      // Verify total fees collected and distributed
      const afterTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const afterRewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      
      // Calculate expected fees and distributions
      const expectedFee = amount.mul(INVEST_FEE_RATE).div(10000).mul(userCount);
      const expectedTreasuryIncrease = expectedFee.mul(TREASURY_SHARE).div(100);
      const expectedRewardIncrease = expectedFee.mul(REWARD_SHARE).div(100);
      
      const actualTreasuryIncrease = afterTreasuryBalance.sub(beforeTreasuryBalance);
      const actualRewardIncrease = afterRewardBalance.sub(beforeRewardBalance);
      
      expect(actualTreasuryIncrease).to.be.closeTo(expectedTreasuryIncrease, 100);
      expect(actualRewardIncrease).to.be.closeTo(expectedRewardIncrease, 100);
    });
  });

  describe("Parameter Update Tests", function () {
    it("should correctly apply fee updates", async function () {
      // Initial invest fee
      const initialInvestFee = await feeCalculator.calculateInvestFee(LARGE_AMOUNT);
      
      // Update fee rates
      const newInvestFeeRate = 100; // 1.0%
      const newDivestFeeRate = 100; // 1.0%
      const newRagequitFeeRate = 300; // 3.0%
      
      await feeCalculator.updateFeeRates(
        newInvestFeeRate,
        newDivestFeeRate,
        newRagequitFeeRate
      );
      
      // Check new invest fee
      const newInvestFee = await feeCalculator.calculateInvestFee(LARGE_AMOUNT);
      
      // Fee should be double the initial (0.5% -> 1.0%)
      expect(newInvestFee).to.equal(initialInvestFee.mul(2));
      
      // Verify the updated fee is correctly collected
      await mockToken.approve(feeCollector.address, newInvestFee);
      await feeCollector.collectFees(mockToken.address, newInvestFee);
      
      // Verify distribution
      const treasuryAmount = await mockToken.balanceOf(treasury.address);
      const rewardAmount = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTreasuryAmount = newInvestFee.mul(TREASURY_SHARE).div(100);
      const expectedRewardAmount = newInvestFee.mul(REWARD_SHARE).div(100);
      
      expect(treasuryAmount).to.be.closeTo(expectedTreasuryAmount, 100);
      expect(rewardAmount).to.be.closeTo(expectedRewardAmount, 100);
    });

    it("should correctly apply distribution share updates", async function () {
      // Update distribution shares
      const newTreasuryShare = 60; // 60%
      const newRewardShare = 40; // 40%
      
      await feeCollector.updateShares(newTreasuryShare, newRewardShare);
      
      // Get fee amount
      const feeAmount = ethers.utils.parseEther("10000");
      
      // Collect fee
      await feeCollector.collectFees(mockToken.address, feeAmount);
      
      // Verify distribution
      const treasuryAmount = await mockToken.balanceOf(treasury.address);
      const rewardAmount = await mockToken.balanceOf(rewardDistributor.address);
      
      const expectedTreasuryAmount = feeAmount.mul(newTreasuryShare).div(100);
      const expectedRewardAmount = feeAmount.mul(newRewardShare).div(100);
      
      expect(treasuryAmount).to.be.closeTo(expectedTreasuryAmount, 100);
      expect(rewardAmount).to.be.closeTo(expectedRewardAmount, 100);
    });
    
    it("should reject invalid fee rate updates", async function () {
      // Try to set invest fee higher than ragequit fee
      await expect(
        feeCalculator.updateFeeRates(300, 50, 200)
      ).to.be.revertedWith("FeeCalculator: Invest fee must be <= ragequit fee");
      
      // Try to set divest fee higher than ragequit fee
      await expect(
        feeCalculator.updateFeeRates(50, 300, 200)
      ).to.be.revertedWith("FeeCalculator: Divest fee must be <= ragequit fee");
      
      // Try to set excessive fees (>10%)
      await expect(
        feeCalculator.updateFeeRates(50, 50, 1100)
      ).to.be.revertedWith("FeeCalculator: Fee too high");
    });
    
    it("should reject invalid share updates", async function () {
      // Try to set shares that don't add up to 100%
      await expect(
        feeCollector.updateShares(60, 50)
      ).to.be.revertedWith("FeeCollector: Shares must add up to 100");
      
      // Try to set zero shares
      await expect(
        feeCollector.updateShares(0, 100)
      ).to.be.revertedWith("FeeCollector: Shares must be positive");
    });
  });
});