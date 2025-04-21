// SPDX-License-Identifier: MIT
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Hedera Bridge Security Tests", function () {
  let dloopToken;
  let hederaBridge;
  
  let deployer, user1, user2, user3, maliciousUser;
  let validator1, validator2, validator3, validatorAttacker;
  
  const VALIDATOR_THRESHOLD = 2; // 2/3 validators needed
  const MAX_TRANSFER_AMOUNT = ethers.utils.parseEther("100"); // 100 tokens
  const TIMELOCK_PERIOD = 86400; // 24 hours
  
  before(async function () {
    [
      deployer, 
      user1, 
      user2, 
      user3, 
      maliciousUser, 
      validator1, 
      validator2, 
      validator3, 
      validatorAttacker
    ] = await ethers.getSigners();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("DLOOP", "DLOOP");
    await dloopToken.deployed();
    
    // Mint tokens to users for testing
    const initialBalance = ethers.utils.parseEther("1000000");
    await dloopToken.mint(deployer.address, initialBalance);
    await dloopToken.mint(user1.address, initialBalance);
    await dloopToken.mint(user2.address, initialBalance);
    await dloopToken.mint(user3.address, initialBalance);
    await dloopToken.mint(maliciousUser.address, initialBalance);
    
    // Deploy HederaBridge
    const validators = [validator1.address, validator2.address, validator3.address];
    const HederaBridge = await ethers.getContractFactory("HederaBridge");
    hederaBridge = await HederaBridge.deploy(
      dloopToken.address,
      validators,
      VALIDATOR_THRESHOLD,
      MAX_TRANSFER_AMOUNT,
      TIMELOCK_PERIOD
    );
    await hederaBridge.deployed();
    
    // Grant roles and permissions
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), hederaBridge.address);
    
    // Approve tokens for testing
    await dloopToken.connect(user1).approve(hederaBridge.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user2).approve(hederaBridge.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user3).approve(hederaBridge.address, ethers.constants.MaxUint256);
    await dloopToken.connect(maliciousUser).approve(hederaBridge.address, ethers.constants.MaxUint256);
  });

  describe("1. Validator Threshold Security", function () {
    it("should prevent transfers with insufficient validator approvals", async function () {
      const transferAmount = ethers.utils.parseEther("10");
      const hederaReceiver = "0.0.12345"; // Hedera account ID
      
      // Lock tokens for transfer
      await hederaBridge.connect(user1).lockTokens(transferAmount, hederaReceiver);
      
      // Get the transfer ID
      const transferId = 1; // First transfer
      
      // For incoming transfers from Hedera to Ethereum
      const incomingTransferId = 101; // Using different ID range for incoming transfers
      const incomingAmount = ethers.utils.parseEther("5");
      const ethereumReceiver = user2.address;
      const hederaSender = "0.0.67890";
      
      // Single validator approves - shouldn't release tokens
      await hederaBridge.connect(validator1).approveTransfer(
        incomingTransferId,
        incomingAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Check that tokens are not released yet
      const receiverBalance = await dloopToken.balanceOf(ethereumReceiver);
      expect(receiverBalance).to.equal(ethers.utils.parseEther("1000000")); // Initial balance unchanged
      
      // Check transfer status
      const transferStatus = await hederaBridge.getTransferApprovalCount(incomingTransferId);
      expect(transferStatus).to.equal(1); // 1 approval out of 2 required
    });
    
    it("should prevent approval from non-validators", async function () {
      const incomingTransferId = 102;
      const incomingAmount = ethers.utils.parseEther("5");
      const ethereumReceiver = user2.address;
      const hederaSender = "0.0.67890";
      
      // Attempt to approve as non-validator should revert
      await expect(
        hederaBridge.connect(maliciousUser).approveTransfer(
          incomingTransferId,
          incomingAmount,
          ethereumReceiver,
          hederaSender
        )
      ).to.be.reverted;
      
      // Also try with validator attacker
      await expect(
        hederaBridge.connect(validatorAttacker).approveTransfer(
          incomingTransferId,
          incomingAmount,
          ethereumReceiver,
          hederaSender
        )
      ).to.be.reverted;
    });
    
    it("should prevent duplicate approvals from the same validator", async function () {
      const incomingTransferId = 103;
      const incomingAmount = ethers.utils.parseEther("5");
      const ethereumReceiver = user2.address;
      const hederaSender = "0.0.67890";
      
      // First approval works
      await hederaBridge.connect(validator1).approveTransfer(
        incomingTransferId,
        incomingAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Second approval from same validator should fail
      await expect(
        hederaBridge.connect(validator1).approveTransfer(
          incomingTransferId,
          incomingAmount,
          ethereumReceiver,
          hederaSender
        )
      ).to.be.revertedWith("Validator has already approved this transfer");
      
      // Check transfer status
      const transferStatus = await hederaBridge.getTransferApprovalCount(incomingTransferId);
      expect(transferStatus).to.equal(1); // Still just 1 approval
    });
    
    it("should successfully process transfer with sufficient validator approvals", async function () {
      const incomingTransferId = 104;
      const incomingAmount = ethers.utils.parseEther("5");
      const ethereumReceiver = user3.address;
      const hederaSender = "0.0.67890";
      
      // Initial receiver balance
      const initialBalance = await dloopToken.balanceOf(ethereumReceiver);
      
      // First validator approves
      await hederaBridge.connect(validator1).approveTransfer(
        incomingTransferId,
        incomingAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Second validator approves - should reach threshold
      await hederaBridge.connect(validator2).approveTransfer(
        incomingTransferId,
        incomingAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Check that tokens are now transferred
      const finalBalance = await dloopToken.balanceOf(ethereumReceiver);
      expect(finalBalance).to.equal(initialBalance.add(incomingAmount));
      
      // Check transfer status shows it's completed
      const transferStatus = await hederaBridge.isTransferCompleted(incomingTransferId);
      expect(transferStatus).to.be.true;
    });
  });

  describe("2. Transfer Amount Limits & Timelock", function () {
    it("should allow transfers below the maximum amount threshold", async function () {
      const transferAmount = ethers.utils.parseEther("50"); // Below 100 max
      const hederaReceiver = "0.0.12345";
      
      // Initial sender balance
      const initialBalance = await dloopToken.balanceOf(user1.address);
      
      // Lock tokens for transfer
      await hederaBridge.connect(user1).lockTokens(transferAmount, hederaReceiver);
      
      // Check that tokens are now locked in bridge
      const finalBalance = await dloopToken.balanceOf(user1.address);
      expect(finalBalance).to.equal(initialBalance.sub(transferAmount));
      
      // Check bridge balance
      const bridgeBalance = await dloopToken.balanceOf(hederaBridge.address);
      expect(bridgeBalance).to.be.gte(transferAmount);
    });
    
    it("should place large transfers in timelock", async function () {
      const transferAmount = MAX_TRANSFER_AMOUNT.add(ethers.utils.parseEther("1")); // 101 tokens
      const hederaReceiver = "0.0.12345";
      
      // Initial sender balance
      const initialBalance = await dloopToken.balanceOf(user2.address);
      
      // Lock tokens for large transfer
      await hederaBridge.connect(user2).lockTokens(transferAmount, hederaReceiver);
      
      // Check that tokens are now locked in bridge
      const finalBalance = await dloopToken.balanceOf(user2.address);
      expect(finalBalance).to.equal(initialBalance.sub(transferAmount));
      
      // Check transfer is in timelock
      const transferId = 3; // Third transfer
      const transfer = await hederaBridge.transfers(transferId);
      expect(transfer.amount).to.equal(transferAmount);
      expect(transfer.isTimelocked).to.be.true;
      
      // Should have a release time in the future
      expect(transfer.timelockReleaseTime).to.be.gt(await time.latest());
    });
    
    it("should block execution of timelocked transfer before release time", async function () {
      const transferId = 3; // The timelocked transfer from previous test
      
      // Try to execute before timelock period
      await expect(
        hederaBridge.connect(user2).executeTimelockTransfer(transferId)
      ).to.be.revertedWith("Transfer is still timelocked");
    });
    
    it("should allow execution of timelocked transfer after release time", async function () {
      const transferId = 3; // The timelocked transfer from previous test
      
      // Get the transfer details
      const transfer = await hederaBridge.transfers(transferId);
      
      // Advance time past the timelock release time
      await time.increaseTo(transfer.timelockReleaseTime.add(1));
      
      // Now execution should succeed
      await hederaBridge.connect(user2).executeTimelockTransfer(transferId);
      
      // Check transfer is marked as executed
      const updatedTransfer = await hederaBridge.transfers(transferId);
      expect(updatedTransfer.executed).to.be.true;
    });
    
    it("should prevent cancellation of regular transfers by non-owner", async function () {
      const transferAmount = ethers.utils.parseEther("10");
      const hederaReceiver = "0.0.12345";
      
      // Create regular transfer
      await hederaBridge.connect(user3).lockTokens(transferAmount, hederaReceiver);
      const transferId = 4; // Fourth transfer
      
      // Try to cancel as non-owner
      await expect(
        hederaBridge.connect(maliciousUser).cancelTransfer(transferId)
      ).to.be.revertedWith("Only the transfer sender or bridge admin can cancel");
    });
    
    it("should allow cancellation by the sender", async function () {
      const transferAmount = ethers.utils.parseEther("10");
      const hederaReceiver = "0.0.12345";
      
      // Initial balance
      const initialBalance = await dloopToken.balanceOf(user3.address);
      
      // Create regular transfer
      await hederaBridge.connect(user3).lockTokens(transferAmount, hederaReceiver);
      const transferId = 5; // Fifth transfer
      
      // Current balance after locking
      const lockedBalance = await dloopToken.balanceOf(user3.address);
      expect(lockedBalance).to.equal(initialBalance.sub(transferAmount));
      
      // Cancel the transfer by sender
      await hederaBridge.connect(user3).cancelTransfer(transferId);
      
      // Balance should be restored
      const finalBalance = await dloopToken.balanceOf(user3.address);
      expect(finalBalance).to.equal(initialBalance);
      
      // Transfer should be marked as cancelled
      const transfer = await hederaBridge.transfers(transferId);
      expect(transfer.cancelled).to.be.true;
    });
  });

  describe("3. Malicious Attack Scenarios", function () {
    it("should prevent front-running validator approvals", async function () {
      // Create two conflicting transfers with same ID but different recipients
      const incomingTransferId = 200;
      const incomingAmount = ethers.utils.parseEther("5");
      const legitReceiver = user1.address;
      const fakeReceiver = maliciousUser.address;
      const hederaSender = "0.0.67890";
      
      // Initial balances
      const initialLegitBalance = await dloopToken.balanceOf(legitReceiver);
      const initialFakeBalance = await dloopToken.balanceOf(fakeReceiver);
      
      // First validator approves the legit transfer
      await hederaBridge.connect(validator1).approveTransfer(
        incomingTransferId,
        incomingAmount,
        legitReceiver,
        hederaSender
      );
      
      // Attacker tries to get approval for a different recipient with same ID
      // This should fail as parameters don't match the first approval
      await expect(
        hederaBridge.connect(validator2).approveTransfer(
          incomingTransferId,
          incomingAmount,
          fakeReceiver, // Different recipient
          hederaSender
        )
      ).to.be.revertedWith("Transfer parameters do not match previous approvals");
      
      // Third validator correctly approves the original transfer
      await hederaBridge.connect(validator3).approveTransfer(
        incomingTransferId,
        incomingAmount,
        legitReceiver, // Same as first approval
        hederaSender
      );
      
      // Verify only legitimate recipient got the tokens
      const finalLegitBalance = await dloopToken.balanceOf(legitReceiver);
      const finalFakeBalance = await dloopToken.balanceOf(fakeReceiver);
      
      expect(finalLegitBalance).to.equal(initialLegitBalance.add(incomingAmount));
      expect(finalFakeBalance).to.equal(initialFakeBalance); // Unchanged
    });
    
    it("should prevent replay attacks with used transfer IDs", async function () {
      // Try to reuse a completed transfer ID
      const completedTransferId = 200; // From previous test
      const incomingAmount = ethers.utils.parseEther("5");
      const receiver = user2.address;
      const hederaSender = "0.0.67890";
      
      // This should fail since the transfer ID was already used
      await expect(
        hederaBridge.connect(validator1).approveTransfer(
          completedTransferId,
          incomingAmount,
          receiver,
          hederaSender
        )
      ).to.be.revertedWith("Transfer already completed");
    });
    
    it("should handle multiple simultaneous transfers safely", async function () {
      // Create three different transfers simultaneously
      const transfer1Id = 301;
      const transfer2Id = 302;
      const transfer3Id = 303;
      
      const amount = ethers.utils.parseEther("1");
      
      const receiver1 = user1.address;
      const receiver2 = user2.address;
      const receiver3 = user3.address;
      
      const hederaSender = "0.0.55555";
      
      // Initial balances
      const initialBalance1 = await dloopToken.balanceOf(receiver1);
      const initialBalance2 = await dloopToken.balanceOf(receiver2);
      const initialBalance3 = await dloopToken.balanceOf(receiver3);
      
      // Validator 1 approves all three
      await Promise.all([
        hederaBridge.connect(validator1).approveTransfer(transfer1Id, amount, receiver1, hederaSender),
        hederaBridge.connect(validator1).approveTransfer(transfer2Id, amount, receiver2, hederaSender),
        hederaBridge.connect(validator1).approveTransfer(transfer3Id, amount, receiver3, hederaSender)
      ]);
      
      // Validator 2 approves all three (reaching threshold)
      await Promise.all([
        hederaBridge.connect(validator2).approveTransfer(transfer1Id, amount, receiver1, hederaSender),
        hederaBridge.connect(validator2).approveTransfer(transfer2Id, amount, receiver2, hederaSender),
        hederaBridge.connect(validator2).approveTransfer(transfer3Id, amount, receiver3, hederaSender)
      ]);
      
      // Check all transfers completed correctly
      const finalBalance1 = await dloopToken.balanceOf(receiver1);
      const finalBalance2 = await dloopToken.balanceOf(receiver2);
      const finalBalance3 = await dloopToken.balanceOf(receiver3);
      
      expect(finalBalance1).to.equal(initialBalance1.add(amount));
      expect(finalBalance2).to.equal(initialBalance2.add(amount));
      expect(finalBalance3).to.equal(initialBalance3.add(amount));
      
      // Verify all transfers are marked complete
      expect(await hederaBridge.isTransferCompleted(transfer1Id)).to.be.true;
      expect(await hederaBridge.isTransferCompleted(transfer2Id)).to.be.true;
      expect(await hederaBridge.isTransferCompleted(transfer3Id)).to.be.true;
    });
  });

  describe("4. Admin Controls and Emergency Functions", function () {
    it("should allow admin to pause bridge operations in emergency", async function () {
      // Only bridge admin can pause
      await hederaBridge.connect(deployer).pauseBridge();
      
      // Verify bridge is paused
      expect(await hederaBridge.paused()).to.be.true;
      
      // Transfers should be rejected while paused
      const transferAmount = ethers.utils.parseEther("1");
      const hederaReceiver = "0.0.12345";
      
      await expect(
        hederaBridge.connect(user1).lockTokens(transferAmount, hederaReceiver)
      ).to.be.revertedWith("Bridge is paused");
      
      // Approvals should also be rejected
      const incomingTransferId = 400;
      const receiver = user1.address;
      const hederaSender = "0.0.67890";
      
      await expect(
        hederaBridge.connect(validator1).approveTransfer(
          incomingTransferId,
          transferAmount,
          receiver,
          hederaSender
        )
      ).to.be.revertedWith("Bridge is paused");
    });
    
    it("should allow admin to unpause bridge operations", async function () {
      // Admin unpauses the bridge
      await hederaBridge.connect(deployer).unpauseBridge();
      
      // Verify bridge is unpaused
      expect(await hederaBridge.paused()).to.be.false;
      
      // Transfers should work again
      const transferAmount = ethers.utils.parseEther("1");
      const hederaReceiver = "0.0.12345";
      
      // This should succeed now
      await hederaBridge.connect(user1).lockTokens(transferAmount, hederaReceiver);
      
      // Verify transfer was created
      const transferId = 6; // Sixth transfer
      const transfer = await hederaBridge.transfers(transferId);
      expect(transfer.amount).to.equal(transferAmount);
    });
    
    it("should allow admin to update validator set", async function () {
      // Get current validators
      const validator1IsValidator = await hederaBridge.isValidator(validator1.address);
      const validatorAttackerIsValidator = await hederaBridge.isValidator(validatorAttacker.address);
      
      expect(validator1IsValidator).to.be.true;
      expect(validatorAttackerIsValidator).to.be.false;
      
      // Admin adds a new validator
      await hederaBridge.connect(deployer).addValidator(validatorAttacker.address);
      
      // Admin removes an existing validator
      await hederaBridge.connect(deployer).removeValidator(validator3.address);
      
      // Check validator status after updates
      expect(await hederaBridge.isValidator(validatorAttacker.address)).to.be.true;
      expect(await hederaBridge.isValidator(validator3.address)).to.be.false;
      
      // Verify new validator can approve transfers
      const incomingTransferId = 401;
      const incomingAmount = ethers.utils.parseEther("1");
      const receiver = user2.address;
      const hederaSender = "0.0.67890";
      
      // New validator approval should work
      await hederaBridge.connect(validatorAttacker).approveTransfer(
        incomingTransferId,
        incomingAmount,
        receiver,
        hederaSender
      );
      
      // Check that approval was recorded
      expect(await hederaBridge.getTransferApprovalCount(incomingTransferId)).to.equal(1);
      
      // Removed validator approval should fail
      await expect(
        hederaBridge.connect(validator3).approveTransfer(
          incomingTransferId,
          incomingAmount,
          receiver,
          hederaSender
        )
      ).to.be.reverted;
    });
    
    it("should allow admin to update threshold", async function () {
      // Check current threshold
      expect(await hederaBridge.validatorThreshold()).to.equal(VALIDATOR_THRESHOLD);
      
      // Update threshold to 3
      const newThreshold = 3;
      await hederaBridge.connect(deployer).updateValidatorThreshold(newThreshold);
      
      // Check updated threshold
      expect(await hederaBridge.validatorThreshold()).to.equal(newThreshold);
      
      // Test that transfers now require 3 validators
      const incomingTransferId = 402;
      const incomingAmount = ethers.utils.parseEther("1");
      const receiver = user3.address;
      const hederaSender = "0.0.67890";
      
      // Initial balance
      const initialBalance = await dloopToken.balanceOf(receiver);
      
      // 2 validators approve (not enough with new threshold)
      await hederaBridge.connect(validator1).approveTransfer(
        incomingTransferId,
        incomingAmount,
        receiver,
        hederaSender
      );
      
      await hederaBridge.connect(validator2).approveTransfer(
        incomingTransferId,
        incomingAmount,
        receiver,
        hederaSender
      );
      
      // Check that tokens are not released yet (need 3 validators now)
      let currentBalance = await dloopToken.balanceOf(receiver);
      expect(currentBalance).to.equal(initialBalance);
      
      // Third validator approves, now it should go through
      await hederaBridge.connect(validatorAttacker).approveTransfer(
        incomingTransferId,
        incomingAmount,
        receiver,
        hederaSender
      );
      
      // Check that tokens are now transferred
      currentBalance = await dloopToken.balanceOf(receiver);
      expect(currentBalance).to.equal(initialBalance.add(incomingAmount));
    });
  });
});