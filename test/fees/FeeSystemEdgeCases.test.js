const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");
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
  const MINIMUM_INVESTMENT = parseEther("0.000001"); // Very small amount
  const LARGE_INVESTMENT = parseEther("1000000000"); // Very large amount
  const INVEST_FEE_PERCENT = parseEther("0.1"); // 10%
  const DIVEST_FEE_PERCENT = parseEther("0.05"); // 5%
  const RAGEQUIT_FEE_PERCENT = parseEther("0.2"); // 20%
  const TREASURY_PERCENTAGE = parseEther("0.7"); // 70%
  const REWARD_PERCENTAGE = parseEther("0.3"); // 30%
  
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
    await mockAsset.mint(investor2.address, parseEther("100"));
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
      const expectedFee = MINIMUM_INVESTMENT.mul(INVEST_FEE_PERCENT).div(parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
      
      // Verify fee is not zero even for tiny investments
      expect(fee).to.be.gt(0);
    });
    
    it("should handle very large investment amounts without overflow", async function () {
      const fee = await feeCalculator.calculateInvestFee(LARGE_INVESTMENT);
      const expectedFee = LARGE_INVESTMENT.mul(INVEST_FEE_PERCENT).div(parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
    });
    
    it("should correctly calculate ragequit fees (highest fee rate)", async function () {
      const amount = parseEther("1");
      const fee = await feeCalculator.calculateRagequitFee(amount);
      const expectedFee = amount.mul(RAGEQUIT_FEE_PERCENT).div(parseEther("1"));
      
      expect(fee).to.equal(expectedFee);
      expect(fee).to.be.gt(await feeCalculator.calculateInvestFee(amount));
      expect(fee).to.be.gt(await feeCalculator.calculateDivestFee(amount));
    });
    
    it("should handle zero amount gracefully", async function () {
      const fee = await feeCalculator.calculateInvestFee(0);
      
      expect(fee).to.equal(0);
    });
  });
});
