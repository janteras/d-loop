/**
 * @title DLoopToken Token Approval Extended Tests
 * @dev Comprehensive tests for role-based approvals and token access patterns in DLoopToken contract
 */

/**
 * Helper function to handle different ethers.js versions
 * @param {Object} obj The object with address or getAddress
 * @returns {Promise<string>} The address
 */
async function getAddress(obj) {
  return typeof obj.getAddress === 'function' ? await getAddress(obj) : obj.address;
}
const { ethers } = require("hardhat");
require('../utils/ethers-v6-compat');
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
} = require('../utils/BaseApprovalTest');

describe("DLoopToken Role-Based Approval Pattern", function() {
  let deployer, admin, pauser, minter, user1, user2, unauthorized;
  let dloopToken;
  
  // Role constants
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  const MINTER_ROLE = computeRoleHash("MINTER_ROLE");
  const PAUSER_ROLE = computeRoleHash("PAUSER_ROLE");
  
  // Token parameters
  const NAME = "DLOOP Protocol Token";
  const SYMBOL = "DLOOP";
  const DECIMALS = 18;
  const INITIAL_SUPPLY = toWei(1000000);
  const MAX_SUPPLY = toWei(100000000);
  
  beforeEach(async function() {
    // Get signers
    [deployer, admin, pauser, minter, user1, user2, unauthorized] = await ethers.getSigners();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      NAME,
      SYMBOL,
      INITIAL_SUPPLY,
      DECIMALS,
      MAX_SUPPLY,
      admin.address
    );
    
    // Setup initial roles (in addition to those set in constructor)
    await dloopToken.connect(deployer).grantRole(MINTER_ROLE, minter.address);
    await dloopToken.connect(deployer).grantRole(PAUSER_ROLE, pauser.address);
  });
  
  describe("1. Role-Based Minting Controls", function() {
    it("1.1 Should only allow minters to mint tokens", async function() {
      const mintAmount = toWei(1000);
      
      // Unauthorized attempt
      await expect(
        dloopToken.connect(unauthorized).mint(user1.address, mintAmount)
      ).to.be.revertedWith("AccessControl");
      
      // Admin attempt (without minter role)
      await expect(
        dloopToken.connect(admin).mint(user1.address, mintAmount)
      ).to.be.revertedWith("AccessControl");
      
      // Authorized minting
      await dloopToken.connect(minter).mint(user1.address, mintAmount);
      
      // Verify minting worked
      const balance = await dloopToken.balanceOf(user1.address);
      expect(balance).to.equal(mintAmount);
    });
    
    it("1.2 Should enforce max supply limit", async function() {
      // Try to mint more than max supply
      const excessiveAmount = MAX_SUPPLY.sub(INITIAL_SUPPLY).add(toWei(1));
      
      await expect(
        dloopToken.connect(minter).mint(user1.address, excessiveAmount)
      ).to.be.revertedWith("Would exceed max supply");
      
      // Mint exactly up to max supply
      const remainingAmount = MAX_SUPPLY.sub(INITIAL_SUPPLY);
      await dloopToken.connect(minter).mint(user1.address, remainingAmount);
      
      // Verify total supply is at max
      const totalSupply = await dloopToken.totalSupply();
      expect(totalSupply).to.equal(MAX_SUPPLY);
      
      // Try to mint 1 more token
      await expect(
        dloopToken.connect(minter).mint(user1.address, toWei(1))
      ).to.be.revertedWith("Would exceed max supply");
    });
    
    it("1.3 Should handle multiple minters properly", async function() {
      // Grant minter role to user1
      await dloopToken.connect(deployer).grantRole(MINTER_ROLE, user1.address);
      
      // Mint from first minter
      await dloopToken.connect(minter).mint(user2.address, toWei(1000));
      
      // Mint from second minter
      await dloopToken.connect(user1).mint(user2.address, toWei(2000));
      
      // Verify total minted amount
      const balance = await dloopToken.balanceOf(user2.address);
      expect(balance).to.equal(toWei(3000));
    });
    
    it("1.4 Should emit Transfer event when minting", async function() {
      const mintAmount = toWei(1000);
      const mintTx = await dloopToken.connect(minter).mint(user1.address, mintAmount);
      const receipt = await mintTx.wait();
      
      // Check for Transfer event (from zero address)
      const transferEvents = receipt.events.filter(e => e.event === 'Transfer');
      expect(transferEvents.length).to.be.above(0);
      
      const transferEvent = transferEvents[0];
      expect(transferEvent.args.from).to.equal(ethers.constants.AddressZero);
      expect(transferEvent.args.to).to.equal(user1.address);
      expect(transferEvent.args.value).to.equal(mintAmount);
    });
  });
  
  describe("2. Pause/Unpause Security Controls", function() {
    it("2.1 Should only allow pausers to pause the token", async function() {
      // Unauthorized attempt
      await expect(
        dloopToken.connect(unauthorized).pause()
      ).to.be.revertedWith("AccessControl");
      
      // Admin attempt (without pauser role)
      await expect(
        dloopToken.connect(admin).pause()
      ).to.be.revertedWith("AccessControl");
      
      // Authorized pausing
      await dloopToken.connect(pauser).pause();
      
      // Verify token is paused
      const isPaused = await dloopToken.paused();
      expect(isPaused).to.be.true;
    });
    
    it("2.2 Should only allow pausers to unpause the token", async function() {
      // Pause the token first
      await dloopToken.connect(pauser).pause();
      
      // Unauthorized attempt to unpause
      await expect(
        dloopToken.connect(unauthorized).unpause()
      ).to.be.revertedWith("AccessControl");
      
      // Authorized unpausing
      await dloopToken.connect(pauser).unpause();
      
      // Verify token is unpaused
      const isPaused = await dloopToken.paused();
      expect(isPaused).to.be.false;
    });
    
    it("2.3 Should prevent transfers when paused", async function() {
      // Give tokens to user1
      await dloopToken.connect(deployer).transfer(user1.address, toWei(1000));
      
      // Pause the token
      await dloopToken.connect(pauser).pause();
      
      // Try to transfer while paused
      await expect(
        dloopToken.connect(user1).transfer(user2.address, toWei(100))
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
      
      // Unpause the token
      await dloopToken.connect(pauser).unpause();
      
      // Transfer should work now
      await dloopToken.connect(user1).transfer(user2.address, toWei(100));
      
      // Verify transfer worked
      const balance = await dloopToken.balanceOf(user2.address);
      expect(balance).to.equal(toWei(100));
    });
    
    it("2.4 Should prevent approve operations when paused", async function() {
      // Pause the token
      await dloopToken.connect(pauser).pause();
      
      // Try to approve while paused
      await expect(
        dloopToken.connect(user1).approve(user2.address, toWei(100))
      ).to.be.revertedWith("ERC20Pausable: token transfer while paused");
      
      // Unpause the token
      await dloopToken.connect(pauser).unpause();
      
      // Approve should work now
      await dloopToken.connect(user1).approve(user2.address, toWei(100));
      
      // Verify approval worked
      const allowance = await dloopToken.allowance(user1.address, user2.address);
      expect(allowance).to.equal(toWei(100));
    });
  });
  
  describe("3. Role Transition Security", function() {
    it("3.1 Should allow admin to grant roles", async function() {
      // Admin grants minter role to user1
      await dloopToken.connect(admin).grantRole(MINTER_ROLE, user1.address);
      
      // Verify role was granted
      const hasMinterRole = await dloopToken.hasRole(MINTER_ROLE, user1.address);
      expect(hasMinterRole).to.be.true;
      
      // User1 should now be able to mint
      await dloopToken.connect(user1).mint(user2.address, toWei(1000));
    });
    
    it("3.2 Should allow admin to revoke roles", async function() {
      // Verify minter has role initially
      const hasMinterRoleBefore = await dloopToken.hasRole(MINTER_ROLE, minter.address);
      expect(hasMinterRoleBefore).to.be.true;
      
      // Admin revokes minter role
      await dloopToken.connect(admin).revokeRole(MINTER_ROLE, minter.address);
      
      // Verify role was revoked
      const hasMinterRoleAfter = await dloopToken.hasRole(MINTER_ROLE, minter.address);
      expect(hasMinterRoleAfter).to.be.false;
      
      // Minter should no longer be able to mint
      await expect(
        dloopToken.connect(minter).mint(user1.address, toWei(1000))
      ).to.be.revertedWith("AccessControl");
    });
    
    it("3.3 Should prevent unauthorized role grants", async function() {
      // Unauthorized attempt to grant role
      await expect(
        dloopToken.connect(unauthorized).grantRole(MINTER_ROLE, user1.address)
      ).to.be.revertedWith("AccessControl");
      
      // User with minter role can't grant minter role
      await expect(
        dloopToken.connect(minter).grantRole(MINTER_ROLE, user1.address)
      ).to.be.revertedWith("AccessControl");
    });
    
    it("3.4 Should allow changing admin role", async function() {
      // Admin gives admin role to user1
      await dloopToken.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, user1.address);
      
      // User1 grants minter role to user2
      await dloopToken.connect(user1).grantRole(MINTER_ROLE, user2.address);
      
      // Verify user2 has minter role
      const hasMinterRole = await dloopToken.hasRole(MINTER_ROLE, user2.address);
      expect(hasMinterRole).to.be.true;
    });
    
    it("3.5 Should allow renouncing roles", async function() {
      // Minter renounces their role
      await dloopToken.connect(minter).renounceRole(MINTER_ROLE, minter.address);
      
      // Verify role was renounced
      const hasMinterRole = await dloopToken.hasRole(MINTER_ROLE, minter.address);
      expect(hasMinterRole).to.be.false;
      
      // Should no longer be able to mint
      await expect(
        dloopToken.connect(minter).mint(user1.address, toWei(1000))
      ).to.be.revertedWith("AccessControl");
    });
  });
  
  describe("4. Standard ERC20 Approvals", function() {
    beforeEach(async function() {
      // Transfer tokens to user1 for approval testing
      await dloopToken.connect(deployer).transfer(user1.address, toWei(10000));
    });
    
    it("4.1 Should handle standard approvals correctly", async function() {
      const approvalAmount = toWei(1000);
      
      // Approve user2 to spend tokens
      await dloopToken.connect(user1).approve(user2.address, approvalAmount);
      
      // Check allowance
      const allowance = await dloopToken.allowance(user1.address, user2.address);
      expect(allowance).to.equal(approvalAmount);
    });
    
    it("4.2 Should allow transferFrom after approval", async function() {
      const approvalAmount = toWei(1000);
      const transferAmount = toWei(500);
      
      // Approve user2 to spend tokens
      await dloopToken.connect(user1).approve(user2.address, approvalAmount);
      
      // User2 transfers from user1 to themselves
      await dloopToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount);
      
      // Check balances
      const user1Balance = await dloopToken.balanceOf(user1.address);
      const user2Balance = await dloopToken.balanceOf(user2.address);
      expect(user1Balance).to.equal(toWei(10000).sub(transferAmount));
      expect(user2Balance).to.equal(transferAmount);
      
      // Check remaining allowance
      const remainingAllowance = await dloopToken.allowance(user1.address, user2.address);
      expect(remainingAllowance).to.equal(approvalAmount.sub(transferAmount));
    });
    
    it("4.3 Should prevent transferFrom without approval", async function() {
      // Try to transferFrom without approval
      await expect(
        dloopToken.connect(user2).transferFrom(user1.address, user2.address, toWei(100))
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
    
    it("4.4 Should handle increaseAllowance correctly", async function() {
      const initialApproval = toWei(1000);
      const increaseAmount = toWei(500);
      
      // Initial approval
      await dloopToken.connect(user1).approve(user2.address, initialApproval);
      
      // Increase allowance
      await dloopToken.connect(user1).increaseAllowance(user2.address, increaseAmount);
      
      // Check new allowance
      const newAllowance = await dloopToken.allowance(user1.address, user2.address);
      expect(newAllowance).to.equal(initialApproval.add(increaseAmount));
    });
    
    it("4.5 Should handle decreaseAllowance correctly", async function() {
      const initialApproval = toWei(1000);
      const decreaseAmount = toWei(300);
      
      // Initial approval
      await dloopToken.connect(user1).approve(user2.address, initialApproval);
      
      // Decrease allowance
      await dloopToken.connect(user1).decreaseAllowance(user2.address, decreaseAmount);
      
      // Check new allowance
      const newAllowance = await dloopToken.allowance(user1.address, user2.address);
      expect(newAllowance).to.equal(initialApproval.sub(decreaseAmount));
    });
  });
  
  describe("5. Token decimals and metadata", function() {
    it("5.1 Should return correct token decimals", async function() {
      const decimals = await dloopToken.decimals();
      expect(decimals).to.equal(DECIMALS);
    });
    
    it("5.2 Should return correct token name and symbol", async function() {
      const name = await dloopToken.name();
      const symbol = await dloopToken.symbol();
      
      expect(name).to.equal(NAME);
      expect(symbol).to.equal(SYMBOL);
    });
    
    it("5.3 Should return correct max supply", async function() {
      const maxSupply = await dloopToken.MAX_SUPPLY();
      expect(maxSupply).to.equal(MAX_SUPPLY);
    });
  });
  
  describe("6. Backward Compatibility", function() {
    let mockLegacyConsumer;
    
    beforeEach(async function() {
      // Deploy mock legacy consumer
      const MockLegacyConsumer = await ethers.getContractFactory("MockLegacyConsumer");
      mockLegacyConsumer = await MockLegacyConsumer.deploy();
      
      // Transfer tokens to user1 
      await dloopToken.connect(deployer).transfer(user1.address, toWei(10000));
      
      // Approve tokens for legacy consumer
      await dloopToken.connect(user1).approve(mockLegacyConsumer.address, toWei(5000));
    });
    
    it("6.1 Should be compatible with legacy contract interactions", async function() {
      const transferAmount = toWei(1000);
      
      // Use legacy consumer to transfer tokens
      await mockLegacyConsumer.connect(user1).executeTransfer(
        dloopToken.address,
        user1.address,
        user2.address,
        transferAmount
      );
      
      // Verify transfer worked
      const user2Balance = await dloopToken.balanceOf(user2.address);
      expect(user2Balance).to.equal(transferAmount);
    });
    
    it("6.2 Should be compatible with legacy allowance checks", async function() {
      const checkAmount = toWei(5000);
      
      // Check if allowance is sufficient using legacy consumer
      const isAllowanceSufficient = await mockLegacyConsumer.checkAllowance(
        dloopToken.address,
        user1.address,
        mockLegacyConsumer.address,
        checkAmount
      );
      
      expect(isAllowanceSufficient).to.be.true;
    });
    
    it("6.3 Should be compatible with legacy pausing mechanisms", async function() {
      // Pause the token
      await dloopToken.connect(pauser).pause();
      
      // Check if token is paused using legacy consumer
      const isPaused = await mockLegacyConsumer.checkIfPaused(dloopToken.address);
      expect(isPaused).to.be.true;
      
      // Unpause the token
      await dloopToken.connect(pauser).unpause();
      
      // Check if token is unpaused
      const isUnpaused = await mockLegacyConsumer.checkIfPaused(dloopToken.address);
      expect(isUnpaused).to.be.false;
    });
  });
});