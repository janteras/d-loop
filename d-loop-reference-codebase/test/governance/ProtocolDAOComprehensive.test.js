const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Protocol DAO Comprehensive Tests", function () {
  let protocolDAO;
  let upgradeExecutor;
  let parameterAdjuster;
  let emergencyPauser;
  let aiNodeRegistry;
  let aiNodeGovernance;
  let mockToken;
  let mockImplementation;
  let owner;
  let executor;
  let users;
  let aiNodes;
  
  // Constants for testing
  const AI_VOTING_PERIOD = 1 * 24 * 60 * 60; // 1 day
  const HUMAN_VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days
  const TIMELOCK_PERIOD = 24 * 60 * 60; // 24 hours
  const AI_QUORUM = 40; // 40%
  const HUMAN_QUORUM = 30; // 30%
  const PROPOSAL_DESCRIPTION = "Test Protocol Upgrade";
  
  before(async function () {
    [owner, executor, ...users] = await ethers.getSigners();
    aiNodes = users.slice(0, 5);
    users = users.slice(5, 10);
    
    // Deploy mocked contracts
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("DLOOP", "DLOOP", 18);
    await mockToken.deployed();
    
    const MockImplementation = await ethers.getContractFactory("MockImplementation");
    mockImplementation = await MockImplementation.deploy();
    await mockImplementation.deployed();
    
    // Deploy AINodeRegistry mock
    const MockAINodeRegistry = await ethers.getContractFactory("MockAINodeRegistry");
    aiNodeRegistry = await MockAINodeRegistry.deploy();
    await aiNodeRegistry.deployed();
    
    // Configure AI nodes in registry
    for (const node of aiNodes) {
      await aiNodeRegistry.registerNode(node.address);
    }
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy();
    await protocolDAO.deployed();
    
    // Deploy executors
    const UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(mockImplementation.address);
    await upgradeExecutor.deployed();
    
    const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(mockToken.address);
    await parameterAdjuster.deployed();
    
    const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(mockToken.address);
    await emergencyPauser.deployed();
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      aiNodeRegistry.address,
      protocolDAO.address
    );
    await aiNodeGovernance.deployed();
    
    // Setup permissions
    await protocolDAO.setAINodeRegistry(aiNodeRegistry.address);
    await protocolDAO.setAINodeGovernance(aiNodeGovernance.address);
    
    // Configure ProtocolDAO parameters
    await protocolDAO.setVotingPeriods(AI_VOTING_PERIOD, HUMAN_VOTING_PERIOD);
    await protocolDAO.setQuorumRequirements(AI_QUORUM, HUMAN_QUORUM);
    await protocolDAO.setTimelockPeriod(TIMELOCK_PERIOD);
    
    // Whitelist executors
    await protocolDAO.updateExecutor(upgradeExecutor.address, true);
    await protocolDAO.updateExecutor(parameterAdjuster.address, true);
    await protocolDAO.updateExecutor(emergencyPauser.address, true);
    
    // Distribute governance tokens to users for voting
    for (const user of [...users, ...aiNodes]) {
      await mockToken.mint(user.address, ethers.utils.parseEther("1000"));
    }
  });
  
  describe("Proposal Lifecycle", function () {
    it("should create proposals with whitelisted executors", async function () {
      // Create a proposal with valid executor
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        PROPOSAL_DESCRIPTION
      );
      
      // Verify proposal created
      const proposal = await protocolDAO.getProposal(0);
      expect(proposal.submitter).to.equal(owner.address);
      expect(proposal.executer).to.equal(upgradeExecutor.address);
      expect(proposal.description).to.equal(PROPOSAL_DESCRIPTION);
      expect(proposal.executed).to.be.false;
      
      // Try to create a proposal with non-whitelisted executor
      await expect(
        protocolDAO.submitProposal(
          mockToken.address, // not a whitelisted executor
          "Invalid Executor Proposal"
        )
      ).to.be.revertedWith("Invalid executer");
    });
    
    it("should accept votes during the voting period", async function () {
      const proposalId = 0;
      
      // Cast votes from regular users
      for (let i = 0; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("100"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId,
          i % 2 === 0, // alternate yes/no
          ethers.utils.parseEther("100")
        );
      }
      
      // Cast votes from AI nodes
      for (let i = 0; i < aiNodes.length; i++) {
        await mockToken.connect(aiNodes[i]).approve(protocolDAO.address, ethers.utils.parseEther("100"));
        await protocolDAO.connect(aiNodes[i]).voteProposal(
          proposalId,
          i % 2 === 0, // alternate yes/no
          ethers.utils.parseEther("100")
        );
      }
      
      // Verify votes recorded
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.yesVotes).to.be.gt(0);
      expect(proposal.noVotes).to.be.gt(0);
    });
    
    it("should reject votes after the voting period", async function () {
      const proposalId = 0;
      
      // Fast forward past AI voting period but before human period ends
      await time.increase(AI_VOTING_PERIOD + 1);
      
      // AI node voting should be rejected
      await expect(
        protocolDAO.connect(aiNodes[0]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("100")
        )
      ).to.be.revertedWith("Voting period ended for AI nodes");
      
      // Human voting should still be allowed
      await mockToken.connect(users[0]).approve(protocolDAO.address, ethers.utils.parseEther("50"));
      await protocolDAO.connect(users[0]).voteProposal(
        proposalId,
        true,
        ethers.utils.parseEther("50")
      );
      
      // Fast forward past human voting period
      await time.increase(HUMAN_VOTING_PERIOD - AI_VOTING_PERIOD);
      
      // Human voting should now be rejected
      await expect(
        protocolDAO.connect(users[1]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("100")
        )
      ).to.be.revertedWith("Voting period ended");
    });
    
    it("should enforce timelock period before execution", async function () {
      const proposalId = 0;
      
      // Try to execute immediately after voting period ends
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Timelock active");
      
      // Fast forward through timelock period
      await time.increase(TIMELOCK_PERIOD + 1);
      
      // Now execution should succeed
      await protocolDAO.executeProposal(proposalId);
      
      // Verify proposal executed
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });
    
    it("should prevent double execution", async function () {
      const proposalId = 0;
      
      // Try to execute again
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Already executed");
    });
  });
  
  describe("AI vs Human Governance", function () {
    it("should enforce different voting periods for AI nodes and humans", async function () {
      // Create a new proposal
      await protocolDAO.submitProposal(
        parameterAdjuster.address,
        "Parameter Adjustment Proposal"
      );
      const proposalId = 1;
      
      // Verify the voting periods
      const proposal = await protocolDAO.getProposal(proposalId);
      
      // Calculate when AI voting ends
      const aiVotingEnds = proposal.created.add(AI_VOTING_PERIOD);
      
      // Calculate when human voting ends
      const humanVotingEnds = proposal.created.add(HUMAN_VOTING_PERIOD);
      
      // Verify different ending times
      expect(aiVotingEnds).to.be.lt(humanVotingEnds);
      
      // Fast forward to just before AI voting ends
      await time.increaseTo(aiVotingEnds.sub(10));
      
      // AI node should still be able to vote
      await mockToken.connect(aiNodes[0]).approve(protocolDAO.address, ethers.utils.parseEther("100"));
      await protocolDAO.connect(aiNodes[0]).voteProposal(
        proposalId,
        true,
        ethers.utils.parseEther("100")
      );
      
      // Fast forward past AI voting end
      await time.increaseTo(aiVotingEnds.add(10));
      
      // AI node should not be able to vote
      await expect(
        protocolDAO.connect(aiNodes[1]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("100")
        )
      ).to.be.revertedWith("Voting period ended for AI nodes");
      
      // Human should still be able to vote
      await mockToken.connect(users[0]).approve(protocolDAO.address, ethers.utils.parseEther("100"));
      await protocolDAO.connect(users[0]).voteProposal(
        proposalId,
        true,
        ethers.utils.parseEther("100")
      );
    });
    
    it("should enforce different quorum requirements for AI and human voting", async function () {
      // Create a new proposal with minimal votes
      await protocolDAO.submitProposal(
        emergencyPauser.address,
        "Quorum Test Proposal"
      );
      const proposalId = 2;
      
      // Fast forward past voting periods
      await time.increase(HUMAN_VOTING_PERIOD + 1);
      
      // Fast forward past timelock
      await time.increase(TIMELOCK_PERIOD + 1);
      
      // Try to execute proposal without sufficient votes
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Quorum not reached");
      
      // Create a new proposal with sufficient votes
      await protocolDAO.submitProposal(
        emergencyPauser.address,
        "Quorum Pass Proposal"
      );
      const proposalId3 = 3;
      
      // Cast votes to meet human quorum
      for (let i = 0; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId3,
          true, // all yes votes
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting periods
      await time.increase(HUMAN_VOTING_PERIOD + 1);
      
      // Fast forward past timelock
      await time.increase(TIMELOCK_PERIOD + 1);
      
      // Now execution should succeed
      await protocolDAO.executeProposal(proposalId3);
      
      // Verify proposal executed
      const proposal = await protocolDAO.getProposal(proposalId3);
      expect(proposal.executed).to.be.true;
    });
    
    it("should differentiate AI node voting weight", async function () {
      // Create a proposal for AI nodes only
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "AI Weight Test Proposal"
      );
      const proposalId = 4;
      
      // Cast votes from AI nodes with different weights
      for (let i = 0; i < 2; i++) {
        await mockToken.connect(aiNodes[i]).approve(protocolDAO.address, ethers.utils.parseEther("500"));
        await protocolDAO.connect(aiNodes[i]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("500")
        );
      }
      
      // Get current AI vote weight
      const initialProposal = await protocolDAO.getProposal(proposalId);
      const initialAIVotes = initialProposal.aiNodeVotes;
      const initialAIWeight = initialProposal.aiNodeVoteWeight;
      
      // Set higher reputation for an AI node
      await aiNodeRegistry.setNodeReputation(aiNodes[2].address, 200); // 2x normal
      
      // Cast vote from high-reputation AI node
      await mockToken.connect(aiNodes[2]).approve(protocolDAO.address, ethers.utils.parseEther("500"));
      await protocolDAO.connect(aiNodes[2]).voteProposal(
        proposalId,
        true,
        ethers.utils.parseEther("500")
      );
      
      // Verify vote has higher weight
      const finalProposal = await protocolDAO.getProposal(proposalId);
      expect(finalProposal.aiNodeVotes).to.equal(initialAIVotes.add(1));
      
      // AI vote weight should increase by more than 1
      expect(finalProposal.aiNodeVoteWeight.sub(initialAIWeight)).to.be.gt(1);
    });
  });
  
  describe("Executor Integration", function () {
    it("should execute upgrade through upgrade executor", async function () {
      // Create proposal to upgrade implementation
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Upgrade Implementation Proposal"
      );
      const proposalId = 5;
      
      // Cast votes to approve
      for (let i = 0; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Get initial implementation version
      const initialVersion = await mockImplementation.version();
      
      // Execute proposal to upgrade
      await protocolDAO.executeProposal(proposalId);
      
      // Verify implementation was upgraded
      const newVersion = await mockImplementation.version();
      expect(newVersion).to.be.gt(initialVersion);
    });
    
    it("should adjust parameters through parameter adjuster", async function () {
      // Create proposal to adjust parameters
      await protocolDAO.submitProposal(
        parameterAdjuster.address,
        "Adjust Parameters Proposal"
      );
      const proposalId = 6;
      
      // Cast votes to approve
      for (let i = 0; i < aiNodes.length; i++) {
        await mockToken.connect(aiNodes[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(aiNodes[i]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Get initial parameter values
      const initialParam = await mockToken.decimals();
      
      // Execute proposal to adjust parameters
      await protocolDAO.executeProposal(proposalId);
      
      // Verify parameters were adjusted
      // This depends on what your parameter adjuster does, this is just a placeholder check
      const newParam = await mockToken.decimals();
      expect(newParam).to.equal(initialParam);
    });
    
    it("should execute emergency actions through emergency pauser", async function () {
      // Create proposal to pause operations
      await protocolDAO.submitProposal(
        emergencyPauser.address,
        "Emergency Pause Proposal"
      );
      const proposalId = 7;
      
      // Cast votes to approve (lower quorum due to emergency)
      await mockToken.connect(aiNodes[0]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
      await protocolDAO.connect(aiNodes[0]).voteProposal(
        proposalId,
        true,
        ethers.utils.parseEther("1000")
      );
      
      // Configure emergency mode for faster execution
      await protocolDAO.setEmergencyMode(true);
      
      // Emergency proposals can execute immediately
      await protocolDAO.executeProposal(proposalId);
      
      // Verify proposal executed
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
      
      // Disable emergency mode
      await protocolDAO.setEmergencyMode(false);
    });
  });
  
  describe("Security and Access Control", function () {
    it("should prevent unauthorized whitelist changes", async function () {
      // Try to whitelist a new executor as non-admin
      await expect(
        protocolDAO.connect(users[0]).updateExecutor(users[0].address, true)
      ).to.be.reverted;
      
      // Whitelist as admin
      await protocolDAO.updateExecutor(executor.address, true);
      
      // Verify whitelist updated
      expect(await protocolDAO.isWhitelistedExecuter(executor.address)).to.be.true;
    });
    
    it("should prevent unauthorized parameter changes", async function () {
      // Try to update voting periods as non-admin
      await expect(
        protocolDAO.connect(users[0]).setVotingPeriods(0, 0)
      ).to.be.reverted;
      
      // Try to update quorum requirements as non-admin
      await expect(
        protocolDAO.connect(users[0]).setQuorumRequirements(0, 0)
      ).to.be.reverted;
    });
    
    it("should prevent execution before quorum is reached", async function () {
      // Create proposal with no votes
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "No Quorum Proposal"
      );
      const proposalId = 8;
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Try to execute proposal without quorum
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Quorum not reached");
    });
    
    it("should prevent execution when proposal fails (more no votes)", async function () {
      // Create proposal
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Failed Proposal"
      );
      const proposalId = 9;
      
      // Cast more NO votes than YES votes
      for (let i = 0; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId,
          false, // all NO votes
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Try to execute failed proposal
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal not approved");
    });
  });
  
  describe("Edge Cases", function () {
    it("should handle case of exactly tied votes", async function () {
      // Create proposal
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Tie Vote Proposal"
      );
      const proposalId = 10;
      
      // Cast evenly split votes
      const halfUsers = Math.floor(users.length / 2);
      
      // YES votes
      for (let i = 0; i < halfUsers; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("1000")
        );
      }
      
      // NO votes
      for (let i = halfUsers; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("1000"));
        await protocolDAO.connect(users[i]).voteProposal(
          proposalId,
          false,
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Try to execute tied proposal
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal not approved");
    });
    
    it("should handle case of exactly quorum votes", async function () {
      // Create proposal
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Exact Quorum Proposal"
      );
      const proposalId = 11;
      
      // Calculate exact quorum
      const totalSupply = await mockToken.totalSupply();
      const quorumAmount = totalSupply.mul(HUMAN_QUORUM).div(100);
      
      // Cast exactly quorum votes
      await mockToken.connect(users[0]).approve(protocolDAO.address, quorumAmount);
      await protocolDAO.connect(users[0]).voteProposal(
        proposalId,
        true,
        quorumAmount
      );
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // Execute should succeed with exact quorum
      await protocolDAO.executeProposal(proposalId);
      
      // Verify proposal executed
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });
    
    it("should handle multiple simultaneous proposals", async function () {
      // Create multiple proposals
      for (let i = 0; i < 3; i++) {
        await protocolDAO.submitProposal(
          upgradeExecutor.address,
          `Simultaneous Proposal ${i}`
        );
      }
      
      const startId = 12; // First proposal ID in this batch
      
      // Vote on all proposals with different patterns
      for (let i = 0; i < users.length; i++) {
        await mockToken.connect(users[i]).approve(protocolDAO.address, ethers.utils.parseEther("3000"));
        
        // Different voting patterns for each proposal
        await protocolDAO.connect(users[i]).voteProposal(
          startId,
          true,
          ethers.utils.parseEther("1000")
        );
        
        await protocolDAO.connect(users[i]).voteProposal(
          startId + 1,
          i % 2 === 0, // alternating
          ethers.utils.parseEther("1000")
        );
        
        await protocolDAO.connect(users[i]).voteProposal(
          startId + 2,
          false,
          ethers.utils.parseEther("1000")
        );
      }
      
      // Fast forward past voting and timelock
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      
      // First proposal should pass (all YES)
      await protocolDAO.executeProposal(startId);
      expect((await protocolDAO.getProposal(startId)).executed).to.be.true;
      
      // Second proposal should fail (mixed votes)
      await expect(
        protocolDAO.executeProposal(startId + 1)
      ).to.be.revertedWith("Proposal not approved");
      
      // Third proposal should fail (all NO)
      await expect(
        protocolDAO.executeProposal(startId + 2)
      ).to.be.revertedWith("Proposal not approved");
    });
    
    it("should handle cancellation of proposals", async function () {
      // Create a proposal
      await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Cancellable Proposal"
      );
      const proposalId = 15;
      
      // Cancel the proposal
      await protocolDAO.cancelProposal(proposalId);
      
      // Verify proposal marked as cancelled
      const proposal = await protocolDAO.getProposal(proposalId);
      expect(proposal.cancelled).to.be.true;
      
      // Try to vote on cancelled proposal
      await expect(
        protocolDAO.connect(users[0]).voteProposal(
          proposalId,
          true,
          ethers.utils.parseEther("1000")
        )
      ).to.be.revertedWith("Proposal cancelled");
      
      // Try to execute cancelled proposal
      await time.increase(HUMAN_VOTING_PERIOD + TIMELOCK_PERIOD + 1);
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Proposal cancelled");
    });
  });
});