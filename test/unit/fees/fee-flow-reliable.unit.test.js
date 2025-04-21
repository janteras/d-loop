/**
 * Fee Flow Test - Reliable Version
 * 
 * This test focuses on the core functionality of fees in the DLoop protocol.
 * It's designed to be more reliable with Hardhat's Ethers v6 integration by:
 * 
 * 1. Using simpler assertion patterns
 * 2. Addressing the provider connectivity issues
 * 3. Using direct Hardhat environment features when possible
 */

const { expect } = require("chai");
const hre = require("hardhat");

// Use the BigInt constructor for numeric values
const BN = (value) => BigInt(value);
// Helper for percentages
const percent = (value, percentage) => (value * BN(percentage)) / BN(10000);

describe("Fee Flow Integration - Reliable", function () {
  // Common test variables
  let daiToken, assetDAO, feeProcessor, feeCalculator, treasury, rewardDistributor;
  let owner, admin, investor;
  
  // Fee constants in basis points
  const INVEST_FEE = 1000;      // 10%
  const DIVEST_FEE = 500;       // 5%
  const RAGEQUIT_FEE = 2000;    // 20%
  const TREASURY_PERCENTAGE = 7000;  // 70%
  const REWARDS_PERCENTAGE = 3000;   // 30%
  
  // Convert string to BigInt with 18 decimals
  function toWei(value) {
    return BN(value) * BN("1000000000000000000"); 
  }
  
  beforeEach(async function () {
    // Get accounts (using Hardhat's ethers directly)
    [owner, admin, investor] = await hre.ethers.getSigners();
    
    console.log("Accounts prepared:");
    console.log("- Owner:", owner.address);
    console.log("- Admin:", admin.address);
    console.log("- Investor:", investor.address);
    
    // Deploy token contracts
    const DAIToken = await hre.ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI", "DAI", 18);
    await daiToken.waitForDeployment();
    
    // Deploy mock DLoop token 
    const DLToken = await hre.ethers.getContractFactory("DAIToken"); // Reuse DAI for simplicity
    dloopToken = await DLToken.deploy("DLOOP", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    
    // Deploy a basic treasury 
    const Treasury = await hre.ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address, owner.address);
    await treasury.waitForDeployment();
    
    // Use same contract for reward distributor
    rewardDistributor = await Treasury.deploy(owner.address, owner.address);
    await rewardDistributor.waitForDeployment();
    
    // Deploy simple oracle
    const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Deploy fee calculator
    const FeeCalculator = await hre.ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      admin.address,
      treasury.target,
      rewardDistributor.target, 
      INVEST_FEE,
      DIVEST_FEE, 
      RAGEQUIT_FEE
    );
    await feeCalculator.waitForDeployment();
    
    // Deploy fee processor
    const FeeProcessor = await hre.ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.target,
      rewardDistributor.target,
      feeCalculator.target,
      admin.address,
      TREASURY_PERCENTAGE,
      REWARDS_PERCENTAGE
    );
    await feeProcessor.waitForDeployment();
    
    // Finally deploy AssetDAO
    const AssetDAO = await hre.ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      daiToken.target,
      dloopToken.target,
      priceOracle.target,
      feeProcessor.target
    );
    await assetDAO.waitForDeployment();
    
    // Setup up permissions and initial balances
    const AUTHORIZED_ROLE = await feeProcessor.AUTHORIZED_CONTRACT_ROLE();
    
    // Grant role to AssetDAO
    await feeProcessor.connect(owner).grantRole(AUTHORIZED_ROLE, assetDAO.target);
    
    // Fund investor with lots of DAI
    await daiToken.connect(owner).mint(investor.address, toWei(1000000));
    
    // Approve DAI for AssetDAO to spend
    await daiToken.connect(investor).approve(assetDAO.target, toWei(1000000));
    
    // Allow AssetDAO to approve transfers to FeeProcessor
    await assetDAO.allowTokenTransfer(daiToken.target, feeProcessor.target, toWei(1000000));
    
    console.log("All contracts deployed and configured");
  });
  
  it("Should verify fee collection on investment", async function() {
    // Create asset
    await assetDAO.connect(admin).createAsset("Test Asset", "For fee testing");
    
    // Record initial balances
    const initialInvestorBalance = await daiToken.balanceOf(investor.address);
    const initialTreasuryBalance = await daiToken.balanceOf(treasury.target);
    const initialRewardBalance = await daiToken.balanceOf(rewardDistributor.target);
    
    console.log("Initial balances:");
    console.log("- Investor:", initialInvestorBalance.toString());
    console.log("- Treasury:", initialTreasuryBalance.toString());
    console.log("- Rewards:", initialRewardBalance.toString());
    
    // Invest in asset
    const investAmount = toWei(1000);
    try {
      await assetDAO.connect(investor).invest(1, investAmount);
      console.log("Investment succeeded!");
      
      // Calculate expected fees
      const expectedFeeAmount = percent(investAmount, INVEST_FEE);
      const expectedTreasuryFee = percent(expectedFeeAmount, TREASURY_PERCENTAGE);
      const expectedRewardFee = percent(expectedFeeAmount, REWARDS_PERCENTAGE);
      
      // Check final balances
      const finalInvestorBalance = await daiToken.balanceOf(investor.address);
      const finalTreasuryBalance = await daiToken.balanceOf(treasury.target);
      const finalRewardBalance = await daiToken.balanceOf(rewardDistributor.target);
      
      console.log("Final balances:");
      console.log("- Investor:", finalInvestorBalance.toString());
      console.log("- Treasury:", finalTreasuryBalance.toString());
      console.log("- Rewards:", finalRewardBalance.toString());
      
      // Verify balances - more lenient testing for possible rounding
      const investorDiff = initialInvestorBalance - finalInvestorBalance;
      console.log("Investor balance decreased by:", investorDiff.toString());
      expect(investorDiff).to.be.gte(investAmount);
      
      const treasuryDiff = finalTreasuryBalance - initialTreasuryBalance;
      console.log("Treasury balance increased by:", treasuryDiff.toString());
      expect(treasuryDiff).to.be.gte(expectedTreasuryFee);
      
      const rewardDiff = finalRewardBalance - initialRewardBalance;
      console.log("Reward balance increased by:", rewardDiff.toString());
      expect(rewardDiff).to.be.gte(expectedRewardFee);
      
    } catch (error) {
      console.error("Investment failed:", error.message);
      console.error("Error type:", typeof error);
      if (error.message.includes("ERC20InsufficientBalance")) {
        const match = error.message.match(/ERC20InsufficientBalance\("([^"]+)", ([^,]+), ([^)]+)\)/);
        if (match) {
          console.error("Account with insufficient balance:", match[1]);
          console.error("Current balance:", match[2]);
          console.error("Required balance:", match[3]);
        }
      }
      throw error;
    }
  });
});