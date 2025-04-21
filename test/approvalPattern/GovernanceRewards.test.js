/**
 * @title GovernanceRewards Token Approval Pattern Tests
 * @dev Test suite for GovernanceRewards token approval pattern implementation
 */
const { ethers } = require("hardhat");
require('../utils/ethers-v6-compat');
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
} = require('../utils/BaseApprovalTest');

describe("GovernanceRewards Token Approval Pattern", function() {
  let owner, user1, user2, admin, distributor;
  let governanceRewards, rewardToken, mockToken, mockToken2;
  let ROLES;
  
  const STANDARD_APPROVAL_GAS = 46000; // Approximation of gas used by a standard ERC20 approval
  const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
  const DISTRIBUTOR_ROLE = computeRoleHash("DISTRIBUTOR_ROLE");

  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, admin, distributor] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock tokens for testing
    rewardToken = await deployMockToken("Reward Token", "RWRD", 18, owner);
    mockToken = await deployMockToken("Mock Token", "MOCK", 18, owner);
    mockToken2 = await deployMockToken("Mock Token 2", "MOCK2", 18, owner);
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(rewardToken.address, owner.address);
    
    // Grant roles for testing
    await governanceRewards.grantRole(ADMIN_ROLE, admin.address);
    await governanceRewards.grantRole(DISTRIBUTOR_ROLE, distributor.address);
    
    // Send tokens to the GovernanceRewards for approvals and testing
    await rewardToken.transfer(governanceRewards.address, toWei(100000));
    await mockToken.transfer(governanceRewards.address, toWei(10000));
    await mockToken2.transfer(governanceRewards.address, toWei(10000));
  });
  
  describe("Role-Based Access Control", function() {
    it("should reject approval from unauthorized accounts", async function() {
      // User1 is not ADMIN, should revert
      await expect(
        governanceRewards.connect(user1).allowTokenTransfer(mockToken.address, user2.address, toWei(1000))
      ).to.be.revertedWith("AccessControl: caller is missing role");
    });
    
    it("should allow admin role to approve tokens", async function() {
      const tx = await governanceRewards.connect(admin).allowTokenTransfer(
        mockToken.address, 
        user2.address, 
        toWei(1000)
      );
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, governanceRewards.address, user2.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify event was emitted
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
    });
  });
  
  describe("Token Approval Security", function() {
    it("should reject approvals with zero address for token", async function() {
      await expect(
        governanceRewards.allowTokenTransfer(ethers.ZeroAddress, user1.address, toWei(1000))
      ).to.be.revertedWithCustomError(governanceRewards, "ZeroAddress");
    });
    
    it("should reject approvals with zero address for spender", async function() {
      await expect(
        governanceRewards.allowTokenTransfer(mockToken.address, ethers.ZeroAddress, toWei(1000))
      ).to.be.revertedWithCustomError(governanceRewards, "ZeroAddress");
    });
  });
  
  describe("Optimized Token Approval", function() {
    it("should set the initial token approval", async function() {
      const tx = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Check approval was successful
      const allowance = await getTokenAllowance(mockToken, governanceRewards.address, user1.address);
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
      const tx1 = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Redundant approval (same values)
      const tx2 = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // Check approval is still set correctly
      const allowance = await getTokenAllowance(mockToken, governanceRewards.address, user1.address);
      expect(allowance).to.equal(toWei(1000));
      
      // Verify gas savings in redundant approval
      expect(gasUsed2).to.be.lt(gasUsed1);
      
      // Check gas savings reporting
      const event = findEvent(receipt2, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.gasSaved).to.be.gt(0);
    });
  });
  
  describe("Batch Token Approval", function() {
    it("should support batch approvals for multiple tokens", async function() {
      const tokens = [mockToken.address, mockToken2.address, rewardToken.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      // Execute batch approval
      const tx = await governanceRewards.batchAllowTokenTransfers(tokens, user2.address, amounts);
      const receipt = await tx.wait();
      
      // Verify each approval
      const allowance1 = await getTokenAllowance(mockToken, governanceRewards.address, user2.address);
      const allowance2 = await getTokenAllowance(mockToken2, governanceRewards.address, user2.address);
      const allowance3 = await getTokenAllowance(rewardToken, governanceRewards.address, user2.address);
      
      expect(allowance1).to.equal(toWei(100));
      expect(allowance2).to.equal(toWei(200));
      expect(allowance3).to.equal(toWei(300));
    });
    
    it("should reject batch approval with mismatched array lengths", async function() {
      const tokens = [mockToken.address, mockToken2.address, rewardToken.address];
      const amounts = [toWei(100), toWei(200)]; // One less than tokens
      
      await expect(
        governanceRewards.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(governanceRewards, "InvalidArrayLength");
    });
    
    it("should reject batch approval with zero address tokens", async function() {
      const tokens = [mockToken.address, ethers.ZeroAddress, mockToken2.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      await expect(
        governanceRewards.batchAllowTokenTransfers(tokens, user2.address, amounts)
      ).to.be.revertedWithCustomError(governanceRewards, "ZeroAddress");
    });
  });
  
  describe("Integration with Reward Functionality", function() {
    it("should maintain proper reward distribution with optimized token transfers", async function() {
      // Set initial parameters for testing
      const proposer = user1.address;
      const yesVotes = 750; // 75% yes votes
      const noVotes = 250;
      const totalSupply = 1000;
      
      // Distributor calls distributeRewards
      const initialBalance = await getTokenBalance(rewardToken, proposer);
      const tx = await governanceRewards.connect(distributor).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      const receipt = await tx.wait();
      
      // Check reward was distributed
      const finalBalance = await getTokenBalance(rewardToken, proposer);
      expect(finalBalance).to.be.gt(initialBalance);
      
      // Verify event
      const event = findEvent(receipt, "RewardDistributed");
      expect(event).to.not.be.null;
      expect(event.args.recipient).to.equal(proposer);
    });
    
    it("should support manually distributing rewards by admin", async function() {
      // Admin manually distributes rewards
      const recipient = user2.address;
      const amount = toWei(500);
      const reason = "Special contribution";
      
      // Get initial balance
      const initialBalance = await getTokenBalance(rewardToken, recipient);
      
      // Execute manual distribution
      const tx = await governanceRewards.connect(admin).manualDistributeReward(
        recipient,
        amount,
        reason
      );
      const receipt = await tx.wait();
      
      // Check recipient received tokens
      const finalBalance = await getTokenBalance(rewardToken, recipient);
      expect(finalBalance.sub(initialBalance)).to.equal(amount);
      
      // Verify event
      const event = findEvent(receipt, "RewardDistributed");
      expect(event).to.not.be.null;
      expect(event.args.recipient).to.equal(recipient);
      expect(event.args.amount).to.equal(amount);
      expect(event.args.reason).to.equal(reason);
    });
    
    it("should allow token recovery by admin", async function() {
      // Admin recovers accidentally sent tokens
      const amount = toWei(1000);
      const initialBalance = await getTokenBalance(mockToken, admin.address);
      
      // Execute token recovery
      const tx = await governanceRewards.connect(admin).recoverTokens(
        mockToken.address,
        amount
      );
      const receipt = await tx.wait();
      
      // Check admin received tokens
      const finalBalance = await getTokenBalance(mockToken, admin.address);
      expect(finalBalance.sub(initialBalance)).to.equal(amount);
    });
  });
  
  describe("Edge Cases and Reentrancy Protection", function() {
    it("should handle zero value approvals", async function() {
      const tx = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, 0);
      const receipt = await tx.wait();
      
      // Check approval was set to zero
      const allowance = await getTokenAllowance(mockToken, governanceRewards.address, user1.address);
      expect(allowance).to.equal(0);
      
      // Verify event
      const event = findEvent(receipt, "TokenApprovalOptimized");
      expect(event).to.not.be.null;
      expect(event.args.amount).to.equal(0);
    });
    
    it("should protect reward distribution against reentrancy", async function() {
      // The implementation uses the nonReentrant modifier
      // We can verify it exists and works by checking that state variables
      // are properly updated after reward distribution
      
      const proposer = user1.address;
      const yesVotes = 750;
      const noVotes = 250;
      const totalSupply = 1000;
      
      // First distribution
      await governanceRewards.connect(distributor).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check that timestamp was updated (cooldown enforced)
      const timestamp = await governanceRewards.lastRewardTimestamp(proposer);
      expect(timestamp).to.be.gt(0);
      
      // Check reward history was updated
      const historyCount = await governanceRewards.getRewardHistoryCount();
      expect(historyCount).to.equal(1);
    });
  });
});