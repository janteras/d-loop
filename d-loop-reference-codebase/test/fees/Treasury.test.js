const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let Treasury, MockToken;
  let treasury, mockToken;
  let owner, collector, manager, user;
  
  // Constants for testing
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const FEE_COLLECTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_COLLECTOR_ROLE"));
  const FUND_MANAGER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FUND_MANAGER_ROLE"));
  
  beforeEach(async function () {
    [owner, collector, manager, user] = await ethers.getSigners();
    
    // Deploy Treasury
    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    
    // Deploy mock ERC20 token for testing
    MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    
    // Mint tokens to collector
    await mockToken.mint(collector.address, ethers.utils.parseEther("1000"));
    
    // Grant roles
    await treasury.grantRole(FEE_COLLECTOR_ROLE, collector.address);
    await treasury.grantRole(FUND_MANAGER_ROLE, manager.address);
  });
  
  describe("Role Assignment", function () {
    it("should assign roles correctly", async function () {
      expect(await treasury.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await treasury.hasRole(FEE_COLLECTOR_ROLE, collector.address)).to.be.true;
      expect(await treasury.hasRole(FUND_MANAGER_ROLE, manager.address)).to.be.true;
    });
  });
  
  describe("Fee Collection", function () {
    it("should collect ETH fees correctly", async function () {
      const amount = ethers.utils.parseEther("1");
      
      await expect(
        treasury.connect(collector).collectFee(ethers.constants.AddressZero, amount, "TEST_ETH_FEE", {
          value: amount
        })
      )
        .to.emit(treasury, "FundsReceived")
        .withArgs(ethers.constants.AddressZero, amount, "TEST_ETH_FEE");
      
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(amount);
    });
    
    it("should collect ERC20 fees correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      
      // Approve treasury to spend tokens
      await mockToken.connect(collector).approve(treasury.address, amount);
      
      await expect(
        treasury.connect(collector).collectFee(mockToken.address, amount, "TEST_TOKEN_FEE")
      )
        .to.emit(treasury, "FundsReceived")
        .withArgs(mockToken.address, amount, "TEST_TOKEN_FEE");
      
      expect(await mockToken.balanceOf(treasury.address)).to.equal(amount);
    });
    
    it("should reject ETH fee collection with incorrect value", async function () {
      const amount = ethers.utils.parseEther("1");
      
      await expect(
        treasury.connect(collector).collectFee(ethers.constants.AddressZero, amount, "TEST_ETH_FEE", {
          value: ethers.utils.parseEther("0.5") // Incorrect value
        })
      ).to.be.revertedWith("InvalidAmount()");
    });
    
    it("should reject fee collection from unauthorized users", async function () {
      const amount = ethers.utils.parseEther("1");
      
      await expect(
        treasury.connect(user).collectFee(ethers.constants.AddressZero, amount, "TEST_ETH_FEE", {
          value: amount
        })
      ).to.be.reverted;
    });
  });
  
  describe("Fund Withdrawal", function () {
    beforeEach(async function () {
      // Add funds to treasury
      await treasury.connect(collector).collectFee(ethers.constants.AddressZero, ethers.utils.parseEther("10"), "SETUP", {
        value: ethers.utils.parseEther("10")
      });
      
      await mockToken.connect(collector).approve(treasury.address, ethers.utils.parseEther("500"));
      await treasury.connect(collector).collectFee(mockToken.address, ethers.utils.parseEther("500"), "SETUP");
    });
    
    it("should withdraw ETH correctly", async function () {
      const amount = ethers.utils.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      await expect(
        treasury.connect(manager).withdraw(ethers.constants.AddressZero, user.address, amount, "TEST_WITHDRAWAL")
      )
        .to.emit(treasury, "FundsWithdrawn")
        .withArgs(ethers.constants.AddressZero, user.address, amount, "TEST_WITHDRAWAL");
      
      const newBalance = await ethers.provider.getBalance(user.address);
      expect(newBalance.sub(initialBalance)).to.equal(amount);
      
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(ethers.utils.parseEther("9"));
    });
    
    it("should withdraw ERC20 tokens correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(
        treasury.connect(manager).withdraw(mockToken.address, user.address, amount, "TEST_TOKEN_WITHDRAWAL")
      )
        .to.emit(treasury, "FundsWithdrawn")
        .withArgs(mockToken.address, user.address, amount, "TEST_TOKEN_WITHDRAWAL");
      
      expect(await mockToken.balanceOf(user.address)).to.equal(amount);
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("400"));
    });
    
    it("should reject withdrawal to zero address", async function () {
      const amount = ethers.utils.parseEther("1");
      
      await expect(
        treasury.connect(manager).withdraw(ethers.constants.AddressZero, ethers.constants.AddressZero, amount, "TEST_WITHDRAWAL")
      ).to.be.revertedWith("ZeroAddress()");
    });
    
    it("should reject withdrawal from unauthorized users", async function () {
      const amount = ethers.utils.parseEther("1");
      
      await expect(
        treasury.connect(user).withdraw(ethers.constants.AddressZero, user.address, amount, "TEST_WITHDRAWAL")
      ).to.be.reverted;
    });
  });
  
  describe("Emergency Withdrawal", function () {
    beforeEach(async function () {
      // Add funds to treasury
      await treasury.connect(collector).collectFee(ethers.constants.AddressZero, ethers.utils.parseEther("10"), "SETUP", {
        value: ethers.utils.parseEther("10")
      });
      
      await mockToken.connect(collector).approve(treasury.address, ethers.utils.parseEther("500"));
      await treasury.connect(collector).collectFee(mockToken.address, ethers.utils.parseEther("500"), "SETUP");
    });
    
    it("should allow emergency ETH withdrawal by admin", async function () {
      const amount = ethers.utils.parseEther("10");
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      await expect(
        treasury.connect(owner).emergencyWithdraw(ethers.constants.AddressZero, user.address, amount)
      )
        .to.emit(treasury, "EmergencyWithdraw")
        .withArgs(ethers.constants.AddressZero, user.address, amount);
      
      const newBalance = await ethers.provider.getBalance(user.address);
      expect(newBalance.sub(initialBalance)).to.equal(amount);
      
      expect(await ethers.provider.getBalance(treasury.address)).to.equal(0);
    });
    
    it("should allow emergency token withdrawal by admin", async function () {
      const amount = ethers.utils.parseEther("500");
      
      await expect(
        treasury.connect(owner).emergencyWithdraw(mockToken.address, user.address, amount)
      )
        .to.emit(treasury, "EmergencyWithdraw")
        .withArgs(mockToken.address, user.address, amount);
      
      expect(await mockToken.balanceOf(user.address)).to.equal(amount);
      expect(await mockToken.balanceOf(treasury.address)).to.equal(0);
    });
    
    it("should reject emergency withdrawal from unauthorized users", async function () {
      const amount = ethers.utils.parseEther("10");
      
      await expect(
        treasury.connect(user).emergencyWithdraw(ethers.constants.AddressZero, user.address, amount)
      ).to.be.reverted;
    });
  });
  
  describe("Balance Queries", function () {
    beforeEach(async function () {
      // Add funds to treasury
      await treasury.connect(collector).collectFee(ethers.constants.AddressZero, ethers.utils.parseEther("5"), "SETUP", {
        value: ethers.utils.parseEther("5")
      });
      
      await mockToken.connect(collector).approve(treasury.address, ethers.utils.parseEther("200"));
      await treasury.connect(collector).collectFee(mockToken.address, ethers.utils.parseEther("200"), "SETUP");
    });
    
    it("should return correct ETH balance", async function () {
      expect(await treasury.getETHBalance()).to.equal(ethers.utils.parseEther("5"));
    });
    
    it("should return correct token balance", async function () {
      expect(await treasury.getTokenBalance(mockToken.address)).to.equal(ethers.utils.parseEther("200"));
    });
  });
});