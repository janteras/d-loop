const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Protocol DAO Governance", function () {
  let protocolDAO;
  let aiNodeRegistry;
  let feeCalculator;
  let pausableContract;
  let upgradeExecuter;
  let parameterAdjuster;
  let emergencyPauser;
  let owner;
  let aiNodes;
  let regularUsers;
  let validators;
  
  // Keep track of proposal IDs
  let proposalId = 0;
  
  before(async function () {
    // Get signers for different roles
    [owner, ...signers] = await ethers.getSigners();
    
    // Assign signers to different roles
    validators = signers.slice(0, 3);   // First 3 signers as validators
    aiNodes = signers.slice(3, 8);      // Next 5 signers as AI nodes
    regularUsers = signers.slice(8, 13); // Last 5 signers as regular users
  });

  beforeEach(async function () {
    // Deploy AINodeRegistry (mock for testing)
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      ethers.constants.AddressZero, // Mock address
      100, // Initial reputation
      2,   // Verification threshold
      30 * 24 * 60 * 60 // 30 day inactivity timeout
    );
    
    // Verify some AI nodes
    for (let node of aiNodes) {
      await aiNodeRegistry.addVerifiedAINode(node.address, 100);
    }
    
    // Deploy FeeCalculator for parameter adjuster
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(50, 50, 200); // 0.5%, 0.5%, 2%
    
    // Deploy a mock pausable contract for emergency pauser
    const MockPausable = await ethers.getContractFactory("MockPausable");
    pausableContract = await MockPausable.deploy();
    
    // Deploy ProtocolDAOWithAINodes
    const ProtocolDAOWithAINodes = await ethers.getContractFactory("ProtocolDAOWithAINodes");
    protocolDAO = await ProtocolDAOWithAINodes.deploy(
      aiNodeRegistry.address,
      owner.address
    );
    
    // Deploy executors
    const UpgradeExecuter = await ethers.getContractFactory("UpgradeExecuter");
    upgradeExecuter = await UpgradeExecuter.deploy(pausableContract.address);
    
    const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(feeCalculator.address);
    
    const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(pausableContract.address);
    
    // Whitelist executors in ProtocolDAO
    await protocolDAO.updateExecuter(upgradeExecuter.address, true);
    await protocolDAO.updateExecuter(parameterAdjuster.address, true);
    await protocolDAO.updateExecuter(emergencyPauser.address, true);
    
    // Set up roles for mock contracts
    await pausableContract.setProtocolDAO(protocolDAO.address);
    await feeCalculator.transferOwnership(protocolDAO.address);
  });

  describe("Proposal Lifecycle", function () {
    it("should allow submitting proposals with whitelisted executers", async function () {
      // Submit a proposal using the ParameterAdjuster
      await expect(
        protocolDAO.submitProposal(parameterAdjuster.address)
      ).to.emit(protocolDAO, "ProposalCreated");
      
      proposalId++;
    });

    it("should reject proposals with non-whitelisted executers", async function () {
      // Try to submit with a random address
      await expect(
        protocolDAO.submitProposal(regularUsers[0].address)
      ).to.be.revertedWith("Invalid executer");
    });

    it("should track proposal details correctly", async function () {
      // Submit a proposal
      await protocolDAO.submitProposal(parameterAdjuster.address);
      proposalId++;
      
      // Get proposal details
      const proposal = await protocolDAO.proposals(proposalId);
      
      expect(proposal.submitter).to.equal(owner.address);
      expect(proposal.executer).to.equal(parameterAdjuster.address);
      expect(proposal.executed).to.be.false;
      
      // Should have correct expiration based on submitter
      const expectedDuration = await protocolDAO.getVotingPeriod(owner.address);
      expect(Number(proposal.timelockEnd) - Number(proposal.expires)).to.equal(24 * 60 * 60); // 24h timelock
    });
    
    it("should apply different voting periods for AI nodes vs regular users", async function () {
      // Submit proposal as AI node
      await protocolDAO.connect(aiNodes[0]).submitProposal(parameterAdjuster.address);
      proposalId++;
      let aiProposal = await protocolDAO.proposals(proposalId);
      
      // Submit proposal as regular user
      await protocolDAO.connect(regularUsers[0]).submitProposal(parameterAdjuster.address);
      proposalId++;
      let regularProposal = await protocolDAO.proposals(proposalId);
      
      // AI node voting period should be shorter
      const aiExpires = Number(aiProposal.expires);
      const regularExpires = Number(regularProposal.expires);
      
      // AI node = 48 hours, Regular = 72 hours (comparing from same block.timestamp)
      const difference = regularExpires - aiExpires;
      expect(difference).to.be.closeTo(24 * 60 * 60, 5); // ~24 hour difference, allowing 5 seconds for test execution
    });
  });

  describe("Voting Mechanics", function () {
    let proposalId;
    
    beforeEach(async function () {
      // Submit a fresh proposal for each test
      await protocolDAO.submitProposal(parameterAdjuster.address);
      proposalId = 1;
    });

    it("should allow voting on proposals", async function () {
      // Cast votes
      await protocolDAO.voteProposal(proposalId, true); // Yes vote
      await protocolDAO.connect(regularUsers[0]).voteProposal(proposalId, false); // No vote
      
      // Check vote counts
      const proposal = await protocolDAO.proposals(proposalId);
      expect(proposal.yes).to.equal(1);
      expect(proposal.no).to.equal(1);
    });

    it("should not allow double voting", async function () {
      // Vote once
      await protocolDAO.voteProposal(proposalId, true);
      
      // Try to vote again
      await expect(
        protocolDAO.voteProposal(proposalId, true)
      ).to.be.revertedWith("Already voted");
    });

    it("should not allow voting on expired proposals", async function () {
      // Advance time past proposal expiration
      const proposal = await protocolDAO.proposals(proposalId);
      const expires = Number(proposal.expires);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = expires - now + 10; // Add 10 seconds to ensure expiration
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Try to vote after expiration
      await expect(
        protocolDAO.voteProposal(proposalId, true)
      ).to.be.revertedWith("Proposal expired");
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      // Submit a proposal for parameter adjustment
      await protocolDAO.submitProposal(parameterAdjuster.address);
      proposalId = 1;
      
      // Get enough votes to pass quorum (30% if regular proposal)
      // For testing, we'll have 10 accounts vote yes
      for (let i = 0; i < 10; i++) {
        await protocolDAO.connect(signers[i]).voteProposal(proposalId, true);
      }
    });

    it("should not execute before timelock ends", async function () {
      // Try to execute immediately
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Timelock active");
    });

    it("should execute proposal after timelock and with sufficient approvals", async function () {
      // Get proposal details
      const proposal = await protocolDAO.proposals(proposalId);
      
      // Advance time past timelock
      const timelock = Number(proposal.timelockEnd);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = timelock - now + 10; // Add 10 seconds to ensure timelock passed
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Execute proposal
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.emit(protocolDAO, "ProposalExecuted");
      
      // Verify execution
      const afterExecution = await protocolDAO.proposals(proposalId);
      expect(afterExecution.executed).to.be.true;
    });

    it("should not execute rejected proposals", async function () {
      // Submit a new proposal
      await protocolDAO.submitProposal(parameterAdjuster.address);
      proposalId = 2;
      
      // Get enough votes to reject (more NO than YES)
      for (let i = 0; i < 5; i++) {
        await protocolDAO.connect(signers[i]).voteProposal(proposalId, true); // 5 YES
      }
      for (let i = 5; i < 15; i++) {
        await protocolDAO.connect(signers[i]).voteProposal(proposalId, false); // 10 NO
      }
      
      // Advance time past timelock
      const proposal = await protocolDAO.proposals(proposalId);
      const timelock = Number(proposal.timelockEnd);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = timelock - now + 10;
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Try to execute rejected proposal
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Not passed");
    });
  });

  describe("Executor Contracts Integration", function () {
    it("should update parameters via ParameterAdjuster", async function () {
      // Initial values
      const initialFees = await feeCalculator.getFeeRates();
      
      // Submit proposal for parameter adjustment
      await protocolDAO.submitProposal(parameterAdjuster.address);
      proposalId = 1;
      
      // Get enough votes to pass
      for (let i = 0; i < 10; i++) {
        await protocolDAO.connect(signers[i]).voteProposal(proposalId, true);
      }
      
      // Advance time past timelock
      const proposal = await protocolDAO.proposals(proposalId);
      const timelock = Number(proposal.timelockEnd);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = timelock - now + 10;
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Execute proposal
      await protocolDAO.executeProposal(proposalId);
      
      // Verify parameters changed
      const newFees = await feeCalculator.getFeeRates();
      expect(newFees[0]).to.not.equal(initialFees[0]);
    });

    it("should activate emergency pause via EmergencyPauser", async function () {
      // Check initial pause state
      expect(await pausableContract.paused()).to.be.false;
      
      // Submit proposal for emergency pause
      await protocolDAO.submitProposal(emergencyPauser.address);
      proposalId = 1;
      
      // Get enough votes to pass
      for (let i = 0; i < 10; i++) {
        await protocolDAO.connect(signers[i]).voteProposal(proposalId, true);
      }
      
      // Advance time past timelock
      const proposal = await protocolDAO.proposals(proposalId);
      const timelock = Number(proposal.timelockEnd);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = timelock - now + 10;
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Execute proposal
      await protocolDAO.executeProposal(proposalId);
      
      // Verify contract is paused
      expect(await pausableContract.paused()).to.be.true;
    });
  });

  describe("Quorum Requirements", function () {
    it("should require higher quorum for AI node proposals", async function () {
      // Submit as AI node
      await protocolDAO.connect(aiNodes[0]).submitProposal(parameterAdjuster.address);
      const aiProposalId = 1;
      
      // Submit as regular user
      await protocolDAO.connect(regularUsers[0]).submitProposal(parameterAdjuster.address);
      const regularProposalId = 2;
      
      // Vote on AI proposal (30% votes, insufficient for 40% quorum)
      for (let i = 0; i < 6; i++) { // 30% of 20 signers = 6
        await protocolDAO.connect(signers[i]).voteProposal(aiProposalId, true);
      }
      
      // Vote on regular proposal (30% votes, sufficient for 30% quorum)
      for (let i = 0; i < 6; i++) { // 30% of 20 signers = 6
        await protocolDAO.connect(signers[i]).voteProposal(regularProposalId, true);
      }
      
      // Advance time past timelock
      const proposal = await protocolDAO.proposals(aiProposalId);
      const timelock = Number(proposal.timelockEnd);
      const now = Math.floor(Date.now() / 1000);
      const timeToAdvance = timelock - now + 10;
      
      await ethers.provider.send("evm_increaseTime", [timeToAdvance]);
      await ethers.provider.send("evm_mine");
      
      // Try to execute AI proposal with insufficient quorum
      await expect(
        protocolDAO.executeProposal(aiProposalId)
      ).to.be.revertedWith("Not passed");
      
      // Execute regular proposal with sufficient quorum
      await expect(
        protocolDAO.executeProposal(regularProposalId)
      ).to.emit(protocolDAO, "ProposalExecuted");
    });
  });
});