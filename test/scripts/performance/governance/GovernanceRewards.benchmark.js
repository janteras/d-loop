const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title GovernanceRewards Performance Benchmark
 * @dev Measures gas consumption and throughput for GovernanceRewards operations
 */
describe("GovernanceRewards Performance Benchmarks", function() {
  // Test parameters
  const NUM_USERS = 50;
  const NUM_REWARDS = 10;
  const REWARD_AMOUNT = ethers.parseEther("1.0");
  
  // Contract instances
  let governanceRewards;
  let mockToken;
  
  // Test accounts
  let admin, distributor, treasury;
  let users = [];
  
  // Performance metrics
  let metrics = {
    deployment: 0,
    singleReward: [],
    batchRewards: [],
    claimSingle: [],
    claimMultiple: []
  };

  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  before(async function() {
    this.timeout(60000); // Extend timeout for setup
    
    // Get signers
    [admin, distributor, treasury, ...users] = await ethers.getSigners();
    if (users.length < NUM_USERS) {
      throw new Error(`Not enough signers for test. Have ${users.length}, need ${NUM_USERS}`);
    }
    users = users.slice(0, NUM_USERS);
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Governance Token", "GOV");
    await mockToken.waitForDeployment();
    
    // Deploy GovernanceRewards
    console.log("Deploying GovernanceRewards contract...");
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const deployTx = await GovernanceRewards.deploy(
      await mockToken.getAddress(),
      admin.address
    );
    governanceRewards = await deployTx.waitForDeployment();
    
    // Measure deployment gas
    metrics.deployment = await measureGas(deployTx.deploymentTransaction());
    console.log(`Deployment gas used: ${metrics.deployment.toString()}`);
    
    // Setup roles
    await governanceRewards.grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), distributor.address);
    
    // Fund the contract
    await mockToken.mint(await governanceRewards.getAddress(), ethers.parseEther("1000"));
  });

  describe("Reward Distribution Performance", function() {
    it("should benchmark manual reward distribution", async function() {
      console.log("\nBenchmarking manual reward distribution...");
      
      for (let i = 0; i < NUM_REWARDS; i++) {
        const user = users[i % users.length];
        const tx = await governanceRewards.connect(distributor).manualDistributeReward(
          user.address,
          REWARD_AMOUNT,
          `Proposal ${i} participation`
        );
        
        const gasUsed = await measureGas(tx);
        metrics.singleReward.push(gasUsed);
        console.log(`Reward ${i+1} manual distribution gas used: ${gasUsed.toString()}`);
      }
      
      // Calculate average
      const avgGas = metrics.singleReward.reduce((a, b) => a + b, 0n) / BigInt(metrics.singleReward.length);
      console.log(`Average gas for manual reward distribution: ${avgGas.toString()}`);
    });
    
    it("should benchmark governance rewards distribution", async function() {
      console.log("\nBenchmarking governance rewards distribution...");
      
      // Test with different participation and quality levels
      const participationLevels = [50, 60, 70, 80, 90];
      const qualityLevels = [60, 70, 80, 90, 95];
      const aiNodeOptions = [true, false];
      
      let governanceMetrics = [];
      
      for (let i = 0; i < 5; i++) {
        const user = users[i + 15]; // Use different users than manual distribution
        const participation = participationLevels[i % participationLevels.length];
        const quality = qualityLevels[i % qualityLevels.length];
        const isAINode = aiNodeOptions[i % aiNodeOptions.length];
        
        const tx = await governanceRewards.connect(distributor).distributeRewards(
          user.address,
          participation,
          quality,
          isAINode
        );
        
        const gasUsed = await measureGas(tx);
        governanceMetrics.push(gasUsed);
        console.log(`Governance reward distribution (P:${participation}%, Q:${quality}%, AI:${isAINode}) gas used: ${gasUsed.toString()}`);
      }
      
      // Calculate average
      const avgGas = governanceMetrics.reduce((a, b) => a + b, 0n) / BigInt(governanceMetrics.length);
      console.log(`Average gas for governance reward distribution: ${avgGas.toString()}`);
      metrics.batchRewards = governanceMetrics; // Store for summary
    });
  });
  
  describe("Token Recovery and Config Performance", function() {
    before(async function() {
      // Distribute rewards to all users for testing
      for (let i = 0; i < 10; i++) {
        await governanceRewards.connect(distributor).manualDistributeReward(
          users[i].address,
          REWARD_AMOUNT,
          "Recovery test reward"
        );
      }
      
      // Fund the contract with additional tokens for recovery testing
      await mockToken.mint(await governanceRewards.getAddress(), ethers.parseEther("100"));
    });
    
    it("should benchmark token recovery operations", async function() {
      console.log("\nBenchmarking token recovery operations...");
      
      // Test different recovery amounts
      const recoveryAmounts = [
        ethers.parseEther("1"),
        ethers.parseEther("5"),
        ethers.parseEther("10"),
        ethers.parseEther("20"),
        ethers.parseEther("50")
      ];
      
      for (let i = 0; i < recoveryAmounts.length; i++) {
        const tx = await governanceRewards.connect(admin).recoverTokens(
          await mockToken.getAddress(),
          recoveryAmounts[i]
        );
        
        const gasUsed = await measureGas(tx);
        metrics.claimSingle.push(gasUsed);
        console.log(`Token recovery gas used (${ethers.formatEther(recoveryAmounts[i])} tokens): ${gasUsed.toString()}`);
      }
      
      // Calculate average
      const avgGas = metrics.claimSingle.reduce((a, b) => a + b, 0n) / BigInt(metrics.claimSingle.length);
      console.log(`Average gas for token recovery: ${avgGas.toString()}`);
    });
    
    it("should benchmark configuration operations", async function() {
      console.log("\nBenchmarking configuration operations...");
      
      // Test reward config updates
      const configMetrics = [];
      
      // Update reward config
      let tx = await governanceRewards.connect(admin).updateRewardConfig(
        ethers.parseEther("150"),  // baseReward
        2500,                      // votingParticipationBonus
        18000,                     // proposalQualityMultiplier
        15000,                     // aiNodeMultiplier
        ethers.parseEther("1500")  // rewardCap
      );
      let gasUsed = await measureGas(tx);
      configMetrics.push(gasUsed);
      console.log(`Update reward config gas used: ${gasUsed.toString()}`);
      
      // Update reward period
      tx = await governanceRewards.connect(admin).updateRewardPeriod(
        Math.floor(Date.now() / 1000),  // start
        604800                          // duration (1 week)
      );
      gasUsed = await measureGas(tx);
      configMetrics.push(gasUsed);
      console.log(`Update reward period gas used: ${gasUsed.toString()}`);
      
      // Set reward cooldown
      tx = await governanceRewards.connect(admin).setRewardCooldown(86400); // 1 day
      gasUsed = await measureGas(tx);
      configMetrics.push(gasUsed);
      console.log(`Set reward cooldown gas used: ${gasUsed.toString()}`);
      
      // Calculate average
      const avgGas = configMetrics.reduce((a, b) => a + b, 0n) / BigInt(configMetrics.length);
      console.log(`Average gas for configuration operations: ${avgGas.toString()}`);
      metrics.claimMultiple = configMetrics; // Store for summary
    });
  });
  
  after(async function() {
    console.log("\n===== GOVERNANCE REWARDS PERFORMANCE SUMMARY =====");
    console.log(`Deployment gas: ${metrics.deployment.toString()}`);
    
    const avgSingleReward = metrics.singleReward.reduce((a, b) => a + b, 0n) / BigInt(metrics.singleReward.length);
    console.log(`Avg manual reward distribution: ${avgSingleReward.toString()} gas`);
    
    const avgGovReward = metrics.batchRewards.reduce((a, b) => a + b, 0n) / BigInt(metrics.batchRewards.length);
    console.log(`Avg governance reward distribution: ${avgGovReward.toString()} gas`);
    
    const avgRecovery = metrics.claimSingle.reduce((a, b) => a + b, 0n) / BigInt(metrics.claimSingle.length);
    console.log(`Avg token recovery: ${avgRecovery.toString()} gas`);
    
    const avgConfig = metrics.claimMultiple.reduce((a, b) => a + b, 0n) / BigInt(metrics.claimMultiple.length);
    console.log(`Avg configuration operation: ${avgConfig.toString()} gas`);
    
    // Efficiency comparisons
    const manualVsGovernance = avgSingleReward * 100n / avgGovReward;
    console.log(`Efficiency ratio (manual:governance): ${manualVsGovernance.toString()}%`);
    console.log(`Manual distribution is ${manualVsGovernance > 100n ? 'less' : 'more'} efficient than governance distribution`);
    
    // Output additional metrics for reporting
    console.log("\n--- Detailed Metrics for Reporting ---");
    console.log(`Total rewards distributed: ${NUM_REWARDS + 5}`); // Manual + governance rewards
    console.log(`Number of users in test: ${NUM_USERS}`);
    console.log(`Reward token: ${await mockToken.symbol()}`);
    
    // Get current reward config for reporting
    const config = await governanceRewards.getRewardConfig();
    console.log(`\nCurrent Reward Configuration:`);
    console.log(`Base Reward: ${ethers.formatEther(config[0])} tokens`);
    console.log(`Voting Participation Bonus: ${config[1] / 100}%`);
    console.log(`Proposal Quality Multiplier: ${config[2] / 10000}x`);
    console.log(`AI Node Multiplier: ${config[3] / 10000}x`);
    console.log(`Reward Cap: ${ethers.formatEther(config[4])} tokens`);
  });
});
