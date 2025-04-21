/**
 * Reliable FeeCalculator Test
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
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'FeeCalculator') {
    filePath = path.join(artifactPath, 'fees', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'MockToken') {
    filePath = path.join(artifactPath, 'mocks', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'TokenApprovalOptimizer') {
    filePath = path.join(artifactPath, 'utils', `${contractName}.sol`, `${contractName}.json`);
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
    
    // Get the first 5 accounts using hardcoded indices
    const deployer = await provider.getSigner(0);
    const admin = await provider.getSigner(1);
    const treasury = await provider.getSigner(2);
    const rewardDistributor = await provider.getSigner(3);
    const user1 = await provider.getSigner(4);
    
    console.log('Test accounts:');
    console.log(`Deployer: ${await deployer.getAddress()}`);
    console.log(`Admin: ${await admin.getAddress()}`);
    console.log(`Treasury: ${await treasury.getAddress()}`);
    console.log(`RewardDistributor: ${await rewardDistributor.getAddress()}`);
    console.log(`User1: ${await user1.getAddress()}`);
    
    // Deploy MockToken for fee payments
    console.log('Deploying MockToken...');
    const MockTokenArtifact = loadArtifact('MockToken');
    const MockTokenFactory = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      deployer
    );
    
    const mockToken = await MockTokenFactory.deploy("Fee Token", "FEE", 18);
    const tokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at ${tokenAddress}`);
    
    // Mint tokens for testing
    const mintAmount = ethers.parseUnits("1000", 18);
    await mockToken.connect(deployer).mint(await user1.getAddress(), mintAmount);
    console.log(`Minted ${ethers.formatUnits(mintAmount, 18)} tokens to User1`);
    
    // Deploy TokenApprovalOptimizer (will be set afterwards)
    console.log('Deploying TokenApprovalOptimizer...');
    const TokenApprovalOptimizerArtifact = loadArtifact('TokenApprovalOptimizer');
    const TokenApprovalOptimizerFactory = new ethers.ContractFactory(
      TokenApprovalOptimizerArtifact.abi,
      TokenApprovalOptimizerArtifact.bytecode,
      deployer
    );
    
    const tokenApprovalOptimizer = await TokenApprovalOptimizerFactory.deploy();
    const optimizerAddress = await tokenApprovalOptimizer.getAddress();
    console.log(`TokenApprovalOptimizer deployed at ${optimizerAddress}`);
    
    // Deploy FeeCalculator with correct parameters
    console.log('Deploying FeeCalculator...');
    const FeeCalculatorArtifact = loadArtifact('FeeCalculator');
    const FeeCalculatorFactory = new ethers.ContractFactory(
      FeeCalculatorArtifact.abi,
      FeeCalculatorArtifact.bytecode,
      deployer
    );
    
    const adminAddress = await admin.getAddress();
    const treasuryAddress = await treasury.getAddress();
    const rewardDistributorAddress = await rewardDistributor.getAddress();
    
    // Initial parameters for deployment (only using the 6 required parameters)
    const investFeePercentage = 1000; // 10%
    const divestFeePercentage = 500;  // 5%
    const ragequitFeePercentage = 40; // 0.4%
    
    const feeCalculator = await FeeCalculatorFactory.deploy(
      adminAddress,
      treasuryAddress,
      rewardDistributorAddress,
      investFeePercentage,
      divestFeePercentage,
      ragequitFeePercentage
    );
    
    const feeCalculatorAddress = await feeCalculator.getAddress();
    console.log(`FeeCalculator deployed at ${feeCalculatorAddress}`);
    
    // Set the approval optimizer after deployment
    console.log('Setting approval optimizer...');
    await feeCalculator.setApprovalOptimizer(optimizerAddress);
    console.log('Approval optimizer set');
    
    // Test 1: Verify initialization parameters
    console.log('Test 1: Verifying initialization parameters...');
    const actualInvestFee = await feeCalculator.investFeePercentage();
    const actualDivestFee = await feeCalculator.divestFeePercentage();
    const actualRagequitFee = await feeCalculator.ragequitFeePercentage();
    const actualTreasury = await feeCalculator.treasury();
    const actualRewardDistributor = await feeCalculator.rewardDistributor();
    const actualApprovalOptimizer = await feeCalculator.approvalOptimizer();
    
    // Fetch the distribution percentages (these should be set to defaults)
    const actualTreasuryPercentage = await feeCalculator.treasuryPercentage();
    const actualRewardPercentage = await feeCalculator.rewardDistPercentage();
    
    console.log(`Invest fee: ${actualInvestFee}`);
    console.log(`Divest fee: ${actualDivestFee}`);
    console.log(`Ragequit fee: ${actualRagequitFee}`);
    console.log(`Treasury percentage: ${actualTreasuryPercentage}`);
    console.log(`Reward percentage: ${actualRewardPercentage}`);
    
    assert.equal(actualInvestFee, investFeePercentage, "Invest fee not set correctly");
    assert.equal(actualDivestFee, divestFeePercentage, "Divest fee not set correctly");
    assert.equal(actualRagequitFee, ragequitFeePercentage, "Ragequit fee not set correctly");
    assert.equal(actualTreasuryPercentage, 7000, "Treasury percentage should default to 7000 (70%)");
    assert.equal(actualRewardPercentage, 3000, "Reward percentage should default to 3000 (30%)");
    assert.equal(actualTreasury.toLowerCase(), treasuryAddress.toLowerCase(), "Treasury not set correctly");
    assert.equal(actualRewardDistributor.toLowerCase(), rewardDistributorAddress.toLowerCase(), "Reward distributor not set correctly");
    assert.equal(actualApprovalOptimizer.toLowerCase(), optimizerAddress.toLowerCase(), "Approval optimizer not set correctly");
    
    console.log('✅ Initialization parameters verified');
    
    // Test 2: Calculate fees
    console.log('Test 2: Calculating fees...');
    const amount = ethers.parseUnits("100", 18);
    
    const investFee = await feeCalculator.calculateInvestFee(amount);
    console.log(`Invest fee for ${ethers.formatUnits(amount, 18)} tokens: ${ethers.formatUnits(investFee, 18)}`);
    const expectedInvestFee = amount * BigInt(investFeePercentage) / 10000n;
    assert.equal(investFee, expectedInvestFee, "Invest fee calculation incorrect");
    
    const divestFee = await feeCalculator.calculateDivestFee(amount);
    console.log(`Divest fee for ${ethers.formatUnits(amount, 18)} tokens: ${ethers.formatUnits(divestFee, 18)}`);
    const expectedDivestFee = amount * BigInt(divestFeePercentage) / 10000n;
    assert.equal(divestFee, expectedDivestFee, "Divest fee calculation incorrect");
    
    const ragequitFee = await feeCalculator.calculateRagequitFee(amount);
    console.log(`Ragequit fee for ${ethers.formatUnits(amount, 18)} tokens: ${ethers.formatUnits(ragequitFee, 18)}`);
    const expectedRagequitFee = amount * BigInt(ragequitFeePercentage) / 10000n;
    assert.equal(ragequitFee, expectedRagequitFee, "Ragequit fee calculation incorrect");
    
    console.log('✅ Fee calculations verified');
    
    // Test 3: Role-based access control
    console.log('Test 3: Testing role-based access control...');
    
    // Get the DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await feeCalculator.DEFAULT_ADMIN_ROLE();
    const FEE_ADMIN_ROLE = await feeCalculator.FEE_ADMIN_ROLE();
    const FEE_COLLECTOR_ROLE = await feeCalculator.FEE_COLLECTOR_ROLE();
    
    // Check roles
    const deployerHasDefaultAdminRole = await feeCalculator.hasRole(DEFAULT_ADMIN_ROLE, await deployer.getAddress());
    const adminHasFeeAdminRole = await feeCalculator.hasRole(FEE_ADMIN_ROLE, adminAddress);
    const treasuryHasFeeCollectorRole = await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, treasuryAddress);
    const rewardDistributorHasFeeCollectorRole = await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, rewardDistributorAddress);
    
    console.log(`Deployer has DEFAULT_ADMIN_ROLE: ${deployerHasDefaultAdminRole}`);
    console.log(`Admin has FEE_ADMIN_ROLE: ${adminHasFeeAdminRole}`);
    console.log(`Treasury has FEE_COLLECTOR_ROLE: ${treasuryHasFeeCollectorRole}`);
    console.log(`Reward Distributor has FEE_COLLECTOR_ROLE: ${rewardDistributorHasFeeCollectorRole}`);
    
    assert.equal(deployerHasDefaultAdminRole, true, "Deployer should have DEFAULT_ADMIN_ROLE");
    assert.equal(adminHasFeeAdminRole, true, "Admin should have FEE_ADMIN_ROLE");
    assert.equal(treasuryHasFeeCollectorRole, true, "Treasury should have FEE_COLLECTOR_ROLE");
    assert.equal(rewardDistributorHasFeeCollectorRole, true, "Reward Distributor should have FEE_COLLECTOR_ROLE");
    
    console.log('✅ Role-based access control verified');
    
    // Test 4: Toggle approval optimization
    console.log('Test 4: Testing approval optimization toggle...');
    
    const initialOptimizationState = await feeCalculator.useApprovalOptimization();
    console.log(`Initial optimization state: ${initialOptimizationState}`);
    
    // Toggle optimization
    await feeCalculator.connect(admin).toggleApprovalOptimization(!initialOptimizationState);
    
    const newOptimizationState = await feeCalculator.useApprovalOptimization();
    console.log(`New optimization state: ${newOptimizationState}`);
    
    assert.equal(newOptimizationState, !initialOptimizationState, "Optimization toggle failed");
    
    console.log('✅ Approval optimization toggle verified');
    
    // Test 5: Update fee parameters
    console.log('Test 5: Testing direct parameter update...');
    
    const newInvestFeePercentage = 800; // 8%
    
    await feeCalculator.connect(admin).updateInvestFeePercentage(newInvestFeePercentage);
    
    const updatedInvestFee = await feeCalculator.investFeePercentage();
    console.log(`Updated invest fee: ${updatedInvestFee}`);
    
    assert.equal(updatedInvestFee, newInvestFeePercentage, "Invest fee not updated correctly");
    
    console.log('✅ Parameter update verified');
    
    console.log('All tests passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run the tests
console.log('Starting Reliable FeeCalculator Test');
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});