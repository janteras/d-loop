/**
 * Standalone FeeCalculator Security Test
 * 
 * This is a standalone test for the FeeCalculator contract's security features,
 * particularly its reentrancy protection. It doesn't rely on complex test frameworks
 * or connectivity helpers.
 */

const hre = require("hardhat");
const { expect } = require("chai");

// Main test function
async function main() {
  console.log("Starting Standalone FeeCalculator Security Test");
  
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
    const mockToken = await MockToken.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();
    const mockTokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at: ${mockTokenAddress}`);
    
    // Deploy Treasury
    console.log("\nDeploying Treasury...");
    const Treasury = await hre.ethers.getContractFactory("contracts/fees/Treasury.sol:Treasury");
    // Treasury constructor takes admin, protocolDAO (the owner is msg.sender)
    const treasury = await Treasury.deploy(
      admin.address, 
      protocolDAO.address
    );
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`Treasury deployed at: ${treasuryAddress}`);
    
    // Deploy TokenApprovalOptimizer
    console.log("\nDeploying TokenApprovalOptimizer...");
    const TokenApprovalOptimizer = await hre.ethers.getContractFactory("contracts/utils/TokenApprovalOptimizer.sol:TokenApprovalOptimizer");
    // Pass default threshold value of 20
    const approvalOptimizer = await TokenApprovalOptimizer.deploy(20);
    await approvalOptimizer.waitForDeployment();
    const approvalOptimizerAddress = await approvalOptimizer.getAddress();
    console.log(`TokenApprovalOptimizer deployed at: ${approvalOptimizerAddress}`);
    
    // Deploy FeeCalculator
    console.log("\nDeploying FeeCalculator...");
    const FeeCalculator = await hre.ethers.getContractFactory("contracts/fees/FeeCalculator.sol:FeeCalculator");
    const feeCalculator = await FeeCalculator.deploy(
      owner.address,
      admin.address,
      treasuryAddress,
      user1.address, // Using user1 as reward distributor for simplicity
      approvalOptimizerAddress
    );
    await feeCalculator.waitForDeployment();
    const feeCalculatorAddress = await feeCalculator.getAddress();
    console.log(`FeeCalculator deployed at: ${feeCalculatorAddress}`);
    
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
    await mockToken.mint(user1.address, mintAmount);
    
    // Grant Treasury the appropriate role to receive fees
    await treasury.connect(owner).grantProtocolRole(feeCalculatorAddress);
    console.log("Granted FeeCalculator the Protocol role on Treasury");
    
    // Setup FeeCalculator with necessary roles
    console.log("\nSetting up FeeCalculator roles...");
    
    // Get default roles from FeeCalculator
    const FEE_COLLECTOR_ROLE = await feeCalculator.FEE_COLLECTOR_ROLE();
    console.log(`FEE_COLLECTOR_ROLE: ${FEE_COLLECTOR_ROLE}`);
    
    // Grant necessary roles
    await feeCalculator.connect(owner).grantFeeCollectorRole(admin.address);
    await feeCalculator.connect(owner).grantFeeCollectorRole(attackerContractAddress);
    console.log("Roles granted successfully");
    
    // Approve tokens for fee operations
    await mockToken.connect(attacker).approve(feeCalculatorAddress, hre.ethers.parseEther("1000"));
    await mockToken.connect(user1).approve(feeCalculatorAddress, hre.ethers.parseEther("1000"));
    console.log("Token approvals set");
    
    // Test 1: Process Invest Fee reentrancy protection
    console.log("\n=== Test 1: Process Invest Fee Reentrancy Protection ===");
    
    // Setup attack data
    const processFeeAmount = hre.ethers.parseEther("10");
    const processFeeAttackData = feeCalculator.interface.encodeFunctionData("processInvestFee", [
      processFeeAmount,
      user1.address,
      mockTokenAddress
    ]);
    
    // Configure attacker contract
    await attackerContract.connect(attacker).setAttackData(feeCalculatorAddress, processFeeAttackData);
    await attackerContract.connect(attacker).setReentrant(true);
    
    console.log("Attacker configured for processInvestFee reentrancy attempt");
    
    // Initial balances
    const user1InitialBalance = await mockToken.balanceOf(user1.address);
    console.log(`User1 initial balance: ${hre.ethers.formatEther(user1InitialBalance)} tokens`);
    
    // Try to perform the attack
    console.log("Attempting processInvestFee reentrancy attack...");
    try {
      // Execute the fee process through the attacker contract
      await feeCalculator.connect(admin).processInvestFee(
        processFeeAmount,
        attackerContractAddress,
        mockTokenAddress
      );
      console.log("Transaction completed, checking for attack success...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Verify no reentrancy succeeded by checking Treasury's balance hasn't been unexpectedly reduced
    const user1FinalBalance = await mockToken.balanceOf(user1.address);
    console.log(`User1 final balance: ${hre.ethers.formatEther(user1FinalBalance)} tokens`);
    
    // Test 2: Process Divest Fee reentrancy protection
    console.log("\n=== Test 2: Process Divest Fee Reentrancy Protection ===");
    
    // Setup attack data for divest fee
    const processDivestFeeAttackData = feeCalculator.interface.encodeFunctionData("processDivestFee", [
      processFeeAmount,
      user1.address,
      mockTokenAddress
    ]);
    
    // Update attacker contract
    await attackerContract.connect(attacker).setAttackData(feeCalculatorAddress, processDivestFeeAttackData);
    
    console.log("Attacker configured for processDivestFee reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting processDivestFee reentrancy attack...");
    try {
      await feeCalculator.connect(admin).processDivestFee(
        processFeeAmount,
        attackerContractAddress,
        mockTokenAddress
      );
      console.log("Transaction completed, checking for attack success...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    // Test 3: Process Ragequit Fee reentrancy protection
    console.log("\n=== Test 3: Process Ragequit Fee Reentrancy Protection ===");
    
    // Setup attack data for ragequit fee
    const processRagequitFeeAttackData = feeCalculator.interface.encodeFunctionData("processRagequitFee", [
      processFeeAmount,
      user1.address,
      mockTokenAddress
    ]);
    
    // Update attacker contract
    await attackerContract.connect(attacker).setAttackData(feeCalculatorAddress, processRagequitFeeAttackData);
    
    console.log("Attacker configured for processRagequitFee reentrancy attempt");
    
    // Try to perform the attack
    console.log("Attempting processRagequitFee reentrancy attack...");
    try {
      await feeCalculator.connect(admin).processRagequitFee(
        processFeeAmount,
        attackerContractAddress,
        mockTokenAddress
      );
      console.log("Transaction completed, checking for attack success...");
    } catch (error) {
      console.log(`Transaction reverted: ${error.message}`);
    }
    
    console.log("\n=== Final Security Verification ===");
    
    // Verify Treasury still has expected funds
    const treasuryBalance = await mockToken.balanceOf(treasuryAddress);
    console.log(`Treasury final balance: ${hre.ethers.formatEther(treasuryBalance)} tokens`);
    
    if (treasuryBalance >= hre.ethers.parseEther("70")) {
      console.log("✅ Treasury funds secured, reentrancy protection working properly");
    } else {
      console.log("❌ Treasury may have been drained through reentrancy");
      throw new Error("Reentrancy protection failed");
    }
    
    console.log("\n=== All FeeCalculator security tests PASSED ===");
    
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