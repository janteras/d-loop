const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenOptimizer Performance Benchmarks", function() {
  let tokenOptimizer;
  let daiToken;
  let dloopToken;
  let admin;
  let users;

  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  before(async function() {
    [admin, ...users] = await ethers.getSigners();
    
    // Deploy test tokens
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await (await DAIToken.deploy()).waitForDeployment();
    
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await (await DLoopToken.deploy()).waitForDeployment();

    // Deploy TokenOptimizer
    const TokenOptimizer = await ethers.getContractFactory("TokenOptimizer");
    tokenOptimizer = await (await TokenOptimizer.deploy()).waitForDeployment();

    // Setup initial token balances
    await (await daiToken.mint(users[0].address, ethers.parseEther("1000"))).wait();
    await (await dloopToken.mint(users[0].address, ethers.parseEther("1000"))).wait();
  });

  describe("Token Approval Performance", function() {
    it("should benchmark approval patterns", async function() {
      const results = {
        standardApproval: [],
        optimizedApproval: []
      };

      const NUM_ITERATIONS = 10;
      const AMOUNT = ethers.parseEther("100");

      console.log("\\nTesting standard approval pattern...");
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        // Standard approval
        const tx1 = await daiToken.connect(users[0]).approve(tokenOptimizer.getAddress(), AMOUNT);
        const gasUsed1 = await measureGas(tx1);
        results.standardApproval.push(Number(gasUsed1));
      }

      console.log("\\nTesting optimized approval pattern...");
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        // Optimized approval through TokenOptimizer
        const tx2 = await tokenOptimizer.connect(users[0]).optimizedApprove(
          await daiToken.getAddress(),
          await dloopToken.getAddress(),
          AMOUNT
        );
        const gasUsed2 = await measureGas(tx2);
        results.optimizedApproval.push(Number(gasUsed2));
      }

      // Calculate and display metrics
      const avgStandard = results.standardApproval.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      const avgOptimized = results.optimizedApproval.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      
      console.log("\\nPerformance Metrics:");
      console.log("Standard Approval Average Gas:", avgStandard);
      console.log("Optimized Approval Average Gas:", avgOptimized);
      console.log("Gas Savings:", avgStandard - avgOptimized);
      console.log("Improvement: ", ((avgStandard - avgOptimized) / avgStandard * 100).toFixed(2) + "%");
    });
  });
});
