const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AINodeGovernance", function () {
  let SoulboundNFT, AINodeRegistry, AINodeGovernance;
  let soulboundNFT, aiNodeRegistry, aiNodeGovernance;
  let owner, aiNode1, aiNode2, regularUser, admin;
  
  const MODEL_ID = "GPT-4-FINANCE";
  const VERIFICATION_PROOF = "PROOF_HASH_1";
  
  beforeEach(async function () {
    [owner, aiNode1, aiNode2, regularUser, admin] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Deploy AINodeGovernance
    AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(aiNodeRegistry.address);
    await aiNodeGovernance.deployed();
    
    // Grant MINTER_ROLE to AINodeRegistry
    await soulboundNFT.grantRole(
      await soulboundNFT.MINTER_ROLE(),
      aiNodeRegistry.address
    );
    
    // Grant GOVERNANCE_ROLE to owner
    await aiNodeRegistry.grantRole(
      await aiNodeRegistry.GOVERNANCE_ROLE(),
      owner.address
    );
    
    // Grant ADMIN_ROLE to admin
    await aiNodeGovernance.grantRole(
      await aiNodeGovernance.ADMIN_ROLE(),
      admin.address
    );
    
    // Register an AI node
    await aiNodeRegistry.registerNode(
      aiNode1.address,
      MODEL_ID,
      VERIFICATION_PROOF
    );
  });
  
  describe("Voting Parameters", function () {
    it("should return correct voting periods for AI nodes and humans", async function () {
      // Check voting period for AI node
      expect(await aiNodeGovernance.getVotingPeriod(aiNode1.address)).to.equal(
        await aiNodeGovernance.aiNodeVotingPeriod()
      );
      
      // Check voting period for regular user
      expect(await aiNodeGovernance.getVotingPeriod(regularUser.address)).to.equal(
        await aiNodeGovernance.humanVotingPeriod()
      );
      
      // Verify the actual values
      const aiNodePeriod = await aiNodeGovernance.aiNodeVotingPeriod();
      const humanPeriod = await aiNodeGovernance.humanVotingPeriod();
      
      expect(aiNodePeriod).to.equal(24 * 60 * 60); // 1 day
      expect(humanPeriod).to.equal(7 * 24 * 60 * 60); // 7 days
    });
    
    it("should return correct quorum requirements", async function () {
      // Check quorum for AI node voting
      expect(await aiNodeGovernance.getQuorum(true)).to.equal(
        await aiNodeGovernance.aiNodeQuorum()
      );
      
      // Check quorum for human voting
      expect(await aiNodeGovernance.getQuorum(false)).to.equal(
        await aiNodeGovernance.humanQuorum()
      );
      
      // Verify the actual values
      const aiNodeQuorum = await aiNodeGovernance.aiNodeQuorum();
      const humanQuorum = await aiNodeGovernance.humanQuorum();
      
      expect(aiNodeQuorum).to.equal(40); // 40%
      expect(humanQuorum).to.equal(30); // 30%
    });
  });
  
  describe("Parameter Updates", function () {
    it("should update voting parameters correctly", async function () {
      // New values
      const newAINodeVotingPeriod = 12 * 60 * 60; // 12 hours
      const newHumanVotingPeriod = 5 * 24 * 60 * 60; // 5 days
      const newAINodeQuorum = 50; // 50%
      const newHumanQuorum = 25; // 25%
      
      await aiNodeGovernance.connect(admin).updateVotingParameters(
        newAINodeVotingPeriod,
        newHumanVotingPeriod,
        newAINodeQuorum,
        newHumanQuorum
      );
      
      // Check updated values
      expect(await aiNodeGovernance.aiNodeVotingPeriod()).to.equal(newAINodeVotingPeriod);
      expect(await aiNodeGovernance.humanVotingPeriod()).to.equal(newHumanVotingPeriod);
      expect(await aiNodeGovernance.aiNodeQuorum()).to.equal(newAINodeQuorum);
      expect(await aiNodeGovernance.humanQuorum()).to.equal(newHumanQuorum);
    });
    
    it("should prevent non-admins from updating parameters", async function () {
      await expect(
        aiNodeGovernance.connect(regularUser).updateVotingParameters(
          12 * 60 * 60,
          5 * 24 * 60 * 60,
          50,
          25
        )
      ).to.be.revertedWith("AccessControl: account");
    });
    
    it("should update the node identifier contract", async function () {
      // Deploy a new AINodeRegistry
      const newRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
      await newRegistry.deployed();
      
      // Update the node identifier in AINodeGovernance
      await aiNodeGovernance.connect(admin).updateNodeIdentifier(newRegistry.address);
      
      // Check updated value
      expect(await aiNodeGovernance.nodeIdentifier()).to.equal(newRegistry.address);
    });
  });
  
  describe("Integration with AINodeRegistry", function () {
    it("should detect active AI nodes correctly through integration", async function () {
      // Register a second AI node
      await aiNodeRegistry.registerNode(
        aiNode2.address,
        "GPT-4-RESEARCH",
        "PROOF_HASH_2"
      );
      
      // Check voting periods through the governance contract
      expect(await aiNodeGovernance.getVotingPeriod(aiNode1.address)).to.equal(
        await aiNodeGovernance.aiNodeVotingPeriod()
      );
      
      expect(await aiNodeGovernance.getVotingPeriod(aiNode2.address)).to.equal(
        await aiNodeGovernance.aiNodeVotingPeriod()
      );
      
      expect(await aiNodeGovernance.getVotingPeriod(regularUser.address)).to.equal(
        await aiNodeGovernance.humanVotingPeriod()
      );
      
      // Deactivate aiNode1 in the registry
      const tokenId = 0; // First token ID
      await soulboundNFT.grantRole(await soulboundNFT.VERIFIER_ROLE(), owner.address);
      await soulboundNFT.setNodeStatus(tokenId, false);
      
      // Check updated voting period for deactivated node
      expect(await aiNodeGovernance.getVotingPeriod(aiNode1.address)).to.equal(
        await aiNodeGovernance.humanVotingPeriod() // Now should return human voting period
      );
      
      // aiNode2 should still return AI node voting period
      expect(await aiNodeGovernance.getVotingPeriod(aiNode2.address)).to.equal(
        await aiNodeGovernance.aiNodeVotingPeriod()
      );
    });
  });
});