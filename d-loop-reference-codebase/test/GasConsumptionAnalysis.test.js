const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bridge Gas Consumption Analysis", function () {
  let admin, governance, relayer, user1, user2, user3, feeCollector;
  let mockToken, messageVerifier, tokenManager, hederaBridge;
  
  // Gas tracking data
  let gasData = {};

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
    
    // Set up rate limiting
    await hederaBridge.connect(governance).setMaxTransferAmount(ethers.utils.parseEther("1000"));
    await hederaBridge.connect(governance).setDailyTransferLimit(ethers.utils.parseEther("5000"));
    await hederaBridge.connect(governance).setLargeTransferThreshold(ethers.utils.parseEther("500"));
    await hederaBridge.connect(governance).setDefaultCooldownPeriod(3600); // 1 hour
  });

  async function measureGas(txPromise, label) {
    const tx = await txPromise;
    const receipt = await tx.wait();
    gasData[label] = receipt.gasUsed.toString();
    console.log(`Gas used for ${label}: ${receipt.gasUsed.toString()}`);
    return receipt;
  }
  
  describe("Rate Limiting Gas Analysis", function() {
    it("Should measure gas costs for critical operations", async function() {
      // 1. Configure user limits without prior configuration
      await measureGas(
        hederaBridge.connect(governance).configureUserLimits(
          user1.address,
          ethers.utils.parseEther("100"),
          ethers.utils.parseEther("500"),
          ethers.utils.parseEther("2000"),
          1800
        ),
        "ConfigureUserLimits_FirstTime"
      );
      
      // 2. Update user limits
      await measureGas(
        hederaBridge.connect(governance).configureUserLimits(
          user1.address,
          ethers.utils.parseEther("150"),
          ethers.utils.parseEther("600"),
          ethers.utils.parseEther("2500"),
          2700
        ),
        "ConfigureUserLimits_Update"
      );
      
      // 3. Remove user limits
      await measureGas(
        hederaBridge.connect(governance).removeUserLimits(user1.address),
        "RemoveUserLimits"
      );
      
      // 4. Set global limits
      await measureGas(
        hederaBridge.connect(governance).setDailyTransferLimit(ethers.utils.parseEther("7500")),
        "SetDailyTransferLimit"
      );
      
      await measureGas(
        hederaBridge.connect(governance).setLargeTransferThreshold(ethers.utils.parseEther("750")),
        "SetLargeTransferThreshold"
      );
      
      await measureGas(
        hederaBridge.connect(governance).setDefaultCooldownPeriod(7200),
        "SetDefaultCooldownPeriod"
      );
      
      // 5. Regular transfer (no rate limiting applied)
      await measureGas(
        hederaBridge.connect(user2).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("10"),
          user3.address,
          HEDERA_CHAIN_ID
        ),
        "LockAndTransfer_NoRateLimits"
      );
      
      // 6. Configure user2 with limits
      await hederaBridge.connect(governance).configureUserLimits(
        user2.address,
        ethers.utils.parseEther("100"),
        ethers.utils.parseEther("500"),
        ethers.utils.parseEther("2000"),
        1800
      );
      
      // 7. Transfer with rate limiting checks (small amount)
      await measureGas(
        hederaBridge.connect(user2).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("10"),
          user3.address,
          HEDERA_CHAIN_ID
        ),
        "LockAndTransfer_WithLimits_SmallAmount"
      );
      
      // 8. Transfer large amount (triggers cooldown tracking)
      await measureGas(
        hederaBridge.connect(user2).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("75"),
          user3.address,
          HEDERA_CHAIN_ID
        ),
        "LockAndTransfer_WithLimits_LargeAmount"
      );
      
      // 9. Gas delta between limited and non-limited transfers
      const limitedGas = BigInt(gasData["LockAndTransfer_WithLimits_SmallAmount"]);
      const nonLimitedGas = BigInt(gasData["LockAndTransfer_NoRateLimits"]);
      const rateLimitingOverhead = limitedGas - nonLimitedGas;
      
      console.log(`Rate limiting overhead: ${rateLimitingOverhead.toString()} gas units`);
      
      // Verify the overhead is within acceptable limits (e.g., less than 20% increase)
      const percentageIncrease = (Number(rateLimitingOverhead) / Number(nonLimitedGas)) * 100;
      console.log(`Percentage increase due to rate limiting: ${percentageIncrease.toFixed(2)}%`);
      expect(percentageIncrease).to.be.lessThan(30); // Assuming 30% is acceptable
      
      // Output all gas data for reference
      console.table(gasData);
    });
  });
});