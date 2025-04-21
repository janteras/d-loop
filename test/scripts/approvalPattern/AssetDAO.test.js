/**
 * @title AssetDAO Token Approval Integration Tests
 * @dev Tests token approval pattern in AssetDAO
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');
const { expect } = require("chai");
const {
  computeRoleHash,
  toWei,
  fromWei,
  deployMockToken,
  getTokenAllowance,
  getTokenBalance,
  calculateGasUsed,
  calculateGasSavings,
  findEvent,
  getRoles
} = require('../../utils/BaseApprovalTest');

describe("AssetDAO Token Approval Pattern", function() {
  let owner, user1, user2, user3, unauthorized;
  let mockToken, assetDAO, feeProcessor, protocolDAO;
  let ROLES;
  
  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, user3, unauthorized] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock token for testing
    mockToken = await deployMockToken("Asset DAO Test Token", "ADTT", 18, owner);
    
    // Deploy the minimal contracts needed
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      owner.address, // treasury
      owner.address, // reward distributor
      owner.address, // fee calculator
      owner.address, // fee admin
      7000, // 70% treasury
      3000  // 30% reward distributor
    );
    await feeProcessor.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    // Create a simple protocol DAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(owner.address);
    await protocolDAO.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    // Deploy AssetDAO with minimal configuration
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      feeProcessor.address,
      protocolDAO.address
    );
    
    // Grant necessary roles
    await assetDAO.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    // Transfer tokens to AssetDAO for testing
    await mockToken.transfer(assetDAO.address, toWei(1000));
  });
  
  describe("Token Approval Functionality", function() {
    it("should allow token transfers to be approved by admin", async function() {
      // Admin approves tokens to be spent by user1
      const tx = await assetDAO.connect(owner).allowTokenTransfer(
        mockToken.address,
        user1.address,
        toWei(500)
      );
      
      // Verify the allowance was set correctly
      const allowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(500));
      
      // User1 should be able to spend the tokens
      await mockToken.connect(user1).transferFrom(assetDAO.address, user2.address, toWei(200));
      
      // Verify the balance was updated
      const user2Balance = await mockToken.balanceOf(user2.address);
      expect(user2Balance).to.equal(toWei(200));
      
      // Verify the remaining allowance
      const remainingAllowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(remainingAllowance).to.equal(toWei(300));
    });
    
    it("should not allow unauthorized users to approve token transfers", async function() {
      // Unauthorized user should not be able to approve token transfers
      await expect(
        assetDAO.connect(unauthorized).allowTokenTransfer(
          mockToken.address,
          user1.address,
          toWei(500)
        )
      ).to.be.reverted;
      
      // Verify no allowance was set
      const allowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(0));
    });
    
    it("should support increasing and decreasing allowances", async function() {
      // First set an initial allowance
      await assetDAO.connect(owner).allowTokenTransfer(
        mockToken.address,
        user1.address,
        toWei(300)
      );
      
      // Increase the allowance
      await assetDAO.connect(owner).increaseTokenAllowance(
        mockToken.address,
        user1.address,
        toWei(200)
      );
      
      // Verify the new allowance
      let allowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(500));
      
      // User1 spends some tokens
      await mockToken.connect(user1).transferFrom(assetDAO.address, user2.address, toWei(100));
      
      // Decrease the allowance
      await assetDAO.connect(owner).decreaseTokenAllowance(
        mockToken.address,
        user1.address,
        toWei(200)
      );
      
      // Verify the new allowance
      allowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(200));
    });
    
    it("should handle batch token approvals efficiently", async function() {
      // Create multiple tokens for testing
      const token1 = await deployMockToken("Token 1", "TK1", 18, owner);
      const token2 = await deployMockToken("Token 2", "TK2", 18, owner);
      const token3 = await deployMockToken("Token 3", "TK3", 18, owner);
      
      // Transfer tokens to AssetDAO
      await token1.transfer(assetDAO.address, toWei(1000));
      await token2.transfer(assetDAO.address, toWei(1000));
      await token3.transfer(assetDAO.address, toWei(1000));
      
      // Approve tokens in batch
      const tokens = [token1.address, token2.address, token3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      const tx = await assetDAO.connect(owner).batchAllowTokenTransfers(
        tokens,
        user1.address,
        amounts
      );
      
      // Verify all allowances
      const allowance1 = await token1.allowance(assetDAO.address, user1.address);
      const allowance2 = await token2.allowance(assetDAO.address, user1.address);
      const allowance3 = await token3.allowance(assetDAO.address, user1.address);
      
      expect(allowance1).to.equal(toWei(100));
      expect(allowance2).to.equal(toWei(200));
      expect(allowance3).to.equal(toWei(300));
      
      // Calculate gas used
      const gasUsed = await calculateGasUsed(tx);
      console.log(`Gas used for batch approval: ${gasUsed}`);
    });
  });
  
  describe("Access Control", function() {
    it("should restrict token approval to admin role", async function() {
      // Grant ADMIN_ROLE to user1
      await assetDAO.grantRole(ROLES.ADMIN_ROLE, user1.address);
      
      // User1 should now be able to approve tokens
      await assetDAO.connect(user1).allowTokenTransfer(
        mockToken.address,
        user2.address,
        toWei(300)
      );
      
      // Verify the allowance
      const allowance = await mockToken.allowance(assetDAO.address, user2.address);
      expect(allowance).to.equal(toWei(300));
      
      // Revoke role from user1
      await assetDAO.revokeRole(ROLES.ADMIN_ROLE, user1.address);
      
      // User1 should no longer be able to approve tokens
      await expect(
        assetDAO.connect(user1).allowTokenTransfer(
          mockToken.address,
          user2.address,
          toWei(500)
        )
      ).to.be.reverted;
    });
  });
  
  describe("Gas Efficiency", function() {
    it("should avoid unnecessary approvals if amounts match", async function() {
      // First approval
      const tx1 = await assetDAO.connect(owner).allowTokenTransfer(
        mockToken.address,
        user1.address,
        toWei(500)
      );
      const gas1 = await calculateGasUsed(tx1);
      
      // Second approval with same amount should use less gas
      const tx2 = await assetDAO.connect(owner).allowTokenTransfer(
        mockToken.address,
        user1.address,
        toWei(500)
      );
      const gas2 = await calculateGasUsed(tx2);
      
      // The second approval should use significantly less gas
      console.log(`First approval gas: ${gas1}, Second approval gas: ${gas2}`);
      expect(gas2).to.be.lessThan(gas1);
    });
    
    it("should use safe decrease to avoid front-running attacks", async function() {
      // Set initial allowance
      await assetDAO.connect(owner).allowTokenTransfer(
        mockToken.address,
        user1.address,
        toWei(1000)
      );
      
      // Use safe decrease to reduce allowance
      const tx = await assetDAO.connect(owner).decreaseTokenAllowance(
        mockToken.address,
        user1.address,
        toWei(400)
      );
      
      // Verify new allowance
      const allowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(600));
      
      // Try to spend more than allowed
      await expect(
        mockToken.connect(user1).transferFrom(assetDAO.address, user2.address, toWei(700))
      ).to.be.reverted;
      
      // Should be able to spend up to the allowed amount
      await mockToken.connect(user1).transferFrom(assetDAO.address, user2.address, toWei(600));
      
      // Allowance should now be zero
      const finalAllowance = await mockToken.allowance(assetDAO.address, user1.address);
      expect(finalAllowance).to.equal(toWei(0));
    });
  });
  
  describe("Safety Features", function() {
    it("should check token balance before approval", async function() {
      // Create a new token with small initial supply
      const limitedToken = await deployMockToken("Limited Token", "LTK", 18, owner);
      await limitedToken.transfer(assetDAO.address, toWei(10));
      
      // Approve an amount up to the balance should work
      await assetDAO.connect(owner).allowTokenTransfer(
        limitedToken.address,
        user1.address,
        toWei(10)
      );
      
      // Verify allowance
      const allowance = await limitedToken.allowance(assetDAO.address, user1.address);
      expect(allowance).to.equal(toWei(10));
    });
    
    it("should reject zero addresses in approval calls", async function() {
      // Should reject zero address for token
      await expect(
        assetDAO.connect(owner).allowTokenTransfer(
          ethers.constants.AddressZero,
          user1.address,
          toWei(100)
        )
      ).to.be.reverted;
      
      // Should reject zero address for spender
      await expect(
        assetDAO.connect(owner).allowTokenTransfer(
          mockToken.address,
          ethers.constants.AddressZero,
          toWei(100)
        )
      ).to.be.reverted;
    });
  });
});