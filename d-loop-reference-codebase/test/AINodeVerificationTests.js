const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AI Node Verification System Integration", function () {
  let soulboundNFT;
  let aiNodeIdentifier;
  let aiNodeRegistry;
  let protocolDAO;
  let owner;
  let committee;
  let aiNodes;
  let regularUsers;
  
  // The identifier for the COMMITTEE_ROLE
  let COMMITTEE_ROLE;
  
  before(async function () {
    // Get signers for different roles
    [owner, ...signers] = await ethers.getSigners();
    
    // Assign signers to different roles
    committee = signers.slice(0, 3);  // First 3 signers as committee members
    aiNodes = signers.slice(3, 8);    // Next 5 signers as AI nodes
    regularUsers = signers.slice(8, 13); // Last 5 signers as regular users
  });

  beforeEach(async function () {
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Identity", "AINODE");
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy();
    
    // Deploy AINodeRegistry with references to AINodeIdentifier
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      aiNodeIdentifier.address,
      100, // Initial reputation
      2,   // Verification threshold (2 out of 3 committee members)
      30 * 24 * 60 * 60 // 30 day inactivity timeout
    );
    
    // Deploy ProtocolDAOWithAINodes
    const ProtocolDAOWithAINodes = await ethers.getContractFactory("ProtocolDAOWithAINodes");
    protocolDAO = await ProtocolDAOWithAINodes.deploy(
      aiNodeRegistry.address,
      owner.address
    );
    
    // Setup roles
    COMMITTEE_ROLE = await aiNodeRegistry.COMMITTEE_ROLE();
    
    // Grant committee roles
    for (let member of committee) {
      await aiNodeRegistry.grantRole(COMMITTEE_ROLE, member.address);
    }
    
    // Grant MINTER_ROLE to AINodeRegistry
    const MINTER_ROLE = await aiNodeIdentifier.MINTER_ROLE();
    await aiNodeIdentifier.grantRole(MINTER_ROLE, aiNodeRegistry.address);
  });

  describe("Committee-based Verification Process", function () {
    it("should allow committee members to approve AI nodes", async function () {
      const aiNode = aiNodes[0];
      
      // Committee member 1 approves
      await aiNodeRegistry.connect(committee[0]).approveAINode(aiNode.address);
      
      // Committee member 2 approves
      await aiNodeRegistry.connect(committee[1]).approveAINode(aiNode.address);
      
      // Verify the AI node is now verified
      expect(await aiNodeRegistry.isVerifiedAINode(aiNode.address)).to.be.true;
    });

    it("should not verify an AI node without sufficient committee approvals", async function () {
      const aiNode = aiNodes[1];
      
      // Only one committee member approves
      await aiNodeRegistry.connect(committee[0]).approveAINode(aiNode.address);
      
      // Verify the AI node is not yet verified
      expect(await aiNodeRegistry.isVerifiedAINode(aiNode.address)).to.be.false;
    });

    it("should mint a Soulbound NFT after verification", async function () {
      const aiNode = aiNodes[2];
      
      // Check no NFT before verification
      expect(await aiNodeIdentifier.balanceOf(aiNode.address)).to.equal(0);
      
      // Get committee approval
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Check that NFT was minted
      expect(await aiNodeIdentifier.balanceOf(aiNode.address)).to.equal(1);
      
      // Check that token is soulbound (can't transfer)
      const tokenId = await aiNodeIdentifier.tokenOfOwnerByIndex(aiNode.address, 0);
      await expect(
        aiNodeIdentifier.connect(aiNode).transferFrom(aiNode.address, regularUsers[0].address, tokenId)
      ).to.be.revertedWith("SoulboundNFT: tokens are non-transferable");
    });
    
    it("should respect the verification threshold", async function () {
      // Change threshold to require all 3 committee members
      await aiNodeRegistry.updateVerificationThreshold(3);
      
      const aiNode = aiNodes[3];
      
      // Two committee members approve
      await aiNodeRegistry.connect(committee[0]).approveAINode(aiNode.address);
      await aiNodeRegistry.connect(committee[1]).approveAINode(aiNode.address);
      
      // Node should not be verified with only 2/3 approvals
      expect(await aiNodeRegistry.isVerifiedAINode(aiNode.address)).to.be.false;
      
      // Third committee member approves
      await aiNodeRegistry.connect(committee[2]).approveAINode(aiNode.address);
      
      // Now node should be verified
      expect(await aiNodeRegistry.isVerifiedAINode(aiNode.address)).to.be.true;
    });
  });

  describe("Reputation and Status Management", function () {
    it("should initialize with correct reputation", async function () {
      const aiNode = aiNodes[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Check initial reputation
      expect(await aiNodeRegistry.getAINodeReputation(aiNode.address)).to.equal(100);
    });
    
    it("should allow reputation updates", async function () {
      const aiNode = aiNodes[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Update reputation
      await aiNodeRegistry.updateAINodeReputation(aiNode.address, 150);
      
      // Check new reputation
      expect(await aiNodeRegistry.getAINodeReputation(aiNode.address)).to.equal(150);
    });
    
    it("should reject reputation updates for non-verified nodes", async function () {
      const aiNode = aiNodes[1]; // Not verified
      
      // Try to update reputation
      await expect(
        aiNodeRegistry.updateAINodeReputation(aiNode.address, 150)
      ).to.be.revertedWith("AINodeRegistry: Not a verified AI node");
    });
    
    it("should mark inactive nodes", async function () {
      const aiNode = aiNodes[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Set a shorter inactivity timeout for testing
      await aiNodeRegistry.updateInactivityTimeout(1); // 1 second
      
      // Move time forward
      await ethers.provider.send("evm_increaseTime", [2]); // 2 seconds
      await ethers.provider.send("evm_mine");
      
      // Mark inactive nodes
      await aiNodeRegistry.markInactiveNodes();
      
      // Check node is marked inactive
      expect(await aiNodeRegistry.isActiveAINode(aiNode.address)).to.be.false;
    });
    
    it("should revoke verification for nodes with too low reputation", async function () {
      const aiNode = aiNodes[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Set reputation below minimum
      await aiNodeRegistry.updateAINodeReputation(aiNode.address, 9); // Below 10
      await aiNodeRegistry.revokeAINodesWithLowReputation(10);
      
      // Check node is no longer verified
      expect(await aiNodeRegistry.isVerifiedAINode(aiNode.address)).to.be.false;
    });
  });

  describe("Protocol DAO Integration", function () {
    it("should differentiate between AI and regular nodes in voting periods", async function () {
      const aiNode = aiNodes[0];
      const regularUser = regularUsers[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Get voting period for AI node
      const aiNodeVotingPeriod = await protocolDAO.getVotingPeriod(aiNode.address);
      
      // Get voting period for regular user
      const regularVotingPeriod = await protocolDAO.getVotingPeriod(regularUser.address);
      
      // AI node should have shorter voting period (48 hours vs 72 hours)
      expect(aiNodeVotingPeriod).to.be.lt(regularVotingPeriod);
      expect(aiNodeVotingPeriod).to.equal(48 * 60 * 60); // 48 hours in seconds
      expect(regularVotingPeriod).to.equal(72 * 60 * 60); // 72 hours in seconds
    });
    
    it("should differentiate between AI and regular nodes in quorum requirements", async function () {
      const aiNode = aiNodes[0];
      const regularUser = regularUsers[0];
      
      // Verify the AI node
      for (let member of committee.slice(0, 2)) {
        await aiNodeRegistry.connect(member).approveAINode(aiNode.address);
      }
      
      // Calculate 48 hours from now for AI node proposal
      const aiNodeExpiry = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
      
      // Calculate 72 hours from now for regular proposal
      const regularExpiry = Math.floor(Date.now() / 1000) + 72 * 60 * 60;
      
      // Get quorum for AI node proposal
      const aiNodeQuorum = await protocolDAO.getQuorum(aiNodeExpiry);
      
      // Get quorum for regular proposal
      const regularQuorum = await protocolDAO.getQuorum(regularExpiry);
      
      // AI node should have higher quorum (40% vs 30%)
      expect(aiNodeQuorum).to.be.gt(regularQuorum);
      expect(aiNodeQuorum).to.equal(40); // 40%
      expect(regularQuorum).to.equal(30); // 30%
    });
  });
});