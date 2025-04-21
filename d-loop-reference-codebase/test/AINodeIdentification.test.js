const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AI Node Identification", function () {
  let soulboundNFT;
  let aiNodeIdentifier;
  let owner;
  let committee1;
  let committee2;
  let aiNode1;
  let aiNode2;
  let nonAiNode;
  
  const METADATA_URI = "ipfs://QmTest123456789";
  const METADATA_URI_2 = "ipfs://QmTest987654321";
  
  beforeEach(async function () {
    // Get signers
    [owner, committee1, committee2, aiNode1, aiNode2, nonAiNode] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.waitForDeployment();
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy(await soulboundNFT.getAddress(), 2);
    await aiNodeIdentifier.waitForDeployment();
    
    // Grant minter and burner roles to AINodeIdentifier
    await soulboundNFT.addMinter(await aiNodeIdentifier.getAddress());
    await soulboundNFT.addBurner(await aiNodeIdentifier.getAddress());
    
    // Add committee members
    await aiNodeIdentifier.addCommitteeMember(committee1.address);
    await aiNodeIdentifier.addCommitteeMember(committee2.address);
  });
  
  describe("Verification Process", function () {
    it("Should allow requesting verification", async function () {
      const tx = await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'VerificationRequested');
      expect(event).to.not.be.undefined;
      
      const requestId = event.args[0];
      expect(requestId).to.equal(0);
      
      // Check request details
      // Note: verificationRequests is a complex mapping with nested mapping, so direct access is limited
      // We can only check the public properties
      const request = await aiNodeIdentifier.verificationRequests(requestId);
      expect(request.applicant).to.equal(aiNode1.address);
      expect(request.metadataURI).to.equal(METADATA_URI);
      expect(request.processed).to.be.false;
    });
    
    it("Should allow committee members to approve requests", async function () {
      // Create request
      await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      
      // First approval
      const tx1 = await aiNodeIdentifier.connect(committee1).approveRequest(0);
      const receipt1 = await tx1.wait();
      
      const event1 = receipt1.logs.find(log => log.fragment && log.fragment.name === 'VerificationApproved');
      expect(event1).to.not.be.undefined;
      
      // Still not processed after one approval
      const request1 = await aiNodeIdentifier.verificationRequests(0);
      expect(request1.processed).to.be.false;
      
      // Second approval (should complete the process)
      const tx2 = await aiNodeIdentifier.connect(committee2).approveRequest(0);
      const receipt2 = await tx2.wait();
      
      const event2 = receipt2.logs.find(log => log.fragment && log.fragment.name === 'VerificationCompleted');
      expect(event2).to.not.be.undefined;
      
      // Now processed
      const request2 = await aiNodeIdentifier.verificationRequests(0);
      expect(request2.processed).to.be.true;
      
      // Check NFT minting
      const balance = await soulboundNFT.balanceOf(aiNode1.address);
      expect(balance).to.equal(1);
    });
    
    it("Should correctly identify AI nodes", async function () {
      // Create and approve request for aiNode1
      await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      await aiNodeIdentifier.connect(committee1).approveRequest(0);
      await aiNodeIdentifier.connect(committee2).approveRequest(0);
      
      // Check verification status
      const isAiNode1 = await aiNodeIdentifier.isVerifiedAINode(aiNode1.address);
      const isAiNode2 = await aiNodeIdentifier.isVerifiedAINode(aiNode2.address);
      const isNonAiNode = await aiNodeIdentifier.isVerifiedAINode(nonAiNode.address);
      
      expect(isAiNode1).to.be.true;
      expect(isAiNode2).to.be.false;
      expect(isNonAiNode).to.be.false;
    });
    
    it("Should prevent transfers of soulbound NFTs", async function () {
      // Create and approve request for aiNode1
      await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      await aiNodeIdentifier.connect(committee1).approveRequest(0);
      await aiNodeIdentifier.connect(committee2).approveRequest(0);
      
      // Try to transfer the NFT
      await expect(
        soulboundNFT.connect(aiNode1).transferFrom(aiNode1.address, nonAiNode.address, 0)
      ).to.be.revertedWith("Token is soulbound");
    });
    
    it("Should allow admins to revoke verification", async function () {
      // Create and approve request for aiNode1
      await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      await aiNodeIdentifier.connect(committee1).approveRequest(0);
      await aiNodeIdentifier.connect(committee2).approveRequest(0);
      
      // Revoke verification
      await aiNodeIdentifier.revokeVerification(aiNode1.address);
      
      // Check verification status
      const isAiNode = await aiNodeIdentifier.isVerifiedAINode(aiNode1.address);
      expect(isAiNode).to.be.false;
      
      // Check NFT is burned
      const balance = await soulboundNFT.balanceOf(aiNode1.address);
      expect(balance).to.equal(0);
    });
    
    it("Should allow committee members to reject requests", async function () {
      // Create request
      await aiNodeIdentifier.connect(aiNode1).requestVerification(METADATA_URI);
      
      // Reject request
      const tx = await aiNodeIdentifier.connect(committee1).rejectRequest(0);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'VerificationRejected');
      expect(event).to.not.be.undefined;
      
      // Check request is processed
      const request = await aiNodeIdentifier.verificationRequests(0);
      expect(request.processed).to.be.true;
      
      // Check no NFT was minted
      const balance = await soulboundNFT.balanceOf(aiNode1.address);
      expect(balance).to.equal(0);
    });
  });
});