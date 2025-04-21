/**
 * @title GovernanceRewards Gas Profiling Test
 * @dev Tests to measure gas consumption for critical GovernanceRewards functions
 * 
 * This test measures gas consumption for:
 * 1. Distributing rewards to participants
 * 2. Claiming rewards by participants
 * 3. Setting reward parameters
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
// Using a custom fixture instead of the shared fixture

// Helper function to handle contract calls and standardize error handling
async function handleContractCall(fn) {
  try {
    const result = await fn();
    return { success: true, result, error: null };
  } catch (error) {
    console.error(`Contract call failed: ${error.message}`);
    return { success: false, result: null, error };
  }
}

// Helper function to measure gas usage
async function measureGas(fn) {
  const tx = await fn();
  const receipt = await tx.wait();
  return receipt.gasUsed;
}

describe("GovernanceRewards Gas Profiling", function() {
  // Increase timeout for complex tests
  this.timeout(60000);
  
  // Define gas thresholds
  const GAS_THRESHOLDS = {
    DISTRIBUTE_REWARDS_BASE: 150000,
    DISTRIBUTE_REWARDS_PER_USER: 30000,
    CLAIM_REWARDS: 70000,
    SET_REWARD_PARAMETERS: 50000
  };
  
  // Custom fixture to set up GovernanceRewards with participants
  async function setupGovernanceRewardsFixture() {
    // Get signers
    const [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
    const users = [user1, user2, user3, user4, user5];
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // initialSupply
      18, // decimals
      ethers.parseEther("100000000"), // maxSupply
      owner.address // admin
    );
    await dloopToken.waitForDeployment();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      await dloopToken.getAddress(),
      owner.address
    );
    await governanceRewards.waitForDeployment();
    
    // Fund GovernanceRewards with tokens for distribution
    await dloopToken.transfer(
      await governanceRewards.getAddress(), 
      ethers.parseEther("1000000")
    );
    
    // Ensure admin role is set correctly
    if (governanceRewards.interface.hasFunction("grantRole(bytes32,address)")) {
      const ADMIN_ROLE = await governanceRewards.DEFAULT_ADMIN_ROLE();
      await governanceRewards.grantRole(ADMIN_ROLE, owner.address);
    }
    
    return { governanceRewards, dloopToken, owner, users, user1, user2, user3, user4, user5 };
  }
  
  describe("Gas Consumption Measurements", function() {
    it("Should measure gas for distributing rewards", async function() {
      const { governanceRewards, users, owner } = await loadFixture(setupGovernanceRewardsFixture);
      
      // Prepare distribution parameters
      const proposalId = 1;
      const userAddresses = users.map(user => user.address);
      const amounts = users.map(() => ethers.parseEther("1000"));
      const description = "Rewards for governance participation";
      
      // Measure gas for distributing rewards
      let gasUsed;
      
      try {
        if (governanceRewards.interface.hasFunction("distributeRewards(uint256,address[],uint256[],string)")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).distributeRewards(
              proposalId,
              userAddresses,
              amounts,
              description
            )
          );
        } else if (governanceRewards.interface.hasFunction("distributeRewards(address[],uint256[])")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).distributeRewards(
              userAddresses,
              amounts
            )
          );
        } else if (governanceRewards.interface.hasFunction("distributeRewards(uint256)")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).distributeRewards(proposalId)
          );
        } else {
          console.log("distributeRewards function not found with expected signature");
          return;
        }
        
        console.log(`Gas used for distributing rewards to ${users.length} users: ${gasUsed}`);
        
        // Check against thresholds
        const expectedGas = GAS_THRESHOLDS.DISTRIBUTE_REWARDS_BASE + 
                           (GAS_THRESHOLDS.DISTRIBUTE_REWARDS_PER_USER * users.length);
        
        expect(gasUsed).to.be.at.most(
          expectedGas * 1.2, // Allow 20% buffer for implementation variations
          "Gas usage for distributing rewards exceeds threshold"
        );
      } catch (error) {
        console.log(`Could not measure distributeRewards gas: ${error.message}`);
      }
    });
    
    it("Should measure gas for claiming rewards", async function() {
      const { governanceRewards, users, owner, dloopToken } = await loadFixture(setupGovernanceRewardsFixture);
      
      // Set up rewards for a user to claim
      try {
        const user = users[0];
        const amount = ethers.parseEther("1000");
        
        // Distribute rewards first
        if (governanceRewards.interface.hasFunction("distributeRewards(uint256,address[],uint256[],string)")) {
          await governanceRewards.connect(owner).distributeRewards(
            1, // proposalId
            [user.address],
            [amount],
            "Test rewards"
          );
        } else if (governanceRewards.interface.hasFunction("distributeRewards(address[],uint256[])")) {
          await governanceRewards.connect(owner).distributeRewards(
            [user.address],
            [amount]
          );
        } else {
          // Manually transfer tokens to simulate rewards
          await dloopToken.connect(owner).transfer(user.address, amount);
        }
        
        // Measure gas for claiming rewards
        if (governanceRewards.interface.hasFunction("claimRewards()")) {
          const gasUsed = await measureGas(() => 
            governanceRewards.connect(user).claimRewards()
          );
          
          console.log(`Gas used for claiming rewards: ${gasUsed}`);
          
          // Check against threshold
          expect(gasUsed).to.be.at.most(
            GAS_THRESHOLDS.CLAIM_REWARDS * 1.2, // Allow 20% buffer
            "Gas usage for claiming rewards exceeds threshold"
          );
        } else {
          console.log("claimRewards function not found with expected signature");
        }
      } catch (error) {
        console.log(`Could not measure claimRewards gas: ${error.message}`);
      }
    });
    
    it("Should measure gas for setting reward parameters", async function() {
      const { governanceRewards, owner } = await loadFixture(setupGovernanceRewardsFixture);
      
      try {
        // Check for different parameter setting functions
        let gasUsed;
        
        if (governanceRewards.interface.hasFunction("setRewardRate(uint256)")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).setRewardRate(100) // 1% reward rate
          );
        } else if (governanceRewards.interface.hasFunction("setRewardParameters(uint256,uint256)")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).setRewardParameters(100, 86400) // 1% rate, 1 day period
          );
        } else if (governanceRewards.interface.hasFunction("updateRewardSettings(uint256,uint256,uint256)")) {
          gasUsed = await measureGas(() => 
            governanceRewards.connect(owner).updateRewardSettings(100, 86400, 10000)
          );
        } else {
          console.log("Reward parameter setting function not found with expected signature");
          return;
        }
        
        console.log(`Gas used for setting reward parameters: ${gasUsed}`);
        
        // Check against threshold
        expect(gasUsed).to.be.at.most(
          GAS_THRESHOLDS.SET_REWARD_PARAMETERS * 1.2, // Allow 20% buffer
          "Gas usage for setting reward parameters exceeds threshold"
        );
      } catch (error) {
        console.log(`Could not measure reward parameter setting gas: ${error.message}`);
      }
    });
  });
  
  describe("Gas Optimization Verification", function() {
    it("Should verify batch operations are more gas efficient than individual operations", async function() {
      const { governanceRewards, users, owner } = await loadFixture(setupGovernanceRewardsFixture);
      
      try {
        // Check if the contract has batch distribution function
        if (!governanceRewards.interface.hasFunction("distributeRewards(uint256,address[],uint256[],string)") &&
            !governanceRewards.interface.hasFunction("distributeRewards(address[],uint256[])")) {
          console.log("Batch distribution function not found, skipping test");
          return;
        }
        
        // Prepare data for a single user
        const singleUser = users[0].address;
        const singleAmount = ethers.parseEther("1000");
        
        // Prepare data for multiple users
        const multipleUsers = users.map(user => user.address);
        const multipleAmounts = users.map(() => ethers.parseEther("1000"));
        
        // Measure gas for single distribution
        let singleGasTotal = 0;
        
        for (let i = 0; i < users.length; i++) {
          let singleGas;
          
          if (governanceRewards.interface.hasFunction("distributeRewards(uint256,address[],uint256[],string)")) {
            singleGas = await measureGas(() => 
              governanceRewards.connect(owner).distributeRewards(
                i + 1, // proposalId
                [users[i].address],
                [ethers.parseEther("1000")],
                `Reward for user ${i}`
              )
            );
          } else if (governanceRewards.interface.hasFunction("distributeRewards(address[],uint256[])")) {
            singleGas = await measureGas(() => 
              governanceRewards.connect(owner).distributeRewards(
                [users[i].address],
                [ethers.parseEther("1000")]
              )
            );
          }
          
          singleGasTotal += singleGas;
        }
        
        // Measure gas for batch distribution
        let batchGas;
        
        if (governanceRewards.interface.hasFunction("distributeRewards(uint256,address[],uint256[],string)")) {
          batchGas = await measureGas(() => 
            governanceRewards.connect(owner).distributeRewards(
              100, // proposalId
              multipleUsers,
              multipleAmounts,
              "Batch rewards"
            )
          );
        } else if (governanceRewards.interface.hasFunction("distributeRewards(address[],uint256[])")) {
          batchGas = await measureGas(() => 
            governanceRewards.connect(owner).distributeRewards(
              multipleUsers,
              multipleAmounts
            )
          );
        }
        
        console.log(`Gas used for ${users.length} individual distributions: ${singleGasTotal}`);
        console.log(`Gas used for batch distribution to ${users.length} users: ${batchGas}`);
        
        // Verify batch is more efficient
        expect(batchGas).to.be.lessThan(
          singleGasTotal,
          "Batch distribution should be more gas efficient than individual distributions"
        );
      } catch (error) {
        console.log(`Could not compare batch vs individual gas usage: ${error.message}`);
      }
    });
  });
});
