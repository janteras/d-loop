const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Gas Consumption Analysis Tests - Specific Focus
 * 
 * This file focuses on specific gas-intensive operations and provides
 * detailed gas consumption reports for critical contract functions.
 */
describe("Gas Consumption Detailed Analysis", function () {
  let owner, user1, user2, aiNode1, aiNode2;
  let dloopToken, assetDAOWithFees, feeCalculator, treasury;

  // Test values
  const oneToken = ethers.utils.parseEther("1");
  const standardAmount = ethers.utils.parseEther("10000");
  
  // Gas usage tracking
  const gasUsage = {
    assetDAO: {},
    fees: {},
    governance: {},
    bridge: {},
    identity: {}
  };
  
  // Function to log gas usage
  async function trackGas(tx, category, operation) {
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.toString();
    
    if (!gasUsage[category]) {
      gasUsage[category] = {};
    }
    
    gasUsage[category][operation] = gasUsed;
    console.log(`Gas used for ${category} - ${operation}: ${gasUsed}`);
    return receipt;
  }
  
  before(async function () {
    [owner, user1, user2, aiNode1, aiNode2] = await ethers.getSigners();
    
    // Deploy minimal contract set for gas analysis
    console.log("Deploying core contracts for detailed gas analysis...");
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("DLOOP", "DLOOP");
    await dloopToken.deployed();
    
    // Mint tokens to test accounts
    await dloopToken.mint(owner.address, standardAmount.mul(10));
    await dloopToken.mint(user1.address, standardAmount.mul(10));
    await dloopToken.mint(user2.address, standardAmount.mul(10));
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.deployed();
    
    // Initialize with default parameters
    await feeCalculator.initialize(owner.address);
    
    // Set fee percentages
    await feeCalculator.setFeePercentage(0, 1000); // 10% for investment
    await feeCalculator.setFeePercentage(1, 500);  // 5% for divestment
    await feeCalculator.setFeePercentage(2, 2000); // 20% for ragequit
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(dloopToken.address);
    await treasury.deployed();
    
    // Deploy AssetDAOWithFees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAOWithFees = await AssetDAOWithFees.deploy();
    await assetDAOWithFees.deployed();
    
    // Initialize AssetDAO
    await assetDAOWithFees.initialize(
      dloopToken.address,
      feeCalculator.address,
      treasury.address,
      owner.address, // Mock reward distributor
      owner.address  // Mock oracle
    );
    
    // Grant roles
    await treasury.grantRole(await treasury.FEE_MANAGER_ROLE(), assetDAOWithFees.address);
    
    // Approve tokens
    await dloopToken.connect(user1).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user2).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    
    console.log("Contract deployment completed for gas analysis");
  });
  
  describe("Fee Calculation Gas Analysis", function () {
    it("should track gas for fee calculation with varying amounts", async function () {
      // Small amount
      let tx = await feeCalculator.calculateFee(0, dloopToken.address, oneToken, user1.address);
      await trackGas(tx, "fees", "calculate_small_amount");
      
      // Medium amount
      tx = await feeCalculator.calculateFee(0, dloopToken.address, oneToken.mul(1000), user1.address);
      await trackGas(tx, "fees", "calculate_medium_amount");
      
      // Large amount
      tx = await feeCalculator.calculateFee(0, dloopToken.address, oneToken.mul(1000000), user1.address);
      await trackGas(tx, "fees", "calculate_large_amount");
      
      // Different fee types
      tx = await feeCalculator.calculateFee(1, dloopToken.address, standardAmount, user1.address); // Divest
      await trackGas(tx, "fees", "calculate_divest_fee");
      
      tx = await feeCalculator.calculateFee(2, dloopToken.address, standardAmount, user1.address); // Ragequit
      await trackGas(tx, "fees", "calculate_ragequit_fee");
    });
  });
  
  describe("Asset DAO Operations Gas Analysis", function () {
    const amounts = [
      { name: "tiny", value: oneToken.div(10) },         // 0.1 token
      { name: "small", value: oneToken },                // 1 token
      { name: "medium", value: oneToken.mul(100) },      // 100 tokens
      { name: "large", value: oneToken.mul(10000) },     // 10,000 tokens
      { name: "huge", value: oneToken.mul(1000000) }     // 1,000,000 tokens
    ];
    
    // Test investment with different amounts
    for (const amount of amounts) {
      it(`should measure gas for investment with ${amount.name} amount`, async function () {
        const tx = await assetDAOWithFees.connect(user1).invest(amount.value);
        await trackGas(tx, "assetDAO", `invest_${amount.name}`);
      });
    }
    
    // Test divestment with different amounts
    for (const amount of amounts.slice(0, 4)) { // Skip the largest amount for divestment tests
      it(`should measure gas for divestment with ${amount.name} amount`, async function () {
        const tx = await assetDAOWithFees.connect(user1).divest(amount.value);
        await trackGas(tx, "assetDAO", `divest_${amount.name}`);
      });
    }
    
    // Test ragequit with different amounts
    for (const amount of amounts.slice(0, 3)) { // Skip the larger amounts for ragequit tests
      it(`should measure gas for ragequit with ${amount.name} amount`, async function () {
        const tx = await assetDAOWithFees.connect(user1).rageQuit(amount.value);
        await trackGas(tx, "assetDAO", `ragequit_${amount.name}`);
      });
    }
  });
  
  describe("Fee Distribution Gas Analysis", function () {
    it("should measure gas for fee distribution", async function () {
      // Define two receivers for testing
      const receivers = [
        { address: user1.address, share: 3000 }, // 30%
        { address: user2.address, share: 7000 }  // 70%
      ];
      
      // Register fee distribution
      let tx = await treasury.setFeeDistribution(receivers);
      await trackGas(tx, "fees", "set_distribution");
      
      // Test distributing fees
      const feeAmount = oneToken.mul(100);
      await dloopToken.transfer(treasury.address, feeAmount);
      
      tx = await treasury.distributeFees();
      await trackGas(tx, "fees", "distribute_fees");
    });
  });
  
  describe("Gas Usage Report", function () {
    it("should generate comprehensive gas usage report", function () {
      console.log("\n----- DLOOP PROTOCOL GAS CONSUMPTION REPORT -----\n");
      
      for (const category in gasUsage) {
        console.log(`\n${category.toUpperCase()} OPERATIONS:`);
        console.log("-------------------------------------------------------");
        
        const operations = gasUsage[category];
        
        if (Object.keys(operations).length === 0) {
          console.log("No operations measured in this category");
          continue;
        }
        
        for (const operation in operations) {
          const gas = parseInt(operations[operation]);
          
          let status = "✅ EFFICIENT";
          
          if (gas > 300000) {
            status = "⚠️ HIGH GAS USAGE";
          } else if (gas > 150000) {
            status = "ℹ️ MODERATE GAS USAGE";
          }
          
          console.log(`${operation}: ${gas} gas - ${status}`);
        }
      }
      
      console.log("\n----- GAS OPTIMIZATION RECOMMENDATIONS -----\n");
      console.log("1. Fee Calculation: Consider using fixed-point math with bitwise operations");
      console.log("2. Asset Transfers: Batch operations when possible to amortize fixed costs");
      console.log("3. Storage: Use compact storage patterns and minimize storage operations");
      console.log("4. Data Structures: Use mappings over arrays for frequent lookups");
      console.log("5. Loops: Avoid unbounded loops in core functions");
      console.log("6. Events: Use events for historical data instead of storage when possible");
      console.log("7. Proxy Pattern: Optimize implementation contracts for gas efficiency");
      console.log("8. Interfaces: Use interfaces consistently to standardize function calls");
      
      console.log("\n----- END OF GAS CONSUMPTION REPORT -----\n");
    });
  });
});