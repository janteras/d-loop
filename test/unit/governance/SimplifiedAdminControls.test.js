const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import ETHv6 shim for compatibility
require("../../ethers-v6-shim.stable");

describe("SimplifiedAdminControls", function() {
  let adminControls;
  let mockTarget;
  let deployer;
  let admin;
  let user;
  
  // Role constants
  let DEFAULT_ADMIN_ROLE;
  let DEPLOYER_ROLE;
  let ADMIN_ROLE;
  let GOVERNANCE_ROLE;
  
  // Test parameters
  const APPROVAL_THRESHOLD = 1; // Single-admin testnet mode
  const TIMELOCK = 60 * 60; // 1 hour timelock
  
  before(async function() {
    // Get signers
    [deployer, admin, user] = await ethers.getSigners();
    
    // Deploy mock target contract
    const MockTarget = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTarget.deploy();
    await mockTarget.deployed();
    
    // Deploy SimplifiedAdminControls
    const SimplifiedAdminControls = await ethers.getContractFactory("SimplifiedAdminControls");
    adminControls = await SimplifiedAdminControls.deploy(
      deployer.address,
      APPROVAL_THRESHOLD,
      TIMELOCK
    );
    await adminControls.deployed();
    
    // Get role constants
    DEFAULT_ADMIN_ROLE = await adminControls.DEFAULT_ADMIN_ROLE();
    DEPLOYER_ROLE = await adminControls.DEPLOYER_ROLE();
    ADMIN_ROLE = await adminControls.ADMIN_ROLE();
    GOVERNANCE_ROLE = await adminControls.GOVERNANCE_ROLE();
  });
  
  describe("Initialization", function() {
    it("Should initialize with correct parameters", async function() {
      expect(await adminControls.approvalThreshold()).to.equal(APPROVAL_THRESHOLD);
      expect(await adminControls.timelock()).to.equal(TIMELOCK);
    });
    
    it("Should assign correct roles to deployer", async function() {
      expect(await adminControls.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await adminControls.hasRole(DEPLOYER_ROLE, deployer.address)).to.be.true;
      expect(await adminControls.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await adminControls.hasRole(GOVERNANCE_ROLE, deployer.address)).to.be.true;
    });
  });
  
  describe("Role Management", function() {
    it("Should allow assigning roles", async function() {
      // Assign ADMIN_ROLE to admin
      const tx = await adminControls.assignRole(ADMIN_ROLE, admin.address);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "RoleAssigned");
      expect(event).to.not.be.undefined;
      expect(event.args.role).to.equal(ADMIN_ROLE);
      expect(event.args.account).to.equal(admin.address);
      expect(event.args.grantor).to.equal(deployer.address);
      
      // Check role assignment
      expect(await adminControls.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await adminControls.hasAdminRole(ADMIN_ROLE, admin.address)).to.be.true;
    });
    
    it("Should enforce role restrictions", async function() {
      // Non-admin should not be able to assign roles
      await expect(
        adminControls.connect(user).assignRole(ADMIN_ROLE, user.address)
      ).to.be.reverted;
    });
  });
  
  describe("Contract Registration", function() {
    it("Should register contracts correctly", async function() {
      // Register the mock target
      const tx = await adminControls.registerContract("MockTarget", mockTarget.address);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ContractRegistered");
      expect(event).to.not.be.undefined;
      expect(event.args.name).to.equal("MockTarget");
      expect(event.args.contractAddress).to.equal(mockTarget.address);
      
      // Check contract registration
      expect(await adminControls.managedContracts("MockTarget")).to.equal(mockTarget.address);
      expect(await adminControls.getContractAddress("MockTarget")).to.equal(mockTarget.address);
    });
    
    it("Should prevent duplicate registration", async function() {
      await expect(
        adminControls.registerContract("MockTarget", mockTarget.address)
      ).to.be.revertedWith("Name already registered");
    });
    
    it("Should allow admin to register contracts", async function() {
      // Deploy a second mock target
      const MockTarget = await ethers.getContractFactory("MockTarget");
      const mockTarget2 = await MockTarget.deploy();
      await mockTarget2.deployed();
      
      // Register using admin account
      await adminControls.connect(admin).registerContract("MockTarget2", mockTarget2.address);
      
      // Check registration
      expect(await adminControls.getContractAddress("MockTarget2")).to.equal(mockTarget2.address);
    });
  });
  
  describe("Contract Approval", function() {
    it("Should approve contracts correctly", async function() {
      // Approve the mock target
      const tx = await adminControls.approveContract(mockTarget.address);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "ContractApproved");
      expect(event).to.not.be.undefined;
      expect(event.args.contractAddress).to.equal(mockTarget.address);
      expect(event.args.approver).to.equal(deployer.address);
      
      // Check contract approval
      expect(await adminControls.approvedContracts(mockTarget.address)).to.be.true;
      expect(await adminControls.isApprovedContract(mockTarget.address)).to.be.true;
    });
    
    it("Should prevent approving already approved contracts", async function() {
      await expect(
        adminControls.approveContract(mockTarget.address)
      ).to.be.revertedWith("Already approved");
    });
  });
  
  describe("Timelocked Operations", function() {
    let operationId;
    
    it("Should schedule operations correctly", async function() {
      // Create calldata for the target
      const callData = mockTarget.interface.encodeFunctionData("setParameter", [123]);
      
      // Schedule operation
      const tx = await adminControls.scheduleOperation(mockTarget.address, callData);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "OperationScheduled");
      expect(event).to.not.be.undefined;
      expect(event.args.target).to.equal(mockTarget.address);
      
      // Save operation ID
      operationId = event.args.operationId;
      
      // Check pending operations
      const pendingIds = await adminControls.getPendingOperationIds();
      expect(pendingIds).to.include(operationId);
    });
    
    it("Should prevent executing operations before timelock expiry", async function() {
      await expect(
        adminControls.executeOperation(operationId)
      ).to.be.revertedWith("Timelock not elapsed");
    });
    
    it("Should execute operations after timelock", async function() {
      // Advance time past timelock period
      await ethers.provider.send("evm_increaseTime", [TIMELOCK + 1]);
      await ethers.provider.send("evm_mine");
      
      // Execute operation
      const tx = await adminControls.executeOperation(operationId);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "OperationExecuted");
      expect(event).to.not.be.undefined;
      expect(event.args.operationId).to.equal(operationId);
      
      // Check target state was updated
      expect(await mockTarget.parameter()).to.equal(123);
    });
    
    it("Should prevent executing already executed operations", async function() {
      await expect(
        adminControls.executeOperation(operationId)
      ).to.be.revertedWith("Already executed");
    });
  });
  
  describe("Admin Parameter Updates", function() {
    it("Should update approval threshold", async function() {
      // Update approval threshold to 2
      const tx = await adminControls.updateApprovalThreshold(2);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "AdminParameterUpdated");
      expect(event).to.not.be.undefined;
      expect(event.args.parameter).to.equal("ApprovalThreshold");
      expect(event.args.oldValue).to.equal(APPROVAL_THRESHOLD);
      expect(event.args.newValue).to.equal(2);
      
      // Check updated value
      expect(await adminControls.approvalThreshold()).to.equal(2);
    });
    
    it("Should update timelock period", async function() {
      // Update timelock to 2 hours
      const newTimelock = 60 * 60 * 2;
      const tx = await adminControls.updateTimelock(newTimelock);
      
      // Check event emission
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === "AdminParameterUpdated");
      expect(event).to.not.be.undefined;
      expect(event.args.parameter).to.equal("Timelock");
      expect(event.args.oldValue).to.equal(TIMELOCK);
      expect(event.args.newValue).to.equal(newTimelock);
      
      // Check updated value
      expect(await adminControls.timelock()).to.equal(newTimelock);
    });
    
    it("Should enforce parameter validation", async function() {
      await expect(
        adminControls.updateApprovalThreshold(0)
      ).to.be.revertedWith("Invalid threshold");
    });
  });
  
  describe("Role-Based Access Control", function() {
    it("Should enforce ADMIN_ROLE for contract registration", async function() {
      await expect(
        adminControls.connect(user).registerContract("TestContract", ethers.constants.AddressZero)
      ).to.be.reverted;
    });
    
    it("Should enforce ADMIN_ROLE for contract approval", async function() {
      await expect(
        adminControls.connect(user).approveContract(ethers.constants.AddressZero)
      ).to.be.reverted;
    });
    
    it("Should enforce ADMIN_ROLE for operation scheduling", async function() {
      await expect(
        adminControls.connect(user).scheduleOperation(mockTarget.address, "0x")
      ).to.be.reverted;
    });
    
    it("Should enforce GOVERNANCE_ROLE for parameter updates", async function() {
      await expect(
        adminControls.connect(user).updateApprovalThreshold(3)
      ).to.be.reverted;
      
      await expect(
        adminControls.connect(user).updateTimelock(1)
      ).to.be.reverted;
    });
  });
});