const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Oracle and Governance Rewards", function () {
  let admin, governance, rewardProvider, user1, user2, user3;
  let mockToken, mockAsset, priceOracle, governanceRewards;
  
  const ONE_DAY = 24 * 60 * 60;
  const THIRTY_DAYS = 30 * ONE_DAY;
  const EVALUATION_PERIOD = THIRTY_DAYS;
  const MIN_PRICE_CHANGE_PERCENT = ethers.utils.parseEther("0.05"); // 5%
  
  beforeEach(async function () {
    [admin, governance, rewardProvider, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("DLOOP Token", "DLOOP");
    await mockToken.deployed();
    
    mockAsset = await MockERC20.deploy("Mock Asset", "ASSET");
    await mockAsset.deployed();
    
    // Mint tokens to users
    await mockToken.mint(admin.address, ethers.utils.parseEther("1000000"));
    await mockToken.mint(rewardProvider.address, ethers.utils.parseEther("500000"));
    
    // Deploy price oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await MockPriceOracle.deploy(admin.address);
    await priceOracle.deployed();
    
    // Add asset support to oracle with initial price
    await priceOracle.addAssetSupport(mockAsset.address, ethers.utils.parseEther("100"));
    
    // Deploy governance rewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      admin.address,
      governance.address,
      mockToken.address,
      priceOracle.address,
      EVALUATION_PERIOD,
      MIN_PRICE_CHANGE_PERCENT
    );
    await governanceRewards.deployed();
    
    // Grant roles
    await governanceRewards.grantRewardProviderRole(rewardProvider.address);
    
    // Fund the rewards contract
    await mockToken.connect(rewardProvider).approve(
      governanceRewards.address,
      ethers.utils.parseEther("100000")
    );
    await governanceRewards.connect(rewardProvider).provideRewards(
      ethers.utils.parseEther("100000")
    );
  });
  
  describe("Price Oracle", function () {
    it("should provide latest price for supported assets", async function () {
      const [price, timestamp] = await priceOracle.getLatestPrice(mockAsset.address);
      
      expect(price).to.equal(ethers.utils.parseEther("100"));
      expect(timestamp).to.be.approximately(
        (await ethers.provider.getBlock("latest")).timestamp,
        10
      );
    });
    
    it("should allow updating prices", async function () {
      // Update price
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("120"));
      
      const [price, ] = await priceOracle.getLatestPrice(mockAsset.address);
      expect(price).to.equal(ethers.utils.parseEther("120"));
    });
    
    it("should calculate price change percentage correctly", async function () {
      // Get current block timestamp
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      
      // Add a price point in the past
      await priceOracle.updatePriceWithTimestamp(
        mockAsset.address,
        ethers.utils.parseEther("100"),
        currentTime - THIRTY_DAYS
      );
      
      // Add a new price point now (20% increase)
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("120"));
      
      // Check price change percentage
      const [percentage, isIncrease] = await priceOracle.getPriceChangePercentage(
        mockAsset.address,
        currentTime - THIRTY_DAYS,
        currentTime
      );
      
      expect(percentage).to.be.approximately(ethers.utils.parseEther("0.2"), ethers.utils.parseEther("0.01"));
      expect(isIncrease).to.be.true;
    });
  });
  
  describe("Governance Rewards", function () {
    it("should register proposals correctly", async function () {
      // Register a proposal
      await governanceRewards.connect(governance).registerProposal(
        1, // proposalId
        0, // ProposalType.Invest
        mockAsset.address,
        (await ethers.provider.getBlock("latest")).timestamp
      );
      
      // Check proposal details
      const [id, proposalType, asset, evaluationStartTime, evaluationEndTime, evaluated, outcome] = 
        await governanceRewards.getProposalDetails(1);
      
      expect(id).to.equal(1);
      expect(proposalType).to.equal(0); // Invest
      expect(asset).to.equal(mockAsset.address);
      expect(evaluationEndTime.sub(evaluationStartTime)).to.equal(EVALUATION_PERIOD);
      expect(evaluated).to.be.false;
      expect(outcome).to.equal(4); // Neutral
    });
    
    it("should register votes correctly", async function () {
      // Register a proposal
      await governanceRewards.connect(governance).registerProposal(
        1,
        0, // Invest
        mockAsset.address,
        (await ethers.provider.getBlock("latest")).timestamp
      );
      
      // Register votes
      await governanceRewards.connect(governance).registerVote(
        1,
        user1.address,
        0, // Yes
        ethers.utils.parseEther("100")
      );
      
      await governanceRewards.connect(governance).registerVote(
        1,
        user2.address,
        1, // No
        ethers.utils.parseEther("50")
      );
      
      // Check vote details
      const [vote1, votingPower1, rewarded1] = await governanceRewards.getVoteDetails(1, user1.address);
      expect(vote1).to.equal(0); // Yes
      expect(votingPower1).to.equal(ethers.utils.parseEther("100"));
      expect(rewarded1).to.be.false;
      
      const [vote2, votingPower2, rewarded2] = await governanceRewards.getVoteDetails(1, user2.address);
      expect(vote2).to.equal(1); // No
      expect(votingPower2).to.equal(ethers.utils.parseEther("50"));
      expect(rewarded2).to.be.false;
    });
    
    it("should evaluate proposals and distribute rewards for correct decisions", async function () {
      // Get current block timestamp
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      
      // Register a proposal
      await governanceRewards.connect(governance).registerProposal(
        1,
        0, // Invest
        mockAsset.address,
        currentTime
      );
      
      // Register votes
      await governanceRewards.connect(governance).registerVote(
        1,
        user1.address,
        0, // Yes - will be correct as price will increase
        ethers.utils.parseEther("100")
      );
      
      await governanceRewards.connect(governance).registerVote(
        1,
        user2.address,
        1, // No - will be incorrect
        ethers.utils.parseEther("50")
      );
      
      // Fast forward time past evaluation period
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Update price (20% increase)
      const newTime = (await ethers.provider.getBlock("latest")).timestamp;
      await priceOracle.updatePriceWithTimestamp(
        mockAsset.address,
        ethers.utils.parseEther("120"),
        newTime
      );
      
      // Evaluate proposal
      await governanceRewards.evaluateProposal(1);
      
      // Check proposal was evaluated correctly
      const [, , , , , evaluated, outcome] = await governanceRewards.getProposalDetails(1);
      expect(evaluated).to.be.true;
      expect(outcome).to.equal(0); // InvestYesSuccess
      
      // Check rewards were distributed
      expect(await governanceRewards.getPendingRewards(user1.address)).to.be.gt(0);
      expect(await governanceRewards.getPendingRewards(user2.address)).to.equal(0);
      
      // Check streak was updated
      expect(await governanceRewards.getCurrentStreak(user1.address)).to.equal(1);
      expect(await governanceRewards.getCurrentStreak(user2.address)).to.equal(0);
      
      // User1 claims rewards
      const pendingRewards = await governanceRewards.getPendingRewards(user1.address);
      await governanceRewards.connect(user1).claimRewards();
      
      // Check rewards were claimed
      expect(await mockToken.balanceOf(user1.address)).to.equal(pendingRewards);
      expect(await governanceRewards.getPendingRewards(user1.address)).to.equal(0);
      expect(await governanceRewards.getTotalClaimedRewards(user1.address)).to.equal(pendingRewards);
    });
    
    it("should handle consecutive correct decisions with streak bonuses", async function () {
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      
      // First proposal - Invest, price will increase
      await governanceRewards.connect(governance).registerProposal(
        1,
        0, // Invest
        mockAsset.address,
        currentTime
      );
      
      await governanceRewards.connect(governance).registerVote(
        1,
        user3.address,
        0, // Yes - will be correct
        ethers.utils.parseEther("100")
      );
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Update price (20% increase)
      const newTime1 = (await ethers.provider.getBlock("latest")).timestamp;
      await priceOracle.updatePriceWithTimestamp(
        mockAsset.address,
        ethers.utils.parseEther("120"),
        newTime1
      );
      
      // Evaluate first proposal
      await governanceRewards.evaluateProposal(1);
      
      // Second proposal - Divest, price will decrease
      await governanceRewards.connect(governance).registerProposal(
        2,
        1, // Divest
        mockAsset.address,
        newTime1
      );
      
      await governanceRewards.connect(governance).registerVote(
        2,
        user3.address,
        0, // Yes - will be correct as price will decrease
        ethers.utils.parseEther("100")
      );
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Update price (10% decrease)
      const newTime2 = (await ethers.provider.getBlock("latest")).timestamp;
      await priceOracle.updatePriceWithTimestamp(
        mockAsset.address,
        ethers.utils.parseEther("108"), // 10% decrease from 120
        newTime2
      );
      
      // Evaluate second proposal
      await governanceRewards.evaluateProposal(2);
      
      // Check streak was incremented
      expect(await governanceRewards.getCurrentStreak(user3.address)).to.equal(2);
      
      // Get rewards from both proposals
      const pendingRewards = await governanceRewards.getPendingRewards(user3.address);
      expect(pendingRewards).to.be.gt(0);
      
      // Claim rewards
      await governanceRewards.connect(user3).claimRewards();
    });
    
    it("should handle neutral outcomes when price change is below threshold", async function () {
      // Get current block timestamp
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      
      // Register a proposal
      await governanceRewards.connect(governance).registerProposal(
        1,
        0, // Invest
        mockAsset.address,
        currentTime
      );
      
      // Register votes
      await governanceRewards.connect(governance).registerVote(
        1,
        user1.address,
        0, // Yes
        ethers.utils.parseEther("100")
      );
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Update price with small change (2% increase - below threshold)
      const newTime = (await ethers.provider.getBlock("latest")).timestamp;
      await priceOracle.updatePriceWithTimestamp(
        mockAsset.address,
        ethers.utils.parseEther("102"),
        newTime
      );
      
      // Evaluate proposal
      await governanceRewards.evaluateProposal(1);
      
      // Check outcome is neutral
      const [, , , , , evaluated, outcome] = await governanceRewards.getProposalDetails(1);
      expect(evaluated).to.be.true;
      expect(outcome).to.equal(4); // Neutral
      
      // Check no rewards were distributed
      expect(await governanceRewards.getPendingRewards(user1.address)).to.equal(0);
      
      // Check streak was not affected
      expect(await governanceRewards.getCurrentStreak(user1.address)).to.equal(0);
    });
    
    it("should update evaluation parameters", async function () {
      // Update parameters
      const newEvaluationPeriod = 14 * ONE_DAY; // 14 days
      const newMinPriceChange = ethers.utils.parseEther("0.1"); // 10%
      
      await governanceRewards.connect(admin).updateEvaluationParameters(
        newEvaluationPeriod,
        newMinPriceChange
      );
      
      // Register a proposal after parameter update
      const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
      await governanceRewards.connect(governance).registerProposal(
        1,
        0, // Invest
        mockAsset.address,
        currentTime
      );
      
      // Check evaluation period was applied
      const [, , , evaluationStartTime, evaluationEndTime, , ] = await governanceRewards.getProposalDetails(1);
      expect(evaluationEndTime.sub(evaluationStartTime)).to.equal(newEvaluationPeriod);
    });
  });
});