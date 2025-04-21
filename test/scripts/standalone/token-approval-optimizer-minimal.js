/**
 * Standalone Minimal Test for TokenApprovalOptimizer
 * 
 * This test verifies that the TokenApprovalOptimizer contract correctly implements
 * the transferTokens method which is required by FeeCalculator.
 */

// Import ethers v6 compatibility shim
require('../../ethers-v6-shim.standalone');

// Improved imports with retry logic
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Get contract artifacts
const TokenApprovalOptimizerArtifact = require('../../artifacts/contracts/utils/TokenApprovalOptimizer.sol/TokenApprovalOptimizer.json');
const MockTokenArtifact = require('../../artifacts/test/mocks/MockToken.sol/MockToken.json');

// Constants
const PROVIDER_URL = 'http://127.0.0.1:8545';
const MAX_RETRIES = 10;
const RETRY_DELAY = 1000; // 1 second

// Main test function
async function main() {
  console.log("Starting TokenApprovalOptimizer Minimal Test");
  
  let provider;
  let signer;
  let accounts;
  
  // Connect to network with retry
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      console.log(`Attempting to connect to the network (${MAX_RETRIES - i} retries left)...`);
      provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      await provider.getBlockNumber(); // Test the connection
      
      // Get accounts
      accounts = await provider.listAccounts();
      signer = await provider.getSigner(accounts[0].address);
      console.log("Connected to Hardhat node successfully!");
      console.log(`Using account: ${await signer.getAddress()}`);
      break;
    } catch (error) {
      console.log(`Connection failed: ${error.message}`);
      if (i === MAX_RETRIES - 1) {
        console.error("Test failed: Error: Failed to connect to Hardhat node after multiple attempts");
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  try {
    // Deploy mock token
    console.log("Deploying MockToken...");
    const MockToken = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      signer
    );
    
    const mockToken = await MockToken.deploy("Test Token", "TEST", 18);
    await mockToken.deploymentTransaction().wait();
    
    console.log(`MockToken deployed at: ${await mockToken.getAddress()}`);
    
    // Deploy TokenApprovalOptimizer
    console.log("Deploying TokenApprovalOptimizer...");
    const TokenApprovalOptimizer = new ethers.ContractFactory(
      TokenApprovalOptimizerArtifact.abi,
      TokenApprovalOptimizerArtifact.bytecode,
      signer
    );
    
    const tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy(20); // 20% threshold
    await tokenApprovalOptimizer.deploymentTransaction().wait();
    
    console.log(`TokenApprovalOptimizer deployed at: ${await tokenApprovalOptimizer.getAddress()}`);
    
    // Mint tokens
    const mintAmount = ethers.parseEther("100");
    console.log(`Minting ${ethers.formatEther(mintAmount)} tokens to TokenApprovalOptimizer...`);
    
    const optimizerAddress = await tokenApprovalOptimizer.getAddress();
    await mockToken.mint(optimizerAddress, mintAmount);
    
    // Check initial balance
    const initialBalance = await mockToken.balanceOf(optimizerAddress);
    console.log(`Initial balance of optimizer: ${ethers.formatEther(initialBalance)}`);
    
    if (initialBalance.toString() !== mintAmount.toString()) {
      throw new Error(`Expected balance to be ${mintAmount}, got ${initialBalance}`);
    }
    
    // Test transferTokens
    console.log("Testing transferTokens method...");
    const recipient = accounts[1].address;
    const transferAmount = ethers.parseEther("50");
    
    // Get initial recipient balance
    const initialRecipientBalance = await mockToken.balanceOf(recipient);
    console.log(`Initial balance of recipient: ${ethers.formatEther(initialRecipientBalance)}`);
    
    // Execute transferTokens
    const tx = await tokenApprovalOptimizer.transferTokens(
      await mockToken.getAddress(),
      recipient,
      transferAmount
    );
    await tx.wait();
    
    // Check final balances
    const finalOptimizerBalance = await mockToken.balanceOf(optimizerAddress);
    const finalRecipientBalance = await mockToken.balanceOf(recipient);
    
    console.log(`Final balance of optimizer: ${ethers.formatEther(finalOptimizerBalance)}`);
    console.log(`Final balance of recipient: ${ethers.formatEther(finalRecipientBalance)}`);
    
    // Verify balances
    if (finalOptimizerBalance.toString() !== (mintAmount - transferAmount).toString()) {
      throw new Error(`Expected final optimizer balance to be ${mintAmount - transferAmount}, got ${finalOptimizerBalance}`);
    }
    
    if (finalRecipientBalance.toString() !== (initialRecipientBalance + transferAmount).toString()) {
      throw new Error(`Expected final recipient balance to be ${initialRecipientBalance + transferAmount}, got ${finalRecipientBalance}`);
    }
    
    console.log("✅ TokenApprovalOptimizer transferTokens test passed!");
    
    // Test error case - try to transfer more than available
    console.log("Testing error case - transferring more than available...");
    const excessiveAmount = ethers.parseEther("200");
    
    try {
      await tokenApprovalOptimizer.transferTokens(
        await mockToken.getAddress(),
        recipient,
        excessiveAmount
      );
      throw new Error("Test failed: This transaction should have failed but didn't");
    } catch (error) {
      if (error.message.includes("Insufficient balance for transfer")) {
        console.log("✅ Error case test passed: Got expected 'Insufficient balance for transfer' error");
      } else {
        console.error("❌ Error case test failed: Got unexpected error:", error.message);
        throw error;
      }
    }
    
    console.log("All tests passed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);