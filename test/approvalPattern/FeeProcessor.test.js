/**
 * @title FeeProcessor Token Approval Pattern Tests
 * @dev Test suite for FeeProcessor token approval pattern implementation
 */
const { ethers } = require("hardhat");
require('../utils/ethers-v6-compat');
const { expect } = require("chai");
const {
  computeRoleHash,
  toWei,
  fromWei,
  deployMockToken,
  deployMockFeeCalculator,
  getTokenAllowance,
  getTokenBalance,
  calculateGasUsed,
  calculateGasSavings,
  findEvent,
  getRoles
} = require('../utils/BaseApprovalTest');

describe("FeeProcessor Token Approval Pattern", function() {
  let owner, user1, user2, treasury, rewardDistributor, feeAdmin;
  let feeProcessor, mockToken, mockToken2, mockToken3;
  let mockFeeCalculator;
  let ROLES;
  
  const STANDARD_APPROVAL_GAS = 46000; // Approximation of gas used by a standard ERC20 approval

  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, treasury, rewardDistributor, feeAdmin] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock tokens for testing
    mockToken = await deployMockToken("Mock Token", "MOCK", 18, owner);
    mockToken2 = await deployMockToken("Mock Token 2", "MOCK2", 18, owner);
    mockToken3 = await deployMockToken("Mock Token 3", "MOCK3", 18, owner);
    
    // Deploy mock fee calculator
    mockFeeCalculator = await deployMockFeeCalculator(owner);
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.address,
      rewardDistributor.address,
      mockFeeCalculator.address,
      feeAdmin.address,
      7000, // 70% treasury
      3000  // 30% reward distributor
    );
    
    // Grant AUTHORIZED_CONTRACT_ROLE to owner for testing
    await feeProcessor.grantRole(ROLES.AUTHORIZED_CONTRACT_ROLE, owner.address);
    
    // Send tokens to the FeeProcessor for approvals
    await mockToken.transfer(feeProcessor.address, toWei(10000));
    await mockToken2.transfer(feeProcessor.address, toWei(10000));
    await mockToken3.transfer(feeProcessor.address, toWei(10000));
  });
  
  describe("Token Approval Security", function() {
    it("should reject approval from unauthorized accounts", async function() {
      // User1 is not owner, should revert
      await expect(
        feeProcessor.connect(user1).allowTokenTransfer(mockToken.address, user2.address, toWei(1000))
      ).to.be.revertedWithCustomError(feeProcessor, "CallerNotOwner");
    });
    
    it("should reject approvals with zero address for token", async function() {
      await expect(
        feeProcessor.allowTokenTransfer(ethers.ZeroAddress, user1.address, toWei(1000))
      ).to.be.revertedWithCustomError(feeProcessor, "ZeroAddress");
    });
    
    it("should reject approvals with zero address for spender", async function() {
      await expect(
        feeProcessor.allowTokenTransfer(mockToken.address, ethers.ZeroAddress, toWei(1000))
      ).to.be.revertedWithCustomError(feeProcessor, "ZeroAddress");
    });
  });
  
  describe("Optimized Token Approval", function() {
    it("should set the initial token approval", async function() {
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, feeProcessor.address, user1.address);
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
      const tx1 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Redundant approval (same values)
      const tx2 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // Check approval is still set correctly
      const allowance = await getTokenAllowance(mockToken, feeProcessor.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify gas savings in redundant approval
      expect(gasUsed2).to.be.lt(gasUsed1);
      
      // Check gas savings reporting
      const event = findEvent(receipt2, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.gasSaved).to.be.gt(0);
    });
    
    it("should update approval when amount changes", async function() {
      // First approval
      await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Change approval amount
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(2000));
      const receipt = await tx.wait();
      
      // Check approval was updated
      const allowance = await getTokenAllowance(mockToken, feeProcessor.address, user1.address);
      expect(allowance).to.equal(toWei(2000));
      
      // Verify event reflects new amount
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(toWei(2000));
    });
  });
  
  describe("Batch Token Approval", function() {
    it("should support batch approvals for multiple tokens", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      // Execute batch approval
      const tx = await feeProcessor.batchAllowTokenTransfers(tokens, user2.address, amounts);
      const receipt = await tx.wait();
      
      // Verify each approval
      const allowance1 = await getTokenAllowance(mockToken, feeProcessor.address, user2.address);
      const allowance2 = await getTokenAllowance(mockToken2, feeProcessor.address, user2.address);
      const allowance3 = await getTokenAllowance(mockToken3, feeProcessor.address, user2.address);
      
      expect(allowance1).to.equal(toWei(100));
      expect(allowance2).to.equal(toWei(200));
      expect(allowance3).to.equal(toWei(300));
    });
    
    it("should reject batch approval with mismatched array lengths", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200)]; // One less than tokens
      
      await expect(
        feeProcessor.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(feeProcessor, "InvalidArrayLength");
    });
    
    it("should reject batch approval with zero address tokens", async function() {
      const tokens = [mockToken.address, ethers.ZeroAddress, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      await expect(
        feeProcessor.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(feeProcessor, "ZeroAddress");
    });
    
    it("should reject batch approval with zero address spender", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      await expect(
        feeProcessor.batchAllowTokenTransfers(tokens, ethers.ZeroAddress, amounts)
      ).to.be.revertedWithCustomError(feeProcessor, "ZeroAddress");
    });
  });
  
  describe("Integration with Fee Functionality", function() {
    it("should maintain fee collection functionality", async function() {
      // First approve token for transfer from owner to fee processor
      await mockToken.approve(feeProcessor.address, toWei(1000));
      
      // Collect investment fee (owner is authorized)
      const tx = await feeProcessor.collectInvestFee(mockToken.address, toWei(100));
      const receipt = await tx.wait();
      
      // Calculate expected fee amounts
      const totalFeeAmount = toWei(100) / BigInt(10); // 10% investment fee
      const treasuryFeeAmount = (totalFeeAmount * BigInt(7000)) / BigInt(10000); // 70% to treasury
      const rewardFeeAmount = (totalFeeAmount * BigInt(3000)) / BigInt(10000); // 30% to reward distributor
      
      // Check treasury received its share
      const treasuryBalance = await getTokenBalance(mockToken, treasury.address);
      expect(treasuryBalance).to.be.gte(treasuryFeeAmount);
      
      // Check reward distributor received its share
      const rewardDistributorBalance = await getTokenBalance(mockToken, rewardDistributor.address);
      expect(rewardDistributorBalance).to.be.gte(rewardFeeAmount);
      
      // Verify event
      const event = findEvent(receipt, "FeeCollected");
      expect(event).to.not.be.null;
      expect(event.args.feeType).to.equal("Invest");
      expect(event.args.token).to.equal(mockToken.address);
    });
  });

  describe("Edge Cases", function() {
    it("should handle zero value approvals", async function() {
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, 0);
      const receipt = await tx.wait();
      
      // Check approval was set to zero
      const allowance = await getTokenAllowance(mockToken, feeProcessor.address, user1.address);
      expect(allowance).to.equal(0);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(0);
    });
    
    it("should handle approvals with very large values", async function() {
      const largeAmount = ethers.MaxUint256;
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, largeAmount);
      const receipt = await tx.wait();
      
      // Check approval was set to max value
      const allowance = await getTokenAllowance(mockToken, feeProcessor.address, user1.address);
      expect(allowance).to.equal(largeAmount);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(largeAmount);
    });
  });
});