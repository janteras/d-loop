const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EmergencyPauser", function () {
  let EmergencyPauser, MockPausable;
  let emergencyPauser, mockPausable;
  let owner, nonOwner;
  
  // Test reasons
  const pauseReason = "Security vulnerability detected";
  const unpauseReason = "Issue resolved";
  
  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();
    
    // Deploy MockPausable
    MockPausable = await ethers.getContractFactory("MockPausable");
    mockPausable = await MockPausable.deploy();
    await mockPausable.deployed();
    
    // Deploy EmergencyPauser
    EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
    emergencyPauser = await EmergencyPauser.deploy(mockPausable.address, owner.address);
    await emergencyPauser.deployed();
  });
  
  describe("Initialization", function () {
    it("should set the correct target contract", async function () {
      expect(await emergencyPauser.targetContract()).to.equal(mockPausable.address);
    });
    
    it("should set the correct owner", async function () {
      expect(await emergencyPauser.owner()).to.equal(owner.address);
    });
    
    it("should initialize with default pause state (true)", async function () {
      expect(await emergencyPauser.pauseState()).to.be.true;
    });
    
    it("should initialize with empty pause reason", async function () {
      expect(await emergencyPauser.pauseReason()).to.equal("");
    });
  });
  
  describe("Configuration", function () {
    it("should allow owner to set pause config (pause)", async function () {
      await emergencyPauser.setPauseConfig(true, pauseReason);
      
      expect(await emergencyPauser.pauseState()).to.be.true;
      expect(await emergencyPauser.pauseReason()).to.equal(pauseReason);
    });
    
    it("should allow owner to set pause config (unpause)", async function () {
      await emergencyPauser.setPauseConfig(false, unpauseReason);
      
      expect(await emergencyPauser.pauseState()).to.be.false;
      expect(await emergencyPauser.pauseReason()).to.equal(unpauseReason);
    });
    
    it("should emit event when setting pause config", async function () {
      await expect(emergencyPauser.setPauseConfig(true, pauseReason))
        .to.emit(emergencyPauser, "PauseConfigSet")
        .withArgs(true, pauseReason);
    });
    
    it("should prevent non-owner from setting pause config", async function () {
      await expect(
        emergencyPauser.connect(nonOwner).setPauseConfig(true, pauseReason)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  
  describe("Execution", function () {
    it("should pause target contract", async function () {
      // Configure to pause
      await emergencyPauser.setPauseConfig(true, pauseReason);
      
      // Execute pause
      const [success, message] = await emergencyPauser.callStatic.execute();
      
      expect(success).to.be.true;
      expect(message).to.include("Emergency pause activated");
      expect(message).to.include(pauseReason);
      
      // Actually execute
      await emergencyPauser.execute();
      
      // Verify MockPausable was updated correctly
      expect(await mockPausable.paused()).to.be.true;
    });
    
    it("should unpause target contract", async function () {
      // First pause the contract
      await emergencyPauser.setPauseConfig(true, pauseReason);
      await emergencyPauser.execute();
      
      // Now configure to unpause
      await emergencyPauser.setPauseConfig(false, unpauseReason);
      
      // Execute unpause
      const [success, message] = await emergencyPauser.callStatic.execute();
      
      expect(success).to.be.true;
      expect(message).to.equal("Emergency pause deactivated");
      
      // Actually execute
      await emergencyPauser.execute();
      
      // Verify MockPausable was updated correctly
      expect(await mockPausable.paused()).to.be.false;
    });
    
    it("should emit event in target contract when pausing/unpausing", async function () {
      // Configure to pause
      await emergencyPauser.setPauseConfig(true, pauseReason);
      
      // Check pause event
      await expect(emergencyPauser.execute())
        .to.emit(mockPausable, "PauseToggled")
        .withArgs(true);
      
      // Configure to unpause
      await emergencyPauser.setPauseConfig(false, unpauseReason);
      
      // Check unpause event
      await expect(emergencyPauser.execute())
        .to.emit(mockPausable, "PauseToggled")
        .withArgs(false);
    });
  });
});