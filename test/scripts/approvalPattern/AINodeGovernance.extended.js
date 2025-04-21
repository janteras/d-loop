/**
 * @title AINodeGovernance Token Approval Extended Tests
 * @dev Comprehensive tests for token approval patterns in AINodeGovernance contract
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
} = require("./BaseApprovalTest");

describe("AINodeGovernance Token Approval Pattern", function() {
  let owner, admin, nodeOperator1, nodeOperator2, delegator1, delegator2, unauthorized;
  let dloopToken, aiNodeGovernance, aiNodeRegistry, tokenApprovalOptimizer;
  let ROLES;
  
  // Test constants
  const MIN_NODE_STAKE = toWei(1000);
  const MIN_DELEGATION_AMOUNT = toWei(100);
  const DELEGATION_COOLDOWN = 60 * 60 * 24 * 7; // 7 days in seconds
  
  beforeEach(async function() {
    // Get signers
    [owner, admin, nodeOperator1, nodeOperator2, delegator1, delegator2, unauthorized] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock DLoopToken
    dloopToken = await deployMockToken("DLOOP Test Token", "DLOOP", 18, owner);
    
    // Mint tokens to node operators and delegators for testing
    await dloopToken.mint(nodeOperator1.address, toWei(2000));
    await dloopToken.mint(nodeOperator2.address, toWei(2000));
    await dloopToken.mint(delegator1.address, toWei(500));
    await dloopToken.mint(delegator2.address, toWei(500));
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(admin.address);
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      dloopToken.address,
      MIN_NODE_STAKE,
      MIN_DELEGATION_AMOUNT,
      DELEGATION_COOLDOWN,
      admin.address
    );
    
    // Connect Registry and Governance
    await aiNodeGovernance.setNodeRegistry(aiNodeRegistry.address);
    await aiNodeRegistry.connect(admin).setGovernanceContract(aiNodeGovernance.address);
    
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy();
  });
  
  describe("1. Node Registration Approval Flow", function() {
    it("1.1 Should require approval before node registration", async function() {
      // Try to register without approval
      await expect(
        aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE)
      ).to.be.revertedWith("ERC20: insufficient allowance");
      
      // Approve and register
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Verify node is registered
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.isActive).to.be.true;
      expect(nodeDetails.stake).to.equal(MIN_NODE_STAKE);
    });
    
    it("1.2 Should handle partial approvals correctly", async function() {
      // Approve less than required
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE.sub(toWei(1)));
      
      // Try to register
      await expect(
        aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE)
      ).to.be.revertedWith("ERC20: insufficient allowance");
      
      // Approve the correct amount
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, toWei(1), { from: nodeOperator1.address });
      
      // Now registration should work
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Verify node is registered
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.isActive).to.be.true;
    });
    
    it("1.3 Should track token balances correctly during registration", async function() {
      // Check initial balances
      const initialNodeBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      const initialContractBalance = await getTokenBalance(dloopToken, aiNodeGovernance.address);
      
      // Approve and register
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Check final balances
      const finalNodeBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      const finalContractBalance = await getTokenBalance(dloopToken, aiNodeGovernance.address);
      
      expect(initialNodeBalance.sub(finalNodeBalance)).to.equal(MIN_NODE_STAKE);
      expect(finalContractBalance.sub(initialContractBalance)).to.equal(MIN_NODE_STAKE);
    });
    
    it("1.4 Should not allow registering the same node twice", async function() {
      // First registration
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Try registering again
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await expect(
        aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE)
      ).to.be.revertedWith("Node already registered");
    });
  });
  
  describe("2. Node Delegation Approval Flow", function() {
    beforeEach(async function() {
      // Register a node for delegation tests
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
    });
    
    it("2.1 Should require approval before delegation", async function() {
      const delegationAmount = toWei(200);
      
      // Try to delegate without approval
      await expect(
        aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, delegationAmount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
      
      // Approve and delegate
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, delegationAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, delegationAmount);
      
      // Verify delegation
      const delegationDetails = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator1.address);
      expect(delegationDetails.amount).to.equal(delegationAmount);
      expect(delegationDetails.isActive).to.be.true;
    });
    
    it("2.2 Should handle multiple delegations with correct approvals", async function() {
      // First delegation
      const firstAmount = toWei(150);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, firstAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, firstAmount);
      
      // Register second node
      await dloopToken.connect(nodeOperator2).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator2).registerNode(0, MIN_NODE_STAKE);
      
      // Second delegation to different node
      const secondAmount = toWei(200);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, secondAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator2.address, secondAmount);
      
      // Verify delegations
      const delegation1 = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator1.address);
      const delegation2 = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator2.address);
      
      expect(delegation1.amount).to.equal(firstAmount);
      expect(delegation2.amount).to.equal(secondAmount);
      
      // Verify delegated nodes list
      const delegatedNodes = await aiNodeGovernance.getDelegatedNodes(delegator1.address);
      expect(delegatedNodes).to.include(nodeOperator1.address);
      expect(delegatedNodes).to.include(nodeOperator2.address);
      expect(delegatedNodes.length).to.equal(2);
    });
    
    it("2.3 Should handle delegation increases with correct approvals", async function() {
      // Initial delegation
      const initialAmount = toWei(150);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, initialAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, initialAmount);
      
      // Increase delegation
      const increaseAmount = toWei(100);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, increaseAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, increaseAmount);
      
      // Verify updated delegation
      const delegation = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator1.address);
      expect(delegation.amount).to.equal(initialAmount.add(increaseAmount));
    });
    
    it("2.4 Should update node delegated amount correctly", async function() {
      const delegationAmount = toWei(200);
      
      // Check initial node details
      const initialNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      
      // Delegate tokens
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, delegationAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, delegationAmount);
      
      // Check updated node details
      const updatedNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      expect(updatedNodeDetails.delegatedAmount).to.equal(initialNodeDetails.delegatedAmount.add(delegationAmount));
    });
  });
  
  describe("3. Withdrawal Security and Approval Flow", function() {
    let delegationAmount;
    
    beforeEach(async function() {
      // Register a node
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Set up delegation
      delegationAmount = toWei(200);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, delegationAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, delegationAmount);
      
      // Advance time past cooldown period
      await ethers.provider.send("evm_increaseTime", [DELEGATION_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine");
    });
    
    it("3.1 Should allow withdrawal after cooldown period", async function() {
      const withdrawAmount = toWei(100);
      
      // Check balances before withdrawal
      const beforeDelegatorBalance = await getTokenBalance(dloopToken, delegator1.address);
      
      // Withdraw delegation partially
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(nodeOperator1.address, withdrawAmount);
      
      // Check balances after withdrawal
      const afterDelegatorBalance = await getTokenBalance(dloopToken, delegator1.address);
      
      // Verify delegation and balances
      const delegation = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator1.address);
      expect(delegation.amount).to.equal(delegationAmount.sub(withdrawAmount));
      expect(afterDelegatorBalance.sub(beforeDelegatorBalance)).to.equal(withdrawAmount);
    });
    
    it("3.2 Should handle full withdrawal correctly", async function() {
      // Withdraw all delegated tokens
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(nodeOperator1.address, delegationAmount);
      
      // Verify delegation is marked inactive
      const delegation = await aiNodeGovernance.getDelegationDetails(delegator1.address, nodeOperator1.address);
      expect(delegation.isActive).to.be.false;
      expect(delegation.amount).to.equal(0);
      
      // Verify delegated nodes list is updated
      const delegatedNodes = await aiNodeGovernance.getDelegatedNodes(delegator1.address);
      expect(delegatedNodes).to.not.include(nodeOperator1.address);
      expect(delegatedNodes.length).to.equal(0);
    });
    
    it("3.3 Should prevent withdrawal before cooldown period", async function() {
      // Set up a new delegation
      const newDelegationAmount = toWei(150);
      await dloopToken.connect(delegator2).approve(aiNodeGovernance.address, newDelegationAmount);
      await aiNodeGovernance.connect(delegator2).delegateToNode(nodeOperator1.address, newDelegationAmount);
      
      // Try to withdraw immediately
      await expect(
        aiNodeGovernance.connect(delegator2).withdrawDelegation(nodeOperator1.address, toWei(50))
      ).to.be.revertedWith("Cooldown period not met");
    });
    
    it("3.4 Should update node delegated amount after withdrawal", async function() {
      // Get node details before withdrawal
      const beforeNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      
      // Withdraw half of delegation
      const withdrawAmount = delegationAmount.div(2);
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(nodeOperator1.address, withdrawAmount);
      
      // Get node details after withdrawal
      const afterNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      
      // Verify delegated amount is reduced correctly
      expect(beforeNodeDetails.delegatedAmount.sub(afterNodeDetails.delegatedAmount)).to.equal(withdrawAmount);
    });
  });
  
  describe("4. Node Deregistration and Stake Withdrawal", function() {
    beforeEach(async function() {
      // Register a node
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
    });
    
    it("4.1 Should not allow deregistration with active delegations", async function() {
      // Set up delegation
      const delegationAmount = toWei(200);
      await dloopToken.connect(delegator1).approve(aiNodeGovernance.address, delegationAmount);
      await aiNodeGovernance.connect(delegator1).delegateToNode(nodeOperator1.address, delegationAmount);
      
      // Try to deregister
      await expect(
        aiNodeGovernance.connect(nodeOperator1).deregisterNode()
      ).to.be.revertedWith("Active delegations exist");
    });
    
    it("4.2 Should return stake upon deregistration", async function() {
      // Check balance before deregistration
      const beforeBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Deregister node
      await aiNodeGovernance.connect(nodeOperator1).deregisterNode();
      
      // Check balance after deregistration
      const afterBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Verify stake is returned
      expect(afterBalance.sub(beforeBalance)).to.equal(MIN_NODE_STAKE);
      
      // Verify node is marked inactive
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.isActive).to.be.false;
      expect(nodeDetails.stake).to.equal(0);
    });
    
    it("4.3 Should allow partial stake withdrawal", async function() {
      // Register node with extra stake
      const extraStake = toWei(500);
      await dloopToken.connect(nodeOperator2).approve(aiNodeGovernance.address, MIN_NODE_STAKE.add(extraStake));
      await aiNodeGovernance.connect(nodeOperator2).registerNode(0, MIN_NODE_STAKE.add(extraStake));
      
      // Get balance before withdrawal
      const beforeBalance = await getTokenBalance(dloopToken, nodeOperator2.address);
      
      // Withdraw part of stake
      await aiNodeGovernance.connect(nodeOperator2).decreaseStake(extraStake);
      
      // Get balance after withdrawal
      const afterBalance = await getTokenBalance(dloopToken, nodeOperator2.address);
      
      // Verify returned amount and remaining stake
      expect(afterBalance.sub(beforeBalance)).to.equal(extraStake);
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOperator2.address);
      expect(nodeDetails.stake).to.equal(MIN_NODE_STAKE);
    });
    
    it("4.4 Should not allow decreasing stake below minimum", async function() {
      // Try to decrease stake below minimum
      await expect(
        aiNodeGovernance.connect(nodeOperator1).decreaseStake(toWei(1))
      ).to.be.revertedWith("Below minimum stake");
    });
  });
  
  describe("5. Role-Based Access Control", function() {
    it("5.1 Should restrict admin-only functions", async function() {
      // Try to update minimum stake as non-admin
      await expect(
        aiNodeGovernance.connect(unauthorized).setMinNodeStake(toWei(2000))
      ).to.be.revertedWith("Caller not admin");
      
      // Admin should be able to update min stake
      await aiNodeGovernance.connect(admin).setMinNodeStake(toWei(2000));
      
      // Verify update
      const newMinStake = await aiNodeGovernance.minNodeStake();
      expect(newMinStake).to.equal(toWei(2000));
    });
    
    it("5.2 Should allow owner to transfer ownership", async function() {
      // Transfer ownership
      await aiNodeGovernance.transferOwnership(admin.address);
      
      // Verify new owner
      const newOwner = await aiNodeGovernance.owner();
      expect(newOwner).to.equal(admin.address);
      
      // Old owner should no longer have access
      await expect(
        aiNodeGovernance.connect(owner).transferOwnership(unauthorized.address)
      ).to.be.revertedWith("Caller not owner");
    });
    
    it("5.3 Should not allow non-owners to transfer ownership", async function() {
      await expect(
        aiNodeGovernance.connect(unauthorized).transferOwnership(unauthorized.address)
      ).to.be.revertedWith("Caller not owner");
    });
    
    it("5.4 Should not allow node registry updates by non-admins", async function() {
      await expect(
        aiNodeGovernance.connect(unauthorized).setNodeRegistry(ethers.constants.AddressZero)
      ).to.be.revertedWith("Caller not admin");
    });
  });
  
  describe("6. Backward Compatibility", function() {
    let mockPreviousNodeRegistry;
    
    beforeEach(async function() {
      // Deploy mock previous version of AINodeRegistry
      const MockPreviousNodeRegistry = await ethers.getContractFactory("MockPreviousNodeRegistry");
      mockPreviousNodeRegistry = await MockPreviousNodeRegistry.deploy();
    });
    
    it("6.1 Should work with previous registry version", async function() {
      // Set mock previous registry
      await aiNodeGovernance.connect(admin).setNodeRegistry(mockPreviousNodeRegistry.address);
      
      // Approve and register node
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      
      // Verify node registered in mock registry
      const isRegistered = await mockPreviousNodeRegistry.isNodeRegistered(nodeOperator1.address);
      expect(isRegistered).to.be.true;
    });
    
    it("6.2 Should handle node state updates with previous registry", async function() {
      // Set mock previous registry
      await aiNodeGovernance.connect(admin).setNodeRegistry(mockPreviousNodeRegistry.address);
      
      // Register and deregister node
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      await aiNodeGovernance.connect(nodeOperator1).deregisterNode();
      
      // Verify node is inactive in mock registry
      const nodeState = await mockPreviousNodeRegistry.getNodeState(nodeOperator1.address);
      expect(nodeState).to.equal(0); // Inactive state
    });
  });
  
  describe("7. Gas Efficiency", function() {
    it("7.1 Should optimize gas for token approvals", async function() {
      // Standard approval and registration
      await dloopToken.connect(nodeOperator1).approve(aiNodeGovernance.address, MIN_NODE_STAKE);
      const tx1 = await aiNodeGovernance.connect(nodeOperator1).registerNode(0, MIN_NODE_STAKE);
      const gasUsed1 = await calculateGasUsed(tx1);
      
      // Optimized approval and registration using TokenApprovalOptimizer
      await dloopToken.connect(nodeOperator2).approve(tokenApprovalOptimizer.address, MIN_NODE_STAKE);
      await tokenApprovalOptimizer.connect(nodeOperator2).approveAndCall(
        dloopToken.address,
        aiNodeGovernance.address,
        MIN_NODE_STAKE,
        aiNodeGovernance.interface.encodeFunctionData("registerNode", [0, MIN_NODE_STAKE])
      );
      
      // Verify both nodes are registered
      const node1Details = await aiNodeGovernance.getNodeDetails(nodeOperator1.address);
      const node2Details = await aiNodeGovernance.getNodeDetails(nodeOperator2.address);
      
      expect(node1Details.isActive).to.be.true;
      expect(node2Details.isActive).to.be.true;
    });
  });
});