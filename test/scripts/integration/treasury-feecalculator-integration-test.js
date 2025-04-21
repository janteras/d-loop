/**
 * Treasury and FeeCalculator Integration Test
 * 
 * This test demonstrates the integration between Treasury and FeeCalculator contracts,
 * showing how fees are collected and distributed in the DLOOP protocol.
 */

const ethers = require('../../ethers-v6-shim.standalone');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

// Configuration
const HARDHAT_PORT = 8545;
const RPC_URL = `http://127.0.0.1:${HARDHAT_PORT}`;

// Load contract artifacts
function loadArtifact(contractName) {
  const artifactPath = path.join(__dirname, '../../artifacts/contracts');
  let filePath;
  
  if (contractName === 'FeeCalculator') {
    filePath = path.join(artifactPath, 'fees', `${contractName}.sol`, `${contractName}.json`);
  } else if (contractName === 'Treasury') {
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

// Start an isolated hardhat node for testing
function startHardhatNode() {
  console.log('Starting Hardhat node...');
  execSync('npx hardhat node --port 8545 --hostname 127.0.0.1 &');
  // Give it a moment to start up
  return new Promise(resolve => setTimeout(resolve, 3000));
}

// Kill any existing hardhat node
function shutdownHardhatNode() {
  console.log('Shutting down Hardhat node...');
  try {
    execSync('pkill -f "hardhat node" || true');
    // Wait for processes to terminate
    setTimeout(() => {}, 1000);
  } catch (e) {
    console.log('Hardhat node already terminated');
  }
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
    // Ensure a clean environment
    shutdownHardhatNode();
    await startHardhatNode();
    
    // Connect to the node
    const provider = await getConnectedProvider();
    
    // Get test accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    const [deployer, admin, protocolDAO, treasury, rewardDistributor, user1] = await Promise.all(
      accounts.slice(0, 6).map(address => provider.getSigner(address))
    );
    
    console.log('Test accounts:');
    console.log('Deployer:', deployer);
    console.log('Admin:', admin);
    console.log('ProtocolDAO:', protocolDAO);
    console.log('Treasury:', treasury);
    console.log('RewardDistributor:', rewardDistributor);
    console.log('User1:', user1);
    
    // Compile contracts
    console.log('Compiling contracts...');
    execSync('npx hardhat compile');
    
    // Deploy MockToken for fee payments
    console.log('Deploying MockToken...');
    const MockTokenArtifact = loadArtifact('MockToken');
    const MockTokenFactory = new ethers.ContractFactory(
      MockTokenArtifact.abi,
      MockTokenArtifact.bytecode,
      deployer
    );
    
    const mockToken = await MockTokenFactory.deploy("Fee Token", "FEE");
    const tokenAddress = await mockToken.getAddress();
    console.log(`MockToken deployed at ${tokenAddress}`);
    
    // Mint tokens for testing
    const mintAmount = ethers.parseUnits("1000", 18);
    await mockToken.connect(deployer).mint(await user1.getAddress(), mintAmount);
    console.log(`Minted ${ethers.formatUnits(mintAmount, 18)} tokens to User1`);
    
    // Deploy TokenApprovalOptimizer
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
    
    // Deploy Treasury contract
    console.log('Deploying Treasury...');
    const TreasuryArtifact = loadArtifact('Treasury');
    const TreasuryFactory = new ethers.ContractFactory(
      TreasuryArtifact.abi,
      TreasuryArtifact.bytecode,
      deployer
    );
    
    const treasuryContract = await TreasuryFactory.deploy(
      await admin.getAddress(),
      await protocolDAO.getAddress()
    );
    
    const treasuryAddress = await treasuryContract.getAddress();
    console.log(`Treasury deployed at ${treasuryAddress}`);
    
    // Deploy FeeCalculator
    console.log('Deploying FeeCalculator...');
    const FeeCalculatorArtifact = loadArtifact('FeeCalculator');
    const FeeCalculatorFactory = new ethers.ContractFactory(
      FeeCalculatorArtifact.abi,
      FeeCalculatorArtifact.bytecode,
      deployer
    );
    
    // Initial parameters for deployment
    const investFeePercentage = 1000; // 10%
    const divestFeePercentage = 500;  // 5%
    const ragequitFeePercentage = 40; // 0.4%
    const treasuryPercentage = 7000;  // 70%
    const rewardDistPercentage = 3000; // 30%
    
    const feeCalculator = await FeeCalculatorFactory.deploy(
      await admin.getAddress(),
      treasuryAddress,
      await rewardDistributor.getAddress(),
      investFeePercentage,
      divestFeePercentage,
      ragequitFeePercentage,
      treasuryPercentage,
      rewardDistPercentage,
      optimizerAddress
    );
    
    const feeCalculatorAddress = await feeCalculator.getAddress();
    console.log(`FeeCalculator deployed at ${feeCalculatorAddress}`);
    
    // Test 1: Grant FeeCalculator the ability to deposit into Treasury
    console.log('Test 1: Setting up Treasury permissions for FeeCalculator...');
    
    // Treasury admin grants approval to FeeCalculator
    await treasuryContract.connect(admin).allowTokenTransfer(
      tokenAddress,
      feeCalculatorAddress,
      ethers.MaxUint256 // Unlimited allowance
    );
    
    console.log('✅ Treasury permissions configured');
    
    // Test 2: Full integration flow - User pays fees, Treasury and RewardDistributor receive them
    console.log('Test 2: Testing full fee collection and distribution flow...');
    
    // Amount for the test
    const investAmount = ethers.parseUnits("100", 18);
    
    // User approves FeeCalculator to spend tokens
    await mockToken.connect(user1).approve(feeCalculatorAddress, investAmount);
    
    // Check initial balances
    const initialTreasuryBalance = await mockToken.balanceOf(treasuryAddress);
    const initialRewardDistBalance = await mockToken.balanceOf(await rewardDistributor.getAddress());
    const initialUser1Balance = await mockToken.balanceOf(await user1.getAddress());
    
    console.log(`Initial balances:`);
    console.log(`- Treasury: ${ethers.formatUnits(initialTreasuryBalance, 18)} tokens`);
    console.log(`- Reward Distributor: ${ethers.formatUnits(initialRewardDistBalance, 18)} tokens`);
    console.log(`- User1: ${ethers.formatUnits(initialUser1Balance, 18)} tokens`);
    
    // Grant fee collector role to user1 for testing
    const FEE_COLLECTOR_ROLE = await feeCalculator.FEE_COLLECTOR_ROLE();
    await feeCalculator.connect(admin).grantRole(FEE_COLLECTOR_ROLE, await user1.getAddress());
    
    // Process invest fee
    console.log('Processing invest fee...');
    await feeCalculator.connect(user1).processInvestFee(
      tokenAddress,
      await user1.getAddress(),
      investAmount
    );
    
    // Check final balances
    const finalTreasuryBalance = await mockToken.balanceOf(treasuryAddress);
    const finalRewardDistBalance = await mockToken.balanceOf(await rewardDistributor.getAddress());
    const finalUser1Balance = await mockToken.balanceOf(await user1.getAddress());
    
    console.log(`Final balances:`);
    console.log(`- Treasury: ${ethers.formatUnits(finalTreasuryBalance, 18)} tokens`);
    console.log(`- Reward Distributor: ${ethers.formatUnits(finalRewardDistBalance, 18)} tokens`);
    console.log(`- User1: ${ethers.formatUnits(finalUser1Balance, 18)} tokens`);
    
    // Calculate expected fees
    const expectedInvestFee = investAmount * BigInt(investFeePercentage) / 10000n;
    const expectedTreasuryFee = expectedInvestFee * BigInt(treasuryPercentage) / 10000n;
    const expectedRewardFee = expectedInvestFee * BigInt(rewardDistPercentage) / 10000n;
    
    console.log(`Expected fees:`);
    console.log(`- Total fee: ${ethers.formatUnits(expectedInvestFee, 18)} tokens`);
    console.log(`- Treasury portion: ${ethers.formatUnits(expectedTreasuryFee, 18)} tokens`);
    console.log(`- Reward portion: ${ethers.formatUnits(expectedRewardFee, 18)} tokens`);
    
    // Verify balances
    const treasuryIncrease = finalTreasuryBalance - initialTreasuryBalance;
    const rewardIncrease = finalRewardDistBalance - initialRewardDistBalance;
    const userDecrease = initialUser1Balance - finalUser1Balance;
    
    console.log(`Actual transfers:`);
    console.log(`- Treasury received: ${ethers.formatUnits(treasuryIncrease, 18)} tokens`);
    console.log(`- Reward Distributor received: ${ethers.formatUnits(rewardIncrease, 18)} tokens`);
    console.log(`- User1 paid: ${ethers.formatUnits(userDecrease, 18)} tokens`);
    
    assert.equal(treasuryIncrease, expectedTreasuryFee, "Treasury did not receive correct amount");
    assert.equal(rewardIncrease, expectedRewardFee, "Reward distributor did not receive correct amount");
    assert.equal(userDecrease, expectedInvestFee, "User did not pay correct amount");
    
    console.log('✅ Fee collection and distribution flow verified');
    
    // Test 3: Treasury withdrawals work properly
    console.log('Test 3: Testing Treasury withdrawal functionality...');
    
    // Admin extracts tokens from Treasury to a protocol DAO address
    const withdrawAmount = expectedTreasuryFee / 2n;
    
    await treasuryContract.connect(admin).withdraw(
      tokenAddress,
      await protocolDAO.getAddress(),
      withdrawAmount
    );
    
    // Check balances after withdrawal
    const treasuryBalanceAfterWithdrawal = await mockToken.balanceOf(treasuryAddress);
    const protocolDAOBalance = await mockToken.balanceOf(await protocolDAO.getAddress());
    
    console.log(`Balances after withdrawal:`);
    console.log(`- Treasury: ${ethers.formatUnits(treasuryBalanceAfterWithdrawal, 18)} tokens`);
    console.log(`- ProtocolDAO: ${ethers.formatUnits(protocolDAOBalance, 18)} tokens`);
    
    assert.equal(protocolDAOBalance, withdrawAmount, "ProtocolDAO did not receive correct withdrawal amount");
    assert.equal(treasuryBalanceAfterWithdrawal, finalTreasuryBalance - withdrawAmount, "Treasury balance incorrect after withdrawal");
    
    console.log('✅ Treasury withdrawal functionality verified');
    
    console.log('All integration tests passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the tests
console.log('Starting Treasury-FeeCalculator Integration Test');
main().catch(error => {
  console.error('Test failed:', error);
  shutdownHardhatNode();
  process.exit(1);
});