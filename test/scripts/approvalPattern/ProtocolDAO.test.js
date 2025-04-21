/**
 * @title ProtocolDAO Token Approval Pattern Tests
 * @dev Test suite for ProtocolDAO token approval pattern implementation
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

describe("ProtocolDAO Token Approval Pattern", function() {
  let owner, user1, user2, treasury, governor, feeManager;
  let protocolDAO, mockToken, mockToken2, mockToken3;
  let feeProcessor;
  let ROLES;
  
  const STANDARD_APPROVAL_GAS = 46000; // Approximation of gas used by a standard ERC20 approval

  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, treasury, governor, feeManager] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock tokens for testing
    mockToken = await deployMockToken("Mock Token", "MOCK", 18, owner);
    mockToken2 = await deployMockToken("Mock Token 2", "MOCK2", 18, owner);
    mockToken3 = await deployMockToken("Mock Token 3", "MOCK3", 18, owner);
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(governor.address);
    
    // Deploy FeeProcessor (needed for integration tests)
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.address,
      treasury.address, // Using treasury as reward distributor for simplicity
      treasury.address, // Using treasury as fee calculator for simplicity
      feeManager.address,
      7000, // 70% treasury
      3000  // 30% reward distributor
    );
    
    // Register FeeProcessor with ProtocolDAO
    await protocolDAO.setFeeProcessor(feeProcessor.address);
    
    // Grant governance role to owner for testing
    await protocolDAO.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    // Send tokens to the ProtocolDAO for approvals
    await mockToken.transfer(protocolDAO.address, toWei(10000));
    await mockToken2.transfer(protocolDAO.address, toWei(10000));
    await mockToken3.transfer(protocolDAO.address, toWei(10000));
  });
  
  describe("Token Approval Security", function() {
    it("should reject approval from unauthorized accounts", async function() {
      // User1 is not admin, should revert
      await expect(
        protocolDAO.connect(user1).allowTokenTransfer(mockToken.address, user2.address, toWei(1000))
      ).to.be.revertedWithCustomError(protocolDAO, "Unauthorized");
    });
    
    it("should reject approvals with zero address for token", async function() {
      await expect(
        protocolDAO.allowTokenTransfer(ethers.ZeroAddress, user1.address, toWei(1000))
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
    
    it("should reject approvals with zero address for spender", async function() {
      await expect(
        protocolDAO.allowTokenTransfer(mockToken.address, ethers.ZeroAddress, toWei(1000))
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
  });
  
  describe("Optimized Token Approval", function() {
    it("should set the initial token approval", async function() {
      const tx = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user1.address);
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
      const tx1 = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Redundant approval (same values)
      const tx2 = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // Check approval is still set correctly
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user1.address);
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
      await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // Change approval amount
      const tx = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, toWei(2000));
      const receipt = await tx.wait();
      
      // Check approval was updated
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user1.address);
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
      const tx = await protocolDAO.batchAllowTokenTransfers(tokens, user2.address, amounts);
      const receipt = await tx.wait();
      
      // Verify each approval
      const allowance1 = await getTokenAllowance(mockToken, protocolDAO.address, user2.address);
      const allowance2 = await getTokenAllowance(mockToken2, protocolDAO.address, user2.address);
      const allowance3 = await getTokenAllowance(mockToken3, protocolDAO.address, user2.address);
      
      expect(allowance1).to.equal(toWei(100));
      expect(allowance2).to.equal(toWei(200));
      expect(allowance3).to.equal(toWei(300));
    });
    
    it("should reject batch approval with mismatched array lengths", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200)]; // One less than tokens
      
      await expect(
        protocolDAO.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidArrayLength");
    });
    
    it("should reject batch approval with zero address tokens", async function() {
      const tokens = [mockToken.address, ethers.ZeroAddress, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      await expect(
        protocolDAO.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
    
    it("should reject batch approval with zero address spender", async function() {
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      await expect(
        protocolDAO.batchAllowTokenTransfers(tokens, ethers.ZeroAddress, amounts)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
  });

  describe("Integration with Governance", function() {
    it("should allow governor to approve token transfers via proposal", async function() {
      // Simulate a governance proposal that approves tokens
      const proposalId = 1;
      
      // Register a mock proposal (simplified for testing)
      await protocolDAO.connect(governor).registerProposal(
        proposalId,
        "Token approval proposal",
        "Approve tokens for integration"
      );
      
      // Execute governance proposal (simplified)
      const tx = await protocolDAO.connect(governor).executeTokenApproval(
        proposalId,
        mockToken.address,
        treasury.address,
        toWei(5000)
      );
      
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, treasury.address);
      expect(allowance).to.equal(toWei(5000));
      
      // Verify governance events
      const approvalEvent = findEvent(receipt, "GovernanceTokenApproval");
      expect(approvalEvent).to.not.be.null;
      expect(approvalEvent.args.proposalId).to.equal(proposalId);
      expect(approvalEvent.args.token).to.equal(mockToken.address);
    });
    
    it("should reject governance approval from non-governor", async function() {
      // Attempt to execute governance approval as non-governor
      await expect(
        protocolDAO.connect(user1).executeTokenApproval(
          1, // Some proposal ID
          mockToken.address,
          treasury.address,
          toWei(1000)
        )
      ).to.be.revertedWithCustomError(protocolDAO, "Unauthorized");
    });
  });
  
  describe("Protocol Parameter Management", function() {
    it("should allow token approval during fee parameter updates", async function() {
      // Update fee parameter which requires token approval
      const tx = await protocolDAO.updateFeeDistribution(
        mockToken.address,
        feeProcessor.address,
        toWei(1000),
        "Update fee distribution with token approval"
      );
      
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, feeProcessor.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify parameter update event
      const paramEvent = findEvent(receipt, "ParameterUpdated");
      expect(paramEvent).to.not.be.null;
      expect(paramEvent.args.parameterType).to.equal("FeeDistribution");
    });
  });
  
  describe("Role-Based Access Control for Approvals", function() {
    it("should allow admin to approve token transfers", async function() {
      // Grant admin role to user1
      await protocolDAO.grantRole(ROLES.ADMIN_ROLE, user1.address);
      
      // user1 should now be able to approve token transfers
      const tx = await protocolDAO.connect(user1).allowTokenTransfer(mockToken.address, user2.address, toWei(500));
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user2.address);
      expect(allowance).to.equal(toWei(500));
    });
    
    it("should reject approvals from users without admin role", async function() {
      // No role granted to user2, should fail
      await expect(
        protocolDAO.connect(user2).allowTokenTransfer(mockToken.address, user1.address, toWei(100))
      ).to.be.revertedWithCustomError(protocolDAO, "Unauthorized");
    });
  });
  
  describe("Edge Cases", function() {
    it("should handle zero value approvals", async function() {
      const tx = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, 0);
      const receipt = await tx.wait();
      
      // Check approval was set to zero
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user1.address);
      expect(allowance).to.equal(0);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(0);
    });
    
    it("should handle approvals with very large values", async function() {
      const largeAmount = ethers.MaxUint256;
      const tx = await protocolDAO.allowTokenTransfer(mockToken.address, user1.address, largeAmount);
      const receipt = await tx.wait();
      
      // Check approval was set to max value
      const allowance = await getTokenAllowance(mockToken, protocolDAO.address, user1.address);
      expect(allowance).to.equal(largeAmount);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(largeAmount);
    });
    
    it("should protect against cross-contract reentrancy", async function() {
      // Deploy a malicious token that tries to reenter on transfer
      const MockAttackerFactory = await ethers.getContractFactory("MockReentrancyAttacker");
      const attackerToken = await MockAttackerFactory.deploy("Attacker", "ATK", protocolDAO.address);
      
      // Send tokens to the ProtocolDAO
      await attackerToken.transfer(protocolDAO.address, toWei(1000));
      
      // Try to exploit via approval
      await expect(
        protocolDAO.allowTokenTransfer(attackerToken.address, attackerToken.address, toWei(100))
      ).to.be.revertedWithCustomError(protocolDAO, "ReentrancyGuardReentrantCall");
    });
  });
});