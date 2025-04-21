/**
 * Standalone SoulboundNFT Test
 * This file tests the SoulboundNFT contract functionality
 */

// Import required modules directly from hardhat
const { ethers } = require("hardhat");

// Constants for role identifiers
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
// In Ethers v6, keccak256 and toUtf8Bytes are direct methods instead of being under utils
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
const REVOKER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('REVOKER_ROLE'));

// Function to check if addresses are the same (case-insensitive comparison)
function isSameAddress(addr1, addr2) {
  if (!addr1 || !addr2) return false;
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// Main test function
async function main() {
  try {
    console.log('Starting SoulboundNFT test...');
    
    // Get signers from hardhat
    const signers = await ethers.getSigners();
    const admin = signers[0];
    const user1 = signers[1];
    const user2 = signers[2];
    
    console.log(`Admin address: ${admin.address}`);
    console.log(`User1 address: ${user1.address}`);
    console.log(`User2 address: ${user2.address}`);
    
    // Create and deploy the SoulboundNFT contract
    console.log('Deploying SoulboundNFT contract...');
    const SoulboundNFTFactory = await ethers.getContractFactory('SoulboundNFT', admin);
    const soulboundNFT = await SoulboundNFTFactory.deploy("DLoop Identity", "DLOOP", admin.address);
    
    // Wait for contract deployment
    // In Ethers v6, we use waitForDeployment instead of deployed
    await soulboundNFT.waitForDeployment();
    // In Ethers v6, we use getAddress() instead of .address
    const contractAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at: ${contractAddress}`);
    
    // Verify admin has the admin role
    const hasAdminRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    console.log(`Admin has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
    
    // Grant minter role to user1
    console.log('Granting MINTER_ROLE to user1...');
    await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, user1.address);
    
    // Verify user1 has minter role
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, user1.address);
    console.log(`User1 has MINTER_ROLE: ${hasMinterRole}`);
    
    // Grant revoker role to user2
    console.log('Granting REVOKER_ROLE to user2...');
    await soulboundNFT.connect(admin).grantRole(REVOKER_ROLE, user2.address);
    
    // Verify user2 has revoker role
    const hasRevokerRole = await soulboundNFT.hasRole(REVOKER_ROLE, user2.address);
    console.log(`User2 has REVOKER_ROLE: ${hasRevokerRole}`);
    
    // Mint an NFT as user1 to admin
    console.log('Minting an NFT as user1 to admin...');
    await soulboundNFT.connect(user1).safeMint(admin.address, "Test URI");
    
    // Check that admin owns token ID 0
    const ownerOfToken0 = await soulboundNFT.ownerOf(0);
    console.log(`Owner of token 0: ${ownerOfToken0}`);
    console.log(`Is owner the admin? ${isSameAddress(ownerOfToken0, admin.address)}`);
    
    // Get token count of admin
    const adminTokenCount = await soulboundNFT.balanceOf(admin.address);
    console.log(`Admin token count: ${adminTokenCount}`);
    
    // Mint another NFT as user1 to user2
    console.log('Minting an NFT as user1 to user2...');
    await soulboundNFT.connect(user1).safeMint(user2.address, "User2 Token URI");
    
    // Check that user2 owns token ID 1
    const ownerOfToken1 = await soulboundNFT.ownerOf(1);
    console.log(`Owner of token 1: ${ownerOfToken1}`);
    console.log(`Is owner user2? ${isSameAddress(ownerOfToken1, user2.address)}`);
    
    // Try to transfer token 0 from admin to user1 (should fail)
    try {
      console.log('Attempting to transfer token 0 from admin to user1 (should fail)...');
      await soulboundNFT.connect(admin).transferFrom(admin.address, user1.address, 0);
      console.error('ERROR: Transfer should have failed but succeeded');
    } catch (error) {
      console.log('SUCCESS: Transfer failed as expected - SoulboundNFT cannot be transferred');
    }
    
    // Revoke token 0 from admin as user2
    console.log('Revoking token 0 from admin as user2...');
    await soulboundNFT.connect(user2).revoke(0);
    
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
  }
}

// Execute the test
main();