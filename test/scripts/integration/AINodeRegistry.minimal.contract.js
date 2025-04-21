/**
 * @title Minimal AINodeRegistry SoulboundNFT Integration Test
 * @dev Direct ethers-v6 compatible test with no dependencies
 */
const hre = require("hardhat");
const { expect } = require("chai");

// Explicitly import ethers from hardhat
const ethers = hre.ethers;

// Simple parseUnits implementation for ethers v6
function parseUnits(value, decimals = 18) {
  return BigInt(Math.floor(Number(value) * 10**Number(decimals)));
}

describe("AINodeRegistry SoulboundNFT Integration Minimal Test", function() {
  let owner, admin, user1, user2;
  let soulboundNFT, registry, mockToken;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  before(async function() {
    try {
      // Get all accounts explicitly
      const accounts = await ethers.getSigners();
      owner = accounts[0];
      admin = accounts[1];
      user1 = accounts[2];
      user2 = accounts[3];
      
      console.log("Owner address:", owner.address);
      console.log("Admin address:", admin.address);
      console.log("User1 address:", user1.address);
      console.log("User2 address:", user2.address);
      
      // Deploy SoulboundNFT first
      console.log("Deploying SoulboundNFT...");
      const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
      soulboundNFT = await SoulboundNFT.deploy(admin.address);
      await soulboundNFT.waitForDeployment(); 
      console.log("SoulboundNFT deployed at:", await soulboundNFT.getAddress());
      
      // Deploy a mock token for staking
      console.log("Deploying MockERC20...");
      const MockToken = await ethers.getContractFactory("MockERC20");
      mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
      await mockToken.waitForDeployment();
      console.log("MockToken deployed at:", await mockToken.getAddress());
      
      // Mint some tokens to users
      await mockToken.mint(user1.address, parseUnits("1000", 18));
      await mockToken.mint(user2.address, parseUnits("1000", 18));
      
      // Deploy AINodeRegistry
      console.log("Deploying AINodeRegistry...");
      const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
      registry = await AINodeRegistry.deploy(
        admin.address, 
        ZERO_ADDRESS, 
        await soulboundNFT.getAddress()
      );
      await registry.waitForDeployment();
      console.log("AINodeRegistry deployed at:", await registry.getAddress());
      
      // Create a token requirement
      await registry.connect(admin).setTokenRequirement(
        1, 
        await mockToken.getAddress(), 
        parseUnits("100", 18), 
        true
      );
      
      // Approve registry to spend user tokens
      await mockToken.connect(user1).approve(
        await registry.getAddress(), 
        parseUnits("1000", 18)
      );
      await mockToken.connect(user2).approve(
        await registry.getAddress(), 
        parseUnits("1000", 18)
      );
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  });
  
  it("should mint a SoulboundNFT when registering a node via admin", async function() {
    try {
      // Register a node via admin
      const nodeAddress = "0x1111111111111111111111111111111111111111";
      const metadata = "ipfs://node-metadata-1";
      
      console.log("Registering node...");
      const tx = await registry.connect(admin).registerNode(
        nodeAddress, 
        user1.address, 
        metadata
      );
      
      // Check node details
      const nodeDetails = await registry.getNodeDetails(nodeAddress);
      expect(nodeDetails.nodeOwner).to.equal(user1.address);
      expect(nodeDetails.metadata).to.equal(metadata);
      expect(nodeDetails.soulboundTokenId).to.be.above(0);
      
      // Check SoulboundNFT details
      const tokenId = nodeDetails.soulboundTokenId;
      console.log("Node registered with token ID:", tokenId);
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails.tokenOwner).to.equal(user1.address);
      expect(tokenDetails.tokenURI).to.equal(metadata);
      expect(tokenDetails.revoked).to.be.false;
    } catch (error) {
      console.error("Test error:", error);
      throw error;
    }
  });
  
  it("should burn the SoulboundNFT when deregistering a node", async function() {
    try {
      // Register a node first
      const nodeAddress = "0x5555555555555555555555555555555555555555";
      const metadata = "ipfs://node-metadata-5";
      
      console.log("Registering node for deregistration test...");
      await registry.connect(admin).registerNode(
        nodeAddress, 
        user1.address, 
        metadata
      );
      
      // Get the token ID
      const nodeDetails = await registry.getNodeDetails(nodeAddress);
      const tokenId = nodeDetails.soulboundTokenId;
      console.log("Node registered with token ID:", tokenId);
      
      // Deregister the node
      console.log("Deregistering node...");
      await registry.connect(user1).deregisterNodeWithRefund();
      
      // Check that NFT was burned
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails.revoked).to.be.true;
      console.log("NFT successfully burned (revoked)");
    } catch (error) {
      console.error("Test error:", error);
      throw error;
    }
  });
});