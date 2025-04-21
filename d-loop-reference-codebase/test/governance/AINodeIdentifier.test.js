const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AI Node Identification System", function () {
  let admin, committee1, committee2, committee3, requester1, requester2;
  let soulboundNFT, aiNodeIdentifier;
  
  beforeEach(async function () {
    [admin, committee1, committee2, committee3, requester1, requester2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Identity", "AINODE", admin.address);
    await soulboundNFT.deployed();
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy(
      admin.address,
      soulboundNFT.address,
      [committee1.address, committee2.address, committee3.address],
      2 // Minimum 2 approvals required
    );
    await aiNodeIdentifier.deployed();
    
    // Grant minter role to the identifier contract
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeIdentifier.address);
    await soulboundNFT.grantRole(await soulboundNFT.VERIFIER_ROLE(), aiNodeIdentifier.address);
  });
  
  describe("SoulboundNFT", function () {
    it("should initialize correctly", async function () {
      expect(await soulboundNFT.name()).to.equal("AI Node Identity");
      expect(await soulboundNFT.symbol()).to.equal("AINODE");
      expect(await soulboundNFT.hasRole(await soulboundNFT.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });
    
    it("should mint a token with admin role", async function () {
      const tx = await soulboundNFT.mintNode(
        requester1.address,
        "ipfs://metadata",
        1, // Governance node
        "AI Model: GPT-4, Governance Specialization"
      );
      
      const receipt = await tx.wait();
      const tokenId = receipt.events
        .filter(e => e.event === "Transfer")
        .map(e => e.args.tokenId.toNumber())[0];
      
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(requester1.address);
      expect(await soulboundNFT.balanceOf(requester1.address)).to.equal(1);
      
      // Check node properties
      expect(await soulboundNFT.isVerified(tokenId)).to.be.false;
      expect(await soulboundNFT.getReputationScore(tokenId)).to.equal(50); // Default score
      expect(await soulboundNFT.getNodeType(tokenId)).to.equal(1); // Governance
      expect(await soulboundNFT.getNodeMetadata(tokenId)).to.equal("AI Model: GPT-4, Governance Specialization");
    });
    
    it("should prevent token transfers", async function () {
      // Mint a token
      const tx = await soulboundNFT.mintNode(
        requester1.address,
        "ipfs://metadata",
        1,
        "Test Node"
      );
      
      const receipt = await tx.wait();
      const tokenId = receipt.events
        .filter(e => e.event === "Transfer")
        .map(e => e.args.tokenId.toNumber())[0];
      
      // Attempt to transfer
      await expect(
        soulboundNFT.connect(requester1).transferFrom(requester1.address, requester2.address, tokenId)
      ).to.be.revertedWith("SoulboundNFT: token is soulbound");
    });
    
    it("should verify a node", async function () {
      // Mint a token
      const tx = await soulboundNFT.mintNode(
        requester1.address,
        "ipfs://metadata",
        1,
        "Test Node"
      );
      
      const receipt = await tx.wait();
      const tokenId = receipt.events
        .filter(e => e.event === "Transfer")
        .map(e => e.args.tokenId.toNumber())[0];
      
      // Verify the node
      await soulboundNFT.verifyNode(tokenId);
      
      expect(await soulboundNFT.isVerified(tokenId)).to.be.true;
    });
    
    it("should update node reputation", async function () {
      // Mint a token
      const tx = await soulboundNFT.mintNode(
        requester1.address,
        "ipfs://metadata",
        1,
        "Test Node"
      );
      
      const receipt = await tx.wait();
      const tokenId = receipt.events
        .filter(e => e.event === "Transfer")
        .map(e => e.args.tokenId.toNumber())[0];
      
      // Update reputation
      await soulboundNFT.updateReputation(tokenId, 75);
      
      expect(await soulboundNFT.getReputationScore(tokenId)).to.equal(75);
    });
  });
  
  describe("AINodeIdentifier", function () {
    it("should initialize correctly", async function () {
      expect(await aiNodeIdentifier.soulboundNFT()).to.equal(soulboundNFT.address);
      expect(await aiNodeIdentifier.minApprovals()).to.equal(2);
      expect(await aiNodeIdentifier.committeeMemberCount()).to.equal(3);
      
      expect(await aiNodeIdentifier.hasRole(await aiNodeIdentifier.COMMITTEE_ROLE(), committee1.address)).to.be.true;
      expect(await aiNodeIdentifier.hasRole(await aiNodeIdentifier.COMMITTEE_ROLE(), committee2.address)).to.be.true;
      expect(await aiNodeIdentifier.hasRole(await aiNodeIdentifier.COMMITTEE_ROLE(), committee3.address)).to.be.true;
    });
    
    it("should create verification requests", async function () {
      const requestTx = await aiNodeIdentifier.connect(requester1).requestVerification(
        1, // Governance node
        "AI Model: GPT-4, Governance Specialization"
      );
      
      const receipt = await requestTx.wait();
      const requestId = receipt.events
        .filter(e => e.event === "VerificationRequested")
        .map(e => e.args.requestId.toNumber())[0];
      
      const requestDetails = await aiNodeIdentifier.getRequestDetails(requestId);
      
      expect(requestDetails.requester).to.equal(requester1.address);
      expect(requestDetails.nodeType).to.equal(1);
      expect(requestDetails.metadata).to.equal("AI Model: GPT-4, Governance Specialization");
      expect(requestDetails.approvals).to.equal(0);
      expect(requestDetails.rejections).to.equal(0);
      expect(requestDetails.isProcessed).to.be.false;
      expect(requestDetails.isApproved).to.be.false;
    });
    
    it("should handle committee voting", async function () {
      // Create a verification request
      const requestTx = await aiNodeIdentifier.connect(requester1).requestVerification(
        1, // Governance node
        "AI Model: GPT-4, Governance Specialization"
      );
      
      const receipt = await requestTx.wait();
      const requestId = receipt.events
        .filter(e => e.event === "VerificationRequested")
        .map(e => e.args.requestId.toNumber())[0];
      
      // First committee member votes to approve
      await aiNodeIdentifier.connect(committee1).voteOnRequest(requestId, true);
      
      // Check vote was recorded
      let requestDetails = await aiNodeIdentifier.getRequestDetails(requestId);
      expect(requestDetails.approvals).to.equal(1);
      expect(requestDetails.rejections).to.equal(0);
      expect(requestDetails.isProcessed).to.be.false;
      
      const vote = await aiNodeIdentifier.checkVote(requestId, committee1.address);
      expect(vote.hasVoted).to.be.true;
      expect(vote.voteValue).to.be.true;
      
      // Second committee member votes to approve - this should trigger approval
      await aiNodeIdentifier.connect(committee2).voteOnRequest(requestId, true);
      
      // Check request was processed and approved
      requestDetails = await aiNodeIdentifier.getRequestDetails(requestId);
      expect(requestDetails.approvals).to.equal(2);
      expect(requestDetails.isProcessed).to.be.true;
      expect(requestDetails.isApproved).to.be.true;
      
      // Check that an NFT was minted and assigned to the requester
      expect(await soulboundNFT.balanceOf(requester1.address)).to.equal(1);
      
      // Get the token ID
      const tokenId = (await soulboundNFT.getTokensOfOwner(requester1.address))[0];
      
      // Check token properties
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(requester1.address);
      expect(await soulboundNFT.isVerified(tokenId)).to.be.true;
      expect(await soulboundNFT.getNodeType(tokenId)).to.equal(1);
    });
    
    it("should reject requests with insufficient approvals", async function () {
      // Create a verification request
      const requestTx = await aiNodeIdentifier.connect(requester2).requestVerification(
        2, // Investment node
        "AI Model: InvestAI, Forecasting Specialization"
      );
      
      const receipt = await requestTx.wait();
      const requestId = receipt.events
        .filter(e => e.event === "VerificationRequested")
        .map(e => e.args.requestId.toNumber())[0];
      
      // First committee member votes to reject
      await aiNodeIdentifier.connect(committee1).voteOnRequest(requestId, false);
      
      // Second committee member votes to reject - this should trigger rejection
      await aiNodeIdentifier.connect(committee2).voteOnRequest(requestId, false);
      
      // Check request was processed and rejected
      const requestDetails = await aiNodeIdentifier.getRequestDetails(requestId);
      expect(requestDetails.rejections).to.equal(2);
      expect(requestDetails.isProcessed).to.be.true;
      expect(requestDetails.isApproved).to.be.false;
      
      // Check that no NFT was minted
      expect(await soulboundNFT.balanceOf(requester2.address)).to.equal(0);
    });
    
    it("should check verified AI node status", async function () {
      // First request and approval
      const requestTx = await aiNodeIdentifier.connect(requester1).requestVerification(1, "Governance Node");
      const receipt = await requestTx.wait();
      const requestId = receipt.events
        .filter(e => e.event === "VerificationRequested")
        .map(e => e.args.requestId.toNumber())[0];
      
      // Approve the request
      await aiNodeIdentifier.connect(committee1).voteOnRequest(requestId, true);
      await aiNodeIdentifier.connect(committee2).voteOnRequest(requestId, true);
      
      // Check AI node status
      expect(await aiNodeIdentifier.isVerifiedAINode(requester1.address, 1)).to.be.true;
      expect(await aiNodeIdentifier.isVerifiedAINode(requester1.address, 2)).to.be.false;
      expect(await aiNodeIdentifier.isVerifiedAINode(requester2.address, 1)).to.be.false;
    });
    
    it("should handle committee configuration updates", async function () {
      // Update minimum approvals
      await aiNodeIdentifier.connect(admin).updateCommitteeConfig(3);
      
      expect(await aiNodeIdentifier.minApprovals()).to.equal(3);
      
      // Add a new committee member
      await aiNodeIdentifier.connect(admin).addCommitteeMember(requester2.address);
      
      expect(await aiNodeIdentifier.committeeMemberCount()).to.equal(4);
      expect(await aiNodeIdentifier.hasRole(await aiNodeIdentifier.COMMITTEE_ROLE(), requester2.address)).to.be.true;
      
      // Remove a committee member
      await aiNodeIdentifier.connect(admin).removeCommitteeMember(committee3.address);
      
      expect(await aiNodeIdentifier.committeeMemberCount()).to.equal(3);
      expect(await aiNodeIdentifier.hasRole(await aiNodeIdentifier.COMMITTEE_ROLE(), committee3.address)).to.be.false;
    });
  });
});