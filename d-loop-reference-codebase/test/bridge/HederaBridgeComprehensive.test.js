const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Hedera Bridge Comprehensive Tests", function () {
  let hederaBridge;
  let bridgeEscrow;
  let bridgeValidator;
  let mockRelayer;
  let mockToken;
  let mockTokenHedera;
  let mockTokenEVM;
  let protocolDAO;
  let owner;
  let user1;
  let user2;
  let validators;
  
  // Constants for testing
  const REQUIRED_VALIDATORS = 3;
  const INITIAL_LIQUIDITY = ethers.utils.parseEther("1000000");
  const TRANSFER_AMOUNT = ethers.utils.parseEther("1000");
  const FEE_PERCENTAGE = ethers.utils.parseEther("0.005"); // 0.5% fee
  const COOLDOWN_PERIOD = 300; // 5 minutes
  const BRIDGE_TIMEOUT = 3600; // 1 hour
  const HASH_PREFIX = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DLOOP_HEDERA_BRIDGE"));
  const HEDERA_NETWORK_ID = "295";
  const ETHEREUM_NETWORK_ID = "1";
  
  before(async function () {
    [owner, user1, user2, ...validators] = await ethers.getSigners();
    
    // Ensure we have enough validators
    validators = validators.slice(0, REQUIRED_VALIDATORS + 2);
    
    // Deploy mock tokens (for both networks)
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("DLOOP", "DLOOP", 18);
    await mockToken.deployed();
    
    mockTokenHedera = await MockToken.deploy("DLOOP_HEDERA", "DLOOP_H", 18);
    await mockTokenHedera.deployed();
    
    mockTokenEVM = await MockToken.deploy("DLOOP_EVM", "DLOOP_E", 18);
    await mockTokenEVM.deployed();
    
    // Deploy ProtocolDAO (simplified for testing)
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy();
    await protocolDAO.deployed();
    
    // Deploy BridgeValidator
    const BridgeValidator = await ethers.getContractFactory("BridgeValidator");
    bridgeValidator = await BridgeValidator.deploy(REQUIRED_VALIDATORS);
    await bridgeValidator.deployed();
    
    // Deploy mock relayer for cross-chain communication
    const MockRelayer = await ethers.getContractFactory("MockRelayer");
    mockRelayer = await MockRelayer.deploy();
    await mockRelayer.deployed();
    
    // Deploy BridgeEscrow
    const BridgeEscrow = await ethers.getContractFactory("BridgeEscrow");
    bridgeEscrow = await BridgeEscrow.deploy();
    await bridgeEscrow.deployed();
    
    // Deploy HederaBridge
    const HederaBridge = await ethers.getContractFactory("HederaBridge");
    hederaBridge = await HederaBridge.deploy(
      bridgeValidator.address,
      bridgeEscrow.address,
      mockRelayer.address,
      protocolDAO.address,
      ETHEREUM_NETWORK_ID,
      HEDERA_NETWORK_ID
    );
    await hederaBridge.deployed();
    
    // Setup permissions
    await bridgeEscrow.setBridge(hederaBridge.address);
    await bridgeValidator.setActiveBridge(hederaBridge.address);
    
    // Configure bridge settings
    await hederaBridge.setFeePercentage(FEE_PERCENTAGE);
    await hederaBridge.setCooldownPeriod(COOLDOWN_PERIOD);
    await hederaBridge.setBridgeTimeout(BRIDGE_TIMEOUT);
    
    // Add validators
    for (let i = 0; i < validators.length; i++) {
      await bridgeValidator.addValidator(validators[i].address);
    }
    
    // Support tokens on the bridge
    await hederaBridge.addSupportedToken(
      mockToken.address, 
      mockTokenHedera.address, 
      mockTokenEVM.address
    );
    
    // Fund users with tokens for testing
    await mockToken.mint(user1.address, INITIAL_LIQUIDITY);
    await mockToken.mint(user2.address, INITIAL_LIQUIDITY);
    
    // Fund bridge escrow with initial liquidity
    await mockTokenHedera.mint(bridgeEscrow.address, INITIAL_LIQUIDITY);
    await mockTokenEVM.mint(bridgeEscrow.address, INITIAL_LIQUIDITY);
  });
  
  describe("Token Management", function () {
    it("should properly configure supported tokens", async function () {
      // Get token mapping
      const tokenMapping = await hederaBridge.getTokenMapping(mockToken.address);
      
      // Verify mapping
      expect(tokenMapping.hederaToken).to.equal(mockTokenHedera.address);
      expect(tokenMapping.evmToken).to.equal(mockTokenEVM.address);
      expect(tokenMapping.supported).to.be.true;
    });
    
    it("should prevent duplicate token mappings", async function () {
      // Deploy a new token
      const NewToken = await ethers.getContractFactory("MockToken");
      const newToken = await NewToken.deploy("NEW", "NEW", 18);
      await newToken.deployed();
      
      // Try to map to already mapped Hedera token
      await expect(
        hederaBridge.addSupportedToken(newToken.address, mockTokenHedera.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("Hedera token already mapped");
      
      // Try to map to already mapped EVM token
      await expect(
        hederaBridge.addSupportedToken(newToken.address, ethers.constants.AddressZero, mockTokenEVM.address)
      ).to.be.revertedWith("EVM token already mapped");
    });
    
    it("should allow updating token mappings", async function () {
      // Deploy new tokens for updated mapping
      const UpdatedHederaToken = await ethers.getContractFactory("MockToken");
      const updatedHederaToken = await UpdatedHederaToken.deploy("UPDATED_H", "UPD_H", 18);
      await updatedHederaToken.deployed();
      
      const UpdatedEVMToken = await ethers.getContractFactory("MockToken");
      const updatedEVMToken = await UpdatedEVMToken.deploy("UPDATED_E", "UPD_E", 18);
      await updatedEVMToken.deployed();
      
      // Update token mapping
      await hederaBridge.updateTokenMapping(
        mockToken.address,
        updatedHederaToken.address,
        updatedEVMToken.address
      );
      
      // Verify updated mapping
      const tokenMapping = await hederaBridge.getTokenMapping(mockToken.address);
      expect(tokenMapping.hederaToken).to.equal(updatedHederaToken.address);
      expect(tokenMapping.evmToken).to.equal(updatedEVMToken.address);
      
      // Restore original mapping for subsequent tests
      await hederaBridge.updateTokenMapping(
        mockToken.address,
        mockTokenHedera.address,
        mockTokenEVM.address
      );
    });
    
    it("should allow removing supported tokens", async function () {
      // Deploy a token to test removal
      const RemovalToken = await ethers.getContractFactory("MockToken");
      const removalToken = await RemovalToken.deploy("REMOVAL", "REM", 18);
      await removalToken.deployed();
      
      const HederaRemovalToken = await ethers.getContractFactory("MockToken");
      const hederaRemovalToken = await HederaRemovalToken.deploy("H_REMOVAL", "H_REM", 18);
      await hederaRemovalToken.deployed();
      
      const EVMRemovalToken = await ethers.getContractFactory("MockToken");
      const evmRemovalToken = await EVMRemovalToken.deploy("E_REMOVAL", "E_REM", 18);
      await evmRemovalToken.deployed();
      
      // Add token to supported list
      await hederaBridge.addSupportedToken(
        removalToken.address,
        hederaRemovalToken.address,
        evmRemovalToken.address
      );
      
      // Verify it's supported
      expect((await hederaBridge.getTokenMapping(removalToken.address)).supported).to.be.true;
      
      // Remove token from supported list
      await hederaBridge.removeSupportedToken(removalToken.address);
      
      // Verify it's no longer supported
      expect((await hederaBridge.getTokenMapping(removalToken.address)).supported).to.be.false;
    });
  });
  
  describe("Bridge Operations: EVM to Hedera", function () {
    it("should lock tokens in escrow when transferring to Hedera", async function () {
      // User approves tokens for bridge
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      
      // Initial balances
      const initialUserBalance = await mockToken.balanceOf(user1.address);
      const initialEscrowBalance = await mockToken.balanceOf(bridgeEscrow.address);
      
      // Get target address on Hedera (using user's address as example)
      const hederaAddress = user1.address;
      
      // Transfer to Hedera
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        hederaAddress
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Verify transfer was recorded
      const transfer = await hederaBridge.getTransfer(transferId);
      expect(transfer.amount).to.equal(TRANSFER_AMOUNT);
      expect(transfer.sourceAddress).to.equal(user1.address);
      expect(transfer.targetAddress).to.equal(hederaAddress);
      expect(transfer.sourceToken).to.equal(mockToken.address);
      expect(transfer.targetToken).to.equal(mockTokenHedera.address);
      expect(transfer.sourceNetwork).to.equal(ETHEREUM_NETWORK_ID);
      expect(transfer.targetNetwork).to.equal(HEDERA_NETWORK_ID);
      expect(transfer.status).to.equal(1); // Pending
      
      // Verify balances
      expect(await mockToken.balanceOf(user1.address)).to.equal(initialUserBalance.sub(TRANSFER_AMOUNT));
      expect(await mockToken.balanceOf(bridgeEscrow.address)).to.equal(initialEscrowBalance.add(TRANSFER_AMOUNT));
    });
    
    it("should collect fees on transfers", async function () {
      // Calculate expected fee
      const amount = ethers.utils.parseEther("100");
      const expectedFee = amount.mul(FEE_PERCENTAGE).div(ethers.utils.parseEther("1"));
      const expectedTransferAmount = amount.sub(expectedFee);
      
      // User approves tokens for bridge
      await mockToken.connect(user2).approve(hederaBridge.address, amount);
      
      // Initial balances
      const initialEscrowBalance = await mockToken.balanceOf(bridgeEscrow.address);
      const initialFeeCollectorBalance = await mockToken.balanceOf(protocolDAO.address);
      
      // Transfer to Hedera with fee
      const tx = await hederaBridge.connect(user2).transferToHedera(
        mockToken.address,
        amount,
        user2.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Verify transfer amount and fee
      const transfer = await hederaBridge.getTransfer(transferId);
      expect(transfer.amount).to.equal(expectedTransferAmount);
      
      // Verify fee collection
      expect(await mockToken.balanceOf(protocolDAO.address)).to.equal(
        initialFeeCollectorBalance.add(expectedFee)
      );
      
      // Verify total tokens in escrow (original + new transfer - fee)
      expect(await mockToken.balanceOf(bridgeEscrow.address)).to.equal(
        initialEscrowBalance.add(expectedTransferAmount)
      );
    });
    
    it("should validate transfers using required validators", async function () {
      // Initiate a new transfer to validate
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Initial transfer status
      const initialTransfer = await hederaBridge.getTransfer(transferId);
      expect(initialTransfer.status).to.equal(1); // Pending
      
      // Not enough validators sign
      for (let i = 0; i < REQUIRED_VALIDATORS - 1; i++) {
        await bridgeValidator.connect(validators[i]).validateTransfer(transferId);
      }
      
      // Check status - should still be pending
      const pendingTransfer = await hederaBridge.getTransfer(transferId);
      expect(pendingTransfer.status).to.equal(1); // Still pending
      
      // Last required validator signs
      await bridgeValidator.connect(validators[REQUIRED_VALIDATORS - 1]).validateTransfer(transferId);
      
      // Check status - should be validated
      const validatedTransfer = await hederaBridge.getTransfer(transferId);
      expect(validatedTransfer.status).to.equal(2); // Validated
    });
    
    it("should prevent duplicate validations", async function () {
      // Initiate a new transfer
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Validator signs
      await bridgeValidator.connect(validators[0]).validateTransfer(transferId);
      
      // Same validator tries to sign again
      await expect(
        bridgeValidator.connect(validators[0]).validateTransfer(transferId)
      ).to.be.revertedWith("Already validated");
    });
    
    it("should finalize transfers after validation", async function () {
      // Initiate a new transfer
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // All required validators sign
      for (let i = 0; i < REQUIRED_VALIDATORS; i++) {
        await bridgeValidator.connect(validators[i]).validateTransfer(transferId);
      }
      
      // Finalize the transfer
      await hederaBridge.finalizeTransfer(transferId);
      
      // Check status - should be completed
      const completedTransfer = await hederaBridge.getTransfer(transferId);
      expect(completedTransfer.status).to.equal(3); // Completed
      
      // Verify mock relayer called (would trigger the cross-chain message in production)
      const relayedTransfer = await mockRelayer.getLastRelayedTransfer();
      expect(relayedTransfer.transferId).to.equal(transferId);
    });
  });
  
  describe("Bridge Operations: Hedera to EVM", function () {
    let crossChainTransferId;
    
    it("should initiate Hedera-to-EVM transfers", async function () {
      // Generate cross-chain transfer ID
      crossChainTransferId = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "bytes32", "uint256"],
          [user2.address, ethers.utils.formatBytes32String("HEDERA_TX"), Date.now()]
        )
      );
      
      // Initial balances
      const initialReceiverBalance = await mockTokenEVM.balanceOf(user2.address);
      const initialEscrowBalance = await mockTokenEVM.balanceOf(bridgeEscrow.address);
      
      // Simulate receiving a cross-chain message
      await mockRelayer.simulateReceiveMessage(
        hederaBridge.address,
        crossChainTransferId,
        mockToken.address,
        user2.address,
        TRANSFER_AMOUNT,
        HEDERA_NETWORK_ID,
        ETHEREUM_NETWORK_ID
      );
      
      // Check transfer status in bridge
      const transfer = await hederaBridge.getTransfer(crossChainTransferId);
      expect(transfer.amount).to.equal(TRANSFER_AMOUNT);
      expect(transfer.sourceAddress).to.not.equal(ethers.constants.AddressZero);
      expect(transfer.targetAddress).to.equal(user2.address);
      expect(transfer.sourceToken).to.equal(mockToken.address);
      expect(transfer.targetToken).to.equal(mockTokenEVM.address);
      expect(transfer.sourceNetwork).to.equal(HEDERA_NETWORK_ID);
      expect(transfer.targetNetwork).to.equal(ETHEREUM_NETWORK_ID);
      expect(transfer.status).to.equal(1); // Pending
      
      // Balances shouldn't change yet (need validation)
      expect(await mockTokenEVM.balanceOf(user2.address)).to.equal(initialReceiverBalance);
      expect(await mockTokenEVM.balanceOf(bridgeEscrow.address)).to.equal(initialEscrowBalance);
    });
    
    it("should validate and release tokens for Hedera-to-EVM transfers", async function () {
      // Initial balances
      const initialReceiverBalance = await mockTokenEVM.balanceOf(user2.address);
      const initialEscrowBalance = await mockTokenEVM.balanceOf(bridgeEscrow.address);
      
      // All required validators sign
      for (let i = 0; i < REQUIRED_VALIDATORS; i++) {
        await bridgeValidator.connect(validators[i]).validateTransfer(crossChainTransferId);
      }
      
      // Finalize the transfer
      await hederaBridge.finalizeTransfer(crossChainTransferId);
      
      // Check status - should be completed
      const completedTransfer = await hederaBridge.getTransfer(crossChainTransferId);
      expect(completedTransfer.status).to.equal(3); // Completed
      
      // Verify balances - user should receive tokens, escrow balance should decrease
      expect(await mockTokenEVM.balanceOf(user2.address)).to.equal(
        initialReceiverBalance.add(TRANSFER_AMOUNT)
      );
      expect(await mockTokenEVM.balanceOf(bridgeEscrow.address)).to.equal(
        initialEscrowBalance.sub(TRANSFER_AMOUNT)
      );
    });
  });
  
  describe("Security Features", function () {
    it("should enforce cooldown period between transfers", async function () {
      // User makes a transfer
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Try to make another transfer immediately - should fail
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await expect(
        hederaBridge.connect(user1).transferToHedera(
          mockToken.address,
          TRANSFER_AMOUNT,
          user1.address
        )
      ).to.be.revertedWith("Transfer cooldown active");
      
      // Fast forward past cooldown
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // Now should be able to transfer again
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
    });
    
    it("should respect per-token transfer limits", async function () {
      // Set a low transfer limit for testing
      const lowLimit = ethers.utils.parseEther("50");
      await hederaBridge.setTokenTransferLimit(mockToken.address, lowLimit);
      
      // Try to transfer more than the limit
      await mockToken.connect(user1).approve(hederaBridge.address, lowLimit.mul(2));
      await expect(
        hederaBridge.connect(user1).transferToHedera(
          mockToken.address,
          lowLimit.mul(2),
          user1.address
        )
      ).to.be.revertedWith("Transfer amount exceeds limit");
      
      // Transfer within the limit should work
      await mockToken.connect(user1).approve(hederaBridge.address, lowLimit);
      await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        lowLimit,
        user1.address
      );
      
      // Reset limit to not affect other tests
      await hederaBridge.setTokenTransferLimit(mockToken.address, ethers.constants.MaxUint256);
    });
    
    it("should allow cancellation of stuck transfers", async function () {
      // User makes a transfer
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Fast forward past bridge timeout
      await time.increase(BRIDGE_TIMEOUT + 1);
      
      // Initial balances
      const initialUserBalance = await mockToken.balanceOf(user1.address);
      const initialEscrowBalance = await mockToken.balanceOf(bridgeEscrow.address);
      
      // Cancel the transfer
      await hederaBridge.connect(user1).cancelTransfer(transferId);
      
      // Verify transfer cancelled
      const cancelledTransfer = await hederaBridge.getTransfer(transferId);
      expect(cancelledTransfer.status).to.equal(4); // Cancelled
      
      // Verify tokens returned to user
      expect(await mockToken.balanceOf(user1.address)).to.equal(
        initialUserBalance.add(TRANSFER_AMOUNT)
      );
      expect(await mockToken.balanceOf(bridgeEscrow.address)).to.equal(
        initialEscrowBalance.sub(TRANSFER_AMOUNT)
      );
    });
    
    it("should prevent non-senders from cancelling transfers", async function () {
      // User1 makes a transfer
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      const tx = await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
      
      // Get transfer ID
      const receipt = await tx.wait();
      const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
      const transferId = transferEvent.args.transferId;
      
      // Fast forward past bridge timeout
      await time.increase(BRIDGE_TIMEOUT + 1);
      
      // User2 tries to cancel User1's transfer
      await expect(
        hederaBridge.connect(user2).cancelTransfer(transferId)
      ).to.be.revertedWith("Only sender can cancel");
    });
    
    it("should prevent finalizing invalid transfers", async function () {
      // Generate an invalid transfer ID
      const invalidTransferId = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("INVALID_TRANSFER")
      );
      
      // Try to finalize non-existent transfer
      await expect(
        hederaBridge.finalizeTransfer(invalidTransferId)
      ).to.be.revertedWith("Transfer not found or already completed");
    });
    
    it("should allow emergency pause of all transfers", async function () {
      // Emergency pause
      await hederaBridge.pause();
      
      // Try to initiate a transfer while paused
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await expect(
        hederaBridge.connect(user1).transferToHedera(
          mockToken.address,
          TRANSFER_AMOUNT,
          user1.address
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await hederaBridge.unpause();
      
      // Now transfer should work
      await mockToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await hederaBridge.connect(user1).transferToHedera(
        mockToken.address,
        TRANSFER_AMOUNT,
        user1.address
      );
    });
  });
  
  describe("Edge Cases", function () {
    it("should handle zero amount transfers", async function () {
      // Try to transfer zero tokens
      await mockToken.connect(user1).approve(hederaBridge.address, 0);
      await expect(
        hederaBridge.connect(user1).transferToHedera(
          mockToken.address,
          0,
          user1.address
        )
      ).to.be.revertedWith("Transfer amount must be greater than 0");
    });
    
    it("should validate against unsupported tokens", async function () {
      // Deploy an unsupported token
      const UnsupportedToken = await ethers.getContractFactory("MockToken");
      const unsupportedToken = await UnsupportedToken.deploy("UNSUPPORTED", "UNS", 18);
      await unsupportedToken.deployed();
      
      // Mint some tokens to user
      await unsupportedToken.mint(user1.address, TRANSFER_AMOUNT);
      
      // Try to transfer unsupported token
      await unsupportedToken.connect(user1).approve(hederaBridge.address, TRANSFER_AMOUNT);
      await expect(
        hederaBridge.connect(user1).transferToHedera(
          unsupportedToken.address,
          TRANSFER_AMOUNT,
          user1.address
        )
      ).to.be.revertedWith("Token not supported");
    });
    
    it("should handle insufficient escrow liquidity", async function () {
      // Make escrow balance zero for the target token
      const escrowBalance = await mockTokenEVM.balanceOf(bridgeEscrow.address);
      
      // Remove the tokens from escrow (would be a separate function in real contract)
      await bridgeEscrow.withdrawTokens(mockTokenEVM.address, owner.address, escrowBalance);
      
      // Generate cross-chain transfer ID
      const newTransferId = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "bytes32", "uint256"],
          [user2.address, ethers.utils.formatBytes32String("LOW_LIQUIDITY"), Date.now()]
        )
      );
      
      // Simulate receiving a cross-chain message
      await mockRelayer.simulateReceiveMessage(
        hederaBridge.address,
        newTransferId,
        mockToken.address,
        user2.address,
        TRANSFER_AMOUNT,
        HEDERA_NETWORK_ID,
        ETHEREUM_NETWORK_ID
      );
      
      // All required validators sign
      for (let i = 0; i < REQUIRED_VALIDATORS; i++) {
        await bridgeValidator.connect(validators[i]).validateTransfer(newTransferId);
      }
      
      // Try to finalize - should fail due to insufficient escrow balance
      await expect(
        hederaBridge.finalizeTransfer(newTransferId)
      ).to.be.revertedWith("Insufficient tokens in escrow");
      
      // Restore escrow balance for other tests
      await mockTokenEVM.mint(bridgeEscrow.address, escrowBalance);
    });
    
    it("should handle multiple active transfers per user", async function () {
      // Make sure cooldown is over
      await time.increase(COOLDOWN_PERIOD + 1);
      
      // User makes multiple transfers with different amounts
      const amounts = [
        ethers.utils.parseEther("10"),
        ethers.utils.parseEther("20"),
        ethers.utils.parseEther("30")
      ];
      
      const transferIds = [];
      
      for (const amount of amounts) {
        await mockToken.connect(user1).approve(hederaBridge.address, amount);
        const tx = await hederaBridge.connect(user1).transferToHedera(
          mockToken.address,
          amount,
          user1.address
        );
        
        // Get transfer ID
        const receipt = await tx.wait();
        const transferEvent = receipt.events.find(e => e.event === "TransferInitiated");
        transferIds.push(transferEvent.args.transferId);
        
        // Need to move past cooldown for next transfer
        await time.increase(COOLDOWN_PERIOD + 1);
      }
      
      // Verify all transfers exist with correct amounts
      for (let i = 0; i < transferIds.length; i++) {
        const transfer = await hederaBridge.getTransfer(transferIds[i]);
        expect(transfer.amount).to.equal(amounts[i]);
        expect(transfer.sourceAddress).to.equal(user1.address);
      }
    });
    
    it("should record transfer statistics correctly", async function () {
      // Get total transfer count and volume
      const stats = await hederaBridge.getTransferStats();
      
      // Verify total transfers > 0
      expect(stats.totalTransfers).to.be.gt(0);
      
      // Verify total volume > 0
      expect(stats.totalVolume).to.be.gt(0);
      
      // Verify token-specific stats
      const tokenStats = await hederaBridge.getTokenTransferStats(mockToken.address);
      expect(tokenStats.totalTransfers).to.be.gt(0);
      expect(tokenStats.totalVolume).to.be.gt(0);
    });
  });
});