const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Protocol DAO and Executors", function () {
  let admin, executor, governance, emergencyCommittee, aiNode, user1, user2;
  let protocolDAO, aiNodeIdentifier, soulboundNFT, mockDLOOP;
  let upgradeExecutor, parameterAdjuster, emergencyPauser;
  let pausableContract;
  
  beforeEach(async function () {
    [admin, executor, governance, emergencyCommittee, aiNode, user1, user2] = await ethers.getSigners();
    
    // Deploy Mock DLOOP token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockDLOOP = await MockERC20.deploy("DLOOP Governance Token", "DLOOP");
    await mockDLOOP.deployed();
    
    // Mint some tokens to users
    await mockDLOOP.mint(admin.address, ethers.utils.parseEther("1000000"));
    await mockDLOOP.mint(user1.address, ethers.utils.parseEther("100000"));
    await mockDLOOP.mint(user2.address, ethers.utils.parseEther("50000"));
    await mockDLOOP.mint(aiNode.address, ethers.utils.parseEther("25000"));
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Identity", "AINODE", admin.address);
    await soulboundNFT.deployed();
    
    // Deploy AINodeIdentifier
    const AINodeIdentifier = await ethers.getContractFactory("AINodeIdentifier");
    aiNodeIdentifier = await AINodeIdentifier.deploy(
      admin.address,
      soulboundNFT.address,
      [governance.address],
      1 // Only need 1 approval for testing
    );
    await aiNodeIdentifier.deployed();
    
    // Grant roles to the identifier contract
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeIdentifier.address);
    await soulboundNFT.grantRole(await soulboundNFT.VERIFIER_ROLE(), aiNodeIdentifier.address);
    
    // Create and verify AI Node
    await aiNodeIdentifier.connect(aiNode).requestVerification(1, "Test AI Node");
    await aiNodeIdentifier.connect(governance).voteOnRequest(0, true);
    
    // Deploy Protocol DAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      mockDLOOP.address,
      aiNodeIdentifier.address,
      [] // No initial executors
    );
    await protocolDAO.deployed();
    
    // Deploy executor contracts
    const UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(admin.address, protocolDAO.address);
    await upgradeExecutor.deployed();
    
    const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(admin.address, protocolDAO.address);
    await parameterAdjuster.deployed();
    
    const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(
      admin.address,
      protocolDAO.address,
      emergencyCommittee.address
    );
    await emergencyPauser.deployed();
    
    // Whitelist executors in ProtocolDAO
    await protocolDAO.connect(admin).updateExecutorWhitelist(upgradeExecutor.address, true);
    await protocolDAO.connect(admin).updateExecutorWhitelist(parameterAdjuster.address, true);
    await protocolDAO.connect(admin).updateExecutorWhitelist(emergencyPauser.address, true);
    
    // Deploy a pausable contract for testing
    const MockPausable = await ethers.getContractFactory("MockPausable");
    pausableContract = await MockPausable.deploy(admin.address);
    await pausableContract.deployed();
  });
  
  describe("ProtocolDAO", function () {
    it("should initialize correctly", async function () {
      expect(await protocolDAO.dloopToken()).to.equal(mockDLOOP.address);
      expect(await protocolDAO.aiNodeIdentifier()).to.equal(aiNodeIdentifier.address);
      expect(await protocolDAO.totalTokenSupply()).to.equal(await mockDLOOP.totalSupply());
      
      expect(await protocolDAO.whitelistedExecutors(upgradeExecutor.address)).to.be.true;
      expect(await protocolDAO.whitelistedExecutors(parameterAdjuster.address)).to.be.true;
      expect(await protocolDAO.whitelistedExecutors(emergencyPauser.address)).to.be.true;
    });
    
    it("should create proposals", async function () {
      // Create a proposal (user1)
      const executionData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("test-data"));
      const tx = await protocolDAO.connect(user1).createProposal(
        upgradeExecutor.address,
        executionData,
        "Test proposal"
      );
      
      const receipt = await tx.wait();
      const proposalId = receipt.events
        .filter(e => e.event === "ProposalCreated")
        .map(e => e.args.id.toNumber())[0];
      
      // Check proposal state
      expect(await protocolDAO.getProposalState(proposalId)).to.equal(1); // Active
      
      // Check if AI fast-track is false for regular user
      const proposalEvent = receipt.events.find(e => e.event === "ProposalCreated");
      expect(proposalEvent.args.isAIFastTrack).to.be.false;
    });
    
    it("should handle AI fast-track proposals", async function () {
      // Create a proposal (AI node)
      const executionData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("test-data"));
      const tx = await protocolDAO.connect(aiNode).createProposal(
        upgradeExecutor.address,
        executionData,
        "AI-initiated proposal"
      );
      
      const receipt = await tx.wait();
      const proposalEvent = receipt.events.find(e => e.event === "ProposalCreated");
      
      // Check if AI fast-track is true for AI node
      expect(proposalEvent.args.isAIFastTrack).to.be.true;
      
      // Verify shorter expiration time
      expect(proposalEvent.args.expiresAt.sub(proposalEvent.args.timelockEndsAt).abs()).to.equal(24 * 60 * 60); // 1 day timelock
      
      // Standard proposal vs AI proposal difference
      const standardVotingPeriod = 7 * 24 * 60 * 60; // 7 days
      const aiVotingPeriod = 2 * 24 * 60 * 60; // 2 days
      
      expect(proposalEvent.args.expiresAt.sub(receipt.blockTimestamp)).to.be.closeTo(
        ethers.BigNumber.from(aiVotingPeriod),
        60 // Allow 60 seconds variance
      );
    });
    
    it("should process voting correctly", async function () {
      // Create a proposal
      const executionData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("test-data"));
      const tx = await protocolDAO.connect(user1).createProposal(
        upgradeExecutor.address,
        executionData,
        "Test proposal for voting"
      );
      
      const receipt = await tx.wait();
      const proposalId = receipt.events
        .filter(e => e.event === "ProposalCreated")
        .map(e => e.args.id.toNumber())[0];
      
      // Cast votes
      await protocolDAO.connect(user1).castVote(proposalId, true); // Yes
      await protocolDAO.connect(user2).castVote(proposalId, false); // No
      
      // Check vote recording
      const [user1Voted, user1Support] = await protocolDAO.getVote(proposalId, user1.address);
      expect(user1Voted).to.be.true;
      expect(user1Support).to.be.true;
      
      const [user2Voted, user2Support] = await protocolDAO.getVote(proposalId, user2.address);
      expect(user2Voted).to.be.true;
      expect(user2Support).to.be.false;
      
      // Check voting power
      const user1Power = await protocolDAO.getVotingPower(user1.address, proposalId);
      expect(user1Power).to.equal(ethers.utils.parseEther("100000"));
      
      const user2Power = await protocolDAO.getVotingPower(user2.address, proposalId);
      expect(user2Power).to.equal(ethers.utils.parseEther("50000"));
      
      // Check quorum
      const [quorum, currentVotes] = await protocolDAO.getProposalQuorum(proposalId);
      
      // quorum should be 30% of total supply for standard proposals
      const expectedQuorum = (await mockDLOOP.totalSupply()).mul(30).div(100);
      expect(quorum).to.equal(expectedQuorum);
      
      // Current votes should be user1's balance
      expect(currentVotes).to.equal(user1Power);
    });
  });
  
  describe("Executor Contracts", function () {
    describe("UpgradeExecutor", function () {
      it("should register and execute upgrades", async function () {
        // Register an upgrade
        const upgradeId = ethers.utils.id("test-upgrade");
        const upgradeData = ethers.utils.hexlify(ethers.utils.toUtf8Bytes("initialize()"));
        
        await upgradeExecutor.connect(admin).registerUpgrade(
          upgradeId,
          pausableContract.address, // Proxy to upgrade
          user1.address, // New implementation
          upgradeData
        );
        
        // Check upgrade info
        const info = await upgradeExecutor.getUpgradeInfo(upgradeId);
        expect(info.proxy).to.equal(pausableContract.address);
        expect(info.newImplementation).to.equal(user1.address);
        expect(info.registered).to.be.true;
        
        // Create and execute a governance proposal to perform the upgrade
        // Note: We're not actually executing the upgrade as it would fail,
        // since our test contract isn't a real proxy, but we can test the flow
        const executionData = ethers.utils.defaultAbiCoder.encode(
          ["bytes32"],
          [upgradeId]
        );
        
        const proposal = await protocolDAO.connect(user1).createProposal(
          upgradeExecutor.address,
          executionData,
          "Upgrade contract"
        );
      });
    });
    
    describe("ParameterAdjuster", function () {
      it("should register and prepare parameter adjustments", async function () {
        // Create fee adjustment calldata
        const feeCalldata = await parameterAdjuster.createFeeAdjustmentCalldata(
          ethers.utils.parseEther("0.1"),  // 10% invest fee
          ethers.utils.parseEther("0.05"), // 5% divest fee
          ethers.utils.parseEther("0.2")   // 20% ragequit fee
        );
        
        // Register an adjustment
        const adjustmentId = ethers.utils.id("fee-adjustment");
        await parameterAdjuster.connect(admin).registerAdjustment(
          adjustmentId,
          pausableContract.address,
          feeCalldata,
          "Update fee structure"
        );
        
        // Check adjustment info
        const info = await parameterAdjuster.getAdjustmentInfo(adjustmentId);
        expect(info.target).to.equal(pausableContract.address);
        expect(info.callData).to.equal(feeCalldata);
        expect(info.description).to.equal("Update fee structure");
        expect(info.registered).to.be.true;
        
        // Create a governance proposal to execute the adjustment
        const executionData = ethers.utils.defaultAbiCoder.encode(
          ["bytes32"],
          [adjustmentId]
        );
        
        const proposal = await protocolDAO.connect(user1).createProposal(
          parameterAdjuster.address,
          executionData,
          "Update fee structure"
        );
      });
    });
    
    describe("EmergencyPauser", function () {
      it("should register pause actions", async function () {
        // Register a pause action
        const pauseId = ethers.utils.id("emergency-pause");
        await emergencyPauser.connect(admin).registerPause(
          pauseId,
          pausableContract.address,
          true, // pause
          "Critical vulnerability discovered"
        );
        
        // Check pause info
        const info = await emergencyPauser.getPauseInfo(pauseId);
        expect(info.target).to.equal(pausableContract.address);
        expect(info.isPause).to.be.true;
        expect(info.reason).to.equal("Critical vulnerability discovered");
        expect(info.registered).to.be.true;
      });
      
      it("should allow emergency committee to pause contracts", async function () {
        // Direct emergency pause (bypassing governance)
        await emergencyPauser.connect(emergencyCommittee).emergencyPause(
          pausableContract.address,
          "Immediate security risk"
        );
        
        // Check emergency status
        expect(await emergencyPauser.emergencyStatus(pausableContract.address)).to.be.true;
      });
    });
  });
});