/**
 * Standalone SoulboundNFT Test - Ethers v6 Compatible Version
 * 
 * This test script launches its own Hardhat node and tests the SoulboundNFT contract
 * with full Ethers v6 compatibility.
 */

// Import required modules
const { spawn } = require('child_process');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Constants for role identifiers  
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const MINTER_ROLE = '0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6';
const REVOKER_ROLE = '0x6f972648e6ac7196e6abacd8e12d6489e38f2429f640d7686a30226cef49c79d';

// Helper function for address comparison
function isSameAddress(addr1, addr2) {
  if (!addr1 || !addr2) return false;
  return addr1.toLowerCase() === addr2.toLowerCase();
}

async function main() {
  let hardhatProcess;
  try {
    // Start Hardhat node
    console.log('Starting Hardhat node...');
    hardhatProcess = spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8545'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Give the node some time to initialize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Hardhat node started');

    // Connect to the local Hardhat node
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    
    // Get test accounts
    const accounts = await provider.listAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error('Failed to get accounts from Hardhat node');
    }
    
    const [admin, user1, user2] = accounts;
    console.log(`Admin address: ${admin}`);
    console.log(`User1 address: ${user1}`);
    console.log(`User2 address: ${user2}`);
    
    // Get admin signer
    const adminSigner = await provider.getSigner(admin);
    const user1Signer = await provider.getSigner(user1);
    const user2Signer = await provider.getSigner(user2);
    
    // Read contract artifacts
    const artifactPath = path.join(__dirname, '../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
    const contractArtifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    
    // Deploy SoulboundNFT contract
    console.log('Deploying SoulboundNFT contract...');
    const SoulboundNFTFactory = new ethers.ContractFactory(
      contractArtifact.abi,
      contractArtifact.bytecode,
      adminSigner
    );
    
    const soulboundNFT = await SoulboundNFTFactory.deploy("DLoop Identity", "DLOOP", admin);
    await soulboundNFT.waitForDeployment();
    const contractAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at: ${contractAddress}`);
    
    // Verify admin has the admin role
    const hasAdminRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, admin);
    console.log(`Admin has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
    
    // Grant minter role to user1
    console.log('Granting MINTER_ROLE to user1...');
    await soulboundNFT.connect(adminSigner).grantRole(MINTER_ROLE, user1);
    
    // Verify user1 has minter role
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, user1);
    console.log(`User1 has MINTER_ROLE: ${hasMinterRole}`);
    
    // Grant revoker role to user2
    console.log('Granting REVOKER_ROLE to user2...');
    await soulboundNFT.connect(adminSigner).grantRole(REVOKER_ROLE, user2);
    
    // Verify user2 has revoker role
    const hasRevokerRole = await soulboundNFT.hasRole(REVOKER_ROLE, user2);
    console.log(`User2 has REVOKER_ROLE: ${hasRevokerRole}`);
    
    // Mint an NFT as user1 to admin
    console.log('Minting an NFT as user1 to admin...');
    await soulboundNFT.connect(user1Signer).safeMint(admin, "Test URI");
    
    // Check that admin owns token ID 0
    const ownerOfToken0 = await soulboundNFT.ownerOf(0);
    console.log(`Owner of token 0: ${ownerOfToken0}`);
    console.log(`Is owner the admin? ${isSameAddress(ownerOfToken0, admin)}`);
    
    // Get token count of admin
    const adminTokenCount = await soulboundNFT.balanceOf(admin);
    console.log(`Admin token count: ${adminTokenCount}`);
    
    // Mint another NFT as user1 to user2
    console.log('Minting an NFT as user1 to user2...');
    await soulboundNFT.connect(user1Signer).safeMint(user2, "User2 Token URI");
    
    // Check that user2 owns token ID 1
    const ownerOfToken1 = await soulboundNFT.ownerOf(1);
    console.log(`Owner of token 1: ${ownerOfToken1}`);
    console.log(`Is owner user2? ${isSameAddress(ownerOfToken1, user2)}`);
    
    // Try to transfer token 0 from admin to user1 (should fail)
    try {
      console.log('Attempting to transfer token 0 from admin to user1 (should fail)...');
      await soulboundNFT.connect(adminSigner).transferFrom(admin, user1, 0);
      console.error('ERROR: Transfer should have failed but succeeded');
    } catch (error) {
      console.log('SUCCESS: Transfer failed as expected - SoulboundNFT cannot be transferred');
    }
    
    // Revoke token 0 from admin as user2
    console.log('Revoking token 0 from admin as user2...');
    await soulboundNFT.connect(user2Signer).revoke(0);
    
    // Try to check ownerOf token 0 (should fail)
    try {
      const ownerAfterBurn = await soulboundNFT.ownerOf(0);
      console.error(`ERROR: Token 0 still exists with owner: ${ownerAfterBurn}`);
    } catch (error) {
      console.log('SUCCESS: Token 0 was successfully revoked');
    }
    
    console.log('All tests passed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Stop Hardhat node process if it was started
    if (hardhatProcess) {
      console.log('Stopping Hardhat node...');
      hardhatProcess.kill();
    }
  }
}

// Execute the test
main();