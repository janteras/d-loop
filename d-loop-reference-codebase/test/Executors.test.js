const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("DAO Executors", function () {
  let admin, protocolDAO, emergencyTeam, user;
  let assetDAO, feeCalculator, daoIntegrator, governanceRewards, daiToken;
  let upgradeExecutor, parameterAdjuster, emergencyPauser;
  let mockImplementation;

  // Constants
  const PROTOCOL_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROTOCOL_DAO_ROLE"));
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const EMERGENCY_TEAM_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMERGENCY_TEAM_ROLE"));

  beforeEach(async function () {
    // Get signers
    [admin, protocolDAO, emergencyTeam, user] = await ethers.getSigners();

    // Deploy mock implementation for testing upgrades
    const MockImplementation = await ethers.getContractFactory("MockImplementation");
    mockImplementation = await MockImplementation.deploy();
    await mockImplementation.deployed();

    // Deploy test contracts that will be controlled by the executors
    // For simplicity, we're deploying simplified versions of the contracts
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await upgrades.deployProxy(DAIToken, [
      admin.address,
      admin.address,
      admin.address,
      ethers.utils.parseEther("10000000")
    ]);
    await daiToken.deployed();

    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      admin.address,
      admin.address,
      ethers.utils.parseEther("0.1"),  // 10% invest fee
      ethers.utils.parseEther("0.05"), // 5% divest fee
      ethers.utils.parseEther("0.2")   // 20% ragequit fee
    );
    await feeCalculator.deployed();

    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await upgrades.deployProxy(AssetDAO, [
      admin.address,
      protocolDAO.address,
      daiToken.address,
      feeCalculator.address,
      ethers.constants.AddressZero, // No oracle for this test
      admin.address, // Treasury
      3000, // 30% quorum
      86400, // 1 day voting period
      43200  // 12 hours execution delay
    ]);
    await assetDAO.deployed();

    // Deploy DAOIntegrator
    const DAOIntegrator = await ethers.getContractFactory("DAOIntegrator");
    daoIntegrator = await upgrades.deployProxy(DAOIntegrator, [
      admin.address,
      protocolDAO.address,
      assetDAO.address
    ]);
    await daoIntegrator.deployed();

    // Deploy GovernanceRewards (simplified for testing)
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      admin.address,
      protocolDAO.address
    );
    await governanceRewards.deployed();

    // Deploy the executor contracts
    
    // Deploy UpgradeExecutor
    const UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(
      admin.address,
      protocolDAO.address
    );
    await upgradeExecutor.deployed();

    // Deploy ParameterAdjuster
    const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(
      admin.address,
      protocolDAO.address,
      assetDAO.address,
      feeCalculator.address
    );
    await parameterAdjuster.deployed();

    // Deploy EmergencyPauser
    const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(
      admin.address,
      protocolDAO.address,
      emergencyTeam.address
    );
    await emergencyPauser.deployed();

    // Set contracts in EmergencyPauser
    await emergencyPauser.setAssetDAO(assetDAO.address);
    await emergencyPauser.setDAOIntegrator(daoIntegrator.address);
    await emergencyPauser.setGovernanceRewards(governanceRewards.address);
  });

  describe("UpgradeExecutor", function () {
    it("Should set proxy address", async function () {
      await upgradeExecutor.setProxyAddress(assetDAO.address);
      expect(await upgradeExecutor.proxyAddress()).to.equal(assetDAO.address);
    });

    it("Should set implementation address and data", async function () {
      const initData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "address", "address", "uint256", "uint256", "uint256"],
        [admin.address, protocolDAO.address, daiToken.address, feeCalculator.address, ethers.constants.AddressZero, 3000, 86400, 43200]
      );

      await upgradeExecutor.setImplementation(mockImplementation.address, initData);
      expect(await upgradeExecutor.newImplementation()).to.equal(mockImplementation.address);
    });

    it("Should allow only admin to set proxy address", async function () {
      await expect(
        upgradeExecutor.connect(user).setProxyAddress(assetDAO.address)
      ).to.be.revertedWith("AccessControl");
    });

    it("Should allow only Protocol DAO to execute upgrade", async function () {
      await upgradeExecutor.setProxyAddress(assetDAO.address);
      await upgradeExecutor.setImplementation(mockImplementation.address, "0x");

      await expect(
        upgradeExecutor.connect(user).execute()
      ).to.be.revertedWith("AccessControl");
    });
  });

  describe("ParameterAdjuster", function () {
    it("Should set AssetDAO parameters", async function () {
      const newQuorum = 4000; // 40%
      const newVotingPeriod = 172800; // 2 days
      const newExecutionDelay = 86400; // 1 day

      await parameterAdjuster.setAssetDAOParameters(newQuorum, newVotingPeriod, newExecutionDelay);

      // Check that parameters were set in the contract
      expect(await parameterAdjuster.newParameters(1)).to.equal(newQuorum);
      expect(await parameterAdjuster.newParameters(2)).to.equal(newVotingPeriod);
      expect(await parameterAdjuster.newParameters(3)).to.equal(newExecutionDelay);
    });

    it("Should set FeeCalculator parameters", async function () {
      const newInvestFee = 1500; // 15%
      const newDivestFee = 750; // 7.5%
      const newRagequitFee = 2500; // 25%

      await parameterAdjuster.setFeeCalculatorParameters(newInvestFee, newDivestFee, newRagequitFee);

      // Check that parameters were set in the contract
      expect(await parameterAdjuster.newParameters(4)).to.equal(newInvestFee);
      expect(await parameterAdjuster.newParameters(5)).to.equal(newDivestFee);
      expect(await parameterAdjuster.newParameters(6)).to.equal(newRagequitFee);
    });

    it("Should allow only Protocol DAO to execute parameter adjustments", async function () {
      const newQuorum = 4000; // 40%
      const newVotingPeriod = 172800; // 2 days
      const newExecutionDelay = 86400; // 1 day

      await parameterAdjuster.setAssetDAOParameters(newQuorum, newVotingPeriod, newExecutionDelay);

      await expect(
        parameterAdjuster.connect(user).execute(1) // AssetDAOQuorum
      ).to.be.revertedWith("AccessControl");
    });
  });

  describe("EmergencyPauser", function () {
    it("Should activate emergency mode", async function () {
      await emergencyPauser.connect(emergencyTeam).activateEmergency("Security incident");
      expect(await emergencyPauser.emergencyActive()).to.be.true;
      expect(await emergencyPauser.emergencyReason()).to.equal("Security incident");
      expect(await emergencyPauser.emergencyActivator()).to.equal(emergencyTeam.address);
    });

    it("Should pause a specific system", async function () {
      // Make sure AssetDAO starts unpaused
      expect(await assetDAO.paused()).to.be.false;

      // Pause AssetDAO
      await emergencyPauser.connect(protocolDAO).pauseSystem(1); // 1 = AssetDAO

      // Check that AssetDAO is now paused
      expect(await assetDAO.paused()).to.be.true;
    });

    it("Should pause all systems when execute is called", async function () {
      // Make sure systems start unpaused
      expect(await assetDAO.paused()).to.be.false;
      expect(await daoIntegrator.paused()).to.be.false;
      expect(await governanceRewards.paused()).to.be.false;

      // Execute emergency pause
      await emergencyPauser.connect(protocolDAO).execute();

      // Check that all systems are now paused
      expect(await assetDAO.paused()).to.be.true;
      expect(await daoIntegrator.paused()).to.be.true;
      expect(await governanceRewards.paused()).to.be.true;
    });

    it("Should allow emergency team to pause systems only during emergency", async function () {
      // Try to pause without emergency active
      await expect(
        emergencyPauser.connect(emergencyTeam).pauseSystem(1) // 1 = AssetDAO
      ).to.be.revertedWith("EmergencyPauser: not authorized");

      // Activate emergency
      await emergencyPauser.connect(emergencyTeam).activateEmergency("Security incident");

      // Now pausing should work
      await emergencyPauser.connect(emergencyTeam).pauseSystem(1); // 1 = AssetDAO
      expect(await assetDAO.paused()).to.be.true;
    });
  });
});

// Mock Implementation is defined in contracts/mocks/MockImplementation.sol