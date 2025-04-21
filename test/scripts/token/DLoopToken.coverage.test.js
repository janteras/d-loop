/**
 * @title DLoopToken Comprehensive Test Suite
 * @dev Comprehensive test suite for the DLoopToken contract with 100% coverage
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");
require('../../utils/ethers-v6-compat');

describe("DLoopToken - Comprehensive Coverage Tests", function() {
  // Test variables
  let owner, admin, minter, pauser, user1, user2;
  let dloopToken;
  
  // Constants
  const TOKEN_NAME = "DLoop Token";
  const TOKEN_SYMBOL = "DLOOP";
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const TOKEN_DECIMALS = 18;
  const MAX_SUPPLY = ethers.parseEther("10000000");
  
  beforeEach(async function() {
    // Get signers for testing
    [owner, admin, minter, pauser, user1, user2] = await ethers.getSigners();
    
    // Deploy DLoopToken contract
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      TOKEN_DECIMALS,
      MAX_SUPPLY,
      admin.address
    );
    
    // Grant roles for testing
    const MINTER_ROLE = await dloopToken.MINTER_ROLE();
    const PAUSER_ROLE = await dloopToken.PAUSER_ROLE();
    
    await dloopToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
    await dloopToken.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
    
    // Transfer some tokens to users for testing
    await dloopToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
    await dloopToken.connect(owner).transfer(user2.address, ethers.parseEther("5000"));
  });
  
  describe("Deployment", function() {
    it("Should set the correct token name and symbol", async function() {
      expect(await dloopToken.name()).to.equal(TOKEN_NAME);
      expect(await dloopToken.symbol()).to.equal(TOKEN_SYMBOL);
    });
    
    it("Should set the correct decimals", async function() {
      expect(await dloopToken.decimals()).to.equal(TOKEN_DECIMALS);
    });
    
    it("Should set the correct initial supply", async function() {
      expect(await dloopToken.totalSupply()).to.equal(INITIAL_SUPPLY);
    });
    
    it("Should set the correct max supply", async function() {
      expect(await dloopToken.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });
    
    it("Should assign initial balance to the owner", async function() {
      const ownerBalance = await dloopToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(INITIAL_SUPPLY - ethers.parseEther("15000"));
    });
    
    it("Should assign correct roles to the owner and admin", async function() {
      const DEFAULT_ADMIN_ROLE = await dloopToken.DEFAULT_ADMIN_ROLE();
      const MINTER_ROLE = await dloopToken.MINTER_ROLE();
      const PAUSER_ROLE = await dloopToken.PAUSER_ROLE();
      
      expect(await dloopToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await dloopToken.hasRole(MINTER_ROLE, owner.address)).to.be.true;
      expect(await dloopToken.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
      
      expect(await dloopToken.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await dloopToken.hasRole(MINTER_ROLE, admin.address)).to.be.true;
      expect(await dloopToken.hasRole(PAUSER_ROLE, admin.address)).to.be.true;
    });
  });
  
  describe("Minting", function() {
    it("Should allow minter to mint tokens", async function() {
      await dloopToken.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      expect(await dloopToken.balanceOf(user1.address)).to.equal(ethers.parseEther("11000"));
    });
    
    it("Should fail if non-minter tries to mint tokens", async function() {
      await expect(
        dloopToken.connect(user1).mint(user1.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });
    
    it("Should fail if minting would exceed max supply", async function() {
      const remainingSupply = MAX_SUPPLY - await dloopToken.totalSupply();
      await expect(
        dloopToken.connect(minter).mint(user1.address, remainingSupply + 1n)
      ).to.be.revertedWith("Would exceed max supply");
    });
  });
  
  describe("Burning", function() {
    it("Should allow users to burn their own tokens", async function() {
      const initialBalance = await dloopToken.balanceOf(user1.address);
      await dloopToken.connect(user1).burn(ethers.parseEther("1000"));
      expect(await dloopToken.balanceOf(user1.address)).to.equal(initialBalance - ethers.parseEther("1000"));
    });
    
    it("Should fail if user tries to burn more tokens than they have", async function() {
      const balance = await dloopToken.balanceOf(user1.address);
      await expect(
        dloopToken.connect(user1).burn(balance + 1n)
      ).to.be.reverted;
    });
  });
  
  describe("Pausing", function() {
    it("Should allow pauser to pause the token", async function() {
      await dloopToken.connect(pauser).pause();
      expect(await dloopToken.paused()).to.be.true;
    });
    
    it("Should fail if non-pauser tries to pause the token", async function() {
      await expect(
        dloopToken.connect(user1).pause()
      ).to.be.reverted;
    });
    
    it("Should prevent transfers when paused", async function() {
      await dloopToken.connect(pauser).pause();
      await expect(
        dloopToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
    
    it("Should allow pauser to unpause the token", async function() {
      await dloopToken.connect(pauser).pause();
      await dloopToken.connect(pauser).unpause();
      expect(await dloopToken.paused()).to.be.false;
    });
    
    it("Should fail if non-pauser tries to unpause the token", async function() {
      await dloopToken.connect(pauser).pause();
      await expect(
        dloopToken.connect(user1).unpause()
      ).to.be.reverted;
    });
    
    it("Should allow transfers after unpausing", async function() {
      await dloopToken.connect(pauser).pause();
      await dloopToken.connect(pauser).unpause();
      await dloopToken.connect(user1).transfer(user2.address, ethers.parseEther("100"));
      expect(await dloopToken.balanceOf(user2.address)).to.equal(ethers.parseEther("5100"));
    });
  });
  
  describe("Role Management", function() {
    it("Should allow admin to grant roles", async function() {
      const MINTER_ROLE = await dloopToken.MINTER_ROLE();
      await dloopToken.connect(admin).grantRole(MINTER_ROLE, user1.address);
      expect(await dloopToken.hasRole(MINTER_ROLE, user1.address)).to.be.true;
    });
    
    it("Should allow admin to revoke roles", async function() {
      const MINTER_ROLE = await dloopToken.MINTER_ROLE();
      await dloopToken.connect(admin).revokeRole(MINTER_ROLE, minter.address);
      expect(await dloopToken.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });
    
    it("Should fail if non-admin tries to grant roles", async function() {
      const MINTER_ROLE = await dloopToken.MINTER_ROLE();
      await expect(
        dloopToken.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.reverted;
    });
    
    it("Should fail if non-admin tries to revoke roles", async function() {
      const MINTER_ROLE = await dloopToken.MINTER_ROLE();
      await expect(
        dloopToken.connect(user1).revokeRole(MINTER_ROLE, minter.address)
      ).to.be.reverted;
    });
  });
  
  describe("ERC20 Standard Functionality", function() {
    it("Should allow transfers between accounts", async function() {
      await dloopToken.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
      expect(await dloopToken.balanceOf(user2.address)).to.equal(ethers.parseEther("6000"));
      expect(await dloopToken.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));
    });
    
    it("Should fail if sender doesn't have enough balance", async function() {
      await expect(
        dloopToken.connect(user1).transfer(user2.address, ethers.parseEther("20000"))
      ).to.be.reverted;
    });
    
    it("Should update allowances correctly", async function() {
      await dloopToken.connect(user1).approve(user2.address, ethers.parseEther("2000"));
      expect(await dloopToken.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("2000"));
    });
    
    it("Should allow transferFrom with allowance", async function() {
      await dloopToken.connect(user1).approve(user2.address, ethers.parseEther("2000"));
      await dloopToken.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("1000"));
      expect(await dloopToken.balanceOf(user2.address)).to.equal(ethers.parseEther("6000"));
      expect(await dloopToken.balanceOf(user1.address)).to.equal(ethers.parseEther("9000"));
      expect(await dloopToken.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("1000"));
    });
    
    it("Should fail transferFrom if allowance is insufficient", async function() {
      await dloopToken.connect(user1).approve(user2.address, ethers.parseEther("500"));
      await expect(
        dloopToken.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });
  });
  
  describe("Token Delegation", function() {
    it("Should allow users to delegate tokens", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("1000"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("1000"));
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(ethers.parseEther("1000"));
      
      const delegators = await dloopToken.getDelegators(user2.address);
      expect(delegators.length).to.equal(1);
      expect(delegators[0]).to.equal(user1.address);
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(1);
      expect(delegatees[0]).to.equal(user2.address);
    });
    
    it("Should allow users to delegate additional tokens", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("500"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("1500"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("1500"));
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(ethers.parseEther("1500"));
    });
    
    it("Should allow users to delegate to multiple addresses", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).delegateTokens(admin.address, ethers.parseEther("500"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("1000"));
      expect(await dloopToken.getDelegatedAmount(user1.address, admin.address)).to.equal(ethers.parseEther("500"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("1500"));
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(2);
      expect(delegatees).to.include(user2.address);
      expect(delegatees).to.include(admin.address);
    });
    
    it("Should allow multiple users to delegate to the same address", async function() {
      await dloopToken.connect(user1).delegateTokens(admin.address, ethers.parseEther("1000"));
      await dloopToken.connect(user2).delegateTokens(admin.address, ethers.parseEther("500"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, admin.address)).to.equal(ethers.parseEther("1000"));
      expect(await dloopToken.getDelegatedAmount(user2.address, admin.address)).to.equal(ethers.parseEther("500"));
      expect(await dloopToken.getTotalDelegatedToAmount(admin.address)).to.equal(ethers.parseEther("1500"));
      
      const delegators = await dloopToken.getDelegators(admin.address);
      expect(delegators.length).to.equal(2);
      expect(delegators).to.include(user1.address);
      expect(delegators).to.include(user2.address);
    });
    
    it("Should fail if delegating to zero address", async function() {
      await expect(
        dloopToken.connect(user1).delegateTokens(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot delegate to zero address");
    });
    
    it("Should fail if delegating to self", async function() {
      await expect(
        dloopToken.connect(user1).delegateTokens(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot delegate to self");
    });
    
    it("Should fail if delegating zero amount", async function() {
      await expect(
        dloopToken.connect(user1).delegateTokens(user2.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should fail if delegating more than available balance", async function() {
      const balance = await dloopToken.balanceOf(user1.address);
      await dloopToken.connect(user1).delegateTokens(user2.address, balance - ethers.parseEther("1000"));
      
      await expect(
        dloopToken.connect(user1).delegateTokens(admin.address, ethers.parseEther("2000"))
      ).to.be.revertedWith("Insufficient balance for delegation");
    });
    
    it("Should allow users to withdraw delegation", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("500"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("500"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("500"));
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(ethers.parseEther("500"));
    });
    
    it("Should remove delegation records when fully withdrawn", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("1000"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(0);
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(0);
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(0);
      
      const delegators = await dloopToken.getDelegators(user2.address);
      expect(delegators.length).to.equal(0);
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(0);
    });
    
    it("Should fail if withdrawing from zero address", async function() {
      await expect(
        dloopToken.connect(user1).withdrawDelegation(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot withdraw from zero address");
    });
    
    it("Should fail if withdrawing zero amount", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await expect(
        dloopToken.connect(user1).withdrawDelegation(user2.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should fail if withdrawing more than delegated", async function() {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await expect(
        dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("2000"))
      ).to.be.revertedWith("Insufficient delegated amount");
    });
    
    it("Should maintain correct delegation state with multiple operations", async function() {
      // User1 delegates to User2 and Admin
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).delegateTokens(admin.address, ethers.parseEther("500"));
      
      // User2 delegates to Admin
      await dloopToken.connect(user2).delegateTokens(admin.address, ethers.parseEther("300"));
      
      // User1 partially withdraws from User2
      await dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("400"));
      
      // Verify final state
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("600"));
      expect(await dloopToken.getDelegatedAmount(user1.address, admin.address)).to.equal(ethers.parseEther("500"));
      expect(await dloopToken.getDelegatedAmount(user2.address, admin.address)).to.equal(ethers.parseEther("300"));
      
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("1100"));
      expect(await dloopToken.getTotalDelegatedAmount(user2.address)).to.equal(ethers.parseEther("300"));
      
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(ethers.parseEther("600"));
      expect(await dloopToken.getTotalDelegatedToAmount(admin.address)).to.equal(ethers.parseEther("800"));
    });
  });
});
