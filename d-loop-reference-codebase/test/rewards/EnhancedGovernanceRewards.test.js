const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EnhancedGovernanceRewards", function () {
  let admin, user1, user2, user3, tracker, oracle;
  let dloopToken, rewards;
  
  const advanceTime = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  };
  
  const days = (n) => n * 24 * 60 * 60;
  
  beforeEach(async function () {
    [admin, user1, user2, user3, tracker, oracle] = await ethers.getSigners();
    
    // Deploy DLOOP token
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy();
    await dloopToken.deployed();
    
    // Mint tokens for rewards
    await dloopToken.mint(admin.address, ethers.utils.parseEther("20016000")); // Total rewards pool
    
    // Deploy rewards contract
    const EnhancedGovernanceRewards = await ethers.getContractFactory("EnhancedGovernanceRewards");
    rewards = await EnhancedGovernanceRewards.deploy(admin.address, dloopToken.address);
    await rewards.deployed();
    
    // Transfer tokens to rewards contract
    await dloopToken.transfer(rewards.address, ethers.utils.parseEther("20016000"));
    
    // Set up roles
    await rewards.grantProposalTrackerRole(tracker.address);
    await rewards.grantOracleRole(oracle.address);
  });
  
  describe("Basic Functionality", function () {
    it("should correctly initialize", async function () {
      expect(await rewards.currentEpoch()).to.equal(0);
      expect(await rewards.dloopToken()).to.equal(dloopToken.address);
    });
    
    it("should update epoch correctly", async function () {
      // Advance 31 days to ensure epoch change
      await advanceTime(days(31));
      
      await rewards.updateCurrentEpoch();
      expect(await rewards.currentEpoch()).to.equal(1);
      
      // Advance another 60 days (2 epochs)
      await advanceTime(days(60));
      
      await rewards.updateCurrentEpoch();
      expect(await rewards.currentEpoch()).to.equal(3);
    });
    
    it("should record decisions correctly", async function () {
      const decisionId = ethers.utils.id("test-decision-1");
      
      await rewards.connect(tracker).recordDecision(
        decisionId,
        user1.address,
        true,  // isInvest
        true   // vote Yes
      );
      
      const decision = await rewards.getDecision(decisionId);
      expect(decision.voter).to.equal(user1.address);
      expect(decision.isInvest).to.equal(true);
      expect(decision.vote).to.equal(true);
      expect(decision.evaluated).to.equal(false);
      
      // First-time voter should have minimum weight
      expect(decision.weight).to.equal(100);
    });
    
    it("should prevent duplicate decision recording", async function () {
      const decisionId = ethers.utils.id("test-decision-2");
      
      await rewards.connect(tracker).recordDecision(
        decisionId,
        user1.address,
        true,
        true
      );
      
      await expect(
        rewards.connect(tracker).recordDecision(
          decisionId,
          user1.address,
          true,
          true
        )
      ).to.be.revertedWith("Decision already recorded");
    });
  });
  
  describe("Decision Evaluation and Rewards", function () {
    it("should evaluate decisions correctly", async function () {
      const decisionId = ethers.utils.id("test-evaluation");
      
      // Record decision
      await rewards.connect(tracker).recordDecision(
        decisionId,
        user1.address,
        true,  // isInvest
        true   // vote Yes
      );
      
      // Evaluate (price increased, so vote was correct)
      await rewards.connect(oracle).evaluateDecision(decisionId, true);
      
      const decision = await rewards.getDecision(decisionId);
      expect(decision.evaluated).to.equal(true);
      expect(decision.wasCorrect).to.equal(true);
      
      // Check voter history updated
      const stats = await rewards.getVoterStats(user1.address);
      expect(stats.totalVotes).to.equal(1);
      expect(stats.correctVotes).to.equal(1);
      expect(stats.consecutiveCorrect).to.equal(1);
    });
    
    it("should evaluate all decision scenarios correctly", async function () {
      // Scenario 1: Invest + Yes + Price Up = Correct
      const decision1 = ethers.utils.id("scenario-1");
      await rewards.connect(tracker).recordDecision(decision1, user1.address, true, true);
      await rewards.connect(oracle).evaluateDecision(decision1, true);
      expect((await rewards.getDecision(decision1)).wasCorrect).to.equal(true);
      
      // Scenario 2: Invest + No + Price Down = Correct
      const decision2 = ethers.utils.id("scenario-2");
      await rewards.connect(tracker).recordDecision(decision2, user1.address, true, false);
      await rewards.connect(oracle).evaluateDecision(decision2, false);
      expect((await rewards.getDecision(decision2)).wasCorrect).to.equal(true);
      
      // Scenario 3: Divest + Yes + Price Down = Correct
      const decision3 = ethers.utils.id("scenario-3");
      await rewards.connect(tracker).recordDecision(decision3, user1.address, false, true);
      await rewards.connect(oracle).evaluateDecision(decision3, false);
      expect((await rewards.getDecision(decision3)).wasCorrect).to.equal(true);
      
      // Scenario 4: Divest + No + Price Up = Correct
      const decision4 = ethers.utils.id("scenario-4");
      await rewards.connect(tracker).recordDecision(decision4, user1.address, false, false);
      await rewards.connect(oracle).evaluateDecision(decision4, true);
      expect((await rewards.getDecision(decision4)).wasCorrect).to.equal(true);
      
      // Scenario 5: Invest + Yes + Price Down = Incorrect
      const decision5 = ethers.utils.id("scenario-5");
      await rewards.connect(tracker).recordDecision(decision5, user1.address, true, true);
      await rewards.connect(oracle).evaluateDecision(decision5, false);
      expect((await rewards.getDecision(decision5)).wasCorrect).to.equal(false);
      
      // Check voter stats
      const stats = await rewards.getVoterStats(user1.address);
      expect(stats.totalVotes).to.equal(5);
      expect(stats.correctVotes).to.equal(4);
      // Consecutive reset after incorrect vote
      expect(stats.consecutiveCorrect).to.equal(0);
    });
    
    it("should calculate correct time-weighted rewards", async function () {
      // Setup multiple users with different voting patterns
      
      // User 1: Perfect record (3/3)
      for (let i = 0; i < 3; i++) {
        const decisionId = ethers.utils.id(`user1-decision-${i}`);
        await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
        await rewards.connect(oracle).evaluateDecision(decisionId, true);
      }
      
      // User 2: Mixed record (2/3)
      for (let i = 0; i < 3; i++) {
        const decisionId = ethers.utils.id(`user2-decision-${i}`);
        await rewards.connect(tracker).recordDecision(decisionId, user2.address, true, true);
        // First two correct, last one wrong
        await rewards.connect(oracle).evaluateDecision(decisionId, i < 2);
      }
      
      // User 3: Poor record (1/3)
      for (let i = 0; i < 3; i++) {
        const decisionId = ethers.utils.id(`user3-decision-${i}`);
        await rewards.connect(tracker).recordDecision(decisionId, user3.address, true, true);
        // Only first one correct
        await rewards.connect(oracle).evaluateDecision(decisionId, i === 0);
      }
      
      // Advance to next epoch
      await advanceTime(days(31));
      await rewards.updateCurrentEpoch();
      
      // Get claimable rewards
      const user1Rewards = await rewards.getClaimableRewards(user1.address, 0);
      const user2Rewards = await rewards.getClaimableRewards(user2.address, 0);
      const user3Rewards = await rewards.getClaimableRewards(user3.address, 0);
      
      // User 1 should have the most rewards due to perfect record and consecutive bonus
      expect(user1Rewards).to.be.gt(user2Rewards);
      expect(user2Rewards).to.be.gt(user3Rewards);
      
      // Verify weight calculations
      const user1Stats = await rewards.getVoterStats(user1.address);
      const user2Stats = await rewards.getVoterStats(user2.address);
      const user3Stats = await rewards.getVoterStats(user3.address);
      
      // User 1: Perfect record with consecutive bonus
      expect(user1Stats.currentWeight).to.be.gt(100); // Should be higher than minimum
      
      // User 2: Good record but no consecutive bonus
      expect(user2Stats.currentWeight).to.be.gt(100);
      expect(user2Stats.currentWeight).to.be.lt(user1Stats.currentWeight);
      
      // User 3: Poor record with no consecutive bonus
      expect(user3Stats.currentWeight).to.be.gt(100); // Still above minimum due to some correct votes
      expect(user3Stats.currentWeight).to.be.lt(user2Stats.currentWeight);
    });
  });
  
  describe("Reward Claiming", function () {
    it("should allow users to claim rewards after epoch ends", async function () {
      // Record and evaluate decisions
      const decisionId = ethers.utils.id("claim-test");
      await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
      await rewards.connect(oracle).evaluateDecision(decisionId, true);
      
      // Advance to next epoch
      await advanceTime(days(31));
      await rewards.updateCurrentEpoch();
      
      // Check claimable rewards
      const claimableBefore = await rewards.getClaimableRewards(user1.address, 0);
      expect(claimableBefore).to.be.gt(0);
      
      // Claim rewards
      await rewards.connect(user1).claimRewards(0);
      
      // Check DLOOP balance increased
      expect(await dloopToken.balanceOf(user1.address)).to.equal(claimableBefore);
      
      // Should not be able to claim again
      expect(await rewards.getClaimableRewards(user1.address, 0)).to.equal(0);
      await expect(rewards.connect(user1).claimRewards(0)).to.be.revertedWith("No rewards to claim");
    });
    
    it("should allow batch claiming of rewards", async function () {
      // Setup multiple epochs with decisions
      for (let epoch = 0; epoch < 3; epoch++) {
        // Record decision
        const decisionId = ethers.utils.id(`batch-claim-${epoch}`);
        await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
        await rewards.connect(oracle).evaluateDecision(decisionId, true);
        
        // Advance to next epoch
        await advanceTime(days(31));
        await rewards.updateCurrentEpoch();
      }
      
      // Check claimable rewards for each epoch
      const claimable0 = await rewards.getClaimableRewards(user1.address, 0);
      const claimable1 = await rewards.getClaimableRewards(user1.address, 1);
      const claimable2 = await rewards.getClaimableRewards(user1.address, 2);
      
      const totalClaimable = claimable0.add(claimable1).add(claimable2);
      expect(totalClaimable).to.be.gt(0);
      
      // Batch claim
      await rewards.connect(user1).batchClaimRewards([0, 1, 2]);
      
      // Check DLOOP balance increased
      expect(await dloopToken.balanceOf(user1.address)).to.equal(totalClaimable);
      
      // Should not be able to claim again
      expect(await rewards.getClaimableRewards(user1.address, 0)).to.equal(0);
      expect(await rewards.getClaimableRewards(user1.address, 1)).to.equal(0);
      expect(await rewards.getClaimableRewards(user1.address, 2)).to.equal(0);
    });
    
    it("should handle edge cases in batch claiming", async function () {
      // Trying to claim for current epoch
      await expect(rewards.connect(user1).batchClaimRewards([0])).to.not.be.reverted;
      
      // Claiming mix of valid and invalid epochs
      // Record decision for epoch 0
      const decisionId = ethers.utils.id("edge-case");
      await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
      await rewards.connect(oracle).evaluateDecision(decisionId, true);
      
      // Advance to epoch 1
      await advanceTime(days(31));
      await rewards.updateCurrentEpoch();
      
      // Claim for epochs 0, 1, 2 (1 & 2 invalid)
      await rewards.connect(user1).batchClaimRewards([0, 1, 2]);
      
      // Should have claimed only for epoch 0
      expect(await dloopToken.balanceOf(user1.address)).to.be.gt(0);
    });
  });
  
  describe("Admin Functions", function () {
    it("should only allow admins to grant roles", async function () {
      await expect(
        rewards.connect(user1).grantProposalTrackerRole(user2.address)
      ).to.be.reverted;
      
      await rewards.connect(admin).grantProposalTrackerRole(user3.address);
      expect(await rewards.hasRole(await rewards.PROPOSAL_TRACKER_ROLE(), user3.address)).to.be.true;
    });
    
    it("should allow admin to pause/unpause the contract", async function () {
      await rewards.connect(admin).pause();
      expect(await rewards.paused()).to.be.true;
      
      // Operations should be blocked when paused
      const decisionId = ethers.utils.id("pause-test");
      await expect(
        rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true)
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await rewards.connect(admin).unpause();
      expect(await rewards.paused()).to.be.false;
      
      // Operations should work again
      await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
    });
  });
  
  describe("Property-Based Testing", function () {
    it("reward distribution should never exceed epoch allocation", async function () {
      // Record multiple decisions for different users
      for (let i = 0; i < 10; i++) {
        const user = i % 3 === 0 ? user1 : i % 3 === 1 ? user2 : user3;
        const decisionId = ethers.utils.id(`property-test-${i}`);
        await rewards.connect(tracker).recordDecision(decisionId, user.address, i % 2 === 0, i % 2 === 0);
        await rewards.connect(oracle).evaluateDecision(decisionId, i % 2 === 0);
      }
      
      // Advance to next epoch
      await advanceTime(days(31));
      await rewards.updateCurrentEpoch();
      
      // All users claim
      await rewards.connect(user1).claimRewards(0);
      await rewards.connect(user2).claimRewards(0);
      await rewards.connect(user3).claimRewards(0);
      
      // Check total claimed vs allocation
      const epochRewards = await rewards.epochRewards(0);
      const rewardsPerEpoch = await rewards.REWARDS_PER_EPOCH();
      
      // Total distributed should never exceed allocation
      expect(epochRewards.rewardsDistributed).to.be.lte(rewardsPerEpoch);
    });
    
    it("user weight should increase with good voting history", async function () {
      // Create successful voting history for user1
      for (let i = 0; i < 5; i++) {
        const decisionId = ethers.utils.id(`weight-test-${i}`);
        await rewards.connect(tracker).recordDecision(decisionId, user1.address, true, true);
        await rewards.connect(oracle).evaluateDecision(decisionId, true);
        
        // Get weight after each vote
        const stats = await rewards.getVoterStats(user1.address);
        
        if (i > 0) {
          // Weight should increase or stay the same with each correct vote
          expect(stats.currentWeight).to.be.gte(previousWeight);
        }
        
        const previousWeight = stats.currentWeight;
      }
      
      // Final weight should be significantly higher than the minimum
      const finalStats = await rewards.getVoterStats(user1.address);
      expect(finalStats.currentWeight).to.be.gt(120); // Above minimum + some bonus
    });
  });
});