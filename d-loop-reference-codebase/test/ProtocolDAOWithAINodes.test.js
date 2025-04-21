const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProtocolDAO with AI Nodes", function () {
  let soulboundNFT;
  let aiNodeIdentifier;
  let protocolDAO;
  let mockExecuter;
  let owner;
  let committee1;
  let committee2;
  let regularUser;
  let aiNode;
  
  const METADATA_URI = "ipfs://QmTest123456789";
  
  beforeEach(async function () {
    // Get signers
    [owner, committee1, committee2, regularUser, aiNode] = await ethers.getSigners();
    
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
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAOWithAINodes");
    protocolDAO = await ProtocolDAO.deploy(await aiNodeIdentifier.getAddress());
    await protocolDAO.waitForDeployment();
    
    // Deploy a mock executer contract
    const MockExecuter = await ethers.getContractFactory("MockExecuter");
    mockExecuter = await MockExecuter.deploy();
    await mockExecuter.waitForDeployment();
    
    // Whitelist the mock executer
    await protocolDAO.updateExecuter(await mockExecuter.getAddress(), true);
    
    // Register an AI node
    await aiNodeIdentifier.connect(aiNode).requestVerification(METADATA_URI);
    await aiNodeIdentifier.connect(committee1).approveRequest(0);
    await aiNodeIdentifier.connect(committee2).approveRequest(0);
  });
  
  describe("Proposal Creation and Voting", function () {
    it("Should use different voting periods for AI nodes and regular users", async function () {
      // Create proposal from regular user
      const tx1 = await protocolDAO.connect(regularUser).submitProposal(await mockExecuter.getAddress());
      const receipt1 = await tx1.wait();
      const event1 = receipt1.logs.find(log => log.fragment && log.fragment.name === "ProposalCreated");
      const regularProposalId = event1.args[0];
      const regularProposal = await protocolDAO.proposals(regularProposalId);
      
      // Create proposal from AI node
      const tx2 = await protocolDAO.connect(aiNode).submitProposal(await mockExecuter.getAddress());
      const receipt2 = await tx2.wait();
      const event2 = receipt2.logs.find(log => log.fragment && log.fragment.name === "ProposalCreated");
      const aiProposalId = event2.args[0];
      const aiProposal = await protocolDAO.proposals(aiProposalId);
      
      // AI node proposal should expire sooner (1 day vs 7 days)
      const aiExpiry = aiProposal.expires;
      const regularExpiry = regularProposal.expires;
      
      // Allow for minor differences in block timestamps
      expect(regularExpiry - aiExpiry).to.be.closeTo(6 * 24 * 60 * 60, 10); // ~6 days difference
    });
    
    it("Should require higher quorum for AI fast-track proposals", async function () {
      // Create proposal from AI node
      await protocolDAO.connect(aiNode).submitProposal(await mockExecuter.getAddress());
      
      // AI proposals should require 40% quorum
      const aiQuorum = await protocolDAO.getQuorum(Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60);
      expect(aiQuorum).to.equal(40);
      
      // Regular proposals should require 30% quorum
      const regularQuorum = await protocolDAO.getQuorum(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
      expect(regularQuorum).to.equal(30);
    });
  });
});