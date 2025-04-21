/**
 * @title Standalone Minimal SoulboundNFT Test
 * @dev Simplified test script for SoulboundNFT with proper connection to Hardhat node
 */

// Import required libraries
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Set a global timeout to ensure the script doesn't hang
const TIMEOUT_MS = 60000; // 60 seconds
setTimeout(() => {
  console.log("Test timed out after 60 seconds, exiting...");
  process.exit(1);
}, TIMEOUT_MS);

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

// Constants for roles (keccak256 hashes)
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Add logging of role hash values
console.log(`MINTER_ROLE hash: ${MINTER_ROLE}`);
console.log(`ADMIN_ROLE hash: ${ADMIN_ROLE}`);
console.log(`DEFAULT_ADMIN_ROLE hash: ${DEFAULT_ADMIN_ROLE}`);

// Note: The SoulboundNFT contract doesn't use a separate BURNER_ROLE
// It uses the ADMIN_ROLE for both admin actions and burning via the onlyAdminRole modifier

async function runMinimalTest() {
  try {
    console.log("Starting Minimal SoulboundNFT Test");
    
    // Initialize provider with connection retry
    const provider = await setupProvider();
    
    // Get accounts using the provider's getSigner method
    owner = await provider.getSigner(0);
    admin = await provider.getSigner(1);
    user1 = await provider.getSigner(2);
    
    // Store addresses for easier access
    owner.address = HARDHAT_ADDRESSES[0];
    admin.address = HARDHAT_ADDRESSES[1];
    user1.address = HARDHAT_ADDRESSES[2];
    
    console.log("Connected accounts:");
    console.log(`Owner: ${owner.address}`);
    console.log(`Admin: ${admin.address}`);
    console.log(`User1: ${user1.address}`);
    
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
    
    // Verify initial role setup
    console.log("\nVerifying initial role setup...");
    
    // Check owner has DEFAULT_ADMIN_ROLE (deployer)
    const ownerHasDefaultAdminRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, owner.address);
    console.log(`Owner has DEFAULT_ADMIN_ROLE: ${ownerHasDefaultAdminRole}`);
    
    // Check admin has ADMIN_ROLE
    const hasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, admin.address);
    console.log(`Admin has ADMIN_ROLE: ${hasAdminRole}`);
    
    // Check owner also has the ADMIN_ROLE
    const ownerHasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, owner.address);
    console.log(`Owner has ADMIN_ROLE: ${ownerHasAdminRole}`);
    
    // Verify admin does not have DEFAULT_ADMIN_ROLE
    const adminHasDefaultAdminRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    console.log(`Admin has DEFAULT_ADMIN_ROLE: ${adminHasDefaultAdminRole}`);
    
    // Test minting functionality
    console.log("\nTesting minting functionality...");
    
    // Grant minter role to user1 using owner who has DEFAULT_ADMIN_ROLE
    console.log("Granting MINTER_ROLE to user1 using owner (who has DEFAULT_ADMIN_ROLE)...");
    const grantTx = await soulboundNFT.connect(owner).grantRole(MINTER_ROLE, user1.address);
    await grantTx.wait();
    
    // Verify user1 has minter role
    const user1HasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, user1.address);
    console.log(`User1 has MINTER_ROLE: ${user1HasMinterRole}`);
    
    // User1 mints a token to admin
    console.log("User1 minting a token to admin...");
    const mintTx = await soulboundNFT.connect(user1).mint(admin.address, "ipfs://QmTestURI");
    await mintTx.wait();
    
    // Verify token was minted to admin
    const tokenCount = await soulboundNFT.getTokenCount();
    console.log(`Token count after mint: ${tokenCount}`);
    
    // Check token ownership
    const adminTokens = await soulboundNFT.getTokensByOwner(admin.address);
    console.log(`Admin tokens: ${adminTokens}`);
    
    // Test token validity
    const isValid = await soulboundNFT.isTokenValid(adminTokens[0]);
    console.log(`Token ${adminTokens[0]} is valid: ${isValid}`);
    
    // Test burning functionality
    console.log("\nTesting burning functionality...");
    
    // Admin burns the token (uses ADMIN_ROLE)
    console.log("Admin burning token...");
    const burnTx = await soulboundNFT.connect(admin).burn(adminTokens[0]);
    await burnTx.wait();
    
    // Verify the token is marked as revoked
    const tokenDetails = await soulboundNFT.getTokenDetails(adminTokens[0]);
    console.log(`Token ${adminTokens[0]} revoked status: ${tokenDetails[3]}`);
    
    console.log("\nMinimal SoulboundNFT test completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
runMinimalTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });