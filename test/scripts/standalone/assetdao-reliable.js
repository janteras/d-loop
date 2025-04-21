/**
 * Reliable AssetDAO Test
 * 
 * This test assumes a Hardhat node is already running on port 8545
 * and connects to it instead of trying to manage its own node.
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Configuration
const RPC_URL = 'http://127.0.0.1:8545';

// Load contract artifacts
function loadArtifact(contractName) {
  let artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'AssetDAO') {
    filePath = path.join(artifactPath, 'core', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockToken') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockPriceOracle') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockFeeProcessor') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockProtocolDAO') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else {
    throw new Error(`Unknown contract: ${contractName}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact not found at ${filePath}`);
  }
  
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    // Connect to the node
    const provider = await getConnectedProvider();
    
    // Get test accounts
    await provider.getBlockNumber(); // Ensure connection
    console.log(`Getting accounts...`);
    
    // Get the first 4 accounts using hardcoded indices
    const deployer = await provider.getSigner(0);
    const admin = await provider.getSigner(1);
    const treasury = await provider.getSigner(2);
    const user1 = await provider.getSigner(3);
    
    console.log('Test accounts:');
    console.log(`Deployer: ${await deployer.getAddress()}`);
    console.log(`Admin: ${await admin.getAddress()}`);
    console.log(`Treasury: ${await treasury.getAddress()}`);
    console.log(`User1: ${await user1.getAddress()}`);
    
    // Deploy MockToken for DAI
    console.log('Deploying MockToken (DAI)...');
    const MockTokenArtifact = loadArtifact('MockToken');
    const MockTokenFactory = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      deployer
    );
    
    const daiToken = await MockTokenFactory.deploy("DAI Token", "DAI", 18);
    const daiTokenAddress = await daiToken.getAddress();
    console.log(`MockToken (DAI) deployed at ${daiTokenAddress}`);
    
    // Deploy MockToken for DLOOP
    console.log('Deploying MockToken (DLOOP)...');
    const dloopToken = await MockTokenFactory.deploy("DLOOP Token", "DLOOP", 18);
    const dloopTokenAddress = await dloopToken.getAddress();
    console.log(`MockToken (DLOOP) deployed at ${dloopTokenAddress}`);
    
    // Deploy MockPriceOracle
    console.log('Deploying MockPriceOracle...');
    const MockPriceOracleArtifact = loadArtifact('MockPriceOracle');
    const MockPriceOracleFactory = new ethers.ContractFactory(
      MockPriceOracleArtifact.abi,
      MockPriceOracleArtifact.bytecode,
      deployer
    );
    
    const priceOracle = await MockPriceOracleFactory.deploy();
    const priceOracleAddress = await priceOracle.getAddress();
    console.log(`MockPriceOracle deployed at ${priceOracleAddress}`);
    
    // Deploy MockFeeProcessor
    console.log('Deploying MockFeeProcessor...');
    const MockFeeProcessorArtifact = loadArtifact('MockFeeProcessor');
    const MockFeeProcessorFactory = new ethers.ContractFactory(
      MockFeeProcessorArtifact.abi,
      MockFeeProcessorArtifact.bytecode,
      deployer
    );
    
    const feeProcessor = await MockFeeProcessorFactory.deploy();
    const feeProcessorAddress = await feeProcessor.getAddress();
    console.log(`MockFeeProcessor deployed at ${feeProcessorAddress}`);
    
    // Deploy MockProtocolDAO
    console.log('Deploying MockProtocolDAO...');
    const MockProtocolDAOArtifact = loadArtifact('MockProtocolDAO');
    const MockProtocolDAOFactory = new ethers.ContractFactory(
      MockProtocolDAOArtifact.abi,
      MockProtocolDAOArtifact.bytecode,
      deployer
    );
    
    const protocolDAO = await MockProtocolDAOFactory.deploy();
    const protocolDAOAddress = await protocolDAO.getAddress();
    console.log(`MockProtocolDAO deployed at ${protocolDAOAddress}`);
    
    // Now deploy AssetDAO with the correct parameters
    console.log('Deploying AssetDAO...');
    const AssetDAOArtifact = loadArtifact('AssetDAO');
    const AssetDAOFactory = new ethers.ContractFactory(
      AssetDAOArtifact.abi,
      AssetDAOArtifact.bytecode,
      deployer
    );
    
    // Deploy AssetDAO with all required parameters
    const assetDAO = await AssetDAOFactory.deploy(
      daiTokenAddress,
      dloopTokenAddress,
      priceOracleAddress,
      feeProcessorAddress,
      protocolDAOAddress
    );
    
    const assetDAOAddress = await assetDAO.getAddress();
    console.log(`AssetDAO deployed at ${assetDAOAddress}`);
    
    // Test 1: Verify initialization parameters
    console.log('Test 1: Verifying initialization parameters...');
    
    const actualDaiToken = await assetDAO.daiToken();
    const actualDloopToken = await assetDAO.dloopToken();
    const actualPriceOracle = await assetDAO.priceOracle();
    const actualFeeProcessor = await assetDAO.feeProcessor();
    const actualProtocolDAO = await assetDAO.protocolDAO();
    
    assert.equal(actualDaiToken.toLowerCase(), daiTokenAddress.toLowerCase(), "DAI token not set correctly");
    assert.equal(actualDloopToken.toLowerCase(), dloopTokenAddress.toLowerCase(), "DLOOP token not set correctly");
    assert.equal(actualPriceOracle.toLowerCase(), priceOracleAddress.toLowerCase(), "Price Oracle not set correctly");
    assert.equal(actualFeeProcessor.toLowerCase(), feeProcessorAddress.toLowerCase(), "Fee Processor not set correctly");
    assert.equal(actualProtocolDAO.toLowerCase(), protocolDAOAddress.toLowerCase(), "Protocol DAO not set correctly");
    
    console.log('✅ Initialization parameters verified');
    
    // Test 2: Role-based access control
    console.log('Test 2: Testing role-based access control...');
    
    // Get the DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await assetDAO.DEFAULT_ADMIN_ROLE();
    const ASSET_ADMIN_ROLE = await assetDAO.ASSET_ADMIN_ROLE();
    
    // Check that deployer has the DEFAULT_ADMIN_ROLE
    const deployerHasDefaultAdminRole = await assetDAO.hasRole(DEFAULT_ADMIN_ROLE, await deployer.getAddress());
    assert.equal(deployerHasDefaultAdminRole, true, "Deployer should have DEFAULT_ADMIN_ROLE");
    
    // Grant ASSET_ADMIN_ROLE to admin
    console.log('Granting ASSET_ADMIN_ROLE to admin...');
    await assetDAO.grantRole(ASSET_ADMIN_ROLE, await admin.getAddress());
    
    // Check if role granted
    const adminHasAssetAdminRole = await assetDAO.hasRole(ASSET_ADMIN_ROLE, await admin.getAddress());
    assert.equal(adminHasAssetAdminRole, true, "Admin should have ASSET_ADMIN_ROLE");
    
    console.log('✅ Role-based access control verified');
    
    // Test 3: Verify asset pool parameters
    console.log('Test 3: Testing asset pool creation...');
    
    // Let's create an asset pool
    const name = "Test Pool";
    const symbol = "TEST";
    const owner = await user1.getAddress();
    
    console.log(`Creating asset pool: ${name} (${symbol})...`);
    await assetDAO.connect(admin).createAssetPool(name, symbol, owner);
    
    // Get the asset pool count
    const poolCount = await assetDAO.getAssetPoolCount();
    assert.equal(poolCount, 1, "Should have 1 asset pool");
    
    // Get the asset pool
    const poolId = 0;
    const pool = await assetDAO.getAssetPool(poolId);
    
    assert.equal(pool.name, name, "Asset pool name should match");
    assert.equal(pool.symbol, symbol, "Asset pool symbol should match");
    assert.equal(pool.owner.toLowerCase(), owner.toLowerCase(), "Asset pool owner should match");
    
    console.log('✅ Asset pool creation verified');
    
    console.log('All tests passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run the tests
console.log('Starting Reliable AssetDAO Test');
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});