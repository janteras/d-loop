const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AINodeGovernance", function () {
  let aiNodeGovernance;
  let dloopToken;
  let aiNodeRegistry;
  let admin;
  let nodeOwner1;
  let nodeOwner2;
  let delegator1;
  let delegator2;

  // Constants
  const ZERO_ADDRESS = ethers.constants.AddressZero;
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const NodeType = {
    GovernanceNode: 0,
    InvestmentNode: 1
  };

  beforeEach(async function () {
    [admin, nodeOwner1, nodeOwner2, delegator1, delegator2] = await ethers.getSigners();

    // Deploy DLOOP token
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "d-loop Governance Token",
      "DLOOP",
      ethers.utils.parseEther("1000000"),
      18,
      ethers.utils.parseEther("10000000"),
      admin.address
    );
    await dloopToken.deployed();

    // Mint DLOOP tokens to node owners and delegators for testing
    await dloopToken.transfer(nodeOwner1.address, ethers.utils.parseEther("100000"));
    await dloopToken.transfer(nodeOwner2.address, ethers.utils.parseEther("100000"));
    await dloopToken.transfer(delegator1.address, ethers.utils.parseEther("50000"));
    await dloopToken.transfer(delegator2.address, ethers.utils.parseEther("50000"));

    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    const soulboundNFT = await SoulboundNFT.deploy(
      "d-loop AI Node Identity",
      "DLAI",
      "https://api.d-loop.io/metadata/"
    );
    await soulboundNFT.deployed();

    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      soulboundNFT.address,
      admin.address
    );
    await aiNodeRegistry.deployed();

    // Set up SoulboundNFT minter role
    const minterRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
    await soulboundNFT.grantRole(minterRole, aiNodeRegistry.address);

    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      dloopToken.address,
      aiNodeRegistry.address
    );
    await aiNodeGovernance.deployed();

    // Set up permissions
    const governanceRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
    await aiNodeRegistry.grantRole(governanceRole, aiNodeGovernance.address);
  });

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await aiNodeGovernance.dloopToken()).to.equal(dloopToken.address);
      expect(await aiNodeGovernance.aiNodeRegistry()).to.equal(aiNodeRegistry.address);
      expect(await aiNodeGovernance.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await aiNodeGovernance.hasRole(GOVERNANCE_ROLE, admin.address)).to.be.true;
      
      // Default parameters
      expect(await aiNodeGovernance.minNodeStake()).to.equal(ethers.utils.parseEther("10000"));
      expect(await aiNodeGovernance.minDelegationAmount()).to.equal(ethers.utils.parseEther("100"));
      expect(await aiNodeGovernance.delegationCooldown()).to.equal(7 * 24 * 60 * 60); // 7 days
      expect(await aiNodeGovernance.inactivityThreshold()).to.equal(30 * 24 * 60 * 60); // 30 days
    });

    it("Should revert if DLOOP token address is zero", async function () {
      const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
      await expect(
        AINodeGovernance.deploy(ZERO_ADDRESS, aiNodeRegistry.address)
      ).to.be.revertedWith("Zero address not allowed");
    });

    it("Should not revert if AINodeRegistry address is zero", async function () {
      const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
      const governance = await AINodeGovernance.deploy(dloopToken.address, ZERO_ADDRESS);
      await governance.deployed();
      
      expect(await governance.dloopToken()).to.equal(dloopToken.address);
      expect(await governance.aiNodeRegistry()).to.equal(ZERO_ADDRESS);
    });
  });

  describe("Node Registration", function () {
    beforeEach(async function () {
      // Approve AINodeGovernance to spend nodeOwner1's DLOOP tokens
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      // Approve AINodeGovernance to spend nodeOwner2's DLOOP tokens
      await dloopToken.connect(nodeOwner2).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
    });

    it("Should register a governance node", async function () {
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      
      expect(nodeDetails.owner).to.equal(nodeOwner1.address);
      expect(nodeDetails.nodeType).to.equal(NodeType.GovernanceNode);
      expect(nodeDetails.stake).to.equal(ethers.utils.parseEther("20000"));
      expect(nodeDetails.delegatedAmount).to.equal(0);
      expect(nodeDetails.isActive).to.be.true;
      
      // Check DLOOP tokens were transferred
      expect(await dloopToken.balanceOf(aiNodeGovernance.address)).to.equal(ethers.utils.parseEther("20000"));
    });

    it("Should register an investment node", async function () {
      await aiNodeGovernance.connect(nodeOwner2).registerNode(
        NodeType.InvestmentNode,
        ethers.utils.parseEther("15000")
      );
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner2.address);
      
      expect(nodeDetails.owner).to.equal(nodeOwner2.address);
      expect(nodeDetails.nodeType).to.equal(NodeType.InvestmentNode);
      expect(nodeDetails.stake).to.equal(ethers.utils.parseEther("15000"));
      expect(nodeDetails.isActive).to.be.true;
    });

    it("Should fail to register with insufficient stake", async function () {
      await expect(
        aiNodeGovernance.connect(nodeOwner1).registerNode(
          NodeType.GovernanceNode,
          ethers.utils.parseEther("5000") // Below minNodeStake
        )
      ).to.be.revertedWith("Insufficient stake");
    });

    it("Should fail to register an already registered node", async function () {
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
      
      await expect(
        aiNodeGovernance.connect(nodeOwner1).registerNode(
          NodeType.GovernanceNode,
          ethers.utils.parseEther("20000")
        )
      ).to.be.revertedWith("Node already registered");
    });
  });

  describe("Node Stake Management", function () {
    beforeEach(async function () {
      // Register nodeOwner1 as a governance node
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
    });

    it("Should increase node stake", async function () {
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("10000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).increaseNodeStake(
        ethers.utils.parseEther("10000")
      );
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.stake).to.equal(ethers.utils.parseEther("30000"));
    });

    it("Should decrease node stake", async function () {
      await aiNodeGovernance.connect(nodeOwner1).decreaseNodeStake(
        ethers.utils.parseEther("5000")
      );
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.stake).to.equal(ethers.utils.parseEther("15000"));
      
      // Check DLOOP tokens were returned
      expect(await dloopToken.balanceOf(nodeOwner1.address)).to.equal(
        ethers.utils.parseEther("85000") // 100K - 20K (initial stake) + 5K (returned stake)
      );
    });

    it("Should fail to decrease stake below minimum", async function () {
      await expect(
        aiNodeGovernance.connect(nodeOwner1).decreaseNodeStake(
          ethers.utils.parseEther("15000") // Would leave only 5K, below minNodeStake
        )
      ).to.be.revertedWith("Below min stake requirement");
    });
  });

  describe("Delegation", function () {
    beforeEach(async function () {
      // Register nodeOwner1 as a governance node
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
      
      // Approve AINodeGovernance to spend delegator1's DLOOP tokens
      await dloopToken.connect(delegator1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("50000")
      );
      
      // Approve AINodeGovernance to spend delegator2's DLOOP tokens
      await dloopToken.connect(delegator2).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("50000")
      );
    });

    it("Should delegate tokens to a node", async function () {
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      const delegationDetails = await aiNodeGovernance.getDelegationDetails(
        delegator1.address,
        nodeOwner1.address
      );
      
      expect(delegationDetails.amount).to.equal(ethers.utils.parseEther("5000"));
      expect(delegationDetails.isActive).to.be.true;
      
      // Check node's delegated amount
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.delegatedAmount).to.equal(ethers.utils.parseEther("5000"));
      
      // Check token transfer
      expect(await dloopToken.balanceOf(aiNodeGovernance.address)).to.equal(
        ethers.utils.parseEther("25000") // 20K node stake + 5K delegation
      );
    });

    it("Should increase an existing delegation", async function () {
      // Initial delegation
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      // Increase delegation
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("3000")
      );
      
      const delegationDetails = await aiNodeGovernance.getDelegationDetails(
        delegator1.address,
        nodeOwner1.address
      );
      
      expect(delegationDetails.amount).to.equal(ethers.utils.parseEther("8000"));
      
      // Check node's delegated amount
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.delegatedAmount).to.equal(ethers.utils.parseEther("8000"));
    });

    it("Should track delegated nodes for a delegator", async function () {
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      // Register a second node
      await dloopToken.connect(nodeOwner2).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner2).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
      
      // Delegate to second node
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner2.address,
        ethers.utils.parseEther("3000")
      );
      
      // Check delegated nodes list
      const delegatedNodes = await aiNodeGovernance.getDelegatedNodes(delegator1.address);
      expect(delegatedNodes.length).to.equal(2);
      expect(delegatedNodes[0]).to.equal(nodeOwner1.address);
      expect(delegatedNodes[1]).to.equal(nodeOwner2.address);
    });

    it("Should track delegators for a node", async function () {
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      await aiNodeGovernance.connect(delegator2).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("4000")
      );
      
      // Check node delegators list
      const nodeDelegators = await aiNodeGovernance.getNodeDelegators(nodeOwner1.address);
      expect(nodeDelegators.length).to.equal(2);
      expect(nodeDelegators[0]).to.equal(delegator1.address);
      expect(nodeDelegators[1]).to.equal(delegator2.address);
    });

    it("Should calculate node voting power correctly", async function () {
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      await aiNodeGovernance.connect(delegator2).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("4000")
      );
      
      // Get voting power: 20K (stake) + 5K + 4K (delegations) = 29K
      const votingPower = await aiNodeGovernance.getNodeVotingPower(nodeOwner1.address);
      expect(votingPower).to.equal(ethers.utils.parseEther("29000"));
    });
  });

  describe("Delegation Withdrawal", function () {
    beforeEach(async function () {
      // Register nodeOwner1 as a governance node
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
      
      // Delegate tokens
      await dloopToken.connect(delegator1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("50000")
      );
      
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
    });

    it("Should fail to withdraw before cooldown period", async function () {
      await expect(
        aiNodeGovernance.connect(delegator1).withdrawDelegation(
          nodeOwner1.address,
          ethers.utils.parseEther("2000")
        )
      ).to.be.revertedWith("Cooldown period");
    });

    it("Should partially withdraw delegation after cooldown", async function () {
      // Advance time past cooldown
      await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second
      
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(
        nodeOwner1.address,
        ethers.utils.parseEther("2000")
      );
      
      const delegationDetails = await aiNodeGovernance.getDelegationDetails(
        delegator1.address,
        nodeOwner1.address
      );
      
      expect(delegationDetails.amount).to.equal(ethers.utils.parseEther("3000"));
      expect(delegationDetails.isActive).to.be.true;
      
      // Check node's delegated amount
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.delegatedAmount).to.equal(ethers.utils.parseEther("3000"));
      
      // Check tokens returned
      expect(await dloopToken.balanceOf(delegator1.address)).to.equal(
        ethers.utils.parseEther("47000") // 50K - 5K (delegation) + 2K (withdrawn)
      );
    });

    it("Should fully withdraw delegation and update lists", async function () {
      // Advance time past cooldown
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      const delegationDetails = await aiNodeGovernance.getDelegationDetails(
        delegator1.address,
        nodeOwner1.address
      );
      
      expect(delegationDetails.amount).to.equal(0);
      expect(delegationDetails.isActive).to.be.false;
      
      // Check delegated nodes list is empty
      const delegatedNodes = await aiNodeGovernance.getDelegatedNodes(delegator1.address);
      expect(delegatedNodes.length).to.equal(0);
      
      // Check node delegators list is empty
      const nodeDelegators = await aiNodeGovernance.getNodeDelegators(nodeOwner1.address);
      expect(nodeDelegators.length).to.equal(0);
    });
  });

  describe("Node Deregistration", function () {
    beforeEach(async function () {
      // Register nodeOwner1 as a governance node
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
    });

    it("Should deregister a node without delegations", async function () {
      await aiNodeGovernance.connect(nodeOwner1).deregisterNode();
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.isActive).to.be.false;
      
      // Check stake returned
      expect(await dloopToken.balanceOf(nodeOwner1.address)).to.equal(
        ethers.utils.parseEther("100000") // All tokens returned
      );
    });

    it("Should fail to deregister a node with active delegations", async function () {
      // Add a delegation
      await dloopToken.connect(delegator1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("5000")
      );
      
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      // Try to deregister
      await expect(
        aiNodeGovernance.connect(nodeOwner1).deregisterNode()
      ).to.be.revertedWith("Active delegations");
    });

    it("Should allow deregistration after all delegations are withdrawn", async function () {
      // Add a delegation
      await dloopToken.connect(delegator1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("5000")
      );
      
      await aiNodeGovernance.connect(delegator1).delegateToNode(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      // Advance time
      await time.increase(7 * 24 * 60 * 60 + 1);
      
      // Withdraw delegation
      await aiNodeGovernance.connect(delegator1).withdrawDelegation(
        nodeOwner1.address,
        ethers.utils.parseEther("5000")
      );
      
      // Now deregister
      await aiNodeGovernance.connect(nodeOwner1).deregisterNode();
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.isActive).to.be.false;
    });
  });

  describe("Node Activity and Reputation", function () {
    beforeEach(async function () {
      // Register nodeOwner1 as a governance node
      await dloopToken.connect(nodeOwner1).approve(
        aiNodeGovernance.address, 
        ethers.utils.parseEther("100000")
      );
      
      await aiNodeGovernance.connect(nodeOwner1).registerNode(
        NodeType.GovernanceNode,
        ethers.utils.parseEther("20000")
      );
    });

    it("Should record node activity", async function () {
      // Get initial last activity timestamp
      const initialNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      const initialTimestamp = initialNodeDetails.lastActivity;
      
      // Advance time
      await time.increase(5 * 24 * 60 * 60); // 5 days
      
      // Record activity
      await aiNodeGovernance.connect(nodeOwner1).recordNodeActivity(nodeOwner1.address);
      
      // Check updated timestamp
      const updatedNodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(updatedNodeDetails.lastActivity).to.be.gt(initialTimestamp);
    });

    it("Should allow governance to update node reputation", async function () {
      await aiNodeGovernance.connect(admin).updateNodeReputation(
        nodeOwner1.address,
        500
      );
      
      const nodeDetails = await aiNodeGovernance.getNodeDetails(nodeOwner1.address);
      expect(nodeDetails.reputation).to.equal(500);
    });

    it("Should consider a node inactive after inactivity threshold", async function () {
      // Advance time past inactivity threshold
      await time.increase(31 * 24 * 60 * 60); // 31 days
      
      expect(await aiNodeGovernance.isNodeActive(nodeOwner1.address)).to.be.false;
      
      // Record activity to make active again
      await aiNodeGovernance.connect(nodeOwner1).recordNodeActivity(nodeOwner1.address);
      
      expect(await aiNodeGovernance.isNodeActive(nodeOwner1.address)).to.be.true;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update parameters", async function () {
      await aiNodeGovernance.connect(admin).updateParameters(
        ethers.utils.parseEther("15000"), // minNodeStake
        ethers.utils.parseEther("200"),   // minDelegationAmount
        14 * 24 * 60 * 60,                // delegationCooldown (14 days)
        45 * 24 * 60 * 60                 // inactivityThreshold (45 days)
      );
      
      expect(await aiNodeGovernance.minNodeStake()).to.equal(ethers.utils.parseEther("15000"));
      expect(await aiNodeGovernance.minDelegationAmount()).to.equal(ethers.utils.parseEther("200"));
      expect(await aiNodeGovernance.delegationCooldown()).to.equal(14 * 24 * 60 * 60);
      expect(await aiNodeGovernance.inactivityThreshold()).to.equal(45 * 24 * 60 * 60);
    });

    it("Should allow admin to set AINodeRegistry", async function () {
      const newRegistry = await ethers.getContractFactory("AINodeRegistry").then(f => 
        f.deploy(ZERO_ADDRESS, admin.address)
      );
      await newRegistry.deployed();
      
      await aiNodeGovernance.connect(admin).setAINodeRegistry(newRegistry.address);
      
      expect(await aiNodeGovernance.aiNodeRegistry()).to.equal(newRegistry.address);
    });
  });
});
