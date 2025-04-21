const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProtocolDAO", function () {
  // This test might take time to run due to time manipulations
  this.timeout(100000);
  
  let SoulboundNFT, AINodeRegistry, ProtocolDAO, MockExecutor;
  let soulboundNFT, aiNodeRegistry, protocolDAO, successExecutor, failureExecutor;
  let owner, admin, aiNode, humanUser1, humanUser2;
  
  const AI_MODEL_ID = "GPT-4-FINANCE";
  const VERIFICATION_PROOF = "PROOF_HASH_1";
  
  beforeEach(async function () {
    [owner, admin, aiNode, humanUser1, humanUser2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Grant roles for SoulboundNFT
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeRegistry.address);
    await soulboundNFT.grantRole(await soulboundNFT.VERIFIER_ROLE(), owner.address);
    
    // Grant roles for AINodeRegistry
    await aiNodeRegistry.grantRole(await aiNodeRegistry.GOVERNANCE_ROLE(), owner.address);
    
    // Register AI node
    await aiNodeRegistry.registerNode(aiNode.address, AI_MODEL_ID, VERIFICATION_PROOF);
    
    // Deploy ProtocolDAO
    ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(aiNodeRegistry.address);
    await protocolDAO.deployed();
    
    // Deploy MockExecutors
    MockExecutor = await ethers.getContractFactory("MockExecutor");
    successExecutor = await MockExecutor.deploy(true, "Execution successful");
    await successExecutor.deployed();
    
    failureExecutor = await MockExecutor.deploy(false, "Execution failed");
    await failureExecutor.deployed();
    
    // Whitelist MockExecutors
    await protocolDAO.updateExecutor(successExecutor.address, true);
    await protocolDAO.updateExecutor(failureExecutor.address, true);
    
    // Grant roles
    await protocolDAO.grantRole(await protocolDAO.ADMIN_ROLE(), admin.address);
    
    // Set up voting power for testing
    await protocolDAO.mockSetVotingPower(owner.address, ethers.utils.parseEther("1000"));
    await protocolDAO.mockSetVotingPower(admin.address, ethers.utils.parseEther("1000"));
    await protocolDAO.mockSetVotingPower(aiNode.address, ethers.utils.parseEther("1000"));
    await protocolDAO.mockSetVotingPower(humanUser1.address, ethers.utils.parseEther("500"));
    await protocolDAO.mockSetVotingPower(humanUser2.address, ethers.utils.parseEther("500"));
  });
  
  describe("Initialization and Configuration", function () {
    it("should initialize with correct parameters", async function () {
      expect(await protocolDAO.nodeIdentifier()).to.equal(aiNodeRegistry.address);
      expect(await protocolDAO.aiNodeVotingPeriod()).to.equal(24 * 60 * 60); // 1 day
      expect(await protocolDAO.humanVotingPeriod()).to.equal(7 * 24 * 60 * 60); // 7 days
      expect(await protocolDAO.timelockPeriod()).to.equal(24 * 60 * 60); // 24 hours
      expect(await protocolDAO.aiNodeQuorumPercent()).to.equal(40);
      expect(await protocolDAO.humanQuorumPercent()).to.equal(30);
    });
    
    it("should correctly identify AI nodes", async function () {
      // AI node should have shorter voting period
      expect(await protocolDAO.getVotingPeriod(aiNode.address)).to.equal(24 * 60 * 60); // 1 day
      
      // Human user should have longer voting period
      expect(await protocolDAO.getVotingPeriod(humanUser1.address)).to.equal(7 * 24 * 60 * 60); // 7 days
    });
    
    it("should update voting parameters", async function () {
      // New parameters
      const newAIVotingPeriod = 12 * 60 * 60; // 12 hours
      const newHumanVotingPeriod = 5 * 24 * 60 * 60; // 5 days
      const newTimelockPeriod = 12 * 60 * 60; // 12 hours
      const newAIQuorum = 50; // 50%
      const newHumanQuorum = 25; // 25%
      
      // Update parameters
      await protocolDAO.connect(admin).updateVotingParameters(
        newAIVotingPeriod,
        newHumanVotingPeriod,
        newTimelockPeriod,
        newAIQuorum,
        newHumanQuorum
      );
      
      // Check updated values
      expect(await protocolDAO.aiNodeVotingPeriod()).to.equal(newAIVotingPeriod);
      expect(await protocolDAO.humanVotingPeriod()).to.equal(newHumanVotingPeriod);
      expect(await protocolDAO.timelockPeriod()).to.equal(newTimelockPeriod);
      expect(await protocolDAO.aiNodeQuorumPercent()).to.equal(newAIQuorum);
      expect(await protocolDAO.humanQuorumPercent()).to.equal(newHumanQuorum);
    });
    
    it("should manage whitelisted executors", async function () {
      const newExecutor = await MockExecutor.deploy(true, "New executor");
      await newExecutor.deployed();
      
      // Initially not whitelisted
      expect(await protocolDAO.whitelistedExecutors(newExecutor.address)).to.be.false;
      
      // Whitelist the executor
      await protocolDAO.connect(admin).updateExecutor(newExecutor.address, true);
      expect(await protocolDAO.whitelistedExecutors(newExecutor.address)).to.be.true;
      
      // Remove from whitelist
      await protocolDAO.connect(admin).updateExecutor(newExecutor.address, false);
      expect(await protocolDAO.whitelistedExecutors(newExecutor.address)).to.be.false;
    });
  });
  
  describe("Proposal Lifecycle", function () {
    it("should create proposal with correct parameters", async function () {
      // Create proposal
      const description = "Test proposal";
      const tx = await protocolDAO.connect(humanUser1).submitProposal(
        successExecutor.address,
        description
      );
      
      // Get proposalId from event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Check proposal details
      const proposal = await protocolDAO.getProposalDetails(proposalId);
      
      expect(proposal.submitter).to.equal(humanUser1.address);
      expect(proposal.executor).to.equal(successExecutor.address);
      expect(proposal.yesVotes).to.equal(0);
      expect(proposal.noVotes).to.equal(0);
      
      // Human voting period (7 days) + current timestamp
      const expectedExpiry = (await ethers.provider.getBlock("latest")).timestamp + (7 * 24 * 60 * 60);
      expect(proposal.expires).to.be.closeTo(expectedExpiry, 5); // Allow small difference due to block times
      
      // Timelock (24 hours) + expiry
      const expectedTimelockEnd = expectedExpiry + (24 * 60 * 60);
      expect(proposal.timelockEnd).to.be.closeTo(expectedTimelockEnd, 5);
      
      expect(proposal.description).to.equal(description);
      expect(proposal.executed).to.be.false;
      expect(proposal.quorumPercent).to.equal(30); // Human quorum
      expect(proposal.meetsQuorum).to.be.false;
    });
    
    it("should create AI node proposal with shorter voting period", async function () {
      // Create proposal from AI node
      const description = "AI node proposal";
      const tx = await protocolDAO.connect(aiNode).submitProposal(
        successExecutor.address,
        description
      );
      
      // Get proposalId from event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Check proposal details
      const proposal = await protocolDAO.getProposalDetails(proposalId);
      
      // AI voting period (1 day) + current timestamp
      const expectedExpiry = (await ethers.provider.getBlock("latest")).timestamp + (1 * 24 * 60 * 60);
      expect(proposal.expires).to.be.closeTo(expectedExpiry, 5);
      
      expect(proposal.quorumPercent).to.equal(40); // AI quorum
    });
    
    it("should accept votes and track them correctly", async function () {
      // Create proposal
      const tx = await protocolDAO.connect(humanUser1).submitProposal(
        successExecutor.address,
        "Voting test proposal"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote YES
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // Vote NO
      await protocolDAO.connect(humanUser2).voteProposal(proposalId, false);
      
      // Check vote counts
      const proposal = await protocolDAO.getProposalDetails(proposalId);
      
      // owner + aiNode voting power
      expect(proposal.yesVotes).to.equal(ethers.utils.parseEther("2000"));
      
      // humanUser2 voting power
      expect(proposal.noVotes).to.equal(ethers.utils.parseEther("500"));
      
      // Should meet quorum (Human quorum = 30%, total voting power = 4000)
      // Required votes = 1200, actual votes = 2500
      expect(proposal.meetsQuorum).to.be.true;
    });
    
    it("should not allow duplicate votes", async function () {
      // Create proposal
      const tx = await protocolDAO.submitProposal(
        successExecutor.address,
        "Duplicate vote test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote once
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // Try to vote again - should fail
      await expect(
        protocolDAO.connect(aiNode).voteProposal(proposalId, false)
      ).to.be.revertedWith("Already voted");
    });
    
    it("should respect the voting period", async function () {
      // Create proposal
      const tx = await protocolDAO.submitProposal(
        successExecutor.address,
        "Voting period test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Fast forward past the voting period (7 days)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Try to vote - should fail
      await expect(
        protocolDAO.connect(aiNode).voteProposal(proposalId, true)
      ).to.be.revertedWith("Voting period ended");
    });
    
    it("should respect the timelock period", async function () {
      // Create proposal
      const tx = await protocolDAO.submitProposal(
        successExecutor.address,
        "Timelock test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote to meet quorum and pass
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // Fast forward past the voting period (7 days)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Try to execute - should fail because timelock period not over
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Timelock not ended");
      
      // Fast forward past the timelock period (24 hours)
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Should succeed now
      await protocolDAO.executeProposal(proposalId);
      
      // Check executor was called
      expect(await successExecutor.executed()).to.be.true;
    });
    
    it("should not execute proposal that did not pass", async function () {
      // Create proposal
      const tx = await protocolDAO.submitProposal(
        successExecutor.address,
        "Failed proposal test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote NO to fail the proposal
      await protocolDAO.connect(owner).voteProposal(proposalId, false);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, false);
      
      // Fast forward past voting and timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Try to execute - should fail
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal did not pass");
    });
    
    it("should handle executor failures correctly", async function () {
      // Create proposal with failing executor
      const tx = await protocolDAO.submitProposal(
        failureExecutor.address,
        "Failing executor test"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote to pass
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // Fast forward past voting and timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Try to execute - should fail with the executor's error message
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Execution failed");
      
      // Check executor was called
      expect(await failureExecutor.executed()).to.be.true;
    });
  });
});