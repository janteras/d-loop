/**
 * @title Critical Functions Test for ProtocolDAO
 * @dev Comprehensive test suite for critical functions in the ProtocolDAO contract
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Load ethers v6 compatibility layer
require("../utils/ethers-v6-compat");

describe("ProtocolDAO - Critical Functions", function () {
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
    const calldatas = [mockTarget.interface.encodeFunctionData("setParameter", [42])];
    
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
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, treasury, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock token for testing whitelisting
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    
    // Deploy mock target for testing proposal execution
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      treasury.address,
      DEFAULT_VOTING_PERIOD,
      DEFAULT_EXECUTION_DELAY,
      DEFAULT_QUORUM
    );
  });
  
  describe("Critical Function: updateVotingPeriod", function () {
    it("Should allow owner to update voting period", async function () {
      const newVotingPeriod = 14 * SECONDS_PER_DAY; // 14 days
      
      await expect(protocolDAO.connect(owner).updateVotingPeriod(newVotingPeriod))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("votingPeriod", DEFAULT_VOTING_PERIOD, newVotingPeriod);
      
      expect(await protocolDAO.votingPeriod()).to.equal(newVotingPeriod);
    });
    
    it("Should revert if non-owner tries to update voting period", async function () {
      const newVotingPeriod = 14 * SECONDS_PER_DAY; // 14 days
      
      await expect(
        protocolDAO.connect(user1).updateVotingPeriod(newVotingPeriod)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
  });
  
  describe("Critical Function: updateExecutionDelay", function () {
    it("Should allow owner to update execution delay", async function () {
      const newExecutionDelay = 3 * SECONDS_PER_DAY; // 3 days
      
      await expect(protocolDAO.connect(owner).updateExecutionDelay(newExecutionDelay))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("executionDelay", DEFAULT_EXECUTION_DELAY, newExecutionDelay);
      
      expect(await protocolDAO.executionDelay()).to.equal(newExecutionDelay);
    });
    
    it("Should revert if non-owner tries to update execution delay", async function () {
      const newExecutionDelay = 3 * SECONDS_PER_DAY; // 3 days
      
      await expect(
        protocolDAO.connect(user1).updateExecutionDelay(newExecutionDelay)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
  });
  
  describe("Critical Function: updateQuorum", function () {
    it("Should allow owner to update quorum", async function () {
      const newQuorum = 60; // 60%
      
      await expect(protocolDAO.connect(owner).updateQuorum(newQuorum))
        .to.emit(protocolDAO, "ParameterUpdated")
        .withArgs("quorum", DEFAULT_QUORUM, newQuorum);
      
      expect(await protocolDAO.quorum()).to.equal(newQuorum);
    });
    
    it("Should revert if non-owner tries to update quorum", async function () {
      const newQuorum = 60; // 60%
      
      await expect(
        protocolDAO.connect(user1).updateQuorum(newQuorum)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should revert if quorum is 0", async function () {
      await expect(
        protocolDAO.connect(owner).updateQuorum(0)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
    
    it("Should revert if quorum is greater than 100", async function () {
      await expect(
        protocolDAO.connect(owner).updateQuorum(101)
      ).to.be.revertedWithCustomError(protocolDAO, "InvalidAmount");
    });
  });
  
  describe("Critical Function: updateTreasury", function () {
    it("Should allow owner to update treasury", async function () {
      const newTreasury = user3.address;
      
      await protocolDAO.connect(owner).updateTreasury(newTreasury);
      
      expect(await protocolDAO.treasury()).to.equal(newTreasury);
    });
    
    it("Should revert if non-owner tries to update treasury", async function () {
      const newTreasury = user3.address;
      
      await expect(
        protocolDAO.connect(user1).updateTreasury(newTreasury)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should revert if treasury address is zero", async function () {
      await expect(
        protocolDAO.connect(owner).updateTreasury(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
  });
  
  describe("Critical Function: updateAdmin", function () {
    it("Should allow owner to update admin", async function () {
      const newAdmin = user3.address;
      
      await protocolDAO.connect(owner).updateAdmin(newAdmin);
      
      expect(await protocolDAO.admin()).to.equal(newAdmin);
    });
    
    it("Should revert if non-owner tries to update admin", async function () {
      const newAdmin = user3.address;
      
      await expect(
        protocolDAO.connect(user1).updateAdmin(newAdmin)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should revert if admin address is zero", async function () {
      await expect(
        protocolDAO.connect(owner).updateAdmin(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
  });
  
  describe("Critical Function: transferOwnership", function () {
    it("Should allow owner to transfer ownership", async function () {
      const newOwner = user3.address;
      
      await protocolDAO.connect(owner).transferOwnership(newOwner);
      
      expect(await protocolDAO.owner()).to.equal(newOwner);
    });
    
    it("Should revert if non-owner tries to transfer ownership", async function () {
      const newOwner = user3.address;
      
      await expect(
        protocolDAO.connect(user1).transferOwnership(newOwner)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
    
    it("Should revert if new owner address is zero", async function () {
      await expect(
        protocolDAO.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(protocolDAO, "ZeroAddress");
    });
  });
  
  describe("Critical Function: whitelistToken", function () {
    it("Should allow owner to whitelist a token", async function () {
      await expect(protocolDAO.connect(owner).whitelistToken(mockToken.address, true))
        .to.emit(protocolDAO, "TokenWhitelisted")
        .withArgs(mockToken.address, true);
      
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.true;
    });
    
    it("Should allow owner to remove a token from whitelist", async function () {
      // First whitelist the token
      await protocolDAO.connect(owner).whitelistToken(mockToken.address, true);
      
      // Then remove it
      await expect(protocolDAO.connect(owner).whitelistToken(mockToken.address, false))
        .to.emit(protocolDAO, "TokenWhitelisted")
        .withArgs(mockToken.address, false);
      
      expect(await protocolDAO.whitelistedTokens(mockToken.address)).to.be.false;
    });
    
    it("Should revert if non-owner tries to whitelist a token", async function () {
      await expect(
        protocolDAO.connect(user1).whitelistToken(mockToken.address, true)
      ).to.be.revertedWithCustomError(protocolDAO, "CallerNotOwner");
    });
  });
});
