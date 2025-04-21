/**
 * @title Simple Token Approval Test
 * @dev Basic test for token approval optimization with minimal dependencies
 */

// Include ethers v6 adapter for compatibility
require('../../../shims/ethers-v6-adapter');

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token Approval Simple Test", function() {
  let daiToken, tokenApprovalOptimizer;
  let owner, user;
  
  beforeEach(async function() {
    // Get signers
    [owner, user] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log("- Owner:", owner.address);
    console.log("- User:", user.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token deployed at:", daiToken.target);
    
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy();
    await tokenApprovalOptimizer.waitForDeployment();
    console.log("TokenApprovalOptimizer deployed at:", tokenApprovalOptimizer.target);
    
    // Mint tokens
    await daiToken.mint(tokenApprovalOptimizer.target, ethers.parseEther("1000"));
    console.log("Minted 1,000 DAI to TokenApprovalOptimizer");
  });
  
  it("should optimize approvals correctly", async function() {
    console.log("\nTesting optimized approval flow:");
    
    // First approval
    const tx1 = await tokenApprovalOptimizer.optimizedApprove(
      daiToken.target,
      user.address,
      ethers.parseEther("100")
    );
    const receipt1 = await tx1.wait();
    console.log(`Initial approval gas used: ${receipt1.gasUsed.toString()}`);
    
    // Check allowance
    const allowance1 = await daiToken.allowance(tokenApprovalOptimizer.target, user.address);
    console.log(`Allowance after initial approval: ${ethers.formatEther(allowance1)} DAI`);
    expect(allowance1).to.equal(ethers.parseEther("100"));
    
    // Redundant approval (same amount)
    const tx2 = await tokenApprovalOptimizer.optimizedApprove(
      daiToken.target,
      user.address,
      ethers.parseEther("100")
    );
    const receipt2 = await tx2.wait();
    console.log(`Redundant approval gas used: ${receipt2.gasUsed.toString()}`);
    
    // Check allowance (should be unchanged)
    const allowance2 = await daiToken.allowance(tokenApprovalOptimizer.target, user.address);
    console.log(`Allowance after redundant approval: ${ethers.formatEther(allowance2)} DAI`);
    expect(allowance2).to.equal(ethers.parseEther("100"));
    
    // Increased approval
    const tx3 = await tokenApprovalOptimizer.optimizedApprove(
      daiToken.target,
      user.address,
      ethers.parseEther("200")
    );
    const receipt3 = await tx3.wait();
    console.log(`Increased approval gas used: ${receipt3.gasUsed.toString()}`);
    
    // Check allowance (should be increased)
    const allowance3 = await daiToken.allowance(tokenApprovalOptimizer.target, user.address);
    console.log(`Allowance after increase: ${ethers.formatEther(allowance3)} DAI`);
    expect(allowance3).to.equal(ethers.parseEther("200"));
    
    // Verify gas savings on redundant approvals
    console.log("\nGas usage comparison:");
    console.log(`Initial approval: ${receipt1.gasUsed.toString()}`);
    console.log(`Redundant approval: ${receipt2.gasUsed.toString()}`);
    console.log(`Increased approval: ${receipt3.gasUsed.toString()}`);
    
    // The redundant approval should use less gas than the initial approval
    expect(Number(receipt2.gasUsed.toString())).to.be.lessThan(Number(receipt1.gasUsed.toString()));
    console.log("✓ Redundant approval uses less gas than initial approval");
  });
});