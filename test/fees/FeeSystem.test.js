const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");

describe("Asset DAO Fee System", function () {
  let admin, assetDAO, user1, user2;
  let mockToken;
  let feeCalculator, treasury, rewardDistributor, feeCollector;
  
  const PERCENTAGE_BASE = parseEther("1"); // 100% = 1e18
  
  beforeEach(async function () {
    [admin, assetDAO, governance, user1, user2] = await ethers.getSigners();
    
    // Deploy Mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST");
    await mockToken.deployed();
    
    // Mint some tokens to assetDAO (simulating the DAO holding assets)
    await mockToken.mint(assetDAO.address, parseEther("1000000"));
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(admin.address, governance.address);
    await feeCalculator.deployed();
    
    // Deploy RewardDistributor (30 days epoch)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(
      admin.address,
      admin.address, // Temporary treasury address, will update after Treasury deployment
      governance.address,
      30 * 24 * 60 * 60 // 30 days in seconds
    );
    await rewardDistributor.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(
      admin.address,
      admin.address, // Temporary fee collector, will update after FeeCollector deployment
      rewardDistributor.address
    );
    await treasury.deployed();
    
    // Update treasury in RewardDistributor
    await rewardDistributor.addTreasuryRole(treasury.address);
    
    // Deploy FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      admin.address,
      assetDAO.address,
      feeCalculator.address,
      treasury.address
    );
    await feeCollector.deployed();
    
    // Update fee collector in Treasury
    await treasury.updateFeeCollector(feeCollector.address);
  });
  
  describe("FeeCalculator", function () {
    it("should initialize with correct default fees", async function () {
      const [investFee, divestFee, ragequitFee] = await feeCalculator.getCurrentFees();
      
      expect(investFee).to.equal(parseEther("0.1")); // 10%
      expect(divestFee).to.equal(parseEther("0.05")); // 5%
      expect(ragequitFee).to.equal(parseEther("0.2")); // 20%
    });
    
    it("should calculate fees correctly", async function () {
      const amount = parseEther("1000");
      
      const investFee = await feeCalculator.calculateFee(amount, 0);
      const divestFee = await feeCalculator.calculateFee(amount, 1);
      const ragequitFee = await feeCalculator.calculateFee(amount, 2);
      
      expect(investFee).to.equal(parseEther("100")); // 10% of 1000
      expect(divestFee).to.equal(parseEther("50")); // 5% of 1000
      expect(ragequitFee).to.equal(parseEther("200")); // 20% of 1000
    });
    
    it("should allow governance to update fees within limits", async function () {
      // Update fees
      await feeCalculator.connect(governance).updateFees(
        parseEther("0.15"), // 15% invest fee
        parseEther("0.07"), // 7% divest fee
        parseEther("0.25")  // 25% ragequit fee
      );
      
      const [investFee, divestFee, ragequitFee] = await feeCalculator.getCurrentFees();
      
      expect(investFee).to.equal(parseEther("0.15"));
      expect(divestFee).to.equal(parseEther("0.07"));
      expect(ragequitFee).to.equal(parseEther("0.25"));
    });
    
    it("should prevent setting fees outside limits", async function () {
      // Try to set invest fee too high
      await expect(
        feeCalculator.connect(governance).updateFees(
          parseEther("0.25"), // 25% invest fee (above 20% max)
          parseEther("0.05"),
          parseEther("0.2")
        )
      ).to.be.revertedWith("FeeCalculator: Invest fee out of range");
      
      // Try to set divest fee too low
      await expect(
        feeCalculator.connect(governance).updateFees(
          parseEther("0.1"),
          parseEther("0.005"), // 0.5% divest fee (below 1% min)
          parseEther("0.2")
        )
      ).to.be.revertedWith("FeeCalculator: Divest fee out of range");
    });
    
    it("should allow admin to update fee limits", async function () {
      // Update fee limits
      await feeCalculator.connect(admin).updateFeeLimits(
        parseEther("0.25"), // 25% max invest fee
        parseEther("0.01"), // 1% min divest fee
        parseEther("0.3")   // 30% max ragequit fee
      );
      
      // Now update fees to new limits
      await feeCalculator.connect(governance).updateFees(
        parseEther("0.2"),
        parseEther("0.01"),
        parseEther("0.3")
      );
      
      const [investFee, divestFee, ragequitFee] = await feeCalculator.getCurrentFees();
      expect(investFee).to.equal(parseEther("0.2"));
      expect(divestFee).to.equal(parseEther("0.01"));
      expect(ragequitFee).to.equal(parseEther("0.3"));
    });
  });
});
