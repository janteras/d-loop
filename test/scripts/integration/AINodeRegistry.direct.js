/**
 * AINodeRegistry and SoulboundNFT Integration Test with Direct Ethers v6
 * 
 * This test file uses direct Ethers v6 integration without relying on Hardhat's provider
 * to overcome compatibility issues. It validates the integration between AINodeRegistry
 * and SoulboundNFT contracts.
 */

// Import our direct ethers helpers
const directEthers = require('../utils/direct-ethers');
const { expect } = require('chai');

// Direct access to ethers
const { ethers } = directEthers;

describe('AINodeRegistry SoulboundNFT Direct Integration', function () {
  // Test accounts
  let owner, admin, user;
  
  // Contract instances
  let soulboundNFT, aiNodeRegistry, mockToken;
  
  // Constants
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  // Test data
  const nodeData = {
    name: "Test Node",
    endpoint: "https://test-node.example.com",
    capacity: 100,
    certificateExpiry: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    location: "Test Location",
    specifications: "Test Specifications",
    joinedTimestamp: Math.floor(Date.now() / 1000)
  };

  before(async function() {
    console.log("Setting up AINodeRegistry and SoulboundNFT direct integration test...");
    
    // Get signers
    const signers = await directEthers.getSigners();
    [owner, admin, user] = signers;
    
    console.log("Test accounts:");
    console.log(`- Owner: ${owner.address}`);
    console.log(`- Admin: ${admin.address}`);
    console.log(`- User: ${user.address}`);
    
    // Deploy SoulboundNFT
    console.log("Deploying SoulboundNFT...");
    const SoulboundNFT = await directEthers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address); // Only needs admin address
    
    // Deploy MockToken for testing
    console.log("Deploying MockToken...");
    const MockToken = await directEthers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("DLOOP Test Token", "DTEST", 18);
    
    // Deploy AINodeRegistry
    console.log("Deploying AINodeRegistry...");
    const AINodeRegistry = await directEthers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      admin.address,                // admin address
      mockToken.target,             // governance contract (token address)
      soulboundNFT.target           // soulbound NFT address
    );
    
    // Grant MINTER_ROLE to AINodeRegistry
    console.log("Granting MINTER_ROLE to AINodeRegistry...");
    const grantRoleTx = await soulboundNFT.grantRole(MINTER_ROLE, aiNodeRegistry.target);
    await grantRoleTx.wait();
    
    // Verify roles
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, aiNodeRegistry.target);
    console.log(`AINodeRegistry has MINTER_ROLE: ${hasMinterRole}`);
    
    // Connect contracts to admin signer
    soulboundNFT = soulboundNFT.connect(admin);
    aiNodeRegistry = aiNodeRegistry.connect(admin);
  });

  describe('Node Registration and SoulboundNFT Minting', function() {
    it('should mint a SoulboundNFT when registering a node via admin', async function() {
      // Connect as admin
      const adminConnectedRegistry = aiNodeRegistry.connect(admin);
      
      // Register a node
      console.log(`Registering node for user: ${user.address}...`);
      const tx = await adminConnectedRegistry.registerNodeByAdmin(
        user.address,
        nodeData.name,
        nodeData.endpoint,
        nodeData.capacity,
        nodeData.certificateExpiry,
        nodeData.location,
        nodeData.specifications
      );
      
      await tx.wait();
      
      // Check if node was registered
      const nodeInfo = await aiNodeRegistry.getNodeInfo(user.address);
      expect(nodeInfo.name).to.equal(nodeData.name);
      expect(nodeInfo.endpoint).to.equal(nodeData.endpoint);
      expect(nodeInfo.active).to.be.true;
      
      // Check if NFT was minted
      const tokenId = await soulboundNFT.tokenOfOwner(user.address);
      console.log(`Token ID minted: ${tokenId}`);
      expect(tokenId).to.be.gt(0); // Should be greater than 0
      
      // Verify token ownership
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner.toLowerCase()).to.equal(user.address.toLowerCase());
      
      console.log("Successfully registered node and minted SoulboundNFT");
    });
    
    it('should properly update node data', async function() {
      // Connect as admin
      const adminConnectedRegistry = aiNodeRegistry.connect(admin);
      
      // Update node data
      const updatedName = "Updated Node Name";
      const updatedEndpoint = "https://updated-endpoint.example.com";
      
      console.log("Updating node data...");
      const tx = await adminConnectedRegistry.updateNode(
        user.address,
        updatedName,
        updatedEndpoint,
        200, // increased capacity
        nodeData.certificateExpiry,
        "Updated Location",
        "Updated Specifications"
      );
      
      await tx.wait();
      
      // Verify updates
      const nodeInfo = await aiNodeRegistry.getNodeInfo(user.address);
      expect(nodeInfo.name).to.equal(updatedName);
      expect(nodeInfo.endpoint).to.equal(updatedEndpoint);
      expect(nodeInfo.capacity).to.equal(200);
      
      console.log("Successfully updated node data");
    });
  });
});