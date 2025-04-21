/**
 * Super Minimal AINodeRegistry SoulboundNFT Integration Test
 * Uses direct JavaScript with only necessary dependencies
 */

// Import contract artifacts
const AINodeRegistry = require('../../../../artifacts/contracts/governance/AINodeRegistry.sol/AINodeRegistry.json');
const SoulboundNFT = require('../../../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
const { ethers } = require('ethers');

// Create a provider
const provider = new ethers.JsonRpcProvider('http://localhost:8545');

// Helper function for parsing units
function parseUnits(value, decimals = 18) {
  return BigInt(Math.floor(Number(value) * 10**Number(decimals)));
}

async function main() {
  try {
    console.log('Starting minimal AINodeRegistry/SoulboundNFT integration test...');
    
    // Get signers
    const accounts = await provider.send('eth_accounts', []);
    console.log('Available accounts:', accounts.length);
    
    const owner = new ethers.Wallet(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Default hardhat #0 private key
      provider
    );
    const admin = new ethers.Wallet(
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Default hardhat #1 private key
      provider
    );
    const user = new ethers.Wallet(
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Default hardhat #2 private key
      provider
    );
    
    console.log('Owner:', owner.address);
    console.log('Admin:', admin.address);
    console.log('User:', user.address);
    
    // Deploy SoulboundNFT contract
    console.log('Deploying SoulboundNFT...');
    const soulboundNFTFactory = new ethers.ContractFactory(
      SoulboundNFT.abi,
      SoulboundNFT.bytecode,
      owner
    );
    
    const soulboundNFT = await soulboundNFTFactory.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    console.log('SoulboundNFT deployed at:', soulboundNFTAddress);
    
    // Deploy AINodeRegistry contract
    console.log('Deploying AINodeRegistry...');
    const aiNodeRegistryFactory = new ethers.ContractFactory(
      AINodeRegistry.abi,
      AINodeRegistry.bytecode,
      owner
    );
    
    const aiNodeRegistry = await aiNodeRegistryFactory.deploy(
      admin.address,              // admin
      owner.address,              // governance contract (using owner for simplicity)
      soulboundNFTAddress         // soulboundNFT address
    );
    await aiNodeRegistry.waitForDeployment();
    const aiNodeRegistryAddress = await aiNodeRegistry.getAddress();
    console.log('AINodeRegistry deployed at:', aiNodeRegistryAddress);
    
    // Register a node
    console.log('Registering a node...');
    const registrationData = {
      nodeEndpoint: 'https://example.com/node1',
      nodeOperator: user.address,
      nodeVersion: '1.0.0',
      supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
      region: 'us-east-1',
      ipAddress: '192.168.1.1'
    };
    
    // Approve user to manage the admin's soulboundNFT
    const userConnected = aiNodeRegistry.connect(user);
    
    // Registration through admin
    const registrationTx = await aiNodeRegistry.connect(admin).registerNode(
      user.address, // node address (using the user's address for simplicity)
      user.address, // node owner
      JSON.stringify(registrationData) // metadata as JSON string
    );
    const receipt = await registrationTx.wait();
    console.log('Node registered, transaction hash:', receipt.hash);
    
    // Find NodeRegistered event from logs
    const nodeRegisteredEvent = receipt.logs.find(
      log => log.fragment?.name === 'NodeRegistered'
    );
    
    // In our contract, node ID is the node address
    const nodeAddress = user.address;
    console.log('Registered node address:', nodeAddress);
    
    // Verify the node is registered by getting the node details
    const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeAddress);
    console.log('Node details:', {
      owner: nodeDetails.nodeOwner,
      metadata: nodeDetails.metadata,
      exists: nodeDetails.exists,
      tokenId: nodeDetails.soulboundTokenId
    });
    
    // Check if a SoulboundNFT was minted
    const tokenId = nodeDetails.soulboundTokenId;
    console.log('Node SoulboundNFT token ID:', tokenId);
    
    if (tokenId > 0) {
      console.log('✅ SoulboundNFT integration test passed - token was minted');
      
      // Verify token details
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      console.log('Token details:', {
        owner: tokenDetails[0],
        tokenURI: tokenDetails[1],
        mintedAt: tokenDetails[2],
        revoked: tokenDetails[3]
      });
      
      if (tokenDetails[0] === user.address) {
        console.log('✅ Token owner is correct');
      } else {
        console.log('❌ Token owner is incorrect');
      }
    } else {
      console.log('❌ SoulboundNFT integration test failed - no token was minted');
    }
    
    // Test deregistration
    console.log('Testing node deregistration...');
    // In AINodeRegistry, node owners can deregister their own nodes with refund
    const deregisterTx = await aiNodeRegistry.connect(user).deregisterNodeWithRefund();
    await deregisterTx.wait();
    
    // Verify the node is deregistered
    const nodeDetailsAfter = await aiNodeRegistry.getNodeDetails(nodeAddress);
    console.log('Node details after deregistration:', {
      exists: nodeDetailsAfter.exists,
      owner: nodeDetailsAfter.nodeOwner
    });
    
    // Check if the SoulboundNFT was revoked
    const tokenDetailsAfterDeregister = await soulboundNFT.getTokenDetails(tokenId);
    console.log('Token details after deregistration:', {
      revoked: tokenDetailsAfterDeregister[3]
    });
    
    if (!nodeDetailsAfter.exists && tokenDetailsAfterDeregister[3] === true) {
      console.log('✅ Deregistration integration test passed - node deregistered and token revoked');
    } else {
      console.log('❌ Deregistration integration test failed');
    }
    
    console.log('All integration tests complete');
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Execute main function
main().catch(error => {
  console.error('Uncaught error:', error);
  process.exit(1);
});