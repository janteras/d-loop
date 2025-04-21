/**
 * Ultra-minimal AssetDAO Standalone Test (Fixed)
 * 
 * This test focuses on basic AssetDAO functionality with the correct constructor parameters
 */

const { exec, execSync } = require('child_process');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log("Starting Fixed AssetDAO Test");
  
  let hardhatProcess;
  let provider;
  
  try {
    // Kill any existing node processes to avoid port conflicts
    try {
      execSync('pkill -f "hardhat node" || true');
      console.log("Cleaned up any existing Hardhat processes");
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      // Ignore errors if no processes found
    }
    
    // Start a Hardhat node in a separate process
    console.log("Starting Hardhat node...");
    hardhatProcess = exec('npx hardhat node --hostname 127.0.0.1 --port 8545', {
      detached: true
    });
    
    // Wait for node to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Hardhat node started");
    
    // Create a provider connected to the Hardhat node
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    console.log("Provider created");
    
    // Wait for provider to connect with retries
    let connected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await provider.getBlockNumber();
        connected = true;
        break;
      } catch (e) {
        console.log(`Waiting for provider to connect (attempt ${i+1}/10)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!connected) {
      throw new Error("Failed to connect to Hardhat node after multiple attempts");
    }
    
    console.log("Provider connected to Hardhat node");
    
    // Get signers
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    if (accounts.length < 5) {
      throw new Error("Not enough accounts available");
    }
    
    const [owner, admin, treasury, user, user2] = accounts;
    
    console.log("Test accounts:");
    console.log(`Owner: ${owner}`);
    console.log(`Admin: ${admin}`);
    console.log(`Treasury: ${treasury}`);
    console.log(`User: ${user}`);
    console.log(`User2 (PriceOracle): ${user2}`);
    
    // Get signers
    const ownerSigner = await provider.getSigner(0);
    const adminSigner = await provider.getSigner(1);
    const treasurySigner = await provider.getSigner(2);
    const userSigner = await provider.getSigner(3);
    const priceOracleSigner = await provider.getSigner(4);
    
    // Compile contracts
    console.log("\nCompiling contracts...");
    execSync('npx hardhat compile --config hardhat.config.simple.js', { stdio: 'pipe' });
    
    // Read the AssetDAO artifact
    const assetDAOPath = path.join(__dirname, '../../artifacts/contracts/core/AssetDAO.sol/AssetDAO.json');
    
    if (!fs.existsSync(assetDAOPath)) {
      throw new Error(`AssetDAO artifact not found at ${assetDAOPath}`);
    }
    
    const assetDAOArtifact = JSON.parse(fs.readFileSync(assetDAOPath, 'utf8'));
    
    // Read the MockToken artifact for testing
    const mockTokenPath = path.join(__dirname, '../../artifacts/test/mocks/MockToken.sol/MockToken.json');
    
    if (!fs.existsSync(mockTokenPath)) {
      throw new Error(`MockToken artifact not found at ${mockTokenPath}`);
    }
    
    const mockTokenArtifact = JSON.parse(fs.readFileSync(mockTokenPath, 'utf8'));
    
    // Deploy MockToken for DAI
    console.log("\nDeploying Mock DAI Token...");
    const MockDAI = new ethers.ContractFactory(mockTokenArtifact.abi, mockTokenArtifact.bytecode, ownerSigner);
    const mockDAI = await MockDAI.deploy("Mock DAI", "mDAI", 18);
    
    const mockDAITxReceipt = await mockDAI.deploymentTransaction().wait();
    console.log(`Mock DAI deployed at ${await mockDAI.getAddress()} (block: ${mockDAITxReceipt.blockNumber})`);
    
    // Deploy MockToken for DLOOP
    console.log("\nDeploying Mock DLOOP Token...");
    const MockDLOOP = new ethers.ContractFactory(mockTokenArtifact.abi, mockTokenArtifact.bytecode, ownerSigner);
    const mockDLOOP = await MockDLOOP.deploy("Mock DLOOP", "mDLOOP", 18);
    
    const mockDLOOPTxReceipt = await mockDLOOP.deploymentTransaction().wait();
    console.log(`Mock DLOOP deployed at ${await mockDLOOP.getAddress()} (block: ${mockDLOOPTxReceipt.blockNumber})`);
    
    // Deploy AssetDAO
    console.log("\nDeploying AssetDAO...");
    const AssetDAO = new ethers.ContractFactory(assetDAOArtifact.abi, assetDAOArtifact.bytecode, ownerSigner);
    
    // Use correct parameters for construction
    const daiToken = await mockDAI.getAddress();
    const dloopToken = await mockDLOOP.getAddress();
    const priceOracle = user2; // Using user2 as mock price oracle
    const feeProcessor = treasury; // Using treasury account as mock fee processor
    const protocolDAO = admin; // Using admin account as mock protocol DAO
    
    const assetDAO = await AssetDAO.deploy(
      daiToken,
      dloopToken,
      priceOracle,
      feeProcessor,
      protocolDAO
    );
    
    const assetDAOTxReceipt = await assetDAO.deploymentTransaction().wait();
    console.log(`AssetDAO deployed at ${await assetDAO.getAddress()} (block: ${assetDAOTxReceipt.blockNumber})`);
    
    // Test 1: Check initialization parameters
    console.log("\nTest 1: Checking initialization parameters");
    
    const actualDaiToken = await assetDAO.daiToken();
    console.log(`DAI Token address: ${actualDaiToken}`);
    assert.equal(actualDaiToken.toLowerCase(), daiToken.toLowerCase(), "DAI token address not set correctly");
    
    const actualDloopToken = await assetDAO.dloopToken();
    console.log(`DLOOP Token address: ${actualDloopToken}`);
    assert.equal(actualDloopToken.toLowerCase(), dloopToken.toLowerCase(), "DLOOP token address not set correctly");
    
    const actualPriceOracle = await assetDAO.priceOracle();
    console.log(`Price Oracle address: ${actualPriceOracle}`);
    assert.equal(actualPriceOracle.toLowerCase(), priceOracle.toLowerCase(), "Price Oracle address not set correctly");
    
    const actualFeeProcessor = await assetDAO.feeProcessor();
    console.log(`Fee Processor address: ${actualFeeProcessor}`);
    assert.equal(actualFeeProcessor.toLowerCase(), feeProcessor.toLowerCase(), "Fee Processor address not set correctly");
    
    const actualProtocolDAO = await assetDAO.protocolDAO();
    console.log(`Protocol DAO address: ${actualProtocolDAO}`);
    assert.equal(actualProtocolDAO.toLowerCase(), protocolDAO.toLowerCase(), "Protocol DAO address not set correctly");
    
    console.log("✅ Initialization parameters verified");
    
    // Test 2: Check role assignments
    console.log("\nTest 2: Checking role assignments");
    
    const ownerActualAddress = await assetDAO.owner();
    console.log(`Owner address: ${ownerActualAddress}`);
    assert.equal(ownerActualAddress.toLowerCase(), owner.toLowerCase(), "Owner not set correctly");
    
    const adminActualAddress = await assetDAO.admin();
    console.log(`Admin address: ${adminActualAddress}`);
    assert.equal(adminActualAddress.toLowerCase(), owner.toLowerCase(), "Admin should initially be set to owner");
    
    // Get role constants
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const OWNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE"));
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));
    const AUTHORIZED_CONTRACT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTHORIZED_CONTRACT_ROLE"));
    
    // Check initial roles
    const ownerHasOwnerRole = await assetDAO.hasRole(OWNER_ROLE, owner);
    console.log(`Owner has OWNER_ROLE: ${ownerHasOwnerRole}`);
    assert(ownerHasOwnerRole, "Owner should have OWNER_ROLE");
    
    const ownerHasAdminRole = await assetDAO.hasRole(ADMIN_ROLE, owner);
    console.log(`Owner has ADMIN_ROLE: ${ownerHasAdminRole}`);
    assert(ownerHasAdminRole, "Owner should have ADMIN_ROLE");
    
    const ownerHasDefaultAdminRole = await assetDAO.hasRole(DEFAULT_ADMIN_ROLE, owner);
    console.log(`Owner has DEFAULT_ADMIN_ROLE: ${ownerHasDefaultAdminRole}`);
    assert(ownerHasDefaultAdminRole, "Owner should have DEFAULT_ADMIN_ROLE");
    
    const ownerHasGovernanceRole = await assetDAO.hasRole(GOVERNANCE_ROLE, owner);
    console.log(`Owner has GOVERNANCE_ROLE: ${ownerHasGovernanceRole}`);
    assert(ownerHasGovernanceRole, "Owner should have GOVERNANCE_ROLE");
    
    const feeProcessorHasAuthorizedContractRole = await assetDAO.hasRole(AUTHORIZED_CONTRACT_ROLE, feeProcessor);
    console.log(`Fee Processor has AUTHORIZED_CONTRACT_ROLE: ${feeProcessorHasAuthorizedContractRole}`);
    assert(feeProcessorHasAuthorizedContractRole, "Fee Processor should have AUTHORIZED_CONTRACT_ROLE");
    
    console.log("✅ Role assignments verified");
    
    // Test 3: Create an asset
    console.log("\nTest 3: Creating an asset");
    
    const assetName = "Test Asset";
    const assetDescription = "This is a test asset";
    
    const createAssetTx = await assetDAO.createAsset(assetName, assetDescription);
    await createAssetTx.wait();
    
    // Check that the asset was created - this will fail if the createAsset function reverts
    console.log("Asset created successfully");
    
    // Try to get asset details (asset ID should be 1)
    try {
      const assetDetails = await assetDAO.getAssetDetails(1);
      console.log("Asset details retrieved successfully");
      console.log(`Asset ID: ${assetDetails[0]}`);
      console.log(`Asset Name: ${assetDetails[1]}`);
      console.log(`Asset Description: ${assetDetails[2]}`);
      console.log(`Asset Creator: ${assetDetails[3]}`);
      console.log(`Asset Creation Time: ${assetDetails[4]}`);
      console.log(`Asset State: ${assetDetails[5]}`);
      
      assert.equal(assetDetails[1], assetName, "Asset name not set correctly");
      assert.equal(assetDetails[2], assetDescription, "Asset description not set correctly");
      assert.equal(assetDetails[3].toLowerCase(), owner.toLowerCase(), "Asset creator not set correctly");
      assert.equal(assetDetails[5], 1, "Asset state should be Active (1)");
      
      console.log("✅ Asset creation verified");
    } catch (error) {
      console.error("Failed to get asset details:", error);
      throw error;
    }
    
    // Test 4: Update asset state
    console.log("\nTest 4: Updating asset state");
    
    const updateAssetStateTx = await assetDAO.updateAssetState(1, 2); // Set to Liquidating (2)
    await updateAssetStateTx.wait();
    
    // Check new state
    const updatedAssetDetails = await assetDAO.getAssetDetails(1);
    console.log(`New Asset State: ${updatedAssetDetails[5]}`);
    assert.equal(updatedAssetDetails[5], 2, "Asset state should be Liquidating (2)");
    
    console.log("✅ Asset state update verified");
    
    console.log("\nAll AssetDAO tests have passed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up resources
    if (hardhatProcess) {
      console.log("Shutting down Hardhat node...");
      try {
        process.kill(-hardhatProcess.pid, 'SIGINT');
      } catch (e) {
        console.log("Hardhat node already terminated");
      }
    }
  }
}

// Run the standalone test
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });