/**
 * Ultra-Simple SoulboundNFT Test
 * 
 * This test uses native ethers v6 without any shims or adapters to avoid compatibility issues.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const HARDHAT_PORT = 8545;
const RPC_URL = `http://0.0.0.0:${HARDHAT_PORT}`;

// Load contract artifacts
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'SoulboundNFT') {
    filePath = path.join(artifactPath, 'identity', `${contractName}.sol`, `${contractName}.json`);
  } else {
    throw new Error(`Unknown contract: ${contractName}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found at ${filePath}`);
  }
  
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Helper to parse BigInt values coming from contracts
function formatValue(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

// Helper for case-insensitive address comparison
function isSameAddress(addr1, addr2) {
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// We don't need to start/stop the Hardhat node since we're using the workflow
function startHardhatNode() {
  console.log('Using existing Hardhat node from workflow...');
  // Give it a moment to ensure it's ready
  execSync('sleep 2');
}

function shutdownHardhatNode() {
  console.log('Leaving Hardhat node running in workflow...');
  // Do nothing, the workflow will manage the node
}

// Main test function
async function main() {
  try {
    // Ensure clean environment
    startHardhatNode();
    
    // Connect to the node
    console.log('Connecting to Hardhat node...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get signer accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    // In ethers v6, getSigner() returns signers differently
    // So we'll create our own wallet objects connected to the provider
    const deployer = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", 
      provider
    );
    const admin = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", 
      provider
    );
    const minter = new ethers.Wallet(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", 
      provider
    );
    const user1 = new ethers.Wallet(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", 
      provider
    );
    
    const deployerAddress = await deployer.getAddress();
    const adminAddress = await admin.getAddress();
    const minterAddress = await minter.getAddress();
    const user1Address = await user1.getAddress();
    
    console.log('Test accounts:');
    console.log('- Deployer:', deployerAddress);
    console.log('- Admin:', adminAddress);
    console.log('- Minter:', minterAddress);
    console.log('- User1:', user1Address);
    
    // Compile contracts if needed
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
    
    // SoulboundNFT constructor only takes an admin address parameter
    const soulboundNFT = await SoulboundNFTFactory.deploy(
      adminAddress
    );
    
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at ${soulboundNFTAddress}`);
    
    // Test 1: Verify admin role assignment
    console.log('\nTest 1: Checking admin role assignment...');
    
    // Test 2: Roles
    console.log('\nTest 2: Checking roles...');
    const ADMIN_ROLE = await soulboundNFT.ADMIN_ROLE();
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    
    // Admin should have ADMIN_ROLE
    const hasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, adminAddress);
    assert.equal(hasAdminRole, true, "Admin should have ADMIN_ROLE");
    
    // Grant minter role
    console.log('Granting MINTER_ROLE to minter...');
    const grantRoleTx = await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, minterAddress);
    await grantRoleTx.wait();
    
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, minterAddress);
    assert.equal(hasMinterRole, true, "Minter should have MINTER_ROLE");
    
    // Test 3: Minting
    console.log('\nTest 3: Testing minting...');
    const tokenURI = "test-token";
    
    // SoulboundNFT doesn't take tokenId parameter, it generates one automatically
    const mintTx = await soulboundNFT.connect(minter).mint(user1Address, tokenURI);
    await mintTx.wait();
    
    // Get the generated tokenId
    const tokenId = 1; // First token will have ID 1
    
    // Get token details using getTokenDetails instead of ownerOf
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    const tokenOwner = tokenDetails[0]; // First return value is tokenOwner
    
    assert(isSameAddress(tokenOwner, user1Address), "Token owner doesn't match");
    
    // Get tokenURI from token details
    const retrievedTokenURI = tokenDetails[1]; // Second return value is tokenURI
    assert.equal(retrievedTokenURI, tokenURI, "Token URI doesn't match");
    
    console.log('✅ All SoulboundNFT tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting Simple SoulboundNFT Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});