/**
 * @title D-Loop Protocol Sepolina Testnet Verification Script
 * @dev Script to verify the functionality of deployed contracts on Sepolina Testnet
 * @notice This script performs a series of tests on the deployed contracts to ensure they function correctly
 */

const { ethers, network } = require('hardhat');
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

// Verification test suite
async function main() {
  // Ensure we're on the Sepolina network
  if (network.name !== 'sepolina' && network.name !== 'sepolia') {
    console.error('This script is intended to be run on the Sepolina/Sepolia testnet only');
    console.error(`Current network: ${network.name}`);
    process.exit(1);
  }
  
  console.log(`Verifying D-Loop Protocol deployment on ${network.name} testnet...`);
  
  // Get the latest deployment file
  const deploymentPath = path.join(__dirname, '../../deployments');
  const deploymentFiles = fs.readdirSync(deploymentPath)
    .filter(file => file.startsWith(`deployment-${network.name}`))
    .sort((a, b) => {
      // Sort by timestamp (descending)
      const timeA = new Date(a.split('-').slice(2).join('-').replace('.json', ''));
      const timeB = new Date(b.split('-').slice(2).join('-').replace('.json', ''));
      return timeB - timeA;
    });
  
  if (deploymentFiles.length === 0) {
    console.error(`No deployment files found for ${network.name}`);
    process.exit(1);
  }
  
  const latestDeployment = JSON.parse(
    fs.readFileSync(path.join(deploymentPath, deploymentFiles[0]), 'utf8')
  );
  
  console.log(`Using deployment from: ${latestDeployment.network.timestamp}`);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Verifying with address: ${signer.address}`);
  
  // Load deployed contracts
  const contracts = {};
  for (const [name, info] of Object.entries(latestDeployment.contracts)) {
    console.log(`Loading ${name} at ${info.address}...`);
    contracts[name] = await ethers.getContractAt(name, info.address);
  }
  
  // Verification results
  const results = {
    timestamp: new Date().toISOString(),
    network: network.name,
    tests: []
  };
  
  // Helper function to run a test and record results
  async function runTest(name, testFn) {
    console.log(`\nRunning test: ${name}`);
    try {
      await testFn();
      console.log(`✅ Test passed: ${name}`);
      results.tests.push({ name, status: 'passed' });
      return true;
    } catch (error) {
      console.error(`❌ Test failed: ${name}`);
      console.error(error);
      results.tests.push({ 
        name, 
        status: 'failed',
        error: error.message
      });
      return false;
    }
  }
  
  // 1. Verify SoulboundNFT functionality
  await runTest('SoulboundNFT - Admin Role Check', async () => {
    const adminRole = await contracts.SoulboundNFT.ADMIN_ROLE();
    const hasAdminRole = await contracts.SoulboundNFT.hasRole(adminRole, signer.address);
    expect(hasAdminRole).to.be.true;
  });
  
  await runTest('SoulboundNFT - Minter Role Check', async () => {
    const minterRole = await contracts.SoulboundNFT.MINTER_ROLE();
    const registryAddress = contracts.AINodeRegistry.target;
    const hasMinterRole = await contracts.SoulboundNFT.hasRole(minterRole, registryAddress);
    expect(hasMinterRole).to.be.true;
  });
  
  // 2. Verify DLoopToken functionality
  await runTest('DLoopToken - Admin Check', async () => {
    const isAdmin = await contracts.DLoopToken.isAdmin(signer.address);
    expect(isAdmin).to.be.true;
  });
  
  await runTest('DLoopToken - Minter Role Check', async () => {
    const daoAddress = contracts.ProtocolDAO.target;
    const isMinter = await contracts.DLoopToken.isMinter(daoAddress);
    expect(isMinter).to.be.true;
  });
  
  // 3. Verify ProtocolDAO functionality
  await runTest('ProtocolDAO - Treasury Configuration', async () => {
    const treasuryAddress = await contracts.ProtocolDAO.treasury();
    expect(treasuryAddress.toLowerCase()).to.equal(contracts.Treasury.target.toLowerCase());
  });
  
  await runTest('ProtocolDAO - Registry Configuration', async () => {
    const registryAddress = await contracts.ProtocolDAO.nodeRegistry();
    expect(registryAddress.toLowerCase()).to.equal(contracts.AINodeRegistry.target.toLowerCase());
  });
  
  // 4. Verify AINodeRegistry functionality
  await runTest('AINodeRegistry - Admin Check', async () => {
    const isAdmin = await contracts.AINodeRegistry.hasRole(
      await contracts.AINodeRegistry.ADMIN_ROLE(),
      signer.address
    );
    expect(isAdmin).to.be.true;
  });
  
  await runTest('AINodeRegistry - SoulboundNFT Integration', async () => {
    const soulboundAddress = await contracts.AINodeRegistry.getSoulboundNFTAddress();
    expect(soulboundAddress.toLowerCase()).to.equal(contracts.SoulboundNFT.target.toLowerCase());
  });
  
  // 5. Verify Treasury functionality
  await runTest('Treasury - DAO Access Control', async () => {
    const daoAddress = await contracts.Treasury.protocolDAO();
    expect(daoAddress.toLowerCase()).to.equal(contracts.ProtocolDAO.target.toLowerCase());
  });
  
  // 6. Verify GovernanceRewards functionality
  await runTest('GovernanceRewards - Token Configuration', async () => {
    const tokenAddress = await contracts.GovernanceRewards.governanceToken();
    expect(tokenAddress.toLowerCase()).to.equal(contracts.DLoopToken.target.toLowerCase());
  });
  
  await runTest('GovernanceRewards - DAO Configuration', async () => {
    const daoAddress = await contracts.GovernanceRewards.protocolDAO();
    expect(daoAddress.toLowerCase()).to.equal(contracts.ProtocolDAO.target.toLowerCase());
  });
  
  // 7. Verify cross-contract interactions
  await runTest('Cross-Contract - Node Registration Flow', async () => {
    // This test simulates the full node registration flow
    // 1. Register a node through AINodeRegistry
    // 2. Verify SoulboundNFT is minted
    // 3. Verify node state is active
    
    const nodeAddress = ethers.Wallet.createRandom().address;
    const nodeOwner = signer.address;
    const metadata = 'Test Node Metadata';
    
    // Register the node
    const tx = await contracts.AINodeRegistry.registerNode(
      nodeAddress,
      nodeOwner,
      metadata
    );
    const receipt = await tx.wait(1);
    
    // Find the NodeRegistered event
    const nodeRegisteredEvent = receipt.logs.find(
      log => {
        try {
          const parsedLog = contracts.AINodeRegistry.interface.parseLog(log);
          return parsedLog && parsedLog.name === 'NodeRegistered';
        } catch (e) {
          return false;
        }
      }
    );
    expect(nodeRegisteredEvent).to.not.be.undefined;
    
    // Parse the event
    const parsedEvent = contracts.AINodeRegistry.interface.parseLog(nodeRegisteredEvent);
    
    // Get the token ID from the event
    const tokenId = parsedEvent.args.soulboundTokenId;
    
    // Verify SoulboundNFT ownership
    const tokenOwner = await contracts.SoulboundNFT.ownerOf(tokenId);
    expect(tokenOwner).to.equal(nodeOwner);
    
    // Verify node info
    const nodeInfo = await contracts.AINodeRegistry.getNodeInfo(nodeAddress);
    expect(nodeInfo.owner).to.equal(nodeOwner);
    expect(nodeInfo.metadata).to.equal(metadata);
    expect(nodeInfo.soulboundTokenId).to.equal(tokenId);
  });
  
  // 8. Verify deactivateNode functionality
  await runTest('AINodeRegistry - Node Deactivation Flow', async () => {
    // Create a new node for this test
    const nodeAddress = ethers.Wallet.createRandom().address;
    const nodeOwner = signer.address;
    const metadata = 'Deactivation Test Node';
    
    // Register the node
    await (await contracts.AINodeRegistry.registerNode(
      nodeAddress,
      nodeOwner,
      metadata
    )).wait(1);
    
    // Deactivate the node
    const tx = await contracts.AINodeRegistry.deactivateNode(nodeAddress);
    const receipt = await tx.wait();
    
    // Find the NodeDeactivated event
    const nodeDeactivatedEvent = receipt.events.find(
      e => e.event === 'NodeDeactivated'
    );
    expect(nodeDeactivatedEvent).to.not.be.undefined;
    
    // Verify node state is inactive (0 = Inactive in the enum)
    const nodeInfo = await contracts.AINodeRegistry.getNodeInfo(nodeAddress);
    expect(nodeInfo.state).to.equal(0); // 0 = Inactive
  });
  
  // Save verification results
  const resultsPath = path.join(__dirname, '../../deployments');
  const filename = `verification-${network.name}-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(
    path.join(resultsPath, filename),
    JSON.stringify(results, null, 2)
  );
  
  // Print summary
  console.log('\n=== Verification Summary ===');
  console.log(`Total Tests: ${results.tests.length}`);
  const passedTests = results.tests.filter(t => t.status === 'passed').length;
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${results.tests.length - passedTests}`);
  console.log(`Success Rate: ${(passedTests / results.tests.length * 100).toFixed(2)}%`);
  console.log(`Results saved to: deployments/${filename}`);
  
  if (passedTests < results.tests.length) {
    console.log('\n⚠️ Some verification tests failed. Review the results file for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All verification tests passed! The deployment is functioning correctly.');
  }
}

// Execute the verification
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
