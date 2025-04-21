/**
 * @title AssetDAO Governance Rewards Test
 * @dev Tests for verifying the governance rewards mechanism in AssetDAO
 * 
 * This test ensures that:
 * - Governance rewards are correctly calculated based on participation
 * - Rewards are distributed to eligible participants
 * - The rewards mechanism integrates properly with the voting system
 */

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Helper function to handle contract calls and standardize error handling
async function handleContractCall(fn) {
  try {
    const result = await fn();
    return { success: true, result, error: null };
  } catch (error) {
    console.error(`Contract call failed: ${error.message}`);
    return { success: false, result: null, error };
  }
}

// Constants
const ADMIN_ROLE = ethers.id("ADMIN_ROLE");
const MINTER_ROLE = ethers.id("MINTER_ROLE");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("AssetDAO Governance Rewards System", function() {
  // Fixture to deploy all necessary contracts
  async function deployGovernanceRewardsFixture() {
    const [owner, admin, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy DAIToken
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.waitForDeployment();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // initialSupply
      18, // decimals
      ethers.parseEther("100000000"), // maxSupply
      admin.address
    );
    await dloopToken.waitForDeployment();
    
    // Deploy PriceOracle for AssetDAO
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Deploy FeeProcessor for AssetDAO
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    const feeProcessor = await FeeProcessor.deploy(
      owner.address, // treasury (temporary)
      owner.address, // rewardDistributor (temporary)
      owner.address, // feeCalculator (temporary)
      admin.address, // admin
      8000, // treasuryPercentage (80%)
      2000  // rewardDistPercentage (20%)
    );
    await feeProcessor.waitForDeployment();
    
    // Deploy ProtocolDAO for AssetDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      owner.address, // treasury (temporary)
      86400, // votingPeriod (1 day in seconds)
      43200, // executionDelay (12 hours in seconds)
      10     // quorum (10%)
    );
    await protocolDAO.waitForDeployment();
    
    // Deploy AssetDAO with correct constructor parameters
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      await daiToken.getAddress(),
      await dloopToken.getAddress(),
      await priceOracle.getAddress(),
      await feeProcessor.getAddress(),
      await protocolDAO.getAddress()
    );
    await assetDAO.waitForDeployment();
    
    // Deploy GovernanceRewards with correct constructor parameters
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      await dloopToken.getAddress(),
      admin.address
    );
    await governanceRewards.waitForDeployment();
    
    // Setup roles and initial state
    await assetDAO.grantRole(ADMIN_ROLE, admin.address);
    await dloopToken.grantRole(MINTER_ROLE, admin.address);
    
    // Mint tokens to users for testing
    await dloopToken.connect(admin).mint(user1.address, ethers.parseEther("1000"));
    await dloopToken.connect(admin).mint(user2.address, ethers.parseEther("2000"));
    await dloopToken.connect(admin).mint(user3.address, ethers.parseEther("3000"));
    
    // Initialize AssetDAO with GovernanceRewards
    await assetDAO.connect(admin).setGovernanceRewards(await governanceRewards.getAddress());
    
    return { 
      assetDAO, 
      governanceRewards, 
      daiToken, 
      dloopToken, 
      owner, 
      admin, 
      user1, 
      user2, 
      user3 
    };
  }
  
  describe("Governance Rewards Calculation", function() {
    it("should calculate rewards based on voting participation", async function() {
      const { assetDAO, governanceRewards, dloopToken, admin, user1, user2, user3 } = await loadFixture(deployGovernanceRewardsFixture);
      
      // Create a proposal
      const proposalDescription = "Test Proposal for Rewards";
      const proposalActions = [];
      
      const createProposalTx = await handleContractCall(() => 
        assetDAO.connect(admin).createProposal(proposalDescription, proposalActions)
      );
      
      expect(createProposalTx.success).to.be.true;
      
      // Get the proposal ID
      const proposalId = createProposalTx.result;
      
      // Users vote on the proposal
      await handleContractCall(() => assetDAO.connect(user1).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user2).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user3).vote(proposalId, false));
      
      // Calculate rewards for each participant
      const user1Reward = await governanceRewards.calculateReward(user1.address, proposalId);
      const user2Reward = await governanceRewards.calculateReward(user2.address, proposalId);
      const user3Reward = await governanceRewards.calculateReward(user3.address, proposalId);
      
      // Verify rewards are calculated correctly
      expect(user1Reward).to.be.gt(0, "User1 should receive rewards for participation");
      expect(user2Reward).to.be.gt(0, "User2 should receive rewards for participation");
      expect(user3Reward).to.be.gt(0, "User3 should receive rewards for participation");
      
      // Verify rewards are proportional to stake
      // User2 has twice the tokens of User1, so should get approximately twice the rewards
      const rewardRatio = parseFloat(ethers.formatEther(user2Reward)) / parseFloat(ethers.formatEther(user1Reward));
      expect(rewardRatio).to.be.closeTo(2.0, 0.1, "Rewards should be proportional to stake");
    });
    
    it("should not award rewards to non-participants", async function() {
      const { assetDAO, governanceRewards, admin, user1, user2, user3 } = await loadFixture(deployGovernanceRewardsFixture);
      
      // Create a proposal
      const proposalDescription = "Test Proposal for Non-Participants";
      const proposalActions = [];
      
      const createProposalTx = await handleContractCall(() => 
        assetDAO.connect(admin).createProposal(proposalDescription, proposalActions)
      );
      
      const proposalId = createProposalTx.result;
      
      // Only user1 and user2 vote
      await handleContractCall(() => assetDAO.connect(user1).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user2).vote(proposalId, false));
      
      // User3 doesn't participate
      const user3Reward = await governanceRewards.calculateReward(user3.address, proposalId);
      
      // Verify non-participant gets zero rewards
      expect(user3Reward).to.equal(0, "Non-participants should not receive rewards");
    });
  });
  
  describe("Rewards Distribution", function() {
    it("should distribute rewards to eligible participants", async function() {
      const { assetDAO, governanceRewards, dloopToken, admin, user1, user2 } = await loadFixture(deployGovernanceRewardsFixture);
      
      // Fund the rewards contract with tokens
      await dloopToken.connect(admin).transfer(
        await governanceRewards.getAddress(), 
        ethers.parseEther("10000")
      );
      
      // Create a proposal
      const proposalDescription = "Test Proposal for Distribution";
      const proposalActions = [];
      
      const createProposalTx = await handleContractCall(() => 
        assetDAO.connect(admin).createProposal(proposalDescription, proposalActions)
      );
      
      const proposalId = createProposalTx.result;
      
      // Users vote on the proposal
      await handleContractCall(() => assetDAO.connect(user1).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user2).vote(proposalId, false));
      
      // Record balances before distribution
      const user1BalanceBefore = await dloopToken.balanceOf(user1.address);
      const user2BalanceBefore = await dloopToken.balanceOf(user2.address);
      
      // Distribute rewards
      await handleContractCall(() => 
        governanceRewards.connect(admin).distributeRewards(proposalId)
      );
      
      // Record balances after distribution
      const user1BalanceAfter = await dloopToken.balanceOf(user1.address);
      const user2BalanceAfter = await dloopToken.balanceOf(user2.address);
      
      // Verify rewards were distributed
      expect(user1BalanceAfter).to.be.gt(user1BalanceBefore, "User1 should receive rewards");
      expect(user2BalanceAfter).to.be.gt(user2BalanceBefore, "User2 should receive rewards");
    });
    
    it("should not allow double distribution of rewards", async function() {
      const { assetDAO, governanceRewards, admin, user1 } = await loadFixture(deployGovernanceRewardsFixture);
      
      // Create a proposal
      const proposalDescription = "Test Proposal for Double Distribution";
      const proposalActions = [];
      
      const createProposalTx = await handleContractCall(() => 
        assetDAO.connect(admin).createProposal(proposalDescription, proposalActions)
      );
      
      const proposalId = createProposalTx.result;
      
      // User votes
      await handleContractCall(() => assetDAO.connect(user1).vote(proposalId, true));
      
      // First distribution should succeed
      const firstDistribution = await handleContractCall(() => 
        governanceRewards.connect(admin).distributeRewards(proposalId)
      );
      
      expect(firstDistribution.success).to.be.true;
      
      // Second distribution should fail
      const secondDistribution = await handleContractCall(() => 
        governanceRewards.connect(admin).distributeRewards(proposalId)
      );
      
      expect(secondDistribution.success).to.be.false;
      expect(secondDistribution.error.message).to.include("already distributed");
    });
  });
  
  describe("Gas Profiling for Governance Rewards", function() {
    it("should measure gas consumption for reward calculation", async function() {
      const { assetDAO, governanceRewards, admin, user1, user2, user3 } = await loadFixture(deployGovernanceRewardsFixture);
      
      // Create a proposal
      const proposalDescription = "Gas Profiling Test Proposal";
      const proposalActions = [];
      
      const createProposalTx = await handleContractCall(() => 
        assetDAO.connect(admin).createProposal(proposalDescription, proposalActions)
      );
      
      const proposalId = createProposalTx.result;
      
      // Users vote on the proposal
      await handleContractCall(() => assetDAO.connect(user1).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user2).vote(proposalId, true));
      await handleContractCall(() => assetDAO.connect(user3).vote(proposalId, false));
      
      // Measure gas for reward calculation
      const calculateRewardTx = await governanceRewards.calculateReward.estimateGas(user1.address, proposalId);
      console.log(`Gas used for calculateReward: ${calculateRewardTx.toString()}`);
      
      // Measure gas for reward distribution
      const distributeRewardsTx = await governanceRewards.distributeRewards.estimateGas(proposalId);
      console.log(`Gas used for distributeRewards: ${distributeRewardsTx.toString()}`);
      
      // No specific assertions, just logging gas usage for baseline measurements
    });
  });
});
