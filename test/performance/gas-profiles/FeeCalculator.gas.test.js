const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title FeeCalculator Gas Optimization Tests
 * @dev Tests to measure gas usage of optimized FeeCalculator contract functions
 */
describe("FeeCalculator Gas Optimization Tests", function () {
  // Test fixture to deploy contracts
  async function deployContractsFixture() {
    const [owner, feeAdmin, user1, user2] = await ethers.getSigners();

    // Deploy token for testing
    const Token = await ethers.getContractFactory("DLoopToken");
    const token = await Token.deploy(
      "D-Loop Governance Token",
      "DLOOP",
      ethers.parseEther("10000000"), // 10M initial supply
      18, // 18 decimals
      ethers.parseEther("100000000"), // 100M max supply
      owner.address // admin
    );

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy();

    // Deploy reward distributor mock
    const RewardDistributor = await ethers.getContractFactory("MockRewardDistributor");
    const rewardDistributor = await RewardDistributor.deploy();

    // Deploy approval optimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    const approvalOptimizer = await TokenApprovalOptimizer.deploy();

    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    const feeCalculator = await FeeCalculator.deploy(
      feeAdmin.address,
      treasury.address,
      rewardDistributor.address,
      1000, // 10% invest fee
      500,  // 5% divest fee
      40    // 0.4% ragequit fee
    );

    // Set approval optimizer
    await feeCalculator.setApprovalOptimizer(approvalOptimizer.address);

    // Mint tokens to test accounts
    const mintAmount = ethers.parseEther("1000000");
    await token.mint(owner.address, mintAmount);
    await token.mint(user1.address, mintAmount);
    await token.mint(user2.address, mintAmount);

    // Grant fee collector role to token
    await feeCalculator.grantFeeCollectorRole(token.address);

    return { 
      token, 
      feeCalculator, 
      treasury, 
      rewardDistributor, 
      approvalOptimizer, 
      owner, 
      feeAdmin, 
      user1, 
      user2 
    };
  }

  // Helper function to measure gas usage
  async function measureGasUsage(txPromise) {
    const tx = await txPromise;
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  describe("Gas Usage Tests", function () {
    it("Should optimize gas usage for processInvestFee", async function () {
      const { token, feeCalculator, user1 } = await loadFixture(deployContractsFixture);
      
      // Approve token for fee calculator
      const amount = ethers.parseEther("10000");
      await token.connect(user1).approve(feeCalculator.address, amount);
      
      // Measure gas usage for processInvestFee
      const gasUsed = await measureGasUsage(
        token.connect(user1).transferAndCall(
          feeCalculator.address, 
          amount, 
          feeCalculator.interface.encodeFunctionData("processInvestFee", [0, ethers.ZeroAddress, amount])
        )
      );
      
      console.log(`Gas used for processInvestFee: ${gasUsed.toString()}`);
      
      // We don't have a specific threshold, but we can log the gas usage for comparison
      expect(gasUsed).to.be.lt(300000, "Gas usage should be reasonable");
    });

    it("Should optimize gas usage for processDivestFee", async function () {
      const { token, feeCalculator, user1 } = await loadFixture(deployContractsFixture);
      
      // Approve token for fee calculator
      const amount = ethers.parseEther("10000");
      await token.connect(user1).approve(feeCalculator.address, amount);
      
      // Measure gas usage for processDivestFee
      const gasUsed = await measureGasUsage(
        token.connect(user1).transferAndCall(
          feeCalculator.address, 
          amount, 
          feeCalculator.interface.encodeFunctionData("processDivestFee", [0, ethers.ZeroAddress, amount])
        )
      );
      
      console.log(`Gas used for processDivestFee: ${gasUsed.toString()}`);
      
      expect(gasUsed).to.be.lt(300000, "Gas usage should be reasonable");
    });

    it("Should optimize gas usage for processRagequitFee", async function () {
      const { token, feeCalculator, user1 } = await loadFixture(deployContractsFixture);
      
      // Approve token for fee calculator
      const amount = ethers.parseEther("10000");
      await token.connect(user1).approve(feeCalculator.address, amount);
      
      // Measure gas usage for processRagequitFee
      const gasUsed = await measureGasUsage(
        token.connect(user1).transferAndCall(
          feeCalculator.address, 
          amount, 
          feeCalculator.interface.encodeFunctionData("processRagequitFee", [0, ethers.ZeroAddress, amount])
        )
      );
      
      console.log(`Gas used for processRagequitFee: ${gasUsed.toString()}`);
      
      expect(gasUsed).to.be.lt(300000, "Gas usage should be reasonable");
    });

    it("Should handle zero fee amounts efficiently", async function () {
      const { token, feeCalculator, user1 } = await loadFixture(deployContractsFixture);
      
      // Set fee percentage to zero
      await feeCalculator.requestParameterChange("investFeePercentage", 0);
      
      // Fast forward time to execute parameter change
      await ethers.provider.send("evm_increaseTime", [172800]); // 2 days
      await ethers.provider.send("evm_mine", []);
      
      // Execute the parameter change
      const operationId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["string", "uint256", "uint256"],
          ["investFeePercentage", 0, Math.floor(Date.now() / 1000) - 172800]
        )
      );
      await feeCalculator.executeParameterChange(operationId, "investFeePercentage");
      
      // Approve token for fee calculator
      const amount = ethers.parseEther("10000");
      await token.connect(user1).approve(feeCalculator.address, amount);
      
      // Measure gas usage for processInvestFee with zero fee
      const gasUsed = await measureGasUsage(
        token.connect(user1).transferAndCall(
          feeCalculator.address, 
          amount, 
          feeCalculator.interface.encodeFunctionData("processInvestFee", [0, ethers.ZeroAddress, amount])
        )
      );
      
      console.log(`Gas used for processInvestFee with zero fee: ${gasUsed.toString()}`);
      
      // Zero fee should use significantly less gas due to early return
      expect(gasUsed).to.be.lt(100000, "Gas usage for zero fee should be very low");
    });

    it("Should optimize gas usage with approval optimization", async function () {
      const { token, feeCalculator, user1 } = await loadFixture(deployContractsFixture);
      
      // Enable approval optimization
      await feeCalculator.setUseApprovalOptimization(true);
      
      // Approve token for fee calculator
      const amount = ethers.parseEther("10000");
      await token.connect(user1).approve(feeCalculator.address, amount);
      
      // Measure gas usage for processInvestFee with approval optimization
      const gasUsed = await measureGasUsage(
        token.connect(user1).transferAndCall(
          feeCalculator.address, 
          amount, 
          feeCalculator.interface.encodeFunctionData("processInvestFee", [0, ethers.ZeroAddress, amount])
        )
      );
      
      console.log(`Gas used for processInvestFee with approval optimization: ${gasUsed.toString()}`);
      
      // Compare with standard ERC20 transfers (already tested above)
      // We're just logging the difference here
    });
  });
});
