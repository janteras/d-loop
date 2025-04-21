const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Governance Rewards System", function () {
  // Contract instances
  let dloopToken;
  let governanceRewards;
  let proposalTracker;
  let priceOracle;
  
  // Signers
  let owner;
  let alice;
  let bob;
  let charlie;
  
  // Test asset
  let testAsset;
  
  // Constants
  const epochDuration = 30 * 24 * 60 * 60; // 30 days in seconds
  
  before(async function () {
    // Get signers
    [owner, alice, bob, charlie, testAsset] = await ethers.getSigners();
  });
  
  async function deploySystem() {
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(owner.address);
    await dloopToken.deployed();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(owner.address, dloopToken.address);
    await governanceRewards.deployed();
    
    // Set the governance rewards contract in the token
    await dloopToken.setGovernanceRewardsContract(governanceRewards.address);
    
    // Deploy ProposalTracker (use dummy address for oracle initially)
    const ProposalTracker = await ethers.getContractFactory("ProposalTracker");
    proposalTracker = await ProposalTracker.deploy(governanceRewards.address, owner.address);
    await proposalTracker.deployed();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(owner.address, proposalTracker.address);
    await priceOracle.deployed();
    
    // Update oracle in ProposalTracker
    await proposalTracker.updateOracle(priceOracle.address);
    
    // Grant roles
    await governanceRewards.grantProposalTrackerRole(proposalTracker.address);
    await governanceRewards.grantOracleRole(priceOracle.address);
    
    // Set initial asset price
    await priceOracle.updatePrice(testAsset.address, ethers.utils.parseEther("100"));
  }
  
  describe("Initialization", function () {
    it("Should deploy the governance rewards system", async function () {
      await deploySystem();
      
      expect(await dloopToken.governanceRewardsContract()).to.equal(governanceRewards.address);
      expect(await governanceRewards.dloopToken()).to.equal(dloopToken.address);
      expect(await proposalTracker.governanceRewards()).to.equal(governanceRewards.address);
      expect(await proposalTracker.oracle()).to.equal(priceOracle.address);
    });
  });
  
  describe("Proposal and Voting", function () {
    let proposalId;
    
    it("Should create a proposal", async function () {
      proposalId = ethers.utils.id("test-proposal-1");
      await proposalTracker.createProposal(proposalId, testAsset.address, true); // Invest proposal
      
      expect(await proposalTracker.proposalAssets(proposalId)).to.equal(testAsset.address);
      expect(await proposalTracker.proposalTypes(proposalId)).to.be.true; // isInvest
    });
    
    it("Should record votes and decisions", async function () {
      // Record the initial price for the proposal
      await priceOracle.recordProposalPrice(proposalId);
      
      // Alice votes yes
      await proposalTracker.recordVote(proposalId, alice.address, true);
      
      // Bob votes no
      await proposalTracker.recordVote(proposalId, bob.address, false);
      
      // Charlie votes yes
      await proposalTracker.recordVote(proposalId, charlie.address, true);
      
      // Check decision counts
      expect(await governanceRewards.userDecisionsPerEpoch(alice.address, 1)).to.equal(1);
      expect(await governanceRewards.userDecisionsPerEpoch(bob.address, 1)).to.equal(1);
      expect(await governanceRewards.userDecisionsPerEpoch(charlie.address, 1)).to.equal(1);
      expect(await governanceRewards.epochDecisionCount(1)).to.equal(3);
    });
  });
  
  describe("Price Evaluation", function () {
    let proposalId;
    
    it("Should evaluate decisions based on price changes", async function () {
      proposalId = ethers.utils.id("test-proposal-2");
      
      // Create a new proposal
      await proposalTracker.createProposal(proposalId, testAsset.address, true); // Invest proposal
      await priceOracle.recordProposalPrice(proposalId);
      
      // Record votes
      const aliceDecisionId = await proposalTracker.recordVote(proposalId, alice.address, true); // Yes
      const bobDecisionId = await proposalTracker.recordVote(proposalId, bob.address, false); // No
      
      // Increase the price (invest proposal, so YES votes are correct)
      await priceOracle.updatePrice(testAsset.address, ethers.utils.parseEther("150"));
      
      // Advance time to evaluation period
      await time.increase(epochDuration);
      
      // Evaluate the proposal
      await priceOracle.evaluateProposal(proposalId);
      
      // Check if decisions were evaluated correctly
      const aliceDecision = await governanceRewards.decisions(aliceDecisionId.value || aliceDecisionId);
      const bobDecision = await governanceRewards.decisions(bobDecisionId.value || bobDecisionId);
      
      expect(aliceDecision.wasCorrect).to.be.true; // Alice voted yes (price increased)
      expect(bobDecision.wasCorrect).to.be.false; // Bob voted no (price increased)
    });
  });
  
  describe("Rewards Distribution", function () {
    it("Should distribute rewards after epoch ends", async function () {
      // Advance time to complete the epoch
      await time.increase(epochDuration);
      
      // Force update the current epoch
      await governanceRewards.recordDecision(alice.address, ethers.utils.id("dummy"), true, true);
      
      // Check claimable rewards
      const aliceRewards = await governanceRewards.getClaimableRewards(alice.address, 1);
      const bobRewards = await governanceRewards.getClaimableRewards(bob.address, 1);
      const charlieRewards = await governanceRewards.getClaimableRewards(charlie.address, 1);
      
      expect(aliceRewards).to.be.gt(0);
      expect(bobRewards).to.be.gt(0);
      expect(charlieRewards).to.be.gt(0);
      
      // Claim rewards
      await governanceRewards.connect(alice).claimRewards(1);
      await governanceRewards.connect(bob).claimRewards(1);
      await governanceRewards.connect(charlie).claimRewards(1);
      
      // Verify token balances
      expect(await dloopToken.balanceOf(alice.address)).to.be.gt(0);
      expect(await dloopToken.balanceOf(bob.address)).to.be.gt(0);
      expect(await dloopToken.balanceOf(charlie.address)).to.be.gt(0);
      
      // Verify rewards were tracked correctly
      expect(await governanceRewards.epochClaimed(1, alice.address)).to.be.true;
      expect(await governanceRewards.epochClaimed(1, bob.address)).to.be.true;
      expect(await governanceRewards.epochClaimed(1, charlie.address)).to.be.true;
      
      const totalClaimed = await governanceRewards.epochRewardsClaimed(1);
      expect(totalClaimed).to.be.gt(0);
    });
  });
});