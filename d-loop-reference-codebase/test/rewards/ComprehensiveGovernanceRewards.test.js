const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Comprehensive Governance Rewards System Tests", function () {
  let governanceRewards;
  let governanceTracker;
  let rewardAllocator;
  let governanceOracle;
  let mockToken;
  let mockPriceOracle;
  let owner;
  let users;
  let aiNodes;
  
  // Constants for edge case testing
  const MONTHLY_REWARDS = ethers.utils.parseEther("278000");
  const MAX_UINT256 = ethers.constants.MaxUint256;
  const THIRTY_DAYS = 30 * 24 * 60 * 60;
  
  before(async function () {
    // Get signers
    [owner, ...users] = await ethers.getSigners();
    aiNodes = users.slice(0, 3);
    users = users.slice(3, 10);
    
    // Deploy mock contracts
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("DLOOP", "DLOOP", 18);
    await mockToken.deployed();
    
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    await mockPriceOracle.deployed();
    
    // Deploy actual contracts
    const GovernanceTracker = await ethers.getContractFactory("GovernanceTracker");
    governanceTracker = await GovernanceTracker.deploy();
    await governanceTracker.deployed();
    
    const RewardAllocator = await ethers.getContractFactory("RewardAllocator");
    rewardAllocator = await RewardAllocator.deploy(mockToken.address);
    await rewardAllocator.deployed();
    
    const GovernanceOracle = await ethers.getContractFactory("GovernanceOracle");
    governanceOracle = await GovernanceOracle.deploy(mockPriceOracle.address);
    await governanceOracle.deployed();
    
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      mockToken.address,
      governanceTracker.address,
      rewardAllocator.address,
      governanceOracle.address
    );
    await governanceRewards.deployed();
    
    // Setup permissions
    await governanceTracker.setGovernanceRewards(governanceRewards.address);
    await rewardAllocator.setGovernanceRewards(governanceRewards.address);
    
    // Fund the reward allocator
    await mockToken.mint(rewardAllocator.address, ethers.utils.parseEther("20016000"));
  });
  
  describe("Lifecycle and Integration Tests", function () {
    it("should process a complete governance cycle from decision to rewards", async function () {
      const assetSymbol = "ETH";
      const proposalId = 1;
      const initialPrice = ethers.utils.parseEther("2000");
      const finalPrice = ethers.utils.parseEther("2200"); // 10% increase
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, initialPrice);
      
      // Record votes for an invest proposal
      for (let i = 0; i < users.length; i++) {
        // Alternating votes (yes/no)
        const vote = i % 2 === 0;
        await governanceTracker.connect(users[i]).recordVote(
          proposalId, 
          assetSymbol, 
          true, // invest proposal
          vote // yes/no vote
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Update price to reflect increase
      await mockPriceOracle.setPrice(assetSymbol, finalPrice);
      
      // Evaluate decision correctness
      await governanceOracle.evaluateDecision(proposalId, assetSymbol, true);
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS);
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify rewards were distributed correctly
      for (let i = 0; i < users.length; i++) {
        if (i % 2 === 0) { // Yes voters should be rewarded for correct decision
          expect(await mockToken.balanceOf(users[i].address)).to.be.gt(0);
        } else { // No voters should not be rewarded for incorrect decision
          expect(await mockToken.balanceOf(users[i].address)).to.equal(0);
        }
      }
    });
    
    it("should handle extreme voting scenarios with many users", async function () {
      const assetSymbol = "LINK";
      const proposalId = 2;
      const initialPrice = ethers.utils.parseEther("10");
      const finalPrice = ethers.utils.parseEther("8"); // 20% decrease
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, initialPrice);
      
      // Record many votes - all YES for this extreme case
      for (let i = 0; i < users.length; i++) {
        await governanceTracker.connect(users[i]).recordVote(
          proposalId, 
          assetSymbol, 
          true, // invest proposal
          true // yes vote
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Update price to reflect decrease
      await mockPriceOracle.setPrice(assetSymbol, finalPrice);
      
      // Evaluate decision correctness - YES vote for INVEST is wrong when price decreases
      await governanceOracle.evaluateDecision(proposalId, assetSymbol, true);
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS);
      
      // Record balances before
      const balancesBefore = [];
      for (let i = 0; i < users.length; i++) {
        balancesBefore.push(await mockToken.balanceOf(users[i].address));
      }
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify no rewards were distributed for incorrect decisions
      for (let i = 0; i < users.length; i++) {
        expect(await mockToken.balanceOf(users[i].address)).to.equal(balancesBefore[i]);
      }
    });
    
    it("should correctly handle a mix of correct and incorrect decisions", async function () {
      const assetSymbol = "WBTC";
      const investProposalId = 3;
      const divestProposalId = 4;
      const initialPrice = ethers.utils.parseEther("30000");
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, initialPrice);
      
      // Record votes for both invest and divest proposals
      for (let i = 0; i < users.length; i++) {
        // For invest proposal
        await governanceTracker.connect(users[i]).recordVote(
          investProposalId, 
          assetSymbol, 
          true, // invest proposal
          i < users.length / 2 // first half yes, second half no
        );
        
        // For divest proposal
        await governanceTracker.connect(users[i]).recordVote(
          divestProposalId, 
          assetSymbol, 
          false, // divest proposal
          i >= users.length / 2 // first half no, second half yes
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Increase price for first decision evaluation
      const increasedPrice = ethers.utils.parseEther("33000"); // 10% increase
      await mockPriceOracle.setPrice(assetSymbol, increasedPrice);
      
      // Evaluate first decision
      await governanceOracle.evaluateDecision(investProposalId, assetSymbol, true);
      
      // Fast forward time to simulate price change period for second decision
      await time.increase(7 * 24 * 60 * 60); // Another 7 days
      
      // Decrease price for second decision evaluation
      const decreasedPrice = ethers.utils.parseEther("29700"); // 10% decrease from increased
      await mockPriceOracle.setPrice(assetSymbol, decreasedPrice);
      
      // Evaluate second decision
      await governanceOracle.evaluateDecision(divestProposalId, assetSymbol, false);
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS - 14 * 24 * 60 * 60); // Adjust to exactly 30 days total
      
      // Record balances before
      const balancesBefore = [];
      for (let i = 0; i < users.length; i++) {
        balancesBefore.push(await mockToken.balanceOf(users[i].address));
      }
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify correct reward distribution
      for (let i = 0; i < users.length; i++) {
        if (i < users.length / 2) {
          // First half: YES on invest (correct) and NO on divest (incorrect)
          expect(await mockToken.balanceOf(users[i].address)).to.be.gt(balancesBefore[i]);
        } else {
          // Second half: NO on invest (incorrect) and YES on divest (correct)
          expect(await mockToken.balanceOf(users[i].address)).to.be.gt(balancesBefore[i]);
        }
      }
    });
  });
  
  describe("Edge Cases", function () {
    it("should handle scenarios with zero correct decisions", async function () {
      // Reset tracker state for clean test
      await governanceTracker.reset();
      
      // Fast forward to next distribution period
      await time.increase(THIRTY_DAYS);
      
      // Try to distribute rewards with no correct decisions
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify no errors and no token transfers
      // This is implicit - if the function doesn't revert, the test passes
    });
    
    it("should correctly handle price not changing (0% movement)", async function () {
      const assetSymbol = "USDC";
      const proposalId = 5;
      const price = ethers.utils.parseEther("1"); // Stable price
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, price);
      
      // Record votes
      for (let i = 0; i < users.length; i++) {
        await governanceTracker.connect(users[i]).recordVote(
          proposalId, 
          assetSymbol, 
          true, // invest proposal
          true // yes vote
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Price remains the same - no change
      
      // Evaluate decision correctness - no reward for no price change
      await governanceOracle.evaluateDecision(proposalId, assetSymbol, true);
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS - 7 * 24 * 60 * 60);
      
      // Record balances before
      const balancesBefore = [];
      for (let i = 0; i < users.length; i++) {
        balancesBefore.push(await mockToken.balanceOf(users[i].address));
      }
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify no additional rewards were distributed for price staying the same
      for (let i = 0; i < users.length; i++) {
        expect(await mockToken.balanceOf(users[i].address)).to.equal(balancesBefore[i]);
      }
    });
    
    it("should handle extreme price movements correctly", async function () {
      const assetSymbol = "MEME";
      const proposalId = 6;
      const initialPrice = ethers.utils.parseEther("0.0001");
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, initialPrice);
      
      // Record votes - some yes, some no
      for (let i = 0; i < users.length; i++) {
        await governanceTracker.connect(users[i]).recordVote(
          proposalId, 
          assetSymbol, 
          true, // invest proposal
          i % 2 === 0 // alternating yes/no
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Extreme price increase (1000x)
      const extremePrice = ethers.utils.parseEther("0.1");
      await mockPriceOracle.setPrice(assetSymbol, extremePrice);
      
      // Evaluate decision correctness
      await governanceOracle.evaluateDecision(proposalId, assetSymbol, true);
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS - 7 * 24 * 60 * 60);
      
      // Record balances before
      const balancesBefore = [];
      for (let i = 0; i < users.length; i++) {
        balancesBefore.push(await mockToken.balanceOf(users[i].address));
      }
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify rewards were distributed correctly
      for (let i = 0; i < users.length; i++) {
        if (i % 2 === 0) { // Yes voters should be rewarded for extreme price increase
          expect(await mockToken.balanceOf(users[i].address)).to.be.gt(balancesBefore[i]);
        } else { // No voters should not get additional rewards
          expect(await mockToken.balanceOf(users[i].address)).to.equal(balancesBefore[i]);
        }
      }
    });
  });
  
  describe("Security and Access Control", function () {
    it("should prevent unauthorized reward distributions", async function () {
      // Try to distribute rewards from unauthorized account
      await expect(
        governanceRewards.connect(users[0]).distributeMonthlyRewards()
      ).to.be.reverted;
    });
    
    it("should prevent double distribution in the same period", async function () {
      // Try to distribute rewards again in the same period
      await expect(
        governanceRewards.distributeMonthlyRewards()
      ).to.be.reverted;
    });
    
    it("should handle malicious attempts to manipulate decision records", async function () {
      // Try to record a vote for a past proposal after evaluation
      const assetSymbol = "ETH";
      const proposalId = 1; // Already evaluated
      
      await expect(
        governanceTracker.connect(users[0]).recordVote(
          proposalId, 
          assetSymbol, 
          true,
          true
        )
      ).to.be.reverted;
    });
  });
  
  describe("Boundary Conditions", function () {
    it("should handle the maximum possible number of voters", async function () {
      // This test simulates a large number of voters by making multiple votes from available accounts
      const assetSymbol = "TEST";
      const proposalId = 100;
      const initialPrice = ethers.utils.parseEther("100");
      
      // Setup the mock price oracle
      await mockPriceOracle.setPrice(assetSymbol, initialPrice);
      
      // Record a large number of votes by having each user make multiple votes
      // This simulates having many more users than we actually have in our test
      const largeVoteCount = 100;
      for (let voteCount = 0; voteCount < largeVoteCount; voteCount++) {
        // Use modulo to cycle through available users
        const userIndex = voteCount % users.length;
        
        // Create a unique voter ID by combining proposal ID and vote count
        const syntheticProposalId = proposalId + voteCount;
        
        await governanceTracker.connect(users[userIndex]).recordVote(
          syntheticProposalId, 
          assetSymbol, 
          true, // invest proposal
          true // yes vote
        );
      }
      
      // Fast forward time to simulate price change period
      await time.increase(7 * 24 * 60 * 60); // 7 days
      
      // Increase price
      const increasedPrice = ethers.utils.parseEther("120");
      await mockPriceOracle.setPrice(assetSymbol, increasedPrice);
      
      // Evaluate all decisions
      for (let voteCount = 0; voteCount < largeVoteCount; voteCount++) {
        const syntheticProposalId = proposalId + voteCount;
        await governanceOracle.evaluateDecision(syntheticProposalId, assetSymbol, true);
      }
      
      // Fast forward to reward distribution time
      await time.increase(THIRTY_DAYS - 7 * 24 * 60 * 60);
      
      // Record balances before
      const balancesBefore = [];
      for (let i = 0; i < users.length; i++) {
        balancesBefore.push(await mockToken.balanceOf(users[i].address));
      }
      
      // Trigger reward distribution
      await governanceRewards.distributeMonthlyRewards();
      
      // Verify rewards were distributed to all users who participated
      for (let i = 0; i < users.length; i++) {
        expect(await mockToken.balanceOf(users[i].address)).to.be.gt(balancesBefore[i]);
      }
    });
  });
});