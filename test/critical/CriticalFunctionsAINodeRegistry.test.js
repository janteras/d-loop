/**
 * @title Critical Functions Test for AINodeRegistry
 * @dev Comprehensive test suite for critical functions in the AINodeRegistry contract
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Load ethers v6 compatibility layer
require("../utils/ethers-v6-compat");

describe("AINodeRegistry - Critical Functions", function () {
  // Test variables
  let aiNodeRegistry;
  let soulboundNFT;
  let mockToken;
  let owner;
  let admin;
  let treasury;
  let nodeOperator1;
  let nodeOperator2;
  let user1;
  
  // Constants
  const NODE_STAKE_AMOUNT = ethers.parseEther("10000");
  const MIN_REPUTATION = 100;
  const COOLDOWN_PERIOD = 86400; // 1 day in seconds
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, treasury, nodeOperator1, nodeOperator2, user1] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(
      "AI Node Identity",
      "AIID",
      "https://dloop.ai/metadata/",
      owner.address,
      admin.address
    );
    await soulboundNFT.deployed();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("D-Loop Token", "DLOOP", 18);
    
    // Mint tokens to node operators
    await mockToken.mint(nodeOperator1.address, NODE_STAKE_AMOUNT * 2n);
    await mockToken.mint(nodeOperator2.address, NODE_STAKE_AMOUNT * 2n);
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      owner.address,
      admin.address,
      treasury.address,
      mockToken.address,
      soulboundNFT.address,
      NODE_STAKE_AMOUNT,
      MIN_REPUTATION,
      COOLDOWN_PERIOD
    );
    
    // Grant minter role to AINodeRegistry in SoulboundNFT
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    await soulboundNFT.connect(owner).grantRole(MINTER_ROLE, aiNodeRegistry.address);
    
    // Approve token spending
    await mockToken.connect(nodeOperator1).approve(aiNodeRegistry.address, NODE_STAKE_AMOUNT * 2n);
    await mockToken.connect(nodeOperator2).approve(aiNodeRegistry.address, NODE_STAKE_AMOUNT * 2n);
  });
  
  describe("Critical Function: registerAINode", function () {
    it("Should allow node operator to register a new AI node", async function () {
      const nodeEndpoint = "https://node1.dloop.ai";
      const nodeName = "TestNode1";
      const nodeDescription = "Test AI Node 1";
      const nodeType = 1; // Assuming 1 is a valid node type
      
      await expect(aiNodeRegistry.connect(nodeOperator1).registerAINode(
        nodeEndpoint,
        nodeName,
        nodeDescription,
        nodeType
      ))
        .to.emit(aiNodeRegistry, "AINodeRegistered")
        .withArgs(nodeOperator1.address, 1, nodeEndpoint, nodeName);
      
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.owner).to.equal(nodeOperator1.address);
      expect(nodeInfo.endpoint).to.equal(nodeEndpoint);
      expect(nodeInfo.name).to.equal(nodeName);
      expect(nodeInfo.description).to.equal(nodeDescription);
      expect(nodeInfo.nodeType).to.equal(nodeType);
      expect(nodeInfo.isActive).to.be.true;
      
      // Check that NFT was minted
      expect(await soulboundNFT.ownerOf(1)).to.equal(nodeOperator1.address);
      
      // Check that stake was transferred
      expect(await mockToken.balanceOf(aiNodeRegistry.address)).to.equal(NODE_STAKE_AMOUNT);
    });
    
    it("Should revert if node operator doesn't have enough tokens", async function () {
      // Deploy a new operator with no tokens
      const [newOperator] = await ethers.getSigners().then(signers => signers.slice(6, 7));
      
      await expect(
        aiNodeRegistry.connect(newOperator).registerAINode(
          "https://node.dloop.ai",
          "TestNode",
          "Test AI Node",
          1
        )
      ).to.be.reverted; // ERC20: transfer amount exceeds balance
    });
    
    it("Should revert if node operator hasn't approved token spending", async function () {
      // Deploy a new operator with tokens but no approval
      const [newOperator] = await ethers.getSigners().then(signers => signers.slice(6, 7));
      await mockToken.mint(newOperator.address, NODE_STAKE_AMOUNT);
      
      await expect(
        aiNodeRegistry.connect(newOperator).registerAINode(
          "https://node.dloop.ai",
          "TestNode",
          "Test AI Node",
          1
        )
      ).to.be.reverted; // ERC20: insufficient allowance
    });
    
    it("Should revert if node endpoint is empty", async function () {
      await expect(
        aiNodeRegistry.connect(nodeOperator1).registerAINode(
          "",
          "TestNode",
          "Test AI Node",
          1
        )
      ).to.be.revertedWith("Endpoint cannot be empty");
    });
    
    it("Should revert if node name is empty", async function () {
      await expect(
        aiNodeRegistry.connect(nodeOperator1).registerAINode(
          "https://node.dloop.ai",
          "",
          "Test AI Node",
          1
        )
      ).to.be.revertedWith("Name cannot be empty");
    });
  });
  
  describe("Critical Function: verifyNodeIdentity", function () {
    beforeEach(async function () {
      // Register a node first
      await aiNodeRegistry.connect(nodeOperator1).registerAINode(
        "https://node1.dloop.ai",
        "TestNode1",
        "Test AI Node 1",
        1
      );
    });
    
    it("Should allow admin to verify node identity", async function () {
      await expect(aiNodeRegistry.connect(admin).verifyNodeIdentity(1, true))
        .to.emit(aiNodeRegistry, "NodeIdentityVerified")
        .withArgs(1, true);
      
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.isVerified).to.be.true;
    });
    
    it("Should allow admin to revoke verification", async function () {
      // First verify
      await aiNodeRegistry.connect(admin).verifyNodeIdentity(1, true);
      
      // Then revoke
      await expect(aiNodeRegistry.connect(admin).verifyNodeIdentity(1, false))
        .to.emit(aiNodeRegistry, "NodeIdentityVerified")
        .withArgs(1, false);
      
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.isVerified).to.be.false;
    });
    
    it("Should revert if non-admin tries to verify node identity", async function () {
      await expect(
        aiNodeRegistry.connect(user1).verifyNodeIdentity(1, true)
      ).to.be.reverted; // AccessControl: account is missing role
    });
    
    it("Should revert if node does not exist", async function () {
      await expect(
        aiNodeRegistry.connect(admin).verifyNodeIdentity(999, true)
      ).to.be.revertedWith("Node does not exist");
    });
  });
  
  describe("Critical Function: updateNodeStatus", function () {
    beforeEach(async function () {
      // Register a node first
      await aiNodeRegistry.connect(nodeOperator1).registerAINode(
        "https://node1.dloop.ai",
        "TestNode1",
        "Test AI Node 1",
        1
      );
    });
    
    it("Should allow node owner to update node status", async function () {
      await expect(aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(1, false))
        .to.emit(aiNodeRegistry, "NodeStatusUpdated")
        .withArgs(1, false);
      
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.isActive).to.be.false;
    });
    
    it("Should allow node owner to reactivate node", async function () {
      // First deactivate
      await aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(1, false);
      
      // Then reactivate
      await expect(aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(1, true))
        .to.emit(aiNodeRegistry, "NodeStatusUpdated")
        .withArgs(1, true);
      
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.isActive).to.be.true;
    });
    
    it("Should revert if non-owner tries to update node status", async function () {
      await expect(
        aiNodeRegistry.connect(nodeOperator2).updateNodeStatus(1, false)
      ).to.be.revertedWith("Not node owner");
    });
    
    it("Should revert if node does not exist", async function () {
      await expect(
        aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(999, false)
      ).to.be.revertedWith("Node does not exist");
    });
  });
  
  describe("Critical Function: unstakeNode", function () {
    beforeEach(async function () {
      // Register a node first
      await aiNodeRegistry.connect(nodeOperator1).registerAINode(
        "https://node1.dloop.ai",
        "TestNode1",
        "Test AI Node 1",
        1
      );
      
      // Deactivate the node
      await aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(1, false);
    });
    
    it("Should allow node owner to initiate unstaking after cooldown period", async function () {
      // Advance time past cooldown period
      await time.increase(COOLDOWN_PERIOD + 1);
      
      const initialBalance = await mockToken.balanceOf(nodeOperator1.address);
      
      await expect(aiNodeRegistry.connect(nodeOperator1).unstakeNode(1))
        .to.emit(aiNodeRegistry, "NodeUnstaked")
        .withArgs(1, nodeOperator1.address, NODE_STAKE_AMOUNT);
      
      // Check that stake was returned
      expect(await mockToken.balanceOf(nodeOperator1.address)).to.equal(initialBalance + NODE_STAKE_AMOUNT);
      
      // Check that node is marked as unstaked
      const nodeInfo = await aiNodeRegistry.getNodeInfo(1);
      expect(nodeInfo.isStaked).to.be.false;
    });
    
    it("Should revert if node is still active", async function () {
      // Reactivate the node
      await aiNodeRegistry.connect(nodeOperator1).updateNodeStatus(1, true);
      
      // Advance time past cooldown period
      await time.increase(COOLDOWN_PERIOD + 1);
      
      await expect(
        aiNodeRegistry.connect(nodeOperator1).unstakeNode(1)
      ).to.be.revertedWith("Node must be inactive");
    });
    
    it("Should revert if cooldown period has not passed", async function () {
      await expect(
        aiNodeRegistry.connect(nodeOperator1).unstakeNode(1)
      ).to.be.revertedWith("Cooldown period not over");
    });
    
    it("Should revert if non-owner tries to unstake", async function () {
      // Advance time past cooldown period
      await time.increase(COOLDOWN_PERIOD + 1);
      
      await expect(
        aiNodeRegistry.connect(nodeOperator2).unstakeNode(1)
      ).to.be.revertedWith("Not node owner");
    });
    
    it("Should revert if node does not exist", async function () {
      // Advance time past cooldown period
      await time.increase(COOLDOWN_PERIOD + 1);
      
      await expect(
        aiNodeRegistry.connect(nodeOperator1).unstakeNode(999)
      ).to.be.revertedWith("Node does not exist");
    });
  });
});
