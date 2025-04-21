const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulboundNFT", function () {
  let SoulboundNFT;
  let soulboundNFT;
  let owner, user1, user2, minter, verifier;
  
  const MODEL_ID = "GPT-4-FINANCE";
  const VERIFICATION_PROOF = "PROOF_HASH_1";
  
  beforeEach(async function () {
    [owner, user1, user2, minter, verifier] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    
    // Grant roles
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), minter.address);
    await soulboundNFT.grantRole(await soulboundNFT.VERIFIER_ROLE(), verifier.address);
  });
  
  describe("Minting and Token Details", function () {
    it("should mint a new token correctly", async function () {
      // Mint a token
      const tx = await soulboundNFT.connect(minter).mintNodeIdentifier(
        user1.address,
        MODEL_ID,
        VERIFICATION_PROOF
      );
      
      // Get tokenId from transaction receipt
      const receipt = await tx.wait();
      const event = receipt.logs.filter(
        log => log.fragment && log.fragment.name === 'AINodeIdentified'
      )[0];
      const tokenId = event.args.tokenId;
      
      // Check token ownership
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(user1.address);
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(1);
      
      // Check token details
      const details = await soulboundNFT.getNodeDetails(tokenId);
      expect(details.aiModelIdentifier).to.equal(MODEL_ID);
      expect(details.verificationProof).to.equal(VERIFICATION_PROOF);
      expect(details.isActive).to.be.true;
    });
    
    it("should prevent non-minters from minting tokens", async function () {
      await expect(
        soulboundNFT.connect(user1).mintNodeIdentifier(
          user2.address,
          MODEL_ID,
          VERIFICATION_PROOF
        )
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
  });
  
  describe("Token Transfer Restrictions", function () {
    let tokenId;
    
    beforeEach(async function () {
      // Mint a token for testing
      const tx = await soulboundNFT.connect(minter).mintNodeIdentifier(
        user1.address,
        MODEL_ID,
        VERIFICATION_PROOF
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.filter(
        log => log.fragment && log.fragment.name === 'AINodeIdentified'
      )[0];
      tokenId = event.args.tokenId;
    });
    
    it("should prevent token transfers", async function () {
      await expect(
        soulboundNFT.connect(user1).transferFrom(
          user1.address,
          user2.address,
          tokenId
        )
      ).to.be.revertedWith("SoulboundNFT: tokens are non-transferable");
    });
    
    it("should prevent approved transfers", async function () {
      // Approve user2 to transfer the token
      await soulboundNFT.connect(user1).approve(user2.address, tokenId);
      
      // Try to transfer
      await expect(
        soulboundNFT.connect(user2).transferFrom(
          user1.address,
          user2.address,
          tokenId
        )
      ).to.be.revertedWith("SoulboundNFT: tokens are non-transferable");
    });
  });
  
  describe("Verification and Status", function () {
    let tokenId;
    
    beforeEach(async function () {
      // Mint a token for testing
      const tx = await soulboundNFT.connect(minter).mintNodeIdentifier(
        user1.address,
        MODEL_ID,
        VERIFICATION_PROOF
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.filter(
        log => log.fragment && log.fragment.name === 'AINodeIdentified'
      )[0];
      tokenId = event.args.tokenId;
    });
    
    it("should update verification proof", async function () {
      const NEW_PROOF = "UPDATED_PROOF_HASH";
      
      await soulboundNFT.connect(verifier).verifyNode(tokenId, NEW_PROOF);
      
      const details = await soulboundNFT.getNodeDetails(tokenId);
      expect(details.verificationProof).to.equal(NEW_PROOF);
    });
    
    it("should update active status", async function () {
      // Deactivate the node
      await soulboundNFT.connect(verifier).setNodeStatus(tokenId, false);
      
      // Check status
      const details = await soulboundNFT.getNodeDetails(tokenId);
      expect(details.isActive).to.be.false;
      
      // Check active status detection
      expect(await soulboundNFT.isActiveAINode(user1.address)).to.be.false;
      
      // Reactivate the node
      await soulboundNFT.connect(verifier).setNodeStatus(tokenId, true);
      
      // Check status again
      const updatedDetails = await soulboundNFT.getNodeDetails(tokenId);
      expect(updatedDetails.isActive).to.be.true;
      
      // Check active status detection again
      expect(await soulboundNFT.isActiveAINode(user1.address)).to.be.true;
    });
    
    it("should prevent non-verifiers from updating status", async function () {
      await expect(
        soulboundNFT.connect(user2).setNodeStatus(tokenId, false)
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
  });
});