const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fee System Performance Benchmarks", function() {
  let feeCalculator;
  let feeProcessor;
  let treasury;
  let daiToken;
  let admin;
  let users;

  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  before(async function() {
    [admin, ...users] = await ethers.getSigners();
    
    // Deploy test token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await (await DAIToken.deploy()).waitForDeployment();

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    // Deploy ProtocolDAO first (mock)
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await (await ProtocolDAO.deploy(
      admin.address,
      admin.address, // treasury
      86400, // 1 day voting period
      86400, // 1 day execution delay
      10 // 10% quorum
    )).waitForDeployment();

    treasury = await (await ethers.getContractFactory("Treasury")).deploy(
      admin.address,
      await protocolDAO.getAddress()
    ).then(c => c.waitForDeployment());

    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await (await FeeCalculator.deploy(
      admin.address, // fee admin
      await treasury.getAddress(),
      admin.address, // reward distributor
      500, // 5% invest fee
      300, // 3% divest fee
      1000 // 10% ragequit fee
    )).waitForDeployment();

    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await (await FeeProcessor.deploy(
      await treasury.getAddress(),
      admin.address, // reward distributor
      await feeCalculator.getAddress(),
      admin.address, // fee admin
      7000, // 70% treasury percentage
      3000 // 30% reward distributor percentage
    )).waitForDeployment();

    // Setup initial token balances
    await (await daiToken.mint(users[0].address, ethers.parseEther("1000"))).wait();
    await (await daiToken.connect(users[0]).approve(await feeProcessor.getAddress(), ethers.MaxUint256)).wait();
  });

  describe("Fee Processing Performance", function() {
    it("should benchmark fee calculation and processing", async function() {
      const results = {
        calculation: [],
        processing: [],
        distribution: []
      };

      const NUM_ITERATIONS = 10;
      const AMOUNT = ethers.parseEther("100");
      
      console.log("\\nTesting fee calculation...");
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const startTime = process.hrtime.bigint();
        await feeCalculator.calculateInvestFee(AMOUNT);
        const endTime = process.hrtime.bigint();
        results.calculation.push(Number(endTime - startTime));
      }

      console.log("\\nTesting fee processing...");
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const tx = await feeProcessor.connect(users[0]).processInvestmentFee(
          await daiToken.getAddress(),
          AMOUNT
        );
        const gasUsed = await measureGas(tx);
        results.processing.push(Number(gasUsed));
      }

      console.log("\\nTesting fee distribution...");
      for (let i = 0; i < NUM_ITERATIONS; i++) {
        const tx = await treasury.connect(admin).distributeRewards(
          await daiToken.getAddress(),
          [users[1].address, users[2].address],
          [AMOUNT.div(2), AMOUNT.div(2)]
        );
        const gasUsed = await measureGas(tx);
        results.distribution.push(Number(gasUsed));
      }

      // Calculate and display metrics
      const avgCalcTime = results.calculation.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      const avgProcessGas = results.processing.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      const avgDistGas = results.distribution.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      
      console.log("\\nPerformance Metrics:");
      console.log("Average Calculation Time (nanoseconds):", avgCalcTime);
      console.log("Average Processing Gas:", avgProcessGas);
      console.log("Average Distribution Gas:", avgDistGas);
      console.log("Total Flow Gas Cost:", avgProcessGas + avgDistGas);
    });

    it("should benchmark batch fee processing", async function() {
      const results = {
        singleProcess: [],
        batchProcess: []
      };

      const BATCH_SIZE = 5;
      const AMOUNT = ethers.parseEther("10");
      const NUM_ITERATIONS = 5;

      console.log("\\nTesting individual fee processing...");
      for (let iter = 0; iter < NUM_ITERATIONS; iter++) {
        let totalGas = 0n;
        for (let i = 0; i < BATCH_SIZE; i++) {
          const tx = await feeProcessor.connect(users[0]).processFee(
            await daiToken.getAddress(),
            AMOUNT
          );
          const gasUsed = await measureGas(tx);
          totalGas += gasUsed;
        }
        results.singleProcess.push(Number(totalGas));
      }

      console.log("\\nTesting batch fee processing...");
      for (let iter = 0; iter < NUM_ITERATIONS; iter++) {
        const tokens = Array(BATCH_SIZE).fill(await daiToken.getAddress());
        const amounts = Array(BATCH_SIZE).fill(AMOUNT);
        
        const tx = await feeProcessor.connect(users[0]).processBatchFees(
          tokens,
          amounts
        );
        const gasUsed = await measureGas(tx);
        results.batchProcess.push(Number(gasUsed));
      }

      // Calculate and display metrics
      const avgSingle = results.singleProcess.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      const avgBatch = results.batchProcess.reduce((a, b) => a + b, 0) / NUM_ITERATIONS;
      
      console.log("\\nBatch Processing Metrics:");
      console.log(`Individual Processing Average Gas (${BATCH_SIZE} fees):`, avgSingle);
      console.log(`Batch Processing Average Gas (${BATCH_SIZE} fees):`, avgBatch);
      console.log("Gas Savings:", avgSingle - avgBatch);
      console.log("Improvement: ", ((avgSingle - avgBatch) / avgSingle * 100).toFixed(2) + "%");
    });
  });
});
