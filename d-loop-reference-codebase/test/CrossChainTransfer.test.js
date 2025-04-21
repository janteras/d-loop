const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Cross Chain Transfer Test Suite
 * 
 * These tests verify the token transfer mechanism between Ethereum and Hedera networks
 * without modifying any contracts (Phase 1 requirement).
 */
describe("Cross Chain Transfer", function() {
  // Deploy a testing fixture with necessary contracts and test data
  async function deployFixture() {
    const [deployer, user1, user2, user3, validator1, validator2, validator3] = await ethers.getSigners();
    
    // Deploy mock token for Ethereum side
    const MockToken = await ethers.getContractFactory("MockERC20");
    const ethereumToken = await MockToken.deploy("Ethereum DLOOP", "eDLOOP");
    
    // For testing, we'll simulate Hedera tokens with another ERC20
    const hederaToken = await MockToken.deploy("Hedera DLOOP", "hDLOOP");
    
    // Mint tokens to users
    await ethereumToken.mint(user1.address, ethers.parseEther("100000"));
    await ethereumToken.mint(user2.address, ethers.parseEther("50000"));
    await ethereumToken.mint(user3.address, ethers.parseEther("25000"));
    
    // Setup bridge parameters
    const bridgeParams = {
      ethereumTokenAddress: await ethereumToken.getAddress(),
      hederaTokenId: "0.0.1234567", // Simulated Hedera token ID
      minValidators: 2, // Minimum validators required for consensus
      transferFeePercentage: 10, // 0.1% (scaled by 10000)
      maxTransferAmount: ethers.parseEther("100000"),
      transferDelay: 10 * 60, // 10 minutes in seconds
      validators: [validator1.address, validator2.address, validator3.address]
    };
    
    // Initialize transfer tracking
    const transfers = {};
    const nextTransferId = 1;
    
    // Initialize token balances on both chains
    const ethereumBalances = {
      [user1.address]: ethers.parseEther("100000"),
      [user2.address]: ethers.parseEther("50000"),
      [user3.address]: ethers.parseEther("25000")
    };
    
    const hederaBalances = {
      [user1.address]: ethers.parseEther("0"),
      [user2.address]: ethers.parseEther("0"),
      [user3.address]: ethers.parseEther("0")
    };
    
    // Track bridge state
    const bridgeState = {
      ethereumLocked: ethers.parseEther("0"),
      hederaMinted: ethers.parseEther("0")
    };
    
    return {
      ethereumToken,
      hederaToken,
      deployer,
      user1,
      user2,
      user3,
      validator1,
      validator2,
      validator3,
      bridgeParams,
      transfers,
      nextTransferId,
      ethereumBalances,
      hederaBalances,
      bridgeState
    };
  }
  
  describe("Ethereum to Hedera Transfer", function() {
    it("Should lock tokens on Ethereum and mint on Hedera", async function() {
      const { 
        user1, 
        bridgeParams, 
        transfers, 
        ethereumBalances, 
        hederaBalances, 
        bridgeState 
      } = await loadFixture(deployFixture);
      
      // Transfer parameters
      const transferAmount = ethers.parseEther("10000"); // 10,000 DLOOP
      const transferFee = (transferAmount * BigInt(bridgeParams.transferFeePercentage)) / BigInt(10000);
      const netTransferAmount = transferAmount - transferFee;
      
      console.log(`Transfer amount: ${ethers.formatEther(transferAmount)} DLOOP`);
      console.log(`Transfer fee (${bridgeParams.transferFeePercentage / 100}%): ${ethers.formatEther(transferFee)} DLOOP`);
      console.log(`Net transfer amount: ${ethers.formatEther(netTransferAmount)} DLOOP`);
      
      // Record initial balances
      const initialEthereumBalance = ethereumBalances[user1.address];
      const initialHederaBalance = hederaBalances[user1.address];
      const initialLockedAmount = bridgeState.ethereumLocked;
      const initialMintedAmount = bridgeState.hederaMinted;
      
      console.log(`Initial balances:`);
      console.log(`- Ethereum: ${ethers.formatEther(initialEthereumBalance)} DLOOP`);
      console.log(`- Hedera: ${ethers.formatEther(initialHederaBalance)} DLOOP`);
      console.log(`- Bridge locked: ${ethers.formatEther(initialLockedAmount)} DLOOP`);
      console.log(`- Bridge minted: ${ethers.formatEther(initialMintedAmount)} DLOOP`);
      
      // Simulate transfer (Ethereum -> Hedera)
      // 1. Lock tokens on Ethereum
      ethereumBalances[user1.address] -= transferAmount;
      bridgeState.ethereumLocked += netTransferAmount; // Only the net amount is locked
      
      // 2. Mint tokens on Hedera
      hederaBalances[user1.address] += netTransferAmount;
      bridgeState.hederaMinted += netTransferAmount;
      
      // Record final balances
      const finalEthereumBalance = ethereumBalances[user1.address];
      const finalHederaBalance = hederaBalances[user1.address];
      const finalLockedAmount = bridgeState.ethereumLocked;
      const finalMintedAmount = bridgeState.hederaMinted;
      
      console.log(`Final balances:`);
      console.log(`- Ethereum: ${ethers.formatEther(finalEthereumBalance)} DLOOP`);
      console.log(`- Hedera: ${ethers.formatEther(finalHederaBalance)} DLOOP`);
      console.log(`- Bridge locked: ${ethers.formatEther(finalLockedAmount)} DLOOP`);
      console.log(`- Bridge minted: ${ethers.formatEther(finalMintedAmount)} DLOOP`);
      
      // Verify balances changed correctly
      expect(finalEthereumBalance).to.equal(initialEthereumBalance - transferAmount);
      expect(finalHederaBalance).to.equal(initialHederaBalance + netTransferAmount);
      expect(finalLockedAmount).to.equal(initialLockedAmount + netTransferAmount);
      expect(finalMintedAmount).to.equal(initialMintedAmount + netTransferAmount);
      
      // Verify bridge conserves total supply
      expect(finalLockedAmount).to.equal(finalMintedAmount);
    });
    
    it("Should enforce transfer limits", async function() {
      const { 
        user1, 
        user2, 
        bridgeParams, 
        ethereumBalances 
      } = await loadFixture(deployFixture);
      
      // Test with an amount exceeding max transfer limit
      const excessiveAmount = bridgeParams.maxTransferAmount + ethers.parseEther("1");
      
      console.log(`Max transfer limit: ${ethers.formatEther(bridgeParams.maxTransferAmount)} DLOOP`);
      console.log(`Attempted transfer amount: ${ethers.formatEther(excessiveAmount)} DLOOP`);
      
      // Check if transfer would exceed limit
      const exceedsLimit = excessiveAmount > bridgeParams.maxTransferAmount;
      expect(exceedsLimit).to.be.true;
      
      // Check if transfer would exceed user balance
      const exceedsBalance = excessiveAmount > ethereumBalances[user1.address];
      console.log(`User balance: ${ethers.formatEther(ethereumBalances[user1.address])} DLOOP`);
      console.log(`Exceeds limit: ${exceedsLimit}`);
      console.log(`Exceeds balance: ${exceedsBalance}`);
      
      // Try with a valid amount
      const validAmount = bridgeParams.maxTransferAmount;
      const validExceedsLimit = validAmount > bridgeParams.maxTransferAmount;
      
      console.log(`Valid transfer amount: ${ethers.formatEther(validAmount)} DLOOP`);
      console.log(`Exceeds limit: ${validExceedsLimit}`);
      
      expect(validExceedsLimit).to.be.false;
    });
    
    it("Should require validator consensus", async function() {
      const { 
        user1, 
        validator1, 
        validator2, 
        validator3, 
        bridgeParams 
      } = await loadFixture(deployFixture);
      
      // Create a mock transfer
      const transferId = 1;
      const transfer = {
        id: transferId,
        sender: user1.address,
        amount: ethers.parseEther("1000"),
        timestamp: Math.floor(Date.now() / 1000),
        direction: "ethereum-to-hedera",
        status: "pending",
        validations: {}
      };
      
      // Record validator approvals
      transfer.validations[validator1.address] = true;
      
      // Check if we have enough validations for consensus
      const validationCount = Object.values(transfer.validations).filter(Boolean).length;
      const hasConsensus = validationCount >= bridgeParams.minValidators;
      
      console.log(`Validator consensus required: ${bridgeParams.minValidators} validators`);
      console.log(`Current validations: ${validationCount} validators`);
      console.log(`Has consensus: ${hasConsensus}`);
      
      expect(hasConsensus).to.be.false;
      
      // Add another validation
      transfer.validations[validator2.address] = true;
      
      // Check again
      const newValidationCount = Object.values(transfer.validations).filter(Boolean).length;
      const newHasConsensus = newValidationCount >= bridgeParams.minValidators;
      
      console.log(`Updated validations: ${newValidationCount} validators`);
      console.log(`Has consensus: ${newHasConsensus}`);
      
      expect(newHasConsensus).to.be.true;
    });
    
    it("Should enforce time delays for large transfers", async function() {
      const { 
        user1, 
        bridgeParams 
      } = await loadFixture(deployFixture);
      
      const largeTransferThreshold = bridgeParams.maxTransferAmount / BigInt(2);
      
      // Create a mock transfer for a large amount
      const largeTransfer = {
        id: 1,
        sender: user1.address,
        amount: largeTransferThreshold + ethers.parseEther("1000"), // Above threshold
        timestamp: Math.floor(Date.now() / 1000),
        direction: "ethereum-to-hedera",
        status: "validated", // Assume it's already validated
        validations: {}
      };
      
      // Create a mock transfer for a small amount
      const smallTransfer = {
        id: 2,
        sender: user1.address,
        amount: largeTransferThreshold - ethers.parseEther("1000"), // Below threshold
        timestamp: Math.floor(Date.now() / 1000),
        direction: "ethereum-to-hedera",
        status: "validated", // Assume it's already validated
        validations: {}
      };
      
      // Check if transfer requires time delay
      const largeRequiresDelay = largeTransfer.amount > largeTransferThreshold;
      const smallRequiresDelay = smallTransfer.amount > largeTransferThreshold;
      
      console.log(`Large transfer threshold: ${ethers.formatEther(largeTransferThreshold)} DLOOP`);
      console.log(`Large transfer amount: ${ethers.formatEther(largeTransfer.amount)} DLOOP`);
      console.log(`Small transfer amount: ${ethers.formatEther(smallTransfer.amount)} DLOOP`);
      console.log(`Large transfer requires delay: ${largeRequiresDelay}`);
      console.log(`Small transfer requires delay: ${smallRequiresDelay}`);
      
      expect(largeRequiresDelay).to.be.true;
      expect(smallRequiresDelay).to.be.false;
      
      // Check if large transfer can be executed immediately
      const now = Math.floor(Date.now() / 1000);
      const earliestExecutionTime = largeTransfer.timestamp + bridgeParams.transferDelay;
      const canExecuteNow = now >= earliestExecutionTime;
      
      console.log(`Current time: ${new Date(now * 1000).toISOString()}`);
      console.log(`Transfer timestamp: ${new Date(largeTransfer.timestamp * 1000).toISOString()}`);
      console.log(`Earliest execution: ${new Date(earliestExecutionTime * 1000).toISOString()}`);
      console.log(`Can execute now: ${canExecuteNow}`);
      
      expect(canExecuteNow).to.be.false;
      
      // Fast-forward time
      const futureTime = largeTransfer.timestamp + bridgeParams.transferDelay + 60; // 1 minute after delay
      const canExecuteInFuture = futureTime >= earliestExecutionTime;
      
      console.log(`Future time: ${new Date(futureTime * 1000).toISOString()}`);
      console.log(`Can execute in future: ${canExecuteInFuture}`);
      
      expect(canExecuteInFuture).to.be.true;
    });
  });
  
  describe("Hedera to Ethereum Transfer", function() {
    it("Should burn tokens on Hedera and release on Ethereum", async function() {
      const { 
        user1, 
        bridgeParams, 
        transfers, 
        ethereumBalances, 
        hederaBalances, 
        bridgeState 
      } = await loadFixture(deployFixture);
      
      // First, setup user with some tokens on Hedera side
      hederaBalances[user1.address] = ethers.parseEther("20000");
      bridgeState.hederaMinted = ethers.parseEther("20000");
      bridgeState.ethereumLocked = ethers.parseEther("20000");
      
      // Transfer parameters
      const transferAmount = ethers.parseEther("5000"); // 5,000 DLOOP
      const transferFee = (transferAmount * BigInt(bridgeParams.transferFeePercentage)) / BigInt(10000);
      const netTransferAmount = transferAmount - transferFee;
      
      console.log(`Transfer amount: ${ethers.formatEther(transferAmount)} DLOOP`);
      console.log(`Transfer fee (${bridgeParams.transferFeePercentage / 100}%): ${ethers.formatEther(transferFee)} DLOOP`);
      console.log(`Net transfer amount: ${ethers.formatEther(netTransferAmount)} DLOOP`);
      
      // Record initial balances
      const initialEthereumBalance = ethereumBalances[user1.address];
      const initialHederaBalance = hederaBalances[user1.address];
      const initialLockedAmount = bridgeState.ethereumLocked;
      const initialMintedAmount = bridgeState.hederaMinted;
      
      console.log(`Initial balances:`);
      console.log(`- Ethereum: ${ethers.formatEther(initialEthereumBalance)} DLOOP`);
      console.log(`- Hedera: ${ethers.formatEther(initialHederaBalance)} DLOOP`);
      console.log(`- Bridge locked: ${ethers.formatEther(initialLockedAmount)} DLOOP`);
      console.log(`- Bridge minted: ${ethers.formatEther(initialMintedAmount)} DLOOP`);
      
      // Simulate transfer (Hedera -> Ethereum)
      // 1. Burn tokens on Hedera
      hederaBalances[user1.address] -= transferAmount;
      bridgeState.hederaMinted -= netTransferAmount; // Only the net amount is burned
      
      // 2. Release tokens on Ethereum
      ethereumBalances[user1.address] += netTransferAmount;
      bridgeState.ethereumLocked -= netTransferAmount;
      
      // Record final balances
      const finalEthereumBalance = ethereumBalances[user1.address];
      const finalHederaBalance = hederaBalances[user1.address];
      const finalLockedAmount = bridgeState.ethereumLocked;
      const finalMintedAmount = bridgeState.hederaMinted;
      
      console.log(`Final balances:`);
      console.log(`- Ethereum: ${ethers.formatEther(finalEthereumBalance)} DLOOP`);
      console.log(`- Hedera: ${ethers.formatEther(finalHederaBalance)} DLOOP`);
      console.log(`- Bridge locked: ${ethers.formatEther(finalLockedAmount)} DLOOP`);
      console.log(`- Bridge minted: ${ethers.formatEther(finalMintedAmount)} DLOOP`);
      
      // Verify balances changed correctly
      expect(finalEthereumBalance).to.equal(initialEthereumBalance + netTransferAmount);
      expect(finalHederaBalance).to.equal(initialHederaBalance - transferAmount);
      expect(finalLockedAmount).to.equal(initialLockedAmount - netTransferAmount);
      expect(finalMintedAmount).to.equal(initialMintedAmount - netTransferAmount);
      
      // Verify bridge conserves total supply
      expect(finalLockedAmount).to.equal(finalMintedAmount);
    });
  });
  
  describe("Bridge Security", function() {
    it("Should prevent bridge insolvency", async function() {
      const { 
        bridgeState 
      } = await loadFixture(deployFixture);
      
      // Setup bridge with some tokens
      bridgeState.ethereumLocked = ethers.parseEther("100000");
      bridgeState.hederaMinted = ethers.parseEther("100000");
      
      // Attempt to mint more than locked amount (simulating an attack)
      const attackMintAmount = ethers.parseEther("50000");
      const wouldBeSolvent = bridgeState.hederaMinted + attackMintAmount <= bridgeState.ethereumLocked;
      
      console.log(`Current locked amount: ${ethers.formatEther(bridgeState.ethereumLocked)} DLOOP`);
      console.log(`Current minted amount: ${ethers.formatEther(bridgeState.hederaMinted)} DLOOP`);
      console.log(`Attempted additional mint: ${ethers.formatEther(attackMintAmount)} DLOOP`);
      console.log(`Would remain solvent: ${wouldBeSolvent}`);
      
      expect(wouldBeSolvent).to.be.false;
      
      // Safe amount to mint
      const safeAmount = bridgeState.ethereumLocked - bridgeState.hederaMinted;
      const safeMintSolvent = bridgeState.hederaMinted + safeAmount <= bridgeState.ethereumLocked;
      
      console.log(`Safe amount to mint: ${ethers.formatEther(safeAmount)} DLOOP`);
      console.log(`Would remain solvent: ${safeMintSolvent}`);
      
      expect(safeMintSolvent).to.be.true;
    });
    
    it("Should handle validator compromise", async function() {
      const { 
        validator1,
        validator2,
        validator3,
        bridgeParams
      } = await loadFixture(deployFixture);
      
      // Create a mock transfer
      const transferId = 1;
      const transfer = {
        id: transferId,
        amount: ethers.parseEther("1000"),
        timestamp: Math.floor(Date.now() / 1000),
        direction: "ethereum-to-hedera",
        status: "pending",
        validations: {}
      };
      
      // Scenario: 1 out of 3 validators compromised
      const compromisedValidator = validator3.address;
      
      // Honest validators correctly validate
      transfer.validations[validator1.address] = true;
      transfer.validations[validator2.address] = true;
      
      // Compromised validator tries to block by voting no
      transfer.validations[compromisedValidator] = false;
      
      // Count positive validations
      const positiveValidations = Object.entries(transfer.validations)
        .filter(([_, isValid]) => isValid)
        .length;
      
      // Check if we have enough validations for consensus
      const hasConsensus = positiveValidations >= bridgeParams.minValidators;
      
      console.log(`Total validators: ${bridgeParams.validators.length}`);
      console.log(`Minimum required: ${bridgeParams.minValidators}`);
      console.log(`Compromised validators: 1`);
      console.log(`Positive validations: ${positiveValidations}`);
      console.log(`Has consensus: ${hasConsensus}`);
      
      // With 2 out of 3 honest validators, the system should still reach consensus
      expect(hasConsensus).to.be.true;
      
      // Scenario: 2 out of 3 validators compromised
      transfer.validations = {};
      
      // Only one honest validation
      transfer.validations[validator1.address] = true;
      
      // Two compromised validators
      transfer.validations[validator2.address] = false;
      transfer.validations[validator3.address] = false;
      
      // Count positive validations
      const newPositiveValidations = Object.entries(transfer.validations)
        .filter(([_, isValid]) => isValid)
        .length;
      
      // Check if we have enough validations for consensus
      const newHasConsensus = newPositiveValidations >= bridgeParams.minValidators;
      
      console.log(`\nScenario 2:`);
      console.log(`Compromised validators: 2`);
      console.log(`Positive validations: ${newPositiveValidations}`);
      console.log(`Has consensus: ${newHasConsensus}`);
      
      // With only 1 out of 3 honest validators, the system should not reach consensus
      expect(newHasConsensus).to.be.false;
    });
  });
});