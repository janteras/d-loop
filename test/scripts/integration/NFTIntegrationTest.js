/**
 * SoulboundNFT and AINodeRegistry Integration Test
 * This test verifies that SoulboundNFT works correctly with AINodeRegistry
 * using direct ethers v6 methods instead of relying on Hardhat environment
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Starting SoulboundNFT and AINodeRegistry Integration Test");
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
    console.log("Provider created");
    
    // Get accounts
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      console.log("No accounts found. Make sure the Hardhat node is running.");
      return;
    }
    console.log(`Found ${accounts.length} accounts`);
    
    // Define roles
    const admin = accounts[0];
    const user = accounts[1];
    
    console.log("Using accounts:");
    console.log(`- Admin: ${admin.address}`);
    console.log(`- User: ${user.address}`);
    
    // Create signers
    const adminSigner = await provider.getSigner(admin.address);
    const userSigner = await provider.getSigner(user.address);
    
    // Load contract artifacts
    const soulboundNFTPath = path.join(__dirname, '../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
    const aiNodeRegistryPath = path.join(__dirname, '../../artifacts/contracts/governance/AINodeRegistry.sol/AINodeRegistry.json');
    
    if (!fs.existsSync(soulboundNFTPath) || !fs.existsSync(aiNodeRegistryPath)) {
      console.log("Contract artifacts not found. Please compile contracts first.");
      return;
    }
    
    const soulboundNFTArtifact = JSON.parse(fs.readFileSync(soulboundNFTPath, 'utf8'));
    const aiNodeRegistryArtifact = JSON.parse(fs.readFileSync(aiNodeRegistryPath, 'utf8'));
    
    console.log("Deploying SoulboundNFT...");
    const soulboundNFTFactory = new ethers.ContractFactory(
      soulboundNFTArtifact.abi,
      soulboundNFTArtifact.bytecode,
      adminSigner
    );
    
    const soulboundNFT = await soulboundNFTFactory.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed at: ${soulboundNFTAddress}`);
    
    // Check SoulboundNFT initial state
    const nftName = await soulboundNFT.name();
    const nftSymbol = await soulboundNFT.symbol();
    console.log(`SoulboundNFT name: ${nftName}, symbol: ${nftSymbol}`);
    
    // Deploy AINodeRegistry with SoulboundNFT
    console.log("Deploying AINodeRegistry...");
    const aiNodeRegistryFactory = new ethers.ContractFactory(
      aiNodeRegistryArtifact.abi,
      aiNodeRegistryArtifact.bytecode,
      adminSigner
    );
    
    // Mock DAO address for constructor
    const mockDAOAddress = admin.address;
    
    const aiNodeRegistry = await aiNodeRegistryFactory.deploy(
      admin.address,
      mockDAOAddress, 
      soulboundNFTAddress
    );
    await aiNodeRegistry.waitForDeployment();
    const registryAddress = await aiNodeRegistry.getAddress();
    console.log(`AINodeRegistry deployed at: ${registryAddress}`);
    
    // Grant minter role to AINodeRegistry
    console.log("Granting MINTER_ROLE to AINodeRegistry...");
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const grantRoleTx = await soulboundNFT.grantRole(MINTER_ROLE, registryAddress);
    await grantRoleTx.wait();
    console.log("MINTER_ROLE granted to AINodeRegistry");
    
    // Register a node (which should mint an NFT)
    console.log("Registering node for user...");
    const registerTx = await aiNodeRegistry.connect(userSigner).registerNode(
      "Test Node",
      "https://example.com/metadata.json",
      "0.0.0.0", // IP address
      1234, // Port
      "testEndpoint", // Endpoint
      ethers.parseEther("100") // Stake amount
    );
    const registerReceipt = await registerTx.wait();
    console.log(`Node registered, gas used: ${registerReceipt.gasUsed}`);
    
    // Verify NFT was minted
    const nodeInfo = await aiNodeRegistry.getNodeInfo(user.address);
    console.log("Node info:", nodeInfo);
    
    const tokenId = nodeInfo[5]; // Assuming tokenId is in index 5
    console.log(`Token ID for node: ${tokenId}`);
    
    const tokenOwner = await soulboundNFT.ownerOf(tokenId);
    console.log(`Token owner: ${tokenOwner}`);
    
    if (tokenOwner.toLowerCase() === user.address.toLowerCase()) {
      console.log("✅ Integration test passed: NFT minted to correct user");
    } else {
      console.log("❌ Integration test failed: NFT not owned by correct user");
    }
    
    console.log("Integration test completed");
  } catch (error) {
    console.error("Integration test failed:", error);
  }
}

main();