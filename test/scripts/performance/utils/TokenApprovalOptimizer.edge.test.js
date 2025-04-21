/**
 * @title TokenApprovalOptimizer Edge Case Tests
 * @dev Tests edge cases and critical functions for the TokenApprovalOptimizer contract
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("TokenApprovalOptimizer Edge Cases", function() {
  let tokenOptimizer;
  let mockToken;
  let owner;
  let user1;
  let user2;
  let zeroAddress = ethers.ZeroAddress;
  
  const APPROVAL_AMOUNT = ethers.parseUnits("1000", 18);
  const MAX_APPROVAL = ethers.MaxUint256;
  
  beforeEach(async function() {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    
    // Deploy token optimizer with 20% threshold
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenOptimizer = await TokenApprovalOptimizer.deploy(20);
    
    // Mint tokens to users for testing
    await mockToken.mint(owner.address, APPROVAL_AMOUNT * BigInt(10));
    await mockToken.mint(user1.address, APPROVAL_AMOUNT * BigInt(10));
    await mockToken.mint(user2.address, APPROVAL_AMOUNT * BigInt(10));
    
    // Mint tokens to the optimizer for transfer tests
    await mockToken.mint(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT * BigInt(5));
  });
  
  describe("Constructor", function() {
    it("should set default threshold when 0 is provided", async function() {
      const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
      const optimizer = await TokenApprovalOptimizer.deploy(0);
      
      expect(await optimizer.approvalThreshold()).to.equal(20);
    });
    
    it("should reject threshold greater than 100", async function() {
      const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
      await expect(TokenApprovalOptimizer.deploy(101)).to.be.revertedWith("Invalid threshold value");
    });
  });
  
  describe("setApprovalThreshold", function() {
    it("should update threshold when called by owner", async function() {
      await tokenOptimizer.setApprovalThreshold(50);
      expect(await tokenOptimizer.approvalThreshold()).to.equal(50);
    });
    
    it("should emit ThresholdUpdated event", async function() {
      await expect(tokenOptimizer.setApprovalThreshold(50))
        .to.emit(tokenOptimizer, "ThresholdUpdated")
        .withArgs(50);
    });
    
    it("should reject threshold of 0", async function() {
      await expect(tokenOptimizer.setApprovalThreshold(0))
        .to.be.revertedWith("Invalid threshold value");
    });
    
    it("should reject threshold greater than 100", async function() {
      await expect(tokenOptimizer.setApprovalThreshold(101))
        .to.be.revertedWith("Invalid threshold value");
    });
    
    it("should reject when called by non-owner", async function() {
      await expect(tokenOptimizer.connect(user1).setApprovalThreshold(50))
        .to.be.revertedWithCustomError(tokenOptimizer, "OwnableUnauthorizedAccount");
    });
  });
  
  describe("optimizeApproval", function() {
    it("should reject zero token address", async function() {
      await expect(tokenOptimizer.connect(user1).optimizeApproval(
        zeroAddress,
        user1.address,
        user2.address,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid token address");
    });
    
    it("should reject zero owner address", async function() {
      await expect(tokenOptimizer.connect(user1).optimizeApproval(
        await mockToken.getAddress(),
        zeroAddress,
        user2.address,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid owner address");
    });
    
    it("should reject zero spender address", async function() {
      await expect(tokenOptimizer.connect(user1).optimizeApproval(
        await mockToken.getAddress(),
        user1.address,
        zeroAddress,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid spender address");
    });
    
    it("should not emit event when current allowance is above threshold", async function() {
      // Set up test with contract as owner
      const optimizerAddress = await tokenOptimizer.getAddress();
      
      // Mint tokens to the optimizer
      await mockToken.mint(optimizerAddress, APPROVAL_AMOUNT * BigInt(10));
      
      // Set a high allowance from optimizer to user2 (above threshold)
      await tokenOptimizer.approve(
        await mockToken.getAddress(),
        user2.address,
        APPROVAL_AMOUNT * BigInt(5)
      );
      
      // The optimizeApproval should not emit an event since allowance is above threshold
      await expect(tokenOptimizer.optimizeApproval(
        await mockToken.getAddress(),
        optimizerAddress,
        user2.address,
        APPROVAL_AMOUNT
      )).to.not.emit(tokenOptimizer, "ApprovalOptimized");
      
      // Verify allowance hasn't changed
      const allowance = await mockToken.allowance(optimizerAddress, user2.address);
      expect(allowance).to.equal(APPROVAL_AMOUNT * BigInt(5));
    });
    
    it("should emit event and optimize approval when current allowance is below threshold", async function() {
      // Set up test with contract as owner
      const optimizerAddress = await tokenOptimizer.getAddress();
      
      // Mint tokens to the optimizer
      await mockToken.mint(optimizerAddress, APPROVAL_AMOUNT * BigInt(10));
      
      // Set a small allowance (below threshold)
      const smallAllowance = APPROVAL_AMOUNT / BigInt(10); // 10% of approval amount
      await tokenOptimizer.approve(
        await mockToken.getAddress(),
        user2.address,
        smallAllowance
      );
      
      // Calculate the threshold amount (20% of APPROVAL_AMOUNT)
      const thresholdAmount = (APPROVAL_AMOUNT * BigInt(20)) / BigInt(100);
      
      // Verify our test setup is correct (allowance < threshold)
      const initialAllowance = await mockToken.allowance(optimizerAddress, user2.address);
      expect(initialAllowance).to.be.lt(thresholdAmount);
      
      // The optimizeApproval should emit an event since allowance is below threshold
      await expect(tokenOptimizer.optimizeApproval(
        await mockToken.getAddress(),
        optimizerAddress,
        user2.address,
        APPROVAL_AMOUNT
      )).to.emit(tokenOptimizer, "ApprovalOptimized");
      
      // Check that allowance is now MAX_APPROVAL
      const newAllowance = await mockToken.allowance(optimizerAddress, user2.address);
      expect(newAllowance).to.equal(MAX_APPROVAL);
    });
  });
  
  describe("approve", function() {
    it("should allow owner to approve tokens", async function() {
      await tokenOptimizer.approve(
        await mockToken.getAddress(),
        user1.address,
        APPROVAL_AMOUNT
      );
      
      const allowance = await mockToken.allowance(
        await tokenOptimizer.getAddress(),
        user1.address
      );
      
      expect(allowance).to.equal(APPROVAL_AMOUNT);
    });
    
    it("should reject when called by non-owner", async function() {
      await expect(tokenOptimizer.connect(user1).approve(
        await mockToken.getAddress(),
        user2.address,
        APPROVAL_AMOUNT
      )).to.be.revertedWithCustomError(tokenOptimizer, "OwnableUnauthorizedAccount");
    });
    
    it("should reject zero token address", async function() {
      await expect(tokenOptimizer.approve(
        zeroAddress,
        user1.address,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid token address");
    });
    
    it("should reject zero spender address", async function() {
      await expect(tokenOptimizer.approve(
        await mockToken.getAddress(),
        zeroAddress,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid spender address");
    });
  });
  
  describe("transferTokens", function() {
    it("should transfer tokens from contract to recipient", async function() {
      const recipientBalanceBefore = await mockToken.balanceOf(user2.address);
      const transferAmount = APPROVAL_AMOUNT / BigInt(2);
      
      await tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        user2.address,
        transferAmount
      );
      
      const recipientBalanceAfter = await mockToken.balanceOf(user2.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(transferAmount);
    });
    
    it("should emit TokenTransferred event", async function() {
      const transferAmount = APPROVAL_AMOUNT / BigInt(2);
      
      await expect(tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        user2.address,
        transferAmount
      )).to.emit(tokenOptimizer, "TokenTransferred")
        .withArgs(await mockToken.getAddress(), user2.address, transferAmount);
    });
    
    it("should reject zero token address", async function() {
      await expect(tokenOptimizer.connect(user1).transferTokens(
        zeroAddress,
        user2.address,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid token address");
    });
    
    it("should reject zero recipient address", async function() {
      await expect(tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        zeroAddress,
        APPROVAL_AMOUNT
      )).to.be.revertedWith("Invalid recipient address");
    });
    
    it("should reject zero amount", async function() {
      await expect(tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        user2.address,
        0
      )).to.be.revertedWith("Invalid transfer amount");
    });
    
    it("should reject when contract has insufficient balance", async function() {
      const largeAmount = APPROVAL_AMOUNT * BigInt(10);
      
      await expect(tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        user2.address,
        largeAmount
      )).to.be.revertedWith("Insufficient balance for transfer");
    });
  });
});
