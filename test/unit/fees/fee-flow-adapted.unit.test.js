/**
 * @title Fee Flow Test - Adapted Version with Direct Provider Calls
 * @dev Test for validating end-to-end fee processing in DLoop protocol
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Helper function to compute role hashes consistent with solidity keccak256
 */
function computeRoleHash(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role));
}

describe("Fee Flow - Adapted", function() {
  // Common test variables
  let daiToken, assetDAO, feeProcessor, feeCalculator, treasury;
  let owner, admin, investor;
  
  // Fee constants in basis points
  const INVEST_FEE = 1000;      // 10%
  const DIVEST_FEE = 500;       // 5%
  const RAGEQUIT_FEE = 2000;    // 20%
  const TREASURY_PERCENTAGE = 7000;  // 70%
  const REWARDS_PERCENTAGE = 3000;   // 30%
  
  // Direct provider call helpers
  async function getBalance(tokenAddress, account) {
    try {
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const encoded = token.interface.encodeFunctionData("balanceOf", [account]);
      const result = await ethers.provider.send("eth_call", [{
        to: tokenAddress,
        data: encoded
      }, "latest"]);
      
      const decoded = token.interface.decodeFunctionResult("balanceOf", result);
      return decoded[0];
    } catch (error) {
      console.error(`Error getting balance for ${account}:`, error.message);
      return ethers.parseEther("0");
    }
  }
  
  async function getAllowance(tokenAddress, owner, spender) {
    try {
      const token = await ethers.getContractAt("IERC20", tokenAddress);
      const encoded = token.interface.encodeFunctionData("allowance", [owner, spender]);
      const result = await ethers.provider.send("eth_call", [{
        to: tokenAddress,
        data: encoded
      }, "latest"]);
      
      const decoded = token.interface.decodeFunctionResult("allowance", result);
      return decoded[0];
    } catch (error) {
      console.error(`Error getting allowance for ${owner} -> ${spender}:`, error.message);
      return ethers.parseEther("0");
    }
  }
  
  beforeEach(async function() {
    console.log("==== Setting up test environment ====");
    
    // Get accounts
    [owner, admin, investor] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log("- Owner:", owner.address);
    console.log("- Admin:", admin.address);
    console.log("- Investor:", investor.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token deployed at:", daiToken.target);
    
    // Deploy DLoop token
    const DLToken = await ethers.getContractFactory("DAIToken");
    dloopToken = await DLToken.deploy("DLOOP", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    console.log("DLOOP Token deployed at:", dloopToken.target);
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.waitForDeployment();
    console.log("Treasury deployed at:", treasury.target);
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      admin.address,
      treasury.target,
      treasury.target, // Use treasury as reward distributor for simplicity
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    await feeCalculator.waitForDeployment();
    console.log("FeeCalculator deployed at:", feeCalculator.target);
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.target,
      treasury.target, // Use treasury as reward distributor
      feeCalculator.target,
      admin.address,
      TREASURY_PERCENTAGE,
      REWARDS_PERCENTAGE
    );
    await feeProcessor.waitForDeployment();
    console.log("FeeProcessor deployed at:", feeProcessor.target);
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      daiToken.target,
      dloopToken.target,
      treasury.target, // Using treasury as price oracle for simplicity
      feeProcessor.target
    );
    await assetDAO.waitForDeployment();
    console.log("AssetDAO deployed at:", assetDAO.target);
    
    // Setup permissions and initial balances
    
    // Grant AUTHORIZED_CONTRACT_ROLE to AssetDAO
    const AUTHORIZED_ROLE = computeRoleHash("AUTHORIZED_CONTRACT_ROLE");
    await feeProcessor.connect(owner).grantRole(AUTHORIZED_ROLE, assetDAO.target);
    console.log("Granted AUTHORIZED_CONTRACT_ROLE to AssetDAO in FeeProcessor");
    
    // Mint DAI to investor
    await daiToken.connect(owner).mint(investor.address, ethers.parseEther("1000000"));
    console.log("Minted 1,000,000 DAI to investor");
    
    // Investor approves AssetDAO to spend DAI
    await daiToken.connect(investor).approve(assetDAO.target, ethers.parseEther("1000000"));
    console.log("Investor approved AssetDAO to spend DAI");
    
    // AssetDAO approves FeeProcessor to spend tokens
    await assetDAO.connect(owner).allowTokenTransfer(
      daiToken.target, 
      feeProcessor.target, 
      ethers.parseEther("1000000")
    );
    console.log("AssetDAO approved FeeProcessor to spend tokens");
    
    // Create test asset
    await assetDAO.connect(admin).createAsset("Test Asset", "For fee flow testing");
    console.log("Created test asset with ID 1");
    
    // Verify setup using direct provider calls
    const investorBalance = await getBalance(daiToken.target, investor.address);
    const investorAllowance = await getAllowance(daiToken.target, investor.address, assetDAO.target);
    
    console.log("Setup verification:");
    console.log(`- Investor DAI balance: ${investorBalance.toString()}`);
    console.log(`- Investor allowance to AssetDAO: ${investorAllowance.toString()}`);
  });
  
  it("should process fees correctly on investment", async function() {
    try {
      console.log("\n=== Testing investment with fee processing ===");
      
      // Record initial balances using direct provider calls
      const initialInvestorBalance = await getBalance(daiToken.target, investor.address);
      const initialAssetDAOBalance = await getBalance(daiToken.target, assetDAO.target);
      const initialTreasuryBalance = await getBalance(daiToken.target, treasury.target);
      
      console.log("Initial balances:");
      console.log(`- Investor: ${initialInvestorBalance.toString()}`);
      console.log(`- AssetDAO: ${initialAssetDAOBalance.toString()}`);
      console.log(`- Treasury: ${initialTreasuryBalance.toString()}`);
      
      // Calculate expected values for later verification
      const investAmount = ethers.parseEther("1000");
      console.log(`\nInvesting ${ethers.formatEther(investAmount)} DAI in asset 1`);
      
      const expectedFee = (investAmount * BigInt(INVEST_FEE)) / BigInt(10000);
      const expectedTreasuryFee = (expectedFee * BigInt(TREASURY_PERCENTAGE)) / BigInt(10000);
      const expectedRewardFee = (expectedFee * BigInt(REWARDS_PERCENTAGE)) / BigInt(10000);
      const expectedNetInvestment = investAmount - expectedFee;
      
      console.log("Expected values:");
      console.log(`- Total fee: ${ethers.formatEther(expectedFee)} DAI (${INVEST_FEE/100}%)`);
      console.log(`- Treasury fee: ${ethers.formatEther(expectedTreasuryFee)} DAI (${TREASURY_PERCENTAGE/100}%)`);
      console.log(`- Reward fee: ${ethers.formatEther(expectedRewardFee)} DAI (${REWARDS_PERCENTAGE/100}%)`);
      console.log(`- Net investment: ${ethers.formatEther(expectedNetInvestment)} DAI`);
      
      // Execute investment
      console.log("\nExecuting investment transaction...");
      const investTx = await assetDAO.connect(investor).invest(1, investAmount);
      const receipt = await investTx.wait();
      console.log(`Investment completed in transaction: ${receipt.hash}`);
      
      // Check final balances using direct provider calls
      const finalInvestorBalance = await getBalance(daiToken.target, investor.address);
      const finalAssetDAOBalance = await getBalance(daiToken.target, assetDAO.target);
      const finalTreasuryBalance = await getBalance(daiToken.target, treasury.target);
      
      console.log("\nFinal balances:");
      console.log(`- Investor: ${finalInvestorBalance.toString()}`);
      console.log(`- AssetDAO: ${finalAssetDAOBalance.toString()}`);
      console.log(`- Treasury: ${finalTreasuryBalance.toString()}`);
      
      // Calculate actual changes
      const investorDiff = initialInvestorBalance - finalInvestorBalance;
      const assetDAODiff = finalAssetDAOBalance - initialAssetDAOBalance;
      const treasuryDiff = finalTreasuryBalance - initialTreasuryBalance;
      
      console.log("\nBalance changes:");
      console.log(`- Investor decrease: ${ethers.formatEther(investorDiff)} DAI`);
      console.log(`- AssetDAO increase: ${ethers.formatEther(assetDAODiff)} DAI`);
      console.log(`- Treasury increase: ${ethers.formatEther(treasuryDiff)} DAI`);
      
      // Verify values against expectations
      expect(investorDiff).to.equal(investAmount);
      console.log("✓ Investor paid correct amount");
      
      expect(assetDAODiff).to.equal(expectedNetInvestment);
      console.log("✓ AssetDAO received correct net investment amount");
      
      // Treasury gets both the treasury and reward fees (since we're using treasury for both)
      expect(treasuryDiff).to.equal(expectedTreasuryFee + expectedRewardFee);
      console.log("✓ Treasury received correct fee amount");
      
      // Verify investor received shares
      const encoded = assetDAO.interface.encodeFunctionData("getInvestorShares", [1, investor.address]);
      const result = await ethers.provider.send("eth_call", [{
        to: assetDAO.target,
        data: encoded
      }, "latest"]);
      
      const decodedShares = assetDAO.interface.decodeFunctionResult("getInvestorShares", result);
      const shares = decodedShares[0];
      
      console.log(`\nInvestor received ${shares.toString()} shares in asset 1`);
      expect(shares).to.be.above(0);
      console.log("✓ Investor received shares in the asset");
      
      console.log("\n=== Fee flow test completed successfully ===");
    } catch (error) {
      console.error("Test failed:", error.message);
      throw error;
    }
  });
});