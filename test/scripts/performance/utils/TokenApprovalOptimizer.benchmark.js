/**
 * @title TokenApprovalOptimizer Benchmark Tests
 * @dev Comprehensive performance benchmarks for the TokenApprovalOptimizer contract
 * @notice Follows D-Loop Protocol testing best practices
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");
const PerformanceHelper = require("../helpers/PerformanceHelper");

describe("TokenApprovalOptimizer Benchmarks", function() {
  // Test accounts
  let owner, user1, user2, user3, spender1, spender2;
  
  // Contract instances
  let mockToken;
  let standardOptimizer;
  let enhancedOptimizer;
  
  // Performance helper
  let performanceHelper;
  
  // Test parameters
  const APPROVAL_AMOUNT = ethers.parseEther("1000");
  const BATCH_SIZES = [1, 5, 10, 20, 50];
  const ITERATIONS = 5;
  
  before(async function() {
    this.timeout(60000); // Extend timeout for setup
    
    // Initialize performance helper
    performanceHelper = new PerformanceHelper();
    
    // Get signers
    [owner, user1, user2, user3, spender1, spender2] = await ethers.getSigners();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();
    
    // Deploy standard TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    standardOptimizer = await TokenApprovalOptimizer.deploy(20); // 20% threshold
    await standardOptimizer.waitForDeployment();
    
    // Mint tokens to users for testing
    await mockToken.mint(user1.address, ethers.parseEther("10000"));
    await mockToken.mint(user2.address, ethers.parseEther("10000"));
    await mockToken.mint(user3.address, ethers.parseEther("10000"));
    
    // Approve optimizer to spend tokens
    await mockToken.connect(user1).approve(await standardOptimizer.getAddress(), ethers.parseEther("10000"));
    await mockToken.connect(user2).approve(await standardOptimizer.getAddress(), ethers.parseEther("10000"));
    await mockToken.connect(user3).approve(await standardOptimizer.getAddress(), ethers.parseEther("10000"));
  });
  
  describe("Single Approval Operations", function() {
    it("should benchmark standard approval", async function() {
      const result = await performanceHelper.benchmarkFunction(
        "standard_approval",
        mockToken.connect(user1),
        "approve",
        [spender1.address, APPROVAL_AMOUNT],
        ITERATIONS
      );
      
      console.log(`Standard approval average gas: ${result.average.toString()}`);
      expect(result.average).to.be.gt(0);
    });
    
    it("should benchmark optimized approval", async function() {
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user1).approve(await standardOptimizer.getAddress(), APPROVAL_AMOUNT * BigInt(ITERATIONS));
      
      const result = await performanceHelper.benchmarkFunction(
        "optimized_approval",
        standardOptimizer.connect(user1),
        "optimizeApproval",
        [await mockToken.getAddress(), user1.address, spender1.address, APPROVAL_AMOUNT],
        ITERATIONS
      );
      
      console.log(`Optimized approval average gas: ${result.average.toString()}`);
      expect(result.average).to.be.gt(0);
    });
    
    it("should compare approval implementations", async function() {
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user2).approve(await standardOptimizer.getAddress(), APPROVAL_AMOUNT * BigInt(10));
      
      const results = await performanceHelper.compareOptimizations(
        "token_approval",
        {
          contract: mockToken.connect(user2),
          method: "approve",
          args: [spender2.address, APPROVAL_AMOUNT]
        },
        {
          optimized: {
            contract: standardOptimizer.connect(user2),
            method: "optimizeApproval",
            args: [await mockToken.getAddress(), user2.address, spender2.address, APPROVAL_AMOUNT]
          }
        }
      );
      
      console.log("Approval optimization comparison:", results);
      expect(results.optimized).to.have.property('efficiencyRatio');
    });
  });
  
  describe("Batch Operations", function() {
    it("should measure throughput for sequential approvals", async function() {
      // Create spender addresses for batch testing
      const spenders = [];
      for (let i = 0; i < 50; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        spenders.push(wallet.address);
      }
      
      // Implement a sequential approval method for testing
      const sequentialApprove = async (batchSize) => {
        const batch = spenders.slice(0, batchSize);
        let totalGas = BigInt(0);
        
        // First approve the token optimizer to spend tokens for all operations
        await mockToken.connect(user3).approve(
          await standardOptimizer.getAddress(), 
          APPROVAL_AMOUNT * BigInt(batch.length)
        );
        
        // Create a transaction that will execute multiple approvals
        const tx = await (async () => {
          // First transaction to get receipt object structure
          const firstTx = await standardOptimizer.connect(user3).optimizeApproval(
            await mockToken.getAddress(),
            user3.address,
            batch[0],
            APPROVAL_AMOUNT
          );
          const receipt = await firstTx.wait();
          totalGas += receipt.gasUsed;
          
          // Execute remaining approvals
          for (let i = 1; i < batch.length; i++) {
            const tx = await standardOptimizer.connect(user3).optimizeApproval(
              await mockToken.getAddress(),
              user3.address,
              batch[i],
              APPROVAL_AMOUNT
            );
            const receipt = await tx.wait();
            totalGas += receipt.gasUsed;
          }
          
          // Return the first transaction with modified gas data
          return {
            ...firstTx,
            wait: async () => ({
              ...receipt,
              gasUsed: totalGas
            })
          };
        })();
        
        return tx;
      };
      
      // Measure sequential throughput
      const throughputResults = await performanceHelper.measureBatchThroughput(
        "sequential_approvals",
        { sequentialApprove },
        "sequentialApprove",
        BATCH_SIZES
      );
      
      console.log("Sequential approval throughput:", throughputResults);
      expect(Object.keys(throughputResults).length).to.equal(BATCH_SIZES.length);
    });
    
    it("should compare optimized vs standard token operations", async function() {
      // Standard approval gas measurement
      const standardTx = await mockToken.connect(user3).approve(spender1.address, APPROVAL_AMOUNT);
      const standardReceipt = await standardTx.wait();
      const standardGas = standardReceipt.gasUsed;
      
      // First approve the token optimizer to spend tokens
      await mockToken.connect(user3).approve(await standardOptimizer.getAddress(), APPROVAL_AMOUNT);
      
      // Optimized approval gas measurement
      const optimizedTx = await standardOptimizer.connect(user3).optimizeApproval(
        await mockToken.getAddress(),
        user3.address,
        spender1.address,
        APPROVAL_AMOUNT
      );
      const optimizedReceipt = await optimizedTx.wait();
      const optimizedGas = optimizedReceipt.gasUsed;
      
      // Calculate efficiency ratio
      const efficiencyRatio = Number(standardGas) / Number(optimizedGas);
      
      console.log(`Standard approval gas: ${standardGas}`);
      console.log(`Optimized approval gas: ${optimizedGas}`);
      console.log(`Efficiency ratio: ${efficiencyRatio.toFixed(2)}x`);
      
      // Higher ratio means more efficient (uses less gas)
      expect(efficiencyRatio).to.be.greaterThan(0);
    });
  });
  
  after(async function() {
    // Generate comprehensive performance report
    performanceHelper.printReport("TokenApprovalOptimizer");
  });
});
