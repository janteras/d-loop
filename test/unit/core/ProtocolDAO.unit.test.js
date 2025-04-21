/**
 * @title ProtocolDAO Tests
 * @dev Comprehensive test suite for the ProtocolDAO contract
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Load ethers v6 compatibility layer
require('../../../../shims/ethers-v6-adapter');

/**
 * Helper function to compute role hashes consistent with solidity keccak256
 */
function computeRoleHash(role) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
}

describe("ProtocolDAO", function () {
  // Test variables
  let protocolDAO;
  let mockToken;
  let mockTarget;
  let owner;
  let admin;
  let treasury;
  let user1;
  let user2;
  let user3;
  
  // Time constants
  const SECONDS_PER_DAY = 86400;
  const DEFAULT_VOTING_PERIOD = 7 * SECONDS_PER_DAY; // 7 days
  const DEFAULT_EXECUTION_DELAY = 2 * SECONDS_PER_DAY; // 2 days
  const DEFAULT_QUORUM = 51; // 51%
  
  // Setup helper function to advance time
  const advanceTime = async (seconds) => {
    await time.increase(seconds);
  };
  
  // Helper to create a basic proposal
  const createBasicProposal = async (from) => {
    const description = "Test Proposal";
    const targets = [mockTarget.address];
    const values = [0];
    const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
    
    const tx = await protocolDAO.connect(from).createProposal(
      description,
      targets,
      values,
      calldatas
    );
    
    const receipt = await tx.wait();
    const event = receipt.events.find(e => e.event === "ProposalCreated");
    const proposalId = event.args.proposalId;
    
    return { proposalId, description, targets, values, calldatas };
  };
  
  // Helper to get a proposal's details
  const getProposal = async (proposalId) => {
    return await protocolDAO.proposals(proposalId);
  };
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, treasury, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock token for testing whitelisting
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.deployed();
    
    // Deploy mock target for testing proposal execution
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    await mockTarget.deployed();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      treasury.address,
      DEFAULT_VOTING_PERIOD,
      DEFAULT_EXECUTION_DELAY,
      DEFAULT_QUORUM
    );
    await protocolDAO.deployed();
    
    console.log(`Owner address: ${owner.address}`);
    console.log(`Admin address: ${admin.address}`);
    console.log(`Treasury address: ${treasury.address}`);
  });
  
  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await protocolDAO.admin()).to.equal(admin.address);
      expect(await protocolDAO.treasury()).to.equal(treasury.address);
      expect(await protocolDAO.votingPeriod()).to.equal(DEFAULT_VOTING_PERIOD);
      expect(await protocolDAO.executionDelay()).to.equal(DEFAULT_EXECUTION_DELAY);
      expect(await protocolDAO.quorum()).to.equal(DEFAULT_QUORUM);
      expect(await protocolDAO.owner()).to.equal(owner.address);
      expect(await protocolDAO.getProposalCount()).to.equal(0);
    });
    
    it("Should revert if admin address is zero", async function () {
      const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
      await expect(
        ProtocolDAO.deploy(
          ethers.constants.AddressZero,
          treasury.address,
          DEFAULT_VOTING_PERIOD,
          DEFAULT_EXECUTION_DELAY,
          DEFAULT_QUORUM
        )
      ).to.be.revertedWithCustomError(ProtocolDAO, "ZeroAddress");
    });
    
    it("Should revert if treasury address is zero", async function () {
      const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
      await expect(
        ProtocolDAO.deploy(
          admin.address,
          ethers.constants.AddressZero,
          DEFAULT_VOTING_PERIOD,
          DEFAULT_EXECUTION_DELAY,
          DEFAULT_QUORUM
        )
      ).to.be.revertedWithCustomError(ProtocolDAO, "ZeroAddress");
    });
    
    it("Should revert if quorum is 0", async function () {
      const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
      await expect(
        ProtocolDAO.deploy(
          admin.address,
          treasury.address,
          DEFAULT_VOTING_PERIOD,
          DEFAULT_EXECUTION_DELAY,
          0
        )
      ).to.be.revertedWithCustomError(ProtocolDAO, "InvalidAmount");
    });
    
    it("Should revert if quorum is greater than 100", async function () {
      const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
      await expect(
        ProtocolDAO.deploy(
          admin.address,
          treasury.address,
          DEFAULT_VOTING_PERIOD,
          DEFAULT_EXECUTION_DELAY,
          101
        )
      ).to.be.revertedWithCustomError(ProtocolDAO, "InvalidAmount");
    });
  });
  
  describe("Role Management", function () {
    it("Should allow owner to transfer ownership", async function () {
      await protocolDAO.connect(owner).transferOwnership(user1.address);
      expect(await protocolDAO.owner()).to.equal(user1.address);
    });
    
    it("Should revert if non-owner tries to transfer ownership", async function () {
      await expect(
        protocolDAO.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should revert if transferring ownership to zero address", async function () {
      await expect(
        protocolDAO.connect(owner).transferOwnership(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
    
    it("Should allow owner to update admin", async function () {
      await protocolDAO.connect(owner).updateAdmin(user1.address);
      expect(await protocolDAO.admin()).to.equal(user1.address);
    });
    
    it("Should revert if non-owner tries to update admin", async function () {
      await expect(
        protocolDAO.connect(user1).updateAdmin(user2.address)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should allow owner to update treasury", async function () {
      await protocolDAO.connect(owner).updateTreasury(user1.address);
      expect(await protocolDAO.treasury()).to.equal(user1.address);
    });
    
    it("Should revert if non-owner tries to update treasury", async function () {
      await expect(
        protocolDAO.connect(user1).updateTreasury(user2.address)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
  });
  
  describe("Token Whitelisting", function () {
    it("Should allow admin to whitelist a token", async function () {
      await protocolDAO.connect(admin).whitelistToken(mockToken.address, true);
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.true;
      expect(await protocolDAO.isTokenWhitelisted(mockToken.address)).to.be.true;
    });
    
    it("Should allow admin to remove a token from whitelist", async function () {
      // First whitelist the token
      await protocolDAO.connect(admin).whitelistToken(mockToken.address, true);
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.true;
      
      // Then remove it from whitelist
      await protocolDAO.connect(admin).whitelistToken(mockToken.address, false);
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.false;
      expect(await protocolDAO.isTokenWhitelisted(mockToken.address)).to.be.false;
    });
    
    it("Should emit TokenWhitelisted event when whitelisting a token", async function () {
      await expect(protocolDAO.connect(admin).whitelistToken(mockToken.address, true))
        .to.emit(protocolDAO, "TokenWhitelisted")
        .withArgs(mockToken.address, true);
    });
    
    it("Should revert if non-admin tries to whitelist a token", async function () {
      await expect(
        protocolDAO.connect(user1).whitelistToken(mockToken.address, true)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotAdmin");
    });
    
    it("Should revert if whitelisting zero address", async function () {
      await expect(
        protocolDAO.connect(admin).whitelistToken(ethers.constants.AddressZero, true)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
    
    it("Should allow owner to whitelist a token (owner can perform admin functions)", async function () {
      await protocolDAO.connect(owner).whitelistToken(mockToken.address, true);
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.true;
    });
  });
  
  describe("Parameter Updates", function () {
    it("Should allow admin to update voting period", async function () {
      const newVotingPeriod = 14 * SECONDS_PER_DAY; // 14 days
      
      await expect(protocolDAO.connect(admin).updateVotingPeriod(newVotingPeriod))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("VotingPeriod", DEFAULT_VOTING_PERIOD, newVotingPeriod);
        
      expect(await protocolDAO.votingPeriod()).to.equal(newVotingPeriod);
    });
    
    it("Should revert if voting period is 0", async function () {
      await expect(
        protocolDAO.connect(admin).updateVotingPeriod(0)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidPeriod");
    });
    
    it("Should allow admin to update execution delay", async function () {
      const newExecutionDelay = 3 * SECONDS_PER_DAY; // 3 days
      
      await expect(protocolDAO.connect(admin).updateExecutionDelay(newExecutionDelay))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("ExecutionDelay", DEFAULT_EXECUTION_DELAY, newExecutionDelay);
        
      expect(await protocolDAO.executionDelay()).to.equal(newExecutionDelay);
    });
    
    it("Should allow admin to update quorum", async function () {
      const newQuorum = 75; // 75%
      
      await expect(protocolDAO.connect(admin).updateQuorum(newQuorum))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("Quorum", DEFAULT_QUORUM, newQuorum);
        
      expect(await protocolDAO.quorum()).to.equal(newQuorum);
    });
    
    it("Should revert if quorum is 0", async function () {
      await expect(
        protocolDAO.connect(admin).updateQuorum(0)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
    
    it("Should revert if quorum is greater than 100", async function () {
      await expect(
        protocolDAO.connect(admin).updateQuorum(101)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
    
    it("Should revert if non-admin tries to update parameters", async function () {
      await expect(
        protocolDAO.connect(user1).updateVotingPeriod(10 * SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotAdmin");
      
      await expect(
        protocolDAO.connect(user1).updateExecutionDelay(3 * SECONDS_PER_DAY)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotAdmin");
      
      await expect(
        protocolDAO.connect(user1).updateQuorum(60)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotAdmin");
    });
  });
  
  describe("Proposal Creation", function () {
    it("Should allow creating a valid proposal", async function () {
      const { proposalId, description, targets, values, calldatas } = await createBasicProposal(user1);
      
      const proposal = await getProposal(proposalId);
      expect(proposal.id).to.equal(proposalId);
      expect(proposal.description).to.equal(description);
      expect(proposal.proposer).to.equal(user1.address);
      expect(proposal.executed).to.be.false;
      expect(proposal.canceled).to.be.false;
      
      // Check arrays
      expect(proposal.targets).to.deep.equal(targets);
      expect(proposal.values).to.deep.equal(values);
      // Cannot directly compare bytes arrays in deep equal
      
      // Check voting period calculation
      expect(proposal.votingEnds.sub(proposal.createdAt)).to.equal(DEFAULT_VOTING_PERIOD);
      
      // Check proposal counter
      expect(await protocolDAO.getProposalCount()).to.equal(1);
    });
    
    it("Should emit ProposalCreated event", async function () {
      const description = "Test Proposal";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      await expect(
        protocolDAO.connect(user1).createProposal(description, targets, values, calldatas)
      ).to.emit(protocolDAO, "ProposalCreated");
    });
    
    it("Should revert if targets array is empty", async function () {
      const description = "Invalid Proposal";
      const targets = [];
      const values = [];
      const calldatas = [];
      
      await expect(
        protocolDAO.connect(user1).createProposal(description, targets, values, calldatas)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
    
    it("Should revert if arrays have different lengths", async function () {
      const description = "Invalid Proposal";
      const targets = [mockTarget.address, user2.address];
      const values = [0]; // One less than targets
      const calldatas = [
        mockTarget.interface.encodeFunctionData("setValue", [42]),
        mockTarget.interface.encodeFunctionData("setValue", [100])
      ];
      
      await expect(
        protocolDAO.connect(user1).createProposal(description, targets, values, calldatas)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
    
    it("Should create multiple proposals with incrementing IDs", async function () {
      // Create first proposal
      await createBasicProposal(user1);
      expect(await protocolDAO.getProposalCount()).to.equal(1);
      
      // Create second proposal
      await createBasicProposal(user2);
      expect(await protocolDAO.getProposalCount()).to.equal(2);
      
      // Check that IDs are different
      const proposal1 = await getProposal(1);
      const proposal2 = await getProposal(2);
      
      expect(proposal1.id).to.equal(1);
      expect(proposal2.id).to.equal(2);
    });
  });
  
  describe("Voting", function () {
    let proposalId;
    
    beforeEach(async function () {
      // Create a proposal for voting tests
      const result = await createBasicProposal(user1);
      proposalId = result.proposalId;
    });
    
    it("Should allow voting on a proposal", async function () {
      // Vote for the proposal
      await expect(protocolDAO.connect(user2).castVote(proposalId, true))
        .to.emit(protocolDAO, "VoteCast")
        .withArgs(proposalId, user2.address, true);
      
      // Check vote was recorded
      const proposal = await getProposal(proposalId);
      expect(proposal.forVotes).to.equal(1);
      expect(proposal.againstVotes).to.equal(0);
      
      // Check if user has voted
      expect(await protocolDAO.hasVoted(proposalId, user2.address)).to.be.true;
    });
    
    it("Should allow voting against a proposal", async function () {
      // Vote against the proposal
      await expect(protocolDAO.connect(user2).castVote(proposalId, false))
        .to.emit(protocolDAO, "VoteCast")
        .withArgs(proposalId, user2.address, false);
      
      // Check vote was recorded
      const proposal = await getProposal(proposalId);
      expect(proposal.forVotes).to.equal(0);
      expect(proposal.againstVotes).to.equal(1);
      
      // Check if user has voted
      expect(await protocolDAO.hasVoted(proposalId, user2.address)).to.be.true;
    });
    
    it("Should prevent voting twice", async function () {
      // Vote once
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Try to vote again
      await expect(
        protocolDAO.connect(user2).castVote(proposalId, false)
      ).to.be.revertedWithCustomError(protocolDAO, "AlreadyVoted");
    });
    
    it("Should revert when voting on a non-existent proposal", async function () {
      const nonExistentProposalId = 999;
      
      await expect(
        protocolDAO.connect(user2).castVote(nonExistentProposalId, true)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotFound");
    });
    
    it("Should revert when voting on an executed proposal", async function () {
      // Create enough votes to pass
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Advance time past voting period and execution delay
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute the proposal
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Try to vote after execution
      await expect(
        protocolDAO.connect(user3).castVote(proposalId, true)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalAlreadyExecuted");
    });
    
    it("Should revert when voting on a canceled proposal", async function () {
      // Cancel the proposal
      await protocolDAO.connect(admin).cancelProposal(proposalId);
      
      // Try to vote on canceled proposal
      await expect(
        protocolDAO.connect(user2).castVote(proposalId, true)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
    
    it("Should revert when voting after voting period ends", async function () {
      // Advance time past voting period
      await advanceTime(DEFAULT_VOTING_PERIOD + 1);
      
      // Try to vote after voting period
      await expect(
        protocolDAO.connect(user2).castVote(proposalId, true)
      ).to.be.revertedWithCustomError(protocolDAO, "VotingEnded");
    });
    
    it("Should accumulate votes correctly", async function () {
      // Multiple users vote
      await protocolDAO.connect(user1).castVote(proposalId, true); // For
      await protocolDAO.connect(user2).castVote(proposalId, true); // For
      await protocolDAO.connect(user3).castVote(proposalId, false); // Against
      
      // Check vote counts
      const proposal = await getProposal(proposalId);
      expect(proposal.forVotes).to.equal(2);
      expect(proposal.againstVotes).to.equal(1);
    });
  });
  
  describe("Proposal Execution", function () {
    let proposalId;
    
    beforeEach(async function () {
      // Create a proposal that will update a value in the mock target
      const description = "Update mock target value";
      const targets = [mockTarget.address];
      const values = [0];
      const calldatas = [mockTarget.interface.encodeFunctionData("setValue", [42])];
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      proposalId = event.args.proposalId;
      
      // Cast some votes (need to pass quorum)
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Fast forward past voting period and execution delay
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
    });
    
    it("Should execute a successful proposal", async function () {
      // Initial value should be 0
      expect(await mockTarget.value()).to.equal(0);
      
      // Execute the proposal
      await expect(protocolDAO.connect(user3).executeProposal(proposalId))
        .to.emit(protocolDAO, "ProposalExecuted")
        .withArgs(proposalId);
      
      // Check that the proposal was executed
      const proposal = await getProposal(proposalId);
      expect(proposal.executed).to.be.true;
      
      // Check that the target contract was updated
      expect(await mockTarget.value()).to.equal(42);
    });
    
    it("Should revert if executing a non-existent proposal", async function () {
      const nonExistentProposalId = 999;
      
      await expect(
        protocolDAO.connect(user3).executeProposal(nonExistentProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotFound");
    });
    
    it("Should revert if executing an already executed proposal", async function () {
      // Execute first time
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Try to execute again
      await expect(
        protocolDAO.connect(user3).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalAlreadyExecuted");
    });
    
    it("Should revert if executing a canceled proposal", async function () {
      // Create a new proposal
      const { proposalId: newProposalId } = await createBasicProposal(user1);
      
      // Cancel it
      await protocolDAO.connect(admin).cancelProposal(newProposalId);
      
      // Try to execute
      await expect(
        protocolDAO.connect(user3).executeProposal(newProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
    
    it("Should revert if executing before voting period ends", async function () {
      // Create a new proposal
      const { proposalId: newProposalId } = await createBasicProposal(user1);
      
      // Try to execute immediately (before voting period ends)
      await expect(
        protocolDAO.connect(user3).executeProposal(newProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "VotingNotStarted");
    });
    
    it("Should revert if executing before execution delay", async function () {
      // Create a new proposal
      const { proposalId: newProposalId } = await createBasicProposal(user1);
      
      // Cast some votes
      await protocolDAO.connect(user1).castVote(newProposalId, true);
      await protocolDAO.connect(user2).castVote(newProposalId, true);
      
      // Fast forward past voting period but before execution delay
      await advanceTime(DEFAULT_VOTING_PERIOD + 1);
      
      // Try to execute
      await expect(
        protocolDAO.connect(user3).executeProposal(newProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
    
    it("Should revert if proposal doesn't meet quorum", async function () {
      // Create a new proposal
      const { proposalId: newProposalId } = await createBasicProposal(user1);
      
      // Only cast one vote (not enough for quorum)
      await protocolDAO.connect(user1).castVote(newProposalId, true);
      
      // Fast forward past voting period and execution delay
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Try to execute
      await expect(
        protocolDAO.connect(user3).executeProposal(newProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
    
    it("Should revert if proposal has no votes", async function () {
      // Create a new proposal
      const { proposalId: newProposalId } = await createBasicProposal(user1);
      
      // Fast forward past voting period and execution delay without any votes
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Try to execute
      await expect(
        protocolDAO.connect(user3).executeProposal(newProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
    
    it("Should execute a proposal with multiple targets", async function () {
      // Deploy a second mock target
      const MockTarget = await ethers.getContractFactory("MockTarget");
      const mockTarget2 = await MockTarget.deploy();
      await mockTarget2.deployed();
      
      // Create a proposal with multiple targets
      const description = "Update multiple targets";
      const targets = [mockTarget.address, mockTarget2.address];
      const values = [0, 0];
      const calldatas = [
        mockTarget.interface.encodeFunctionData("setValue", [42]),
        mockTarget2.interface.encodeFunctionData("setValue", [100])
      ];
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      const multiTargetProposalId = event.args.proposalId;
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(multiTargetProposalId, true);
      await protocolDAO.connect(user2).castVote(multiTargetProposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute
      await protocolDAO.connect(user3).executeProposal(multiTargetProposalId);
      
      // Check both targets were updated
      expect(await mockTarget.value()).to.equal(42);
      expect(await mockTarget2.value()).to.equal(100);
    });
    
    it("Should execute a proposal that sends ETH", async function () {
      // Fund the ProtocolDAO with ETH
      await owner.sendTransaction({
        to: protocolDAO.address,
        value: ethers.utils.parseEther("1.0")
      });
      
      // Create a proposal to send ETH
      const description = "Send ETH";
      const targets = [user3.address];
      const values = [ethers.utils.parseEther("0.5")];
      const calldatas = ["0x"]; // Empty calldata for simple ETH transfer
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      const ethProposalId = event.args.proposalId;
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(ethProposalId, true);
      await protocolDAO.connect(user2).castVote(ethProposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Check initial balance
      const initialBalance = await ethers.provider.getBalance(user3.address);
      
      // Execute
      await protocolDAO.connect(user1).executeProposal(ethProposalId);
      
      // Check final balance
      const finalBalance = await ethers.provider.getBalance(user3.address);
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther("0.5"));
    });
  });
  
  describe("Proposal Cancellation", function () {
    let proposalId;
    
    beforeEach(async function () {
      // Create a proposal
      const result = await createBasicProposal(user1);
      proposalId = result.proposalId;
    });
    
    it("Should allow admin to cancel a proposal", async function () {
      await expect(protocolDAO.connect(admin).cancelProposal(proposalId))
        .to.emit(protocolDAO, "ProposalCanceled")
        .withArgs(proposalId);
      
      const proposal = await getProposal(proposalId);
      expect(proposal.canceled).to.be.true;
    });
    
    it("Should allow owner to cancel a proposal", async function () {
      await expect(protocolDAO.connect(owner).cancelProposal(proposalId))
        .to.emit(protocolDAO, "ProposalCanceled")
        .withArgs(proposalId);
      
      const proposal = await getProposal(proposalId);
      expect(proposal.canceled).to.be.true;
    });
    
    it("Should revert if non-admin tries to cancel a proposal", async function () {
      await expect(
        protocolDAO.connect(user2).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotAdmin");
    });
    
    it("Should revert if canceling a non-existent proposal", async function () {
      const nonExistentProposalId = 999;
      
      await expect(
        protocolDAO.connect(admin).cancelProposal(nonExistentProposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotFound");
    });
    
    it("Should revert if canceling an already executed proposal", async function () {
      // Cast votes
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Try to cancel
      await expect(
        protocolDAO.connect(admin).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalAlreadyExecuted");
    });
    
    it("Should revert if canceling an already canceled proposal", async function () {
      // Cancel once
      await protocolDAO.connect(admin).cancelProposal(proposalId);
      
      // Try to cancel again
      await expect(
        protocolDAO.connect(admin).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(protocolDAO, "ProposalNotApproved");
    });
  });
  
  describe("Integration Tests", function () {
    it("Should execute a proposal that updates DAO parameters", async function () {
      // Create a proposal to update voting period
      const newVotingPeriod = 10 * SECONDS_PER_DAY; // 10 days
      
      const description = "Update voting period";
      const targets = [protocolDAO.address];
      const values = [0];
      const calldatas = [
        protocolDAO.interface.encodeFunctionData("updateVotingPeriod", [newVotingPeriod])
      ];
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      const proposalId = event.args.proposalId;
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Check that voting period was updated
      expect(await protocolDAO.votingPeriod()).to.equal(newVotingPeriod);
    });
    
    it("Should execute a proposal that whitelists a token", async function () {
      // Initially token should not be whitelisted
      expect(await protocolDAO.isTokenWhitelisted(mockToken.address)).to.be.false;
      
      // Create a proposal to whitelist the token
      const description = "Whitelist mock token";
      const targets = [protocolDAO.address];
      const values = [0];
      const calldatas = [
        protocolDAO.interface.encodeFunctionData("whitelistToken", [mockToken.address, true])
      ];
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      const proposalId = event.args.proposalId;
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Check that token is now whitelisted
      expect(await protocolDAO.isTokenWhitelisted(mockToken.address)).to.be.true;
    });
    
    it("Should execute a proposal that updates multiple parameters", async function () {
      // Create a proposal to update multiple parameters
      const newVotingPeriod = 10 * SECONDS_PER_DAY; // 10 days
      const newExecutionDelay = 3 * SECONDS_PER_DAY; // 3 days
      const newQuorum = 60; // 60%
      
      const description = "Update multiple parameters";
      const targets = [
        protocolDAO.address,
        protocolDAO.address,
        protocolDAO.address
      ];
      const values = [0, 0, 0];
      const calldatas = [
        protocolDAO.interface.encodeFunctionData("updateVotingPeriod", [newVotingPeriod]),
        protocolDAO.interface.encodeFunctionData("updateExecutionDelay", [newExecutionDelay]),
        protocolDAO.interface.encodeFunctionData("updateQuorum", [newQuorum])
      ];
      
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldatas
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      const proposalId = event.args.proposalId;
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(proposalId, true);
      await protocolDAO.connect(user2).castVote(proposalId, true);
      
      // Fast forward
      await advanceTime(DEFAULT_VOTING_PERIOD + DEFAULT_EXECUTION_DELAY + 1);
      
      // Execute
      await protocolDAO.connect(user3).executeProposal(proposalId);
      
      // Check that all parameters were updated
      expect(await protocolDAO.votingPeriod()).to.equal(newVotingPeriod);
      expect(await protocolDAO.executionDelay()).to.equal(newExecutionDelay);
      expect(await protocolDAO.quorum()).to.equal(newQuorum);
    });
  });
  
  describe("Receive ETH", function () {
    it("Should accept ETH transfers", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      // Send ETH to the contract
      await expect(
        owner.sendTransaction({
          to: protocolDAO.address,
          value: amount
        })
      ).to.not.be.reverted;
      
      // Check contract balance
      expect(await ethers.provider.getBalance(protocolDAO.address)).to.equal(amount);
    });
  });
});

/**
 * Mock contract for proposal execution testing
 */
const MockTokenArtifact = {
  bytecode: "0x608060405234801561001057600080fd5b5060405161052f38038061052f83398101604081905261002f916100f7565b600061003b82826102c1565b50600161004883826102c1565b505050610380565b634e487b7160e01b600052604160045260246000fd5b600082601f83011261007857600080fd5b81516001600160401b038082111561009257610092610051565b604051601f8301601f19908116603f011681019082821181831017156100ba576100ba610051565b816040528381526020925086838588010111156100d657600080fd5b600091505b8382101561006857600083830152825191825260208201910161006d565b6000806040838503121561010a57600080fd5b82516001600160401b038082111561012157600080fd5b61012d8683870161006d565b935060208501519150808211156101025760008481fd5b5090930192915050565b600181811c9082168061014d57607f821691505b60208210810361016d57634e487b7160e01b600052602260045260246000fd5b50919050565b601f8211156102c157600081815260208120601f850160051c8101602086101561019a5750805b601f850160051c820191505b818110156101d25782516001600160a01b0316815291825260209384019101610198565b6102b9565b6102cf565b60405160200180519050610222604051919060206102e76101ef601f8b5260051b0186016102c1565b0190565b6001600160a01b0386541601906001600160401b03811183821017610225575b6000505b600019620102108283010152604052613ffdfd5b61022f61051b60201b63b0a6dbba1760201c5b60608201815260006001800154602080840191909152848252610230600184018086601f8d6001815b0380858288f05b8381101561028757600101835b88603f808352871b018287015183019150156102cf5761029e565b50858201356001600160a01b0316602095909501526001600160e01b03191695909501946000190191846000541461029e5761025e565b905062010210601f198101905060c001516001600160a01b0316908154600052602060048201600092808401600090810183823760008382015b82810154662386f26fc10000600160a01b015416430101611d4c01536102c1565b60008155600101600020825b5050505061016d565b5b6102c85282610172565b905290565b600182141561031e576020808201928315610300578482015b83811061030057602001516001600160a01b03166102c8565b815201925082156102c85760001992610319565b0190565b61032e6020850160208801610172565b80156001600160401b03811184821016602385111761033f575b505050565b61035060405190815135906001600160a01b03168185015291840191846020868501106102c8576102c1565b6020860111156102c15760406000198301010152826001600160401b038111828110176103475761025e565b61c7736103896102c1565b610141600080838393833981019184526001600160a01b0391909116815260016020820152610141526101416000f3fe608060405234801561001057600080fd5b50600436106100885760003560e01c806395d89b411161005b57806395d89b41146100d3578063a9059cbb146100db578063d883209c14610093578063dd62ed3e146100ee57600080fd5b806306fdde031461008d578063095ea7b3146100a557806323b872dd146100b8578063313ce567146100cb575b600080fd5b610093610101565b005b61009b61010f565b6040516100a2919061028d565b60405180910390f35b6100936100b3366004610309565b61017e565b6100936100c6366004610333565b610184565b61009b6101f2565b61009b61020d565b6100936100e9366004610309565b61021a565b6100936100fc366004610372565b610273565b6040518060c001fd5b6100935760408051808201909152600681526517d4d7d4915160d21b602082015290565b5050565b60408051808201909152600d81526c40756c74697369676e65722d3609c1b6020808301919091528251739c8efdb986ea6974f7fbf6a9d041ccbb580b8b28845473ffffffffffffffffffffffffffffffffffffffff1992909216178155602080850151928401929092526040840191909152606083015260808201526001600081815260805260408120905561020a60a052565b565b6040518060c001fd5b60408051808201909152600481526322a32b9960e91b6020808301919091528251906000916305313eea60e11b815260206004820152600f60248201527f57524f4e47204f5554434f4d45210000000000000000000000000000000000006044820152636a627dfa60e01b6064820152608401813733143314331480156102695761020a61020a61020a61020a91905b501461026957600080fd5b5050565b5050565b600081815260208190526040812054828114610269575050600191825282825b5050565b600060208083528351808285015260005b818110156102ba578581018301518582016040015282016102af565b506000604082860101526040601f19601f8301168501019250505092915050565b803573ffffffffffffffffffffffffffffffffffffffff8116811461030457600080fd5b919050565b6000806040838503121561031c57600080fd5b610325836102e0565b946020939093013593505050565b60008060006060848603121561034857600080fd5b610351846102e0565b925061035f602085016102e0565b9150604084013590509250925092565b6000806040838503121561038557600080fd5b61038e836102e0565b915061039c602084016102e0565b9050925092905056fea2646970667358221220bd5d1abb1af0f21ce7a0e5beeb27bb9b4a3ef2b9f8dda3be0de84ad7de6d8c1164736f6c63430008180033";
  abi: [
    "constructor(string memory name, string memory symbol)",
    "function name() external view returns (string memory)",
    "function symbol() external view returns (string memory)",
    "function transfer(address to, uint256 amount) external",
    "function transferFrom(address from, address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ]
};

/**
 * Mock contract for proposal execution testing
 */
const MockTargetArtifact = {
  bytecode: "0x608060405234801561001057600080fd5b5060e68061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f24514603757806355241077146051575b600080fd5b603f60005481565b60405190815260200160405180910390f35b6061605c366004607e565b600055565b005b600060208284031215607257600080fd5b5035919050565b600060208284031215608f57600080fd5b503591905056fea2646970667358221220a7fb6605fa6358a0d6679e9c96a377aea7df2a3ebb4e59e4151316f1a1bfc00564736f6c63430008180033";
  abi: [
    "function setValue(uint256 newValue) public",
    "function value() public view returns (uint256)"
  ]
};

// Deploy mock contracts before tests
before(async function () {
  // Ensure MockToken is deployed
  if (!ethers.getContractFactory("MockToken")._bytecode) {
    MockToken = await ethers.getContractFactory(MockTokenArtifact.abi, MockTokenArtifact.bytecode);
    ethers.getContractFactory = function (...args) {
      if (args[0] === "MockToken") {
        return MockToken;
      }
      return ethers.ethers.getContractFactory.apply(this, args);
    };
  }
  
  // Ensure MockTarget is deployed
  if (!ethers.getContractFactory("MockTarget")._bytecode) {
    MockTarget = await ethers.getContractFactory(MockTargetArtifact.abi, MockTargetArtifact.bytecode);
    ethers.getContractFactory = function (...args) {
      if (args[0] === "MockTarget") {
        return MockTarget;
      }
      return ethers.ethers.getContractFactory.apply(this, args);
    };
  }
});