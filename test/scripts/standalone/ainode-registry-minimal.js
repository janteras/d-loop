/**
 * Ultra-Minimal AINodeRegistry Test
 * 
 * This standalone test focuses on core functionality of the AINodeRegistry contract:
 * - Contract deployment with proper admin roles
 * - Node registration
 * - Node state management
 * - Token staking requirements
 * - SoulboundNFT integration
 */

const ethers = require('../../ethers-v6-shim.standalone');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const HARDHAT_PORT = 8545;
const RPC_URL = `http://127.0.0.1:${HARDHAT_PORT}`;
const DEFAULT_REGISTRATION_PERIOD = 30 * 24 * 60 * 60; // 30 days in seconds

// Load contract artifacts
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'AINodeRegistry') {
    filePath = path.join(artifactPath, 'governance', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'SoulboundNFT') {
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
  const hardhatNode = execSync('npx hardhat node --port 8545 --hostname 127.0.0.1 &');
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

// Main test function
async function main() {
  try {
    // Ensure a clean environment
    shutdownHardhatNode();
    await startHardhatNode();
    
    // Connect to the node
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log('Provider created');
    await provider.getBlockNumber(); // Test connection
    console.log('Provider connected to Hardhat node');
    
    // Get test accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    const [deployer, admin, user1, user2] = await Promise.all(
      accounts.slice(0, 4).map(address => provider.getSigner(address))
    );
    
    console.log('Test accounts:');
    console.log('Deployer:', deployer);
    console.log('Admin:', admin);
    console.log('User1:', user1);
    console.log('User2:', user2);
    
    // Compile contracts
    console.log('Compiling contracts...');
    execSync('npx hardhat compile');
    
    // Deploy SoulboundNFT first
    console.log('Deploying SoulboundNFT...');
    const SoulboundNFTArtifact = loadArtifact('SoulboundNFT');
    const SoulboundNFTFactory = new ethers.ContractFactory(
      SoulboundNFTArtifact.abi,
      SoulboundNFTArtifact.bytecode,
      deployer
    );
    
    const soulboundNFT = await SoulboundNFTFactory.deploy(
      "D-Loop Identity",
      "DLOOP-ID",
      "https://dloop.io/identity/",
      await admin.getAddress()
    );
    
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    const soulboundNFTBlock = await provider.getBlockNumber();
    console.log(`SoulboundNFT deployed at ${soulboundNFTAddress} (block: ${soulboundNFTBlock})`);
    
    // Deploy MockToken for staking
    console.log('Deploying MockToken...');
    const MockTokenArtifact = loadArtifact('MockToken');
    const MockTokenFactory = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      deployer
    );
    
    const mockToken = await MockTokenFactory.deploy("DLOOP Token", "DLOOP");
    const tokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at ${tokenAddress}`);
    
    // Deploy AINodeRegistry
    console.log('Deploying AINodeRegistry...');
    const AINodeRegistryArtifact = loadArtifact('AINodeRegistry');
    const AINodeRegistryFactory = new ethers.ContractFactory(
      AINodeRegistryArtifact.abi,
      AINodeRegistryArtifact.bytecode,
      deployer
    );
    
    const adminAddress = await admin.getAddress();
    const governanceAddress = ethers.ZeroAddress; // No governance contract initially
    
    const aiNodeRegistry = await AINodeRegistryFactory.deploy(
      adminAddress,
      governanceAddress,
      soulboundNFTAddress
    );
    
    const registryAddress = await aiNodeRegistry.getAddress();
    const registryBlock = await provider.getBlockNumber();
    console.log(`AINodeRegistry deployed at ${registryAddress} (block: ${registryBlock})`);
    
    // Grant Registry the MINTER_ROLE
    console.log('Granting minter role to registry...');
    // First get the MINTER_ROLE constant
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, registryAddress);
    console.log('Minter role granted');

    // Test 1: Check roles and initialization 
    console.log('Test 1: Checking role assignments...');
    const registryOwner = await aiNodeRegistry.owner();
    const registryAdmin = await aiNodeRegistry.admin();
    const registrySoulbound = await aiNodeRegistry.soulboundNFT();
    
    assert.equal(registryOwner, await deployer.getAddress(), "Owner not set correctly");
    assert.equal(registryAdmin, adminAddress, "Admin not set correctly");
    assert.equal(registrySoulbound.toLowerCase(), soulboundNFTAddress.toLowerCase(), "SoulboundNFT not set correctly");
    console.log('✅ Role assignments correct');
    
    // Test 2: Configure token requirement
    console.log('Test 2: Setting token requirement...');
    const requirementId = 1;
    const stakeAmount = ethers.parseUnits("100", 18);
    
    await aiNodeRegistry.connect(admin).setTokenRequirement(
      requirementId,
      tokenAddress,
      stakeAmount
    );
    
    console.log('✅ Token requirement set');
    
    // Test 3: Register a node through admin
    console.log('Test 3: Registering node via admin...');
    const user1Address = await user1.getAddress();
    const nodeAddress = await user2.getAddress(); // Using user2 as the node address
    const metadata = "ipfs://QmNodeDataHash";
    
    await aiNodeRegistry.connect(admin).registerNode(
      nodeAddress,
      user1Address, // user1 is the node owner
      metadata
    );
    
    // Verify node is registered
    const nodeCount = await aiNodeRegistry.getNodeCount();
    assert.equal(nodeCount, 1n, "Node count should be 1");
    
    const nodeAddresses = await aiNodeRegistry.getAllNodeAddresses();
    assert.equal(nodeAddresses.length, 1, "Should have 1 node address");
    assert.equal(nodeAddresses[0].toLowerCase(), nodeAddress.toLowerCase(), "Node address doesn't match");
    
    const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeAddress);
    assert.equal(nodeDetails[0].toLowerCase(), user1Address.toLowerCase(), "Node owner doesn't match");
    assert.equal(nodeDetails[1], metadata, "Node metadata doesn't match");
    console.log('✅ Node registered successfully');
    
    // Test 4: Check SoulboundNFT integration
    console.log('Test 4: Checking SoulboundNFT integration...');
    // The registry should have minted an NFT for the node owner
    const tokenId = nodeDetails[8]; // soulboundTokenId position in the return array
    assert(tokenId > 0n, "No SoulboundNFT minted");
    
    // Check the NFT owner
    const tokenOwner = await soulboundNFT.ownerOf(tokenId);
    assert.equal(tokenOwner.toLowerCase(), user1Address.toLowerCase(), "NFT not owned by the node owner");
    console.log(`✅ SoulboundNFT integration verified - TokenID: ${tokenId}`);
    
    // Test 5: Register node with staking
    console.log('Test 5: Testing node registration with staking...');
    // Mint tokens for user2
    const mintAmount = ethers.parseUnits("200", 18);
    await mockToken.connect(deployer).mint(await user2.getAddress(), mintAmount);
    
    // User2 approves registry to spend tokens
    await mockToken.connect(user2).approve(registryAddress, stakeAmount);
    
    // User2 registers a node with staking
    const nodeAddress2 = ethers.Wallet.createRandom().address;
    const metadata2 = "ipfs://QmNodeDataHash2";
    
    await aiNodeRegistry.connect(user2).registerNodeWithStaking(
      nodeAddress2,
      metadata2,
      requirementId
    );
    
    // Verify staked tokens
    const nodeDetails2 = await aiNodeRegistry.getNodeDetails(nodeAddress2);
    assert.equal(nodeDetails2[6], stakeAmount, "Staked amount doesn't match");
    assert.equal(nodeDetails2[7].toLowerCase(), tokenAddress.toLowerCase(), "Staked token doesn't match");
    
    // Verify node count increased
    const nodeCount2 = await aiNodeRegistry.getNodeCount();
    assert.equal(nodeCount2, 2n, "Node count should be 2");
    console.log('✅ Node registration with staking verified');
    
    // Test 6: Update node state
    console.log('Test 6: Testing node state update...');
    // Suspended = 2 in the NodeState enum
    await aiNodeRegistry.connect(admin).updateNodeState(nodeAddress, 2);
    
    const updatedNodeDetails = await aiNodeRegistry.getNodeDetails(nodeAddress);
    assert.equal(updatedNodeDetails[4], 2, "Node state not updated");
    console.log('✅ Node state update verified');
    
    // Test 7: Extended node period
    console.log('Test 7: Testing node period extension...');
    const extensionPeriod = 15 * 24 * 60 * 60; // 15 days in seconds
    const originalActiveUntil = nodeDetails2[3]; // From the active node
    
    await aiNodeRegistry.connect(admin).extendNodePeriod(nodeAddress2, extensionPeriod);
    
    const extendedNodeDetails = await aiNodeRegistry.getNodeDetails(nodeAddress2);
    const expectedActiveUntil = originalActiveUntil + BigInt(extensionPeriod);
    assert.equal(extendedNodeDetails[3], expectedActiveUntil, "Node period not extended correctly");
    console.log('✅ Node period extension verified');
    
    // Test 8: Deregister node with refund
    console.log('Test 8: Testing node deregistration with refund...');
    // User2 deregisters their node
    const balanceBefore = await mockToken.balanceOf(await user2.getAddress());
    
    await aiNodeRegistry.connect(user2).deregisterNodeWithRefund();
    
    const balanceAfter = await mockToken.balanceOf(await user2.getAddress());
    const refundedAmount = balanceAfter - balanceBefore;
    assert.equal(refundedAmount, stakeAmount, "Refund amount doesn't match");
    
    // Verify the node is inactive
    const deregisteredNodeDetails = await aiNodeRegistry.getNodeDetails(nodeAddress2);
    assert.equal(deregisteredNodeDetails[4], 0, "Node state should be inactive");
    console.log('✅ Node deregistration with refund verified');
    
    console.log('All tests passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the tests
console.log('Starting Ultra-Minimal AINodeRegistry Test');
main().catch(error => {
  console.error('Test failed:', error);
  shutdownHardhatNode();
  process.exit(1);
});