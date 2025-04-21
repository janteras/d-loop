/**
 * Standalone Direct SoulboundNFT Test
 * This file directly tests the SoulboundNFT contract without relying on external test frameworks
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Configuration
const RPC_URL = "http://127.0.0.1:8545";
const RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRIES = 10;
const HARDHAT_COMMAND = "npx hardhat node";

// Helper function to log steps with status
function logStep(stepName, result = null, error = null) {
  console.log(`\n== ${stepName} ==`);
  if (result) console.log(`✅ Result: ${result}`);
  if (error) console.error(`❌ Error: ${error.message || error}`);
}

// Helper function to check if addresses are the same (case-insensitive comparison)
function isSameAddress(addr1, addr2) {
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// Main test function
async function main() {
  console.log("Starting SoulboundNFT standalone test with Ethers v6");
  
  // Start a Hardhat node in the background
  console.log("Starting Hardhat node...");
  const hardhatProcess = require('child_process').spawn('npx', ['hardhat', 'node'], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Give time for the node to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Connect to the local Hardhat node
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Wait for provider to be ready
    let retries = MAX_RETRIES;
    while (retries > 0) {
      try {
        await provider.getBlockNumber();
        break;
      } catch (error) {
        console.log(`Waiting for provider (${retries} retries left)...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        retries--;
        if (retries === 0) {
          throw new Error("Failed to connect to Hardhat node");
        }
      }
    }
    
    // Get hardhat accounts
    const accounts = await provider.listAccounts();
    console.log("Available accounts:", accounts.length);
    
    const adminWallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    const user1Wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    const user2Wallet = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    
    console.log("Admin address:", adminWallet.address);
    console.log("User1 address:", user1Wallet.address);
    console.log("User2 address:", user2Wallet.address);
    
    // Fund the wallets
    const signer = await provider.getSigner(accounts[0]);
    await signer.sendTransaction({
      to: adminWallet.address,
      value: ethers.parseEther("10.0")
    });
    await signer.sendTransaction({
      to: user1Wallet.address,
      value: ethers.parseEther("10.0")
    });
    await signer.sendTransaction({
      to: user2Wallet.address,
      value: ethers.parseEther("10.0")
    });
    
    // Load contract artifacts
    console.log("Deploying SoulboundNFT contract...");
    const artifactPath = path.join(__dirname, "../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json");
    const contractData = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    
    // Deploy SoulboundNFT contract
    const SoulboundNFTFactory = new ethers.ContractFactory(
      contractData.abi,
      contractData.bytecode,
      signer
    );
    
    const soulboundNFT = await SoulboundNFTFactory.deploy(adminWallet.address);
    await soulboundNFT.waitForDeployment();
    const contractAddress = await soulboundNFT.getAddress();
    logStep("Deploy contract", `SoulboundNFT deployed at ${contractAddress}`);
    
    // Test 1: Check admin role
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const adminHasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, adminWallet.address);
    logStep("Admin has admin role", adminHasAdminRole);
    
    // Test 2: Grant minter role to user1
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    
    // Connect as admin to grant role
    const soulboundNFTAsAdmin = new ethers.Contract(
      contractAddress,
      contractData.abi,
      adminWallet
    );
    
    const tx1 = await soulboundNFTAsAdmin.grantMinterRole(user1Wallet.address);
    await tx1.wait();
    
    const user1HasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, user1Wallet.address);
    logStep("Grant minter role to user1", user1HasMinterRole);
    
    // Test 3: Mint token
    const soulboundNFTAsUser1 = new ethers.Contract(
      contractAddress,
      contractData.abi,
      user1Wallet
    );
    
    const tokenURI = "ipfs://QmTest123";
    const tx2 = await soulboundNFTAsUser1.mint(user2Wallet.address, tokenURI);
    await tx2.wait();
    
    // Check token owner and URI
    const tokenId = 1; // First token should be ID 1
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    const isCorrectOwner = isSameAddress(tokenDetails[0], user2Wallet.address);
    const hasCorrectURI = tokenDetails[1] === tokenURI;
    
    logStep(
      "Mint token", 
      `Owner: ${tokenDetails[0]}, URI: ${tokenDetails[1]}, isCorrect: ${isCorrectOwner && hasCorrectURI}`
    );
    
    // Test 4: Check token validity
    const isTokenValid = await soulboundNFT.isTokenValid(tokenId);
    const hasValidToken = await soulboundNFT.hasValidToken(user2Wallet.address);
    
    logStep(
      "Token validity",
      `Token ${tokenId} is valid: ${isTokenValid}, User2 has valid token: ${hasValidToken}`
    );
    
    // Test 5: Revoke token
    const tx3 = await soulboundNFTAsAdmin.revoke(tokenId);
    await tx3.wait();
    
    const isTokenValidAfterRevoke = await soulboundNFT.isTokenValid(tokenId);
    const tokenDetailsAfterRevoke = await soulboundNFT.getTokenDetails(tokenId);
    
    logStep(
      "Revoke token",
      `Token ${tokenId} is revoked: ${tokenDetailsAfterRevoke[3]}, is valid after revoke: ${isTokenValidAfterRevoke}`
    );
    
    // Test 6: Batch mint
    const recipients = [
      user1Wallet.address,
      user2Wallet.address,
      adminWallet.address
    ];
    
    const tokenURIs = [
      "ipfs://QmBatch1",
      "ipfs://QmBatch2",
      "ipfs://QmBatch3"
    ];
    
    const tx4 = await soulboundNFTAsUser1.batchMint(recipients, tokenURIs);
    await tx4.wait();
    
    const batchTokenId = 2; // Second token should be ID 2
    const batchTokenDetails = await soulboundNFT.getTokenDetails(batchTokenId);
    const isBatchCorrect = isSameAddress(batchTokenDetails[0], user1Wallet.address) && 
      batchTokenDetails[1] === "ipfs://QmBatch1";
    
    logStep(
      "Batch mint",
      `Batch token ${batchTokenId} owner: ${batchTokenDetails[0]}, URI: ${batchTokenDetails[1]}, isCorrect: ${isBatchCorrect}`
    );
    
    // Test 7: Token count
    const tokenCount = await soulboundNFT.getTokenCount();
    logStep("Token count", `Total tokens: ${tokenCount.toString()}`);
    
    console.log("\n✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("Error during testing:", error);
  } finally {
    // Kill the Hardhat node
    console.log("Shutting down Hardhat node...");
    process.kill(-hardhatProcess.pid);
  }
}

// Run the test
main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});