const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("GovernanceTracker", function () {
  let GovernanceTracker;
  let governanceTracker;
  let owner, governance, oracle, user1, user2;
  
  // Constants for testing
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  const DAY_IN_SECONDS = 24 * 60 * 60;
  const MONTH_IN_SECONDS = 30 * DAY_IN_SECONDS;
  
  beforeEach(async function () {
    [owner, governance, oracle, user1, user2] = await ethers.getSigners();
    
    GovernanceTracker = await ethers.getContractFactory("GovernanceTracker");
    governanceTracker = await upgrades.deployProxy(GovernanceTracker, [MONTH_IN_SECONDS]);
    await governanceTracker.deployed();
    
    // Grant roles
    await governanceTracker.grantRole(GOVERNANCE_ROLE, governance.address);
    await governanceTracker.grantRole(ORACLE_ROLE, oracle.address);
  });
  
  describe("Initialization", function () {
    it("should set the period duration correctly", async function () {
      expect(await governanceTracker.periodDuration()).to.equal(MONTH_IN_SECONDS);
    });
    
    it("should assign roles correctly", async function () {
      expect(await governanceTracker.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await governanceTracker.hasRole(GOVERNANCE_ROLE, governance.address)).to.be.true;
      expect(await governanceTracker.hasRole(ORACLE_ROLE, oracle.address)).to.be.true;
    });
    
    it("should create an initial reward period", async function () {
      expect(await governanceTracker.currentPeriodId()).to.equal(0);
      
      const period = await governanceTracker.rewardPeriods(0);
      expect(period.finalized).to.be.false;
      
      // Period duration should be MONTH_IN_SECONDS
      expect(period.endTime.sub(period.startTime)).to.equal(MONTH_IN_SECONDS);
    });
  });
  
  describe("Governance Tracking", function () {
    it("should record proposal creation", async function () {
      await governanceTracker.connect(governance).recordProposalCreation(user1.address, 1);
      
      const stats = await governanceTracker.getUserStats(user1.address);
      expect(stats.proposals).to.equal(1);
      expect(stats.totalScore).to.be.gt(0);
      
      const score = await governanceTracker.getUserPeriodScore(user1.address, 0);
      expect(score).to.be.gt(0);
    });
    
    it("should record votes", async function () {
      await governanceTracker.connect(governance).recordVote(user1.address, 1, true);
      await governanceTracker.connect(governance).recordVote(user2.address, 1, false);
      
      const stats1 = await governanceTracker.getUserStats(user1.address);
      expect(stats1.votes).to.equal(1);
      expect(stats1.totalScore).to.be.gt(0);
      
      const stats2 = await governanceTracker.getUserStats(user2.address);
      expect(stats2.votes).to.equal(1);
      expect(stats2.totalScore).to.be.gt(0);
    });
    
    it("should record proposal outcomes", async function () {
      // Record a proposal and votes
      await governanceTracker.connect(governance).recordProposalCreation(user1.address, 1);
      await governanceTracker.connect(governance).recordVote(user1.address, 1, true);
      await governanceTracker.connect(governance).recordVote(user2.address, 1, false);
      
      // Record the outcome
      await governanceTracker.connect(governance).recordProposalOutcome(1, true);
      
      // Evaluate the impact with the oracle
      await governanceTracker.connect(oracle).evaluateProposalImpact(1, true);
      
      // Check stats - user1 voted correctly (YES on a successful proposal)
      const stats1 = await governanceTracker.getUserStats(user1.address);
      expect(stats1.votes).to.equal(1);
      expect(stats1.correctVotes).to.equal(1);
      expect(stats1.totalScore).to.be.gt(0);
      
      // Check stats - user2 voted incorrectly (NO on a successful proposal)
      const stats2 = await governanceTracker.getUserStats(user2.address);
      expect(stats2.votes).to.equal(1);
      expect(stats2.correctVotes).to.equal(0);
    });
    
    it("should reject operations from unauthorized addresses", async function () {
      await expect(
        governanceTracker.connect(user1).recordProposalCreation(user1.address, 1)
      ).to.be.reverted;
      
      await expect(
        governanceTracker.connect(user1).recordVote(user1.address, 1, true)
      ).to.be.reverted;
      
      await expect(
        governanceTracker.connect(user1).recordProposalOutcome(1, true)
      ).to.be.reverted;
      
      await expect(
        governanceTracker.connect(user1).evaluateProposalImpact(1, true)
      ).to.be.reverted;
    });
  });
  
  describe("Reward Periods", function () {
    it("should create new periods automatically when needed", async function () {
      // Fast forward time past the first period
      await ethers.provider.send("evm_increaseTime", [MONTH_IN_SECONDS + 1]);
      await ethers.provider.send("evm_mine");
      
      // Record an activity to trigger period check
      await governanceTracker.connect(governance).recordProposalCreation(user1.address, 1);
      
      // Check that a new period was created
      expect(await governanceTracker.currentPeriodId()).to.equal(1);
      
      // First period should end at the same time the second one starts
      const period0 = await governanceTracker.rewardPeriods(0);
      const period1 = await governanceTracker.rewardPeriods(1);
      
      expect(period1.startTime).to.be.gte(period0.endTime);
    });
    
    it("should allow finalizing a completed period", async function () {
      // Fast forward time past the first period
      await ethers.provider.send("evm_increaseTime", [MONTH_IN_SECONDS + 1]);
      await ethers.provider.send("evm_mine");
      
      // Finalize the period
      await governanceTracker.connect(owner).finalizeRewardPeriod(0);
      
      // Check that the period is finalized
      const period = await governanceTracker.rewardPeriods(0);
      expect(period.finalized).to.be.true;
      expect(period.totalParticipationScore).to.be.gt(0);
    });
    
    it("should reject finalizing a period that hasn't ended", async function () {
      await expect(
        governanceTracker.finalizeRewardPeriod(0)
      ).to.be.revertedWith("PeriodNotEnded()");
    });
  });
  
  describe("Admin Functions", function () {
    it("should allow updating weights", async function () {
      await governanceTracker.connect(owner).updateWeights(1000, 4000, 5000);
      
      expect(await governanceTracker.proposalCreationWeight()).to.equal(1000);
      expect(await governanceTracker.voteParticipationWeight()).to.equal(4000);
      expect(await governanceTracker.voteAccuracyWeight()).to.equal(5000);
    });
    
    it("should require weights to sum to 100%", async function () {
      await expect(
        governanceTracker.updateWeights(1000, 4000, 4000)
      ).to.be.revertedWith("InvalidParameters()");
    });
    
    it("should allow updating the period duration", async function () {
      const newDuration = 2 * MONTH_IN_SECONDS;
      await governanceTracker.connect(owner).updatePeriodDuration(newDuration);
      
      expect(await governanceTracker.periodDuration()).to.equal(newDuration);
    });
    
    it("should allow manually starting a new period", async function () {
      await governanceTracker.connect(owner).manuallyStartNewPeriod();
      
      expect(await governanceTracker.currentPeriodId()).to.equal(1);
    });
  });
});