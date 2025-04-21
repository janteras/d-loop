/**
 * @title Approval Optimization Test
 * @dev Tests for token approval optimization gas savings
 * @notice This test compares gas usage between standard and optimized token approvals
 */

// Include ethers v6 adapter for compatibility
require('../../../shims/ethers-v6-adapter');

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Create consistent hash function for role computation
function computeRoleHash(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role));
}

describe("Token Approval Optimization", function() {
  let daiToken, assetDAO, assetDAOOptimized;
  let owner, admin, user1, user2;
  
  // Constants
  const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
  
  beforeEach(async function() {
    // Get signers
    [owner, admin, user1, user2] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log("- Owner:", owner.address);
    console.log("- Admin:", admin.address);
    console.log("- User1:", user1.address);
    console.log("- User2:", user2.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token deployed at:", daiToken.target);
    
    // Deploy DLOOP token (use DAIToken for simplicity)
    const dloopToken = await DAIToken.deploy("DLOOP Token", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    console.log("DLOOP Token deployed at:", dloopToken.target);
    
    // Deploy Treasury (for use as oracle and fee processor)
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.waitForDeployment();
    console.log("Treasury deployed at:", treasury.target);
    
    // Deploy standard AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      daiToken.target,
      dloopToken.target,
      treasury.target,
      treasury.target
    );
    await assetDAO.waitForDeployment();
    console.log("Standard AssetDAO deployed at:", assetDAO.target);
    
    // Deploy optimized AssetDAO
    const AssetDAOOptimized = await ethers.getContractFactory("AssetDAOOptimized");
    assetDAOOptimized = await AssetDAOOptimized.deploy(
      daiToken.target,
      dloopToken.target,
      treasury.target,
      treasury.target
    );
    await assetDAOOptimized.waitForDeployment();
    console.log("Optimized AssetDAO deployed at:", assetDAOOptimized.target);
    
    // Grant admin role to admin
    await assetDAO.grantRole(ADMIN_ROLE, admin.address);
    await assetDAOOptimized.grantRole(ADMIN_ROLE, admin.address);
    console.log("Granted ADMIN_ROLE to admin on both contracts");
    
    // Mint tokens to contracts for testing approvals
    await daiToken.mint(assetDAO.target, ethers.parseEther("1000000"));
    await daiToken.mint(assetDAOOptimized.target, ethers.parseEther("1000000"));
    console.log("Minted 1,000,000 DAI to both contracts");
  });
  
  it("should use less gas for redundant approvals", async function() {
    console.log("\nTesting gas usage for approval functions:");
    
    // Amount to approve
    const approvalAmount = ethers.parseEther("50000");
    
    // First approval on standard AssetDAO
    console.log("\n1. First approval (standard AssetDAO):");
    const tx1 = await assetDAO.connect(admin).allowTokenTransfer(
      daiToken.target,
      user1.address,
      approvalAmount
    );
    const receipt1 = await tx1.wait();
    const gasUsed1 = receipt1.gasUsed;
    console.log(`Gas used: ${gasUsed1.toString()}`);
    
    // First approval on optimized AssetDAO
    console.log("\n2. First approval (optimized AssetDAO):");
    const tx2 = await assetDAOOptimized.connect(admin).allowTokenTransfer(
      daiToken.target,
      user1.address,
      approvalAmount
    );
    const receipt2 = await tx2.wait();
    const gasUsed2 = receipt2.gasUsed;
    console.log(`Gas used: ${gasUsed2.toString()}`);
    
    // Second redundant approval on standard AssetDAO (same amount)
    console.log("\n3. Redundant approval - same amount (standard AssetDAO):");
    const tx3 = await assetDAO.connect(admin).allowTokenTransfer(
      daiToken.target,
      user1.address,
      approvalAmount
    );
    const receipt3 = await tx3.wait();
    const gasUsed3 = receipt3.gasUsed;
    console.log(`Gas used: ${gasUsed3.toString()}`);
    
    // Second redundant approval on optimized AssetDAO (same amount)
    console.log("\n4. Redundant approval - same amount (optimized AssetDAO):");
    const tx4 = await assetDAOOptimized.connect(admin).allowTokenTransfer(
      daiToken.target,
      user1.address,
      approvalAmount
    );
    const receipt4 = await tx4.wait();
    const gasUsed4 = receipt4.gasUsed;
    console.log(`Gas used: ${gasUsed4.toString()}`);
    
    // Verify allowance is set correctly in both contracts
    const allowance1 = await daiToken.allowance(assetDAO.target, user1.address);
    const allowance2 = await daiToken.allowance(assetDAOOptimized.target, user1.address);
    
    console.log("\nAllowance verification:");
    console.log(`Standard AssetDAO allowance: ${ethers.formatEther(allowance1)} DAI`);
    console.log(`Optimized AssetDAO allowance: ${ethers.formatEther(allowance2)} DAI`);
    
    // Make sure both allowances are correct
    expect(allowance1).to.equal(approvalAmount);
    expect(allowance2).to.equal(approvalAmount);
    console.log("✓ Both contracts set the correct allowance amount");
    
    // Verify gas savings on redundant approvals
    console.log("\nGas usage comparison:");
    console.log(`Standard initial approval: ${gasUsed1.toString()}`);
    console.log(`Optimized initial approval: ${gasUsed2.toString()}`);
    console.log(`Standard redundant approval: ${gasUsed3.toString()}`);
    console.log(`Optimized redundant approval: ${gasUsed4.toString()}`);
    
    // Calculate savings
    const standardRedundantGas = Number(gasUsed3.toString());
    const optimizedRedundantGas = Number(gasUsed4.toString());
    const redundantGasSavings = standardRedundantGas - optimizedRedundantGas;
    const savingsPercentage = (redundantGasSavings / standardRedundantGas) * 100;
    
    console.log(`\nGas savings on redundant approval: ${redundantGasSavings} (${savingsPercentage.toFixed(2)}%)`);
    
    // The optimized version should use less gas for redundant approvals
    expect(optimizedRedundantGas).to.be.lessThan(standardRedundantGas);
    console.log("✓ Optimized contract uses less gas for redundant approvals");
  });
  
  it("should efficiently handle batch approvals", async function() {
    console.log("\nTesting batch approval functionality:");
    
    // First, deploy more test tokens
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const token1 = await DAIToken.deploy("Test Token 1", "TT1", 18);
    const token2 = await DAIToken.deploy("Test Token 2", "TT2", 18);
    const token3 = await DAIToken.deploy("Test Token 3", "TT3", 18);
    
    await token1.waitForDeployment();
    await token2.waitForDeployment();
    await token3.waitForDeployment();
    
    console.log("Deployed multiple test tokens for batch approval");
    
    // Mint tokens to optimized asset DAO
    await token1.mint(assetDAOOptimized.target, ethers.parseEther("1000000"));
    await token2.mint(assetDAOOptimized.target, ethers.parseEther("1000000"));
    await token3.mint(assetDAOOptimized.target, ethers.parseEther("1000000"));
    
    // Test batch approval
    const tokens = [token1.target, token2.target, token3.target];
    const amounts = [
      ethers.parseEther("10000"),
      ethers.parseEther("20000"),
      ethers.parseEther("30000")
    ];
    
    console.log("\nExecuting batch approval for 3 tokens:");
    const tx = await assetDAOOptimized.connect(admin).batchAllowTokenTransfers(
      tokens,
      user2.address,
      amounts
    );
    const receipt = await tx.wait();
    
    console.log(`Batch approval gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify all allowances are set correctly
    const allowance1 = await token1.allowance(assetDAOOptimized.target, user2.address);
    const allowance2 = await token2.allowance(assetDAOOptimized.target, user2.address);
    const allowance3 = await token3.allowance(assetDAOOptimized.target, user2.address);
    
    console.log("\nAllowance verification:");
    console.log(`Token 1 allowance: ${ethers.formatEther(allowance1)}`);
    console.log(`Token 2 allowance: ${ethers.formatEther(allowance2)}`);
    console.log(`Token 3 allowance: ${ethers.formatEther(allowance3)}`);
    
    // Verify all allowances are set correctly
    expect(allowance1).to.equal(amounts[0]);
    expect(allowance2).to.equal(amounts[1]);
    expect(allowance3).to.equal(amounts[2]);
    console.log("✓ Batch approval successfully set all allowances");
    
    // Compare to individual approvals
    let totalIndividualGas = 0;
    
    console.log("\nComparing to individual approvals:");
    
    for (let i = 0; i < tokens.length; i++) {
      const tx = await assetDAO.connect(admin).allowTokenTransfer(
        tokens[i],
        user2.address,
        amounts[i]
      );
      const receipt = await tx.wait();
      console.log(`Individual approval ${i+1} gas used: ${receipt.gasUsed.toString()}`);
      totalIndividualGas += Number(receipt.gasUsed.toString());
    }
    
    const batchGas = Number(receipt.gasUsed.toString());
    const gasSavings = totalIndividualGas - batchGas;
    const savingsPercentage = (gasSavings / totalIndividualGas) * 100;
    
    console.log(`\nTotal gas for individual approvals: ${totalIndividualGas}`);
    console.log(`Gas for batch approval: ${batchGas}`);
    console.log(`Gas savings with batch approval: ${gasSavings} (${savingsPercentage.toFixed(2)}%)`);
    
    // Batch should use less gas than individual approvals
    expect(batchGas).to.be.lessThan(totalIndividualGas);
    console.log("✓ Batch approval is more gas efficient than individual approvals");
  });
});