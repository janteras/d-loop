const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Enhanced Bridge Rate Limiting", function () {
  let admin, governance, relayer, user1, user2, user3, feeCollector;
  let mockToken, messageVerifier, tokenManager, hederaBridge;

  // Constants
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const RELAYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RELAYER_ROLE"));
  const ETHEREUM_CHAIN_ID = 1;
  const HEDERA_CHAIN_ID = 295;
  
  // Rate limiting parameters
  const MAX_TRANSFER_AMOUNT = ethers.utils.parseEther("1000");
  const DAILY_TRANSFER_LIMIT = ethers.utils.parseEther("5000");
  const LARGE_TRANSFER_THRESHOLD = ethers.utils.parseEther("500");
  const DEFAULT_COOLDOWN_PERIOD = 3600; // 1 hour in seconds
  
  // User-specific limits
  const USER_MAX_TRANSFER = ethers.utils.parseEther("200");
  const USER_DAILY_LIMIT = ethers.utils.parseEther("500");
  const USER_WEEKLY_LIMIT = ethers.utils.parseEther("2000");
  const USER_COOLDOWN_PERIOD = 1800; // 30 minutes in seconds

  beforeEach(async function () {
    // Get signers
    [admin, governance, relayer, user1, user2, user3, feeCollector] = await ethers.getSigners();

    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.deployed();

    // Deploy message verifier
    const MessageVerifier = await ethers.getContractFactory("MessageVerifier");
    messageVerifier = await MessageVerifier.deploy(admin.address, admin.address);
    await messageVerifier.deployed();

    // Add relayer to message verifier
    await messageVerifier.addRelayer(HEDERA_CHAIN_ID, relayer.address);

    // Deploy token manager
    const HederaTokenManager = await ethers.getContractFactory("HederaTokenManager");
    tokenManager = await HederaTokenManager.deploy(admin.address, admin.address);
    await tokenManager.deployed();

    // Deploy Hedera bridge
    const HederaBridge = await ethers.getContractFactory("HederaBridge");
    hederaBridge = await HederaBridge.deploy(
      admin.address,
      messageVerifier.address,
      tokenManager.address,
      feeCollector.address,
      ETHEREUM_CHAIN_ID
    );
    await hederaBridge.deployed();

    // Grant roles
    await messageVerifier.addBridge(hederaBridge.address);
    await tokenManager.addBridge(hederaBridge.address);
    await hederaBridge.grantRole(RELAYER_ROLE, relayer.address);
    await hederaBridge.grantRole(GOVERNANCE_ROLE, governance.address);

    // Add supported chain
    await hederaBridge.addSupportedChain(HEDERA_CHAIN_ID);

    // Set bridge limits
    await hederaBridge.connect(governance).setMaxTransferAmount(MAX_TRANSFER_AMOUNT);
    await hederaBridge.connect(governance).setDailyTransferLimit(DAILY_TRANSFER_LIMIT);
    await hederaBridge.connect(governance).setLargeTransferThreshold(LARGE_TRANSFER_THRESHOLD);
    await hederaBridge.connect(governance).setDefaultCooldownPeriod(DEFAULT_COOLDOWN_PERIOD);

    // Mint mock tokens to users
    await mockToken.mint(user1.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user3.address, ethers.utils.parseEther("10000"));
    
    // Set allowance for bridge
    await mockToken.connect(user1).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    await mockToken.connect(user2).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    await mockToken.connect(user3).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
  });

  describe("User-specific Rate Limiting", function () {
    it("Should configure user limits correctly", async function () {
      // Configure limits for user1
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        USER_DAILY_LIMIT,
        USER_WEEKLY_LIMIT,
        USER_COOLDOWN_PERIOD
      );
      
      // Check limits were set correctly
      const limits = await hederaBridge.getUserTransferLimits(user1.address);
      
      expect(limits.maxPerTransfer).to.equal(USER_MAX_TRANSFER);
      expect(limits.dailyLimit).to.equal(USER_DAILY_LIMIT);
      expect(limits.weeklyLimit).to.equal(USER_WEEKLY_LIMIT);
      expect(limits.isLimited).to.be.true;
    });
    
    it("Should remove user limits correctly", async function () {
      // Configure limits for user1
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        USER_DAILY_LIMIT,
        USER_WEEKLY_LIMIT,
        USER_COOLDOWN_PERIOD
      );
      
      // Remove limits
      await hederaBridge.connect(governance).removeUserLimits(user1.address);
      
      // Check limits were removed
      const limits = await hederaBridge.getUserTransferLimits(user1.address);
      expect(limits.isLimited).to.be.false;
    });
    
    it("Should enforce user max transfer limit", async function () {
      // Configure limits for user1
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        USER_DAILY_LIMIT,
        USER_WEEKLY_LIMIT,
        USER_COOLDOWN_PERIOD
      );
      
      // Try to transfer more than the user's max amount
      const amount = USER_MAX_TRANSFER.add(ethers.utils.parseEther("1"));
      
      // Transaction should be reverted with custom error
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserTransferLimit");
      
      // Transfer amount within user limit should succeed
      const validAmount = USER_MAX_TRANSFER;
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          validAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
    
    it("Should enforce user daily limit", async function () {
      // Configure limits for user1
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        USER_DAILY_LIMIT,
        USER_WEEKLY_LIMIT,
        USER_COOLDOWN_PERIOD
      );
      
      // Make multiple transfers to hit the daily limit
      const amount = ethers.utils.parseEther("100");
      const iterations = 5; // 5 * 100 = 500 (daily limit)
      
      for (let i = 0; i < iterations; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // The next transfer should fail due to daily limit
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
    });
    
    it("Should reset user daily limit after 24 hours", async function () {
      // Configure limits for user1
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        USER_DAILY_LIMIT,
        USER_WEEKLY_LIMIT,
        USER_COOLDOWN_PERIOD
      );
      
      // Make transfers to hit the daily limit
      const amount = ethers.utils.parseEther("100");
      const iterations = 5; // 5 * 100 = 500 (daily limit)
      
      for (let i = 0; i < iterations; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Fast forward time by 24 hours
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Should now be able to transfer again
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
    
    it("Should enforce weekly limit separately from daily limit", async function () {
      // Configure limits for user1 with a high daily limit but lower weekly limit
      const highDailyLimit = ethers.utils.parseEther("1000");
      const lowWeeklyLimit = ethers.utils.parseEther("1500"); // 3 days worth of transfers at 500/day
      
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        USER_MAX_TRANSFER,
        highDailyLimit,
        lowWeeklyLimit,
        USER_COOLDOWN_PERIOD
      );
      
      // Make transfers over multiple days to hit the weekly limit
      const amount = ethers.utils.parseEther("500");
      
      // Day 1: 500
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Advance to next day
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Day 2: 500 + 500 = 1000
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Advance to next day
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Day 3: 1000 + 500 = 1500 (weekly limit reached)
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // This should fail due to weekly limit
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserWeeklyLimit");
      
      // Advance to day 8 (new week)
      await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Should be able to transfer again in the new week
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
  });
  
  describe("Large Transfer Cooldown", function () {
    it("Should enforce cooldown period for large transfers", async function () {
      // Configure user limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("1000"), // High max amount
        ethers.utils.parseEther("2000"), // High daily limit
        ethers.utils.parseEther("5000"), // High weekly limit
        USER_COOLDOWN_PERIOD
      );
      
      // Make a large transfer (above threshold)
      const largeAmount = LARGE_TRANSFER_THRESHOLD.add(ethers.utils.parseEther("1"));
      
      // First transfer should succeed
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // Second large transfer should fail due to cooldown
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeCooldownPeriodNotMet");
      
      // Small transfer should still work during cooldown
      const smallAmount = LARGE_TRANSFER_THRESHOLD.sub(ethers.utils.parseEther("1"));
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          smallAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // Advance time past cooldown period
      await ethers.provider.send("evm_increaseTime", [USER_COOLDOWN_PERIOD]);
      await ethers.provider.send("evm_mine");
      
      // Large transfer should work again after cooldown
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
    
    it("Should use default cooldown when user cooldown is zero", async function () {
      // Configure user limits with zero cooldown (should use default)
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("1000"), // High max amount
        ethers.utils.parseEther("2000"), // High daily limit
        ethers.utils.parseEther("5000"), // High weekly limit
        0 // No cooldown, should use default
      );
      
      // Make a large transfer
      const largeAmount = LARGE_TRANSFER_THRESHOLD.add(ethers.utils.parseEther("1"));
      
      // First transfer should succeed
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // Second large transfer should fail due to default cooldown
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeCooldownPeriodNotMet");
      
      // Advance time past user cooldown but not default cooldown
      await ethers.provider.send("evm_increaseTime", [USER_COOLDOWN_PERIOD]);
      await ethers.provider.send("evm_mine");
      
      // Large transfer should still fail (default cooldown is longer)
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeCooldownPeriodNotMet");
      
      // Advance time past default cooldown
      await ethers.provider.send("evm_increaseTime", [DEFAULT_COOLDOWN_PERIOD - USER_COOLDOWN_PERIOD]);
      await ethers.provider.send("evm_mine");
      
      // Large transfer should work again after default cooldown
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
  });
  
  describe("User Transfer Tracking", function () {
    it("Should track daily transfer amounts correctly", async function () {
      // Make a transfer
      const amount = ethers.utils.parseEther("100");
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Check the daily transfer amount for today
      const today = Math.floor(Date.now() / 1000 / 86400); // Current day timestamp
      const dailyAmount = await hederaBridge.getUserDailyTransferAmount(user1.address, today);
      expect(dailyAmount).to.equal(amount);
      
      // Today's amount should match getUserTodayTransferAmount
      const todayAmount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(todayAmount).to.equal(amount);
      
      // Make another transfer
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Check that the daily amount has increased
      const updatedAmount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(updatedAmount).to.equal(amount.mul(2));
    });
    
    it("Should track transfer amounts separately for different users", async function () {
      // Make transfers from different users
      const amount = ethers.utils.parseEther("100");
      
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user3.address,
        HEDERA_CHAIN_ID
      );
      
      await hederaBridge.connect(user2).lockAndTransfer(
        mockToken.address,
        amount.mul(2),
        user3.address,
        HEDERA_CHAIN_ID
      );
      
      // Check the daily amounts for each user
      const user1Amount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      const user2Amount = await hederaBridge.getUserTodayTransferAmount(user2.address);
      
      expect(user1Amount).to.equal(amount);
      expect(user2Amount).to.equal(amount.mul(2));
    });
  });
  
  describe("Rate Limiting Stress Tests", function() {
    it("Should handle burst transfers at limit boundaries", async function() {
      // Configure user with specific limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"), // Max per transfer
        ethers.utils.parseEther("500"), // Daily limit
        ethers.utils.parseEther("2000"), // Weekly limit
        1800 // 30 minute cooldown
      );
      
      // Create a series of transfers that approach but don't exceed limits
      const transferAmount = ethers.utils.parseEther("95");  // Just under the max transfer
      const transferCount = 5;  // Total: 475, just under daily limit of 500
      
      // Perform a burst of transfers in quick succession
      for (let i = 0; i < transferCount; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Verify the total is tracked correctly
      const dailyTotal = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(dailyTotal).to.equal(transferAmount.mul(transferCount));
      
      // Final transfer that would exceed the limit should fail
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("30"),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
    });
    
    it("Should handle transfers across period boundaries", async function() {
      // Configure user limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"), // Max per transfer
        ethers.utils.parseEther("300"), // Daily limit
        ethers.utils.parseEther("1000"), // Weekly limit
        1800 // 30 minute cooldown
      );
      
      // Make transfers to reach daily limit
      const transferAmount = ethers.utils.parseEther("100");
      
      // Day 1: 3 transfers = 300 (at limit)
      for (let i = 0; i < 3; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Should fail on 4th transfer
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
      
      // Move to next day (exactly at boundary)
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Day 2: Should be able to transfer again
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Get the current day's transfer amount - should be reset
      const day2Amount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(day2Amount).to.equal(transferAmount);
      
      // Continue to make two more transfers to reach the daily limit again
      for (let i = 0; i < 2; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Check weekly total is accumulating (should be 600 now: 300 from day 1 + 300 from day 2)
      const currentWeek = Math.floor(Date.now() / 1000 / 86400 / 7);
      const weeklyTotal = await hederaBridge.getUserWeeklyTransferAmount(user1.address, currentWeek);
      expect(weeklyTotal).to.equal(transferAmount.mul(6)); // 6 successful transfers
      
      // The weekly total should still allow one more day of transfers
      // Move to day 3
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Day 3: Should be able to transfer again (daily limit reset, weekly not exceeded)
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // One more transfer to reach 800 total for the week
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Last transfer for the week should work (900 total)
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // This transfer would exceed weekly limit and should fail
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserWeeklyLimit");
    });
  });
  
  describe("Admin and Governance Controls", function () {
    it("Should only allow governance to configure user limits", async function () {
      // User trying to configure their own limits should fail
      await expect(
        hederaBridge.connect(user1).configureUserLimits(
          user1.address,
          USER_MAX_TRANSFER,
          USER_DAILY_LIMIT, 
          USER_WEEKLY_LIMIT,
          USER_COOLDOWN_PERIOD
        )
      ).to.be.reverted;
      
      // Admin without governance role should fail
      await expect(
        hederaBridge.connect(admin).configureUserLimits(
          user1.address,
          USER_MAX_TRANSFER,
          USER_DAILY_LIMIT, 
          USER_WEEKLY_LIMIT,
          USER_COOLDOWN_PERIOD
        )
      ).to.be.reverted;
      
      // Governance role should succeed
      await expect(
        hederaBridge.connect(governance).configureUserLimits(
          user1.address,
          USER_MAX_TRANSFER,
          USER_DAILY_LIMIT, 
          USER_WEEKLY_LIMIT,
          USER_COOLDOWN_PERIOD
        )
      ).to.not.be.reverted;
    });
    
    it("Should only allow governance to set large transfer threshold", async function () {
      const newThreshold = ethers.utils.parseEther("1000");
      
      // User trying to set threshold should fail
      await expect(
        hederaBridge.connect(user1).setLargeTransferThreshold(newThreshold)
      ).to.be.reverted;
      
      // Governance role should succeed
      await expect(
        hederaBridge.connect(governance).setLargeTransferThreshold(newThreshold)
      ).to.emit(hederaBridge, "LargeTransferThresholdUpdated").withArgs(newThreshold);
    });
    
    it("Should only allow governance to set cooldown period", async function () {
      const newCooldown = 7200; // 2 hours
      
      // User trying to set cooldown should fail
      await expect(
        hederaBridge.connect(user1).setDefaultCooldownPeriod(newCooldown)
      ).to.be.reverted;
      
      // Governance role should succeed
      await expect(
        hederaBridge.connect(governance).setDefaultCooldownPeriod(newCooldown)
      ).to.emit(hederaBridge, "CooldownPeriodUpdated").withArgs(newCooldown);
    });
  });
  
  describe("Governance Migration Tests", function() {
    it("Should properly transition limits when governance changes", async function() {
      // Initial setup with original governance
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"), // Max per transfer
        ethers.utils.parseEther("500"), // Daily limit
        ethers.utils.parseEther("2000"), // Weekly limit
        1800 // 30 minute cooldown
      );
      
      // Create a new governance account
      const newGovernance = user3;
      
      // Grant governance role to the new account
      await hederaBridge.connect(admin).grantRole(GOVERNANCE_ROLE, newGovernance.address);
      
      // Verify new governance can modify limits
      await expect(
        hederaBridge.connect(newGovernance).configureUserLimits(
          user1.address,
          ethers.utils.parseEther("150"), // Increased max per transfer
          ethers.utils.parseEther("600"), // Increased daily limit
          ethers.utils.parseEther("2500"), // Increased weekly limit
          2700 // 45 minute cooldown
        )
      ).to.not.be.reverted;
      
      // Verify the limits were updated
      const userLimits = await hederaBridge.getUserTransferLimits(user1.address);
      expect(userLimits.maxPerTransfer).to.equal(ethers.utils.parseEther("150"));
      expect(userLimits.dailyLimit).to.equal(ethers.utils.parseEther("600"));
      expect(userLimits.weeklyLimit).to.equal(ethers.utils.parseEther("2500"));
      expect(userLimits.cooldownPeriod).to.equal(2700);
      
      // Revoke original governance role
      await hederaBridge.connect(admin).revokeRole(GOVERNANCE_ROLE, governance.address);
      
      // Verify original governance can no longer modify limits
      await expect(
        hederaBridge.connect(governance).configureUserLimits(
          user1.address,
          ethers.utils.parseEther("200"),
          ethers.utils.parseEther("800"),
          ethers.utils.parseEther("3000"),
          3600
        )
      ).to.be.reverted;
    });
    
    it("Should maintain rate limits during governance transition", async function() {
      // Initial setup with original governance
      await hederaBridge.connect(governance).configureUserLimits(
        user2.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("500"),
        ethers.utils.parseEther("2000"),
        1800
      );
      
      // Make some transfers
      const transferAmount = ethers.utils.parseEther("50");
      await hederaBridge.connect(user2).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user3.address,
        HEDERA_CHAIN_ID
      );
      
      // Record the current usage
      const initialDailyUsage = await hederaBridge.getUserTodayTransferAmount(user2.address);
      
      // Create a new governance account and transition
      const newGovernance = user3;
      await hederaBridge.connect(admin).grantRole(GOVERNANCE_ROLE, newGovernance.address);
      await hederaBridge.connect(admin).revokeRole(GOVERNANCE_ROLE, governance.address);
      
      // Modify limits with new governance
      await hederaBridge.connect(newGovernance).configureUserLimits(
        user2.address,
        ethers.utils.parseEther("150"),
        ethers.utils.parseEther("600"),
        ethers.utils.parseEther("2500"),
        2700
      );
      
      // Verify daily usage is preserved after governance change
      const currentDailyUsage = await hederaBridge.getUserTodayTransferAmount(user2.address);
      expect(currentDailyUsage).to.equal(initialDailyUsage);
      
      // Verify we can still transfer with the new limits
      await hederaBridge.connect(user2).lockAndTransfer(
        mockToken.address,
        ethers.utils.parseEther("75"), // Larger than original limit
        user3.address,
        HEDERA_CHAIN_ID
      );
      
      // Verify usage has increased
      const updatedDailyUsage = await hederaBridge.getUserTodayTransferAmount(user2.address);
      expect(updatedDailyUsage).to.equal(initialDailyUsage.add(ethers.utils.parseEther("75")));
    });
  });
  
  describe("Bridge Component Integration", function() {
    it("Should maintain rate limits during message relaying", async function() {
      // Configure user limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("300"),
        ethers.utils.parseEther("1000"),
        1800
      );
      
      // Make a transfer to lock tokens
      const transferAmount = ethers.utils.parseEther("75");
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Record initial usage
      const initialDailyUsage = await hederaBridge.getUserTodayTransferAmount(user1.address);
      
      // Simulate receiving a message from the other chain (using relayer)
      const messageData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256", "uint256"],
        [mockToken.address, user1.address, transferAmount, ETHEREUM_CHAIN_ID]
      );
      
      // Execute the message relay
      await messageVerifier.connect(relayer).relayMessage(
        HEDERA_CHAIN_ID, 
        hederaBridge.address, 
        messageData
      );
      
      // Check that rate limiting tracks are maintained
      const updatedDailyUsage = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(updatedDailyUsage).to.equal(initialDailyUsage);
      
      // User should still be able to make another transfer up to their limit
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        ethers.utils.parseEther("50"),
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // This transfer should exceed the daily limit and fail
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("200"),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
    });
    
    it("Should handle emergency pausing while maintaining rate limit states", async function() {
      // Configure user limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("300"),
        ethers.utils.parseEther("1000"),
        1800
      );
      
      // Make a transfer
      const transferAmount = ethers.utils.parseEther("75");
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Record usage before pause
      const prePauseDailyUsage = await hederaBridge.getUserTodayTransferAmount(user1.address);
      
      // Pause the bridge (assuming there's a pause function)
      await hederaBridge.connect(governance).pause();
      
      // Verify transfers are rejected when paused
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.reverted;
      
      // Unpause the bridge
      await hederaBridge.connect(governance).unpause();
      
      // Verify usage data was preserved during pause
      const postPauseDailyUsage = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(postPauseDailyUsage).to.equal(prePauseDailyUsage);
      
      // Should be able to transfer again after unpause
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Verify usage has updated
      const finalDailyUsage = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(finalDailyUsage).to.equal(prePauseDailyUsage.add(transferAmount));
    });
    
    it("Should properly integrate with token manager while respecting rate limits", async function() {
      // Add token manager configuration
      await tokenManager.connect(admin).addToken(
        mockToken.address, 
        "Mock Token", 
        "MOCK", 
        18
      );
      
      // Configure user limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("300"),
        ethers.utils.parseEther("1000"),
        1800
      );
      
      // Make a transfer to lock tokens in bridge
      const transferAmount = ethers.utils.parseEther("75");
      await mockToken.connect(user1).approve(hederaBridge.address, transferAmount.mul(2));
      
      // First transfer should succeed
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        transferAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Verify token balance in bridge
      const bridgeBalance = await mockToken.balanceOf(hederaBridge.address);
      expect(bridgeBalance).to.equal(transferAmount);
      
      // Make another transfer exceeding limits
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("250"),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserMaxTransferLimit");
      
      // Bridge balance should remain unchanged after failed transfer
      const finalBridgeBalance = await mockToken.balanceOf(hederaBridge.address);
      expect(finalBridgeBalance).to.equal(bridgeBalance);
    });
  });
});