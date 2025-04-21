const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FeeCalculator", function () {
  let FeeCalculator;
  let feeCalculator;
  let owner, treasury, rewardDistributor, adjuster, user;
  
  // Constants for testing
  const PARAMETER_ADJUSTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PARAMETER_ADJUSTER_ROLE"));
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  
  beforeEach(async function () {
    [owner, treasury, rewardDistributor, adjuster, user] = await ethers.getSigners();
    
    // Deploy FeeCalculator
    FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await upgrades.deployProxy(FeeCalculator, [
      treasury.address,
      rewardDistributor.address
    ]);
    
    await feeCalculator.deployed();
    
    // Grant adjuster role
    await feeCalculator.grantRole(PARAMETER_ADJUSTER_ROLE, adjuster.address);
  });
  
  describe("Initialization", function () {
    it("should set default fee percentages correctly", async function () {
      expect(await feeCalculator.investFeePercent()).to.equal(1000); // 10%
      expect(await feeCalculator.divestFeePercent()).to.equal(500); // 5%
      expect(await feeCalculator.ragequitFeePercent()).to.equal(2000); // 20%
    });
    
    it("should set default fee split correctly", async function () {
      expect(await feeCalculator.treasuryPercent()).to.equal(7000); // 70%
      expect(await feeCalculator.rewardsPercent()).to.equal(3000); // 30%
    });
    
    it("should set fee recipients correctly", async function () {
      expect(await feeCalculator.treasury()).to.equal(treasury.address);
      expect(await feeCalculator.rewardDistributor()).to.equal(rewardDistributor.address);
    });
    
    it("should assign roles correctly", async function () {
      expect(await feeCalculator.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await feeCalculator.hasRole(PARAMETER_ADJUSTER_ROLE, adjuster.address)).to.be.true;
    });
  });
  
  describe("Fee Calculation", function () {
    it("should calculate investment fee correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      const expectedFee = ethers.utils.parseEther("10"); // 10%
      const expectedNet = ethers.utils.parseEther("90");
      const expectedTreasury = ethers.utils.parseEther("7"); // 70% of fee
      const expectedRewards = ethers.utils.parseEther("3"); // 30% of fee
      
      const result = await feeCalculator.calculateInvestFee(amount);
      
      expect(result.feeAmount).to.equal(expectedFee);
      expect(result.netAmount).to.equal(expectedNet);
      expect(result.treasuryAmount).to.equal(expectedTreasury);
      expect(result.rewardsAmount).to.equal(expectedRewards);
    });
    
    it("should calculate divestment fee correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      const expectedFee = ethers.utils.parseEther("5"); // 5%
      const expectedNet = ethers.utils.parseEther("95");
      const expectedTreasury = ethers.utils.parseEther("3.5"); // 70% of fee
      const expectedRewards = ethers.utils.parseEther("1.5"); // 30% of fee
      
      const result = await feeCalculator.calculateDivestFee(amount);
      
      expect(result.feeAmount).to.equal(expectedFee);
      expect(result.netAmount).to.equal(expectedNet);
      expect(result.treasuryAmount).to.equal(expectedTreasury);
      expect(result.rewardsAmount).to.equal(expectedRewards);
    });
    
    it("should calculate ragequit fee correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      const expectedFee = ethers.utils.parseEther("20"); // 20%
      const expectedNet = ethers.utils.parseEther("80");
      const expectedTreasury = ethers.utils.parseEther("14"); // 70% of fee
      const expectedRewards = ethers.utils.parseEther("6"); // 30% of fee
      
      const result = await feeCalculator.calculateRagequitFee(amount);
      
      expect(result.feeAmount).to.equal(expectedFee);
      expect(result.netAmount).to.equal(expectedNet);
      expect(result.treasuryAmount).to.equal(expectedTreasury);
      expect(result.rewardsAmount).to.equal(expectedRewards);
    });
  });
  
  describe("Parameter Adjustments", function () {
    it("should allow updating fee percentages by parameter adjuster", async function () {
      await feeCalculator.connect(adjuster).updateFeePercentages(1200, 600, 2500);
      
      expect(await feeCalculator.investFeePercent()).to.equal(1200);
      expect(await feeCalculator.divestFeePercent()).to.equal(600);
      expect(await feeCalculator.ragequitFeePercent()).to.equal(2500);
    });
    
    it("should allow updating fee split by parameter adjuster", async function () {
      await feeCalculator.connect(adjuster).updateFeeSplit(8000, 2000);
      
      expect(await feeCalculator.treasuryPercent()).to.equal(8000);
      expect(await feeCalculator.rewardsPercent()).to.equal(2000);
    });
    
    it("should allow updating fee recipients by admin", async function () {
      await feeCalculator.connect(owner).updateFeeRecipients(user.address, adjuster.address);
      
      expect(await feeCalculator.treasury()).to.equal(user.address);
      expect(await feeCalculator.rewardDistributor()).to.equal(adjuster.address);
    });
    
    it("should reject fee percentages above 30%", async function () {
      await expect(
        feeCalculator.connect(adjuster).updateFeePercentages(3100, 600, 2500)
      ).to.be.revertedWith("InvalidParameters()");
    });
    
    it("should reject fee split that doesn't sum to 100%", async function () {
      await expect(
        feeCalculator.connect(adjuster).updateFeeSplit(7000, 2000)
      ).to.be.revertedWith("InvalidParameters()");
    });
    
    it("should reject zero addresses for fee recipients", async function () {
      await expect(
        feeCalculator.connect(owner).updateFeeRecipients(ethers.constants.AddressZero, rewardDistributor.address)
      ).to.be.revertedWith("ZeroAddress()");
    });
    
    it("should reject updates from unauthorized users", async function () {
      await expect(
        feeCalculator.connect(user).updateFeePercentages(1200, 600, 2500)
      ).to.be.reverted;
      
      await expect(
        feeCalculator.connect(user).updateFeeSplit(8000, 2000)
      ).to.be.reverted;
      
      await expect(
        feeCalculator.connect(user).updateFeeRecipients(adjuster.address, treasury.address)
      ).to.be.reverted;
    });
  });
});