/**
 * @title Critical Functions Test Suite
 * @dev Comprehensive tests for critical functions in the D-Loop Protocol
 * @notice This test suite covers all critical functions identified in the pre-deployment checklist
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");
require('../../utils/ethers-v6-compat');

// Test utilities
const toWei = (amount) => ethers.utils.parseEther(amount.toString());
const fromWei = (amount) => ethers.utils.formatEther(amount);
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("Critical Functions Test Suite", function() {
  // Test accounts
  let deployer, admin, nodeOperator1, nodeOperator2, delegator1, delegator2, user1, user2;
  
  // Core contracts
  let dloopToken, aiNodeRegistry, aiNodeGovernance, soulboundNFT, priceOracle, treasury;
  
  // Test constants
  const MIN_NODE_STAKE = toWei(1000);
  const MIN_DELEGATION_AMOUNT = toWei(100);
  const DELEGATION_COOLDOWN = 60 * 60 * 24 * 7; // 7 days in seconds
  const PROPOSAL_THRESHOLD = toWei(500);
  const QUORUM_THRESHOLD = toWei(5000);
  const VOTING_PERIOD = 60 * 60 * 24 * 3; // 3 days in seconds
  
  before(async function() {
    // Get test accounts
    [deployer, admin, nodeOperator1, nodeOperator2, delegator1, delegator2, user1, user2] = await ethers.getSigners();
    
    // Deploy core contracts
    console.log("Deploying core contracts for critical function tests...");
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("D-Loop Token", "DLOOP");
    await dloopToken.deployed();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("D-Loop Identity", "DLOOPID");
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(dloopToken.address, soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(dloopToken.address);
    await treasury.deployed();
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      dloopToken.address,
      aiNodeRegistry.address,
      PROPOSAL_THRESHOLD,
      QUORUM_THRESHOLD,
      VOTING_PERIOD
    );
    await aiNodeGovernance.deployed();
    
    // Setup roles and permissions
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeRegistry.address);
    await aiNodeRegistry.grantRole(await aiNodeRegistry.ADMIN_ROLE(), admin.address);
    await aiNodeRegistry.setGovernanceContract(aiNodeGovernance.address);
    await dloopToken.mint(treasury.address, toWei(1000000)); // Mint 1M tokens to treasury
    
    // Mint tokens to test accounts
    await dloopToken.mint(nodeOperator1.address, toWei(10000));
    await dloopToken.mint(nodeOperator2.address, toWei(10000));
    await dloopToken.mint(delegator1.address, toWei(5000));
    await dloopToken.mint(delegator2.address, toWei(5000));
    
    console.log("Core contracts deployed and configured");
  });
  
  describe("1. Token Operations", function() {
    it("should delegate tokens successfully", async function() {
      // Approve tokens first
      await dloopToken.connect(delegator1).approve(aiNodeRegistry.address, toWei(1000));
      
      // Register a node first
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerAINode(
        "Node 1",
        "https://node1.dloop.io",
        "Node 1 Description",
        MIN_NODE_STAKE
      );
      
      const nodeId = 1; // First node ID
      
      // Delegate tokens
      await aiNodeRegistry.connect(delegator1).delegateTokens(nodeId, toWei(500));
      
      // Check delegation
      const delegation = await aiNodeRegistry.getDelegation(nodeId, delegator1.address);
      expect(delegation).to.equal(toWei(500));
      
      // Check node total stake
      const nodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(nodeInfo.totalStake).to.equal(MIN_NODE_STAKE.add(toWei(500)));
    });
    
    it("should withdraw delegation successfully after cooldown", async function() {
      const nodeId = 1; // First node ID
      
      // Request withdrawal
      await aiNodeRegistry.connect(delegator1).requestWithdrawDelegation(nodeId, toWei(200));
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [DELEGATION_COOLDOWN + 1]);
      await ethers.provider.send("evm_mine");
      
      // Complete withdrawal
      await aiNodeRegistry.connect(delegator1).withdrawDelegation(nodeId);
      
      // Check delegation
      const delegation = await aiNodeRegistry.getDelegation(nodeId, delegator1.address);
      expect(delegation).to.equal(toWei(300)); // 500 - 200
      
      // Check node total stake
      const nodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(nodeInfo.totalStake).to.equal(MIN_NODE_STAKE.add(toWei(300)));
    });
    
    it("should mint D-AI tokens correctly", async function() {
      const initialSupply = await dloopToken.totalSupply();
      
      // Mint tokens
      await dloopToken.mint(user1.address, toWei(1000));
      
      // Check balance
      const balance = await dloopToken.balanceOf(user1.address);
      expect(balance).to.equal(toWei(1000));
      
      // Check total supply increased
      const newSupply = await dloopToken.totalSupply();
      expect(newSupply).to.equal(initialSupply.add(toWei(1000)));
    });
    
    it("should burn D-AI tokens correctly", async function() {
      // Approve tokens for burning
      await dloopToken.connect(user1).approve(dloopToken.address, toWei(500));
      
      const initialSupply = await dloopToken.totalSupply();
      const initialBalance = await dloopToken.balanceOf(user1.address);
      
      // Burn tokens
      await dloopToken.burnFrom(user1.address, toWei(500));
      
      // Check balance decreased
      const newBalance = await dloopToken.balanceOf(user1.address);
      expect(newBalance).to.equal(initialBalance.sub(toWei(500)));
      
      // Check total supply decreased
      const newSupply = await dloopToken.totalSupply();
      expect(newSupply).to.equal(initialSupply.sub(toWei(500)));
    });
  });
  
  describe("2. Governance", function() {
    let proposalId;
    
    it("should submit a proposal successfully", async function() {
      // Create a mock target contract for the proposal
      const MockTarget = await ethers.getContractFactory("MockTarget");
      const mockTarget = await MockTarget.deploy();
      await mockTarget.deployed();
      
      // Encode function call for the proposal
      const callData = mockTarget.interface.encodeFunctionData("setParameter", [42]);
      
      // Submit proposal
      const tx = await aiNodeGovernance.connect(nodeOperator1).submitProposal(
        "Test Proposal",
        "This is a test proposal",
        mockTarget.address,
        callData
      );
      
      // Get proposal ID from event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      proposalId = event.args.proposalId;
      
      // Check proposal exists
      const proposal = await aiNodeGovernance.getProposal(proposalId);
      expect(proposal.description).to.equal("This is a test proposal");
      expect(proposal.status).to.equal(1); // Active status
    });
    
    it("should cast votes on a proposal", async function() {
      // Cast votes
      await aiNodeGovernance.connect(nodeOperator1).castVote(proposalId, true); // Yes vote
      await aiNodeGovernance.connect(nodeOperator2).castVote(proposalId, false); // No vote
      
      // Check votes
      const yesVotes = await aiNodeGovernance.getProposalYesVotes(proposalId);
      const noVotes = await aiNodeGovernance.getProposalNoVotes(proposalId);
      
      // NodeOperator1 has at least MIN_NODE_STAKE tokens
      expect(yesVotes).to.be.at.least(MIN_NODE_STAKE);
      // NodeOperator2 has at least MIN_NODE_STAKE tokens
      expect(noVotes).to.be.at.least(MIN_NODE_STAKE);
    });
    
    it("should execute a successful proposal", async function() {
      // Fast forward time past voting period
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Execute proposal
      await aiNodeGovernance.connect(admin).executeProposal(proposalId);
      
      // Check proposal status
      const proposal = await aiNodeGovernance.getProposal(proposalId);
      expect(proposal.status).to.equal(3); // Executed status
    });
  });
  
  describe("3. Node Management", function() {
    it("should register an AI node successfully", async function() {
      // Approve tokens first
      await dloopToken.connect(nodeOperator2).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      
      // Register node
      await aiNodeRegistry.connect(nodeOperator2).registerAINode(
        "Node 2",
        "https://node2.dloop.io",
        "Node 2 Description",
        MIN_NODE_STAKE
      );
      
      // Check node exists
      const nodeId = 2; // Second node ID
      const nodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(nodeInfo.name).to.equal("Node 2");
      expect(nodeInfo.operator).to.equal(nodeOperator2.address);
      expect(nodeInfo.totalStake).to.equal(MIN_NODE_STAKE);
    });
    
    it("should verify node identity with SoulboundNFT", async function() {
      const nodeId = 2; // Second node ID
      
      // Check if NFT was minted to node operator
      const tokenId = await soulboundNFT.getTokenIdByAddress(nodeOperator2.address);
      expect(tokenId).to.be.gt(0); // Token ID should be greater than 0
      
      // Verify ownership
      const owner = await soulboundNFT.ownerOf(tokenId);
      expect(owner).to.equal(nodeOperator2.address);
      
      // Check node identity in registry
      const nodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(nodeInfo.identityTokenId).to.equal(tokenId);
    });
    
    it("should update node status correctly", async function() {
      const nodeId = 2; // Second node ID
      
      // Update node status to inactive
      await aiNodeRegistry.connect(admin).updateNodeStatus(nodeId, 2); // 2 = Inactive
      
      // Check node status
      const nodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(nodeInfo.status).to.equal(2); // Inactive status
      
      // Update node status back to active
      await aiNodeRegistry.connect(admin).updateNodeStatus(nodeId, 1); // 1 = Active
      
      // Check node status
      const updatedNodeInfo = await aiNodeRegistry.getAINode(nodeId);
      expect(updatedNodeInfo.status).to.equal(1); // Active status
    });
  });
  
  describe("4. Economic Functions", function() {
    it("should calculate rewards correctly", async function() {
      // Deploy rewards calculator
      const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
      const governanceRewards = await GovernanceRewards.deploy(
        dloopToken.address,
        aiNodeRegistry.address,
        treasury.address
      );
      await governanceRewards.deployed();
      
      // Set up treasury permissions
      await treasury.grantRole(await treasury.DISTRIBUTOR_ROLE(), governanceRewards.address);
      
      // Register test nodes with different stakes
      await dloopToken.mint(user1.address, toWei(2000));
      await dloopToken.connect(user1).approve(aiNodeRegistry.address, toWei(2000));
      await aiNodeRegistry.connect(user1).registerAINode(
        "Node 3",
        "https://node3.dloop.io",
        "Node 3 Description",
        toWei(2000)
      );
      
      // Calculate rewards for an epoch
      const epochReward = toWei(1000); // 1000 tokens for the epoch
      await governanceRewards.calculateEpochRewards(1, epochReward);
      
      // Check rewards for Node 1 (has delegations)
      const node1Rewards = await governanceRewards.getNodeReward(1, 1); // epoch 1, node 1
      expect(node1Rewards).to.be.gt(0);
      
      // Check rewards for Node 3 (higher stake)
      const node3Rewards = await governanceRewards.getNodeReward(1, 3); // epoch 1, node 3
      expect(node3Rewards).to.be.gt(0);
    });
    
    it("should distribute epoch rewards successfully", async function() {
      // Deploy rewards calculator if not already deployed
      let governanceRewards;
      try {
        governanceRewards = await ethers.getContractAt(
          "GovernanceRewards",
          (await ethers.provider.getCode("GovernanceRewards")).address
        );
      } catch (e) {
        const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
        governanceRewards = await GovernanceRewards.deploy(
          dloopToken.address,
          aiNodeRegistry.address,
          treasury.address
        );
        await governanceRewards.deployed();
        
        // Set up treasury permissions
        await treasury.grantRole(await treasury.DISTRIBUTOR_ROLE(), governanceRewards.address);
      }
      
      // Get initial balances
      const initialBalance1 = await dloopToken.balanceOf(nodeOperator1.address);
      
      // Distribute rewards for epoch 1
      await governanceRewards.distributeEpochRewards(1);
      
      // Check balances increased
      const newBalance1 = await dloopToken.balanceOf(nodeOperator1.address);
      expect(newBalance1).to.be.gt(initialBalance1);
    });
    
    it("should update prices correctly", async function() {
      // Set a price for DLOOP token
      const dloopPrice = toWei(2); // $2 per DLOOP
      await priceOracle.updatePrice(dloopToken.address, dloopPrice);
      
      // Check price was updated
      const price = await priceOracle.getPrice(dloopToken.address);
      expect(price).to.equal(dloopPrice);
      
      // Update price
      const newPrice = toWei(2.5); // $2.50 per DLOOP
      await priceOracle.updatePrice(dloopToken.address, newPrice);
      
      // Check price was updated
      const updatedPrice = await priceOracle.getPrice(dloopToken.address);
      expect(updatedPrice).to.equal(newPrice);
    });
  });
});
