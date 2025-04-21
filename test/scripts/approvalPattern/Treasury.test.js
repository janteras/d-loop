/**
 * @title Treasury Token Approval Pattern Tests
 * @dev Test suite for Treasury token approval pattern implementation
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');
const { expect } = require("chai");
const {
  computeRoleHash,
  toWei,
  fromWei,
  deployMockToken,
  getTokenAllowance,
  getTokenBalance,
  calculateGasUsed,
  calculateGasSavings,
  findEvent,
  getRoles
} = require('../../utils/BaseApprovalTest');

describe("Treasury Token Approval Pattern", function() {
  let owner, user1, user2, admin, protocolDAO;
  let treasury, mockToken, mockToken2, mockToken3;
  let ROLES;
  
  const STANDARD_APPROVAL_GAS = 46000; // Approximation of gas used by a standard ERC20 approval

  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, admin, protocolDAO] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock tokens for testing
    mockToken = await deployMockToken("Mock Token", "MOCK", 18, owner);
    mockToken2 = await deployMockToken("Mock Token 2", "MOCK2", 18, owner);
    mockToken3 = await deployMockToken("Mock Token 3", "MOCK3", 18, owner);
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, protocolDAO.address);
    
    // Send tokens to the Treasury for approvals
    await mockToken.transfer(treasury.address, toWei(10000));
    await mockToken2.transfer(treasury.address, toWei(10000));
    await mockToken3.transfer(treasury.address, toWei(10000));
  });
  
  describe("Token Approval Security", function() {
    it("should reject approval from unauthorized accounts", async function() {
      // User1 is not owner, should revert
      await expect(
        treasury.connect(user1).allowTokenTransfer(mockToken.address, user2.address, toWei(1000))
      ).to.be.revertedWithCustomError(treasury, "CallerNotOwner");
    });
    
    it("should reject approvals with zero address for token", async function() {
      await expect(
        treasury.allowTokenTransfer(ethers.ZeroAddress, user1.address, toWei(1000))
      ).to.be.revertedWithCustomError(treasury, "ZeroAddress");
    });
    
    it("should reject approvals with zero address for spender", async function() {
      await expect(
        treasury.allowTokenTransfer(mockToken.address, ethers.ZeroAddress, toWei(1000))
      ).to.be.revertedWithCustomError(treasury, "ZeroAddress");
    });
    
    it("should reject increaseTokenAllowance from unauthorized accounts", async function() {
      // User1 is not admin or owner, should revert
      await expect(
        treasury.connect(user1).increaseTokenAllowance(mockToken.address, user2.address, toWei(500))
      ).to.be.revertedWithCustomError(treasury, "CallerNotAdmin");
    });
    
    it("should reject decreaseTokenAllowance from unauthorized accounts", async function() {
      // User1 is not admin or owner, should revert
      await expect(
        treasury.connect(user1).decreaseTokenAllowance(mockToken.address, user2.address, toWei(500))
      ).to.be.revertedWithCustomError(treasury, "CallerNotAdmin");
    });
  });
  
  describe("Optimized Token Approval", function() {
    it("should set the initial token approval", async function() {
      const tx = await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify event was emitted
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.token).to.equal(mockToken.address);
      expect(event.args.spender).to.equal(user1.address);
      expect(event.args.amount).to.equal(toWei(1000));
      expect(event.args.gasSaved).to.be.lte(STANDARD_APPROVAL_GAS); // First approval won't save much gas
    });
    
    it("should optimize redundant token approvals", async function() {
      // First approval
      const tx1 = await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Redundant approval (same values)
      const tx2 = await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // Check approval is still set correctly
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify gas savings in redundant approval
      expect(gasUsed2).to.be.lt(gasUsed1);
      
      // Check gas savings reporting
      const event = findEvent(receipt2, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.gasSaved).to.be.gt(0);
    });
  });
  
  describe("Incremental and Decremental Allowance", function() {
    it("should allow increasing token allowance", async function() {
      // Set initial approval
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Increase allowance
      const tx = await treasury.connect(admin).increaseTokenAllowance(
        mockToken.address, 
        user1.address, 
        toWei(500)
      );
      const receipt = await tx.wait();
      
      // Check increased allowance
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1500)); // 1000 + 500
    });
    
    it("should allow decreasing token allowance", async function() {
      // Set initial approval
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Decrease allowance
      const tx = await treasury.connect(admin).decreaseTokenAllowance(
        mockToken.address, 
        user1.address, 
        toWei(300)
      );
      const receipt = await tx.wait();
      
      // Check decreased allowance
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(700)); // 1000 - 300
    });
    
    it("should revert when trying to decrease allowance below zero", async function() {
      // Set initial approval
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(100));
      
      // Try to decrease by more than current allowance
      await expect(
        treasury.connect(admin).decreaseTokenAllowance(
          mockToken.address, 
          user1.address, 
          toWei(200)
        )
      ).to.be.revertedWithCustomError(treasury, "InvalidAmount");
    });
    
    it("should handle zero value increments and decrements", async function() {
      // Set initial approval
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Increase by zero
      await treasury.connect(admin).increaseTokenAllowance(
        mockToken.address, 
        user1.address, 
        0
      );
      
      // Check unchanged allowance
      let allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Decrease by zero
      await treasury.connect(admin).decreaseTokenAllowance(
        mockToken.address, 
        user1.address, 
        0
      );
      
      // Check unchanged allowance
      allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
    });
  });
  
  describe("Batch Token Approval", function() {
    it("should support batch approvals for multiple tokens", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      // Execute batch approval
      const tx = await treasury.batchAllowTokenTransfers(tokens, user2.address, amounts);
      const receipt = await tx.wait();
      
      // Verify each approval
      const allowance1 = await getTokenAllowance(mockToken, treasury.address, user2.address);
      const allowance2 = await getTokenAllowance(mockToken2, treasury.address, user2.address);
      const allowance3 = await getTokenAllowance(mockToken3, treasury.address, user2.address);
      
      expect(allowance1).to.equal(toWei(100));
      expect(allowance2).to.equal(toWei(200));
      expect(allowance3).to.equal(toWei(300));
    });
    
    it("should reject batch approval with mismatched array lengths", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200)]; // One less than tokens
      
      await expect(
        treasury.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(treasury, "InvalidArrayLength");
    });
  });
  
  describe("Integration with Treasury Functionality", function() {
    it("should maintain withdraw functionality when protocol DAO calls", async function() {
      // Transfer some tokens to the treasury
      await mockToken.transfer(treasury.address, toWei(100));
      
      // Owner approves protocolDAO to withdraw
      await treasury.allowTokenTransfer(mockToken.address, protocolDAO.address, toWei(50));
      
      // ProtocolDAO calls withdraw
      const initialRecipientBalance = await getTokenBalance(mockToken, user2.address);
      const tx = await treasury.connect(protocolDAO).withdraw(
        mockToken.address, 
        user2.address, 
        toWei(50)
      );
      const receipt = await tx.wait();
      
      // Check recipient received tokens
      const finalRecipientBalance = await getTokenBalance(mockToken, user2.address);
      expect(finalRecipientBalance.sub(initialRecipientBalance)).to.equal(toWei(50));
      
      // Verify event
      const event = findEvent(receipt, "FundsWithdrawn");
      expect(event).to.not.be.null;
      expect(event.args.token).to.equal(mockToken.address);
      expect(event.args.recipient).to.equal(user2.address);
      expect(event.args.amount).to.equal(toWei(50));
    });
  });
  
  describe("Edge Cases", function() {
    it("should handle approvals with very large values", async function() {
      const largeAmount = ethers.MaxUint256;
      const tx = await treasury.allowTokenTransfer(mockToken.address, user1.address, largeAmount);
      const receipt = await tx.wait();
      
      // Check approval was set to max value
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(largeAmount);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(largeAmount);
    });
    
    it("should handle the admin changing approval set by owner", async function() {
      // Owner sets initial approval
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Admin increases allowance
      await treasury.connect(admin).increaseTokenAllowance(
        mockToken.address, 
        user1.address, 
        toWei(500)
      );
      
      // Check updated allowance
      const allowance = await getTokenAllowance(mockToken, treasury.address, user1.address);
      expect(allowance).to.equal(toWei(1500));
    });
  });
});