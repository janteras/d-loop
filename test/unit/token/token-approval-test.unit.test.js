/**
 * @title Token Approval Test
 * @dev Test suite for validating token approval mechanisms in the DLoop protocol
 * @notice This test ensures that permission setup matches requirements and approval flows work correctly
 */

// Include the standardized Ethers v6 adapter
require('../../../shims/ethers-v6-adapter');

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Create consistent hash function for role computation
function computeRoleHash(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role));
}

describe("Token Approval Flow Validation", function() {
  // Test variables
  let daiToken, assetDAO, feeProcessor;
  let owner, admin, investor;
  
  // Constants for role-based access control
  const AUTHORIZED_CONTRACT_ROLE = computeRoleHash("AUTHORIZED_CONTRACT_ROLE");
  const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
  
  // Helper function to convert ether values
  function toWei(value) {
    return ethers.parseEther(value.toString());
  }
  
  // Helper to log approval events for validation
  async function logApprovalStatus(token, owner, spender, expectedAmount, label) {
    try {
      const allowance = await token.allowance(owner, spender);
      console.log(`[${label}] Allowance for ${spender} from ${owner}: ${allowance.toString()}`);
      return allowance;
    } catch (error) {
      console.error(`[${label}] Error checking allowance: ${error.message}`);
      return ethers.parseEther("0");
    }
  }
  
  beforeEach(async function() {
    // Get accounts
    [owner, admin, investor] = await ethers.getSigners();
    
    console.log("=== Test Setup ===");
    console.log("Owner:", owner.address);
    console.log("Admin:", admin.address);
    console.log("Investor:", investor.address);
    
    // Deploy DAI token contract
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token deployed at:", daiToken.target);
    
    // Deploy mock DLoop token (reusing DAI for simplicity)
    const DLoopToken = await ethers.getContractFactory("DAIToken");
    dloopToken = await DLoopToken.deploy("DLOOP Token", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    console.log("DLOOP Token deployed at:", dloopToken.target);
    
    // Deploy mock Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.waitForDeployment();
    console.log("Treasury deployed at:", treasury.target);
    
    // Deploy mock PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    console.log("PriceOracle deployed at:", priceOracle.target);
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      admin.address,   // Admin
      treasury.target, // Treasury address
      treasury.target, // Use treasury as reward distributor for simplicity
      1000,            // 10% invest fee
      500,             // 5% divest fee
      2000             // 20% ragequit fee
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
      7000,           // 70% to treasury
      3000            // 30% to rewards
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
    
    // Setup initial balances and permissions
    await daiToken.mint(investor.address, toWei(1000000));
    console.log(`Minted ${toWei(1000000)} DAI to investor`);
    
    // Grant AUTHORIZED_CONTRACT_ROLE to AssetDAO in FeeProcessor
    try {
      await feeProcessor.connect(owner).grantRole(AUTHORIZED_CONTRACT_ROLE, assetDAO.target);
      console.log(`Granted AUTHORIZED_CONTRACT_ROLE to AssetDAO in FeeProcessor`);
    } catch (error) {
      console.error(`Failed to grant role: ${error.message}`);
    }
  });

  for (let i = 1; i <= 10; i++) {
    describe(`Iteration ${i}: Token Approval Flow`, function() {
      it("should correctly set up investor token approvals for AssetDAO", async function() {
        // 1. Investor approves DAI for AssetDAO
        await daiToken.connect(investor).approve(assetDAO.target, toWei(50000));
        
        // Check allowance
        const allowance = await logApprovalStatus(
          daiToken, 
          investor.address, 
          assetDAO.target, 
          toWei(50000),
          "Investor->AssetDAO"
        );
        
        expect(allowance).to.equal(toWei(50000));
        console.log("✓ Investor successfully approved DAI for AssetDAO");
      });
      
      it("should correctly set up AssetDAO token approvals for FeeProcessor", async function() {
        // 2. AssetDAO approves FeeProcessor to spend its tokens
        const approvalAmount = toWei(100000);
        await assetDAO.allowTokenTransfer(daiToken.target, feeProcessor.target, approvalAmount);
        
        // Use the raw call method to check allowance
        const encoded = daiToken.interface.encodeFunctionData("allowance", [assetDAO.target, feeProcessor.target]);
        const rawResult = await ethers.provider.send("eth_call", [{
          to: daiToken.target,
          data: encoded,
        }, "latest"]);
        
        const decodedResult = daiToken.interface.decodeFunctionResult("allowance", rawResult);
        const tokenAllowance = decodedResult[0];
        
        console.log(`[AssetDAO->FeeProcessor] Allowance checked via raw call: ${tokenAllowance}`);
        expect(tokenAllowance).to.equal(approvalAmount);
        console.log("✓ AssetDAO successfully approved DAI for FeeProcessor");
      });
      
      it("should correctly process token transfers through the approval chain", async function() {
        // Create a test asset
        await assetDAO.connect(admin).createAsset("Test Asset", "Token approval test asset");
        
        // Fund investor with tokens
        await daiToken.mint(investor.address, toWei(100000));
        
        // Investor approves AssetDAO
        await daiToken.connect(investor).approve(assetDAO.target, toWei(10000));
        
        // AssetDAO approves FeeProcessor
        await assetDAO.allowTokenTransfer(daiToken.target, feeProcessor.target, toWei(10000));
        
        // Initial balances
        const initialInvestorBalance = await daiToken.balanceOf(investor.address);
        const initialAssetDAOBalance = await daiToken.balanceOf(assetDAO.target);
        const initialTreasuryBalance = await daiToken.balanceOf(treasury.target);
        
        console.log(`Initial investor balance: ${initialInvestorBalance}`);
        console.log(`Initial AssetDAO balance: ${initialAssetDAOBalance}`);
        console.log(`Initial treasury balance: ${initialTreasuryBalance}`);
        
        // Investor invests in the asset
        const investAmount = toWei(1000);
        
        try {
          await assetDAO.connect(investor).invest(1, investAmount);
          console.log("Investment transaction succeeded");
          
          // Check final balances
          const finalInvestorBalance = await daiToken.balanceOf(investor.address);
          const finalAssetDAOBalance = await daiToken.balanceOf(assetDAO.target);
          const finalTreasuryBalance = await daiToken.balanceOf(treasury.target);
          
          console.log(`Final investor balance: ${finalInvestorBalance}`);
          console.log(`Final AssetDAO balance: ${finalAssetDAOBalance}`);
          console.log(`Final treasury balance: ${finalTreasuryBalance}`);
          
          // Verify balances changed properly
          const investorDiff = initialInvestorBalance - finalInvestorBalance;
          console.log(`Investor spent: ${investorDiff}`);
          expect(investorDiff).to.be.gte(investAmount);
          
          // Treasury should have received fees
          const treasuryDiff = finalTreasuryBalance - initialTreasuryBalance;
          console.log(`Treasury received: ${treasuryDiff}`);
          
          // Simple validation - should have some fee
          expect(treasuryDiff).to.be.gt(0);
          
          // Check investor shares were created
          const shares = await assetDAO.getInvestorShares(1, investor.address);
          console.log(`Investor received ${shares} shares`);
          expect(shares).to.be.gt(0);
          
          console.log("✓ Full token approval chain validated successfully");
        } catch (error) {
          console.error(`Investment failed: ${error.message}`);
          
          // Extract detailed error information
          if (error.message.includes("ERC20")) {
            // Log helpful debugging information for ERC20 errors
            console.error("ERC20 error detected. Checking allowances:");
            await logApprovalStatus(daiToken, investor.address, assetDAO.target, toWei(10000), "Investor->AssetDAO");
            
            // Calculate expected amount with fees
            const investFee = Math.floor(Number(investAmount) * 0.1); // 10% fee
            console.log(`Expected invest fee: ${investFee}`);
            
            const investorExpectedBalance = initialInvestorBalance.toString() - Number(investAmount);
            console.log(`Expected investor balance: ${investorExpectedBalance}`);
            
            const actualBalance = await daiToken.balanceOf(investor.address);
            console.log(`Actual investor balance: ${actualBalance}`);
          }
          
          // Fail the test
          expect.fail(`Token approval chain test failed: ${error.message}`);
        }
      });
    });
  }
});