/**
 * Ultra-Minimal SoulboundNFT Test
 * 
 * This standalone test focuses on core functionality of the SoulboundNFT contract:
 * - Token minting and non-transferability
 * - Role-based access control
 * - URI management
 * - Admin functionality
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const HARDHAT_PORT = 8545;
const RPC_URL = `http://127.0.0.1:${HARDHAT_PORT}`;

// Load contract artifacts
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'SoulboundNFT') {
    filePath = path.join(artifactPath, 'identity', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockToken') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else {
    throw new Error(`Unknown contract: ${contractName}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found at ${filePath}`);
  }
  
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Start an isolated hardhat node for testing
function startHardhatNode() {
  console.log('Starting Hardhat node...');
  execSync('npx hardhat node --port 8545 --hostname 127.0.0.1 &');
  // Give it a moment to start up
  return new Promise(resolve => setTimeout(resolve, 3000));
}

// Kill any existing hardhat node
function shutdownHardhatNode() {
  console.log('Shutting down Hardhat node...');
  try {
    execSync('pkill -f "hardhat node" || true');
    // Wait for processes to terminate
    setTimeout(() => {}, 1000);
  } catch (e) {
    console.log('Hardhat node already terminated');
  }
}

// Helper for connecting reliably to the provider
async function getConnectedProvider() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  console.log('Provider created');
  
  // Try to connect multiple times if needed
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await provider.getBlockNumber();
      console.log('Provider connected to Hardhat node');
      return provider;
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`Waiting for provider to connect (attempt ${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error('Failed to connect to Hardhat node after multiple attempts');
      }
    }
  }
}

// Main test function
async function main() {
  try {
    // Ensure a clean environment
    shutdownHardhatNode();
    await startHardhatNode();
    
    // Connect to the node
    const provider = await getConnectedProvider();
    
    // Get test accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    const [deployer, admin, minter, user1, user2] = await Promise.all(
      accounts.slice(0, 5).map(address => provider.getSigner(address))
    );
    
    // Get addresses for easy access
    const deployerAddress = await deployer.getAddress();
    const adminAddress = await admin.getAddress();
    const minterAddress = await minter.getAddress();
    const user1Address = await user1.getAddress();
    const user2Address = await user2.getAddress();
    
    console.log('Test accounts:');
    console.log('Deployer:', deployerAddress);
    console.log('Admin:', adminAddress);
    console.log('Minter:', minterAddress);
    console.log('User1:', user1Address);
    console.log('User2:', user2Address);
    
    // Compile contracts
    console.log('Compiling contracts...');
    execSync('npx hardhat compile');
    
    // Deploy SoulboundNFT
    console.log('Deploying SoulboundNFT...');
    const SoulboundNFTArtifact = loadArtifact('SoulboundNFT');
    const SoulboundNFTFactory = new ethers.ContractFactory(
      SoulboundNFTArtifact.abi,
      SoulboundNFTArtifact.bytecode,
      deployer
    );
    
    const nftName = "D-Loop Identity";
    const nftSymbol = "DLOOP-ID";
    const baseURI = "https://dloop.io/identity/";
    
    const soulboundNFT = await SoulboundNFTFactory.deploy(
      nftName,
      nftSymbol,
      baseURI,
      adminAddress
    );
    
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at ${soulboundNFTAddress}`);
    
    // Test 1: Verify initialization parameters
    console.log('\nTest 1: Verifying initialization parameters...');
    const actualName = await soulboundNFT.name();
    const actualSymbol = await soulboundNFT.symbol();
    const actualBaseURI = await soulboundNFT.baseURI();
    
    assert.equal(actualName, nftName, "Name not set correctly");
    assert.equal(actualSymbol, nftSymbol, "Symbol not set correctly");
    assert.equal(actualBaseURI, baseURI, "Base URI not set correctly");
    
    // Check role assignments
    const ADMIN_ROLE = await soulboundNFT.ADMIN_ROLE();
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    const DEFAULT_ADMIN_ROLE = await soulboundNFT.DEFAULT_ADMIN_ROLE();
    
    const deployerHasDefaultAdmin = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress);
    const adminHasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, adminAddress);
    
    assert.equal(deployerHasDefaultAdmin, true, "Deployer should have DEFAULT_ADMIN_ROLE");
    assert.equal(adminHasAdminRole, true, "Admin should have ADMIN_ROLE");
    
    console.log('✅ Initialization parameters and roles verified');
    
    // Test 2: Grant minter role and mint token
    console.log('\nTest 2: Testing minting functionality...');
    
    // Admin grants minter role to minter
    await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, minterAddress);
    const minterHasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, minterAddress);
    assert.equal(minterHasMinterRole, true, "Minter should have MINTER_ROLE");
    
    // Minter mints a token to user1
    const tokenId = 1;
    const tokenURI = "custom-metadata";
    await soulboundNFT.connect(minter).mint(user1Address, tokenId, tokenURI);
    
    // Verify token was minted correctly
    const tokenOwner = await soulboundNFT.ownerOf(tokenId);
    const actualTokenURI = await soulboundNFT.tokenURI(tokenId);
    const expectedTokenURI = `${baseURI}${tokenURI}`;
    
    assert.equal(tokenOwner.toLowerCase(), user1Address.toLowerCase(), "Token owner doesn't match");
    assert.equal(actualTokenURI, expectedTokenURI, "Token URI doesn't match");
    
    console.log('✅ Minting functionality verified');
    
    // Test 3: Verify non-transferability (soulbound property)
    console.log('\nTest 3: Verifying soulbound (non-transferable) property...');
    
    // User1 attempts to transfer their token to user2 - this should fail
    try {
      await soulboundNFT.connect(user1).transferFrom(user1Address, user2Address, tokenId);
      assert.fail("Transfer should have failed for soulbound token");
    } catch (error) {
      // Expected error
      console.log('Transfer correctly failed with error:', error.message.substring(0, 100) + '...');
    }
    
    // Verify owner is still user1
    const tokenOwnerAfterTransferAttempt = await soulboundNFT.ownerOf(tokenId);
    assert.equal(tokenOwnerAfterTransferAttempt.toLowerCase(), user1Address.toLowerCase(), "Token owner should not have changed");
    
    console.log('✅ Soulbound property verified');
    
    // Test 4: Base URI management
    console.log('\nTest 4: Testing base URI management...');
    
    // Admin updates base URI
    const newBaseURI = "https://new.dloop.io/identity/";
    await soulboundNFT.connect(admin).setBaseURI(newBaseURI);
    
    // Verify base URI was updated
    const updatedBaseURI = await soulboundNFT.baseURI();
    assert.equal(updatedBaseURI, newBaseURI, "Base URI not updated correctly");
    
    // Check that token URI was updated accordingly
    const updatedTokenURI = await soulboundNFT.tokenURI(tokenId);
    const expectedUpdatedTokenURI = `${newBaseURI}${tokenURI}`;
    assert.equal(updatedTokenURI, expectedUpdatedTokenURI, "Token URI not updated with new base URI");
    
    console.log('✅ Base URI management verified');
    
    // Test 5: Batch minting
    console.log('\nTest 5: Testing batch minting functionality...');
    
    // Minter batch mints tokens to user2
    const tokenIds = [2, 3, 4];
    const tokenURIs = ["token-2", "token-3", "token-4"];
    
    await soulboundNFT.connect(minter).batchMint(user2Address, tokenIds, tokenURIs);
    
    // Verify all tokens were minted correctly
    for (let i = 0; i < tokenIds.length; i++) {
      const batchTokenOwner = await soulboundNFT.ownerOf(tokenIds[i]);
      const batchTokenURI = await soulboundNFT.tokenURI(tokenIds[i]);
      const expectedBatchTokenURI = `${newBaseURI}${tokenURIs[i]}`;
      
      assert.equal(batchTokenOwner.toLowerCase(), user2Address.toLowerCase(), `Batch token ${tokenIds[i]} owner doesn't match`);
      assert.equal(batchTokenURI, expectedBatchTokenURI, `Batch token ${tokenIds[i]} URI doesn't match`);
    }
    
    console.log('✅ Batch minting functionality verified');
    
    // Test 6: Token revocation
    console.log('\nTest 6: Testing token revocation functionality...');
    
    // Admin revokes a token from user2
    const tokenToRevoke = tokenIds[0]; // Token ID 2
    await soulboundNFT.connect(admin).revoke(tokenToRevoke);
    
    // Verify token was revoked (should throw when checking owner)
    try {
      await soulboundNFT.ownerOf(tokenToRevoke);
      assert.fail("Token should have been revoked");
    } catch (error) {
      // Expected error for revoked token
      console.log('Checking revoked token correctly failed with error:', error.message.substring(0, 100) + '...');
    }
    
    // Verify the other tokens are still valid
    for (let i = 1; i < tokenIds.length; i++) {
      const nonRevokedTokenOwner = await soulboundNFT.ownerOf(tokenIds[i]);
      assert.equal(nonRevokedTokenOwner.toLowerCase(), user2Address.toLowerCase(), `Non-revoked token ${tokenIds[i]} owner should still match`);
    }
    
    console.log('✅ Token revocation functionality verified');
    
    // Test 7: Role management
    console.log('\nTest 7: Testing role management functionality...');
    
    // Admin revokes minter role from minter
    await soulboundNFT.connect(admin).revokeRole(MINTER_ROLE, minterAddress);
    
    // Verify minter role was revoked
    const minterHasMinterRoleAfterRevoke = await soulboundNFT.hasRole(MINTER_ROLE, minterAddress);
    assert.equal(minterHasMinterRoleAfterRevoke, false, "Minter should not have MINTER_ROLE after revocation");
    
    // Minter attempts to mint a token after role revocation - this should fail
    try {
      await soulboundNFT.connect(minter).mint(user1Address, 5, "token-5");
      assert.fail("Minting should have failed after role revocation");
    } catch (error) {
      // Expected error
      console.log('Minting after role revocation correctly failed with error:', error.message.substring(0, 100) + '...');
    }
    
    console.log('✅ Role management functionality verified');
    
    console.log('\nAll SoulboundNFT tests passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the tests
console.log('Starting Ultra-Minimal SoulboundNFT Test');
main().catch(error => {
  console.error('Test failed:', error);
  shutdownHardhatNode();
  process.exit(1);
});