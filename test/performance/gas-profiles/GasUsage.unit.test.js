/**
 * @title Gas Usage Comparison for Token Approval Pattern
 * @dev Tests to measure and compare gas usage of token approval patterns
 */
const { ethers } = require("hardhat");
// Use the existing ethers-v6-shim
const ethersShim = require('../../utils/ethers-v6-compat');
const { expect } = require("chai");
const {
  toWei,
  deployMockToken,
  getTokenAllowance,
  calculateGasUsed
} = require("../../integration/BaseApprovalTest");

describe("Token Approval Pattern Gas Usage", function() {
  let owner, user1, spender;
  let mockToken, feeProcessor, treasury, governanceRewards;
  let standardApproveGas, optimizedApproveGas, batchApproveGas;

  before(async function() {
    // Get signers
    [owner, user1, spender] = await ethers.getSigners();
    
    // Deploy mock token for testing
    mockToken = await deployMockToken("Mock Token", "MOCK", 18, owner);
    
    // Deploy three more mock tokens for batch testing
    const mockToken2 = await deployMockToken("Mock Token 2", "MOCK2", 18, owner);
    const mockToken3 = await deployMockToken("Mock Token 3", "MOCK3", 18, owner);
    const mockToken4 = await deployMockToken("Mock Token 4", "MOCK4", 18, owner);
    
    // Deploy a mock fee calculator
    const MockFeeCalculator = await ethers.getContractFactory("MockFeeCalculator");
    const feeCalculator = await MockFeeCalculator.deploy();
    
    // Deploy the contracts with token approval pattern
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      owner.address, // treasury
      owner.address, // rewardDistributor
      feeCalculator.address,
      owner.address, // feeAdmin
      7000, // 70% treasury
      3000  // 30% reward distributor
    );
    
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(
      owner.address, // admin
      owner.address  // protocolDAO
    );
    
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      mockToken.address, // rewardToken
      owner.address      // admin
    );
    
    // Send tokens to the contracts for approvals
    await mockToken.transfer(feeProcessor.address, toWei(10000));
    await mockToken.transfer(treasury.address, toWei(10000));
    await mockToken.transfer(governanceRewards.address, toWei(10000));
    
    await mockToken2.transfer(feeProcessor.address, toWei(10000));
    await mockToken3.transfer(feeProcessor.address, toWei(10000));
    await mockToken4.transfer(feeProcessor.address, toWei(10000));
    
    // For batch comparison, record the gas used for three individual approvals
    let totalGasUsed = 0;
    
    // Do three individual approvals with FeeProcessor
    const tx1 = await feeProcessor.allowTokenTransfer(mockToken2.address, spender.address, toWei(100));
    const receipt1 = await tx1.wait();
    totalGasUsed += calculateGasUsed(receipt1);
    
    const tx2 = await feeProcessor.allowTokenTransfer(mockToken3.address, spender.address, toWei(200));
    const receipt2 = await tx2.wait();
    totalGasUsed += calculateGasUsed(receipt2);
    
    const tx3 = await feeProcessor.allowTokenTransfer(mockToken4.address, spender.address, toWei(300));
    const receipt3 = await tx3.wait();
    totalGasUsed += calculateGasUsed(receipt3);
    
    // Store the total gas used for three individual approvals
    standardApproveGas = totalGasUsed;
  });
  
  describe("Standard vs. Optimized Approval", function() {
    it("should measure gas for first-time approval", async function() {
      // Use FeeProcessor for the test
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Record gas used for first approval
      const gasUsed = calculateGasUsed(receipt);
      console.log(`Gas used for first-time approval: ${gasUsed}`);
      
      // Store for comparison
      optimizedApproveGas = gasUsed;
    });
    
    it("should measure gas savings for redundant approval", async function() {
      // Use FeeProcessor for the test - redundant approval with same value
      const tx = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(1000));
      const receipt = await tx.wait();
      
      // Record gas used for redundant approval
      const gasUsed = calculateGasUsed(receipt);
      console.log(`Gas used for redundant approval: ${gasUsed}`);
      
      // Calculate gas savings
      const gasSavings = optimizedApproveGas - gasUsed;
      const savingsPercentage = (gasSavings * 100n) / optimizedApproveGas;
      
      console.log(`Gas savings: ${gasSavings} (${savingsPercentage}%)`);
      
      // Verify savings meet target (at least 45%)
      expect(savingsPercentage).to.be.gte(45n);
    });
  });
  
  describe("Batch vs. Individual Approvals", function() {
    it("should measure gas for batch approval", async function() {
      // Use FeeProcessor for batch approval test
      const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
      const amounts = [toWei(100), toWei(200), toWei(300)];
      
      // Execute batch approval
      const tx = await feeProcessor.batchAllowTokenTransfers(tokens, user1.address, amounts);
      const receipt = await tx.wait();
      
      // Record gas used for batch approval
      const gasUsed = calculateGasUsed(receipt);
      console.log(`Gas used for batch approval of 3 tokens: ${gasUsed}`);
      
      // Store for comparison
      batchApproveGas = gasUsed;
      
      // Calculate gas savings vs. individual approvals
      const gasSavings = standardApproveGas - batchApproveGas;
      const savingsPercentage = (gasSavings * 100n) / standardApproveGas;
      
      console.log(`Batch approval gas savings vs. individual: ${gasSavings} (${savingsPercentage}%)`);
      
      // Verify savings meet target (at least 35%)
      expect(savingsPercentage).to.be.gte(35n);
    });
  });
  
  describe("Contract Comparison", function() {
    it("should compare optimized approval across all contracts", async function() {
      // Test with all three implementations
      
      // FeeProcessor
      const tx1 = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Treasury
      const tx2 = await treasury.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // GovernanceRewards
      const tx3 = await governanceRewards.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt3 = await tx3.wait();
      const gasUsed3 = calculateGasUsed(receipt3);
      
      // Log results
      console.log(`FeeProcessor approval gas: ${gasUsed1}`);
      console.log(`Treasury approval gas: ${gasUsed2}`);
      console.log(`GovernanceRewards approval gas: ${gasUsed3}`);
      
      // Verify they are within reasonable range of each other (max 10% difference)
      const maxGas = Math.max(Number(gasUsed1), Number(gasUsed2), Number(gasUsed3));
      const minGas = Math.min(Number(gasUsed1), Number(gasUsed2), Number(gasUsed3));
      const difference = ((maxGas - minGas) * 100) / maxGas;
      
      console.log(`Max difference between implementations: ${difference.toFixed(2)}%`);
      expect(difference).to.be.lt(10);
      
      // Repeat the calls to check optimized paths
      
      // FeeProcessor (redundant)
      const tx4 = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt4 = await tx4.wait();
      const gasUsed4 = calculateGasUsed(receipt4);
      
      // Treasury (redundant)
      const tx5 = await treasury.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt5 = await tx5.wait();
      const gasUsed5 = calculateGasUsed(receipt5);
      
      // GovernanceRewards (redundant)
      const tx6 = await governanceRewards.allowTokenTransfer(mockToken.address, spender.address, toWei(500));
      const receipt6 = await tx6.wait();
      const gasUsed6 = calculateGasUsed(receipt6);
      
      // Log optimization results
      console.log(`FeeProcessor optimized approval gas: ${gasUsed4} (${((gasUsed1 - gasUsed4) * 100n) / gasUsed1}% savings)`);
      console.log(`Treasury optimized approval gas: ${gasUsed5} (${((gasUsed2 - gasUsed5) * 100n) / gasUsed2}% savings)`);
      console.log(`GovernanceRewards optimized approval gas: ${gasUsed6} (${((gasUsed3 - gasUsed6) * 100n) / gasUsed3}% savings)`);
      
      // All should show significant savings (>40%)
      expect(Number((gasUsed1 - gasUsed4) * 100n / gasUsed1)).to.be.gt(40);
      expect(Number((gasUsed2 - gasUsed5) * 100n / gasUsed2)).to.be.gt(40);
      expect(Number((gasUsed3 - gasUsed6) * 100n / gasUsed3)).to.be.gt(40);
    });
  });
  
  describe("Real-world Scenarios", function() {
    it("should optimize gas for approval value changes", async function() {
      // Initial approval
      await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      
      // First change (this will require a new approval)
      const tx1 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(2000));
      const receipt1 = await tx1.wait();
      const gasUsed1 = calculateGasUsed(receipt1);
      
      // Second identical approval (this should be optimized)
      const tx2 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(2000));
      const receipt2 = await tx2.wait();
      const gasUsed2 = calculateGasUsed(receipt2);
      
      // Calculate savings
      const gasSavings = gasUsed1 - gasUsed2;
      const savingsPercentage = (gasSavings * 100n) / gasUsed1;
      
      console.log(`Gas savings after value change: ${gasSavings} (${savingsPercentage}%)`);
      
      // Verify significant savings
      expect(savingsPercentage).to.be.gt(40n);
    });
    
    it("should optimize gas across different spenders", async function() {
      // Test with multiple spenders
      
      // First spender approval
      const tx1 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei(100));
      await tx1.wait();
      
      // Second spender first approval
      const tx2 = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(100));
      const receipt2 = await tx2.wait();
      const gasUsed1 = calculateGasUsed(receipt2);
      
      // Second spender redundant approval
      const tx3 = await feeProcessor.allowTokenTransfer(mockToken.address, spender.address, toWei(100));
      const receipt3 = await tx3.wait();
      const gasUsed2 = calculateGasUsed(receipt3);
      
      // Calculate savings
      const gasSavings = gasUsed1 - gasUsed2;
      const savingsPercentage = (gasSavings * 100n) / gasUsed1;
      
      console.log(`Gas savings with different spenders: ${gasSavings} (${savingsPercentage}%)`);
      
      // Verify significant savings
      expect(savingsPercentage).to.be.gt(40n);
    });
  });
});