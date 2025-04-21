const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Governance Rewards Integration", function () {
  let ProtocolDAOTracker, GovernanceTracker, RewardAllocator, GovernanceOracle, MockExecutor, MockToken;
  let dao, tracker, allocator, oracle, executor, token;
  let owner, user1, user2, user3;
  
  // Constants for testing
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  const ALLOCATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALLOCATOR_ROLE"));
  const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
  
  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock contracts
    MockExecutor = await ethers.getContractFactory("MockExecutor");
    executor = await MockExecutor.deploy();
    
    MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Governance Token", "GOV", 18);
    
    // Mint tokens for testing
    await token.mint(owner.address, ethers.utils.parseEther("1000000"));
    
    // Deploy GovernanceTracker
    GovernanceTracker = await ethers.getContractFactory("GovernanceTracker");
    tracker = await upgrades.deployProxy(GovernanceTracker, [MONTH_IN_SECONDS]);
    await tracker.deployed();
    
    // Deploy ProtocolDAOTracker
    ProtocolDAOTracker = await ethers.getContractFactory("ProtocolDAOTracker");
    dao = await ProtocolDAOTracker.deploy(await (await ethers.getContractFactory("MockAINodeIdentifier")).deploy().then(c => c.address));
    await dao.deployed();
    
    // Configure DAO
    await dao.setGovernanceTracker(tracker.address);
    
    // Deploy GovernanceOracle
    GovernanceOracle = await ethers.getContractFactory("GovernanceOracle");
    oracle = await GovernanceOracle.deploy(tracker.address);
    await oracle.deployed();
    
    // Mock RewardDistributor for simplicity
    // In a real scenario, this would be the actual RewardDistributor
    const mockDistributor = await (await ethers.getContractFactory("MockContract")).deploy();
    
    // Deploy RewardAllocator
    RewardAllocator = await ethers.getContractFactory("RewardAllocator");
    allocator = await upgrades.deployProxy(RewardAllocator, [tracker.address, mockDistributor.address]);
    await allocator.deployed();
    
    // Set up roles and permissions
    await tracker.grantRole(GOVERNANCE_ROLE, dao.address);
    await tracker.grantRole(ORACLE_ROLE, oracle.address);
    await allocator.grantRole(ALLOCATOR_ROLE, owner.address);
    
    // Set up voting power in DAO for testing
    await dao.mockSetVotingPower(owner.address, ethers.utils.parseEther("100"));
    await dao.mockSetVotingPower(user1.address, ethers.utils.parseEther("100"));
    await dao.mockSetVotingPower(user2.address, ethers.utils.parseEther("100"));
    await dao.mockSetVotingPower(user3.address, ethers.utils.parseEther("100"));
    
    // Whitelist the executor in the DAO
    await dao.updateExecutor(executor.address, true);
  });
  
  describe("Governance Flow with Tracking", function () {
    it("should track proposal creation and voting", async function () {
      // Create a proposal
      const tx = await dao.connect(user1).submitProposal(
        executor.address,
        "Test Proposal"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote on the proposal
      await dao.connect(user2).voteProposal(proposalId, true);
      await dao.connect(user3).voteProposal(proposalId, false);
      
      // Check tracking in GovernanceTracker
      const creator = await tracker.getUserStats(user1.address);
      expect(creator.proposals).to.equal(1);
      expect(creator.totalScore).to.be.gt(0);
      
      const voter1 = await tracker.getUserStats(user2.address);
      expect(voter1.votes).to.equal(1);
      expect(voter1.totalScore).to.be.gt(0);
      
      const voter2 = await tracker.getUserStats(user3.address);
      expect(voter2.votes).to.equal(1);
      expect(voter2.totalScore).to.be.gt(0);
    });
    
    it("should track proposal execution and evaluate outcome", async function () {
      // Create and pass a proposal
      const tx = await dao.connect(user1).submitProposal(
        executor.address,
        "Test Proposal"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote YES with majority
      await dao.connect(owner).voteProposal(proposalId, true);
      await dao.connect(user1).voteProposal(proposalId, true);
      await dao.connect(user2).voteProposal(proposalId, true);
      await dao.connect(user3).voteProposal(proposalId, false);
      
      // Fast forward past voting period (7 days) and timelock (24 hours)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Execute the proposal
      await dao.executeProposal(proposalId);
      
      // Evaluate proposal impact with oracle
      await oracle.evaluateProposal(proposalId, true, "Positive financial impact");
      
      // Check tracking in GovernanceTracker - correct votes
      const voter1 = await tracker.getUserStats(owner.address);
      expect(voter1.votes).to.equal(1);
      expect(voter1.correctVotes).to.equal(1); // Voted YES on a positive outcome
      
      const voter2 = await tracker.getUserStats(user3.address);
      expect(voter2.votes).to.equal(1);
      expect(voter2.correctVotes).to.equal(0); // Voted NO on a positive outcome
    });
  });
  
  describe("Reward Allocation", function () {
    it("should allocate rewards for a period", async function () {
      // Create a proposal
      const tx = await dao.connect(user1).submitProposal(
        executor.address,
        "Test Proposal"
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // Vote on the proposal
      await dao.connect(user2).voteProposal(proposalId, true);
      await dao.connect(user3).voteProposal(proposalId, false);
      
      // Fast forward past the voting period
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // Execute the proposal
      await dao.executeProposal(proposalId);
      
      // Evaluate with the oracle
      await oracle.evaluateProposal(proposalId, true, "Positive financial impact");
      
      // Fast forward to the end of the reward period
      await ethers.provider.send("evm_increaseTime", [MONTH_IN_SECONDS - 7 * 24 * 60 * 60 - 1]);
      await ethers.provider.send("evm_mine");
      
      // Finalize the reward period
      await tracker.finalizeRewardPeriod(0);
      
      // Approve tokens for allocation
      const rewardAmount = ethers.utils.parseEther("1000");
      await token.approve(allocator.address, rewardAmount);
      
      // Allocate rewards
      await allocator.allocateRewards(0, token.address, rewardAmount);
      
      // Test user claims
      // Register reward pool
      await allocator.registerRewardPool(token.address, 0);
      
      // Check user rewards
      const user1Reward = await allocator.getUserReward(user1.address, 0, token.address);
      const user2Reward = await allocator.getUserReward(user2.address, 0, token.address);
      const user3Reward = await allocator.getUserReward(user3.address, 0, token.address);
      
      // All participants should have rewards
      expect(user1Reward[0]).to.be.gt(0);
      expect(user2Reward[0]).to.be.gt(0);
      expect(user3Reward[0]).to.be.gt(0);
      
      // User with correct vote should have more rewards than user with incorrect vote
      expect(user2Reward[0]).to.be.gt(user3Reward[0]);
    });
  });
});