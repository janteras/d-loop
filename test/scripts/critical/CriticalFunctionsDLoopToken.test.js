/**
 * @title Critical Functions Test for DLoopToken
 * @dev Comprehensive test suite for critical functions in the DLoopToken contract
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");

// Load ethers v6 compatibility layer
require("../../utils/ethers-v6-compat.js");

describe("DLoopToken - Critical Functions", function () {
  // Test variables
  let dloopToken;
  let owner;
  let admin;
  let minter;
  let pauser;
  let user1;
  let user2;
  let user3;
  
  // Token constants
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens
  const MAX_SUPPLY = ethers.parseEther("10000000"); // 10 million tokens
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, minter, pauser, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      INITIAL_SUPPLY,
      MAX_SUPPLY,
      owner.address,
      admin.address
    );
    
    // Grant roles
    const MINTER_ROLE = await dloopToken.MINTER_ROLE();
    const PAUSER_ROLE = await dloopToken.PAUSER_ROLE();
    
    await dloopToken.connect(owner).grantRole(MINTER_ROLE, minter.address);
    await dloopToken.connect(owner).grantRole(PAUSER_ROLE, pauser.address);
    
    // Transfer some tokens to users for testing
    await dloopToken.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
    await dloopToken.connect(owner).transfer(user2.address, ethers.parseEther("5000"));
  });
  
  describe("Critical Function: delegateTokens", function () {
    it("Should allow users to delegate tokens", async function () {
      const delegationAmount = ethers.parseEther("1000");
      
      await expect(dloopToken.connect(user1).delegateTokens(user2.address, delegationAmount))
        .to.emit(dloopToken, "TokensDelegated")
        .withArgs(user1.address, user2.address, delegationAmount);
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(delegationAmount);
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(delegationAmount);
      expect(await dloopToken.getTotalDelegatedToAmount(user2.address)).to.equal(delegationAmount);
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(1);
      expect(delegatees[0]).to.equal(user2.address);
      
      const delegators = await dloopToken.getDelegators(user2.address);
      expect(delegators.length).to.equal(1);
      expect(delegators[0]).to.equal(user1.address);
    });
    
    it("Should allow multiple delegations to different addresses", async function () {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).delegateTokens(user3.address, ethers.parseEther("2000"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("1000"));
      expect(await dloopToken.getDelegatedAmount(user1.address, user3.address)).to.equal(ethers.parseEther("2000"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("3000"));
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(2);
      expect(delegatees).to.include(user2.address);
      expect(delegatees).to.include(user3.address);
    });
    
    it("Should allow additional delegation to the same address", async function () {
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("1000"));
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("2000"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("3000"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("3000"));
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(1);
      expect(delegatees[0]).to.equal(user2.address);
    });
    
    it("Should revert if delegating to zero address", async function () {
      await expect(
        dloopToken.connect(user1).delegateTokens(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot delegate to zero address");
    });
    
    it("Should revert if delegating to self", async function () {
      await expect(
        dloopToken.connect(user1).delegateTokens(user1.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot delegate to self");
    });
    
    it("Should revert if delegating zero amount", async function () {
      await expect(
        dloopToken.connect(user1).delegateTokens(user2.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should revert if delegating more than available balance", async function () {
      const balance = await dloopToken.balanceOf(user1.address);
      
      await expect(
        dloopToken.connect(user1).delegateTokens(user2.address, balance + 1n)
      ).to.be.revertedWith("Insufficient balance for delegation");
    });
    
    it("Should revert if delegating more than available non-delegated balance", async function () {
      const balance = await dloopToken.balanceOf(user1.address);
      
      // First delegate most of the balance
      await dloopToken.connect(user1).delegateTokens(user2.address, balance - ethers.parseEther("1000"));
      
      // Try to delegate more than remaining non-delegated balance
      await expect(
        dloopToken.connect(user1).delegateTokens(user3.address, ethers.parseEther("2000"))
      ).to.be.revertedWith("Insufficient balance for delegation");
    });
  });
  
  describe("Critical Function: withdrawDelegation", function () {
    beforeEach(async function () {
      // Setup delegation for withdrawal tests
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("3000"));
      await dloopToken.connect(user1).delegateTokens(user3.address, ethers.parseEther("2000"));
    });
    
    it("Should allow users to withdraw delegation", async function () {
      const withdrawalAmount = ethers.parseEther("1000");
      
      await expect(dloopToken.connect(user1).withdrawDelegation(user2.address, withdrawalAmount))
        .to.emit(dloopToken, "DelegationWithdrawn")
        .withArgs(user1.address, user2.address, withdrawalAmount);
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(ethers.parseEther("2000"));
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("4000"));
    });
    
    it("Should remove delegation record when fully withdrawn", async function () {
      // Withdraw all delegation to user2
      await dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("3000"));
      
      expect(await dloopToken.getDelegatedAmount(user1.address, user2.address)).to.equal(0);
      expect(await dloopToken.getTotalDelegatedAmount(user1.address)).to.equal(ethers.parseEther("2000"));
      
      const delegatees = await dloopToken.getDelegatees(user1.address);
      expect(delegatees.length).to.equal(1);
      expect(delegatees[0]).to.equal(user3.address);
      
      const delegators = await dloopToken.getDelegators(user2.address);
      expect(delegators.length).to.equal(0);
    });
    
    it("Should revert if withdrawing from zero address", async function () {
      await expect(
        dloopToken.connect(user1).withdrawDelegation(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWith("Cannot withdraw from zero address");
    });
    
    it("Should revert if withdrawing zero amount", async function () {
      await expect(
        dloopToken.connect(user1).withdrawDelegation(user2.address, 0)
      ).to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should revert if withdrawing more than delegated", async function () {
      await expect(
        dloopToken.connect(user1).withdrawDelegation(user2.address, ethers.parseEther("4000"))
      ).to.be.revertedWith("Insufficient delegated amount");
    });
    
    it("Should revert if withdrawing from non-delegated address", async function () {
      await expect(
        dloopToken.connect(user1).withdrawDelegation(admin.address, ethers.parseEther("1000"))
      ).to.be.revertedWith("Insufficient delegated amount");
    });
  });
  
  describe("Critical Function: mint", function () {
    it("Should allow minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("10000");
      const initialSupply = await dloopToken.totalSupply();
      
      await expect(dloopToken.connect(minter).mint(user3.address, mintAmount))
        .to.emit(dloopToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user3.address, mintAmount);
      
      expect(await dloopToken.balanceOf(user3.address)).to.equal(mintAmount);
      expect(await dloopToken.totalSupply()).to.equal(initialSupply + mintAmount);
    });
    
    it("Should revert if non-minter tries to mint tokens", async function () {
      await expect(
        dloopToken.connect(user1).mint(user3.address, ethers.parseEther("10000"))
      ).to.be.reverted;
    });
    
    it("Should revert if minting would exceed max supply", async function () {
      const currentSupply = await dloopToken.totalSupply();
      const remainingSupply = MAX_SUPPLY - currentSupply;
      
      await expect(
        dloopToken.connect(minter).mint(user3.address, remainingSupply + 1n)
      ).to.be.revertedWith("Would exceed max supply");
    });
  });
  
  describe("Critical Function: burn", function () {
    it("Should allow users to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      const initialBalance = await dloopToken.balanceOf(user1.address);
      const initialSupply = await dloopToken.totalSupply();
      
      await expect(dloopToken.connect(user1).burn(burnAmount))
        .to.emit(dloopToken, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
      
      expect(await dloopToken.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
      expect(await dloopToken.totalSupply()).to.equal(initialSupply - burnAmount);
    });
    
    it("Should revert if user tries to burn more tokens than they have", async function () {
      const balance = await dloopToken.balanceOf(user1.address);
      
      await expect(
        dloopToken.connect(user1).burn(balance + 1n)
      ).to.be.reverted;
    });
    
    it("Should revert if user tries to burn tokens while having delegations", async function () {
      // First delegate some tokens
      await dloopToken.connect(user1).delegateTokens(user2.address, ethers.parseEther("5000"));
      
      // Try to burn more than available non-delegated balance
      const nonDelegatedBalance = await dloopToken.balanceOf(user1.address) - ethers.parseEther("5000");
      
      await expect(
        dloopToken.connect(user1).burn(nonDelegatedBalance + 1n)
      ).to.be.reverted;
    });
  });
});
