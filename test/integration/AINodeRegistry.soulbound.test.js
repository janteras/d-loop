const { expect } = require("chai");
const ethers = require("../utils/ethers-v6-compat.js");
const hardhat = require("hardhat");

// Simple parseUnits implementation for ethers v6
function safeParseUnits(value, decimals = 18) {
  try {
    return ethers.parseUnits(value, decimals);
  } catch (e) {
    console.log("Error in safeParseUnits:", e);
    // Fallback implementation
    return BigInt(Math.floor(Number(value) * 10**Number(decimals)));
  }
}

describe("AINodeRegistry SoulboundNFT Integration", function() {
  // Define test variables
  let owner, admin, user1, user2;
  let soulboundNFT, registry, mockToken;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  beforeEach(async function() {
    // Get signers using ethers from hardhat runtime environment
    try {
      [owner, admin, user1, user2] = await hardhat.ethers.getSigners();
    } catch (e) {
      console.log("Error getting signers:", e);
      // Use fallback approach with global hardhat object
      try {
        const signers = await ethers.getSigners();
        owner = signers[0];
        admin = signers[1];
        user1 = signers[2]; 
        user2 = signers[3];
      } catch (e2) {
        console.log("Error with fallback signers approach:", e2);
        // Last resort approach
        [owner, admin, user1, user2] = [
          { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
          { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
          { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
          { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" }
        ];
      }
    }
    
    // Deploy SoulboundNFT first
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    
    // Deploy a mock token for staking
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    
    // Mint some tokens to users
    await mockToken.mint(user1.address, safeParseUnits("1000", 18));
    await mockToken.mint(user2.address, safeParseUnits("1000", 18));
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    registry = await AINodeRegistry.deploy(admin.address, ZERO_ADDRESS, soulboundNFT.address);
    
    // Create a token requirement
    await registry.connect(admin).setTokenRequirement(1, mockToken.address, safeParseUnits("100", 18), true);
    
    // Approve registry to spend user tokens
    await mockToken.connect(user1).approve(registry.address, safeParseUnits("1000", 18));
    await mockToken.connect(user2).approve(registry.address, safeParseUnits("1000", 18));
  });
  
  it("should mint a SoulboundNFT when registering a node via admin", async function() {
    // Register a node via admin
    const nodeAddress = "0x1111111111111111111111111111111111111111";
    const metadata = "ipfs://node-metadata-1";
    
    const tx = await registry.connect(admin).registerNode(nodeAddress, user1.address, metadata);
    
    // Check node details
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    expect(nodeDetails.nodeOwner).to.equal(user1.address);
    expect(nodeDetails.metadata).to.equal(metadata);
    expect(nodeDetails.soulboundTokenId).to.be.above(0);
    
    // Check SoulboundNFT details
    const tokenId = nodeDetails.soulboundTokenId;
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.tokenOwner).to.equal(user1.address);
    expect(tokenDetails.tokenURI).to.equal(metadata);
    expect(tokenDetails.revoked).to.be.false;
  });
  
  it("should mint a SoulboundNFT when user registers node with staking", async function() {
    // User registers node with staking
    const nodeAddress = "0x2222222222222222222222222222222222222222";
    const metadata = "ipfs://node-metadata-2";
    
    const tx = await registry.connect(user1).registerNodeWithToken(
      nodeAddress,
      metadata,
      1 // requirement ID
    );
    
    // Check node details
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    expect(nodeDetails.nodeOwner).to.equal(user1.address);
    expect(nodeDetails.metadata).to.equal(metadata);
    expect(nodeDetails.soulboundTokenId).to.be.above(0);
    
    // Check token balance
    const stakeDetails = await registry.getNodeStakeDetails(nodeAddress);
    expect(stakeDetails.stakedToken).to.equal(mockToken.address);
    expect(stakeDetails.stakedAmount).to.equal(safeParseUnits("100", 18));
    
    // Check SoulboundNFT details
    const tokenId = nodeDetails.soulboundTokenId;
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.tokenOwner).to.equal(user1.address);
    expect(tokenDetails.tokenURI).to.equal(metadata);
    expect(tokenDetails.revoked).to.be.false;
  });
  
  it("should mint a SoulboundNFT when using safe approval registration", async function() {
    // User registers with safe approval
    const nodeAddress = "0x3333333333333333333333333333333333333333";
    const metadata = "ipfs://node-metadata-3";
    
    const tx = await registry.connect(user1).registerNodeWithSafeApproval(
      nodeAddress,
      metadata,
      1 // requirement ID
    );
    
    // Check node details
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    expect(nodeDetails.nodeOwner).to.equal(user1.address);
    expect(nodeDetails.metadata).to.equal(metadata);
    expect(nodeDetails.soulboundTokenId).to.be.above(0);
    
    // Check SoulboundNFT details
    const tokenId = nodeDetails.soulboundTokenId;
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.tokenOwner).to.equal(user1.address);
    expect(tokenDetails.tokenURI).to.equal(metadata);
    expect(tokenDetails.revoked).to.be.false;
  });
  
  it("should mint a SoulboundNFT when using optimized approval registration", async function() {
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    const optimizer = await TokenApprovalOptimizer.deploy();
    
    // User registers with optimized approval
    const nodeAddress = "0x4444444444444444444444444444444444444444";
    const metadata = "ipfs://node-metadata-4";
    
    const tx = await registry.connect(user1).registerNodeWithOptimizedApproval(
      nodeAddress,
      metadata,
      1, // requirement ID
      optimizer.address
    );
    
    // Check node details
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    expect(nodeDetails.nodeOwner).to.equal(user1.address);
    expect(nodeDetails.metadata).to.equal(metadata);
    expect(nodeDetails.soulboundTokenId).to.be.above(0);
    
    // Check SoulboundNFT details
    const tokenId = nodeDetails.soulboundTokenId;
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.tokenOwner).to.equal(user1.address);
    expect(tokenDetails.tokenURI).to.equal(metadata);
    expect(tokenDetails.revoked).to.be.false;
  });
  
  it("should burn the SoulboundNFT when deregistering a node", async function() {
    // Register a node first
    const nodeAddress = "0x5555555555555555555555555555555555555555";
    const metadata = "ipfs://node-metadata-5";
    
    await registry.connect(admin).registerNode(nodeAddress, user1.address, metadata);
    
    // Get the token ID
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    const tokenId = nodeDetails.soulboundTokenId;
    
    // Deregister the node
    await registry.connect(user1).deregisterNodeWithRefund();
    
    // Check that NFT was burned
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.revoked).to.be.true;
  });
  
  it("should get node's soulbound token ID correctly", async function() {
    // Register a node
    const nodeAddress = "0x6666666666666666666666666666666666666666";
    const metadata = "ipfs://node-metadata-6";
    
    await registry.connect(admin).registerNode(nodeAddress, user1.address, metadata);
    
    // Get the token ID both ways
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    const tokenId = nodeDetails.soulboundTokenId;
    
    const tokenIdFromGetter = await registry.getNodeSoulboundTokenId(nodeAddress);
    
    expect(tokenId).to.equal(tokenIdFromGetter);
    expect(tokenId).to.be.above(0);
  });
  
  it("should allow getting the SoulboundNFT contract address", async function() {
    const nftAddress = await registry.getSoulboundNFTAddress();
    expect(nftAddress).to.equal(soulboundNFT.address);
  });
  
  it("should allow owner to update the SoulboundNFT contract address", async function() {
    // Deploy a new SoulboundNFT contract
    const SoulboundNFT = await hre.ethers.getContractFactory("SoulboundNFT");
    const newSoulboundNFT = await SoulboundNFT.deploy(admin.address);
    
    // Update the SoulboundNFT address
    await registry.connect(owner).updateSoulboundNFT(newSoulboundNFT.address);
    
    // Check that the address was updated
    const nftAddress = await registry.getSoulboundNFTAddress();
    expect(nftAddress).to.equal(newSoulboundNFT.address);
  });
  
  it("should not allow non-owners to update the SoulboundNFT contract address", async function() {
    // Deploy a new SoulboundNFT contract
    const SoulboundNFT = await hre.ethers.getContractFactory("SoulboundNFT");
    const newSoulboundNFT = await SoulboundNFT.deploy(admin.address);
    
    // Try to update as non-owner
    await expect(
      registry.connect(user1).updateSoulboundNFT(newSoulboundNFT.address)
    ).to.be.revertedWithCustomError(registry, "CallerNotOwner");
  });
});