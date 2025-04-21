const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GovernanceRewards", function () {
  let MockERC20, MockPriceOracle, GovernanceRewards;
  let dloopToken, priceOracle, rewards;
  let owner, user1, user2, user3, governance, distributor;
  
  // Test assets
  const ETH_ADDRESS = "0x1111111111111111111111111111111111111111";
  const BTC_ADDRESS = "0x2222222222222222222222222222222222222222";
  
  // Initial prices (with 18 decimals)
  const INITIAL_ETH_PRICE = ethers.parseUnits("3000", 18);
  const INITIAL_BTC_PRICE = ethers.parseUnits("60000", 18);
  
  beforeEach(async function () {
    [owner, user1, user2, user3, governance, distributor] = await ethers.getSigners();
    
    // Deploy mock DLOOP token
    MockERC20 = await ethers.getContractFactory("MockERC20");
    dloopToken = await MockERC20.deploy("DLOOP Token", "DLOOP", ethers.parseUnits("100000000", 18));
    await dloopToken.deployed();
    
    // Deploy mock price oracle
    MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await MockPriceOracle.deploy();
    await priceOracle.deployed();
    
    // Set initial prices
    await priceOracle.setAssetPrice(ETH_ADDRESS, INITIAL_ETH_PRICE);
    await priceOracle.setAssetPrice(BTC_ADDRESS, INITIAL_BTC_PRICE);
    
    // Deploy GovernanceRewards
    GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    rewards = await GovernanceRewards.deploy(
      dloopToken.address,
      priceOracle.address
    );
    await rewards.deployed();
    
    // Transfer DLOOP tokens to the rewards contract
    await dloopToken.transfer(
      rewards.address,
      ethers.parseUnits("20016000", 18)
    );
    
    // Grant roles
    await rewards.grantRole(
      await rewards.GOVERNANCE_ROLE(),
      governance.address
    );
    
    await rewards.grantRole(
      await rewards.DISTRIBUTOR_ROLE(),
      distributor.address
    );
    
    // Set a shorter decision validity period for testing
    await rewards.connect(governance).updateDecisionValidityPeriod(60); // 60 seconds
  });
  
  describe("Decision Recording", function () {
    it("should record governance decisions", async function () {
      // Create a proposal ID
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal1"));
      
      // Record a decision
      const tx = await rewards.connect(governance).recordDecision(
        user1.address,
        proposalId,
        true, // Invest
        true, // Yes vote
        ETH_ADDRESS
      );
      
      // Get decisionId from event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'DecisionRecorded');
      const decisionId = event.args.decisionId;
      
      // Check decision details
      const decision = await rewards.decisions(decisionId);
      expect(decision.user).to.equal(user1.address);
      expect(decision.proposalId).to.equal(proposalId);
      expect(decision.isInvest).to.be.true;
      expect(decision.voteDirection).to.be.true;
      expect(decision.asset).to.equal(ETH_ADDRESS);
      expect(decision.assetPriceAtVote).to.equal(INITIAL_ETH_PRICE);
      expect(decision.processed).to.be.false;
      expect(decision.wasCorrect).to.be.false;
    });
    
    it("should prevent non-governance accounts from recording decisions", async function () {
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal1"));
      
      await expect(
        rewards.connect(user1).recordDecision(
          user2.address,
          proposalId,
          true,
          true,
          ETH_ADDRESS
        )
      ).to.be.revertedWith("AccessControl: account");
    });
  });
  
  describe("Decision Evaluation", function () {
    let decisionId1, decisionId2, decisionId3, decisionId4;
    
    beforeEach(async function () {
      // Create a proposal ID
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal1"));
      
      // Record 4 different decisions for different scenarios
      const tx1 = await rewards.connect(governance).recordDecision(
        user1.address,
        proposalId,
        true, // Invest
        true, // Yes vote
        ETH_ADDRESS
      );
      
      const tx2 = await rewards.connect(governance).recordDecision(
        user2.address,
        proposalId,
        true, // Invest
        false, // No vote
        ETH_ADDRESS
      );
      
      const tx3 = await rewards.connect(governance).recordDecision(
        user3.address,
        proposalId,
        false, // Divest
        true, // Yes vote
        BTC_ADDRESS
      );
      
      const tx4 = await rewards.connect(governance).recordDecision(
        user1.address,
        proposalId,
        false, // Divest
        false, // No vote
        BTC_ADDRESS
      );
      
      // Get decisionIds from events
      const receipt1 = await tx1.wait();
      const receipt2 = await tx2.wait();
      const receipt3 = await tx3.wait();
      const receipt4 = await tx4.wait();
      
      decisionId1 = receipt1.events.find(e => e.event === 'DecisionRecorded').args.decisionId;
      decisionId2 = receipt2.events.find(e => e.event === 'DecisionRecorded').args.decisionId;
      decisionId3 = receipt3.events.find(e => e.event === 'DecisionRecorded').args.decisionId;
      decisionId4 = receipt4.events.find(e => e.event === 'DecisionRecorded').args.decisionId;
    });
    
    it("should correctly evaluate decisions with price increases", async function () {
      // Increase ETH price
      const newEthPrice = INITIAL_ETH_PRICE.mul(120).div(100); // 20% increase
      await priceOracle.setAssetPrice(ETH_ADDRESS, newEthPrice);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Evaluate decisions 1 and 2 (related to ETH)
      await rewards.evaluateDecision(decisionId1);
      await rewards.evaluateDecision(decisionId2);
      
      // Check results
      const decision1 = await rewards.decisions(decisionId1);
      const decision2 = await rewards.decisions(decisionId2);
      
      expect(decision1.processed).to.be.true;
      expect(decision1.wasCorrect).to.be.true; // Invest + Yes + Price Increase = Correct
      
      expect(decision2.processed).to.be.true;
      expect(decision2.wasCorrect).to.be.false; // Invest + No + Price Increase = Incorrect
    });
    
    it("should correctly evaluate decisions with price decreases", async function () {
      // Decrease BTC price
      const newBtcPrice = INITIAL_BTC_PRICE.mul(80).div(100); // 20% decrease
      await priceOracle.setAssetPrice(BTC_ADDRESS, newBtcPrice);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Evaluate decisions 3 and 4 (related to BTC)
      await rewards.evaluateDecision(decisionId3);
      await rewards.evaluateDecision(decisionId4);
      
      // Check results
      const decision3 = await rewards.decisions(decisionId3);
      const decision4 = await rewards.decisions(decisionId4);
      
      expect(decision3.processed).to.be.true;
      expect(decision3.wasCorrect).to.be.true; // Divest + Yes + Price Decrease = Correct
      
      expect(decision4.processed).to.be.true;
      expect(decision4.wasCorrect).to.be.false; // Divest + No + Price Decrease = Incorrect
    });
    
    it("should prevent evaluation before the validity period ends", async function () {
      await expect(
        rewards.evaluateDecision(decisionId1)
      ).to.be.revertedWith("Evaluation period not ended");
    });
    
    it("should prevent duplicate evaluation", async function () {
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Evaluate once
      await rewards.evaluateDecision(decisionId1);
      
      // Try to evaluate again
      await expect(
        rewards.evaluateDecision(decisionId1)
      ).to.be.revertedWith("Decision already processed");
    });
  });
  
  describe("Batch Processing", function () {
    beforeEach(async function () {
      // Create a proposal ID
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal1"));
      
      // Record multiple decisions
      for (let i = 0; i < 5; i++) {
        await rewards.connect(governance).recordDecision(
          user1.address,
          proposalId,
          true, // Invest
          i % 2 === 0, // Alternate Yes/No votes
          ETH_ADDRESS
        );
      }
      
      // Increase ETH price to make some decisions correct
      const newEthPrice = INITIAL_ETH_PRICE.mul(120).div(100); // 20% increase
      await priceOracle.setAssetPrice(ETH_ADDRESS, newEthPrice);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
    });
    
    it("should process multiple decisions in a batch", async function () {
      // Process 3 decisions
      await rewards.processPendingDecisions(3);
      
      // Check how many were processed
      let processedCount = 0;
      const totalDecisions = await rewards.decisionIds.length;
      
      for (let i = 0; i < totalDecisions; i++) {
        const decisionId = await rewards.decisionIds(i);
        const decision = await rewards.decisions(decisionId);
        
        if (decision.processed) {
          processedCount++;
        }
      }
      
      expect(processedCount).to.equal(3);
    });
  });
  
  describe("Reward Distribution", function () {
    beforeEach(async function () {
      // Create a proposal ID
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal1"));
      
      // Record decisions - user1 will have correct decisions, user2 will have incorrect
      await rewards.connect(governance).recordDecision(
        user1.address,
        proposalId,
        true, // Invest
        true, // Yes vote
        ETH_ADDRESS
      );
      
      await rewards.connect(governance).recordDecision(
        user1.address,
        proposalId,
        false, // Divest
        true, // Yes vote
        BTC_ADDRESS
      );
      
      await rewards.connect(governance).recordDecision(
        user2.address,
        proposalId,
        true, // Invest
        false, // No vote
        ETH_ADDRESS
      );
      
      // Set prices to make user1's decisions correct
      const newEthPrice = INITIAL_ETH_PRICE.mul(120).div(100); // 20% increase
      const newBtcPrice = INITIAL_BTC_PRICE.mul(80).div(100); // 20% decrease
      
      await priceOracle.setAssetPrice(ETH_ADDRESS, newEthPrice);
      await priceOracle.setAssetPrice(BTC_ADDRESS, newBtcPrice);
      
      // Fast forward time for evaluation
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Process all decisions
      await rewards.processPendingDecisions(10);
      
      // Fast forward time for distribution (30 days)
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
    });
    
    it("should distribute rewards correctly", async function () {
      // Check initial balances
      const initialBalance1 = await dloopToken.balanceOf(user1.address);
      const initialBalance2 = await dloopToken.balanceOf(user2.address);
      
      // Distribute rewards
      await rewards.connect(distributor).distributeRewards();
      
      // Check updated balances
      const finalBalance1 = await dloopToken.balanceOf(user1.address);
      const finalBalance2 = await dloopToken.balanceOf(user2.address);
      
      // User1 should receive rewards (2 correct decisions)
      expect(finalBalance1).to.be.gt(initialBalance1);
      expect(finalBalance1.sub(initialBalance1)).to.equal(
        await rewards.MONTHLY_REWARDS() // All rewards go to user1
      );
      
      // User2 should not receive rewards (incorrect decisions)
      expect(finalBalance2).to.equal(initialBalance2);
      
      // Check tracking
      expect(await rewards.currentPeriod()).to.equal(1);
      expect(await rewards.totalDistributed()).to.equal(
        await rewards.MONTHLY_REWARDS()
      );
      
      // Check claimed rewards tracking
      expect(await rewards.totalRewardsClaimed(user1.address)).to.equal(
        await rewards.MONTHLY_REWARDS()
      );
      expect(await rewards.totalRewardsClaimed(user2.address)).to.equal(0);
    });
    
    it("should handle multiple distribution periods", async function () {
      // First distribution
      await rewards.connect(distributor).distributeRewards();
      
      // Record more decisions for next period
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("Proposal2"));
      
      await rewards.connect(governance).recordDecision(
        user3.address,
        proposalId,
        true, // Invest
        true, // Yes vote
        ETH_ADDRESS
      );
      
      // Increase ETH price further
      const newerEthPrice = INITIAL_ETH_PRICE.mul(150).div(100); // 50% increase
      await priceOracle.setAssetPrice(ETH_ADDRESS, newerEthPrice);
      
      // Fast forward time for evaluation
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Process new decisions
      await rewards.processPendingDecisions(10);
      
      // Fast forward time for second distribution
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Check initial balance
      const initialBalance3 = await dloopToken.balanceOf(user3.address);
      
      // Second distribution
      await rewards.connect(distributor).distributeRewards();
      
      // Check updated balance
      const finalBalance3 = await dloopToken.balanceOf(user3.address);
      
      // User3 should receive rewards
      expect(finalBalance3).to.be.gt(initialBalance3);
      
      // Check tracking
      expect(await rewards.currentPeriod()).to.equal(2);
      expect(await rewards.totalDistributed()).to.equal(
        (await rewards.MONTHLY_REWARDS()).mul(2)
      );
    });
  });
});