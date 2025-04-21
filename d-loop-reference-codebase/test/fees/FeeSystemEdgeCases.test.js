const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Fee System Edge Cases and Integration", function () {
  let feeCalculator;
  let feeProcessor;
  let treasury;
  let rewardDistributor;
  let assetDAOWithFees;
  let mockToken;
  let mockAsset;
  let owner;
  let investor1;
  let investor2;
  let investor3;
  let protocolDAO;
  
  // Constants for edge case testing
  const MINIMUM_INVESTMENT = ethers.utils.parseEther("0.000001"); // Very small amount
  const LARGE_INVESTMENT = ethers.utils.parseEther("1000000000"); // Very large amount
  const INVEST_FEE_PERCENT = ethers.utils.parseEther("0.1"); // 10%
  const DIVEST_FEE_PERCENT = ethers.utils.parseEther("0.05"); // 5%
  const RAGEQUIT_FEE_PERCENT = ethers.utils.parseEther("0.2"); // 20%
  const TREASURY_PERCENTAGE = ethers.utils.parseEther("0.7"); // 70%
  const REWARD_PERCENTAGE = ethers.utils.parseEther("0.3"); // 30%
  
  before(async function () {
    [owner, investor1, investor2, investor3, protocolDAO] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("D-AI", "DAI", 18);
    await mockToken.deployed();
    
    mockAsset = await MockToken.deploy("TEST", "TEST", 18);
    await mockAsset.deployed();
    
    // Mint tokens to investors
    await mockAsset.mint(investor1.address, LARGE_INVESTMENT);
    await mockAsset.mint(investor2.address, ethers.utils.parseEther("100"));
    await mockAsset.mint(investor3.address, MINIMUM_INVESTMENT);
    
    // Deploy fee components
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      INVEST_FEE_PERCENT,
      DIVEST_FEE_PERCENT,
      RAGEQUIT_FEE_PERCENT
    );
    await feeCalculator.deployed();
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.deployed();
    
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy();
    await rewardDistributor.deployed();
    
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.address,
      rewardDistributor.address,
      TREASURY_PERCENTAGE,
      REWARD_PERCENTAGE
    );
    await feeProcessor.deployed();
    
    // Deploy AssetDAO with fees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAOWithFees = await AssetDAOWithFees.deploy(
      mockToken.address,
      feeCalculator.address,
      feeProcessor.address
    );
    await assetDAOWithFees.deployed();
    
    // Set up permissions
    await treasury.setFeeProcessor(feeProcessor.address);
    await rewardDistributor.setFeeProcessor(feeProcessor.address);
    await feeProcessor.setAssetDAO(assetDAOWithFees.address);
    
    // Set ProtocolDAO as admin for parameter adjustment tests
    await assetDAOWithFees.transferOwnership(protocolDAO.address);
  });
  
  describe("Fee Calculation Edge Cases", function () {
    it("should correctly calculate fees for minimum investment amount", async function () {
      const fee = await feeCalculator.calculateInvestFee(MINIMUM_INVESTMENT);
      const expectedFee = MINIMUM_INVESTMENT.mul(INVEST_FEE_PERCENT).div(ethers.utils.parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
      
      // Verify fee is not zero even for tiny investments
      expect(fee).to.be.gt(0);
    });
    
    it("should handle very large investment amounts without overflow", async function () {
      const fee = await feeCalculator.calculateInvestFee(LARGE_INVESTMENT);
      const expectedFee = LARGE_INVESTMENT.mul(INVEST_FEE_PERCENT).div(ethers.utils.parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
    });
    
    it("should correctly calculate ragequit fees (highest fee rate)", async function () {
      const amount = ethers.utils.parseEther("1");
      const fee = await feeCalculator.calculateRagequitFee(amount);
      const expectedFee = amount.mul(RAGEQUIT_FEE_PERCENT).div(ethers.utils.parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
      expect(fee).to.be.gt(await feeCalculator.calculateInvestFee(amount));
      expect(fee).to.be.gt(await feeCalculator.calculateDivestFee(amount));
    });
    
    it("should handle zero amount gracefully", async function () {
      const fee = await feeCalculator.calculateInvestFee(0);
      
      expect(fee).to.equal(0);
    });
  });
  
  describe("Fee Processor Distribution Edge Cases", function () {
    it("should correctly split fees for minimal amounts", async function () {
      // Calculate a very small fee
      const amount = MINIMUM_INVESTMENT;
      const fee = await feeCalculator.calculateInvestFee(amount);
      
      // Process the fee
      await mockAsset.connect(investor3).approve(feeProcessor.address, fee);
      await feeProcessor.processFee(mockAsset.address, investor3.address, fee);
      
      // Check treasury balance
      const treasuryFee = fee.mul(TREASURY_PERCENTAGE).div(ethers.utils.parseEther("1"));
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryFee);
      
      // Check reward distributor balance
      const rewardFee = fee.mul(REWARD_PERCENTAGE).div(ethers.utils.parseEther("1"));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardFee);
      
      // Check that the sum equals the original fee (no dust lost)
      expect(treasuryFee.add(rewardFee)).to.equal(fee);
    });
    
    it("should handle large amounts without overflow", async function () {
      // Calculate a very large fee
      const amount = LARGE_INVESTMENT;
      const fee = await feeCalculator.calculateInvestFee(amount);
      
      // Get balances before
      const treasuryBefore = await mockAsset.balanceOf(treasury.address);
      const rewardBefore = await mockAsset.balanceOf(rewardDistributor.address);
      
      // Process the fee
      await mockAsset.connect(investor1).approve(feeProcessor.address, fee);
      await feeProcessor.processFee(mockAsset.address, investor1.address, fee);
      
      // Check treasury balance
      const treasuryFee = fee.mul(TREASURY_PERCENTAGE).div(ethers.utils.parseEther("1"));
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryBefore.add(treasuryFee));
      
      // Check reward distributor balance
      const rewardFee = fee.mul(REWARD_PERCENTAGE).div(ethers.utils.parseEther("1"));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardBefore.add(rewardFee));
      
      // Check that the sum equals the original fee (no dust lost)
      expect(treasuryFee.add(rewardFee)).to.equal(fee);
    });
  });
  
  describe("AssetDAO Fee Integration", function () {
    beforeEach(async function () {
      // Ensure mockAsset is supported by AssetDAO
      await assetDAOWithFees.connect(protocolDAO).addSupportedAsset(mockAsset.address);
    });
    
    it("should handle investment with fees in a complete flow", async function () {
      const investAmount = ethers.utils.parseEther("10");
      const fee = await feeCalculator.calculateInvestFee(investAmount);
      const netAmount = investAmount.sub(fee);
      
      // Get balances before
      const treasuryBefore = await mockAsset.balanceOf(treasury.address);
      const rewardBefore = await mockAsset.balanceOf(rewardDistributor.address);
      
      // Approve and invest
      await mockAsset.connect(investor2).approve(assetDAOWithFees.address, investAmount);
      await assetDAOWithFees.connect(investor2).invest(mockAsset.address, investAmount);
      
      // Verify D-AI tokens minted to investor (net of fees)
      expect(await mockToken.balanceOf(investor2.address)).to.equal(netAmount);
      
      // Verify fees sent to treasury and reward distributor
      const treasuryFee = fee.mul(TREASURY_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const rewardFee = fee.mul(REWARD_PERCENTAGE).div(ethers.utils.parseEther("1"));
      
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryBefore.add(treasuryFee));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardBefore.add(rewardFee));
    });
    
    it("should handle divestment with fees in a complete flow", async function () {
      // First invest to get D-AI tokens
      const investAmount = ethers.utils.parseEther("20");
      const investFee = await feeCalculator.calculateInvestFee(investAmount);
      const netInvestAmount = investAmount.sub(investFee);
      
      await mockAsset.connect(investor2).approve(assetDAOWithFees.address, investAmount);
      await assetDAOWithFees.connect(investor2).invest(mockAsset.address, investAmount);
      
      // Get balances before divestment
      const treasuryBefore = await mockAsset.balanceOf(treasury.address);
      const rewardBefore = await mockAsset.balanceOf(rewardDistributor.address);
      const investorDaiBalance = await mockToken.balanceOf(investor2.address);
      
      // Now divest half of the D-AI tokens
      const divestAmount = investorDaiBalance.div(2);
      const expectedAssetReturn = divestAmount; // 1:1 ratio for simplicity
      const divestFee = await feeCalculator.calculateDivestFee(expectedAssetReturn);
      const netDivestAmount = expectedAssetReturn.sub(divestFee);
      
      // Approve and divest
      await mockToken.connect(investor2).approve(assetDAOWithFees.address, divestAmount);
      await assetDAOWithFees.connect(investor2).divest(mockAsset.address, divestAmount);
      
      // Verify investor received assets (net of fees)
      const investorAssetBalance = await mockAsset.balanceOf(investor2.address);
      expect(investorAssetBalance).to.equal(netDivestAmount);
      
      // Verify fees sent to treasury and reward distributor
      const treasuryFee = divestFee.mul(TREASURY_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const rewardFee = divestFee.mul(REWARD_PERCENTAGE).div(ethers.utils.parseEther("1"));
      
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryBefore.add(treasuryFee));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardBefore.add(rewardFee));
    });
    
    it("should handle ragequit with higher fees", async function () {
      // First invest to get D-AI tokens
      const investAmount = ethers.utils.parseEther("30");
      const investFee = await feeCalculator.calculateInvestFee(investAmount);
      const netInvestAmount = investAmount.sub(investFee);
      
      await mockAsset.connect(investor2).approve(assetDAOWithFees.address, investAmount);
      await assetDAOWithFees.connect(investor2).invest(mockAsset.address, investAmount);
      
      // Get balances before ragequit
      const treasuryBefore = await mockAsset.balanceOf(treasury.address);
      const rewardBefore = await mockAsset.balanceOf(rewardDistributor.address);
      const investorDaiBalance = await mockToken.balanceOf(investor2.address);
      
      // Now ragequit with all D-AI tokens
      const ragequitAmount = investorDaiBalance;
      const expectedAssetReturn = ragequitAmount; // 1:1 ratio for simplicity
      const ragequitFee = await feeCalculator.calculateRagequitFee(expectedAssetReturn);
      const netRagequitAmount = expectedAssetReturn.sub(ragequitFee);
      
      // Approve and ragequit
      await mockToken.connect(investor2).approve(assetDAOWithFees.address, ragequitAmount);
      await assetDAOWithFees.connect(investor2).ragequit(ragequitAmount);
      
      // Verify investor received assets (net of fees)
      const investorAssetBalance = await mockAsset.balanceOf(investor2.address);
      expect(investorAssetBalance).to.equal(netRagequitAmount);
      
      // Verify D-AI tokens are burned
      expect(await mockToken.balanceOf(investor2.address)).to.equal(0);
      
      // Verify fees sent to treasury and reward distributor
      const treasuryFee = ragequitFee.mul(TREASURY_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const rewardFee = ragequitFee.mul(REWARD_PERCENTAGE).div(ethers.utils.parseEther("1"));
      
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryBefore.add(treasuryFee));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardBefore.add(rewardFee));
    });
  });
  
  describe("Parameter Adjustment via Governance", function () {
    it("should allow ProtocolDAO to adjust fee percentages", async function () {
      const newInvestFee = ethers.utils.parseEther("0.15"); // 15%
      const newDivestFee = ethers.utils.parseEther("0.075"); // 7.5%
      const newRagequitFee = ethers.utils.parseEther("0.25"); // 25%
      
      // Update fees via ProtocolDAO (governance)
      await feeCalculator.connect(protocolDAO).updateFeePercentages(
        newInvestFee,
        newDivestFee,
        newRagequitFee
      );
      
      // Verify fee percentages were updated
      expect(await feeCalculator.investFeePercent()).to.equal(newInvestFee);
      expect(await feeCalculator.divestFeePercent()).to.equal(newDivestFee);
      expect(await feeCalculator.ragequitFeePercent()).to.equal(newRagequitFee);
      
      // Verify fee calculation uses new percentages
      const amount = ethers.utils.parseEther("1");
      expect(await feeCalculator.calculateInvestFee(amount)).to.equal(
        amount.mul(newInvestFee).div(ethers.utils.parseEther("1"))
      );
    });
    
    it("should prevent unauthorized fee parameter changes", async function () {
      const newFee = ethers.utils.parseEther("0.2");
      
      // Try to update fee as non-governance account
      await expect(
        feeCalculator.connect(investor1).updateFeePercentages(newFee, newFee, newFee)
      ).to.be.reverted;
    });
    
    it("should allow ProtocolDAO to adjust fee distribution percentages", async function () {
      const newTreasuryPercentage = ethers.utils.parseEther("0.8"); // 80%
      const newRewardPercentage = ethers.utils.parseEther("0.2"); // 20%
      
      // Update distribution percentages via ProtocolDAO
      await feeProcessor.connect(protocolDAO).updateDistributionPercentages(
        newTreasuryPercentage,
        newRewardPercentage
      );
      
      // Verify percentages were updated
      expect(await feeProcessor.treasuryPercentage()).to.equal(newTreasuryPercentage);
      expect(await feeProcessor.rewardPercentage()).to.equal(newRewardPercentage);
      
      // Verify fee distribution uses new percentages
      const fee = ethers.utils.parseEther("1");
      
      // Get balances before
      const treasuryBefore = await mockAsset.balanceOf(treasury.address);
      const rewardBefore = await mockAsset.balanceOf(rewardDistributor.address);
      
      // Process fee
      await mockAsset.connect(investor1).approve(feeProcessor.address, fee);
      await feeProcessor.processFee(mockAsset.address, investor1.address, fee);
      
      // Verify distribution
      const treasuryFee = fee.mul(newTreasuryPercentage).div(ethers.utils.parseEther("1"));
      const rewardFee = fee.mul(newRewardPercentage).div(ethers.utils.parseEther("1"));
      
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(treasuryBefore.add(treasuryFee));
      expect(await mockAsset.balanceOf(rewardDistributor.address)).to.equal(rewardBefore.add(rewardFee));
    });
  });
  
  describe("Treasury Management", function () {
    it("should allow governance to allocate funds from the treasury", async function () {
      // Get current treasury balance
      const currentBalance = await mockAsset.balanceOf(treasury.address);
      expect(currentBalance).to.be.gt(0);
      
      // Allocate half of the treasury to a recipient
      const recipient = investor3.address;
      const allocationAmount = currentBalance.div(2);
      
      await treasury.connect(protocolDAO).allocateFunds(
        mockAsset.address,
        recipient,
        allocationAmount
      );
      
      // Verify funds were transferred
      expect(await mockAsset.balanceOf(recipient)).to.equal(allocationAmount);
      expect(await mockAsset.balanceOf(treasury.address)).to.equal(currentBalance.sub(allocationAmount));
    });
    
    it("should prevent unauthorized treasury allocations", async function () {
      const currentBalance = await mockAsset.balanceOf(treasury.address);
      const allocationAmount = currentBalance.div(2);
      
      // Try to allocate as non-governance account
      await expect(
        treasury.connect(investor1).allocateFunds(
          mockAsset.address,
          investor1.address,
          allocationAmount
        )
      ).to.be.reverted;
    });
  });
  
  describe("Multiple Investments and Divestments", function () {
    it("should correctly handle multiple investment/divestment cycles", async function () {
      // Setup a new investor for this test
      const cycleInvestor = investor3;
      const initialAmount = ethers.utils.parseEther("50");
      
      // Mint tokens to the investor
      await mockAsset.mint(cycleInvestor.address, initialAmount.mul(10));
      
      // Multiple cycles of investing and divesting
      for (let i = 0; i < 5; i++) {
        // Invest
        const investAmount = initialAmount.add(ethers.utils.parseEther(i.toString()));
        const investFee = await feeCalculator.calculateInvestFee(investAmount);
        const netInvestAmount = investAmount.sub(investFee);
        
        await mockAsset.connect(cycleInvestor).approve(assetDAOWithFees.address, investAmount);
        await assetDAOWithFees.connect(cycleInvestor).invest(mockAsset.address, investAmount);
        
        // Verify D-AI tokens received
        const daiBalance = await mockToken.balanceOf(cycleInvestor.address);
        expect(daiBalance).to.be.gte(netInvestAmount); // At least the net amount (may be more from previous cycles)
        
        // Divest half
        const divestAmount = daiBalance.div(2);
        const expectedAssetReturn = divestAmount; // 1:1 ratio
        const divestFee = await feeCalculator.calculateDivestFee(expectedAssetReturn);
        const netDivestAmount = expectedAssetReturn.sub(divestFee);
        
        await mockToken.connect(cycleInvestor).approve(assetDAOWithFees.address, divestAmount);
        await assetDAOWithFees.connect(cycleInvestor).divest(mockAsset.address, divestAmount);
        
        // Verify assets received back
        expect(await mockAsset.balanceOf(cycleInvestor.address)).to.be.gte(netDivestAmount);
      }
      
      // Final ragequit to clear remaining position
      const finalDaiBalance = await mockToken.balanceOf(cycleInvestor.address);
      if (finalDaiBalance.gt(0)) {
        await mockToken.connect(cycleInvestor).approve(assetDAOWithFees.address, finalDaiBalance);
        await assetDAOWithFees.connect(cycleInvestor).ragequit(finalDaiBalance);
        
        // Verify all D-AI tokens are burned
        expect(await mockToken.balanceOf(cycleInvestor.address)).to.equal(0);
      }
    });
  });
});