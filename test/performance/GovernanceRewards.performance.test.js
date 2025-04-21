const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title GovernanceRewards Performance Tests
 * @dev Measures gas consumption for critical GovernanceRewards operations
 */
describe("GovernanceRewards Gas Usage", function() {
  // Contract instances
  let governanceRewards;
  let mockToken;
  
  // Test accounts
  let admin, distributor, treasury, user1, user2, user3;
  
  before(async function() {
    [admin, distributor, treasury, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Governance Token", "GOV");
    await mockToken.waitForDeployment();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      await mockToken.getAddress(),
      admin.address
    );
    await governanceRewards.waitForDeployment();
    
    // Setup roles
    await governanceRewards.grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), distributor.address);
    
    // Fund the contract
    await mockToken.mint(await governanceRewards.getAddress(), ethers.parseEther("100"));
  });

  describe("Role Management Gas Usage", function() {
    it("should measure gas for role management operations", async function() {
      // Grant role
      let tx = await governanceRewards.grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), user1.address);
      let receipt = await tx.wait();
      console.log(`Gas used for grantRole: ${receipt.gasUsed.toString()}`);
      
      // Revoke role
      tx = await governanceRewards.revokeRole(await governanceRewards.DISTRIBUTOR_ROLE(), user1.address);
      receipt = await tx.wait();
      console.log(`Gas used for revokeRole: ${receipt.gasUsed.toString()}`);
      
      // Renounce role
      await governanceRewards.grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), user2.address);
      tx = await governanceRewards.connect(user2).renounceRole(await governanceRewards.DISTRIBUTOR_ROLE(), user2.address);
      receipt = await tx.wait();
      console.log(`Gas used for renounceRole: ${receipt.gasUsed.toString()}`);
    });
  });

  describe("Reward Distribution Gas Usage", function() {
    it("should measure gas for reward distribution", async function() {
      // Manual reward distribution
      const tx = await governanceRewards.connect(distributor).manualDistributeReward(
        user1.address,
        ethers.parseEther("1.0"),
        "Proposal participation"
      );
      const receipt = await tx.wait();
      console.log(`Gas used for manualDistributeReward: ${receipt.gasUsed.toString()}`);
      
      // Governance rewards distribution
      // First, we need to simulate governance participation
      const proposalTx = await governanceRewards.connect(distributor).manualDistributeReward(
        user2.address,
        ethers.parseEther("0.5"),
        "Governance participation setup"
      );
      await proposalTx.wait();
      
      // Now distribute rewards based on governance participation
      const govTx = await governanceRewards.connect(distributor).distributeRewards(
        user2.address,  // proposer
        75,             // votingParticipation (75%)
        85,             // proposalQuality (85%)
        false           // isAINode
      );
      const govReceipt = await govTx.wait();
      console.log(`Gas used for distributeRewards: ${govReceipt.gasUsed.toString()}`);
      
      // Distribute to multiple users manually (simulating batch)
      let totalGas = BigInt(0);
      const users = [user1, user2, user3];
      const amounts = [
        ethers.parseEther("1.0"),
        ethers.parseEther("2.0"),
        ethers.parseEther("3.0")
      ];
      const reasons = [
        "Manual reward 1",
        "Manual reward 2",
        "Manual reward 3"
      ];
      
      for (let i = 0; i < users.length; i++) {
        const batchTx = await governanceRewards.connect(distributor).manualDistributeReward(
          users[i].address,
          amounts[i],
          reasons[i]
        );
        const batchReceipt = await batchTx.wait();
        totalGas += batchReceipt.gasUsed;
      }
      
      console.log(`Total gas used for 3 manual distributions: ${totalGas.toString()}`);
      console.log(`Average gas per distribution: ${(totalGas / BigInt(3)).toString()}`);
    });
  });

  // Note: The GovernanceRewards contract doesn't have explicit claim methods
  // Instead, rewards are automatically transferred during distribution
  describe("Reward Recovery Gas Usage", function() {
    before(async function() {
      // Distribute more rewards for recovery tests
      await governanceRewards.connect(distributor).manualDistributeReward(
        user1.address,
        ethers.parseEther("1.0"),
        "Recovery test reward 1"
      );
      
      await governanceRewards.connect(distributor).manualDistributeReward(
        user1.address,
        ethers.parseEther("2.0"),
        "Recovery test reward 2"
      );
    });
    
    it("should measure gas for token recovery operations", async function() {
      // Fund the contract with some tokens for recovery
      await mockToken.mint(await governanceRewards.getAddress(), ethers.parseEther("10.0"));
      
      // Recover tokens
      const tx = await governanceRewards.connect(admin).recoverTokens(
        await mockToken.getAddress(),
        ethers.parseEther("5.0")
      );
      const receipt = await tx.wait();
      console.log(`Gas used for recoverTokens: ${receipt.gasUsed.toString()}`);
      
      // Check reward history
      const historyTx = await governanceRewards.getRewardHistoryCount();
      console.log(`Current reward history count: ${historyTx.toString()}`);
      
      // Get reward config
      const configTx = await governanceRewards.getRewardConfig();
      console.log(`Current base reward: ${ethers.formatEther(configTx[0])} tokens`);
    });
  });

  describe("Configuration Gas Usage", function() {
    it("should measure gas for configuration changes", async function() {
      // Update reward config
      let tx = await governanceRewards.connect(admin).updateRewardConfig(
        ethers.parseEther("150"),  // baseReward
        2500,                      // votingParticipationBonus
        18000,                     // proposalQualityMultiplier
        15000,                     // aiNodeMultiplier
        ethers.parseEther("1500")  // rewardCap
      );
      let receipt = await tx.wait();
      console.log(`Gas used for updateRewardConfig: ${receipt.gasUsed.toString()}`);
      
      // Update reward period
      tx = await governanceRewards.connect(admin).updateRewardPeriod(
        Math.floor(Date.now() / 1000),  // start
        604800                          // duration (1 week)
      );
      receipt = await tx.wait();
      console.log(`Gas used for updateRewardPeriod: ${receipt.gasUsed.toString()}`);
      
      // Set reward cooldown
      tx = await governanceRewards.connect(admin).setRewardCooldown(86400); // 1 day
      receipt = await tx.wait();
      console.log(`Gas used for setRewardCooldown: ${receipt.gasUsed.toString()}`);
      
      // Recover tokens
      tx = await governanceRewards.connect(admin).recoverTokens(
        await mockToken.getAddress(),
        ethers.parseEther("1")
      );
      receipt = await tx.wait();
      console.log(`Gas used for recoverTokens: ${receipt.gasUsed.toString()}`);
    });
  });
});
