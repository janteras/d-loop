const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RewardDistributor", function () {
  let rewardDistributor;
  let aiNodeIdentifier;
  let mockDLOOP;
  let owner, user1, user2, user3, aiNode;
  
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
  const REWARD_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("REWARD_ADMIN_ROLE"));
  const ASSET_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ASSET_DAO_ROLE"));
  
  beforeEach(async function () {
    [owner, user1, user2, user3, aiNode] = await ethers.getSigners();
    
    // Deploy mock DLOOP token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockDLOOP = await MockERC20.deploy("DLOOP Token", "DLOOP", 18);
    await mockDLOOP.deployed();
    
    // Mint total rewards to owner
    const totalRewards = ethers.utils.parseEther("20016000"); // 20,016,000 DLOOP
    await mockDLOOP.mint(owner.address, totalRewards);
    
    // Deploy SoulboundNFT for AI Node identification
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    const soulboundNFT = await SoulboundNFT.deploy("AI Node NFT", "AINFT");
    await soulboundNFT.deployed();
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy(soulboundNFT.address);
    await aiNodeIdentifier.deployed();
    
    // Grant minter role to AINodeIdentifier
    await soulboundNFT.grantMinterRole(aiNodeIdentifier.address);
    
    // Verify aiNode as an AI node
    await aiNodeIdentifier.addCommitteeMember(owner.address);
    await aiNodeIdentifier.nominateAINode(aiNode.address, "Test AI Node");
    await aiNodeIdentifier.approveAINode(aiNode.address);
    
    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(mockDLOOP.address, aiNodeIdentifier.address);
    await rewardDistributor.deployed();
    
    // Transfer total rewards to RewardDistributor
    await mockDLOOP.transfer(rewardDistributor.address, totalRewards);
    
    // Grant ASSET_DAO_ROLE to owner
    await rewardDistributor.addAssetDAORole(owner.address);
  });
  
  describe("Deployment", function () {
    it("Should set the right addresses and initial values", async function () {
      expect(await rewardDistributor.dloopToken()).to.equal(mockDLOOP.address);
      expect(await rewardDistributor.aiNodeIdentifier()).to.equal(aiNodeIdentifier.address);
      expect(await rewardDistributor.startTime()).to.not.equal(0);
      expect(await rewardDistributor.currentMonth()).to.equal(0);
      expect(await rewardDistributor.totalDistributed()).to.equal(0);
    });
    
    it("Should have the correct total and monthly rewards", async function () {
      const expectedTotalRewards = ethers.utils.parseEther("20016000"); // 20,016,000 DLOOP
      const expectedMonthlyRewards = ethers.utils.parseEther("278000"); // 278,000 DLOOP
      
      expect(await rewardDistributor.TOTAL_REWARDS()).to.equal(expectedTotalRewards);
      expect(await rewardDistributor.MONTHLY_REWARDS()).to.equal(expectedMonthlyRewards);
    });
    
    it("Should assign the default admin role to the deployer", async function () {
      expect(await rewardDistributor.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
    });
    
    it("Should assign the reward admin role to the deployer", async function () {
      expect(await rewardDistributor.hasRole(REWARD_ADMIN_ROLE, owner.address)).to.equal(true);
    });
  });
  
  describe("Decision Recording", function () {
    it("Should correctly record a correct decision", async function () {
      const proposalId = 1;
      const isCorrect = true;
      
      await expect(rewardDistributor.recordDecision(user1.address, proposalId, isCorrect))
        .to.emit(rewardDistributor, "DecisionRecorded")
        .withArgs(user1.address, proposalId, isCorrect);
      
      expect(await rewardDistributor.userCorrectDecisions(user1.address)).to.equal(1);
      expect(await rewardDistributor.totalCorrectDecisions()).to.equal(1);
      expect(await rewardDistributor.isActiveUser(user1.address)).to.equal(true);
      
      // Check active users list
      expect(await rewardDistributor.activeUsers(0)).to.equal(user1.address);
    });
    
    it("Should correctly record an incorrect decision", async function () {
      const proposalId = 1;
      const isCorrect = false;
      
      await expect(rewardDistributor.recordDecision(user1.address, proposalId, isCorrect))
        .to.emit(rewardDistributor, "DecisionRecorded")
        .withArgs(user1.address, proposalId, isCorrect);
      
      expect(await rewardDistributor.userCorrectDecisions(user1.address)).to.equal(0);
      expect(await rewardDistributor.totalCorrectDecisions()).to.equal(0);
      expect(await rewardDistributor.isActiveUser(user1.address)).to.equal(false);
    });
    
    it("Should reject duplicate decision records", async function () {
      const proposalId = 1;
      
      await rewardDistributor.recordDecision(user1.address, proposalId, true);
      
      await expect(rewardDistributor.recordDecision(user1.address, proposalId, true))
        .to.be.revertedWith("Decision already processed");
    });
    
    it("Should reject recording decisions from non-AssetDAO role", async function () {
      const proposalId = 1;
      
      await expect(rewardDistributor.connect(user1).recordDecision(user1.address, proposalId, true))
        .to.be.reverted;
    });
  });
  
  describe("Reward Distribution", function () {
    beforeEach(async function () {
      // Record correct decisions for multiple users
      await rewardDistributor.recordDecision(user1.address, 1, true);
      await rewardDistributor.recordDecision(user2.address, 2, true);
      await rewardDistributor.recordDecision(user3.address, 3, true);
      await rewardDistributor.recordDecision(aiNode.address, 4, true);
      
      // Advance time to the next month
      const daysToAdvance = 31;
      await time.increase(daysToAdvance * 24 * 60 * 60);
    });
    
    it("Should distribute rewards correctly based on decisions", async function () {
      // Check balances before distribution
      const balanceBefore1 = await mockDLOOP.balanceOf(user1.address);
      const balanceBefore2 = await mockDLOOP.balanceOf(user2.address);
      const balanceBefore3 = await mockDLOOP.balanceOf(user3.address);
      const balanceBeforeAI = await mockDLOOP.balanceOf(aiNode.address);
      
      // Distribute rewards
      await rewardDistributor.distributeMonthlyRewards();
      
      // Check balances after distribution
      const balanceAfter1 = await mockDLOOP.balanceOf(user1.address);
      const balanceAfter2 = await mockDLOOP.balanceOf(user2.address);
      const balanceAfter3 = await mockDLOOP.balanceOf(user3.address);
      const balanceAfterAI = await mockDLOOP.balanceOf(aiNode.address);
      
      // Calculate expected rewards
      const monthlyReward = ethers.utils.parseEther("278000"); // 278,000 DLOOP
      const totalCorrectDecisions = 4;
      
      // Regular user share (25% of the pot)
      const regularUserShare = ethers.BigNumber.from(10000).div(totalCorrectDecisions);
      
      // AI node share (25% of the pot but with 20% bonus)
      const aiNodeShare = regularUserShare.mul(12000).div(10000);
      
      // Verify regular users got their rewards
      expect(balanceAfter1.sub(balanceBefore1)).to.be.gt(0);
      expect(balanceAfter2.sub(balanceBefore2)).to.be.gt(0);
      expect(balanceAfter3.sub(balanceBefore3)).to.be.gt(0);
      
      // Verify AI node got more rewards
      expect(balanceAfterAI.sub(balanceBeforeAI)).to.be.gt(0);
      
      // Verify the AI node bonus
      expect(balanceAfterAI.sub(balanceBeforeAI)).to.be.gt(balanceAfter1.sub(balanceBefore1));
      
      // Verify total distributed
      expect(await rewardDistributor.totalDistributed()).to.equal(monthlyReward);
      expect(await rewardDistributor.currentMonth()).to.equal(1);
    });
    
    it("Should reset user data after distribution", async function () {
      // Distribute rewards
      await rewardDistributor.distributeMonthlyRewards();
      
      // Check user data has been reset
      expect(await rewardDistributor.userCorrectDecisions(user1.address)).to.equal(0);
      expect(await rewardDistributor.userCorrectDecisions(user2.address)).to.equal(0);
      expect(await rewardDistributor.userCorrectDecisions(user3.address)).to.equal(0);
      expect(await rewardDistributor.userCorrectDecisions(aiNode.address)).to.equal(0);
      
      expect(await rewardDistributor.isActiveUser(user1.address)).to.equal(false);
      expect(await rewardDistributor.isActiveUser(user2.address)).to.equal(false);
      expect(await rewardDistributor.isActiveUser(user3.address)).to.equal(false);
      expect(await rewardDistributor.isActiveUser(aiNode.address)).to.equal(false);
      
      expect(await rewardDistributor.totalCorrectDecisions()).to.equal(0);
    });
    
    it("Should reject distribution before month end", async function () {
      // Set time back to beginning of month
      await time.increase(-30 * 24 * 60 * 60);
      
      // Try to distribute rewards
      await expect(rewardDistributor.distributeMonthlyRewards())
        .to.be.revertedWith("Month not yet ended");
    });
    
    it("Should reject distribution if no correct decisions", async function () {
      // Distribute rewards to clear previous decisions
      await rewardDistributor.distributeMonthlyRewards();
      
      // Advance to next month
      await time.increase(31 * 24 * 60 * 60);
      
      // Try to distribute rewards when there are no decisions
      await expect(rewardDistributor.distributeMonthlyRewards())
        .to.be.revertedWith("No correct decisions this month");
    });
  });
  
  describe("Pause / Unpause", function () {
    it("Should allow RewardAdmin to pause and unpause", async function () {
      await rewardDistributor.pause();
      expect(await rewardDistributor.paused()).to.equal(true);
      
      await rewardDistributor.unpause();
      expect(await rewardDistributor.paused()).to.equal(false);
    });
    
    it("Should reject decision recording when paused", async function () {
      await rewardDistributor.pause();
      
      await expect(rewardDistributor.recordDecision(user1.address, 1, true))
        .to.be.reverted;
    });
    
    it("Should reject pause/unpause from non-RewardAdmin role", async function () {
      await expect(rewardDistributor.connect(user1).pause())
        .to.be.reverted;
      
      await rewardDistributor.pause();
      
      await expect(rewardDistributor.connect(user1).unpause())
        .to.be.reverted;
    });
  });
  
  describe("Role Management", function () {
    it("Should allow admin to add AssetDAO role", async function () {
      await rewardDistributor.addAssetDAORole(user1.address);
      expect(await rewardDistributor.hasRole(ASSET_DAO_ROLE, user1.address)).to.equal(true);
    });
    
    it("Should allow admin to remove AssetDAO role", async function () {
      await rewardDistributor.addAssetDAORole(user1.address);
      await rewardDistributor.removeAssetDAORole(user1.address);
      expect(await rewardDistributor.hasRole(ASSET_DAO_ROLE, user1.address)).to.equal(false);
    });
  });
});