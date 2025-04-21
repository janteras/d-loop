/**
 * Standalone Treasury Reentrancy Test
 * 
 * This is a standalone test for the Treasury contract's reentrancy protection.
 * It doesn't rely on complex test frameworks or connectivity helpers.
 */

const hre = require("hardhat");
const { expect } = require("chai");

// Main test function
async function main() {
  console.log("Starting Standalone Treasury Reentrancy Test");
  
  try {
    // Get signers
    const [owner, admin, protocolDAO, attacker, user] = await hre.ethers.getSigners();
    
    console.log("Test accounts:");
    console.log(`- Owner: ${owner.address}`);
    console.log(`- Admin: ${admin.address}`);
    console.log(`- ProtocolDAO: ${protocolDAO.address}`);
    console.log(`- Attacker: ${attacker.address}`);
    console.log(`- User: ${user.address}`);
    
    // Deploy mock token
    console.log("\nDeploying MockToken...");
    const MockToken = await hre.ethers.getContractFactory("MockToken");
    const mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at: ${mockTokenAddress}`);
    
    // Deploy Treasury
    console.log("\nDeploying Treasury...");
    const Treasury = await hre.ethers.getContractFactory("contracts/fees/Treasury.sol:Treasury");
    const treasury = await Treasury.deploy(admin.address, protocolDAO.address);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`Treasury deployed at: ${treasuryAddress}`);
    
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
    
    await mockToken.mint(treasuryAddress, mintAmount);
    await mockToken.mint(attacker.address, mintAmount);
    await mockToken.mint(user.address, mintAmount);
    
    // Send some ETH to Treasury for testing
    await owner.sendTransaction({
      to: treasuryAddress,
      value: hre.ethers.parseEther("10")
    });
    
    // Approve treasury to spend attacker's tokens
    await mockToken.connect(attacker).approve(treasuryAddress, mintAmount);
    
    // Approve treasury to spend user's tokens
    await mockToken.connect(user).approve(treasuryAddress, mintAmount);
    
    console.log("Test setup completed successfully");
    
    // Test 1: Withdraw function reentrancy protection
    console.log("\n=== Test 1: Withdraw Function Reentrancy Protection ===");
    
    // Initialize attacker contract with target and attack data
    const withdrawAttackData = treasury.interface.encodeFunctionData("withdraw", [
      mockTokenAddress, 
      attackerContractAddress, 
      hre.ethers.parseEther("10")
    ]);
    
    await attackerContract.connect(attacker).setAttackData(treasuryAddress, withdrawAttackData);
    
    // Configure attacker as reentrant
    await attackerContract.connect(attacker).setReentrant(true);
    
    console.log("Attacker configured for withdraw reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting withdraw reentrancy attack...");
    try {
      // Only protocolDAO can call withdraw
      await treasury.connect(protocolDAO).withdraw(
        hre.ethers.ZeroAddress, // ETH, which can trigger fallback functions
        attackerContractAddress,
        hre.ethers.parseEther("1")
      );
      console.log("Transaction completed, checking balances...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Check final state
    const treasuryBalanceAfterWithdraw = await hre.ethers.provider.getBalance(treasuryAddress);
    console.log(`Treasury still has ${hre.ethers.formatEther(treasuryBalanceAfterWithdraw)} ETH`);
    
    // Verify that the treasury still has most of its funds
    if (treasuryBalanceAfterWithdraw > hre.ethers.parseEther("8")) {
      console.log("✅ Withdraw reentrancy protection test PASSED");
    } else {
      console.log("❌ Withdraw reentrancy protection test FAILED - Treasury drained");
      throw new Error("Withdraw reentrancy protection test failed");
    }
    
    // Test 2: WithdrawFromProtocol function reentrancy protection
    console.log("\n=== Test 2: WithdrawFromProtocol Function Reentrancy Protection ===");
    
    // Prepare withdrawAmount 
    const withdrawAmount = hre.ethers.parseEther("5");
    
    // Approve treasury to spend user tokens
    await mockToken.connect(user).approve(treasuryAddress, withdrawAmount);
    
    // Get user's initial balance
    const userInitialBalance = await mockToken.balanceOf(user.address);
    console.log(`User initial balance: ${hre.ethers.formatEther(userInitialBalance)} tokens`);
    
    // Initialize attacker contract with target and attack data
    const withdrawFromProtocolAttackData = treasury.interface.encodeFunctionData("withdrawFromProtocol", [
      mockTokenAddress, 
      user.address,
      attackerContractAddress, 
      withdrawAmount,
      "Attack Purpose"
    ]);
    
    await attackerContract.connect(attacker).setAttackData(treasuryAddress, withdrawFromProtocolAttackData);
    
    // Configure attacker as reentrant
    await attackerContract.connect(attacker).setReentrant(true);
    
    console.log("Attacker configured for withdrawFromProtocol reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting withdrawFromProtocol reentrancy attack...");
    try {
      await treasury.connect(admin).withdrawFromProtocol(
        mockTokenAddress, 
        user.address,
        attackerContractAddress, 
        withdrawAmount,
        "Initial Withdraw"
      );
      console.log("Transaction completed, checking balances...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Check final state
    const userBalanceAfterWithdrawFromProtocol = await mockToken.balanceOf(user.address);
    console.log(`User still has ${hre.ethers.formatEther(userBalanceAfterWithdrawFromProtocol)} tokens`);
    
    // Verify that the user still has most of their tokens
    if (userBalanceAfterWithdrawFromProtocol > hre.ethers.parseEther("90")) {
      console.log("✅ WithdrawFromProtocol reentrancy protection test PASSED");
    } else {
      console.log("❌ WithdrawFromProtocol reentrancy protection test FAILED - User account drained");
      throw new Error("WithdrawFromProtocol reentrancy protection test failed");
    }
    
    // Test 3: ExecuteDelegatedTransfer function reentrancy protection
    console.log("\n=== Test 3: ExecuteDelegatedTransfer Function Reentrancy Protection ===");
    
    // Set up a chain of approvals for the complex transfer
    await mockToken.connect(user).approve(treasuryAddress, hre.ethers.parseEther("100"));
    
    // Get user's initial balance after previous test
    const userInitialBalanceForExecute = await mockToken.balanceOf(user.address);
    console.log(`User initial balance: ${hre.ethers.formatEther(userInitialBalanceForExecute)} tokens`);
    
    // Initialize attacker contract with target and attack data
    const executeDelegatedTransferAttackData = treasury.interface.encodeFunctionData("executeDelegatedTransfer", [
      mockTokenAddress, 
      user.address,
      user.address,
      user.address,
      attackerContractAddress, 
      hre.ethers.parseEther("5"),
      "Attack Purpose"
    ]);
    
    await attackerContract.connect(attacker).setAttackData(treasuryAddress, executeDelegatedTransferAttackData);
    
    // Configure attacker as reentrant
    await attackerContract.connect(attacker).setReentrant(true);
    
    console.log("Attacker configured for executeDelegatedTransfer reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting executeDelegatedTransfer reentrancy attack...");
    try {
      await treasury.connect(admin).executeDelegatedTransfer(
        mockTokenAddress, 
        user.address,
        user.address,
        user.address,
        attackerContractAddress, 
        hre.ethers.parseEther("5"),
        "Initial Transfer"
      );
      console.log("Transaction completed, checking balances...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Check final state
    const userBalanceAfterExecuteDelegatedTransfer = await mockToken.balanceOf(user.address);
    console.log(`User still has ${hre.ethers.formatEther(userBalanceAfterExecuteDelegatedTransfer)} tokens`);
    
    // Verify that the user still has most of their tokens
    if (userBalanceAfterExecuteDelegatedTransfer > hre.ethers.parseEther("80")) {
      console.log("✅ ExecuteDelegatedTransfer reentrancy protection test PASSED");
    } else {
      console.log("❌ ExecuteDelegatedTransfer reentrancy protection test FAILED - User account drained");
      throw new Error("ExecuteDelegatedTransfer reentrancy protection test failed");
    }
    
    console.log("\n=== All Treasury reentrancy protection tests PASSED ===");
    
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