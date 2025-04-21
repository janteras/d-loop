/**
 * @title AINodeRegistry-SoulboundNFT Integration Test
 * @dev Tests the integration between AINodeRegistry and SoulboundNFT contracts
 *      focusing on node registration, identity management, and access control
 * @author DLOOP Protocol Team
 */

// Use the independent ethers v6 compatibility shim for maximum reliability
require('../../../../utils/test-init');
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { 
  safeGetSigners, 
  safeDeployContract, 
  safeParseEther, 
  safeFormatEther,
  safeConnect
} = require('../../../../utils/ethers-helpers');

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const NODE_NAME = "TestNode";
const NODE_DESCRIPTION = "Test Description";
const NODE_LOCATION = "Test Location";
const NODE_MODEL = "GPT-4";
const NODE_TYPE = 1; // Assuming 1 is a valid node type
const MIN_STAKE = safeParseEther("1.0");
const MODEL_HASH = "0x1234567890123456789012345678901234567890123456789012345678901234";

// Test suite
describe('AINodeRegistry SoulboundNFT Integration', function() {
  // Extend timeout for the entire test suite
  this.timeout(TEST_TIMEOUT);
  
  // Test variables
  let owner, admin, user1, user2;
  let soulboundNFT, aiNodeRegistry;
  
  // Set up test environment before tests
  before(async function() {
    console.log("Setting up AINodeRegistry and SoulboundNFT integration test...");
    
    try {
      // Get signers
      [owner, admin, user1, user2] = await safeGetSigners();
      
      console.log("Test accounts:");
      console.log(`- Owner: ${owner.address}`);
      console.log(`- Admin: ${admin.address}`);
      console.log(`- User1: ${user1.address}`);
      console.log(`- User2: ${user2.address}`);
      
      // Deploy SoulboundNFT
      console.log("Deploying SoulboundNFT...");
      soulboundNFT = await safeDeployContract("SoulboundNFT", ["DLOOP Identity", "DLOOP-ID", owner.address]);
      console.log(`SoulboundNFT deployed to: ${await soulboundNFT.getAddress()}`);
      
      // Grant minter role to admin
      const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
      await soulboundNFT.grantRole(MINTER_ROLE, admin.address);
      console.log(`Granted minter role to admin: ${admin.address}`);
      
      // Deploy AINodeRegistry
      console.log("Deploying AINodeRegistry...");
      aiNodeRegistry = await safeDeployContract(
        "AINodeRegistry", 
        [
          owner.address, 
          await soulboundNFT.getAddress(),
          MIN_STAKE
        ]
      );
      console.log(`AINodeRegistry deployed to: ${await aiNodeRegistry.getAddress()}`);
      
      // Grant minter role to AINodeRegistry
      await soulboundNFT.grantRole(MINTER_ROLE, await aiNodeRegistry.getAddress());
      console.log(`Granted minter role to AINodeRegistry: ${await aiNodeRegistry.getAddress()}`);
      
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });
  
  describe('Node Registration Flow', function() {
    it('should register a node when called by approved user', async function() {
      // Create a registration from user1
      const txResponse = await aiNodeRegistry.connect(safeConnect(user1, aiNodeRegistry)).registerNode(
        NODE_NAME,
        NODE_DESCRIPTION,
        NODE_LOCATION,
        NODE_MODEL,
        NODE_TYPE,
        MODEL_HASH,
        { value: MIN_STAKE }
      );
      
      // Wait for transaction to be mined
      const receipt = await txResponse.wait();
      
      // Get the node ID from the event
      const nodeRegisteredEvent = receipt.logs.find(
        log => log.topics[0] === ethers.id("NodeRegistered(uint256,address,string)")
      );
      
      expect(nodeRegisteredEvent).to.not.be.undefined;
      
      // Verify node was registered
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      expect(nodeId).to.not.equal(0, "Node ID should be non-zero");
      
      // Verify node details
      const nodeDetails = await aiNodeRegistry.getNodeById(nodeId);
      expect(nodeDetails.name).to.equal(NODE_NAME);
      expect(nodeDetails.description).to.equal(NODE_DESCRIPTION);
      expect(nodeDetails.location).to.equal(NODE_LOCATION);
      expect(nodeDetails.model).to.equal(NODE_MODEL);
      expect(nodeDetails.nodeType).to.equal(NODE_TYPE);
      
      // Verify SoulboundNFT was minted
      const tokenId = await soulboundNFT.tokenOfOwner(user1.address);
      expect(tokenId).to.not.equal(0, "Token ID should be non-zero");
      
      // Verify token ownership
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner).to.equal(user1.address);
      
      console.log(`Node registered with ID: ${nodeId}`);
      console.log(`SoulboundNFT minted with ID: ${tokenId}`);
    });
    
    it('should prevent duplicate node registration', async function() {
      // Attempt to register another node from the same user
      await expect(
        aiNodeRegistry.connect(safeConnect(user1, aiNodeRegistry)).registerNode(
          "Another Node",
          "Another Description",
          "Another Location",
          "GPT-5",
          NODE_TYPE,
          MODEL_HASH,
          { value: MIN_STAKE }
        )
      ).to.be.revertedWith("User already has a registered node");
    });
    
    it('should verify node active status', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      const isActive = await aiNodeRegistry.isNodeActive(nodeId);
      expect(isActive).to.be.true;
    });
  });
  
  describe('Node Update Flow', function() {
    it('should update node details', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      
      const NEW_DESCRIPTION = "Updated Description";
      const NEW_LOCATION = "Updated Location";
      const NEW_MODEL = "GPT-5";
      
      // Update node details
      await aiNodeRegistry.connect(safeConnect(user1, aiNodeRegistry)).updateNodeDetails(
        nodeId,
        NEW_DESCRIPTION,
        NEW_LOCATION,
        NEW_MODEL,
        MODEL_HASH
      );
      
      // Verify updated details
      const nodeDetails = await aiNodeRegistry.getNodeById(nodeId);
      expect(nodeDetails.description).to.equal(NEW_DESCRIPTION);
      expect(nodeDetails.location).to.equal(NEW_LOCATION);
      expect(nodeDetails.model).to.equal(NEW_MODEL);
    });
  });
  
  describe('Node Deactivation Flow', function() {
    it('should deactivate a node', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      
      // Deactivate node
      await aiNodeRegistry.connect(safeConnect(owner, aiNodeRegistry)).deactivateNode(nodeId);
      
      // Verify node status
      const isActive = await aiNodeRegistry.isNodeActive(nodeId);
      expect(isActive).to.be.false;
      
      // Verify SoulboundNFT status
      const tokenId = await soulboundNFT.tokenOfOwner(user1.address);
      const metadata = await soulboundNFT.getTokenMetadata(tokenId);
      expect(metadata.active).to.be.false;
    });
    
    it('should reactivate a node', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      
      // Reactivate node
      await aiNodeRegistry.connect(safeConnect(owner, aiNodeRegistry)).activateNode(nodeId);
      
      // Verify node status
      const isActive = await aiNodeRegistry.isNodeActive(nodeId);
      expect(isActive).to.be.true;
      
      // Verify SoulboundNFT status
      const tokenId = await soulboundNFT.tokenOfOwner(user1.address);
      const metadata = await soulboundNFT.getTokenMetadata(tokenId);
      expect(metadata.active).to.be.true;
    });
  });
  
  describe('Access Control Integration', function() {
    it('should properly enforce ownership checks', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      
      // Attempt to update node details from a different user
      await expect(
        aiNodeRegistry.connect(safeConnect(user2, aiNodeRegistry)).updateNodeDetails(
          nodeId,
          "Unauthorized Update",
          "Unauthorized Location",
          "Unauthorized Model",
          MODEL_HASH
        )
      ).to.be.revertedWith("Not the node owner");
    });
    
    it('should properly enforce admin role checks', async function() {
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user1.address);
      
      // Attempt to deactivate node from a non-admin
      await expect(
        aiNodeRegistry.connect(safeConnect(user2, aiNodeRegistry)).deactivateNode(nodeId)
      ).to.be.revertedWith("Caller is not an admin");
    });
  });
  
  describe('Token Revocation Flow', function() {
    it('should revoke token when node is completely removed', async function() {
      // Register a temporary node for user2
      await aiNodeRegistry.connect(safeConnect(user2, aiNodeRegistry)).registerNode(
        "Temporary Node",
        "Temporary Description",
        "Temporary Location",
        "GPT-3",
        NODE_TYPE,
        MODEL_HASH,
        { value: MIN_STAKE }
      );
      
      const nodeId = await aiNodeRegistry.getNodeIdByOwner(user2.address);
      const tokenId = await soulboundNFT.tokenOfOwner(user2.address);
      
      console.log(`Temporary node registered with ID: ${nodeId}`);
      console.log(`Temporary SoulboundNFT minted with ID: ${tokenId}`);
      
      // Verify token exists
      expect(await soulboundNFT.exists(tokenId)).to.be.true;
      
      // Remove node completely (this should revoke the token)
      await aiNodeRegistry.connect(safeConnect(owner, aiNodeRegistry)).removeNode(nodeId);
      
      // Allow time for the transaction to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify token no longer exists
      await expect(soulboundNFT.ownerOf(tokenId)).to.be.revertedWith("Token does not exist");
      
      console.log(`Node and token successfully removed`);
    });
  });
});