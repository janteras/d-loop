/**
 * FeeCalculator Standalone Test
 * 
 * This test verifies the core functionality of the FeeCalculator contract.
 */

// Load the improved ethers v6 shim
require('../../utils/ethers-v6-compat');
const { ethers } = require('ethers');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Hardhat node process
let hardhatProcess = null;

// Utility function to check if addresses are the same (case-insensitive)
function isSameAddress(addr1, addr2) {
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// Start Hardhat node if not running
async function startHardhatNode() {
  try {
    // Try to connect to existing node
    const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');
    await provider.getBlockNumber();
    console.log('Connected to existing Hardhat node');
    return provider;
  } catch (error) {
    console.log('No existing Hardhat node found, starting a new one...');
    // Start a new Hardhat node
    const { spawn } = require('child_process');
    hardhatProcess = spawn('npx', ['hardhat', 'node', '--hostname', '0.0.0.0', '--port', '8545'], {
      stdio: 'pipe'
    });
    
    // Wait for the node to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');
    return provider;
  }
}

// Shutdown Hardhat node if we started it
function shutdownHardhatNode() {
  if (hardhatProcess) {
    console.log('Shutting down Hardhat node...');
    hardhatProcess.kill();
  }
}

async function main() {
  try {
    // Start provider
    const provider = await startHardhatNode();
    console.log('Provider created');

    // Get accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    const [admin, treasury, rewards, user1] = accounts;
    
    console.log('Using accounts:');
    console.log(`- Admin: ${admin.address}`);
    console.log(`- Treasury: ${treasury.address}`);
    console.log(`- Rewards: ${rewards.address}`);
    console.log(`- User1: ${user1.address}`);

    // Read contract artifacts
    const feeCalculatorPath = path.join(__dirname, '../../artifacts/contracts/fees/FeeCalculator.sol/FeeCalculator.json');
    const FeeCalculatorArtifact = JSON.parse(fs.readFileSync(feeCalculatorPath, 'utf8'));
    console.log('Contract artifact loaded');

    // Deploy FeeCalculator
    console.log('Deploying FeeCalculator...');
    const FeeCalculatorFactory = new ethers.ContractFactory(
      FeeCalculatorArtifact.abi,
      FeeCalculatorArtifact.bytecode,
      admin
    );
    
    // Deploy with treasury and rewards addresses
    const feeCalculator = await FeeCalculatorFactory.deploy(treasury.address, rewards.address);
    await feeCalculator.waitForDeployment();
    const feeCalculatorAddress = await feeCalculator.getAddress();
    console.log(`FeeCalculator deployed at ${feeCalculatorAddress}`);

    // Test 1: Check the treasury address
    console.log('\nTest 1: Verifying treasury address...');
    const configuredTreasury = await feeCalculator.treasury();
    assert(isSameAddress(configuredTreasury, treasury.address), "Treasury address should match");
    
    // Test 2: Check the rewards address
    console.log('\nTest 2: Verifying rewards address...');
    const configuredRewards = await feeCalculator.rewards();
    assert(isSameAddress(configuredRewards, rewards.address), "Rewards address should match");
    
    // Test 3: Calculate standard fee (0.3%)
    console.log('\nTest 3: Calculating standard fee...');
    const amount = ethers.parseEther("1000"); // 1000 tokens
    const standardFee = await feeCalculator.calculateStandardFee(amount);
    
    // Expected: 0.3% of 1000 = 3 tokens
    const expectedStandardFee = ethers.parseEther("3");
    console.log(`Standard fee for ${ethers.formatEther(amount)} tokens: ${ethers.formatEther(standardFee)} tokens`);
    assert.equal(standardFee.toString(), expectedStandardFee.toString(), "Standard fee calculation incorrect");
    
    // Test 4: Calculate emergency fee (0.1%)
    console.log('\nTest 4: Calculating emergency fee...');
    const emergencyFee = await feeCalculator.calculateEmergencyFee(amount);
    
    // Expected: 0.1% of 1000 = 1 token
    const expectedEmergencyFee = ethers.parseEther("1");
    console.log(`Emergency fee for ${ethers.formatEther(amount)} tokens: ${ethers.formatEther(emergencyFee)} tokens`);
    assert.equal(emergencyFee.toString(), expectedEmergencyFee.toString(), "Emergency fee calculation incorrect");
    
    // Test 5: Calculate total fee (0.4%)
    console.log('\nTest 5: Calculating total fee...');
    const totalFee = await feeCalculator.calculateTotalFee(amount);
    
    // Expected: 0.4% of 1000 = 4 tokens
    const expectedTotalFee = ethers.parseEther("4");
    console.log(`Total fee for ${ethers.formatEther(amount)} tokens: ${ethers.formatEther(totalFee)} tokens`);
    assert.equal(totalFee.toString(), expectedTotalFee.toString(), "Total fee calculation incorrect");
    
    // Test 6: Calculate fee distribution
    console.log('\nTest 6: Calculating fee distribution...');
    const distribution = await feeCalculator.calculateFeeDistribution(amount);
    
    // Expected distribution: 70% to treasury (2.8 tokens) and 30% to rewards (1.2 tokens)
    const expectedTreasuryFee = ethers.parseEther("2.8");
    const expectedRewardsFee = ethers.parseEther("1.2");
    
    console.log(`Treasury allocation: ${ethers.formatEther(distribution[0])} tokens`);
    console.log(`Rewards allocation: ${ethers.formatEther(distribution[1])} tokens`);
    
    assert.equal(distribution[0].toString(), expectedTreasuryFee.toString(), "Treasury allocation incorrect");
    assert.equal(distribution[1].toString(), expectedRewardsFee.toString(), "Rewards allocation incorrect");
    
    // Test 7: Update treasury address
    console.log('\nTest 7: Updating treasury address...');
    await feeCalculator.connect(admin).updateTreasury(user1.address);
    const newTreasury = await feeCalculator.treasury();
    assert(isSameAddress(newTreasury, user1.address), "Treasury address should be updated");
    
    console.log('✅ All FeeCalculator tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting FeeCalculator Standalone Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});