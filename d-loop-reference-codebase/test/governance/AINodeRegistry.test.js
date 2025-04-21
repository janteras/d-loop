const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AINodeRegistry", function () {
  let owner, admin, committee1, committee2, committee3, user1, user2;
  let aiNodeRegistry, soulboundNFT;
  
  beforeEach(async function () {
    [owner, admin, committee1, committee2, committee3, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      admin.address,
      soulboundNFT.address,
      2 // Minimum approvals required
    );
    await aiNodeRegistry.deployed();
    
    // Grant minter role to AINodeRegistry
    await soulboundNFT.connect(admin).grantMinterRole(aiNodeRegistry.address);
    
    // Add committee members
    await aiNodeRegistry.connect(admin).addCommitteeMember(committee1.address);
    await aiNodeRegistry.connect(admin).addCommitteeMember(committee2.address);
    await aiNodeRegistry.connect(admin).addCommitteeMember(committee3.address);
  });
  
  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      expect(await aiNodeRegistry.soulboundNFT()).to.equal(soulboundNFT.address);
      expect(await aiNodeRegistry.minApprovalsRequired()).to.equal(2);
      expect(await aiNodeRegistry.committeeSize()).to.equal(3);
    });
    
    it("should set admin role correctly", async function () {
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.COMMITTEE_ROLE(), committee1.address)).to.be.true;
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.COMMITTEE_ROLE(), committee2.address)).to.be.true;
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.COMMITTEE_ROLE(), committee3.address)).to.be.true;
    });
  });
  
  describe("Committee Management", function () {
    it("should allow admin to add committee members", async function () {
      await aiNodeRegistry.connect(admin).addCommitteeMember(user1.address);
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.COMMITTEE_ROLE(), user1.address)).to.be.true;
      expect(await aiNodeRegistry.committeeSize()).to.equal(4);
    });
    
    it("should allow admin to remove committee members", async function () {
      await aiNodeRegistry.connect(admin).removeCommitteeMember(committee3.address);
      expect(await aiNodeRegistry.hasRole(await aiNodeRegistry.COMMITTEE_ROLE(), committee3.address)).to.be.false;
      expect(await aiNodeRegistry.committeeSize()).to.equal(2);
    });
    
    it("should prevent non-admins from managing committee", async function () {
      await expect(
        aiNodeRegistry.connect(user1).addCommitteeMember(user2.address)
      ).to.be.reverted;
      
      await expect(
        aiNodeRegistry.connect(committee1).removeCommitteeMember(committee2.address)
      ).to.be.reverted;
    });
    
    it("should adjust min approvals if committee size changes", async function () {
      // Add more members
      await aiNodeRegistry.connect(admin).addCommitteeMember(user1.address);
      await aiNodeRegistry.connect(admin).addCommitteeMember(user2.address);
      
      // Check min approvals adjusted to 3 (60% of 5)
      expect(await aiNodeRegistry.minApprovalsRequired()).to.equal(3);
      
      // Remove members
      await aiNodeRegistry.connect(admin).removeCommitteeMember(committee1.address);
      await aiNodeRegistry.connect(admin).removeCommitteeMember(committee2.address);
      
      // Check min approvals adjusted to 2 (60% of 3, rounded up)
      expect(await aiNodeRegistry.minApprovalsRequired()).to.equal(2);
    });
  });
  
  describe("Node Registration", function () {
    const metadata = "ipfs://QmTestAINode";
    
    it("should create a pending registration", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration(metadata);
      
      const request = await aiNodeRegistry.getRegistrationRequest(user1.address);
      expect(request.applicant).to.equal(user1.address);
      expect(request.metadata).to.equal(metadata);
      expect(request.approvalCount).to.equal(0);
      expect(request.approved).to.be.false;
      expect(request.rejected).to.be.false;
    });
    
    it("should allow committee members to approve a registration", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration(metadata);
      
      await aiNodeRegistry.connect(committee1).approveRegistration(user1.address);
      let request = await aiNodeRegistry.getRegistrationRequest(user1.address);
      expect(request.approvalCount).to.equal(1);
      expect(request.approved).to.be.false;
      
      await aiNodeRegistry.connect(committee2).approveRegistration(user1.address);
      request = await aiNodeRegistry.getRegistrationRequest(user1.address);
      expect(request.approvalCount).to.equal(2);
      expect(request.approved).to.be.true;
      
      // Check if SoulboundNFT was minted
      expect(await soulboundNFT.hasSoulboundToken(user1.address)).to.be.true;
    });
    
    it("should allow committee members to reject a registration", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration(metadata);
      
      await aiNodeRegistry.connect(committee1).rejectRegistration(user1.address);
      const request = await aiNodeRegistry.getRegistrationRequest(user1.address);
      expect(request.rejected).to.be.true;
      
      // Verify that the request is now closed
      await expect(
        aiNodeRegistry.connect(committee2).approveRegistration(user1.address)
      ).to.be.revertedWith("Request is closed");
    });
    
    it("should prevent double-approvals and double-rejections", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration(metadata);
      
      await aiNodeRegistry.connect(committee1).approveRegistration(user1.address);
      await expect(
        aiNodeRegistry.connect(committee1).approveRegistration(user1.address)
      ).to.be.revertedWith("Already processed by this committee member");
      
      await aiNodeRegistry.connect(committee2).rejectRegistration(user1.address);
      await expect(
        aiNodeRegistry.connect(committee2).rejectRegistration(user1.address)
      ).to.be.revertedWith("Already processed by this committee member");
    });
    
    it("should prevent non-committee members from approving or rejecting", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration(metadata);
      
      await expect(
        aiNodeRegistry.connect(user2).approveRegistration(user1.address)
      ).to.be.reverted;
      
      await expect(
        aiNodeRegistry.connect(user2).rejectRegistration(user1.address)
      ).to.be.reverted;
    });
  });
  
  describe("Node Management", function () {
    beforeEach(async function () {
      // Register an AI node
      await aiNodeRegistry.connect(user1).requestRegistration("ipfs://QmTestAINode");
      await aiNodeRegistry.connect(committee1).approveRegistration(user1.address);
      await aiNodeRegistry.connect(committee2).approveRegistration(user1.address);
    });
    
    it("should allow admin to revoke node status", async function () {
      expect(await soulboundNFT.hasSoulboundToken(user1.address)).to.be.true;
      
      await aiNodeRegistry.connect(admin).revokeNodeStatus(user1.address);
      expect(await soulboundNFT.hasSoulboundToken(user1.address)).to.be.false;
    });
    
    it("should track registered nodes", async function () {
      expect(await aiNodeRegistry.isRegisteredNode(user1.address)).to.be.true;
      expect(await aiNodeRegistry.isRegisteredNode(user2.address)).to.be.false;
      
      // Register another node
      await aiNodeRegistry.connect(user2).requestRegistration("ipfs://QmTestAINode2");
      await aiNodeRegistry.connect(committee1).approveRegistration(user2.address);
      await aiNodeRegistry.connect(committee2).approveRegistration(user2.address);
      
      expect(await aiNodeRegistry.isRegisteredNode(user2.address)).to.be.true;
      expect(await aiNodeRegistry.getRegisteredNodeCount()).to.equal(2);
    });
    
    it("should prevent reregistration of existing nodes", async function () {
      await expect(
        aiNodeRegistry.connect(user1).requestRegistration("ipfs://QmTestAINode2")
      ).to.be.revertedWith("Already registered");
    });
  });
  
  describe("Administrative Functions", function () {
    it("should allow admin to update minimum approvals", async function () {
      await aiNodeRegistry.connect(admin).setMinApprovalsRequired(3);
      expect(await aiNodeRegistry.minApprovalsRequired()).to.equal(3);
      
      // Should revert if set too high
      await expect(
        aiNodeRegistry.connect(admin).setMinApprovalsRequired(4)
      ).to.be.revertedWith("Min approvals cannot exceed committee size");
    });
    
    it("should allow admin to reset a registration request", async function () {
      await aiNodeRegistry.connect(user1).requestRegistration("ipfs://QmTestAINode");
      await aiNodeRegistry.connect(committee1).approveRegistration(user1.address);
      
      await aiNodeRegistry.connect(admin).resetRegistrationRequest(user1.address);
      
      const request = await aiNodeRegistry.getRegistrationRequest(user1.address);
      expect(request.approvalCount).to.equal(0);
      expect(request.approved).to.be.false;
      expect(request.rejected).to.be.false;
    });
  });
});