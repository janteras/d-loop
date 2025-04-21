const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Protocol DAO - Executor Integration", function () {
  // This test might take time to run due to time manipulations
  this.timeout(100000);
  
  let MockAINodeRegistry, ProtocolDAO;
  let MockUpgradeable, MockParameterizable, MockPausable;
  let UpgradeExecutor, ParameterAdjuster, EmergencyPauser;
  
  let mockRegistry, protocolDAO;
  let mockUpgradeable, mockParameterizable, mockPausable;
  let upgradeExecutor, parameterAdjuster, emergencyPauser;
  
  let owner, aiNode, user1, user2, newImplementation;
  
  // Test parameters
  const param1 = ethers.utils.parseEther("0.1"); // 10%
  const param2 = ethers.utils.parseEther("0.05"); // 5%
  const param3 = ethers.utils.parseEther("0.2"); // 20%
  const pauseReason = "Security vulnerability detected";
  
  beforeEach(async function () {
    [owner, aiNode, user1, user2, newImplementation] = await ethers.getSigners();
    
    // Deploy mock AI node registry
    MockAINodeRegistry = await ethers.getContractFactory("MockAINodeRegistry");
    mockRegistry = await MockAINodeRegistry.deploy();
    await mockRegistry.deployed();
    
    // Set aiNode as an active AI node
    await mockRegistry.setNodeActive(aiNode.address, true);
    
    // Deploy ProtocolDAO
    ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(mockRegistry.address);
    await protocolDAO.deployed();
    
    // Deploy mock target contracts
    MockUpgradeable = await ethers.getContractFactory("MockUpgradeable");
    mockUpgradeable = await MockUpgradeable.deploy();
    await mockUpgradeable.deployed();
    
    MockParameterizable = await ethers.getContractFactory("MockParameterizable");
    mockParameterizable = await MockParameterizable.deploy();
    await mockParameterizable.deployed();
    
    MockPausable = await ethers.getContractFactory("MockPausable");
    mockPausable = await MockPausable.deploy();
    await mockPausable.deployed();
    
    // Deploy executors
    UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(mockUpgradeable.address, protocolDAO.address);
    await upgradeExecutor.deployed();
    
    ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(mockParameterizable.address, protocolDAO.address);
    await parameterAdjuster.deployed();
    
    EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(mockPausable.address, protocolDAO.address);
    await emergencyPauser.deployed();
    
    // Whitelist executors in ProtocolDAO
    await protocolDAO.updateExecutor(upgradeExecutor.address, true);
    await protocolDAO.updateExecutor(parameterAdjuster.address, true);
    await protocolDAO.updateExecutor(emergencyPauser.address, true);
    
    // Set up voting power
    await protocolDAO.mockSetVotingPower(owner.address, ethers.utils.parseEther("1000"));
    await protocolDAO.mockSetVotingPower(aiNode.address, ethers.utils.parseEther("1000"));
    await protocolDAO.mockSetVotingPower(user1.address, ethers.utils.parseEther("500"));
    await protocolDAO.mockSetVotingPower(user2.address, ethers.utils.parseEther("500"));
    
    // Configure executors
    await upgradeExecutor.setUpgradeConfig(newImplementation.address, "0x");
    await parameterAdjuster.setParameterConfig(param1, param2, param3);
    await emergencyPauser.setPauseConfig(true, pauseReason);
  });
  
  describe("UpgradeExecutor Integration", function () {
    it("should execute upgrade through governance process", async function () {
      // 1. Create proposal
      const proposalTx = await protocolDAO.connect(user1).submitProposal(
        upgradeExecutor.address,
        "Upgrade to new implementation"
      );
      
      const receipt = await proposalTx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // 2. Vote YES with majority
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // 3. Fast forward past voting period (7 days) and timelock (24 hours)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // 4. Execute proposal
      await protocolDAO.executeProposal(proposalId);
      
      // 5. Verify upgrade was executed
      expect(await mockUpgradeable.implementation()).to.equal(newImplementation.address);
      expect(await mockUpgradeable.upgraded()).to.be.true;
    });
  });
  
  describe("ParameterAdjuster Integration", function () {
    it("should adjust parameters through governance process", async function () {
      // 1. Create proposal
      const proposalTx = await protocolDAO.connect(user1).submitProposal(
        parameterAdjuster.address,
        "Adjust fee parameters"
      );
      
      const receipt = await proposalTx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // 2. Vote YES with majority
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(aiNode).voteProposal(proposalId, true);
      
      // 3. Fast forward past voting period (7 days) and timelock (24 hours)
      await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // 4. Execute proposal
      await protocolDAO.executeProposal(proposalId);
      
      // 5. Verify parameters were adjusted
      expect(await mockParameterizable.param1()).to.equal(param1);
      expect(await mockParameterizable.param2()).to.equal(param2);
      expect(await mockParameterizable.param3()).to.equal(param3);
    });
  });
  
  describe("EmergencyPauser Integration", function () {
    it("should pause through governance process", async function () {
      // 1. Create proposal
      const proposalTx = await protocolDAO.connect(aiNode).submitProposal(
        emergencyPauser.address,
        "Emergency pause due to security issue"
      );
      
      const receipt = await proposalTx.wait();
      const event = receipt.events.find(e => e.event === 'ProposalCreated');
      const proposalId = event.args.proposalId;
      
      // 2. Vote YES with majority
      await protocolDAO.connect(owner).voteProposal(proposalId, true);
      await protocolDAO.connect(user1).voteProposal(proposalId, true);
      
      // 3. Fast forward past AI node voting period (1 day) and timelock (24 hours)
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60 + 24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      // 4. Execute proposal
      await protocolDAO.executeProposal(proposalId);
      
      // 5. Verify contract was paused
      expect(await mockPausable.paused()).to.be.true;
    });
  });
  
  describe("Differentiated Voting Periods", function () {
    it("should allow faster execution for AI node proposals", async function () {
      // 1. Create proposal from AI node
      const aiNodeProposalTx = await protocolDAO.connect(aiNode).submitProposal(
        emergencyPauser.address,
        "Emergency pause by AI node"
      );
      
      const aiNodeReceipt = await aiNodeProposalTx.wait();
      const aiNodeEvent = aiNodeReceipt.events.find(e => e.event === 'ProposalCreated');
      const aiNodeProposalId = aiNodeEvent.args.proposalId;
      
      // Get proposal details
      const aiNodeProposal = await protocolDAO.getProposalDetails(aiNodeProposalId);
      
      // 2. Create proposal from human user
      const humanProposalTx = await protocolDAO.connect(user1).submitProposal(
        emergencyPauser.address,
        "Emergency pause by human"
      );
      
      const humanReceipt = await humanProposalTx.wait();
      const humanEvent = humanReceipt.events.find(e => e.event === 'ProposalCreated');
      const humanProposalId = humanEvent.args.proposalId;
      
      // Get proposal details
      const humanProposal = await protocolDAO.getProposalDetails(humanProposalId);
      
      // 3. Verify different voting periods
      const votingDiff = humanProposal.expires.sub(aiNodeProposal.expires);
      
      // The difference should be approximately 6 days (7 days - 1 day)
      // Use closeTo for block time variations
      expect(votingDiff).to.be.closeTo(
        ethers.BigNumber.from(6 * 24 * 60 * 60), 
        ethers.BigNumber.from(60) // Allow 60 seconds tolerance
      );
      
      // 4. Verify different quorum requirements
      expect(aiNodeProposal.quorumPercent).to.equal(40); // AI node quorum
      expect(humanProposal.quorumPercent).to.equal(30); // Human quorum
    });
  });
});