/**
 * Treasury Standalone Test
 * 
 * This test verifies the core functionality of the Treasury contract.
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
    
    const [admin, user1, user2, feeRecipient] = accounts;
    
    console.log('Using accounts:');
    console.log(`- Admin: ${admin.address}`);
    console.log(`- User1: ${user1.address}`);
    console.log(`- User2: ${user2.address}`);
    console.log(`- FeeRecipient: ${feeRecipient.address}`);

    // Read contract artifacts
    const treasuryPath = path.join(__dirname, '../../artifacts/contracts/fees/Treasury.sol/Treasury.json');
    const TreasuryArtifact = JSON.parse(fs.readFileSync(treasuryPath, 'utf8'));
    console.log('Contract artifact loaded');

    // Deploy TestToken for funding tests
    console.log('Deploying test token...');
    const TestTokenPath = path.join(__dirname, '../../artifacts/contracts/token/DLoopToken.sol/DLoopToken.json');
    const TestTokenArtifact = JSON.parse(fs.readFileSync(TestTokenPath, 'utf8'));
    
    const TokenFactory = new ethers.ContractFactory(
      TestTokenArtifact.abi,
      TestTokenArtifact.bytecode,
      admin
    );
    
    const testToken = await TokenFactory.deploy("Test Token", "TEST");
    await testToken.waitForDeployment();
    const testTokenAddress = await testToken.getAddress();
    console.log(`Test token deployed at ${testTokenAddress}`);
    
    // Mint tokens to user
    const mintAmount = ethers.parseEther("1000");
    await testToken.mint(user1.address, mintAmount);
    console.log(`Minted ${ethers.formatEther(mintAmount)} tokens to user1`);
    
    // Deploy Treasury
    console.log('Deploying Treasury...');
    const TreasuryFactory = new ethers.ContractFactory(
      TreasuryArtifact.abi,
      TreasuryArtifact.bytecode,
      admin
    );
    
    const treasury = await TreasuryFactory.deploy();
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`Treasury deployed at ${treasuryAddress}`);

    // Test 1: Admin authorization
    console.log('\nTest 1: Verifying admin authorization...');
    const isAuthorized = await treasury.isAuthorized(admin.address);
    assert.equal(isAuthorized, true, "Admin should be authorized");
    
    // Test 2: Authorizing a new user
    console.log('\nTest 2: Authorizing a new user...');
    await treasury.connect(admin).authorize(user1.address, true);
    const user1Authorized = await treasury.isAuthorized(user1.address);
    assert.equal(user1Authorized, true, "User1 should be authorized after authorization");
    
    // Test 3: Deposit funds
    console.log('\nTest 3: Depositing funds...');
    const depositAmount = ethers.parseEther("100");
    
    // Approve treasury to spend tokens
    await testToken.connect(user1).approve(treasuryAddress, depositAmount);
    console.log(`User1 approved treasury to spend ${ethers.formatEther(depositAmount)} tokens`);
    
    // Deposit tokens to treasury
    await treasury.connect(user1).deposit(testTokenAddress, depositAmount);
    console.log(`Deposited ${ethers.formatEther(depositAmount)} tokens to treasury`);
    
    // Check balance
    const treasuryBalance = await testToken.balanceOf(treasuryAddress);
    console.log(`Treasury balance: ${ethers.formatEther(treasuryBalance)} tokens`);
    assert.equal(treasuryBalance.toString(), depositAmount.toString(), "Treasury should have the deposited amount");
    
    // Test 4: Withdraw funds
    console.log('\nTest 4: Withdrawing funds...');
    const withdrawAmount = ethers.parseEther("50");
    
    // Withdraw tokens from treasury to fee recipient
    await treasury.connect(admin).withdraw(testTokenAddress, withdrawAmount, feeRecipient.address);
    console.log(`Withdrew ${ethers.formatEther(withdrawAmount)} tokens from treasury to fee recipient`);
    
    // Check balances
    const newTreasuryBalance = await testToken.balanceOf(treasuryAddress);
    const feeRecipientBalance = await testToken.balanceOf(feeRecipient.address);
    
    console.log(`New treasury balance: ${ethers.formatEther(newTreasuryBalance)} tokens`);
    console.log(`Fee recipient balance: ${ethers.formatEther(feeRecipientBalance)} tokens`);
    
    assert.equal(
      newTreasuryBalance.toString(), 
      (depositAmount - withdrawAmount).toString(), 
      "Treasury should have the remaining amount"
    );
    
    assert.equal(
      feeRecipientBalance.toString(), 
      withdrawAmount.toString(), 
      "Fee recipient should have the withdrawn amount"
    );
    
    // Test 5: Unauthorized operation
    console.log('\nTest 5: Testing unauthorized operations...');
    await treasury.connect(admin).authorize(user1.address, false); // Remove authorization
    
    try {
      await treasury.connect(user1).withdraw(testTokenAddress, withdrawAmount, user1.address);
      assert.fail("Should have thrown an error for unauthorized withdrawal");
    } catch (error) {
      // Expected error
      assert(error.message.includes("Not authorized"), "Error should be related to authorization");
    }
    
    console.log('✅ All Treasury tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting Treasury Standalone Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});