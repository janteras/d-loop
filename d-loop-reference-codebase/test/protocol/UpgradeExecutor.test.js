const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("UpgradeExecutor", function () {
  let UpgradeExecutor, MockUpgradeable;
  let upgradeExecutor, mockUpgradeable;
  let owner, nonOwner, newImplementation;
  
  beforeEach(async function () {
    [owner, nonOwner, newImplementation] = await ethers.getSigners();
    
    // Deploy MockUpgradeable
    MockUpgradeable = await ethers.getContractFactory("MockUpgradeable");
    mockUpgradeable = await MockUpgradeable.deploy();
    await mockUpgradeable.deployed();
    
    // Deploy UpgradeExecutor
    UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
    upgradeExecutor = await UpgradeExecutor.deploy(mockUpgradeable.address, owner.address);
    await upgradeExecutor.deployed();
  });
  
  describe("Initialization", function () {
    it("should set the correct proxy address", async function () {
      expect(await upgradeExecutor.proxyAddress()).to.equal(mockUpgradeable.address);
    });
    
    it("should set the correct owner", async function () {
      expect(await upgradeExecutor.owner()).to.equal(owner.address);
    });
    
    it("should have null initial implementation address", async function () {
      expect(await upgradeExecutor.implementationAddress()).to.equal(ethers.constants.AddressZero);
    });
  });
  
  describe("Configuration", function () {
    it("should allow owner to set implementation address", async function () {
      await upgradeExecutor.setUpgradeConfig(newImplementation.address, "0x");
      
      expect(await upgradeExecutor.implementationAddress()).to.equal(newImplementation.address);
      expect(await upgradeExecutor.initializerData()).to.equal("0x");
    });
    
    it("should allow owner to set implementation with initializer", async function () {
      const initData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "string"], 
        [42, "initialize"]
      );
      
      await upgradeExecutor.setUpgradeConfig(newImplementation.address, initData);
      
      expect(await upgradeExecutor.implementationAddress()).to.equal(newImplementation.address);
      expect(await upgradeExecutor.initializerData()).to.equal(initData);
    });
    
    it("should emit event when setting upgrade config", async function () {
      const initData = "0x";
      
      await expect(upgradeExecutor.setUpgradeConfig(newImplementation.address, initData))
        .to.emit(upgradeExecutor, "UpgradeConfigSet")
        .withArgs(newImplementation.address, initData);
    });
    
    it("should prevent non-owner from setting implementation", async function () {
      await expect(
        upgradeExecutor.connect(nonOwner).setUpgradeConfig(newImplementation.address, "0x")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    
    it("should prevent setting zero address as implementation", async function () {
      await expect(
        upgradeExecutor.setUpgradeConfig(ethers.constants.AddressZero, "0x")
      ).to.be.revertedWith("Zero implementation address");
    });
  });
  
  describe("Execution", function () {
    it("should fail execution if implementation not set", async function () {
      const [success, message] = await upgradeExecutor.callStatic.execute();
      
      expect(success).to.be.false;
      expect(message).to.include("Implementation not set");
    });
    
    it("should upgrade without initializer", async function () {
      // Set upgrade config
      await upgradeExecutor.setUpgradeConfig(newImplementation.address, "0x");
      
      // Execute upgrade
      const [success, message] = await upgradeExecutor.callStatic.execute();
      
      expect(success).to.be.true;
      expect(message).to.equal("Upgrade successful");
      
      // Actually execute
      await upgradeExecutor.execute();
      
      // Verify MockUpgradeable was updated correctly
      expect(await mockUpgradeable.implementation()).to.equal(newImplementation.address);
      expect(await mockUpgradeable.upgraded()).to.be.true;
      expect(await mockUpgradeable.initializer()).to.equal("0x");
    });
    
    it("should upgrade with initializer", async function () {
      // Create initializer data
      const initData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "string"], 
        [42, "initialize"]
      );
      
      // Set upgrade config
      await upgradeExecutor.setUpgradeConfig(newImplementation.address, initData);
      
      // Execute upgrade
      await upgradeExecutor.execute();
      
      // Verify MockUpgradeable was updated correctly
      expect(await mockUpgradeable.implementation()).to.equal(newImplementation.address);
      expect(await mockUpgradeable.upgraded()).to.be.true;
      expect(await mockUpgradeable.initializer()).to.equal(initData);
    });
  });
});