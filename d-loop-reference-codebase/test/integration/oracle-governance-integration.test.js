// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Oracle-Governance Integration Tests", function () {
  let dloopToken;
  let protocolDAO;
  let rewardDistributor;
  let aiNodeRegistry;
  let soulboundNFT;
  let priceOracle;
  let multiOracle;
  
  let deployer, user1, user2, aiNode1, aiNode2, aiNode3;
  
  const PRICE_FEED_ID = "ETH/USD";
  const INITIAL_ETH_PRICE = ethers.utils.parseUnits("3000", 8); // $3000 per ETH with 8 decimals
  const INCREASED_ETH_PRICE = ethers.utils.parseUnits("3500", 8); // $3500 per ETH with 8 decimals
  const DECREASED_ETH_PRICE = ethers.utils.parseUnits("2800", 8); // $2800 per ETH with 8 decimals
  
  const PROPOSAL_STATE = {
    PENDING: 0,
    ACTIVE: 1,
    CANCELED: 2,
    DEFEATED: 3,
    SUCCEEDED: 4,
    QUEUED: 5,
    EXPIRED: 6,
    EXECUTED: 7
  };

  const AI_VOTING_PERIOD = 86400; // 1 day in seconds
  const HUMAN_VOTING_PERIOD = 604800; // 7 days in seconds
  
  // Vote types
  const VOTE_AGAINST = 0;
  const VOTE_FOR = 1;
  const VOTE_ABSTAIN = 2;
  
  before(async function () {
    [deployer, user1, user2, aiNode1, aiNode2, aiNode3] = await ethers.getSigners();
    
    // Deploy mock price feed for testing
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const mockPriceFeed = await MockPriceFeed.deploy();
    await mockPriceFeed.deployed();
    
    // Set initial price
    await mockPriceFeed.setLatestAnswer(INITIAL_ETH_PRICE);
    
    // Deploy ChainlinkPriceOracle
    const ChainlinkPriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
    priceOracle = await ChainlinkPriceOracle.deploy();
    await priceOracle.deployed();
    
    // Add price feed to oracle
    await priceOracle.addPriceFeed(PRICE_FEED_ID, mockPriceFeed.address);
    
    // Deploy MultiOracleConsensus
    const MultiOracleConsensus = await ethers.getContractFactory("MultiOracleConsensus");
    multiOracle = await MultiOracleConsensus.deploy();
    await multiOracle.deployed();
    
    // Add ChainlinkPriceOracle to MultiOracleConsensus
    await multiOracle.addOracle(priceOracle.address, 100); // 100% weight to Chainlink
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("DLOOP", "DLOOP");
    await dloopToken.deployed();
    
    // Mint tokens to users for testing
    const initialBalance = ethers.utils.parseEther("1000000");
    await dloopToken.mint(deployer.address, initialBalance);
    await dloopToken.mint(user1.address, initialBalance);
    await dloopToken.mint(user2.address, initialBalance);
    await dloopToken.mint(aiNode1.address, initialBalance);
    await dloopToken.mint(aiNode2.address, initialBalance);
    await dloopToken.mint(aiNode3.address, initialBalance);
    
    // Delegate voting power
    await dloopToken.connect(aiNode1).delegate(aiNode1.address);
    await dloopToken.connect(aiNode2).delegate(aiNode2.address);
    await dloopToken.connect(aiNode3).delegate(aiNode3.address);
    await dloopToken.connect(user1).delegate(user1.address);
    await dloopToken.connect(user2).delegate(user2.address);
    
    // Deploy SoulboundNFT for AI nodes
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Credential", "AINC");
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Transfer ownership of SoulboundNFT to AINodeRegistry
    await soulboundNFT.transferOwnership(aiNodeRegistry.address);
    
    // Register AI nodes
    await aiNodeRegistry.registerAINode(aiNode1.address, "AI Node 1", "https://metadata.dloop.org/ainode1");
    await aiNodeRegistry.registerAINode(aiNode2.address, "AI Node 2", "https://metadata.dloop.org/ainode2");
    await aiNodeRegistry.registerAINode(aiNode3.address, "AI Node 3", "https://metadata.dloop.org/ainode3");
    
    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(dloopToken.address, aiNodeRegistry.address);
    await rewardDistributor.deployed();
    
    // Set up reward distribution parameters
    await rewardDistributor.setRewardParameters(
      ethers.utils.parseEther("100000"), // Total rewards for the 6-year period
      72,                                // 72 months = 6 years
      ethers.utils.parseEther("5")       // Minimum threshold for receiving rewards
    );
    
    // Add multiOracle to RewardDistributor for price tracking
    await rewardDistributor.setPriceOracle(multiOracle.address, PRICE_FEED_ID);
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      dloopToken.address,
      aiNodeRegistry.address,
      AI_VOTING_PERIOD,
      HUMAN_VOTING_PERIOD
    );
    await protocolDAO.deployed();
    
    // Connect RewardDistributor to ProtocolDAO for tracking governance participation
    await rewardDistributor.setProtocolDAO(protocolDAO.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), rewardDistributor.address);
  });

  describe("Oracle-Influenced Governance Rewards", function () {
    let proposalId;
    let increaseProposalId;
    let decreaseProposalId;
    
    it("should create a governance proposal for price adjustment", async function () {
      // Proposal to adjust asset allocation based on expected ETH price increase
      const increaseProposalDesc = "Increase ETH allocation based on expected price increase";
      const increaseCalldata = "0x"; // In a real scenario, this would be actual calldata
      
      // Create proposal as AI node
      await protocolDAO.connect(aiNode1).propose(
        [multiOracle.address],
        [0],
        [increaseCalldata],
        increaseProposalDesc
      );
      
      // Get the proposal ID
      increaseProposalId = await protocolDAO.hashProposal(
        [multiOracle.address],
        [0],
        [increaseCalldata],
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(increaseProposalDesc))
      );
      
      // Proposal to decrease allocation based on expected ETH price decrease
      const decreaseProposalDesc = "Decrease ETH allocation based on expected price decrease";
      const decreaseCalldata = "0x"; // In a real scenario, this would be actual calldata
      
      // Create another proposal as different AI node
      await protocolDAO.connect(aiNode2).propose(
        [multiOracle.address],
        [0],
        [decreaseCalldata],
        decreaseProposalDesc
      );
      
      // Get the proposal ID
      decreaseProposalId = await protocolDAO.hashProposal(
        [multiOracle.address],
        [0],
        [decreaseCalldata],
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(decreaseProposalDesc))
      );
      
      // Verify both proposals are in active state
      expect(await protocolDAO.state(increaseProposalId)).to.equal(PROPOSAL_STATE.ACTIVE);
      expect(await protocolDAO.state(decreaseProposalId)).to.equal(PROPOSAL_STATE.ACTIVE);
    });
    
    it("should record AI node voting on proposals", async function () {
      // AI node 1 votes FOR increase proposal (their own proposal)
      await protocolDAO.connect(aiNode1).castVote(increaseProposalId, VOTE_FOR);
      
      // AI node 2 votes AGAINST increase proposal (as they expect decrease)
      await protocolDAO.connect(aiNode2).castVote(increaseProposalId, VOTE_AGAINST);
      
      // AI node 3 votes FOR increase proposal
      await protocolDAO.connect(aiNode3).castVote(increaseProposalId, VOTE_FOR);
      
      // AI node 1 votes AGAINST decrease proposal
      await protocolDAO.connect(aiNode1).castVote(decreaseProposalId, VOTE_AGAINST);
      
      // AI node 2 votes FOR decrease proposal (their own proposal)
      await protocolDAO.connect(aiNode2).castVote(decreaseProposalId, VOTE_FOR);
      
      // AI node 3 votes AGAINST decrease proposal
      await protocolDAO.connect(aiNode3).castVote(decreaseProposalId, VOTE_AGAINST);
      
      // Get vote counts
      const increaseVotes = await protocolDAO.proposalVotes(increaseProposalId);
      const decreaseVotes = await protocolDAO.proposalVotes(decreaseProposalId);
      
      // Ensure votes are recorded correctly
      expect(increaseVotes.forVotes).to.be.gt(0);
      expect(increaseVotes.againstVotes).to.be.gt(0);
      expect(decreaseVotes.forVotes).to.be.gt(0);
      expect(decreaseVotes.againstVotes).to.be.gt(0);
    });
    
    it("should advance time to end of voting period", async function () {
      // Get the current timestamp
      const currentTimestamp = await time.latest();
      
      // Get deadline for the first proposal
      const deadline = await protocolDAO.proposalDeadline(increaseProposalId);
      
      // Advance time to after the deadline
      await time.increaseTo(deadline.add(1));
      
      // Verify proposals are no longer active
      expect(await protocolDAO.state(increaseProposalId)).to.not.equal(PROPOSAL_STATE.ACTIVE);
      expect(await protocolDAO.state(decreaseProposalId)).to.not.equal(PROPOSAL_STATE.ACTIVE);
    });
    
    it("should reflect actual price change in the oracle", async function () {
      // Record initial price snapshot for reward calculation
      await rewardDistributor.recordPriceSnapshot();
      
      // Mock price feed update to show price increase (validating the increase proposal)
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const priceFeedAddress = await priceOracle.priceFeeds(PRICE_FEED_ID);
      const mockPriceFeed = MockPriceFeed.attach(priceFeedAddress);
      
      // Update price to increased level
      await mockPriceFeed.setLatestAnswer(INCREASED_ETH_PRICE);
      
      // Verify oracle price is updated
      const updatedPrice = await multiOracle.getPrice(PRICE_FEED_ID);
      expect(updatedPrice).to.equal(INCREASED_ETH_PRICE);
      
      // Record price change for reward calculation
      await rewardDistributor.recordPriceSnapshot();
    });
    
    it("should distribute rewards based on correct price prediction", async function () {
      // Track initial balances
      const initialBalance1 = await dloopToken.balanceOf(aiNode1.address);
      const initialBalance2 = await dloopToken.balanceOf(aiNode2.address);
      const initialBalance3 = await dloopToken.balanceOf(aiNode3.address);
      
      // Trigger reward distribution
      await rewardDistributor.distributeMonthlyRewards();
      
      // Check final balances
      const finalBalance1 = await dloopToken.balanceOf(aiNode1.address);
      const finalBalance2 = await dloopToken.balanceOf(aiNode2.address);
      const finalBalance3 = await dloopToken.balanceOf(aiNode3.address);
      
      // AI Node 1 and 3 voted for price increase which was correct
      // AI Node 2 voted against price increase which was incorrect
      
      // Verify AI Node 1 received rewards
      expect(finalBalance1).to.be.gt(initialBalance1);
      
      // Verify AI Node 3 received rewards
      expect(finalBalance3).to.be.gt(initialBalance3);
      
      // AI Node 2 might still get some base rewards, but should get less than Node 1 and 3
      // Or might get no rewards if the incorrect vote penalty is severe
      const node1Reward = finalBalance1.sub(initialBalance1);
      const node2Reward = finalBalance2.sub(initialBalance2);
      const node3Reward = finalBalance3.sub(initialBalance3);
      
      // Node 1 and 3 should have similar rewards as they both voted correctly
      expect(node1Reward).to.be.closeTo(node3Reward, node1Reward.div(10)); // Within 10%
      
      // If incorrect votes get no rewards
      if (node2Reward.isZero()) {
        expect(node2Reward).to.equal(0);
      } else {
        // If incorrect votes get reduced rewards
        expect(node2Reward).to.be.lt(node1Reward);
        expect(node2Reward).to.be.lt(node3Reward);
      }
    });
    
    it("should track reputation scores based on voting history", async function () {
      // Get reputation scores
      const reputation1 = await rewardDistributor.getAINodeReputation(aiNode1.address);
      const reputation2 = await rewardDistributor.getAINodeReputation(aiNode2.address);
      const reputation3 = await rewardDistributor.getAINodeReputation(aiNode3.address);
      
      // AI Node 1 and 3 voted correctly, so should have higher reputation
      expect(reputation1).to.be.gt(0);
      expect(reputation3).to.be.gt(0);
      
      // AI Node 2 voted incorrectly, so should have lower reputation
      // If zero reputation is the floor, it might be zero
      // If negative reputation is possible, it might be negative
      if (reputation2.isZero()) {
        expect(reputation2).to.equal(0);
      } else {
        expect(reputation2).to.be.lt(reputation1);
        expect(reputation2).to.be.lt(reputation3);
      }
    });
    
    it("should handle multiple price change scenarios for reward distribution", async function () {
      // Create a new proposal
      const newProposalDesc = "Adjust allocation based on new price predictions";
      const newCalldata = "0x";
      
      // Create proposal as AI node
      await protocolDAO.connect(aiNode1).propose(
        [multiOracle.address],
        [0],
        [newCalldata],
        newProposalDesc
      );
      
      // Get the proposal ID
      proposalId = await protocolDAO.hashProposal(
        [multiOracle.address],
        [0],
        [newCalldata],
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(newProposalDesc))
      );
      
      // AI node 1 votes FOR (expecting further price increase)
      await protocolDAO.connect(aiNode1).castVote(proposalId, VOTE_FOR);
      
      // AI node 2 votes FOR (changing strategy based on previous results)
      await protocolDAO.connect(aiNode2).castVote(proposalId, VOTE_FOR);
      
      // AI node 3 votes AGAINST (expecting price decrease)
      await protocolDAO.connect(aiNode3).castVote(proposalId, VOTE_AGAINST);
      
      // Advance time to end of voting period
      const deadline = await protocolDAO.proposalDeadline(proposalId);
      await time.increaseTo(deadline.add(1));
      
      // Record price snapshot
      await rewardDistributor.recordPriceSnapshot();
      
      // Mock price feed update to show price decrease (validating the against vote)
      const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
      const priceFeedAddress = await priceOracle.priceFeeds(PRICE_FEED_ID);
      const mockPriceFeed = MockPriceFeed.attach(priceFeedAddress);
      
      // Update price to decreased level
      await mockPriceFeed.setLatestAnswer(DECREASED_ETH_PRICE);
      
      // Record price change for reward calculation
      await rewardDistributor.recordPriceSnapshot();
      
      // Track initial balances
      const initialBalance1 = await dloopToken.balanceOf(aiNode1.address);
      const initialBalance2 = await dloopToken.balanceOf(aiNode2.address);
      const initialBalance3 = await dloopToken.balanceOf(aiNode3.address);
      
      // Trigger reward distribution
      await rewardDistributor.distributeMonthlyRewards();
      
      // Check final balances
      const finalBalance1 = await dloopToken.balanceOf(aiNode1.address);
      const finalBalance2 = await dloopToken.balanceOf(aiNode2.address);
      const finalBalance3 = await dloopToken.balanceOf(aiNode3.address);
      
      // AI Node 3 voted correctly this time (against price increase)
      // AI Node 1 and 2 voted incorrectly
      
      const node1Reward = finalBalance1.sub(initialBalance1);
      const node2Reward = finalBalance2.sub(initialBalance2);
      const node3Reward = finalBalance3.sub(initialBalance3);
      
      // Node 3 should get the highest reward this time
      expect(node3Reward).to.be.gt(0);
      
      // If incorrect votes get no rewards
      if (node1Reward.isZero() && node2Reward.isZero()) {
        expect(node1Reward).to.equal(0);
        expect(node2Reward).to.equal(0);
      } else {
        // If incorrect votes get reduced rewards
        expect(node3Reward).to.be.gt(node1Reward);
        expect(node3Reward).to.be.gt(node2Reward);
      }
      
      // Check updated reputation scores
      const reputation1 = await rewardDistributor.getAINodeReputation(aiNode1.address);
      const reputation2 = await rewardDistributor.getAINodeReputation(aiNode2.address);
      const reputation3 = await rewardDistributor.getAINodeReputation(aiNode3.address);
      
      // Node 3 should have seen an increase in reputation
      expect(reputation3).to.be.gt(0);
      
      // Node 1 and 2 should have seen a decrease or remained at 0
      if (reputation1.isZero() && reputation2.isZero()) {
        expect(reputation1).to.equal(0);
        expect(reputation2).to.equal(0);
      } else {
        // Reputation might be non-zero due to previous correct votes
        expect(reputation3).to.be.gt(reputation1);
        expect(reputation3).to.be.gt(reputation2);
      }
    });
  });
});