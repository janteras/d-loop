const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FeeParameterAdjuster", function () {
  let ProtocolDAO, FeeCalculator, FeeParameterAdjuster;
  let protocolDAO, feeCalculator, feeParameterAdjuster;
  let owner, treasury, rewardDistributor, user;
  
  // Constants for testing
  const PARAMETER_ADJUSTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PARAMETER_ADJUSTER_ROLE"));
  
  beforeEach(async function () {
    [owner, treasury, rewardDistributor, user] = await ethers.getSigners();
    
    // Mock Protocol DAO (simplified)
    ProtocolDAO = await ethers.getContractFactory("MockProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy();
    
    // Deploy FeeCalculator
    FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await upgrades.deployProxy(FeeCalculator, [
      treasury.address,
      rewardDistributor.address
    ]);
    
    // Grant role to the executor (will be deployed next)
    // We'll use the protocolDAO address temporarily to setup
    await feeCalculator.grantRole(PARAMETER_ADJUSTER_ROLE, owner.address);
    
    // Deploy FeeParameterAdjuster
    FeeParameterAdjuster = await ethers.getContractFactory("FeeParameterAdjuster");
    feeParameterAdjuster = await FeeParameterAdjuster.deploy(
      feeCalculator.address,
      protocolDAO.address
    );
    
    // Grant the adjuster role to the executor
    await feeCalculator.grantRole(PARAMETER_ADJUSTER_ROLE, feeParameterAdjuster.address);
    await feeCalculator.revokeRole(PARAMETER_ADJUSTER_ROLE, owner.address);
  });
  
  describe("Constructor and Initial State", function () {
    it("should set the fee calculator and dao addresses correctly", async function () {
      expect(await feeParameterAdjuster.feeCalculator()).to.equal(feeCalculator.address);
      expect(await feeParameterAdjuster.dao()).to.equal(protocolDAO.address);
    });
    
    it("should initialize with no pending adjustment", async function () {
      expect(await feeParameterAdjuster.pendingAdjustment()).to.be.false;
    });
  });
  
  describe("Parameter Configuration", function () {
    it("should allow the DAO to set fee parameter config", async function () {
      // Pretend to be the DAO
      await protocolDAO.callExecutor(
        feeParameterAdjuster.address,
        feeParameterAdjuster.interface.encodeFunctionData("setFeeParameterConfig", [
          1500, // 15%
          800,  // 8%
          2500  // 25%
        ])
      );
      
      expect(await feeParameterAdjuster.investFeePercent()).to.equal(1500);
      expect(await feeParameterAdjuster.divestFeePercent()).to.equal(800);
      expect(await feeParameterAdjuster.ragequitFeePercent()).to.equal(2500);
      expect(await feeParameterAdjuster.pendingAdjustment()).to.be.true;
    });
    
    it("should reject parameter configuration from non-DAO", async function () {
      await expect(
        feeParameterAdjuster.connect(user).setFeeParameterConfig(1500, 800, 2500)
      ).to.be.revertedWith("AccessDenied()");
    });
    
    it("should reject invalid parameters", async function () {
      await expect(
        protocolDAO.callExecutor(
          feeParameterAdjuster.address,
          feeParameterAdjuster.interface.encodeFunctionData("setFeeParameterConfig", [
            3500, // 35% - too high
            800,
            2500
          ])
        )
      ).to.be.revertedWith("InvalidParameters()");
    });
  });
  
  describe("Execution", function () {
    beforeEach(async function () {
      // Set up a pending adjustment
      await protocolDAO.callExecutor(
        feeParameterAdjuster.address,
        feeParameterAdjuster.interface.encodeFunctionData("setFeeParameterConfig", [
          1500, // 15%
          800,  // 8%
          2500  // 25%
        ])
      );
    });
    
    it("should execute the parameter adjustment correctly", async function () {
      // Execute the adjustment
      await protocolDAO.callExecutor(
        feeParameterAdjuster.address,
        feeParameterAdjuster.interface.encodeFunctionData("execute")
      );
      
      // Check FeeCalculator state
      expect(await feeCalculator.investFeePercent()).to.equal(1500);
      expect(await feeCalculator.divestFeePercent()).to.equal(800);
      expect(await feeCalculator.ragequitFeePercent()).to.equal(2500);
      
      // Check executor state
      expect(await feeParameterAdjuster.pendingAdjustment()).to.be.false;
    });
    
    it("should reject execution from non-DAO", async function () {
      await expect(
        feeParameterAdjuster.connect(user).execute()
      ).to.be.revertedWith("AccessDenied()");
    });
    
    it("should provide a descriptive string of the operation", async function () {
      const description = await feeParameterAdjuster.getDescription();
      expect(description).to.include("Adjust fee parameters");
      expect(description).to.include("15.0%");
      expect(description).to.include("8.0%");
      expect(description).to.include("25.0%");
    });
  });
});