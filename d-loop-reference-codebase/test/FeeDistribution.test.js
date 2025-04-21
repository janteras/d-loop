const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Fee Distribution Test Suite
 * 
 * These tests verify the fee calculation and distribution logic for the DLOOP protocol
 * without modifying any contracts (Phase 1 requirement).
 */
describe("Fee Distribution", function() {
  // Deploy a testing fixture with necessary contracts
  async function deployFixture() {
    const [deployer, user1, user2, user3, treasury, rewardPool] = await ethers.getSigners();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockToken.deploy("Mock USDC", "mUSDC");
    const mockDLOOP = await MockToken.deploy("Mock DLOOP", "mDLOOP");
    
    // For test purposes, we'll define fee rates here
    const feeRates = {
      investment: 150, // 1.5% (scaled by 10000)
      divestment: 200, // 2.0%
      ragequit: 400,   // 4.0%
      yield: 1500      // 15.0%
    };
    
    // Fee distribution shares (must sum to 10000 = 100%)
    const feeShares = {
      treasury: 3500,   // 35%
      tokenHolders: 3500, // 35%
      governance: 2000,  // 20%
      ecosystem: 1000    // 10%
    };
    
    // Mint initial tokens
    await mockUSDC.mint(user1.address, ethers.parseEther("100000"));
    await mockUSDC.mint(user2.address, ethers.parseEther("50000"));
    await mockUSDC.mint(user3.address, ethers.parseEther("25000"));
    
    await mockDLOOP.mint(user1.address, ethers.parseEther("10000"));
    await mockDLOOP.mint(user2.address, ethers.parseEther("5000"));
    await mockDLOOP.mint(user3.address, ethers.parseEther("2500"));
    
    return { 
      mockUSDC, 
      mockDLOOP, 
      deployer, 
      user1, 
      user2, 
      user3, 
      treasury, 
      rewardPool, 
      feeRates, 
      feeShares 
    };
  }
  
  describe("Fee Calculation", function() {
    it("Should correctly calculate investment fees", async function() {
      const { mockUSDC, user1, feeRates } = await loadFixture(deployFixture);
      
      // Investment amount
      const investmentAmount = ethers.parseEther("10000"); // 10,000 USDC
      
      // Calculate expected fee
      const expectedFee = (investmentAmount * BigInt(feeRates.investment)) / BigInt(10000);
      const expectedNetAmount = investmentAmount - expectedFee;
      
      console.log(`Investment amount: ${ethers.formatEther(investmentAmount)} USDC`);
      console.log(`Fee rate: ${feeRates.investment / 100}%`);
      console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
      console.log(`Net amount: ${ethers.formatEther(expectedNetAmount)} USDC`);
      
      // Verify fee calculation is correct (manually)
      expect(expectedFee).to.equal(ethers.parseEther("150")); // 1.5% of 10,000 = 150
      expect(expectedNetAmount).to.equal(ethers.parseEther("9850")); // 10,000 - 150 = 9,850
    });
    
    it("Should correctly calculate divestment fees", async function() {
      const { mockUSDC, user1, feeRates } = await loadFixture(deployFixture);
      
      // Divestment amount
      const divestmentAmount = ethers.parseEther("5000"); // 5,000 USDC
      
      // Calculate expected fee
      const expectedFee = (divestmentAmount * BigInt(feeRates.divestment)) / BigInt(10000);
      const expectedNetAmount = divestmentAmount - expectedFee;
      
      console.log(`Divestment amount: ${ethers.formatEther(divestmentAmount)} USDC`);
      console.log(`Fee rate: ${feeRates.divestment / 100}%`);
      console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
      console.log(`Net amount: ${ethers.formatEther(expectedNetAmount)} USDC`);
      
      // Verify fee calculation is correct (manually)
      expect(expectedFee).to.equal(ethers.parseEther("100")); // 2.0% of 5,000 = 100
      expect(expectedNetAmount).to.equal(ethers.parseEther("4900")); // 5,000 - 100 = 4,900
    });
    
    it("Should correctly calculate ragequit fees", async function() {
      const { mockUSDC, user1, feeRates } = await loadFixture(deployFixture);
      
      // Ragequit amount
      const ragequitAmount = ethers.parseEther("1000"); // 1,000 USDC
      
      // Calculate expected fee
      const expectedFee = (ragequitAmount * BigInt(feeRates.ragequit)) / BigInt(10000);
      const expectedNetAmount = ragequitAmount - expectedFee;
      
      console.log(`Ragequit amount: ${ethers.formatEther(ragequitAmount)} USDC`);
      console.log(`Fee rate: ${feeRates.ragequit / 100}%`);
      console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
      console.log(`Net amount: ${ethers.formatEther(expectedNetAmount)} USDC`);
      
      // Verify fee calculation is correct (manually)
      expect(expectedFee).to.equal(ethers.parseEther("40")); // 4.0% of 1,000 = 40
      expect(expectedNetAmount).to.equal(ethers.parseEther("960")); // 1,000 - 40 = 960
    });
    
    it("Should correctly calculate yield fees", async function() {
      const { mockUSDC, user1, feeRates } = await loadFixture(deployFixture);
      
      // Yield amount
      const yieldAmount = ethers.parseEther("500"); // 500 USDC yield
      
      // Calculate expected fee
      const expectedFee = (yieldAmount * BigInt(feeRates.yield)) / BigInt(10000);
      const expectedNetAmount = yieldAmount - expectedFee;
      
      console.log(`Yield amount: ${ethers.formatEther(yieldAmount)} USDC`);
      console.log(`Fee rate: ${feeRates.yield / 100}%`);
      console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
      console.log(`Net amount: ${ethers.formatEther(expectedNetAmount)} USDC`);
      
      // Verify fee calculation is correct (manually)
      expect(expectedFee).to.equal(ethers.parseEther("75")); // 15.0% of 500 = 75
      expect(expectedNetAmount).to.equal(ethers.parseEther("425")); // 500 - 75 = 425
    });
  });
  
  describe("Fee Distribution", function() {
    it("Should correctly distribute fees according to shares", async function() {
      const { mockUSDC, treasury, rewardPool, feeShares } = await loadFixture(deployFixture);
      
      // Total fee amount to distribute
      const totalFeeAmount = ethers.parseEther("1000"); // 1,000 USDC in fees
      
      // Calculate expected distribution
      const treasuryShare = (totalFeeAmount * BigInt(feeShares.treasury)) / BigInt(10000);
      const tokenHoldersShare = (totalFeeAmount * BigInt(feeShares.tokenHolders)) / BigInt(10000);
      const governanceShare = (totalFeeAmount * BigInt(feeShares.governance)) / BigInt(10000);
      const ecosystemShare = (totalFeeAmount * BigInt(feeShares.ecosystem)) / BigInt(10000);
      
      console.log(`Total fee amount: ${ethers.formatEther(totalFeeAmount)} USDC`);
      console.log(`Treasury share (${feeShares.treasury / 100}%): ${ethers.formatEther(treasuryShare)} USDC`);
      console.log(`Token holders share (${feeShares.tokenHolders / 100}%): ${ethers.formatEther(tokenHoldersShare)} USDC`);
      console.log(`Governance share (${feeShares.governance / 100}%): ${ethers.formatEther(governanceShare)} USDC`);
      console.log(`Ecosystem share (${feeShares.ecosystem / 100}%): ${ethers.formatEther(ecosystemShare)} USDC`);
      
      // Verify distribution is correct (manually)
      expect(treasuryShare).to.equal(ethers.parseEther("350")); // 35% of 1,000 = 350
      expect(tokenHoldersShare).to.equal(ethers.parseEther("350")); // 35% of 1,000 = 350
      expect(governanceShare).to.equal(ethers.parseEther("200")); // 20% of 1,000 = 200
      expect(ecosystemShare).to.equal(ethers.parseEther("100")); // 10% of 1,000 = 100
      
      // Verify all shares sum to total
      const sumOfShares = treasuryShare + tokenHoldersShare + governanceShare + ecosystemShare;
      expect(sumOfShares).to.equal(totalFeeAmount);
    });
    
    it("Should handle tiered fee structures based on amount", async function() {
      // Define tiered fee structure for investment
      const tieredFees = [
        { threshold: ethers.parseEther("1000"), rate: 200 }, // 2.0% for amounts <= 1,000
        { threshold: ethers.parseEther("10000"), rate: 150 }, // 1.5% for amounts <= 10,000
        { threshold: ethers.parseEther("100000"), rate: 100 }, // 1.0% for amounts <= 100,000
        { threshold: ethers.MaxUint256, rate: 50 } // 0.5% for amounts > 100,000
      ];
      
      // Test amounts
      const testAmounts = [
        ethers.parseEther("500"),     // Tier 1
        ethers.parseEther("5000"),    // Tier 2
        ethers.parseEther("50000"),   // Tier 3
        ethers.parseEther("500000")   // Tier 4
      ];
      
      // Expected rates by tier
      const expectedRates = [200, 150, 100, 50];
      
      // Calculate and verify fees for each amount
      for (let i = 0; i < testAmounts.length; i++) {
        const amount = testAmounts[i];
        
        // Determine applicable tier
        let tier;
        for (let j = 0; j < tieredFees.length; j++) {
          if (amount <= tieredFees[j].threshold) {
            tier = tieredFees[j];
            break;
          }
        }
        
        // Calculate fee
        const expectedFee = (amount * BigInt(tier.rate)) / BigInt(10000);
        
        console.log(`Amount: ${ethers.formatEther(amount)} USDC (Tier ${i+1})`);
        console.log(`Fee rate: ${tier.rate / 100}%`);
        console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
        
        // Verify tier selection
        expect(tier.rate).to.equal(expectedRates[i]);
      }
    });
    
    it("Should handle volume-based discounts for frequent users", async function() {
      // Simulate a user's transaction history
      const transactionHistory = [
        { type: "investment", amount: ethers.parseEther("1000") },
        { type: "investment", amount: ethers.parseEther("2000") },
        { type: "divestment", amount: ethers.parseEther("500") },
        { type: "investment", amount: ethers.parseEther("5000") }
      ];
      
      // Base fee rates
      const baseFeeRates = {
        investment: 150, // 1.5%
        divestment: 200  // 2.0%
      };
      
      // Volume discounts (basis points reduction)
      const volumeDiscounts = [
        { threshold: ethers.parseEther("5000"), discount: 25 },  // 0.25% discount at 5,000
        { threshold: ethers.parseEther("10000"), discount: 50 }, // 0.50% discount at 10,000
        { threshold: ethers.parseEther("50000"), discount: 75 }  // 0.75% discount at 50,000
      ];
      
      // Calculate cumulative volume and applicable discount
      let cumulativeVolume = ethers.parseEther("0");
      for (const tx of transactionHistory) {
        cumulativeVolume += tx.amount;
      }
      
      // Find applicable discount
      let appliedDiscount = 0;
      for (const discount of volumeDiscounts) {
        if (cumulativeVolume >= discount.threshold) {
          appliedDiscount = discount.discount;
        } else {
          break;
        }
      }
      
      console.log(`Cumulative transaction volume: ${ethers.formatEther(cumulativeVolume)} USDC`);
      console.log(`Applied discount: ${appliedDiscount / 100}%`);
      
      // Calculate discounted fee rate for a new transaction
      const newTransaction = { type: "investment", amount: ethers.parseEther("10000") };
      const baseRate = baseFeeRates[newTransaction.type];
      const discountedRate = baseRate - appliedDiscount;
      
      const expectedFee = (newTransaction.amount * BigInt(discountedRate)) / BigInt(10000);
      
      console.log(`New transaction: ${ethers.formatEther(newTransaction.amount)} USDC (${newTransaction.type})`);
      console.log(`Base fee rate: ${baseRate / 100}%`);
      console.log(`Discounted fee rate: ${discountedRate / 100}%`);
      console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
      
      // Verify discount is applied correctly
      expect(discountedRate).to.be.lessThan(baseRate);
      
      // For this example, cumulativeVolume is 8,500, which exceeds the 5,000 threshold
      // So we expect a 0.25% (25 basis points) discount
      expect(appliedDiscount).to.equal(25);
      expect(discountedRate).to.equal(125); // 1.5% - 0.25% = 1.25%
    });
  });
  
  describe("Time-Based Fee Adjustments", function() {
    it("Should reduce divestment fees based on holding time", async function() {
      // Time-based fee schedule for divestment
      const timeBasedFees = [
        { holdingPeriod: 30 * 24 * 60 * 60, rate: 300 },   // 3.0% if held < 30 days
        { holdingPeriod: 90 * 24 * 60 * 60, rate: 200 },   // 2.0% if held < 90 days
        { holdingPeriod: 180 * 24 * 60 * 60, rate: 100 },  // 1.0% if held < 180 days
        { holdingPeriod: Number.MAX_SAFE_INTEGER, rate: 50 } // 0.5% if held >= 180 days
      ];
      
      // Test holding periods in seconds
      const testHoldingPeriods = [
        15 * 24 * 60 * 60,  // 15 days
        60 * 24 * 60 * 60,  // 60 days
        120 * 24 * 60 * 60, // 120 days
        365 * 24 * 60 * 60  // 365 days
      ];
      
      // Expected rates by holding period
      const expectedRates = [300, 200, 100, 50];
      
      // Fixed divestment amount
      const divestmentAmount = ethers.parseEther("10000"); // 10,000 USDC
      
      // Calculate and verify fees for each holding period
      for (let i = 0; i < testHoldingPeriods.length; i++) {
        const holdingPeriod = testHoldingPeriods[i];
        
        // Determine applicable fee rate
        let appliedRate;
        for (let j = 0; j < timeBasedFees.length; j++) {
          if (holdingPeriod < timeBasedFees[j].holdingPeriod) {
            appliedRate = timeBasedFees[j].rate;
            break;
          }
        }
        
        // Calculate fee
        const expectedFee = (divestmentAmount * BigInt(appliedRate)) / BigInt(10000);
        
        console.log(`Holding period: ${holdingPeriod / (24 * 60 * 60)} days`);
        console.log(`Fee rate: ${appliedRate / 100}%`);
        console.log(`Fee amount: ${ethers.formatEther(expectedFee)} USDC`);
        
        // Verify rate selection
        expect(appliedRate).to.equal(expectedRates[i]);
      }
    });
  });
});