/**
 * AINodeRegistry SoulboundNFT Integration Test (Ethers v6 compatible)
 * 
 * This test file is specifically designed to work with Ethers v6 without compatibility shims.
 * It validates the integration between AINodeRegistry and SoulboundNFT.
 */

const { expect } = require("chai");
const hre = require("hardhat");

// Helper function for parsing units in Ethers v6
function parseUnits(value, decimals = 18) {
  const multiplier = BigInt(10) ** BigInt(decimals);
  const valueInteger = BigInt(Math.floor(Number(value)));
  const fractionalPart = value.toString().includes('.') ? 
    value.toString().split('.')[1] : '';
  
  if (!fractionalPart) return valueInteger * multiplier;
  
  const fractionalValue = BigInt(fractionalPart.padEnd(decimals, '0').slice(0, decimals));
  return valueInteger * multiplier + fractionalValue;
}

describe("AINodeRegistry SoulboundNFT Integration (Ethers v6)", function() {
  let owner, admin, user1, user2;
  let soulboundNFT, registry, mockToken;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  beforeEach(async function() {
    // Get signers directly (hardhat provides them through global ethers variable)
    const provider = hre.network.provider;
    
    // Create signers with known addresses
    owner = new hre.ethers.JsonRpcSigner(provider, "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    admin = new hre.ethers.JsonRpcSigner(provider, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    user1 = new hre.ethers.JsonRpcSigner(provider, "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
    user2 = new hre.ethers.JsonRpcSigner(provider, "0x90F79bf6EB2c4f870365E785982E1f101E93b906");
    
    console.log("Got signers:", 
      owner.address,
      admin.address,
      user1.address,
      user2.address
    );
    
    try {
      // Deploy SoulboundNFT first
      const SoulboundNFT = await hre.ethers.getContractFactory("SoulboundNFT");
      soulboundNFT = await SoulboundNFT.deploy(admin.address);
      await soulboundNFT.waitForDeployment();
      const soulboundNFTAddress = await soulboundNFT.getAddress();
      
      console.log("SoulboundNFT deployed to:", soulboundNFTAddress);
      
      // Deploy a mock token for staking
      const MockToken = await hre.ethers.getContractFactory("MockERC20");
      mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
      await mockToken.waitForDeployment();
      const mockTokenAddress = await mockToken.getAddress();
      
      console.log("MockToken deployed to:", mockTokenAddress);
      
      // Mint some tokens to users
      const amount = parseUnits("1000", 18);
      await mockToken.mint(user1.address, amount);
      await mockToken.mint(user2.address, amount);
      
      console.log("Minted tokens to users");
      
      // Deploy AINodeRegistry
      const AINodeRegistry = await hre.ethers.getContractFactory("AINodeRegistry");
      registry = await AINodeRegistry.deploy(admin.address, ZERO_ADDRESS, soulboundNFTAddress);
      await registry.waitForDeployment();
      const registryAddress = await registry.getAddress();
      
      console.log("AINodeRegistry deployed to:", registryAddress);
      
      // Create a token requirement
      const requirementAmount = parseUnits("100", 18);
      await registry.connect(admin).setTokenRequirement(1, mockTokenAddress, requirementAmount, true);
      
      console.log("Token requirement set");
      
      // Approve registry to spend user tokens
      const approvalAmount = parseUnits("1000", 18);
      await mockToken.connect(user1).approve(registryAddress, approvalAmount);
      await mockToken.connect(user2).approve(registryAddress, approvalAmount);
      
      console.log("Token approvals granted");
    } catch (error) {
      console.error("Error in test setup:", error);
      throw error;
    }
  });
  
  it("should mint a SoulboundNFT when registering a node via admin", async function() {
    try {
      // Register a node via admin
      const nodeAddress = "0x1111111111111111111111111111111111111111";
      const metadata = "ipfs://node-metadata-1";
      
      const registryAddress = await registry.getAddress();
      console.log("Registering node with registry at:", registryAddress);
      
      const tx = await registry.connect(admin).registerNode(nodeAddress, user1.address, metadata);
      await tx.wait();
      
      console.log("Node registered via admin");
      
      // Check node details
      const nodeDetails = await registry.getNodeDetails(nodeAddress);
      console.log("Node details:", nodeDetails);
      
      expect(nodeDetails.nodeOwner).to.equal(user1.address);
      expect(nodeDetails.metadata).to.equal(metadata);
      expect(nodeDetails.soulboundTokenId).to.be.greaterThan(0);
      
      // Check SoulboundNFT details
      const tokenId = nodeDetails.soulboundTokenId;
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      
      console.log("Token details:", tokenDetails);
      
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
      
      await registry.connect(admin).registerNode(nodeAddress, user1.address, metadata);
      console.log("Node registered for deregistration test");
      
      // Get the token ID
      const nodeDetails = await registry.getNodeDetails(nodeAddress);
      const tokenId = nodeDetails.soulboundTokenId;
      console.log("SoulboundNFT ID before deregistration:", tokenId);
      
      // Deregister the node
      const tx = await registry.connect(user1).deregisterNodeWithRefund();
      await tx.wait();
      console.log("Node deregistered");
      
      // Check that NFT was burned
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      console.log("Token details after deregistration:", tokenDetails);
      
      expect(tokenDetails.revoked).to.be.true;
    } catch (error) {
      console.error("Deregistration test error:", error);
      throw error;
    }
  });
});