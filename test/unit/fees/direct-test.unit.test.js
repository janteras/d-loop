/**
 * Direct Testing Script - No Hardhat Dependencies
 * This file tests the FeeCalculator contract directly using ethers.js without hardhat
 */
const { ethers } = require('ethers');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

async function runTests() {
  try {
    console.log("Starting direct test...");
    
    // Connect to local Hardhat node
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    
    // Use private keys since we can't rely on getSigners
    // These are default Hardhat test accounts
    const PRIVATE_KEYS = [
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Account #0
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account #1
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account #2
      '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // Account #3
      '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a'  // Account #4
    ];
    
    // Create wallet instances
    const owner = new ethers.Wallet(PRIVATE_KEYS[0], provider);
    const feeAdmin = new ethers.Wallet(PRIVATE_KEYS[1], provider);
    const treasury = new ethers.Wallet(PRIVATE_KEYS[2], provider);
    const rewardDistributor = new ethers.Wallet(PRIVATE_KEYS[3], provider);
    const user = new ethers.Wallet(PRIVATE_KEYS[4], provider);
    
    console.log("Owner address:", owner.address);
    console.log("Fee Admin address:", feeAdmin.address);
    
    // Load FeeCalculator ABI
    const feeCalculatorPath = path.join(__dirname, '../artifacts/contracts/fees/FeeCalculator.sol/FeeCalculator.json');
    const feeCalculatorJSON = JSON.parse(fs.readFileSync(feeCalculatorPath, 'utf8'));
    const feeCalculatorABI = feeCalculatorJSON.abi;
    
    // Constants for deployment
    const INVEST_FEE = 1000; // 10%
    const DIVEST_FEE = 500;  // 5%
    const RAGEQUIT_FEE = 40; // 0.4% (0.3% standard + 0.1% emergency)
    
    // Deploy contract
    const FeeCalculatorFactory = new ethers.ContractFactory(
      feeCalculatorJSON.abi, 
      feeCalculatorJSON.bytecode, 
      owner
    );
    
    console.log("Deploying FeeCalculator...");
    const feeCalculator = await FeeCalculatorFactory.deploy(
      feeAdmin.address,
      treasury.address,
      rewardDistributor.address,
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    
    // Wait for contract deployment
    await feeCalculator.waitForDeployment();
    const feeCalculatorAddress = await feeCalculator.getAddress();
    console.log("FeeCalculator deployed at:", feeCalculatorAddress);
    
    // Test initial state
    console.log("Testing initial state...");
    expect(await feeCalculator.feeAdmin()).to.equal(feeAdmin.address);
    expect(await feeCalculator.treasury()).to.equal(treasury.address);
    expect(await feeCalculator.rewardDistributor()).to.equal(rewardDistributor.address);
    expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
    expect(await feeCalculator.divestFeePercentage()).to.equal(DIVEST_FEE);
    expect(await feeCalculator.ragequitFeePercentage()).to.equal(RAGEQUIT_FEE);
    console.log("✓ Initial state verified");
    
    // Test fee admin updating parameters
    console.log("Testing fee parameter updates...");
    const newInvestFee = 1200; // 12%
    const feeCalculatorWithFeeAdmin = feeCalculator.connect(feeAdmin);
    await feeCalculatorWithFeeAdmin.updateInvestFeePercentage(newInvestFee);
    expect(await feeCalculator.investFeePercentage()).to.equal(newInvestFee);
    console.log("✓ Fee parameter update verified");
    
    // Grant fee collector role to user
    console.log("Testing role assignment...");
    const FEE_COLLECTOR_ROLE = await feeCalculator.FEE_COLLECTOR_ROLE();
    await feeCalculator.grantRole(FEE_COLLECTOR_ROLE, user.address);
    console.log("✓ Role assignment completed");
    
    // Test fee calculation
    console.log("Testing fee calculation...");
    const amount = ethers.parseUnits("100", 18); // 100 tokens
    const feeCalculatorWithUser = feeCalculator.connect(user);
    const calculatedFee = await feeCalculatorWithUser.calculateDivestFee(amount);
    const expectedFee = amount * BigInt(DIVEST_FEE) / BigInt(10000);
    expect(calculatedFee).to.equal(expectedFee);
    console.log("✓ Fee calculation verified");
    
    console.log("All tests passed successfully!");
    return true;
  } catch (error) {
    console.error("Test failed:", error);
    return false;
  }
}

// Run the tests directly
runTests().then(success => {
  if (success) {
    console.log("Direct test completed successfully");
    process.exit(0);
  } else {
    console.log("Direct test failed");
    process.exit(1);
  }
});