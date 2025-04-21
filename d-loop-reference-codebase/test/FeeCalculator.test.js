const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FeeCalculator", function () {
  let feeCalculator;
  let owner, user1, user2;
  
  const INVEST_FEE_PERCENTAGE = 100; // 1%
  const DIVEST_FEE_PERCENTAGE = 50; // 0.5%
  const RAGEQUIT_FEE_PERCENTAGE = 200; // 2%
  
  const PROTOCOL_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROTOCOL_DAO_ROLE"));
  const FEE_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_ADMIN_ROLE"));
  
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      INVEST_FEE_PERCENTAGE,
      DIVEST_FEE_PERCENTAGE,
      RAGEQUIT_FEE_PERCENTAGE
    );
    
    await feeCalculator.deployed();
  });
  
  describe("Deployment", function () {
    it("Should set the right fee percentages", async function () {
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE_PERCENTAGE);
      expect(await feeCalculator.divestFeePercentage()).to.equal(DIVEST_FEE_PERCENTAGE);
      expect(await feeCalculator.ragequitFeePercentage()).to.equal(RAGEQUIT_FEE_PERCENTAGE);
    });
    
    it("Should assign the default admin role to the deployer", async function () {
      expect(await feeCalculator.hasRole(ethers.constants.HashZero, owner.address)).to.equal(true);
    });
    
    it("Should assign the fee admin role to the deployer", async function () {
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, owner.address)).to.equal(true);
    });
  });
  
  describe("Fee Calculation", function () {
    it("Should correctly calculate invest fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = amount.mul(INVEST_FEE_PERCENTAGE).div(10000);
      
      expect(await feeCalculator.calculateInvestFee(amount)).to.equal(expectedFee);
    });
    
    it("Should correctly calculate divest fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = amount.mul(DIVEST_FEE_PERCENTAGE).div(10000);
      
      expect(await feeCalculator.calculateDivestFee(amount)).to.equal(expectedFee);
    });
    
    it("Should correctly calculate ragequit fee", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = amount.mul(RAGEQUIT_FEE_PERCENTAGE).div(10000);
      
      expect(await feeCalculator.calculateRagequitFee(amount)).to.equal(expectedFee);
    });
  });
  
  describe("Fee Updates", function () {
    beforeEach(async function () {
      await feeCalculator.addProtocolDAORole(user1.address);
    });
    
    it("Should allow ProtocolDAO to update invest fee", async function () {
      const newFeePercentage = 150;
      
      await expect(feeCalculator.connect(user1).updateInvestFeePercentage(newFeePercentage))
        .to.emit(feeCalculator, "InvestFeeUpdated")
        .withArgs(INVEST_FEE_PERCENTAGE, newFeePercentage);
      
      expect(await feeCalculator.investFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("Should allow ProtocolDAO to update divest fee", async function () {
      const newFeePercentage = 75;
      
      await expect(feeCalculator.connect(user1).updateDivestFeePercentage(newFeePercentage))
        .to.emit(feeCalculator, "DivestFeeUpdated")
        .withArgs(DIVEST_FEE_PERCENTAGE, newFeePercentage);
      
      expect(await feeCalculator.divestFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("Should allow ProtocolDAO to update ragequit fee", async function () {
      const newFeePercentage = 250;
      
      await expect(feeCalculator.connect(user1).updateRagequitFeePercentage(newFeePercentage))
        .to.emit(feeCalculator, "RagequitFeeUpdated")
        .withArgs(RAGEQUIT_FEE_PERCENTAGE, newFeePercentage);
      
      expect(await feeCalculator.ragequitFeePercentage()).to.equal(newFeePercentage);
    });
    
    it("Should not allow non-ProtocolDAO to update fees", async function () {
      await expect(feeCalculator.connect(user2).updateInvestFeePercentage(150))
        .to.be.reverted;
      
      await expect(feeCalculator.connect(user2).updateDivestFeePercentage(75))
        .to.be.reverted;
      
      await expect(feeCalculator.connect(user2).updateRagequitFeePercentage(250))
        .to.be.reverted;
    });
    
    it("Should not allow fee percentages above the maximum", async function () {
      const maxFeePercentage = await feeCalculator.MAX_FEE_PERCENTAGE();
      const tooHighPercentage = maxFeePercentage.add(1);
      
      await expect(feeCalculator.connect(user1).updateInvestFeePercentage(tooHighPercentage))
        .to.be.revertedWith("Invest fee percentage exceeds maximum");
      
      await expect(feeCalculator.connect(user1).updateDivestFeePercentage(tooHighPercentage))
        .to.be.revertedWith("Divest fee percentage exceeds maximum");
      
      await expect(feeCalculator.connect(user1).updateRagequitFeePercentage(tooHighPercentage))
        .to.be.revertedWith("Ragequit fee percentage exceeds maximum");
    });
  });
  
  describe("Role Management", function () {
    it("Should allow admin to add ProtocolDAO role", async function () {
      await feeCalculator.addProtocolDAORole(user1.address);
      expect(await feeCalculator.hasRole(PROTOCOL_DAO_ROLE, user1.address)).to.equal(true);
    });
    
    it("Should allow admin to remove ProtocolDAO role", async function () {
      await feeCalculator.addProtocolDAORole(user1.address);
      await feeCalculator.removeProtocolDAORole(user1.address);
      expect(await feeCalculator.hasRole(PROTOCOL_DAO_ROLE, user1.address)).to.equal(false);
    });
    
    it("Should allow admin to add FeeAdmin role", async function () {
      await feeCalculator.addFeeAdminRole(user2.address);
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, user2.address)).to.equal(true);
    });
    
    it("Should allow admin to remove FeeAdmin role", async function () {
      await feeCalculator.addFeeAdminRole(user2.address);
      await feeCalculator.removeFeeAdminRole(user2.address);
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, user2.address)).to.equal(false);
    });
    
    it("Should not allow non-admin to manage roles", async function () {
      await expect(feeCalculator.connect(user1).addProtocolDAORole(user2.address))
        .to.be.reverted;
      
      await expect(feeCalculator.connect(user1).removeProtocolDAORole(owner.address))
        .to.be.reverted;
      
      await expect(feeCalculator.connect(user1).addFeeAdminRole(user2.address))
        .to.be.reverted;
      
      await expect(feeCalculator.connect(user1).removeFeeAdminRole(owner.address))
        .to.be.reverted;
    });
  });
});