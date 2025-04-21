/**
 * Simple Integration Test
 * 
 * This is a simpler integration test that focuses on using the built-in
 * Hardhat accounts directly rather than creating new wallets.
 */

const { ethers } = require('ethers');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Constants
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Node test data
const nodeData = {
  name: "Test Node",
  endpoint: "https://test-node.example.com",
  capacity: 100,
  certificateExpiry: Math.floor(Date.now() / 1000) + 31536000, // 1 year from now
  location: "Test Location",
  specifications: "Test Specifications"
};

// Utility function to load contract artifacts
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let files = [];
  
  // Search for the contract file recursively
  function searchForArtifact(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        searchForArtifact(itemPath);
      } else if (item.name === `${contractName}.json`) {
        files.push(itemPath);
      }
    }
  }
  
  searchForArtifact(artifactPath);
  
  if (files.length === 0) {
    throw new Error(`Artifact for ${contractName} not found`);
  }
  
  console.log(`Found artifact for ${contractName} at: ${files[0]}`);
  return JSON.parse(fs.readFileSync(files[0], 'utf8'));
}

// Main test function
async function runTest() {
  try {
    // Connect to local Hardhat node
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
    
    // Get test accounts from the provider
    const signers = await provider.listAccounts();
    console.log(`Found ${signers.length} accounts`);
    
    // Get the addresses (these are already strings)
    const ownerAddress = signers[0];
    const adminAddress = signers[1];
    const userAddress = signers[2];
    
    console.log('Using account addresses:');
    console.log(`Owner: ${ownerAddress}`);
    console.log(`Admin: ${adminAddress}`);
    console.log(`User: ${userAddress}`);
    
    // Create signers
    const owner = provider.getSigner(0);
    const admin = provider.getSigner(1);
    const user = provider.getSigner(2);
    
    console.log('Using accounts:');
    console.log(`- Owner: ${ownerAddress}`);
    console.log(`- Admin: ${adminAddress}`);
    console.log(`- User: ${userAddress}`);
    
    // Get contract artifacts
    const SoulboundNFTArtifact = loadArtifact('SoulboundNFT');
    const MockTokenArtifact = loadArtifact('MockToken');
    const AINodeRegistryArtifact = loadArtifact('AINodeRegistry');
    
    // Create contract factories
    const SoulboundNFTFactory = new ethers.ContractFactory(
      SoulboundNFTArtifact.abi,
      SoulboundNFTArtifact.bytecode,
      owner
    );
    
    const MockTokenFactory = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      owner
    );
    
    const AINodeRegistryFactory = new ethers.ContractFactory(
      AINodeRegistryArtifact.abi,
      AINodeRegistryArtifact.bytecode,
      owner
    );
    
    // Deploy contracts
    console.log('\nDeploying contracts...');
    
    // Deploy SoulboundNFT
    console.log('Deploying SoulboundNFT...');
    const soulboundNFT = await SoulboundNFTFactory.deploy(adminAddress);
    await soulboundNFT.waitForDeployment();
    console.log(`SoulboundNFT deployed at ${await soulboundNFT.getAddress()}`);
    
    // Deploy MockToken
    console.log('Deploying MockToken...');
    const mockToken = await MockTokenFactory.deploy("DLOOP Test Token", "DTEST", 18);
    await mockToken.waitForDeployment();
    console.log(`MockToken deployed at ${await mockToken.getAddress()}`);
    
    // Deploy AINodeRegistry
    console.log('Deploying AINodeRegistry...');
    const aiNodeRegistry = await AINodeRegistryFactory.deploy(
      adminAddress, // admin address
      await mockToken.getAddress(), // governance token
      await soulboundNFT.getAddress() // soulbound NFT
    );
    await aiNodeRegistry.waitForDeployment();
    console.log(`AINodeRegistry deployed at ${await aiNodeRegistry.getAddress()}`);
    
    // Grant MINTER_ROLE to AINodeRegistry
    console.log('Granting MINTER_ROLE to AINodeRegistry...');
    const grantRoleTx = await soulboundNFT.grantRole(
      MINTER_ROLE, 
      await aiNodeRegistry.getAddress()
    );
    await grantRoleTx.wait();
    console.log('MINTER_ROLE granted');
    
    // Verify roles
    const hasMinterRole = await soulboundNFT.hasRole(
      MINTER_ROLE, 
      await aiNodeRegistry.getAddress()
    );
    console.log(`AINodeRegistry has MINTER_ROLE: ${hasMinterRole}`);
    
    // Test: Register node and mint SoulboundNFT
    console.log('\nTest: Register node and mint SoulboundNFT');
    
    // Connect AINodeRegistry to admin
    const adminRegistry = aiNodeRegistry.connect(admin);
    
    // Register node
    console.log(`Registering node for user: ${userAddress}`);
    const registerTx = await adminRegistry.registerNodeByAdmin(
      userAddress,
      nodeData.name,
      nodeData.endpoint,
      nodeData.capacity,
      nodeData.certificateExpiry,
      nodeData.location,
      nodeData.specifications
    );
    await registerTx.wait();
    console.log('Node registered');
    
    // Check node registration
    const nodeInfo = await aiNodeRegistry.getNodeInfo(userAddress);
    console.log('Node info:', {
      name: nodeInfo.name,
      endpoint: nodeInfo.endpoint,
      active: nodeInfo.active
    });
    
    if (nodeInfo.name !== nodeData.name ||
        nodeInfo.endpoint !== nodeData.endpoint ||
        !nodeInfo.active) {
      throw new Error('Node registration failed or data mismatch');
    }
    
    // Check NFT minting
    const tokenId = await soulboundNFT.tokenOfOwner(userAddress);
    console.log(`Token ID minted: ${tokenId}`);
    
    if (tokenId <= 0) {
      throw new Error('Token ID should be greater than 0');
    }
    
    // Check token ownership
    const tokenOwner = await soulboundNFT.ownerOf(tokenId);
    if (tokenOwner.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error(`Token owner mismatch: expected ${userAddress}, got ${tokenOwner}`);
    }
    
    console.log("✅ Successfully registered node and minted SoulboundNFT");
    
    // Test: Update node data
    console.log('\nTest: Update node data');
    
    const updatedName = "Updated Node Name";
    const updatedEndpoint = "https://updated-endpoint.example.com";
    
    console.log("Updating node data...");
    const updateTx = await adminRegistry.updateNode(
      userAddress,
      updatedName,
      updatedEndpoint,
      200, // increased capacity
      nodeData.certificateExpiry,
      "Updated Location",
      "Updated Specifications"
    );
    await updateTx.wait();
    
    // Check updated node data
    const updatedNodeInfo = await aiNodeRegistry.getNodeInfo(userAddress);
    console.log('Updated node info:', {
      name: updatedNodeInfo.name,
      endpoint: updatedNodeInfo.endpoint,
      capacity: updatedNodeInfo.capacity
    });
    
    if (updatedNodeInfo.name !== updatedName ||
        updatedNodeInfo.endpoint !== updatedEndpoint ||
        updatedNodeInfo.capacity !== 200n) {
      throw new Error('Node update failed or data mismatch');
    }
    
    console.log("✅ Successfully updated node data");
    
    console.log("\n✅✅✅ All tests passed! ✅✅✅");
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(console.error);