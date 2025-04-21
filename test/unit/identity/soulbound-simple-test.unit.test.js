/**
 * Simplified SoulboundNFT Test
 * This test works with an external Hardhat node running on 0.0.0.0:8545
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Configuration
const RPC_URL = "http://0.0.0.0:8545";

// Main test function
async function main() {
  console.log("Starting Simplified SoulboundNFT Test");
  
  try {
    // Connect to the Hardhat node
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Connected to provider");
    
    // Create predefined hardhat wallet addresses (from the output in the console)
    const ownerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const adminAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const user1Address = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const user2Address = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    
    console.log(`Owner: ${ownerAddress}`);
    console.log(`Admin: ${adminAddress}`);
    console.log(`User1: ${user1Address}`);
    console.log(`User2: ${user2Address}`);
    
    // Create wallet instances with direct signer creating functionality
    const owner = provider.getSigner(0);  // First account
    const admin = provider.getSigner(1);  // Second account
    const user1 = provider.getSigner(2);  // Third account
    const user2 = provider.getSigner(3);  // Fourth account
    
    // Load the SoulboundNFT contract artifact
    const artifactPath = path.join(__dirname, "../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json");
    const contractData = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    // Deploy the SoulboundNFT contract
    console.log("Deploying SoulboundNFT...");
    const factory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      owner
    );
    
    const soulboundNFT = await factory.deploy(adminAddress);
    await soulboundNFT.waitForDeployment();
    const contractAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at: ${contractAddress}`);
    
    // Test 1: Verify admin role
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const adminHasRole = await soulboundNFT.hasRole(ADMIN_ROLE, adminAddress);
    console.log(`Test 1: Admin has admin role: ${adminHasRole}`);
    
    // Test 2: Grant minter role to user1
    console.log("Test 2: Granting minter role to user1");
    const soulboundNFTAsAdmin = new ethers.Contract(
      contractAddress,
      contractData.abi,
      admin
    );
    
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const tx1 = await soulboundNFTAsAdmin.grantMinterRole(user1Address);
    await tx1.wait();
    
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, user1Address);
    console.log(`User1 has minter role: ${hasMinterRole}`);
    
    // Test 3: Mint token
    console.log("Test 3: Minting token");
    const soulboundNFTAsUser1 = new ethers.Contract(
      contractAddress,
      contractData.abi,
      user1
    );
    
    const tokenURI = "ipfs://QmTestURI";
    const tx2 = await soulboundNFTAsUser1.mint(user2Address, tokenURI);
    await tx2.wait();
    
    // Check token ownership
    const tokenId = 1; // First token ID should be 1
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    
    console.log(`Token owner: ${tokenDetails[0]}`);
    console.log(`Token URI: ${tokenDetails[1]}`);
    console.log(`Token valid: ${!tokenDetails[3]}`); // not revoked = valid
    
    const correctOwner = tokenDetails[0].toLowerCase() === user2Address.toLowerCase();
    const correctURI = tokenDetails[1] === tokenURI;
    
    console.log(`Token has correct owner: ${correctOwner}`);
    console.log(`Token has correct URI: ${correctURI}`);
    
    // Test 4: Batch mint
    console.log("Test 4: Batch minting");
    const recipients = [user1Address, user2Address, adminAddress];
    const tokenURIs = [
      "ipfs://QmBatch1",
      "ipfs://QmBatch2",
      "ipfs://QmBatch3"
    ];
    
    const tx3 = await soulboundNFTAsUser1.batchMint(recipients, tokenURIs);
    await tx3.wait();
    
    // Verify batch tokens
    const batchTokenId = 2; // Second token should be ID 2
    const batchToken = await soulboundNFT.getTokenDetails(batchTokenId);
    
    console.log(`Batch token owner: ${batchToken[0]}`);
    console.log(`Batch token URI: ${batchToken[1]}`);
    
    // Test 5: Get token count
    const count = await soulboundNFT.getTokenCount();
    console.log(`Total token count: ${count}`);
    
    // Test 6: Verify token validity
    const isTokenValid = await soulboundNFT.isTokenValid(tokenId);
    console.log(`Token ${tokenId} is valid: ${isTokenValid}`);
    
    const userHasValid = await soulboundNFT.hasValidToken(user2Address);
    console.log(`User2 has valid token: ${userHasValid}`);
    
    // Test 7: Revoke token
    console.log("Test 7: Revoking token");
    const tx4 = await soulboundNFTAsAdmin.revoke(tokenId);
    await tx4.wait();
    
    const tokenAfterRevoke = await soulboundNFT.getTokenDetails(tokenId);
    const isRevoked = tokenAfterRevoke[3];
    console.log(`Token ${tokenId} is revoked: ${isRevoked}`);
    
    const isValidAfterRevoke = await soulboundNFT.isTokenValid(tokenId);
    console.log(`Token ${tokenId} is valid after revoke: ${isValidAfterRevoke}`);
    
    console.log("All tests completed successfully!");
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
main().catch(error => {
  console.error(error);
  process.exit(1);
});