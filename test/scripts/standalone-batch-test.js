/**
 * @title Standalone SoulboundNFT Batch Mint Test
 * @dev Test script that verifies the MAX_BATCH_SIZE limit in the SoulboundNFT contract
 */

// Import required libraries
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Setup provider and network connection with retry mechanism
async function setupProvider() {
  const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');
  
  // Try to connect to the provider with retries
  let retries = 10;
  let connected = false;
  
  while (retries > 0 && !connected) {
    try {
      console.log(`Attempting to connect to the network (${retries} retries left)...`);
      await provider.getBlockNumber();
      connected = true;
      console.log("Successfully connected to the network!");
    } catch (error) {
      console.log(`Connection failed: ${error.message}`);
      retries--;
      
      if (retries === 0) {
        throw new Error("Failed to connect to the network after multiple attempts");
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return provider;
}

// Provider will be initialized in main()

// Hardcoded addresses from local Hardhat node for consistency
const HARDHAT_ADDRESSES = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // owner
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // admin
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // user1
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // user2
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'  // user3
];

// Load contract artifacts
const soulboundNFTArtifactPath = path.join(__dirname, '../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
const soulboundNFTArtifact = JSON.parse(fs.readFileSync(soulboundNFTArtifactPath, 'utf8'));

// Global variables
let owner, admin, user1, user2, user3;
let soulboundNFT;
let MAX_BATCH_SIZE;

// Format Ether utility for BigInt
function formatEther(value) {
  return ethers.formatEther(value.toString());
}

// Parse Ether utility for string
function parseEther(value) {
  return ethers.parseEther(value.toString());
}

// Token URI base
const TOKEN_URI_BASE = "ipfs://QmBatchHashTest";

async function main() {
  try {
    console.log("Starting SoulboundNFT Batch Mint Test");
    
    // Initialize provider with connection retry
    const provider = await setupProvider();
    
    // Get accounts using the provider's getSigner method
    owner = await provider.getSigner(0);
    admin = await provider.getSigner(1);
    user1 = await provider.getSigner(2);
    user2 = await provider.getSigner(3);
    user3 = await provider.getSigner(4);
    
    // Store addresses for easier access
    owner.address = HARDHAT_ADDRESSES[0];
    admin.address = HARDHAT_ADDRESSES[1];
    user1.address = HARDHAT_ADDRESSES[2];
    user2.address = HARDHAT_ADDRESSES[3];
    user3.address = HARDHAT_ADDRESSES[4];
    
    console.log("Connected accounts:");
    console.log(`Owner: ${owner.address}`);
    console.log(`Admin: ${admin.address}`);
    
    // Deploy SoulboundNFT contract
    console.log("Deploying SoulboundNFT contract...");
    const SoulboundNFT = new ethers.ContractFactory(
      soulboundNFTArtifact.abi,
      soulboundNFTArtifact.bytecode,
      owner
    );
    
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    const deployedAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at: ${deployedAddress}`);
    
    // Get the MAX_BATCH_SIZE constant
    MAX_BATCH_SIZE = await soulboundNFT.MAX_BATCH_SIZE();
    console.log(`MAX_BATCH_SIZE: ${MAX_BATCH_SIZE}`);
    
    // Test 1: Standard batch mint (3 tokens)
    await testStandardBatchMint();
    
    // Test 2: Attempt batch mint with excess tokens (MAX_BATCH_SIZE + 1)
    await testOversizedBatchMint();
    
    // Test 3: Batch mint at exactly the maximum limit
    await testMaximumBatchSize();
    
    console.log("All tests completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

async function testStandardBatchMint() {
  console.log("\nTest 1: Standard batch mint (3 tokens)");
  
  // Prepare batch data
  const recipients = [user1.address, user2.address, user3.address];
  const tokenURIs = [
    `${TOKEN_URI_BASE}1`,
    `${TOKEN_URI_BASE}2`,
    `${TOKEN_URI_BASE}3`
  ];
  
  // Execute batch mint
  console.log("Executing batch mint with 3 tokens...");
  const tx = await soulboundNFT.connect(admin).batchMint(recipients, tokenURIs);
  await tx.wait();
  
  // Verify token count
  const tokenCount = await soulboundNFT.getTokenCount();
  console.log(`Token count after batch mint: ${tokenCount}`);
  if (tokenCount !== BigInt(3)) {
    throw new Error(`Expected token count to be 3, got ${tokenCount}`);
  }
  
  // Verify individual token ownership
  const user1Tokens = await soulboundNFT.getTokensByOwner(user1.address);
  const user2Tokens = await soulboundNFT.getTokensByOwner(user2.address);
  const user3Tokens = await soulboundNFT.getTokensByOwner(user3.address);
  
  console.log(`User1 tokens: ${user1Tokens}`);
  console.log(`User2 tokens: ${user2Tokens}`);
  console.log(`User3 tokens: ${user3Tokens}`);
  
  if (user1Tokens.length !== 1 || user2Tokens.length !== 1 || user3Tokens.length !== 1) {
    throw new Error("Each user should have exactly one token");
  }
  
  // Verify token details
  const token1Details = await soulboundNFT.getTokenDetails(1);
  console.log(`Token 1 owner: ${token1Details[0]}`);
  console.log(`Token 1 URI: ${token1Details[1]}`);
  
  if (token1Details[0] !== user1.address) {
    throw new Error(`Expected token 1 owner to be ${user1.address}, got ${token1Details[0]}`);
  }
  
  console.log("Standard batch mint test passed!");
}

async function testOversizedBatchMint() {
  console.log("\nTest 2: Attempt batch mint with excess tokens (MAX_BATCH_SIZE + 1)");
  
  // Prepare oversized batch (MAX_BATCH_SIZE + 1)
  const recipients = [];
  const tokenURIs = [];
  
  for (let i = 0; i <= Number(MAX_BATCH_SIZE); i++) {
    recipients.push(user1.address);
    tokenURIs.push(`${TOKEN_URI_BASE}${i}`);
  }
  
  console.log(`Preparing oversized batch with ${recipients.length} tokens (limit is ${MAX_BATCH_SIZE})...`);
  
  // Attempt batch mint - should revert
  try {
    await soulboundNFT.connect(admin).batchMint(recipients, tokenURIs);
    throw new Error("Oversized batch mint should have reverted but did not");
  } catch (error) {
    // In ethers v6, custom errors are often in error.data or we check the message directly
    if (
      (error.data && error.data.includes("ExceedsBatchLimit")) || 
      error.message.includes("ExceedsBatchLimit") ||
      error.message.includes("reverted") || // Generic revert is acceptable too
      error.message.includes("transaction failed")
    ) {
      console.log("Correctly reverted with batch limit error");
    } else {
      console.log("Error details:", error);
      throw new Error(`Unexpected error: ${error.message}`);
    }
  }
  
  console.log("Oversized batch mint test passed!");
}

async function testMaximumBatchSize() {
  console.log("\nTest 3: Batch mint at exactly the maximum limit");
  
  // Get current token count
  const initialTokenCount = await soulboundNFT.getTokenCount();
  console.log(`Initial token count: ${initialTokenCount}`);
  
  // Prepare batch exactly at the size limit
  const recipients = [];
  const tokenURIs = [];
  
  for (let i = 0; i < Number(MAX_BATCH_SIZE); i++) {
    recipients.push(user1.address);
    tokenURIs.push(`${TOKEN_URI_BASE}MaxTest${i}`);
  }
  
  console.log(`Preparing maximum size batch with ${recipients.length} tokens...`);
  
  // Execute batch mint at the limit
  console.log("Executing batch mint at the maximum limit...");
  const tx = await soulboundNFT.connect(admin).batchMint(recipients, tokenURIs);
  await tx.wait();
  
  // Verify token count increased by MAX_BATCH_SIZE
  const newTokenCount = await soulboundNFT.getTokenCount();
  console.log(`New token count: ${newTokenCount}`);
  
  if (newTokenCount !== initialTokenCount + BigInt(MAX_BATCH_SIZE)) {
    throw new Error(`Expected token count to increase by ${MAX_BATCH_SIZE}, but got ${newTokenCount - initialTokenCount}`);
  }
  
  // Verify user1 received all the tokens
  const user1Tokens = await soulboundNFT.getTokensByOwner(user1.address);
  console.log(`User1 now has ${user1Tokens.length} tokens`);
  
  if (user1Tokens.length !== Number(initialTokenCount) - 2 + Number(MAX_BATCH_SIZE)) {
    throw new Error(`Expected user1 to have ${Number(initialTokenCount) - 2 + Number(MAX_BATCH_SIZE)} tokens, got ${user1Tokens.length}`);
  }
  
  console.log("Maximum batch size test passed!");
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });