/**
 * @title AINodeRegistry Basic Approval Test
 * @dev Simplified test structure for AINodeRegistry approval flow
 */
// First include the enhanced ethers shim for compatibility
const enhancedEthers = require("./ethers-v6-shim.js");
const { expect } = require("chai");
const hardhat = require("hardhat");
// Use our enhanced ethers to ensure compatibility
const ethers = enhancedEthers;
const { ZERO_ADDRESS } = require("../helpers/TestHelper");

// Helper function for gas measurement
async function measureGas(tx) {
  const receipt = await (await tx).wait();
  return receipt.gasUsed;
}

describe("AINodeRegistry Basic Approval Test", function() {
  let owner, admin, nodeOperator1, nodeOperator2, unauthorized;
  let dloopToken, aiNodeRegistry;
  
  // Test constants
  const NODE_METADATA = "ipfs://QmHash123456";
  // Use string value instead of parseEther to avoid utils dependency
  const MIN_NODE_STAKE = "1000000000000000000000"; // 1000 tokens with 18 decimals
  
  beforeEach(async function() {
    // Get signers safely using hardhat ethers
    const signers = await ethers.getSigners();
    owner = signers[0];
    admin = signers[1];
    nodeOperator1 = signers[2];
    nodeOperator2 = signers[3];
    unauthorized = signers[4];
    
    // Deploy mock token
    const TokenFactory = await ethers.getContractFactory("MockToken");
    dloopToken = await TokenFactory.deploy("DLoop Token", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    
    // Mint tokens for testing
    await dloopToken.mint(nodeOperator1.address, "2000000000000000000000"); // 2000 tokens
    await dloopToken.mint(nodeOperator2.address, "2000000000000000000000"); // 2000 tokens
    
    // Deploy a mock SoulboundNFT for testing
    const SoulboundNFTFactory = await ethers.getContractFactory("SoulboundNFT");
    const mockSoulboundNFT = await SoulboundNFTFactory.deploy(admin.address);
    await mockSoulboundNFT.waitForDeployment();
    
    // Deploy AINodeRegistry with the required three parameters
    const AINodeRegistryFactory = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistryFactory.deploy(admin.address, ZERO_ADDRESS, mockSoulboundNFT.address);
    await aiNodeRegistry.waitForDeployment();
  });
  
  describe("Node Registration Basic Functionality", function() {
    it("should register a node when called by admin", async function() {
      // Register node
      await aiNodeRegistry.connect(admin).registerNode(
        nodeOperator1.address,
        nodeOperator1.address,
        NODE_METADATA
      );
      
      // Check node details
      const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.nodeOwner).to.equal(nodeOperator1.address);
      expect(nodeDetails.metadata).to.equal(NODE_METADATA);
    });
    
    it("should not register a node when called by non-admin", async function() {
      // Attempt to register by unauthorized user
      await expect(
        aiNodeRegistry.connect(unauthorized).registerNode(
          nodeOperator1.address,
          nodeOperator1.address,
          NODE_METADATA
        )
      ).to.be.reverted;
    });
    
    it("should not register a node at address zero", async function() {
      // Attempt to register with address zero
      await expect(
        aiNodeRegistry.connect(admin).registerNode(
          ZERO_ADDRESS,
          nodeOperator1.address,
          NODE_METADATA
        )
      ).to.be.revertedWith("ZeroAddress");
    });
    
    it("should not register a node with owner address zero", async function() {
      // Attempt to register with owner address zero
      await expect(
        aiNodeRegistry.connect(admin).registerNode(
          nodeOperator1.address,
          ZERO_ADDRESS,
          NODE_METADATA
        )
      ).to.be.revertedWith("ZeroAddress");
    });
    
    it("should not register the same node twice", async function() {
      // First registration should succeed
      await aiNodeRegistry.connect(admin).registerNode(
        nodeOperator1.address,
        nodeOperator1.address,
        NODE_METADATA
      );
      
      // Second registration should fail
      await expect(
        aiNodeRegistry.connect(admin).registerNode(
          nodeOperator1.address,
          nodeOperator1.address,
          NODE_METADATA
        )
      ).to.be.revertedWith("NodeAlreadyRegistered");
    });
  });
  
  describe("Node State Management", function() {
    beforeEach(async function() {
      // Register node for state management tests
      await aiNodeRegistry.connect(admin).registerNode(
        nodeOperator1.address,
        nodeOperator1.address,
        NODE_METADATA
      );
    });
    
    it("should update node state when called by governance", async function() {
      // First set the governance contract to admin for testing
      await aiNodeRegistry.connect(owner).updateGovernanceContract(admin.address);
      
      // Admin can now update state as governance
      await aiNodeRegistry.connect(admin).updateNodeState(
        nodeOperator1.address,
        1 // Active state
      );
      
      const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.state).to.equal(1);
    });
    
    it("should not update state of non-existent node", async function() {
      // Set governance
      await aiNodeRegistry.connect(owner).updateGovernanceContract(admin.address);
      
      // Attempt to update non-existent node
      await expect(
        aiNodeRegistry.connect(admin).updateNodeState(
          nodeOperator2.address,
          1
        )
      ).to.be.revertedWith("NodeNotRegistered");
    });
  });
  
  describe("Node Query Functions", function() {
    beforeEach(async function() {
      // Register nodes for query tests
      await aiNodeRegistry.connect(admin).registerNode(
        nodeOperator1.address,
        nodeOperator1.address,
        NODE_METADATA
      );
      
      await aiNodeRegistry.connect(admin).registerNode(
        nodeOperator2.address,
        nodeOperator2.address,
        NODE_METADATA + "2"
      );
    });
    
    it("should return all registered node addresses", async function() {
      const addresses = await aiNodeRegistry.getAllNodeAddresses();
      expect(addresses.length).to.equal(2);
      expect(addresses).to.include(nodeOperator1.address);
      expect(addresses).to.include(nodeOperator2.address);
    });
    
    it("should return correct node count", async function() {
      const count = await aiNodeRegistry.getNodeCount();
      expect(count).to.equal(2);
    });
    
    it("should correctly check if node is active", async function() {
      const isActive = await aiNodeRegistry.isNodeActive(nodeOperator1.address);
      expect(isActive).to.be.true;
      
      // Set governance
      await aiNodeRegistry.connect(owner).updateGovernanceContract(admin.address);
      
      // Set node to inactive (0)
      await aiNodeRegistry.connect(admin).updateNodeState(
        nodeOperator1.address,
        0 // Inactive state
      );
      
      const isActiveAfterUpdate = await aiNodeRegistry.isNodeActive(nodeOperator1.address);
      expect(isActiveAfterUpdate).to.be.false;
    });
    
    it("should return false for isNodeActive on non-existent node", async function() {
      const isActive = await aiNodeRegistry.isNodeActive(unauthorized.address);
      expect(isActive).to.be.false;
    });
  });
  
  describe("Admin Functions", function() {
    it("should update admin address when called by owner", async function() {
      await aiNodeRegistry.connect(owner).updateAdmin(nodeOperator1.address);
      expect(await aiNodeRegistry.admin()).to.equal(nodeOperator1.address);
    });
    
    it("should update governance contract when called by owner", async function() {
      await aiNodeRegistry.connect(owner).updateGovernanceContract(nodeOperator1.address);
      expect(await aiNodeRegistry.governanceContract()).to.equal(nodeOperator1.address);
    });
    
    it("should transfer ownership when called by owner", async function() {
      await aiNodeRegistry.connect(owner).transferOwnership(nodeOperator1.address);
      expect(await aiNodeRegistry.owner()).to.equal(nodeOperator1.address);
    });
    
    it("should not update admin when called by non-owner", async function() {
      await expect(
        aiNodeRegistry.connect(unauthorized).updateAdmin(nodeOperator1.address)
      ).to.be.reverted;
    });
  });
  
  describe("Gas Efficiency", function() {
    it("should have acceptable gas usage for node registration", async function() {
      const gas = await measureGas(
        aiNodeRegistry.connect(admin).registerNode(
          nodeOperator1.address,
          nodeOperator1.address,
          NODE_METADATA
        )
      );
      
      console.log(`Gas used for node registration: ${gas}`);
      // We expect node registration to use reasonable gas (under 200,000)
      expect(gas).to.be.lessThan(200000);
    });
  });
});