const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ParameterAdjuster", function () {
  let ParameterAdjuster, MockParameterizable;
  let parameterAdjuster, mockParameterizable;
  let owner, nonOwner;
  
  // Test parameters
  const param1 = ethers.utils.parseEther("0.1"); // 10%
  const param2 = ethers.utils.parseEther("0.05"); // 5%
  const param3 = ethers.utils.parseEther("0.2"); // 20%
  
  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    
    // Deploy MockParameterizable
    MockParameterizable = await ethers.getContractFactory("MockParameterizable");
    mockParameterizable = await MockParameterizable.deploy();
    await mockParameterizable.deployed();
    
    // Deploy ParameterAdjuster
    ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
    parameterAdjuster = await ParameterAdjuster.deploy(mockParameterizable.address, owner.address);
    await parameterAdjuster.deployed();
  });
  
  describe("Initialization", function () {
    it("should set the correct target contract", async function () {
      expect(await parameterAdjuster.targetContract()).to.equal(mockParameterizable.address);
    });
    
    it("should set the correct owner", async function () {
      expect(await parameterAdjuster.owner()).to.equal(owner.address);
    });
    
    it("should have zero initial parameters", async function () {
      expect(await parameterAdjuster.param1()).to.equal(0);
      expect(await parameterAdjuster.param2()).to.equal(0);
      expect(await parameterAdjuster.param3()).to.equal(0);
    });
  });
  
  describe("Configuration", function () {
    it("should allow owner to set parameters", async function () {
      await parameterAdjuster.setParameterConfig(param1, param2, param3);
      
      expect(await parameterAdjuster.param1()).to.equal(param1);
      expect(await parameterAdjuster.param2()).to.equal(param2);
      expect(await parameterAdjuster.param3()).to.equal(param3);
    });
    
    it("should emit event when setting parameters", async function () {
      await expect(parameterAdjuster.setParameterConfig(param1, param2, param3))
        .to.emit(parameterAdjuster, "ParametersConfigSet")
        .withArgs(param1, param2, param3);
    });
    
    it("should prevent non-owner from setting parameters", async function () {
      await expect(
        parameterAdjuster.connect(nonOwner).setParameterConfig(param1, param2, param3)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("should enforce parameter bounds", async function () {
      const maxValue = await parameterAdjuster.MAX_PARAM_VALUE();
      const tooLarge = maxValue.add(1);
      
      // param1 too large
      await expect(
        parameterAdjuster.setParameterConfig(tooLarge, param2, param3)
      ).to.be.revertedWith("Param1 exceeds max");
      
      // param2 too large
      await expect(
        parameterAdjuster.setParameterConfig(param1, tooLarge, param3)
      ).to.be.revertedWith("Param2 exceeds max");
      
      // param3 too large
      await expect(
        parameterAdjuster.setParameterConfig(param1, param2, tooLarge)
      ).to.be.revertedWith("Param3 exceeds max");
      
      // All at max value should work
      await parameterAdjuster.setParameterConfig(maxValue, maxValue, maxValue);
      
      expect(await parameterAdjuster.param1()).to.equal(maxValue);
      expect(await parameterAdjuster.param2()).to.equal(maxValue);
      expect(await parameterAdjuster.param3()).to.equal(maxValue);
    });
  });
  
  describe("Execution", function () {
    beforeEach(async function () {
      // Set parameter config for execution tests
      await parameterAdjuster.setParameterConfig(param1, param2, param3);
    });
    
    it("should update parameters in target contract", async function () {
      // Execute parameter adjustment
      const [success, message] = await parameterAdjuster.callStatic.execute();
      
      expect(success).to.be.true;
      expect(message).to.equal("Parameters adjusted successfully");
      
      // Actually execute
      await parameterAdjuster.execute();
      
      // Verify MockParameterizable was updated correctly
      expect(await mockParameterizable.param1()).to.equal(param1);
      expect(await mockParameterizable.param2()).to.equal(param2);
      expect(await mockParameterizable.param3()).to.equal(param3);
    });
    
    it("should emit event in target contract when parameters are updated", async function () {
      await expect(parameterAdjuster.execute())
        .to.emit(mockParameterizable, "ParametersUpdated")
        .withArgs(param1, param2, param3);
    });
  });
});