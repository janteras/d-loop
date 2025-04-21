const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integrated Oracle Rewards System", function () {
  let admin, protocolDAO, user1, user2, user3;
  let mockToken, mockAsset, priceOracle, governanceRewards, proposalTracker, protocolDAOExtension;
  
  const ONE_DAY = 24 * 60 * 60;
  const THIRTY_DAYS = 30 * ONE_DAY;
  const EVALUATION_PERIOD = THIRTY_DAYS;
  const MIN_PRICE_CHANGE_PERCENT = ethers.utils.parseEther("0.05"); // 5%
  
  beforeEach(async function () {
    [admin, protocolDAO, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("DLOOP Token", "DLOOP"); // Governance token
    await mockToken.deployed();
    
    mockAsset = await MockERC20.deploy("Mock Asset", "ASSET"); // Asset for proposals
    await mockAsset.deployed();
    
    // Mint tokens
    await mockToken.mint(admin.address, ethers.utils.parseEther("1000000"));
    await mockToken.mint(user1.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.utils.parseEther("20000"));
    await mockToken.mint(user3.address, ethers.utils.parseEther("30000"));
    
    // Deploy price oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    priceOracle = await MockPriceOracle.deploy(admin.address);
    await priceOracle.deployed();
    
    // Add asset to price oracle
    await priceOracle.addAssetSupport(mockAsset.address, ethers.utils.parseEther("100"));
    
    // Deploy governance rewards contract
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      admin.address,
      protocolDAO.address,
      mockToken.address,
      priceOracle.address,
      EVALUATION_PERIOD,
      MIN_PRICE_CHANGE_PERCENT
    );
    await governanceRewards.deployed();
    
    // Fund governance rewards
    await mockToken.connect(admin).approve(governanceRewards.address, ethers.utils.parseEther("500000"));
    await governanceRewards.connect(admin).provideRewards(ethers.utils.parseEther("500000"));
    
    // Deploy proposal tracker
    const ProposalTracker = await ethers.getContractFactory("ProposalTracker");
    proposalTracker = await ProposalTracker.deploy(
      admin.address,
      protocolDAO.address,
      governanceRewards.address
    );
    await proposalTracker.deployed();
    
    // Deploy ProtocolDAO extension
    const ProtocolDAOExtension = await ethers.getContractFactory("ProtocolDAOExtension");
    protocolDAOExtension = await ProtocolDAOExtension.deploy(
      protocolDAO.address,
      proposalTracker.address,
      priceOracle.address
    );
    await protocolDAOExtension.deployed();
  });
  
  describe("Integrated Oracle Flow", function () {
    it("should handle full invest and reward flow", async function () {
      // 1. Register a proposal for investment (simulating ProtocolDAO action)
      await protocolDAOExtension.connect(protocolDAO).registerProposalWithAsset(
        1, // proposalId
        mockAsset.address,
        0 // ProposalType.Invest
      );
      
      // Check proposal is registered
      expect(await proposalTracker.isProposalTracked(1)).to.be.true;
      expect(await protocolDAOExtension.getProposalAsset(1)).to.equal(mockAsset.address);
      expect(await protocolDAOExtension.getProposalType(1)).to.equal(0); // Invest
      
      // 2. Register votes (simulating user interactions)
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        1,
        user1.address,
        true, // Yes vote
        ethers.utils.parseEther("10000")
      );
      
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        1,
        user2.address,
        false, // No vote
        ethers.utils.parseEther("20000")
      );
      
      // 3. Fast forward time past evaluation period
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // 4. Update price
      // Case 1: Price increases by 20% - Yes vote was correct
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("120"));
      
      // 5. Request evaluation
      await protocolDAOExtension.requestEvaluation(1);
      
      // 6. Check rewards
      const user1Rewards = await governanceRewards.getPendingRewards(user1.address);
      const user2Rewards = await governanceRewards.getPendingRewards(user2.address);
      
      expect(user1Rewards).to.be.gt(0); // User1 voted Yes, which was correct
      expect(user2Rewards).to.equal(0); // User2 voted No, which was incorrect
      
      // 7. Claim rewards
      await governanceRewards.connect(user1).claimRewards();
      
      // Check reward was credited to user
      expect(await mockToken.balanceOf(user1.address)).to.equal(
        ethers.utils.parseEther("10000").add(user1Rewards)
      );
    });
    
    it("should handle full divest and reward flow", async function () {
      // 1. Register a proposal for divestment
      await protocolDAOExtension.connect(protocolDAO).registerProposalWithAsset(
        2, // proposalId
        mockAsset.address,
        1 // ProposalType.Divest
      );
      
      // 2. Register votes
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        2,
        user1.address,
        false, // No vote (against divesting)
        ethers.utils.parseEther("10000")
      );
      
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        2,
        user2.address,
        true, // Yes vote (for divesting)
        ethers.utils.parseEther("20000")
      );
      
      // 3. Fast forward time
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // 4. Update price
      // Case 2: Price increases by 10% - No vote was correct (shouldn't divest)
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("110"));
      
      // 5. Request evaluation
      await protocolDAOExtension.requestEvaluation(2);
      
      // 6. Check rewards
      const user1Rewards = await governanceRewards.getPendingRewards(user1.address);
      const user2Rewards = await governanceRewards.getPendingRewards(user2.address);
      
      expect(user1Rewards).to.be.gt(0); // User1 voted No (against divest), which was correct
      expect(user2Rewards).to.equal(0); // User2 voted Yes (for divest), which was incorrect
      
      // 7. Claim rewards
      await governanceRewards.connect(user1).claimRewards();
      
      // Check reward was credited to user
      expect(await mockToken.balanceOf(user1.address)).to.be.gt(ethers.utils.parseEther("10000"));
    });
    
    it("should handle streak bonuses correctly", async function () {
      // First proposal - Yes to invest, price increases
      await protocolDAOExtension.connect(protocolDAO).registerProposalWithAsset(
        3,
        mockAsset.address,
        0 // Invest
      );
      
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        3,
        user3.address,
        true, // Yes
        ethers.utils.parseEther("30000")
      );
      
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("120"));
      await protocolDAOExtension.requestEvaluation(3);
      
      const firstReward = await governanceRewards.getPendingRewards(user3.address);
      
      // Second proposal - No to divest, price increases again
      await protocolDAOExtension.connect(protocolDAO).registerProposalWithAsset(
        4,
        mockAsset.address,
        1 // Divest
      );
      
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        4,
        user3.address,
        false, // No (against divesting)
        ethers.utils.parseEther("30000")
      );
      
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("135"));
      await protocolDAOExtension.requestEvaluation(4);
      
      // Check streak has increased
      expect(await governanceRewards.getCurrentStreak(user3.address)).to.equal(2);
      
      // Claim rewards
      await governanceRewards.connect(user3).claimRewards();
      
      // Total should include streak bonuses
      const totalReward = await mockToken.balanceOf(user3.address);
      expect(totalReward).to.be.gt(ethers.utils.parseEther("30000").add(firstReward));
    });
    
    it("should handle neutral outcomes correctly", async function () {
      // Register a proposal for investment
      await protocolDAOExtension.connect(protocolDAO).registerProposalWithAsset(
        5,
        mockAsset.address,
        0 // Invest
      );
      
      // Register votes
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        5,
        user1.address,
        true, // Yes
        ethers.utils.parseEther("10000")
      );
      
      await protocolDAOExtension.connect(protocolDAO).registerVoteWithPower(
        5,
        user2.address,
        false, // No
        ethers.utils.parseEther("20000")
      );
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [EVALUATION_PERIOD + 1]);
      await ethers.provider.send("evm_mine");
      
      // Price change below threshold (3% is below 5% minimum)
      await priceOracle.updatePrice(mockAsset.address, ethers.utils.parseEther("103"));
      
      // Request evaluation
      await protocolDAOExtension.requestEvaluation(5);
      
      // Check that no rewards were issued
      const user1Rewards = await governanceRewards.getPendingRewards(user1.address);
      const user2Rewards = await governanceRewards.getPendingRewards(user2.address);
      
      expect(user1Rewards).to.equal(0);
      expect(user2Rewards).to.equal(0);
      
      // Check streaks are unaffected
      expect(await governanceRewards.getCurrentStreak(user1.address)).to.equal(0);
      expect(await governanceRewards.getCurrentStreak(user2.address)).to.equal(0);
    });
  });
});