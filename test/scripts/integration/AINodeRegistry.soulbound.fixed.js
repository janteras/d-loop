/**
 * @title AINodeRegistry and SoulboundNFT Integration Test (Fixed)
 * @dev Tests integration between AINodeRegistry and SoulboundNFT contracts with Ethers v6 compatibility
 */

// Include enhanced compatibility shim
require('../../utils/ethers-v6-compat.js');
const { expect } = require('chai');

describe("AINodeRegistry SoulboundNFT Integration", function() {
  // Define test variables
  let owner, admin, user1, user2;
  let soulboundNFT, registry, mockToken;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  beforeEach(async function() {
    // Get signers
    [owner, admin, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT first
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Deploy a mock token for staking
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    await mockToken.waitForDeployment();
    
    // Mint some tokens to users
    await mockToken.mint(user1.address, ethers.parseUnits("1000", 18));
    await mockToken.mint(user2.address, ethers.parseUnits("1000", 18));
    
    // Get contract addresses
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    const mockTokenAddress = await mockToken.getAddress();
    
    // Deploy AINodeRegistry with correct parameters
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    registry = await AINodeRegistry.deploy(admin.address, ZERO_ADDRESS, soulboundNFTAddress);
    await registry.waitForDeployment();
    
    // Get registry address
    const registryAddress = await registry.getAddress();
    
    // Grant minter role to registry in SoulboundNFT
    await soulboundNFT.connect(admin).grantMinterRole(registryAddress);
    
    // Create a token requirement
    await registry.connect(admin).setTokenRequirement(1, mockTokenAddress, ethers.parseUnits("100", 18), true);
    
    // Approve registry to spend user tokens
    await mockToken.connect(user1).approve(registryAddress, ethers.parseUnits("1000", 18));
    await mockToken.connect(user2).approve(registryAddress, ethers.parseUnits("1000", 18));
  });
  
  describe("Node Registration and Soulbound NFT Minting", function() {
    it("should mint a SoulboundNFT when registering a node", async function() {
      // Register user1 as a node
      const nodeName = "Test Node 1";
      const nodeEndpoint = "https://test-node-1.example.com";
      const nodeDescription = "Test node for integration testing";
      
      // Check token balance before registration
      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(ethers.parseUnits("1000", 18));
      
      // Register the node (will stake tokens)
      const tx = await registry.connect(user1).registerNode(
        nodeName,
        nodeEndpoint,
        nodeDescription,
        1, // tier level (requires 100 tokens)
        { gasLimit: 1000000 } // Add gas limit to avoid estimation issues
      );
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get node ID from events
      let nodeId;
      let tokenId;
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = registry.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'NodeRegistered') {
            nodeId = parsedLog.args.nodeId;
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      expect(nodeId).to.not.be.undefined;
      
      // Verify that tokens were staked
      const newUser1Balance = await mockToken.balanceOf(user1.address);
      expect(newUser1Balance).to.equal(user1Balance - ethers.parseUnits("100", 18));
      
      // Check if NFT was minted by looking at node details
      const nodeDetails = await registry.getNodeDetails(nodeId);
      tokenId = nodeDetails.tokenId;
      expect(tokenId).to.not.equal(0); // token ID should be non-zero
      
      // Verify NFT ownership
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner).to.equal(user1.address);
      
      // Verify token details in SoulboundNFT
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[0]).to.equal(user1.address); // owner
      expect(tokenDetails[3]).to.be.false; // not revoked
    });
    
    it("should revoke the SoulboundNFT when deregistering a node", async function() {
      // First register user2 as a node
      const nodeName = "Test Node 2";
      const nodeEndpoint = "https://test-node-2.example.com";
      const nodeDescription = "Another test node for integration testing";
      
      // Register the node
      const tx = await registry.connect(user2).registerNode(
        nodeName,
        nodeEndpoint,
        nodeDescription,
        1, // tier level
        { gasLimit: 1000000 } // Add gas limit to avoid estimation issues
      );
      
      const receipt = await tx.wait();
      
      // Get node ID from events
      let nodeId;
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = registry.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'NodeRegistered') {
            nodeId = parsedLog.args.nodeId;
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      expect(nodeId).to.not.be.undefined;
      
      // Get token ID from node details
      const nodeDetails = await registry.getNodeDetails(nodeId);
      const tokenId = nodeDetails.tokenId;
      expect(tokenId).to.not.equal(0);
      
      // Check NFT status before deregistration
      let tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[3]).to.be.false; // should not be revoked initially
      
      // Now deregister the node
      await registry.connect(user2).deregisterNode(nodeId, { gasLimit: 1000000 });
      
      // Check that NFT is now revoked
      tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[3]).to.be.true; // should be revoked after deregistration
      
      // Verify that token ownership is maintained even after revocation
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner).to.equal(user2.address);
    });
    
    it("should revert if trying to transfer a soulbound NFT", async function() {
      // Register user1 as a node to get an NFT
      const tx = await registry.connect(user1).registerNode(
        "Transfer Test Node",
        "https://transfer-test.example.com",
        "Node to test NFT transfer restrictions",
        1,
        { gasLimit: 1000000 }
      );
      
      const receipt = await tx.wait();
      
      // Get node ID and token ID
      let nodeId;
      for (const log of receipt.logs) {
        try {
          const parsedLog = registry.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'NodeRegistered') {
            nodeId = parsedLog.args.nodeId;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      const nodeDetails = await registry.getNodeDetails(nodeId);
      const tokenId = nodeDetails.tokenId;
      
      // Attempt to transfer the token - should revert
      await expect(
        soulboundNFT.connect(user1).transferFrom(user1.address, user2.address, tokenId)
      ).to.be.revertedWithCustomError(soulboundNFT, "SoulboundTokenNonTransferable");
    });
  });
  
  describe("Admin Operations", function() {
    it("should allow admin to revoke a node's NFT", async function() {
      // Register user1 as a node
      const tx = await registry.connect(user1).registerNode(
        "Admin Test Node",
        "https://admin-test.example.com",
        "Node to test admin operations",
        1,
        { gasLimit: 1000000 }
      );
      
      const receipt = await tx.wait();
      
      // Get node ID
      let nodeId;
      for (const log of receipt.logs) {
        try {
          const parsedLog = registry.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'NodeRegistered') {
            nodeId = parsedLog.args.nodeId;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Get token ID from node details
      const nodeDetails = await registry.getNodeDetails(nodeId);
      const tokenId = nodeDetails.tokenId;
      
      // Admin directly revokes the token using SoulboundNFT contract
      await soulboundNFT.connect(admin).revoke(tokenId);
      
      // Verify token is revoked
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[3]).to.be.true; // revoked
      
      // Node should be marked as inactive in registry
      const updatedNodeDetails = await registry.getNodeDetails(nodeId);
      expect(updatedNodeDetails.active).to.be.false;
    });
  });
});