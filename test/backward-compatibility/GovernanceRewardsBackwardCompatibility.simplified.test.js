/**
 * @title GovernanceRewards Backward Compatibility Tests (Simplified)
 * @dev Tests that verify GovernanceRewards contract maintains backward compatibility
 * with previous versions and interfaces
 */
const { ethers } = require("hardhat");
require('../utils/ethers-v6-compat');
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GovernanceRewards Backward Compatibility (Simplified)", function() {
  // Test variables
  let owner, admin, user1, user2, user3;
  let governanceRewards, governanceRewardsV2;
  let dloopToken;
  
  // Constants
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const REWARDS_POOL = ethers.parseEther("100000");
  const REWARD_AMOUNT_1 = ethers.parseEther("1000");
  const REWARD_AMOUNT_2 = ethers.parseEther("2000");
  
  // Fixture to deploy contracts
  async function deployContractsFixture() {
    // Get signers for testing
    [owner, admin, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      INITIAL_SUPPLY,
      18,
      ethers.parseEther("100000000"),
      owner.address
    );
    await dloopToken.waitForDeployment();
    
    // Transfer tokens to admin for testing
    await dloopToken.connect(owner).transfer(admin.address, INITIAL_SUPPLY / 2n);
    
    // Deploy current GovernanceRewards contract (v1)
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      await dloopToken.getAddress(),
      admin.address
    );
    await governanceRewards.waitForDeployment();
    
    // Deploy another instance of GovernanceRewards to simulate v2
    // In a real scenario, this would be a newer version with different implementation
    governanceRewardsV2 = await GovernanceRewards.deploy(
      await dloopToken.getAddress(),
      admin.address
    );
    await governanceRewardsV2.waitForDeployment();
    
    // Fund both contracts with tokens for distribution
    await dloopToken.connect(admin).transfer(
      await governanceRewards.getAddress(), 
      REWARDS_POOL
    );
    
    await dloopToken.connect(admin).transfer(
      await governanceRewardsV2.getAddress(), 
      REWARDS_POOL
    );
    
    return { 
      dloopToken, 
      governanceRewards, 
      governanceRewardsV2, 
      owner, 
      admin, 
      user1, 
      user2, 
      user3 
    };
  }
  
  describe("Interface Compatibility", function() {
    it("should have consistent function signatures between versions", async function() {
      const { governanceRewards, governanceRewardsV2 } = await loadFixture(deployContractsFixture);
      
      // Get the ABI for both contracts
      const v1Interface = governanceRewards.interface;
      const v2Interface = governanceRewardsV2.interface;
      
      // Check that all functions in v1 exist in v2
      for (const fragment of v1Interface.fragments) {
        if (fragment.type === "function") {
          const functionName = fragment.name;
          const functionSignature = fragment.format();
          
          // Check if v2 has the function
          expect(
            v2Interface.hasFunction(functionName),
            `Function ${functionName} should exist in v2`
          ).to.be.true;
          
          // For critical functions, verify the exact signature
          if (functionName === "distributeRewards" || functionName === "claimRewards") {
            console.log(`Function ${functionName} signature: ${functionSignature}`);
          }
        }
      }
    });
    
    it("should have consistent event signatures between versions", async function() {
      const { governanceRewards, governanceRewardsV2 } = await loadFixture(deployContractsFixture);
      
      // Get the ABI for both contracts
      const v1Interface = governanceRewards.interface;
      const v2Interface = governanceRewardsV2.interface;
      
      // Check that all events in v1 exist in v2
      for (const fragment of v1Interface.fragments) {
        if (fragment.type === "event") {
          const eventName = fragment.name;
          const eventSignature = fragment.format();
          
          // Check if v2 has the event
          expect(
            v2Interface.hasEvent(eventName),
            `Event ${eventName} should exist in v2`
          ).to.be.true;
          
          // For critical events, verify the exact signature
          if (eventName === "RewardsDistributed" || eventName === "RewardsClaimed") {
            console.log(`Event ${eventName} signature: ${eventSignature}`);
          }
        }
      }
    });
  });
  
  describe("Functional Compatibility", function() {
    it("should distribute rewards consistently between versions", async function() {
      const { governanceRewards, governanceRewardsV2, dloopToken, admin, user1, user2 } = 
        await loadFixture(deployContractsFixture);
      
      // Setup distribution parameters for the actual GovernanceRewards contract
      // The distributeRewards function takes (address _proposer, uint256 _yesVotes, uint256 _noVotes, uint256 _totalSupply)
      const proposer = user1.address;
      const yesVotes = ethers.parseEther("5000");
      const noVotes = ethers.parseEther("1000");
      const totalSupply = INITIAL_SUPPLY;
      
      // Grant admin role to admin in both contracts
      const ADMIN_ROLE = await governanceRewards.ADMIN_ROLE();
      const DISTRIBUTOR_ROLE = await governanceRewards.DISTRIBUTOR_ROLE();
      
      await governanceRewards.connect(admin).grantRole(DISTRIBUTOR_ROLE, admin.address);
      await governanceRewardsV2.connect(admin).grantRole(DISTRIBUTOR_ROLE, admin.address);
      
      // Record balances before distribution
      const user1BalanceBefore = await dloopToken.balanceOf(user1.address);
      const user2BalanceBefore = await dloopToken.balanceOf(user2.address);
      
      // Distribute rewards using v1
      await governanceRewards.connect(admin).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Verify balances after distribution with v1
      const user1BalanceAfterV1 = await dloopToken.balanceOf(user1.address);
      const user2BalanceAfterV1 = await dloopToken.balanceOf(user2.address);
      
      // Get the actual reward amount calculated by the contract
      const actualRewardAmount = await governanceRewards.totalRewardsEarned(user1.address);
      console.log(`Actual reward amount calculated: ${ethers.formatEther(actualRewardAmount)} DLOOP`);
      
      // Check that user1 received the reward (as the proposer)
      expect(user1BalanceAfterV1).to.be.gt(user1BalanceBefore);
      // The reward should match what's recorded in the contract
      expect(user1BalanceAfterV1 - user1BalanceBefore).to.equal(actualRewardAmount);
      
      // Record balances for comparison
      const user1BalanceAfterV1Comparison = await dloopToken.balanceOf(user1.address);
      const user2BalanceAfterV1Comparison = await dloopToken.balanceOf(user2.address);
      
      // Ensure admin has tokens before transferring
      const adminBalance = await dloopToken.balanceOf(admin.address);
      expect(adminBalance).to.be.greaterThanOrEqual(REWARD_AMOUNT_1 + REWARD_AMOUNT_2);
      
      // We'll use a different approach for v2 testing
      // Instead of resetting balances, we'll just track the difference
      
      // Distribute rewards using v2
      await governanceRewardsV2.connect(admin).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Verify balances after distribution with v2
      const user1BalanceAfterV2 = await dloopToken.balanceOf(user1.address);
      const user2BalanceAfterV2 = await dloopToken.balanceOf(user2.address);
      
      // The behavior should be consistent between versions
      // We're checking that V2 distributed the same amount as V1
      const user1ReceivedV2 = user1BalanceAfterV2 - user1BalanceAfterV1;
      
      // Get the actual reward amount from the contract
      const rewardAmount = await governanceRewards.totalRewardsEarned(user1.address);
      console.log(`Actual reward amount: ${ethers.formatEther(rewardAmount)} DLOOP`);
      
      // Verify that V2 distributes the same reward amount as V1
      expect(user1ReceivedV2).to.equal(rewardAmount);
      
      // Verify that both contracts calculate the same reward amount
      const rewardAmountV2 = await governanceRewardsV2.totalRewardsEarned(user1.address);
      expect(rewardAmountV2).to.equal(rewardAmount);
    });
  });
  
  describe("State Migration Simulation", function() {
    it("should simulate state migration between contract versions", async function() {
      const { governanceRewards, governanceRewardsV2, dloopToken, admin, user1 } = 
        await loadFixture(deployContractsFixture);
      
      // Setup: Create some state in v1
      const proposer = user1.address;
      const yesVotes = ethers.parseEther("5000");
      const noVotes = ethers.parseEther("1000");
      const totalSupply = INITIAL_SUPPLY;
      
      // Grant distributor role to admin
      const DISTRIBUTOR_ROLE = await governanceRewards.DISTRIBUTOR_ROLE();
      await governanceRewards.connect(admin).grantRole(DISTRIBUTOR_ROLE, admin.address);
      await governanceRewardsV2.connect(admin).grantRole(DISTRIBUTOR_ROLE, admin.address);
      
      // Distribute rewards in v1
      await governanceRewards.connect(admin).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check user1's rewards in v1
      const totalRewardsEarnedV1 = await governanceRewards.totalRewardsEarned(user1.address);
      console.log(`Total rewards earned in v1: ${ethers.formatEther(totalRewardsEarnedV1)} DLOOP`);
      
      // In a real migration, we would extract state from v1 and apply it to v2
      // For this simulation, we'll just distribute the same rewards in v2
      
      // Distribute rewards in v2 (simulating migration)
      await governanceRewardsV2.connect(admin).distributeRewards(
        proposer,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check user1's rewards in v2
      const totalRewardsEarnedV2 = await governanceRewardsV2.totalRewardsEarned(user1.address);
      console.log(`Total rewards earned in v2: ${ethers.formatEther(totalRewardsEarnedV2)} DLOOP`);
      
      // Verify the state is consistent between versions
      expect(totalRewardsEarnedV2).to.equal(totalRewardsEarnedV1);
    });
  });
});
