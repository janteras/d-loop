const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AINodeRegistry", function () {
  let SoulboundNFT, AINodeRegistry;
  let soulboundNFT, aiNodeRegistry;
  let owner, aiNode1, aiNode2, regularUser, governance;
  
  const MODEL_ID = "GPT-4-FINANCE";
  const VERIFICATION_PROOF = "PROOF_HASH_1";
  
  beforeEach(async function () {
    [owner, aiNode1, aiNode2, regularUser, governance] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Grant MINTER_ROLE to AINodeRegistry
    await soulboundNFT.grantRole(
      await soulboundNFT.MINTER_ROLE(),
      aiNodeRegistry.address
    );
    
    // Grant GOVERNANCE_ROLE to governance account
    await aiNodeRegistry.grantRole(
      await aiNodeRegistry.GOVERNANCE_ROLE(),
      governance.address
    );
  });
  
  describe("Node Registration", function () {
    it("should register an AI node successfully", async function () {
      const tx = await aiNodeRegistry.connect(governance).registerNode(
        aiNode1.address,
        MODEL_ID,
        VERIFICATION_PROOF
      );
      
      // Get tokenId from transaction receipt
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'NodeRegistered');
      const tokenId = event.args.tokenId;
      
      // Check token ownership
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(aiNode1.address);
      
      // Check if node is active
      expect(await aiNodeRegistry.isActiveAINode(aiNode1.address)).to.be.true;
    });
    
    it("should prevent non-governance accounts from registering nodes", async function () {
      await expect(
        aiNodeRegistry.connect(regularUser).registerNode(
          aiNode2.address,
          MODEL_ID,
          VERIFICATION_PROOF
        )
      ).to.be.revertedWith("AccessControl: account");
    });
  });
  
  describe("Node Verification", function () {
    beforeEach(async function () {
      // Register AI nodes
      await aiNodeRegistry.connect(governance).registerNode(
        aiNode1.address,
        MODEL_ID,
        VERIFICATION_PROOF
      );
    });
    
    it("should detect active AI nodes correctly", async function () {
      // Check active status
      expect(await aiNodeRegistry.isActiveAINode(aiNode1.address)).to.be.true;
      expect(await aiNodeRegistry.isActiveAINode(regularUser.address)).to.be.false;
    });
    
    it("should update verification interval", async function () {
      const newInterval = 60 * 60 * 24 * 14; // 14 days
      
      await aiNodeRegistry.connect(governance).setVerificationInterval(newInterval);
      
      expect(await aiNodeRegistry.verificationInterval()).to.equal(newInterval);
    });
    
    it("should prevent non-governance accounts from updating verification interval", async function () {
      const newInterval = 60 * 60 * 24 * 14; // 14 days
      
      await expect(
        aiNodeRegistry.connect(regularUser).setVerificationInterval(newInterval)
      ).to.be.revertedWith("AccessControl: account");
    });
  });
});