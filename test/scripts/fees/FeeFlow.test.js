// Include the ethers v6 adapter for compatibility
require('../../shims/ethers-v6-adapter');

const { expect } = require("chai");

// Import ethers directly first
const ethersLib = require("ethers");
// Add compatibility utilities from ethers
const { keccak256, toUtf8Bytes } = ethersLib;
const parseEther = ethersLib.parseEther;
const parseUnits = ethersLib.parseUnits;

// Then import hardhat runtime 
const { ethers } = require("hardhat");

/**
 * Helper function to compute role hashes consistent with solidity keccak256
 */
function computeRoleHash(role) {
  return keccak256(toUtf8Bytes(role));
}

describe("Fee Flow Integration", function () {
  let assetDAO;
  let feeCalculator;
  let feeProcessor;
  let treasury;
  let daiToken;
  let dloopToken;
  let priceOracle;
  let owner;
  let admin;
  let investor;
  let rewardDistributor;

  // Constants
  // Access control roles
  const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
  const MINTER_ROLE = computeRoleHash("MINTER_ROLE");
  const BURNER_ROLE = computeRoleHash("BURNER_ROLE");
  const AUTHORIZED_CONTRACT_ROLE = computeRoleHash("AUTHORIZED_CONTRACT_ROLE");

  // Fee percentages in basis points
  const INVEST_FEE = 1000;      // 10%
  const DIVEST_FEE = 500;       // 5%
  const RAGEQUIT_FEE = 40;      // 0.4% (0.3% standard + 0.1% emergency)
  const TREASURY_PERCENTAGE = 7000;  // 70%
  const REWARDS_PERCENTAGE = 3000;   // 30%
  
  beforeEach(async function () {
    // Get provider and ensure all signers use it
    const provider = ethers.provider;
    // Make sure to connect signers with provider
    console.log("Provider:", provider);
    
    // Get signers
    [owner, admin, investor, treasuryRecipient, rewardRecipient] = await ethers.getSigners();
    
    // Print addresses for debugging
    console.log("Owner:", owner.address);
    console.log("Admin:", admin.address);
    console.log("Investor:", investor.address);
    console.log("Treasury Recipient:", treasuryRecipient.address);
    console.log("Reward Recipient:", rewardRecipient.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
    await daiToken.waitForDeployment();

    // Mint DAI to investor
    await daiToken.mint(investor.address, parseEther("100000000"));
    console.log("Minted DAI to investor:", parseEther("100000000").toString());
    
    // Deploy DLOOP token
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "DLOOP Governance Token",
      "DLOOP",
      parseEther("1000000"), // Initial supply
      18, // Decimals
      parseEther("10000000"), // Max supply
      admin.address // Admin address
    );
    await dloopToken.waitForDeployment();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, treasuryRecipient.address);
    await treasury.waitForDeployment();
    console.log("Treasury deployed at:", treasury.target);
    
    // Deploy a basic Treasury contract as a mock RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("Treasury");
    const rewardDistributorContract = await RewardDistributor.deploy(admin.address, rewardRecipient.address);
    await rewardDistributorContract.waitForDeployment();
    rewardDistributor = rewardDistributorContract.target;
    console.log("RewardDistributor deployed at:", rewardDistributor);
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    console.log("FeeCalculator deployment parameters:");
    console.log("- admin.address:", admin.address);
    console.log("- treasury.target:", treasury.target);
    console.log("- rewardDistributor:", rewardDistributor);
    console.log("- INVEST_FEE:", INVEST_FEE);
    console.log("- DIVEST_FEE:", DIVEST_FEE);
    console.log("- RAGEQUIT_FEE:", RAGEQUIT_FEE);
    
    feeCalculator = await FeeCalculator.deploy(
      admin.address,
      treasury.target,
      rewardDistributor,
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    await feeCalculator.waitForDeployment();
    console.log("FeeCalculator deployed at:", feeCalculator.target);
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    console.log("FeeProcessor deployment parameters:");
    console.log("- treasury.address:", treasury.target);
    console.log("- rewardDistributor:", rewardDistributor);
    console.log("- feeCalculator.address:", feeCalculator.target);
    console.log("- admin.address:", admin.address);
    console.log("- TREASURY_PERCENTAGE:", TREASURY_PERCENTAGE);
    console.log("- REWARDS_PERCENTAGE:", REWARDS_PERCENTAGE);
    
    feeProcessor = await FeeProcessor.deploy(
      treasury.target,
      rewardDistributor,
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
      priceOracle.target,
      feeProcessor.target
    );
    await assetDAO.waitForDeployment();
    console.log("AssetDAO deployed at:", assetDAO.target);
    
    // Set up permissions
    // Allow investor to approve DAI for AssetDAO
    await daiToken.connect(investor).approve(assetDAO.target, parseEther("100000000"));
    console.log("Approved AssetDAO to spend DAI from investor:", parseEther("100000000").toString());
    
    // Allow AssetDAO to call FeeProcessor (so it can collect fees)
    await feeProcessor.connect(owner).grantRole(AUTHORIZED_CONTRACT_ROLE, assetDAO.target);
    
    // Mint initial tokens to AssetDAO for operations
    await daiToken.connect(owner).mint(assetDAO.target, parseEther("100000000"));
    
    // Allow AssetDAO to approve tokens for the FeeProcessor
    await assetDAO.allowTokenTransfer(daiToken.target, feeProcessor.target, parseEther("100000000"));
    console.log("Set up allowances for fee transfers.");
  });
  
  describe("Investment Fee Flow", function () {
    it("should correctly process fees when investing", async function () {
      // Create an asset
      await assetDAO.connect(admin).createAsset("Test Asset", "Test asset for fee flow");
      
      // Initialize balances with proper provider
      const provider = ethers.provider;
      const initialInvestorBalance = await daiToken.connect(investor).balanceOf(investor.address);
      const initialTreasuryBalance = await daiToken.connect(investor).balanceOf(treasury.target);
      const initialRewardDistBalance = await daiToken.connect(investor).balanceOf(rewardDistributor);
      
      // Invest in the asset
      const investAmount = parseEther("1000");
      await assetDAO.connect(investor).invest(1, investAmount);
      
      // Calculate expected fees
      const expectedFeeAmount = (investAmount * BigInt(INVEST_FEE)) / 10000n;
      const expectedTreasuryFee = (expectedFeeAmount * BigInt(TREASURY_PERCENTAGE)) / 10000n;
      const expectedRewardFee = (expectedFeeAmount * BigInt(REWARDS_PERCENTAGE)) / 10000n;
      const expectedNetAmount = investAmount - expectedFeeAmount;
      
      // Verify investor balance decreased correctly
      expect(await daiToken.connect(investor).balanceOf(investor.address)).to.equal(initialInvestorBalance - investAmount);
      
      // Verify AssetDAO received the net amount
      expect(await daiToken.connect(investor).balanceOf(assetDAO.target)).to.equal(expectedNetAmount);
      
      // Verify treasury received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(treasury.target)).to.equal(initialTreasuryBalance + expectedTreasuryFee);
      
      // Verify reward distributor received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(rewardDistributor)).to.equal(initialRewardDistBalance + expectedRewardFee);
      
      // Verify asset data is updated correctly
      const asset = await assetDAO.getAssetDetails(1);
      expect(asset.totalInvestment).to.equal(expectedNetAmount);
      expect(asset.totalShares).to.equal(expectedNetAmount); // Since 1 token = 1 share
      
      // Verify investor shares
      const investorShares = await assetDAO.getInvestorShares(1, investor.address);
      expect(investorShares).to.equal(expectedNetAmount);
    });
  });
  
  describe("Divestment Fee Flow", function () {
    beforeEach(async function () {
      // Create an asset
      await assetDAO.connect(admin).createAsset("Test Asset", "Test asset for fee flow");
      
      // Invest in the asset
      const investAmount = parseEther("1000");
      await assetDAO.connect(investor).invest(1, investAmount);
    });
    
    it("should correctly process fees when divesting", async function () {
      // Get investor shares
      const investorShares = await assetDAO.getInvestorShares(1, investor.address);
      
      // Calculate divestment amount (in this simplified model, 1 share = 1 token)
      const divestShares = investorShares / 2n; // Divest half of shares
      const grossDivestAmount = divestShares; // Since 1 share = 1 token
      
      // Initialize balances with proper provider
      const provider = ethers.provider;
      const initialInvestorBalance = await daiToken.connect(investor).balanceOf(investor.address);
      const initialTreasuryBalance = await daiToken.connect(investor).balanceOf(treasury.target);
      const initialRewardDistBalance = await daiToken.connect(investor).balanceOf(rewardDistributor);
      const initialAssetBalance = await daiToken.connect(investor).balanceOf(assetDAO.target);
      
      // Divest from the asset
      await assetDAO.connect(investor).divest(1, divestShares);
      
      // Calculate expected fees
      const expectedFeeAmount = (grossDivestAmount * BigInt(DIVEST_FEE)) / 10000n;
      const expectedTreasuryFee = (expectedFeeAmount * BigInt(TREASURY_PERCENTAGE)) / 10000n;
      const expectedRewardFee = (expectedFeeAmount * BigInt(REWARDS_PERCENTAGE)) / 10000n;
      const expectedNetAmount = grossDivestAmount - expectedFeeAmount;
      
      // Verify investor balance increased correctly
      expect(await daiToken.connect(investor).balanceOf(investor.address)).to.equal(initialInvestorBalance + expectedNetAmount);
      
      // Verify AssetDAO balance decreased correctly
      expect(await daiToken.connect(investor).balanceOf(assetDAO.target)).to.equal(initialAssetBalance - grossDivestAmount);
      
      // Verify treasury received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(treasury.target)).to.equal(initialTreasuryBalance + expectedTreasuryFee);
      
      // Verify reward distributor received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(rewardDistributor)).to.equal(initialRewardDistBalance + expectedRewardFee);
      
      // Verify investor shares decreased correctly
      const newInvestorShares = await assetDAO.getInvestorShares(1, investor.address);
      expect(newInvestorShares).to.equal(investorShares - divestShares);
    });
  });
  
  describe("Ragequit Fee Flow", function () {
    beforeEach(async function () {
      // Create an asset
      await assetDAO.connect(admin).createAsset("Test Asset", "Test asset for fee flow");
      
      // Invest in the asset
      const investAmount = parseEther("1000");
      await assetDAO.connect(investor).invest(1, investAmount);
    });
    
    it("should correctly process fees when executing a ragequit", async function () {
      // Get investor shares
      const investorShares = await assetDAO.getInvestorShares(1, investor.address);
      
      // Calculate ragequit amount (in this simplified model, 1 share = 1 token)
      const ragequitShares = investorShares / 2n; // Ragequit half of shares
      const grossRagequitAmount = ragequitShares; // Since 1 share = 1 token
      
      // Initialize balances with proper provider
      const provider = ethers.provider;
      const initialInvestorBalance = await daiToken.connect(investor).balanceOf(investor.address);
      const initialTreasuryBalance = await daiToken.connect(investor).balanceOf(treasury.target);
      const initialRewardDistBalance = await daiToken.connect(investor).balanceOf(rewardDistributor);
      const initialAssetBalance = await daiToken.connect(investor).balanceOf(assetDAO.target);
      
      // Execute ragequit
      await assetDAO.connect(investor).rageQuit(1, ragequitShares);
      
      // Calculate expected fees
      const expectedFeeAmount = (grossRagequitAmount * BigInt(RAGEQUIT_FEE)) / 10000n;
      const expectedTreasuryFee = (expectedFeeAmount * BigInt(TREASURY_PERCENTAGE)) / 10000n;
      const expectedRewardFee = (expectedFeeAmount * BigInt(REWARDS_PERCENTAGE)) / 10000n;
      const expectedNetAmount = grossRagequitAmount - expectedFeeAmount;
      
      // Verify investor balance increased correctly
      expect(await daiToken.connect(investor).balanceOf(investor.address)).to.equal(initialInvestorBalance + expectedNetAmount);
      
      // Verify AssetDAO balance decreased correctly
      expect(await daiToken.connect(investor).balanceOf(assetDAO.target)).to.equal(initialAssetBalance - grossRagequitAmount);
      
      // Verify treasury received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(treasury.target)).to.equal(initialTreasuryBalance + expectedTreasuryFee);
      
      // Verify reward distributor received its portion of the fee
      expect(await daiToken.connect(investor).balanceOf(rewardDistributor)).to.equal(initialRewardDistBalance + expectedRewardFee);
      
      // Verify investor shares decreased correctly
      const newInvestorShares = await assetDAO.getInvestorShares(1, investor.address);
      expect(newInvestorShares).to.equal(investorShares - ragequitShares);
    });
  });
});