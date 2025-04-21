const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Edge Case Rate Limiting Tests", function () {
  let admin, governance, relayer, user1, user2, user3, feeCollector;
  let mockToken, messageVerifier, tokenManager, hederaBridge;

  // Constants
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const RELAYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RELAYER_ROLE"));
  const ETHEREUM_CHAIN_ID = 1;
  const HEDERA_CHAIN_ID = 295;

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

    // Mint mock tokens to users
    await mockToken.mint(user1.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user3.address, ethers.utils.parseEther("10000"));
    
    // Set allowance for bridge
    await mockToken.connect(user1).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    await mockToken.connect(user2).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    await mockToken.connect(user3).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
  });

  describe("Minimal Transfer Amounts", function() {
    it("Should handle 1 wei transfers", async function() {
      // Configure user with small limits for testing
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("500"),
        ethers.utils.parseEther("2000"),
        1800 // 30 minute cooldown
      );
      
      // Try to transfer 1 wei
      const minimalAmount = 1; // 1 wei
      
      // Should be able to transfer minimal amount
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          minimalAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // Check that daily amount is correctly tracked
      const dailyAmount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(dailyAmount).to.equal(minimalAmount);
      
      // Transfer full daily limit minus 1 wei already transferred
      const remainingAmount = ethers.utils.parseEther("500").sub(1);
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        remainingAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Check total is exactly at daily limit
      const totalAmount = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(totalAmount).to.equal(ethers.utils.parseEther("500"));
      
      // Even 1 wei more should fail
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          1,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
    });
  });
  
  describe("Maximal Transfer Amounts", function() {
    it("Should handle maximum possible amounts", async function() {
      // Set a very high limit for testing
      const maxUint256 = ethers.constants.MaxUint256;
      const veryHighLimit = ethers.utils.parseEther("1000000000"); // 1 billion ETH (effectively unlimited)
      
      // Configure bridge with high limits
      await hederaBridge.connect(governance).setMaxTransferAmount(veryHighLimit);
      await hederaBridge.connect(governance).setDailyTransferLimit(veryHighLimit);
      
      // Configure user with high limits
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        veryHighLimit,
        veryHighLimit,
        veryHighLimit,
        0 // No cooldown
      );
      
      // Try to transfer maximum possible amount that token supports
      const maxAmount = ethers.utils.parseEther("10000"); // All tokens user has
      
      // Should be able to transfer max amount
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          maxAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // Attempting to transfer more than user has should fail (but not due to rate limiting)
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          maxAmount.add(1),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.reverted; // Reverted due to insufficient balance, not rate limiting
    });
  });
  
  describe("Cooldown Period Edge Cases", function() {
    it("Should handle zero cooldown period", async function() {
      // Configure user with zero cooldown
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("5000"),
        ethers.utils.parseEther("10000"),
        0 // Zero cooldown
      );
      
      // Set large transfer threshold to a low value to test cooldown logic
      const largeThreshold = ethers.utils.parseEther("10");
      await hederaBridge.connect(governance).setLargeTransferThreshold(largeThreshold);
      
      // Make a large transfer
      const largeAmount = largeThreshold.add(1);
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        largeAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Should be able to immediately make another large transfer since cooldown is zero
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });
    
    it("Should handle exactly-at-cooldown-boundary transfers", async function() {
      // Configure with short cooldown for testing
      const cooldownPeriod = 60; // 1 minute
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("1000"),
        ethers.utils.parseEther("5000"),
        ethers.utils.parseEther("10000"),
        cooldownPeriod
      );
      
      // Set large transfer threshold
      const largeThreshold = ethers.utils.parseEther("10");
      await hederaBridge.connect(governance).setLargeTransferThreshold(largeThreshold);
      
      // Make a large transfer
      const largeAmount = largeThreshold.add(1);
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        largeAmount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Attempt transfer just before cooldown expires
      await ethers.provider.send("evm_increaseTime", [cooldownPeriod - 1]);
      await ethers.provider.send("evm_mine");
      
      // Should fail because cooldown hasn't fully elapsed
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          largeAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeCooldownPeriodNotMet");
      
      // Advance time by exactly 1 more second to hit cooldown boundary
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine");
      
      // Now it should work
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
  
  describe("Time-based Boundary Tests", function() {
    it("Should correctly reset daily limits at day boundaries", async function() {
      // Configure user
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("300"),
        ethers.utils.parseEther("1000"),
        1800
      );
      
      // Fill the daily limit
      const transferAmount = ethers.utils.parseEther("100");
      for (let i = 0; i < 3; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Check we're at limit
      const firstDayTotal = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(firstDayTotal).to.equal(ethers.utils.parseEther("300"));
      
      // Transfer should fail before day boundary
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserDailyLimit");
      
      // Move time to exactly the day boundary (end of day)
      const secondsInDay = 24 * 60 * 60;
      const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      const nextDayBoundary = Math.floor(currentTimestamp / secondsInDay) * secondsInDay + secondsInDay;
      const timeToIncrease = nextDayBoundary - currentTimestamp;
      
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine");
      
      // Transfer should work after day boundary
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // New day total should be reset to this single transfer
      const secondDayTotal = await hederaBridge.getUserTodayTransferAmount(user1.address);
      expect(secondDayTotal).to.equal(transferAmount);
    });
    
    it("Should correctly reset weekly limits at week boundaries", async function() {
      // Configure user with low weekly limit
      await hederaBridge.connect(governance).configureUserLimits(
        user1.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("300"),
        ethers.utils.parseEther("300"), // Weekly limit is just one day's worth
        1800
      );
      
      // Fill the weekly limit
      const transferAmount = ethers.utils.parseEther("100");
      for (let i = 0; i < 3; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Check we're at weekly limit
      const firstWeekTotal = await hederaBridge.getUserWeeklyTransferAmount(
        user1.address,
        Math.floor(Date.now() / 1000 / 86400 / 7)
      );
      expect(firstWeekTotal).to.equal(ethers.utils.parseEther("300"));
      
      // Daily limit reset shouldn't help with weekly limit
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Transfer should still fail due to weekly limit
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWithCustomError(hederaBridge, "BridgeExceedsUserWeeklyLimit");
      
      // Move time to exactly the week boundary (end of week)
      const secondsInWeek = 7 * 24 * 60 * 60;
      const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      const nextWeekBoundary = Math.floor(currentTimestamp / secondsInWeek) * secondsInWeek + secondsInWeek;
      const timeToIncrease = nextWeekBoundary - currentTimestamp;
      
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine");
      
      // Transfer should work after week boundary
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          transferAmount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
      
      // New week total should be reset to this single transfer
      const secondWeekTotal = await hederaBridge.getUserWeeklyTransferAmount(
        user1.address,
        Math.floor(Date.now() / 1000 / 86400 / 7)
      );
      expect(secondWeekTotal).to.equal(transferAmount);
    });
  });
});