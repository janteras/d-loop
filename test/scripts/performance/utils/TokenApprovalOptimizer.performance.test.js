/**
 * @title TokenApprovalOptimizer Gas Usage Tests
 * @dev Gas profiling tests for the TokenApprovalOptimizer contract
 * @notice Follows D-Loop Protocol testing best practices
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");
const PerformanceHelper = require('../../helpers/PerformanceHelper');

describe("TokenApprovalOptimizer Gas Usage", function() {
  // Test accounts
  let owner, user1, user2, spender1, spender2;
  
  // Contract instances
  let mockToken;
  let tokenOptimizer;
  
  // Performance helper
  let performanceHelper;
  
  // Test parameters
  const APPROVAL_AMOUNT = ethers.parseEther("1000");
  
  before(async function() {
    // Initialize performance helper
    performanceHelper = new PerformanceHelper();
    
    // Get signers
    [owner, user1, user2, spender1, spender2] = await ethers.getSigners();
    
    console.log("Deploying contracts for TokenApprovalOptimizer gas tests...");
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();
    
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenOptimizer = await TokenApprovalOptimizer.deploy(20); // 20% threshold
    await tokenOptimizer.waitForDeployment();
    
    // Mint tokens to users for testing
    await mockToken.mint(user1.address, ethers.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.parseEther("10000"));
    
    // Approve optimizer to spend tokens
    await mockToken.connect(user1).approve(await tokenOptimizer.getAddress(), ethers.parseEther("10000"));
    await mockToken.connect(user2).approve(await tokenOptimizer.getAddress(), ethers.parseEther("10000"));
    
    console.log("Setup complete for TokenApprovalOptimizer gas tests");
  });
  
  describe("Single Token Operations", function() {
    it("should measure gas for direct token approval", async function() {
      const tx = await mockToken.connect(user1).approve(spender1.address, APPROVAL_AMOUNT);
      const receipt = await tx.wait();
      
      console.log(`Gas used for direct token approval: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.gt(0);
    });
    
    it("should measure gas for optimized token approval", async function() {
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user1).approve(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT);
      
      const tx = await tokenOptimizer.connect(user1).optimizeApproval(
        await mockToken.getAddress(),
        user1.address,
        spender1.address,
        APPROVAL_AMOUNT
      );
      const receipt = await tx.wait();
      
      console.log(`Gas used for optimized token approval: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.gt(0);
    });
    
    it("should measure gas for token transfer", async function() {
      const tx = await mockToken.connect(user1).transfer(user2.address, APPROVAL_AMOUNT);
      const receipt = await tx.wait();
      
      console.log(`Gas used for token transfer: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.gt(0);
    });
    
    it("should measure gas for optimized token transfer", async function() {
      // First transfer tokens to the optimizer contract
      await mockToken.connect(user1).transfer(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT);
      
      const tx = await tokenOptimizer.connect(user1).transferTokens(
        await mockToken.getAddress(),
        user2.address,
        APPROVAL_AMOUNT
      );
      const receipt = await tx.wait();
      
      console.log(`Gas used for optimized token transfer: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.gt(0);
    });
  });
  
  describe("Batch Token Operations", function() {
    it("should measure gas for sequential token approvals", async function() {
      // Create batch of spenders
      const spenders = [spender1.address, spender2.address];
      const amounts = [APPROVAL_AMOUNT, APPROVAL_AMOUNT];
      
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user2).approve(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT * BigInt(2));
      
      let totalGas = BigInt(0);
      
      // Perform approvals sequentially and measure gas
      for (let i = 0; i < spenders.length; i++) {
        const tx = await tokenOptimizer.connect(user2).optimizeApproval(
          await mockToken.getAddress(),
          user2.address,
          spenders[i],
          amounts[i]
        );
        const receipt = await tx.wait();
        totalGas += receipt.gasUsed;
      }
      
      const gasPerApproval = totalGas / BigInt(spenders.length);
      console.log(`Total gas used for sequential token approvals: ${totalGas.toString()}`);
      console.log(`Gas per approval in sequence: ${gasPerApproval.toString()}`);
      
      expect(totalGas).to.be.gt(0);
    });
    
    it("should measure gas for sequential token transfers", async function() {
      // First transfer tokens to the optimizer contract
      await mockToken.connect(user2).transfer(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT);
      
      // Create batch of recipients
      const recipients = [user1.address, owner.address];
      const amounts = [APPROVAL_AMOUNT / BigInt(2), APPROVAL_AMOUNT / BigInt(2)];
      
      let totalGas = BigInt(0);
      
      // Perform transfers sequentially and measure gas
      for (let i = 0; i < recipients.length; i++) {
        const tx = await tokenOptimizer.connect(user2).transferTokens(
          await mockToken.getAddress(),
          recipients[i],
          amounts[i]
        );
        const receipt = await tx.wait();
        totalGas += receipt.gasUsed;
      }
      
      const gasPerTransfer = totalGas / BigInt(recipients.length);
      console.log(`Total gas used for sequential token transfers: ${totalGas.toString()}`);
      console.log(`Gas per transfer in sequence: ${gasPerTransfer.toString()}`);
      
      expect(totalGas).to.be.gt(0);
    });
    
    it("should compare optimized vs standard approvals", async function() {
      // Measure gas for standard approval
      const standardTx = await mockToken.connect(user2).approve(spender1.address, APPROVAL_AMOUNT);
      const standardReceipt = await standardTx.wait();
      
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user2).approve(await tokenOptimizer.getAddress(), APPROVAL_AMOUNT);
      
      // Measure gas for optimized approval
      const optimizedTx = await tokenOptimizer.connect(user2).optimizeApproval(
        await mockToken.getAddress(),
        user2.address,
        spender1.address,
        APPROVAL_AMOUNT
      );
      const optimizedReceipt = await optimizedTx.wait();
      
      // Calculate efficiency ratio
      const standardGas = standardReceipt.gasUsed;
      const optimizedGas = optimizedReceipt.gasUsed;
      const efficiencyRatio = Number(standardGas) / Number(optimizedGas);
      
      console.log(`Standard approval gas: ${standardGas.toString()}`);
      console.log(`Optimized approval gas: ${optimizedGas.toString()}`);
      console.log(`Efficiency ratio: ${efficiencyRatio.toFixed(2)}x`);
      
      // Higher ratio means the optimized version is more efficient
      console.log(`The ${efficiencyRatio > 1 ? 'optimized' : 'standard'} version is more efficient`);
    });
  });
  
  after(async function() {
    // Generate gas usage report
    console.log("\nTokenApprovalOptimizer Gas Usage Summary:");
    console.log("==========================================");
    
    // Additional report information could be added here
  });
});
