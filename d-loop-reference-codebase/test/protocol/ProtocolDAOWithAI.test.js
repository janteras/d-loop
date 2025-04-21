const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("ProtocolDAOWithAI", function () {
  let ProtocolDAOWithAI, AINodeIdentifier, UpgradeExecutor, ParameterAdjuster, EmergencyPauser;
  let protocolDAO, aiNodeIdentifier, upgradeExecutor, parameterAdjuster, emergencyPauser;
  let owner, aiNode, humanNode, other;
  
  // Constants for testing
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const EMERGENCY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMERGENCY_ROLE"));
  
  beforeEach(async function () {
    [owner, aiNode, humanNode, other] = await ethers.getSigners();
    
    // Deploy a mock AINodeIdentifier
    const MockAINodeIdentifier = await ethers.getContractFactory("MockAINodeIdentifier");
    aiNodeIdentifier = await MockAINodeIdentifier.deploy();
    await aiNodeIdentifier.deployed();
    
    // Configure AI node
    await aiNodeIdentifier.setIsAINode(aiNode.address, true);
    
    // Deploy ProtocolDAO
    ProtocolDAOWithAI = await ethers.getContractFactory("ProtocolDAOWithAI");
    protocolDAO = await upgrades.deployProxy(ProtocolDAOWithAI, [aiNodeIdentifier.address]);
    await protocolDAO.deployed();
    
    // Deploy executors
    UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(
      protocolDAO.address,
      protocolDAO.address,
      "0x",
      "Test upgrade executor"
    );
    await upgradeExecutor.deployed();
    
    ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(
      protocolDAO.address,
      ethers.utils.defaultAbiCoder.encode(
        ["uint64", "uint64"], 
        [1 * 24 * 60 * 60, 7 * 24 * 60 * 60]
      ),
      "Voting Periods",
      "AI: 1 day, Human: 7 days",
      "Update voting periods to standard values"
    );
    await parameterAdjuster.deployed();
    
    EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(
      protocolDAO.address,
      true,
      "Test emergency pause"
    );
    await emergencyPauser.deployed();
    
    // Configure ProtocolDAO
    await protocolDAO.updateExecutor(upgradeExecutor.address, true);
    await protocolDAO.updateExecutor(parameterAdjuster.address, true);
    await protocolDAO.updateExecutor(emergencyPauser.address, true);
    
    // Set up voting power
    await protocolDAO.updateVotingPower(owner.address, ethers.utils.parseEther("100"));
    await protocolDAO.updateVotingPower(aiNode.address, ethers.utils.parseEther("100"));
    await protocolDAO.updateVotingPower(humanNode.address, ethers.utils.parseEther("100"));
  });
  
  describe("Initialization", function () {
    it("should initialize with correct values", async function () {
      expect(await protocolDAO.aiNodeIdentifier()).to.equal(aiNodeIdentifier.address);
      expect(await protocolDAO.aiVotingPeriod()).to.equal(1 * 24 * 60 * 60); // 1 day
      expect(await protocolDAO.humanVotingPeriod()).to.equal(7 * 24 * 60 * 60); // 7 days
      expect(await protocolDAO.timelockPeriod()).to.equal(24 * 60 * 60); // 24 hours
      expect(await protocolDAO.aiQuorumPercentage()).to.equal(40 * 10**16); // 40%
      expect(await protocolDAO.humanQuorumPercentage()).to.equal(30 * 10**16); // 30%
    });
    
    it("should assign roles correctly", async function () {
      expect(await protocolDAO.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await protocolDAO.hasRole(GOVERNANCE_ROLE, owner.address)).to.be.true;
      expect(await protocolDAO.hasRole(EMERGENCY_ROLE, owner.address)).to.be.true;
    });
    
    it("should set up executors correctly", async function () {
      expect(await protocolDAO.whitelistedExecutors(upgradeExecutor.address)).to.be.true;
      expect(await protocolDAO.whitelistedExecutors(parameterAdjuster.address)).to.be.true;
      expect(await protocolDAO.whitelistedExecutors(emergencyPauser.address)).to.be.true;
      expect(await protocolDAO.whitelistedExecutors(other.address)).to.be.false;
    });
  });
  
  describe("Proposal Creation", function () {
    it("should create proposals with different expiration times based on submitter", async function () {
      // AI node proposal
      const aiProposalTx = await protocolDAO.connect(aiNode).submitProposal(
        upgradeExecutor.address,
        "AI node proposal"
      );
      const aiReceipt = await aiProposalTx.wait();
      const aiEvent = aiReceipt.events.find(e => e.event === "ProposalCreated");
      const aiProposalId = aiEvent.args.proposalId;
      
      // Human proposal
      const humanProposalTx = await protocolDAO.connect(humanNode).submitProposal(
        upgradeExecutor.address,
        "Human proposal"
      );
      const humanReceipt = await humanProposalTx.wait();
      const humanEvent = humanReceipt.events.find(e => e.event === "ProposalCreated");
      const humanProposalId = humanEvent.args.proposalId;
      
      // Get proposal details
      const aiProposal = await protocolDAO.getProposalDetails(aiProposalId);
      const humanProposal = await protocolDAO.getProposalDetails(humanProposalId);
      
      // AI proposal should expire in 1 day, human proposal in 7 days
      const now = Math.floor(Date.now() / 1000);
      expect(aiProposal.expirationTime).to.be.closeTo(now + 1 * 24 * 60 * 60, 60); // 1 day, allow 60s variance
      expect(humanProposal.expirationTime).to.be.closeTo(now + 7 * 24 * 60 * 60, 60); // 7 days, allow 60s variance
    });
    
    it("should reject proposals with invalid executors", async function () {
      await expect(
        protocolDAO.submitProposal(other.address, "Invalid executor")
      ).to.be.revertedWith("Invalid executor");
    });
  });
  
  describe("Voting", function () {
    let proposalId;
    
    beforeEach(async function () {
      const tx = await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Test proposal"
      );
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      proposalId = event.args.proposalId;
    });
    
    it("should allow voting on a proposal", async function () {
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      await protocolDAO.connect(humanNode).voteProposal(proposalId, false);
      
      const proposal = await protocolDAO.getProposalDetails(proposalId);
      expect(proposal.yesVotes).to.equal(ethers.utils.parseEther("200")); // 200 votes (owner + aiNode)
      expect(proposal.noVotes).to.equal(ethers.utils.parseEther("100")); // 100 votes (humanNode)
    });
    
    it("should prevent double voting", async function () {
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      
      await expect(
        protocolDAO.connect(owner).voteProposal(proposalId, true)
      ).to.be.revertedWith("Already voted");
    });
    
    it("should prevent voting after expiration", async function () {
      // Fast forward time past expiration
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(
        protocolDAO.connect(owner).voteProposal(proposalId, true)
      ).to.be.revertedWith("Voting period ended");
    });
    
    it("should prevent voting without voting power", async function () {
      await expect(
        protocolDAO.connect(other).voteProposal(proposalId, true)
      ).to.be.revertedWith("No voting power");
    });
  });
  
  describe("Proposal Execution", function () {
    let proposalId;
    
    beforeEach(async function () {
      const tx = await protocolDAO.submitProposal(
        upgradeExecutor.address,
        "Test proposal"
      );
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ProposalCreated");
      proposalId = event.args.proposalId;
      
      // Vote to pass the proposal
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
    });
    
    it("should execute a passed proposal after timelock", async function () {
      // Fast forward time past expiration and timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await protocolDAO.executeProposal(proposalId);
      
      const proposal = await protocolDAO.getProposalDetails(proposalId);
      expect(proposal.executed).to.be.true;
    });
    
    it("should prevent executing before timelock expires", async function () {
      // Fast forward time past expiration but not timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Timelock active");
    });
    
    it("should prevent executing a proposal twice", async function () {
      // Fast forward time past expiration and timelock
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await protocolDAO.executeProposal(proposalId);
      
      await expect(
        protocolDAO.executeProposal(proposalId)
      ).to.be.revertedWith("Already executed");
    });
  });
  
  describe("Configuration Updates", function () {
    it("should allow updating voting periods", async function () {
      await protocolDAO.updateVotingPeriods(12 * 60 * 60, 3 * 24 * 60 * 60); // 12 hours, 3 days
      
      expect(await protocolDAO.aiVotingPeriod()).to.equal(12 * 60 * 60);
      expect(await protocolDAO.humanVotingPeriod()).to.equal(3 * 24 * 60 * 60);
    });
    
    it("should allow updating quorum percentages", async function () {
      await protocolDAO.updateQuorumPercentages(50 * 10**16, 40 * 10**16); // 50%, 40%
      
      expect(await protocolDAO.aiQuorumPercentage()).to.equal(50 * 10**16);
      expect(await protocolDAO.humanQuorumPercentage()).to.equal(40 * 10**16);
    });
    
    it("should allow updating timelock period", async function () {
      await protocolDAO.updateTimelockPeriod(48 * 60 * 60); // 48 hours
      
      expect(await protocolDAO.timelockPeriod()).to.equal(48 * 60 * 60);
    });
    
    it("should allow updating AI node identifier", async function () {
      const NewMockAINodeIdentifier = await ethers.getContractFactory("MockAINodeIdentifier");
      const newAiNodeIdentifier = await NewMockAINodeIdentifier.deploy();
      await newAiNodeIdentifier.deployed();
      
      await protocolDAO.updateAINodeIdentifier(newAiNodeIdentifier.address);
      
      expect(await protocolDAO.aiNodeIdentifier()).to.equal(newAiNodeIdentifier.address);
    });
  });
  
  describe("Admin Functions", function () {
    it("should allow pausing and unpausing", async function () {
      await protocolDAO.pause();
      expect(await protocolDAO.paused()).to.be.true;
      
      await protocolDAO.unpause();
      expect(await protocolDAO.paused()).to.be.false;
    });
    
    it("should restrict admin functions to admin role", async function () {
      await expect(
        protocolDAO.connect(other).updateExecutor(upgradeExecutor.address, false)
      ).to.be.reverted;
      
      await expect(
        protocolDAO.connect(other).updateVotingPeriods(12 * 60 * 60, 3 * 24 * 60 * 60)
      ).to.be.reverted;
      
      await expect(
        protocolDAO.connect(other).updateQuorumPercentages(50 * 10**16, 40 * 10**16)
      ).to.be.reverted;
      
      await expect(
        protocolDAO.connect(other).updateTimelockPeriod(48 * 60 * 60)
      ).to.be.reverted;
      
      await expect(
        protocolDAO.connect(other).updateAINodeIdentifier(aiNodeIdentifier.address)
      ).to.be.reverted;
    });
  });
});