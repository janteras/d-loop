const { ethers } = require('ethers');
const { expect } = require('chai');
const deployer = require('../utils/direct-contract-deployer');

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

// Run tests
async function runTests() {
  try {
    console.log('Setting up test environment...');
    
    // Create provider and signers
    const provider = deployer.createProvider();
    const accounts = await provider.listAccounts();
    console.log('Available accounts:', accounts);
    
    // Connect the first account as our funder and owner
    const funder = await ethers.getSignerOrProvider(provider, accounts[0]);
    const funderAddress = await funder.getAddress();
    console.log(`Using account ${funderAddress} as funder and owner`);
    
    // Create admin and user as completely new addresses
    const admin = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    const user = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
    
    console.log('Admin address:', admin.address);
    console.log('User address:', user.address);
    
    // Fund the admin and user accounts
    console.log('Funding accounts...');
    const fundAdminTx = await funder.sendTransaction({
      to: admin.address,
      value: ethers.parseEther('1.0')
    });
    await fundAdminTx.wait();
    console.log('Admin funded');
    
    const fundUserTx = await funder.sendTransaction({
      to: user.address,
      value: ethers.parseEther('1.0')
    });
    await fundUserTx.wait();
    console.log('User funded');
    
    // Deploy contracts
    console.log('\nDeploying contracts...');
    
    // Deploy SoulboundNFT
    const soulboundNFT = await deployer.deployContract('SoulboundNFT', funder, [admin.address]);
    
    // Deploy MockToken
    const mockToken = await deployer.deployContract('MockToken', funder, ["DLOOP Test Token", "DTEST", 18]);
    
    // Deploy AINodeRegistry
    const aiNodeRegistry = await deployer.deployContract('AINodeRegistry', funder, [
      admin.address,
      await mockToken.getAddress(),
      await soulboundNFT.getAddress()
    ]);
    
    // Grant MINTER_ROLE to AINodeRegistry
    await deployer.safeExecute('Grant MINTER_ROLE to AINodeRegistry', async () => {
      const grantRoleTx = await soulboundNFT.grantRole(MINTER_ROLE, await aiNodeRegistry.getAddress());
      await grantRoleTx.wait();
      console.log(`AINodeRegistry now has MINTER_ROLE`);
    });
    
    // Verify roles
    const hasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, await aiNodeRegistry.getAddress());
    console.log(`AINodeRegistry has MINTER_ROLE: ${hasMinterRole}`);
    
    console.log('\nRunning tests...');
    
    // Test: Register node and verify SoulboundNFT minting
    console.log('\nTest: Register node and verify SoulboundNFT minting');
    
    // Connect as admin
    const adminConnectedRegistry = aiNodeRegistry.connect(admin);
    
    // Register a node
    await deployer.safeExecute(`Registering node for user: ${user.address}`, async () => {
      const tx = await adminConnectedRegistry.registerNodeByAdmin(
        user.address,
        nodeData.name,
        nodeData.endpoint,
        nodeData.capacity,
        nodeData.certificateExpiry,
        nodeData.location,
        nodeData.specifications
      );
      await tx.wait();
    });
    
    // Check if node was registered
    const nodeInfo = await aiNodeRegistry.getNodeInfo(user.address);
    console.log('Node info:', {
      name: nodeInfo.name,
      endpoint: nodeInfo.endpoint,
      active: nodeInfo.active
    });
    
    expect(nodeInfo.name).to.equal(nodeData.name);
    expect(nodeInfo.endpoint).to.equal(nodeData.endpoint);
    expect(nodeInfo.active).to.be.true;
    
    // Check if NFT was minted
    const tokenId = await soulboundNFT.tokenOfOwner(user.address);
    console.log(`Token ID minted: ${tokenId}`);
    expect(Number(tokenId)).to.be.greaterThan(0);
    
    // Verify token ownership
    const tokenOwner = await soulboundNFT.ownerOf(tokenId);
    expect(tokenOwner.toLowerCase()).to.equal(user.address.toLowerCase());
    
    console.log("✅ Successfully registered node and minted SoulboundNFT");
    
    // Test: Update node data
    console.log('\nTest: Update node data');
    
    // Update node data
    const updatedName = "Updated Node Name";
    const updatedEndpoint = "https://updated-endpoint.example.com";
    
    await deployer.safeExecute("Updating node data", async () => {
      const updateTx = await adminConnectedRegistry.updateNode(
        user.address,
        updatedName,
        updatedEndpoint,
        200, // increased capacity
        nodeData.certificateExpiry,
        "Updated Location",
        "Updated Specifications"
      );
      await updateTx.wait();
    });
    
    // Verify updates
    const updatedNodeInfo = await aiNodeRegistry.getNodeInfo(user.address);
    console.log('Updated node info:', {
      name: updatedNodeInfo.name,
      endpoint: updatedNodeInfo.endpoint,
      capacity: updatedNodeInfo.capacity
    });
    
    expect(updatedNodeInfo.name).to.equal(updatedName);
    expect(updatedNodeInfo.endpoint).to.equal(updatedEndpoint);
    expect(updatedNodeInfo.capacity).to.equal(200n);
    
    console.log("✅ Successfully updated node data");
    
    console.log("\n✅✅✅ All tests passed! ✅✅✅");
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(console.error);