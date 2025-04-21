const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Hedera Bridge System", function () {
  let admin, relayer, user1, user2, feeCollector, treasury;
  let mockToken, bridgedToken, messageVerifier, tokenManager, hederaBridge;
  let transferId, messageId;

  // Mock price oracle for testing
  let mockPriceOracle;

  // Constants
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const BRIDGE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("BRIDGE_ROLE"));
  const RELAYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RELAYER_ROLE"));
  const HEDERA_CHAIN_ID = 295; // Hedera Testnet chain ID
  const ETHEREUM_CHAIN_ID = 1; // Ethereum Mainnet (for testing)
  const MAX_TRANSFER_AMOUNT = ethers.utils.parseEther("1000"); // 1000 tokens max per transfer
  const DAILY_TRANSFER_LIMIT = ethers.utils.parseEther("5000"); // 5000 tokens max per day

  beforeEach(async function () {
    // Get signers
    [admin, relayer, user1, user2, feeCollector, treasury] = await ethers.getSigners();

    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.deployed();

    // Deploy mock price oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    await mockPriceOracle.deployed();

    // Add token to price oracle
    await mockPriceOracle.addAsset(mockToken.address, ethers.utils.parseEther("10")); // Price: $10

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

    // Add supported chain
    await hederaBridge.addSupportedChain(HEDERA_CHAIN_ID);

    // Deploy bridged token (representing a Hedera token on Ethereum)
    const BridgedToken = await ethers.getContractFactory("BridgedToken");
    bridgedToken = await BridgedToken.deploy(
      "Bridged Hedera Token",
      "bHBAR",
      18,
      hederaBridge.address,
      mockToken.address,
      HEDERA_CHAIN_ID
    );
    await bridgedToken.deployed();

    // Mint mock tokens to users
    await mockToken.mint(user1.address, ethers.utils.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.utils.parseEther("10000"));
    
    // Set allowance for bridge
    await mockToken.connect(user1).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    await mockToken.connect(user2).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
  });

  describe("Basic Bridge Operations", function () {
    it("Should lock tokens and emit transfer event", async function () {
      const amount = ethers.utils.parseEther("100");
      
      // Lock tokens for transfer
      const tx = await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Get the transfer ID from the event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'TransferInitiated');
      transferId = event.args.transferId;
      
      // Check that the event was emitted correctly
      expect(event.args.sender).to.equal(user1.address);
      expect(event.args.recipient).to.equal(user2.address);
      expect(event.args.asset).to.equal(mockToken.address);
      expect(event.args.amount).to.equal(amount);
      expect(event.args.sourceChainId).to.equal(ETHEREUM_CHAIN_ID);
      expect(event.args.targetChainId).to.equal(HEDERA_CHAIN_ID);
      
      // Check that tokens were transferred to the bridge
      expect(await mockToken.balanceOf(hederaBridge.address)).to.equal(amount);
    });

    it("Should release tokens with valid proof", async function () {
      const amount = ethers.utils.parseEther("100");
      
      // Create a transfer ID and proof
      transferId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        [mockToken.address, user1.address, user2.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, Date.now(), ethers.utils.randomBytes(32)]
      ));
      
      // Mock token transfer to bridge (in a real scenario this would be on another chain)
      await mockToken.connect(user1).transfer(hederaBridge.address, amount);
      
      // Create signature from relayer
      const messageHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address", "address", "uint256", "uint256", "uint256"],
        [transferId, user1.address, user2.address, mockToken.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID]
      ));
      
      const messageHashBytes = ethers.utils.arrayify(messageHash);
      const signature = await relayer.signMessage(messageHashBytes);
      
      // Encode the proof data
      const proof = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "uint256", "uint256", "uint256", "bytes"],
        [user1.address, user2.address, mockToken.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, signature]
      );
      
      // Release tokens
      await expect(hederaBridge.connect(relayer).releaseAsset(transferId, proof))
        .to.emit(hederaBridge, "TransferCompleted")
        .withArgs(transferId, user2.address, mockToken.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID);
      
      // Check that the user received tokens
      expect(await mockToken.balanceOf(user2.address)).to.equal(ethers.utils.parseEther("10100")); // Initial 10000 + 100 released
    });

    it("Should reject release with invalid proof", async function () {
      const amount = ethers.utils.parseEther("100");
      
      // Create a transfer ID
      transferId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "uint256", "uint256", "uint256", "uint256", "bytes32"],
        [mockToken.address, user1.address, user2.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, Date.now(), ethers.utils.randomBytes(32)]
      ));
      
      // Create invalid signature (signed by user1 instead of relayer)
      const messageHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address", "address", "uint256", "uint256", "uint256"],
        [transferId, user1.address, user2.address, mockToken.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID]
      ));
      
      const messageHashBytes = ethers.utils.arrayify(messageHash);
      const signature = await user1.signMessage(messageHashBytes); // Invalid signer
      
      // Encode the proof data
      const proof = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "uint256", "uint256", "uint256", "bytes"],
        [user1.address, user2.address, mockToken.address, amount, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, signature]
      );
      
      // Try to release tokens with invalid proof
      await expect(hederaBridge.connect(relayer).releaseAsset(transferId, proof))
        .to.be.revertedWith("HederaBridge: invalid proof");
    });
  });

  describe("Cross-Chain Messaging", function () {
    it("Should send a message and emit event", async function () {
      const message = ethers.utils.defaultAbiCoder.encode(["string"], ["Hello, Hedera!"]);
      
      // Send message
      const tx = await hederaBridge.connect(user1).sendMessage(
        HEDERA_CHAIN_ID,
        user2.address,
        message
      );
      
      // Get message ID from event
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'MessageSent');
      messageId = event.args.messageId;
      
      // Check that the event was emitted correctly
      expect(event.args.sender).to.equal(user1.address);
      expect(event.args.recipient).to.equal(user2.address);
      expect(event.args.sourceChainId).to.equal(ETHEREUM_CHAIN_ID);
      expect(event.args.targetChainId).to.equal(HEDERA_CHAIN_ID);
    });

    it("Should receive a message with valid proof", async function () {
      const message = ethers.utils.defaultAbiCoder.encode(["string"], ["Hello, Ethereum!"]);
      
      // Create a message ID
      messageId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "bytes", "uint256", "uint256", "uint256", "bytes32"],
        [user1.address, user2.address, message, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, Date.now(), ethers.utils.randomBytes(32)]
      ));
      
      // Create signature from relayer
      const messageHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address", "bytes32", "bytes"],
        [HEDERA_CHAIN_ID, user1.address, user2.address, messageId, message]
      ));
      
      const messageHashBytes = ethers.utils.arrayify(messageHash);
      const signature = await relayer.signMessage(messageHashBytes);
      
      // Encode the proof data
      const proof = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bytes"],
        [messageId, user2.address, signature]
      );
      
      // Verify message processed state before
      expect(await messageVerifier.isMessageProcessed(messageId)).to.be.false;
      
      // Receive message
      await expect(hederaBridge.connect(relayer).receiveMessage(
        HEDERA_CHAIN_ID,
        user1.address,
        message,
        proof
      ))
        .to.emit(hederaBridge, "MessageReceived")
        .withArgs(messageId, user1.address, user2.address, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID);
      
      // Verify message processed state after
      expect(await messageVerifier.isMessageProcessed(messageId)).to.be.true;
    });

    it("Should reject receiving a message twice (replay protection)", async function () {
      const message = ethers.utils.defaultAbiCoder.encode(["string"], ["Hello, Ethereum!"]);
      
      // Create a message ID
      messageId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "bytes", "uint256", "uint256", "uint256", "bytes32"],
        [user1.address, user2.address, message, HEDERA_CHAIN_ID, ETHEREUM_CHAIN_ID, Date.now(), ethers.utils.randomBytes(32)]
      ));
      
      // Create signature from relayer
      const messageHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address", "bytes32", "bytes"],
        [HEDERA_CHAIN_ID, user1.address, user2.address, messageId, message]
      ));
      
      const messageHashBytes = ethers.utils.arrayify(messageHash);
      const signature = await relayer.signMessage(messageHashBytes);
      
      // Encode the proof data
      const proof = ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "bytes"],
        [messageId, user2.address, signature]
      );
      
      // Mark message as processed
      await messageVerifier.connect(admin).markMessageProcessed(messageId);
      
      // Try to receive message again
      await expect(hederaBridge.connect(relayer).receiveMessage(
        HEDERA_CHAIN_ID,
        user1.address,
        message,
        proof
      )).to.be.revertedWith("HederaBridge: message already processed");
    });
  });

  describe("Rate Limiting and Security", function () {
    beforeEach(async function () {
      // Deploy bridge with rate limiting
      const HederaBridge = await ethers.getContractFactory("HederaBridge");
      hederaBridge = await HederaBridge.deploy(
        admin.address,
        messageVerifier.address,
        tokenManager.address,
        feeCollector.address,
        ETHEREUM_CHAIN_ID
      );
      await hederaBridge.deployed();
      
      // Set rate limits
      await hederaBridge.setMaxTransferAmount(MAX_TRANSFER_AMOUNT);
      await hederaBridge.setDailyTransferLimit(DAILY_TRANSFER_LIMIT);
      
      // Grant roles
      await hederaBridge.grantRole(RELAYER_ROLE, relayer.address);
      await messageVerifier.addBridge(hederaBridge.address);
      await tokenManager.addBridge(hederaBridge.address);
      
      // Add supported chain
      await hederaBridge.addSupportedChain(HEDERA_CHAIN_ID);
      
      // Set allowance for bridge
      await mockToken.connect(user1).approve(hederaBridge.address, ethers.utils.parseEther("10000"));
    });

    it("Should enforce maximum transfer amount", async function () {
      const amount = MAX_TRANSFER_AMOUNT.add(1); // Just over the limit
      
      // Try to transfer more than maximum
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWith("HederaBridge: exceeds maximum transfer amount");
    });

    it("Should enforce daily transfer limit", async function () {
      // Make a series of transfers to hit the daily limit
      const amount = ethers.utils.parseEther("1000"); // Max amount per transfer
      const iterations = 5; // 5 * 1000 = 5000 (daily limit)
      
      for (let i = 0; i < iterations; i++) {
        await hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        );
      }
      
      // Try to make one more transfer
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          amount,
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWith("HederaBridge: exceeds daily transfer limit");
    });

    it("Should reset daily transfer count after 24 hours", async function () {
      // Make transfers to hit the daily limit
      const amount = ethers.utils.parseEther("1000");
      const iterations = 5; // 5 * 1000 = 5000 (daily limit)
      
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
  });

  describe("Bridge Pausing and Administration", function () {
    it("Should pause and unpause the bridge", async function () {
      // Pause the bridge
      await hederaBridge.connect(admin).pause();
      
      // Try to lock tokens
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("100"),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause the bridge
      await hederaBridge.connect(admin).unpause();
      
      // Should be able to lock tokens now
      await expect(
        hederaBridge.connect(user1).lockAndTransfer(
          mockToken.address,
          ethers.utils.parseEther("100"),
          user2.address,
          HEDERA_CHAIN_ID
        )
      ).to.emit(hederaBridge, "TransferInitiated");
    });

    it("Should update fee settings", async function () {
      // Set a fee
      const newFee = 100; // 1% (in basis points)
      await hederaBridge.connect(admin).updateFee(newFee);
      
      // Check fee was updated
      expect(await hederaBridge.bridgeFeePercent()).to.equal(newFee);
      
      // Lock tokens with fee
      const amount = ethers.utils.parseEther("100");
      const expectedFee = amount.mul(newFee).div(10000);
      const expectedTransferAmount = amount.sub(expectedFee);
      
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Check fee collector received the fee
      expect(await mockToken.balanceOf(feeCollector.address)).to.equal(expectedFee);
      
      // Check bridge received the remaining amount
      expect(await mockToken.balanceOf(hederaBridge.address)).to.equal(expectedTransferAmount);
    });

    it("Should update fee collector", async function () {
      // Set a fee
      const fee = 100; // 1%
      await hederaBridge.connect(admin).updateFee(fee);
      
      // Update fee collector
      await hederaBridge.connect(admin).updateFeeCollector(treasury.address);
      
      // Check fee collector was updated
      expect(await hederaBridge.feeCollector()).to.equal(treasury.address);
      
      // Lock tokens with fee
      const amount = ethers.utils.parseEther("100");
      const expectedFee = amount.mul(fee).div(10000);
      
      await hederaBridge.connect(user1).lockAndTransfer(
        mockToken.address,
        amount,
        user2.address,
        HEDERA_CHAIN_ID
      );
      
      // Check new fee collector received the fee
      expect(await mockToken.balanceOf(treasury.address)).to.equal(expectedFee);
    });
  });
});