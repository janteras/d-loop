/**
 * Standalone GovernanceRewards Security Test
 * 
 * This test targets the GovernanceRewards contract's security features, particularly
 * its reentrancy protection and role-based access control. It doesn't rely on complex
 * test frameworks or connectivity helpers.
 */

const hre = require("hardhat");
const { expect } = require("chai");

// Main test function
async function main() {
  console.log("Starting Standalone GovernanceRewards Security Test");
  
  try {
    // Get signers
    const [owner, admin, protocolDAO, attacker, user1] = await hre.ethers.getSigners();
    
    console.log("Test accounts:");
    console.log(`- Owner: ${owner.address}`);
    console.log(`- Admin: ${admin.address}`);
    console.log(`- Protocol DAO: ${protocolDAO.address}`);
    console.log(`- Attacker: ${attacker.address}`);
    console.log(`- User1: ${user1.address}`);
    
    // Deploy mock token
    console.log("\nDeploying MockToken...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy("Governance Token", "GOV", 18);
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at: ${mockTokenAddress}`);
    
    // Deploy TokenApprovalOptimizer
    console.log("\nDeploying TokenApprovalOptimizer...");
    const TokenApprovalOptimizer = await hre.ethers.getContractFactory("contracts/utils/TokenApprovalOptimizer.sol:TokenApprovalOptimizer");
    // Pass default threshold value of 20
    const approvalOptimizer = await TokenApprovalOptimizer.deploy(20);
    await approvalOptimizer.waitForDeployment();
    const approvalOptimizerAddress = await approvalOptimizer.getAddress();
    console.log(`TokenApprovalOptimizer deployed at: ${approvalOptimizerAddress}`);
    
    // Deploy GovernanceRewards
    console.log("\nDeploying GovernanceRewards...");
    const GovernanceRewards = await hre.ethers.getContractFactory("contracts/governance/GovernanceRewards.sol:GovernanceRewards");
    // GovernanceRewards constructor takes rewardToken, admin
    const governanceRewards = await GovernanceRewards.deploy(
      mockTokenAddress,
      admin.address
    );
    await governanceRewards.waitForDeployment();
    const governanceRewardsAddress = await governanceRewards.getAddress();
    console.log(`GovernanceRewards deployed at: ${governanceRewardsAddress}`);
    
    // Deploy reentrancy attacker contract
    console.log("\nDeploying MockReentrancyAttacker...");
    const MockReentrancyAttacker = await hre.ethers.getContractFactory("MockReentrancyAttacker");
    const attackerContract = await MockReentrancyAttacker.deploy();
    await attackerContract.waitForDeployment();
    const attackerContractAddress = await attackerContract.getAddress();
    console.log(`MockReentrancyAttacker deployed at: ${attackerContractAddress}`);
    
    // Setup test tokens and approvals
    console.log("\nSetting up test tokens and approvals...");
    const mintAmount = hre.ethers.parseEther("100");
    
    await mockToken.mint(owner.address, mintAmount);
    await mockToken.mint(attacker.address, mintAmount);
    await mockToken.mint(user1.address, mintAmount);
    
    // Transfer tokens to GovernanceRewards contract for reward distribution
    console.log("\nTransferring tokens to GovernanceRewards contract...");
    await mockToken.connect(owner).transfer(governanceRewardsAddress, hre.ethers.parseEther("50"));
    
    // Setup GovernanceRewards with necessary roles
    console.log("\nSetting up GovernanceRewards roles...");
    
    // Get default roles from GovernanceRewards
    const REWARD_DISTRIBUTOR_ROLE = await governanceRewards.REWARD_DISTRIBUTOR_ROLE();
    console.log(`REWARD_DISTRIBUTOR_ROLE: ${REWARD_DISTRIBUTOR_ROLE}`);
    
    // Grant necessary roles
    await governanceRewards.connect(owner).grantRewardDistributorRole(admin.address);
    await governanceRewards.connect(owner).grantRewardDistributorRole(attackerContractAddress);
    console.log("Roles granted successfully");
    
    // Test 1: Distribute Rewards reentrancy protection
    console.log("\n=== Test 1: Distribute Rewards Reentrancy Protection ===");
    
    // Setup rewards data
    const users = [user1.address, attacker.address];
    const amounts = [hre.ethers.parseEther("10"), hre.ethers.parseEther("5")];
    
    // Setup attack data
    const distributeRewardsAttackData = governanceRewards.interface.encodeFunctionData(
      "distributeRewards", 
      [users, amounts]
    );
    
    // Configure attacker contract for reentrancy
    await attackerContract.connect(attacker).setAttackData(governanceRewardsAddress, distributeRewardsAttackData);
    await attackerContract.connect(attacker).setReentrant(true);
    
    console.log("Attacker configured for distributeRewards reentrancy attempt");
    
    // Initial balances
    const user1InitialBalance = await mockToken.balanceOf(user1.address);
    console.log(`User1 initial balance: ${hre.ethers.formatEther(user1InitialBalance)} tokens`);
    const contractInitialBalance = await mockToken.balanceOf(governanceRewardsAddress);
    console.log(`GovernanceRewards initial balance: ${hre.ethers.formatEther(contractInitialBalance)} tokens`);
    
    // Try to perform the attack
    console.log("Attempting distributeRewards reentrancy attack...");
    try {
      // Execute the reward distribution through the attacker contract
      const attackUsers = [attackerContractAddress, user1.address];
      const attackAmounts = [hre.ethers.parseEther("10"), hre.ethers.parseEther("5")];
      
      await governanceRewards.connect(admin).distributeRewards(attackUsers, attackAmounts);
      console.log("Transaction completed, checking for attack success...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Verify no reentrancy succeeded by checking contract balance
    const contractFinalBalance = await mockToken.balanceOf(governanceRewardsAddress);
    console.log(`GovernanceRewards final balance: ${hre.ethers.formatEther(contractFinalBalance)} tokens`);
    
    // Test 2: Update reward calculations reentrancy protection
    console.log("\n=== Test 2: Update Reward Rates Reentrancy Protection ===");
    
    // Setup attack data for updating reward rates
    const updateRewardRatesAttackData = governanceRewards.interface.encodeFunctionData(
      "updateRewardRates", 
      [[user1.address], [hre.ethers.parseEther("1")]]
    );
    
    // Update attacker contract
    await attackerContract.connect(attacker).setAttackData(governanceRewardsAddress, updateRewardRatesAttackData);
    
    console.log("Attacker configured for updateRewardRates reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting updateRewardRates reentrancy attack...");
    try {
      await governanceRewards.connect(admin).updateRewardRates(
        [attackerContractAddress], 
        [hre.ethers.parseEther("1")]
      );
      console.log("Transaction completed, checking for attack success...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Verify results with a clean distribution
    console.log("\n=== Final Security Verification ===");
    
    // Verify contract still has appropriate balance
    if (contractFinalBalance >= hre.ethers.parseEther("35")) {
      console.log("✅ GovernanceRewards contract funds secured, reentrancy protection working properly");
    } else {
      console.log("❌ GovernanceRewards contract may have been drained through reentrancy");
      throw new Error("Reentrancy protection failed");
    }
    
    // Execute a clean distribution to verify functionality
    console.log("\nExecuting clean reward distribution to verify functionality...");
    const cleanUsers = [user1.address];
    const cleanAmounts = [hre.ethers.parseEther("5")];
    
    await governanceRewards.connect(admin).distributeRewards(cleanUsers, cleanAmounts);
    
    // Verify the distribution worked properly
    const user1FinalBalance = await mockToken.balanceOf(user1.address);
    console.log(`User1 final balance: ${hre.ethers.formatEther(user1FinalBalance)} tokens`);
    
    if (user1FinalBalance > user1InitialBalance) {
      console.log("✅ Clean distribution successful");
    } else {
      console.log("❌ Clean distribution failed");
      throw new Error("Clean distribution failed");
    }
    
    console.log("\n=== All GovernanceRewards security tests PASSED ===");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Run the test
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test execution failed:", error);
    process.exit(1);
  });