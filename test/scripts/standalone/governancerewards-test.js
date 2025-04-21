/**
 * GovernanceRewards Standalone Test
 * 
 * This test verifies the core functionality of the GovernanceRewards contract.
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
    
    const [admin, feeDistributor, rewardManager, user1, user2] = accounts;
    
    console.log('Using accounts:');
    console.log(`- Admin: ${admin.address}`);
    console.log(`- Fee Distributor: ${feeDistributor.address}`);
    console.log(`- Reward Manager: ${rewardManager.address}`);
    console.log(`- User1: ${user1.address}`);
    console.log(`- User2: ${user2.address}`);

    // Read contract artifacts
    const governanceRewardsPath = path.join(__dirname, '../../artifacts/contracts/rewards/GovernanceRewards.sol/GovernanceRewards.json');
    const GovernanceRewardsArtifact = JSON.parse(fs.readFileSync(governanceRewardsPath, 'utf8'));
    console.log('Contract artifact loaded');

    // Deploy TestToken for rewards
    console.log('Deploying test token...');
    const TestTokenPath = path.join(__dirname, '../../artifacts/contracts/token/DLoopToken.sol/DLoopToken.json');
    const TestTokenArtifact = JSON.parse(fs.readFileSync(TestTokenPath, 'utf8'));
    
    const TokenFactory = new ethers.ContractFactory(
      TestTokenArtifact.abi,
      TestTokenArtifact.bytecode,
      admin
    );
    
    const testToken = await TokenFactory.deploy("Reward Token", "RWD");
    await testToken.waitForDeployment();
    const testTokenAddress = await testToken.getAddress();
    console.log(`Test token deployed at ${testTokenAddress}`);
    
    // Mint tokens to fee distributor
    const mintAmount = ethers.parseEther("1000");
    await testToken.mint(feeDistributor.address, mintAmount);
    console.log(`Minted ${ethers.formatEther(mintAmount)} tokens to fee distributor`);
    
    // Deploy GovernanceRewards
    console.log('Deploying GovernanceRewards...');
    const GovernanceRewardsFactory = new ethers.ContractFactory(
      GovernanceRewardsArtifact.abi,
      GovernanceRewardsArtifact.bytecode,
      admin
    );
    
    const governanceRewards = await GovernanceRewardsFactory.deploy();
    await governanceRewards.waitForDeployment();
    const governanceRewardsAddress = await governanceRewards.getAddress();
    console.log(`GovernanceRewards deployed at ${governanceRewardsAddress}`);

    // Test 1: Admin Role
    console.log('\nTest 1: Verifying admin role...');
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const hasAdminRole = await governanceRewards.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    assert.equal(hasAdminRole, true, "Admin should have DEFAULT_ADMIN_ROLE");
    
    // Test 2: Grant REWARD_MANAGER_ROLE
    console.log('\nTest 2: Granting REWARD_MANAGER_ROLE...');
    const REWARD_MANAGER_ROLE = await governanceRewards.REWARD_MANAGER_ROLE();
    await governanceRewards.connect(admin).grantRole(REWARD_MANAGER_ROLE, rewardManager.address);
    
    const hasRewardManagerRole = await governanceRewards.hasRole(REWARD_MANAGER_ROLE, rewardManager.address);
    assert.equal(hasRewardManagerRole, true, "Reward Manager should have REWARD_MANAGER_ROLE");
    
    // Test 3: Grant FEE_DISTRIBUTOR_ROLE
    console.log('\nTest 3: Granting FEE_DISTRIBUTOR_ROLE...');
    const FEE_DISTRIBUTOR_ROLE = await governanceRewards.FEE_DISTRIBUTOR_ROLE();
    await governanceRewards.connect(admin).grantRole(FEE_DISTRIBUTOR_ROLE, feeDistributor.address);
    
    const hasFeeDistributorRole = await governanceRewards.hasRole(FEE_DISTRIBUTOR_ROLE, feeDistributor.address);
    assert.equal(hasFeeDistributorRole, true, "Fee Distributor should have FEE_DISTRIBUTOR_ROLE");
    
    // Test 4: Distribute rewards
    console.log('\nTest 4: Distributing rewards...');
    
    // Approve governance rewards to spend tokens
    await testToken.connect(feeDistributor).approve(governanceRewardsAddress, mintAmount);
    console.log(`Fee distributor approved governance rewards to spend tokens`);
    
    // Distribute tokens to rewards contract
    const rewardAmount = ethers.parseEther("100");
    await governanceRewards.connect(feeDistributor).distributeRewards(testTokenAddress, rewardAmount);
    console.log(`Distributed ${ethers.formatEther(rewardAmount)} tokens to governance rewards`);
    
    // Check reward tokens balance
    const rewardsBalance = await testToken.balanceOf(governanceRewardsAddress);
    console.log(`GovernanceRewards balance: ${ethers.formatEther(rewardsBalance)} tokens`);
    assert.equal(rewardsBalance.toString(), rewardAmount.toString(), "GovernanceRewards should have the distributed amount");
    
    // Test 5: Allocate rewards to participant
    console.log('\nTest 5: Allocating rewards to participant...');
    const participantReward = ethers.parseEther("50");
    await governanceRewards.connect(rewardManager).allocateReward(user1.address, testTokenAddress, participantReward);
    console.log(`Allocated ${ethers.formatEther(participantReward)} tokens to user1`);
    
    // Check participant reward balance
    const user1Reward = await governanceRewards.getRewardBalance(user1.address, testTokenAddress);
    console.log(`User1 reward balance: ${ethers.formatEther(user1Reward)} tokens`);
    assert.equal(user1Reward.toString(), participantReward.toString(), "User1 should have the allocated reward amount");
    
    // Test 6: Claim rewards
    console.log('\nTest 6: Claiming rewards...');
    const user1BalanceBefore = await testToken.balanceOf(user1.address);
    console.log(`User1 balance before claiming: ${ethers.formatEther(user1BalanceBefore)} tokens`);
    
    await governanceRewards.connect(user1).claimReward(testTokenAddress);
    console.log(`User1 claimed rewards`);
    
    const user1BalanceAfter = await testToken.balanceOf(user1.address);
    console.log(`User1 balance after claiming: ${ethers.formatEther(user1BalanceAfter)} tokens`);
    
    const expectedBalance = user1BalanceBefore + participantReward;
    assert.equal(user1BalanceAfter.toString(), expectedBalance.toString(), "User1 should have received the claimed rewards");
    
    // Verify reward balance is now zero
    const user1RewardAfter = await governanceRewards.getRewardBalance(user1.address, testTokenAddress);
    assert.equal(user1RewardAfter.toString(), "0", "User1 reward balance should be zero after claiming");
    
    // Test 7: Unauthorized operations
    console.log('\nTest 7: Testing unauthorized operations...');
    try {
      await governanceRewards.connect(user2).allocateReward(user1.address, testTokenAddress, participantReward);
      assert.fail("Should have thrown an error for unauthorized reward allocation");
    } catch (error) {
      // Expected error
      assert(error.message.includes("AccessControl") || 
             error.message.includes("access") || 
             error.message.includes("denied") || 
             error.message.includes("unauthorized"), 
             "Error should be related to access control");
    }
    
    console.log('✅ All GovernanceRewards tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting GovernanceRewards Standalone Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});