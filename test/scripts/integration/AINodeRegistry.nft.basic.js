/**
 * @title AINodeRegistry SoulboundNFT Basic Integration Test
 * @dev Tests the basic integration between AINodeRegistry and SoulboundNFT
 */

// First require chai for expect assertions
const { expect } = require("chai");

// Import our utilities for ethers compatibility
const {
  ethers,
  safeParseEther,
  safeGetSigners,
  safeGetContractFactory,
  getContractAddress
} = require("../utils/ethers-helpers");

// Define a global reference to the BigInt version of 10^18 for ether conversion
const ETHER_BASE = 10n ** 18n;

// Log setup information
console.log("AINodeRegistry NFT Basic Integration Test - Setup");
console.log("Using ethers-helpers utility module");
console.log("Ethers loaded:", !!ethers);

describe("AINodeRegistry SoulboundNFT Integration", function() {
  let nodeRegistry;
  let soulboundNFT;
  let mockToken;
  let admin, governance, operator1, operator2, user;
  let STAKE_AMOUNT;
  
  before(async function() {
    // Initialize STAKE_AMOUNT after ethers is available
    STAKE_AMOUNT = safeParseEther("100");
  });
  
  beforeEach(async function() {
    console.log("Setting up test environment for each test...");
    
    // Get signers using our safe function
    try {
      const signers = await safeGetSigners();
      [admin, governance, operator1, operator2, user] = signers;
      console.log("Test accounts obtained successfully");
    } catch (e) {
      console.error("Signer retrieval failed:", e.message);
      throw e;
    }
    
    // Deploy mock token using our safe function
    try {
      console.log("Deploying MockToken...");
      const MockToken = await safeGetContractFactory("MockToken");
      // Pass the required constructor parameters: name, symbol, decimals
      mockToken = await MockToken.deploy("DLOOP Test Token", "DTEST", 18);
      await mockToken.waitForDeployment();
      console.log("MockToken deployed successfully");
    } catch (e) {
      console.error("MockToken deployment failed:", e.message);
      throw e;
    }
    
    // Deploy SoulboundNFT using our safe function
    try {
      console.log("Deploying SoulboundNFT...");
      const SoulboundNFT = await safeGetContractFactory("SoulboundNFT");
      soulboundNFT = await SoulboundNFT.deploy(admin.address);
      await soulboundNFT.waitForDeployment();
      console.log("SoulboundNFT deployed successfully");
    } catch (e) {
      console.error("SoulboundNFT deployment failed:", e.message);
      throw e;
    }
    
    // Deploy AINodeRegistry using our safe function
    try {
      console.log("Deploying AINodeRegistry...");
      const AINodeRegistry = await safeGetContractFactory("AINodeRegistry");
      
      // Get SoulboundNFT address safely
      const soulboundNFTAddress = soulboundNFT.target || soulboundNFT.address || 
        (typeof soulboundNFT.getAddress === 'function' ? await soulboundNFT.getAddress() : null);
      
      if (!soulboundNFTAddress) {
        throw new Error("Could not determine SoulboundNFT address");
      }
      
      nodeRegistry = await AINodeRegistry.deploy(
        admin.address, 
        governance.address, 
        soulboundNFTAddress
      );
      await nodeRegistry.waitForDeployment();
      console.log("AINodeRegistry deployed successfully");
    } catch (e) {
      console.error("AINodeRegistry deployment failed:", e.message);
      throw e;
    }
    
    // Get contract addresses safely (works with both v5 and v6)
    const nodeRegistryAddress = nodeRegistry.target || nodeRegistry.address;
    const mockTokenAddress = mockToken.target || mockToken.address;
    
    // Grant minter role to node registry
    await soulboundNFT.connect(admin).grantMinterRole(nodeRegistryAddress);
    
    // Mint tokens for operators
    await mockToken.mint(operator1.address, STAKE_AMOUNT);
    await mockToken.mint(operator2.address, STAKE_AMOUNT);
    
    // Approve token spending
    await mockToken.connect(operator1).approve(nodeRegistryAddress, STAKE_AMOUNT);
    await mockToken.connect(operator2).approve(nodeRegistryAddress, STAKE_AMOUNT);
  });
  
  describe("Node Registration with NFT Minting", function() {
    it("should mint an NFT when registering a node", async function() {
      const nodeType = 1; // Assumes node type 1 is valid
      const endpoint = "https://node1.example.com";
      
      // Register node
      await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        nodeType,
        endpoint,
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Check if operator has a valid NFT
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
      
      // Get token ID (assuming first token is ID 1)
      const tokenId = 1;
      const details = await soulboundNFT.getTokenDetails(tokenId);
      
      // Verify token details
      expect(details[0]).to.equal(operator1.address); // owner
      expect(details[3]).to.be.false; // not revoked
    });
    
    it("should burn the NFT when deregistering a node", async function() {
      const nodeType = 1;
      const endpoint = "https://node1.example.com";
      
      // Register node
      await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        nodeType,
        endpoint,
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Verify NFT exists
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
      
      // Deregister node
      await nodeRegistry.connect(admin).deregisterNode(operator1.address);
      
      // Verify NFT is no longer valid
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.false;
      
      // Token should be revoked but still exist (soulbound)
      const tokenId = 1;
      const details = await soulboundNFT.getTokenDetails(tokenId);
      expect(details[0]).to.equal(operator1.address); // still owned by operator
      expect(details[3]).to.be.true; // revoked
    });
  });
  
  describe("Multiple Nodes and NFTs", function() {
    it("should correctly handle multiple node registrations", async function() {
      // Register node 1
      await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        1,
        "https://node1.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Register node 2
      await nodeRegistry.connect(admin).registerNode(
        operator2.address,
        1,
        "https://node2.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Verify both operators have valid NFTs
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
      expect(await soulboundNFT.hasValidToken(operator2.address)).to.be.true;
      
      // Deregister node 1
      await nodeRegistry.connect(admin).deregisterNode(operator1.address);
      
      // Verify only node 1's NFT is revoked
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.false;
      expect(await soulboundNFT.hasValidToken(operator2.address)).to.be.true;
    });
  });
});