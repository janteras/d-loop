const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AI Node Identification Comprehensive Tests", function () {
  let soulboundNFT;
  let aiNodeIdentifier;
  let aiNodeRegistry;
  let protocolDAO;
  let aiNodeGovernance;
  let mockOracle;
  let owner;
  let admin;
  let users;
  let aiNodeOperators;
  
  // Constants for testing
  const VERIFICATION_THRESHOLD = 80; // 80% accuracy required
  const VERIFICATION_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const METADATA_URI = "https://dloop.ai/ai-node-metadata/";
  const MAX_AI_NODES = 100;
  
  before(async function () {
    [owner, admin, ...users] = await ethers.getSigners();
    aiNodeOperators = users.slice(0, 5);
    users = users.slice(5, 10);
    
    // Deploy mock oracle for verification
    const MockOracle = await ethers.getContractFactory("MockOracle");
    mockOracle = await MockOracle.deploy();
    await mockOracle.deployed();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Credential", "AINC", METADATA_URI);
    await soulboundNFT.deployed();
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy(
      soulboundNFT.address,
      mockOracle.address,
      VERIFICATION_THRESHOLD
    );
    await aiNodeIdentifier.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      aiNodeIdentifier.address,
      MAX_AI_NODES
    );
    await aiNodeRegistry.deployed();
    
    // Deploy ProtocolDAO (simplified for testing)
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy();
    await protocolDAO.deployed();
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      aiNodeRegistry.address,
      protocolDAO.address
    );
    await aiNodeGovernance.deployed();
    
    // Setup permissions
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeIdentifier.address);
    await aiNodeIdentifier.setRegistry(aiNodeRegistry.address);
    await protocolDAO.setAINodeGovernance(aiNodeGovernance.address);
    
    // Grant admin roles
    await aiNodeIdentifier.grantRole(await aiNodeIdentifier.ADMIN_ROLE(), admin.address);
    await aiNodeRegistry.grantRole(await aiNodeRegistry.ADMIN_ROLE(), admin.address);
  });
  
  describe("Soulbound NFT Functionality", function () {
    it("should issue NFTs only through AINodeIdentifier", async function () {
      // Try to mint directly - should fail
      await expect(
        soulboundNFT.mint(users[0].address, "Test Node")
      ).to.be.reverted;
      
      // Simulate verification through AINodeIdentifier
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[0].address, "Operator 1 Node");
      await mockOracle.setVerificationResult(aiNodeOperators[0].address, 90); // 90% accuracy
      await aiNodeIdentifier.completeVerification(aiNodeOperators[0].address);
      
      // Verify NFT was minted
      expect(await soulboundNFT.balanceOf(aiNodeOperators[0].address)).to.equal(1);
      const tokenId = await soulboundNFT.tokenOfOwnerByIndex(aiNodeOperators[0].address, 0);
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(aiNodeOperators[0].address);
    });
    
    it("should prevent token transfers (soulbound property)", async function () {
      const tokenId = await soulboundNFT.tokenOfOwnerByIndex(aiNodeOperators[0].address, 0);
      
      // Try to transfer - should fail
      await expect(
        soulboundNFT.connect(aiNodeOperators[0]).transferFrom(
          aiNodeOperators[0].address,
          users[0].address,
          tokenId
        )
      ).to.be.revertedWith("Token is soulbound");
      
      // Try to approve for transfer - should fail
      await expect(
        soulboundNFT.connect(aiNodeOperators[0]).approve(users[0].address, tokenId)
      ).to.be.revertedWith("Token is soulbound");
      
      // Verify token is still owned by original owner
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(aiNodeOperators[0].address);
    });
    
    it("should support metadata URI for token discovery", async function () {
      const tokenId = await soulboundNFT.tokenOfOwnerByIndex(aiNodeOperators[0].address, 0);
      
      // Verify token URI
      expect(await soulboundNFT.tokenURI(tokenId)).to.equal(`${METADATA_URI}${tokenId}`);
    });
    
    it("should only allow burning by authorized roles", async function () {
      // Register another node
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[1].address, "Operator 2 Node");
      await mockOracle.setVerificationResult(aiNodeOperators[1].address, 85);
      await aiNodeIdentifier.completeVerification(aiNodeOperators[1].address);
      
      const tokenId = await soulboundNFT.tokenOfOwnerByIndex(aiNodeOperators[1].address, 0);
      
      // Try to burn as non-admin - should fail
      await expect(
        soulboundNFT.connect(users[0]).burn(tokenId)
      ).to.be.reverted;
      
      // Burn as admin
      await soulboundNFT.connect(admin).burn(tokenId);
      
      // Verify token is burned
      await expect(
        soulboundNFT.ownerOf(tokenId)
      ).to.be.reverted;
      
      // Verify balance is updated
      expect(await soulboundNFT.balanceOf(aiNodeOperators[1].address)).to.equal(0);
    });
  });
  
  describe("AI Node Identifier Functionality", function () {
    it("should require minimum verification threshold", async function () {
      // Initiate verification
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[2].address, "Operator 3 Node");
      
      // Set verification result below threshold
      await mockOracle.setVerificationResult(aiNodeOperators[2].address, VERIFICATION_THRESHOLD - 1);
      
      // Try to complete verification - should fail
      await expect(
        aiNodeIdentifier.completeVerification(aiNodeOperators[2].address)
      ).to.be.revertedWith("Verification score below threshold");
      
      // Verify no NFT was minted
      expect(await soulboundNFT.balanceOf(aiNodeOperators[2].address)).to.equal(0);
      
      // Update verification result above threshold
      await mockOracle.setVerificationResult(aiNodeOperators[2].address, VERIFICATION_THRESHOLD + 1);
      
      // Complete verification - should succeed now
      await aiNodeIdentifier.completeVerification(aiNodeOperators[2].address);
      
      // Verify NFT was minted
      expect(await soulboundNFT.balanceOf(aiNodeOperators[2].address)).to.equal(1);
    });
    
    it("should handle verification expiration", async function () {
      // Initiate verification for a new operator
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[3].address, "Operator 4 Node");
      
      // Advance time past verification period
      await time.increase(VERIFICATION_PERIOD + 1);
      
      // Set verification result
      await mockOracle.setVerificationResult(aiNodeOperators[3].address, 95);
      
      // Try to complete verification - should fail due to expiration
      await expect(
        aiNodeIdentifier.completeVerification(aiNodeOperators[3].address)
      ).to.be.revertedWith("Verification request expired");
      
      // Reinitiate verification
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[3].address, "Operator 4 Node");
      
      // Complete verification quickly
      await mockOracle.setVerificationResult(aiNodeOperators[3].address, 95);
      await aiNodeIdentifier.completeVerification(aiNodeOperators[3].address);
      
      // Verify NFT was minted
      expect(await soulboundNFT.balanceOf(aiNodeOperators[3].address)).to.equal(1);
    });
    
    it("should store verification history for auditing", async function () {
      const operator = aiNodeOperators[3];
      
      // Get verification history
      const verificationInfo = await aiNodeIdentifier.getVerificationInfo(operator.address);
      
      // Verify history was recorded
      expect(verificationInfo.score).to.equal(95);
      expect(verificationInfo.verified).to.be.true;
      expect(verificationInfo.lastVerificationTime).to.be.gt(0);
    });
    
    it("should handle reverification and credential revocation", async function () {
      const operator = aiNodeOperators[0];
      
      // Initial state - should be verified
      expect((await aiNodeIdentifier.getVerificationInfo(operator.address)).verified).to.be.true;
      
      // Revoke verification
      await aiNodeIdentifier.connect(admin).revokeVerification(operator.address);
      
      // Verify status changed
      expect((await aiNodeIdentifier.getVerificationInfo(operator.address)).verified).to.be.false;
      
      // Reverify
      await aiNodeIdentifier.initiateVerification(operator.address, "Operator 1 Node Updated");
      await mockOracle.setVerificationResult(operator.address, 98);
      await aiNodeIdentifier.completeVerification(operator.address);
      
      // Verify status changed back
      expect((await aiNodeIdentifier.getVerificationInfo(operator.address)).verified).to.be.true;
      
      // Verify score updated
      expect((await aiNodeIdentifier.getVerificationInfo(operator.address)).score).to.equal(98);
    });
  });
  
  describe("AI Node Registry Functionality", function () {
    it("should only register verified AI nodes", async function () {
      // Try to register an unverified node - should fail
      await expect(
        aiNodeRegistry.registerNode(users[0].address)
      ).to.be.revertedWith("Node not verified");
      
      // Register verified nodes
      await aiNodeRegistry.registerNode(aiNodeOperators[0].address);
      await aiNodeRegistry.registerNode(aiNodeOperators[2].address);
      await aiNodeRegistry.registerNode(aiNodeOperators[3].address);
      
      // Verify registration
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[0].address)).to.be.true;
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[2].address)).to.be.true;
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[3].address)).to.be.true;
      expect(await aiNodeRegistry.isRegisteredNode(users[0].address)).to.be.false;
      
      // Verify node count
      expect(await aiNodeRegistry.getNodeCount()).to.equal(3);
    });
    
    it("should enforce maximum node limit", async function () {
      // Set a very low max node limit for testing
      await aiNodeRegistry.connect(admin).setMaxNodes(3);
      
      // Register one more verified node - should fail due to max limit
      await aiNodeIdentifier.initiateVerification(aiNodeOperators[4].address, "Operator 5 Node");
      await mockOracle.setVerificationResult(aiNodeOperators[4].address, 90);
      await aiNodeIdentifier.completeVerification(aiNodeOperators[4].address);
      
      await expect(
        aiNodeRegistry.registerNode(aiNodeOperators[4].address)
      ).to.be.revertedWith("Maximum node count reached");
      
      // Increase limit
      await aiNodeRegistry.connect(admin).setMaxNodes(5);
      
      // Now registration should succeed
      await aiNodeRegistry.registerNode(aiNodeOperators[4].address);
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[4].address)).to.be.true;
      expect(await aiNodeRegistry.getNodeCount()).to.equal(4);
    });
    
    it("should handle node deregistration", async function () {
      // Deregister a node
      await aiNodeRegistry.deregisterNode(aiNodeOperators[3].address);
      
      // Verify deregistration
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[3].address)).to.be.false;
      expect(await aiNodeRegistry.getNodeCount()).to.equal(3);
      
      // Try to deregister again - should have no effect
      await aiNodeRegistry.deregisterNode(aiNodeOperators[3].address);
      expect(await aiNodeRegistry.getNodeCount()).to.equal(3);
    });
    
    it("should auto-deregister when verification is revoked", async function () {
      // Revoke verification for a registered node
      await aiNodeIdentifier.connect(admin).revokeVerification(aiNodeOperators[0].address);
      
      // Verify node was auto-deregistered
      expect(await aiNodeRegistry.isRegisteredNode(aiNodeOperators[0].address)).to.be.false;
      expect(await aiNodeRegistry.getNodeCount()).to.equal(2);
    });
    
    it("should maintain a list of active nodes", async function () {
      // Get active nodes
      const activeNodeCount = await aiNodeRegistry.getNodeCount();
      const activeNodes = [];
      
      for (let i = 0; i < activeNodeCount; i++) {
        activeNodes.push(await aiNodeRegistry.getNodeAtIndex(i));
      }
      
      // Verify list contains expected nodes
      expect(activeNodes).to.include(aiNodeOperators[2].address);
      expect(activeNodes).to.include(aiNodeOperators[4].address);
      expect(activeNodes).not.to.include(aiNodeOperators[0].address);
      expect(activeNodes).not.to.include(aiNodeOperators[3].address);
    });
  });
  
  describe("AI Node Governance Integration", function () {
    it("should differentiate voting periods for AI nodes", async function () {
      // Create test proposals
      await protocolDAO.createProposal("Test Proposal 1", "0x00");
      await protocolDAO.createProposal("Test Proposal 2", "0x00");
      
      // Get voting periods
      const aiNodeVotingPeriod = await aiNodeGovernance.getVotingPeriod(aiNodeOperators[2].address);
      const regularVotingPeriod = await aiNodeGovernance.getVotingPeriod(users[0].address);
      
      // Verify AI nodes get shorter voting period (1 day)
      expect(aiNodeVotingPeriod).to.equal(86400); // 1 day in seconds
      expect(regularVotingPeriod).to.equal(604800); // 7 days in seconds
    });
    
    it("should differentiate quorum requirements for AI node voting", async function () {
      // Get quorum requirements
      const aiNodeQuorum = await aiNodeGovernance.getQuorumPercent(true);
      const regularQuorum = await aiNodeGovernance.getQuorumPercent(false);
      
      // Verify AI nodes have higher quorum requirement
      expect(aiNodeQuorum).to.be.gt(regularQuorum);
      expect(aiNodeQuorum).to.equal(40); // 40%
      expect(regularQuorum).to.equal(30); // 30%
    });
    
    it("should handle AI nodes voting on proposals", async function () {
      const proposalId = 0; // First proposal
      
      // Cast votes from AI nodes
      await aiNodeGovernance.connect(aiNodeOperators[2]).castVote(proposalId, true);
      await aiNodeGovernance.connect(aiNodeOperators[4]).castVote(proposalId, true);
      
      // Verify votes were recorded
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.aiNodeVotes).to.equal(2);
      expect(proposal.aiNodeVoteWeight).to.equal(2);
    });
    
    it("should support customized voting weight for AI nodes based on verification score", async function () {
      const proposalId = 1; // Second proposal
      
      // Add a high-score AI node with greater weight
      await aiNodeIdentifier.initiateVerification(users[1].address, "High Score Node");
      await mockOracle.setVerificationResult(users[1].address, 100); // Perfect score
      await aiNodeIdentifier.completeVerification(users[1].address);
      
      // Increase max nodes to allow registration
      await aiNodeRegistry.connect(admin).setMaxNodes(10);
      await aiNodeRegistry.registerNode(users[1].address);
      
      // Cast vote from high-score AI node
      await aiNodeGovernance.connect(users[1]).castVote(proposalId, true);
      
      // Verify vote has higher weight
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.aiNodeVotes).to.equal(1);
      expect(proposal.aiNodeVoteWeight).to.be.gt(1); // Weight > 1 due to higher score
    });
    
    it("should enforce AI node verification for accelerated voting", async function () {
      const proposalId = 1; // Second proposal
      
      // Try to vote as AI node when not registered - should fall back to regular voting
      const regularUser = users[2];
      
      // Vote and check if regular voting period applies
      await aiNodeGovernance.connect(regularUser).castVote(proposalId, true);
      
      // Advance time by 1 day + 1 second (just past AI node voting period)
      await time.increase(86400 + 1);
      
      // Check if AI node voting phase is over but regular voting continues
      expect(await aiNodeGovernance.isAIVotingPhaseOver(proposalId)).to.be.true;
      expect(await aiNodeGovernance.isVotingPhaseOver(proposalId)).to.be.false;
      
      // Advance time by 6 more days (to complete regular voting period)
      await time.increase(6 * 86400);
      
      // Now regular voting should be over too
      expect(await aiNodeGovernance.isVotingPhaseOver(proposalId)).to.be.true;
    });
  });
  
  describe("Security and Access Control", function () {
    it("should prevent unauthorized threshold changes", async function () {
      const newThreshold = 75;
      
      // Try to update threshold as non-admin
      await expect(
        aiNodeIdentifier.connect(users[0]).setVerificationThreshold(newThreshold)
      ).to.be.reverted;
      
      // Update as admin
      await aiNodeIdentifier.connect(admin).setVerificationThreshold(newThreshold);
      
      // Verify threshold updated
      expect(await aiNodeIdentifier.verificationThreshold()).to.equal(newThreshold);
    });
    
    it("should prevent spoofing of verification results", async function () {
      // Try to complete verification without initiation
      await expect(
        aiNodeIdentifier.completeVerification(users[3].address)
      ).to.be.revertedWith("No pending verification request");
      
      // Initiate verification but try to complete for different address
      await aiNodeIdentifier.initiateVerification(users[3].address, "Test Node");
      await mockOracle.setVerificationResult(users[3].address, 85);
      
      await expect(
        aiNodeIdentifier.completeVerification(users[4].address)
      ).to.be.revertedWith("No pending verification request");
    });
    
    it("should handle emergency credential revocation", async function () {
      // Complete verification for test user
      await aiNodeIdentifier.completeVerification(users[3].address);
      expect(await soulboundNFT.balanceOf(users[3].address)).to.equal(1);
      
      // Register as AI node
      await aiNodeRegistry.registerNode(users[3].address);
      expect(await aiNodeRegistry.isRegisteredNode(users[3].address)).to.be.true;
      
      // Emergency revocation (affects both verification and registration)
      await aiNodeIdentifier.connect(admin).emergencyRevokeCredentials(users[3].address);
      
      // Verify credentials revoked
      expect((await aiNodeIdentifier.getVerificationInfo(users[3].address)).verified).to.be.false;
      expect(await aiNodeRegistry.isRegisteredNode(users[3].address)).to.be.false;
      
      // Verify NFT burned
      expect(await soulboundNFT.balanceOf(users[3].address)).to.equal(0);
    });
    
    it("should prevent unauthorized access to governance functions", async function () {
      // Try to update governance parameters as non-admin
      await expect(
        aiNodeGovernance.connect(users[0]).setQuorumRequirements(35, 25)
      ).to.be.reverted;
      
      // Update as admin
      await aiNodeGovernance.connect(admin).setQuorumRequirements(35, 25);
      
      // Verify parameters updated
      expect(await aiNodeGovernance.getQuorumPercent(true)).to.equal(35);
      expect(await aiNodeGovernance.getQuorumPercent(false)).to.equal(25);
    });
  });
  
  describe("Edge Cases", function () {
    it("should handle repeated verification requests", async function () {
      const testUser = users[5];
      
      // Multiple verification requests for same address
      await aiNodeIdentifier.initiateVerification(testUser.address, "Test Node 1");
      
      // Try same request again - should update not error
      await aiNodeIdentifier.initiateVerification(testUser.address, "Test Node 2");
      
      // Complete verification
      await mockOracle.setVerificationResult(testUser.address, 90);
      await aiNodeIdentifier.completeVerification(testUser.address);
      
      // Verify only one NFT issued
      expect(await soulboundNFT.balanceOf(testUser.address)).to.equal(1);
      
      // Try to complete again - should fail
      await expect(
        aiNodeIdentifier.completeVerification(testUser.address)
      ).to.be.revertedWith("No pending verification request");
    });
    
    it("should handle edge case of revocation during active voting", async function () {
      // Create new proposal
      await protocolDAO.createProposal("Edge Case Proposal", "0x00");
      const proposalId = 2; // Third proposal
      
      // Cast vote as AI node
      await aiNodeGovernance.connect(aiNodeOperators[2]).castVote(proposalId, true);
      
      // Get initial vote count
      const initialProposal = await protocolDAO.getProposal(proposalId);
      const initialVotes = initialProposal.aiNodeVotes;
      const initialWeight = initialProposal.aiNodeVoteWeight;
      
      // Revoke credentials during active voting
      await aiNodeIdentifier.connect(admin).revokeVerification(aiNodeOperators[2].address);
      
      // Verify vote is maintained but future votes are prevented
      const finalProposal = await protocolDAO.getProposal(proposalId);
      expect(finalProposal.aiNodeVotes).to.equal(initialVotes);
      expect(finalProposal.aiNodeVoteWeight).to.equal(initialWeight);
      
      // Try to vote again after revocation - should fail or count as regular vote
      await expect(
        aiNodeGovernance.connect(aiNodeOperators[2]).castVote(proposalId, true)
      ).to.be.revertedWith("Already voted");
    });
    
    it("should handle AINodeRegistry population at maximum capacity", async function () {
      // Set very low max capacity for testing
      await aiNodeRegistry.connect(admin).setMaxNodes(1);
      
      // Deregister all existing nodes
      const activeNodeCount = await aiNodeRegistry.getNodeCount();
      for (let i = 0; i < activeNodeCount; i++) {
        const nodeAddress = await aiNodeRegistry.getNodeAtIndex(0);
        await aiNodeRegistry.deregisterNode(nodeAddress);
      }
      
      // Register one node to reach max capacity
      await aiNodeRegistry.registerNode(aiNodeOperators[4].address);
      
      // Verify at max capacity
      expect(await aiNodeRegistry.getNodeCount()).to.equal(1);
      expect(await aiNodeRegistry.isAtMaxCapacity()).to.be.true;
      
      // Try to register another node - should fail
      await expect(
        aiNodeRegistry.registerNode(users[5].address)
      ).to.be.revertedWith("Maximum node count reached");
    });
  });
});