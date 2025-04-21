/**
 * @title Critical Governance Functions Test
 * @dev Comprehensive test suite for critical governance functions in the D-Loop Protocol
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Load ethers v6 compatibility layer
require("../../utils/ethers-v6-compat.js");

describe("Governance Critical Functions", function () {
  // Test variables
  let aiNodeGovernance;
  let dloopToken;
  let mockTarget;
  let owner;
  let admin;
  let treasury;
  let proposer;
  let voter1;
  let voter2;
  let voter3;
  
  // Constants
  const VOTING_PERIOD = 7 * 86400; // 7 days in seconds
  const EXECUTION_DELAY = 2 * 86400; // 2 days in seconds
  const QUORUM = 51; // 51%
  const PROPOSAL_THRESHOLD = ethers.parseEther("10000"); // 10,000 tokens to submit proposal
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, treasury, proposer, voter1, voter2, voter3] = await ethers.getSigners();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // 1 million initial supply
      ethers.parseEther("10000000"), // 10 million max supply
      owner.address,
      admin.address
    );
    
    // Deploy mock target for testing proposal execution
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      owner.address,
      admin.address,
      treasury.address,
      dloopToken.address,
      VOTING_PERIOD,
      EXECUTION_DELAY,
      QUORUM,
      PROPOSAL_THRESHOLD
    );
    
    // Transfer tokens to proposer and voters
    await dloopToken.connect(owner).transfer(proposer.address, ethers.parseEther("50000"));
    await dloopToken.connect(owner).transfer(voter1.address, ethers.parseEther("200000"));
    await dloopToken.connect(owner).transfer(voter2.address, ethers.parseEther("150000"));
    await dloopToken.connect(owner).transfer(voter3.address, ethers.parseEther("100000"));
    
    // Delegate tokens to self for voting power
    await dloopToken.connect(proposer).delegateTokens(proposer.address, ethers.parseEther("50000"));
    await dloopToken.connect(voter1).delegateTokens(voter1.address, ethers.parseEther("200000"));
    await dloopToken.connect(voter2).delegateTokens(voter2.address, ethers.parseEther("150000"));
    await dloopToken.connect(voter3).delegateTokens(voter3.address, ethers.parseEther("100000"));
  });
  
  describe("Critical Function: submitProposal", function () {
    it("Should allow eligible proposer to submit a proposal", async function () {
      const description = "Test Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      await expect(aiNodeGovernance.connect(proposer).submitProposal(
        description,
        targets,
        values,
        calldatas
      ))
        .to.emit(aiNodeGovernance, "ProposalCreated")
        .withArgs(1, proposer.address, anyValue, anyValue); // 1 is the first proposal ID
      
      const proposal = await aiNodeGovernance.getProposal(1);
      expect(proposal.description).to.equal(description);
      expect(proposal.proposer).to.equal(proposer.address);
      expect(proposal.executed).to.be.false;
      expect(proposal.canceled).to.be.false;
      
      // Check that voting period is set correctly
      const votingEnds = proposal.votingEnds;
      const expectedVotingEnds = (await time.latest()) + VOTING_PERIOD;
      expect(votingEnds).to.be.closeTo(expectedVotingEnds, 5); // Allow for small timing differences
    });
    
    it("Should revert if proposer doesn't have enough tokens", async function () {
      // Deploy a new proposer with insufficient tokens
      const [newProposer] = await ethers.getSigners().then(signers => signers.slice(7, 8));
      await dloopToken.connect(owner).transfer(newProposer.address, ethers.parseEther("5000")); // Less than threshold
      
      const description = "Test Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      await expect(
        aiNodeGovernance.connect(newProposer).submitProposal(
          description,
          targets,
          values,
          calldatas
        )
      ).to.be.revertedWith("Insufficient proposal tokens");
    });
    
    it("Should revert if targets and calldatas length mismatch", async function () {
      const description = "Test Proposal";
      const targets = [mockTarget.address, mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setParameter", [42])];
      
      await expect(
        aiNodeGovernance.connect(proposer).submitProposal(
          description,
          targets,
          values,
          calldatas
        )
      ).to.be.revertedWith("Proposal data length mismatch");
    });
    
    it("Should revert if targets is empty", async function () {
      const description = "Test Proposal";
      const targets = [];
      const values = [];
      const calldatas = [];
      
      await expect(
        aiNodeGovernance.connect(proposer).submitProposal(
          description,
          targets,
          values,
          calldatas
        )
      ).to.be.revertedWith("Empty proposal");
    });
  });
  
  describe("Critical Function: castVote", function () {
    beforeEach(async function () {
      // Create a proposal first
      const description = "Test Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      await aiNodeGovernance.connect(proposer).submitProposal(
        description,
        targets,
        values,
        calldatas
      );
    });
    
    it("Should allow eligible voter to cast vote in favor", async function () {
      await expect(aiNodeGovernance.connect(voter1).castVote(1, true))
        .to.emit(aiNodeGovernance, "VoteCast")
        .withArgs(1, voter1.address, true, anyValue);
      
      const proposal = await aiNodeGovernance.getProposal(1);
      expect(proposal.forVotes).to.equal(ethers.parseEther("200000"));
      expect(proposal.againstVotes).to.equal(0);
      
      // Check that voter is marked as having voted
      expect(await aiNodeGovernance.hasVoted(1, voter1.address)).to.be.true;
    });
    
    it("Should allow eligible voter to cast vote against", async function () {
      await expect(aiNodeGovernance.connect(voter1).castVote(1, false))
        .to.emit(aiNodeGovernance, "VoteCast")
        .withArgs(1, voter1.address, false, anyValue);
      
      const proposal = await aiNodeGovernance.getProposal(1);
      expect(proposal.forVotes).to.equal(0);
      expect(proposal.againstVotes).to.equal(ethers.parseEther("200000"));
      
      // Check that voter is marked as having voted
      expect(await aiNodeGovernance.hasVoted(1, voter1.address)).to.be.true;
    });
    
    it("Should accumulate votes correctly from multiple voters", async function () {
      await aiNodeGovernance.connect(voter1).castVote(1, true);
      await aiNodeGovernance.connect(voter2).castVote(1, true);
      await aiNodeGovernance.connect(voter3).castVote(1, false);
      
      const proposal = await aiNodeGovernance.getProposal(1);
      expect(proposal.forVotes).to.equal(ethers.parseEther("350000")); // 200k + 150k
      expect(proposal.againstVotes).to.equal(ethers.parseEther("100000")); // 100k
    });
    
    it("Should revert if voter has already voted", async function () {
      await aiNodeGovernance.connect(voter1).castVote(1, true);
      
      await expect(
        aiNodeGovernance.connect(voter1).castVote(1, false)
      ).to.be.revertedWith("Already voted");
    });
    
    it("Should revert if voting on non-existent proposal", async function () {
      await expect(
        aiNodeGovernance.connect(voter1).castVote(999, true)
      ).to.be.revertedWith("Proposal does not exist");
    });
    
    it("Should revert if voting after voting period ends", async function () {
      // Advance time past voting period
      await time.increase(VOTING_PERIOD + 1);
      
      await expect(
        aiNodeGovernance.connect(voter1).castVote(1, true)
      ).to.be.revertedWith("Voting period ended");
    });
  });
  
  describe("Critical Function: executeProposal", function () {
    beforeEach(async function () {
      // Create a proposal first
      const description = "Test Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      await aiNodeGovernance.connect(proposer).submitProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      // Cast votes to reach quorum
      await aiNodeGovernance.connect(voter1).castVote(1, true);
      await aiNodeGovernance.connect(voter2).castVote(1, true);
      
      // Advance time past voting period
      await time.increase(VOTING_PERIOD + 1);
    });
    
    it("Should execute successful proposal after execution delay", async function () {
      // Advance time past execution delay
      await time.increase(EXECUTION_DELAY + 1);
      
      await expect(aiNodeGovernance.connect(proposer).executeProposal(1))
        .to.emit(aiNodeGovernance, "ProposalExecuted")
        .withArgs(1);
      
      // Check that proposal is marked as executed
      const proposal = await aiNodeGovernance.getProposal(1);
      expect(proposal.executed).to.be.true;
      
      // Check that the target contract state was updated
      expect(await mockTarget.parameter()).to.equal(42);
    });
    
    it("Should revert if proposal has not passed", async function () {
      // Create a new proposal
      const description = "Failed Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setParameter", [99])];
      
      await aiNodeGovernance.connect(proposer).submitProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      // Cast votes against to make it fail
      await aiNodeGovernance.connect(voter1).castVote(2, false);
      await aiNodeGovernance.connect(voter2).castVote(2, false);
      
      // Advance time past voting period and execution delay
      await time.increase(VOTING_PERIOD + EXECUTION_DELAY + 1);
      
      await expect(
        aiNodeGovernance.connect(proposer).executeProposal(2)
      ).to.be.revertedWith("Proposal not passed");
    });
    
    it("Should revert if execution delay has not passed", async function () {
      await expect(
        aiNodeGovernance.connect(proposer).executeProposal(1)
      ).to.be.revertedWith("Execution delay not passed");
    });
    
    it("Should revert if proposal has already been executed", async function () {
      // Advance time past execution delay
      await time.increase(EXECUTION_DELAY + 1);
      
      // Execute the proposal
      await aiNodeGovernance.connect(proposer).executeProposal(1);
      
      // Try to execute again
      await expect(
        aiNodeGovernance.connect(proposer).executeProposal(1)
      ).to.be.revertedWith("Proposal already executed");
    });
    
    it("Should revert if proposal has been canceled", async function () {
      // Cancel the proposal
      await aiNodeGovernance.connect(proposer).cancelProposal(1);
      
      // Advance time past execution delay
      await time.increase(EXECUTION_DELAY + 1);
      
      await expect(
        aiNodeGovernance.connect(proposer).executeProposal(1)
      ).to.be.revertedWith("Proposal canceled");
    });
  });
});

// Helper function to match any value in event args
function anyValue() {
  return true;
}
