const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title D-Loop Protocol AssetDAO Governance Enhanced Tests
 * @dev Tests for verifying the governance rewards distribution for AssetDAO proposals
 * @notice These tests focus on edge cases and parameterization of governance rewards
 */
describe("AssetDAO Governance Enhanced Tests", function () {
  // Use a simplified fixture that doesn't require mock contracts
  async function deploySimplifiedFixture() {
    const [owner, admin, proposer, voter1, voter2, voter3, aiNode] = await ethers.getSigners();
    
    // Deploy DLoopToken for governance
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // initialSupply
      18, // decimals
      ethers.parseEther("100000000"), // maxSupply
      admin.address
    );
    await dloopToken.waitForDeployment();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      await dloopToken.getAddress(), // reward token
      admin.address // admin
    );
    await governanceRewards.waitForDeployment();
    
    // Setup roles and permissions
    await governanceRewards.connect(admin).grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), admin.address);
    await dloopToken.connect(admin).grantRole(await dloopToken.MINTER_ROLE(), admin.address);
    
    // Mint tokens to users for governance participation
    await dloopToken.connect(admin).mint(proposer.address, ethers.parseEther("10000"));
    await dloopToken.connect(admin).mint(voter1.address, ethers.parseEther("20000"));
    await dloopToken.connect(admin).mint(voter2.address, ethers.parseEther("30000"));
    await dloopToken.connect(admin).mint(voter3.address, ethers.parseEther("15000"));
    await dloopToken.connect(admin).mint(aiNode.address, ethers.parseEther("25000"));
    
    // Mint tokens to governance rewards contract
    await dloopToken.connect(admin).mint(await governanceRewards.getAddress(), ethers.parseEther("1000000"));
    
    // Configure reward parameters
    await governanceRewards.connect(admin).updateRewardConfig(
      ethers.parseEther("100"),  // baseReward
      2000,                      // votingParticipationBonus (20%)
      15000,                     // proposalQualityMultiplier (1.5x)
      12000,                     // aiNodeMultiplier (1.2x)
      ethers.parseEther("500")   // rewardCap
    );
    
    // Set reward cooldown to 1 day
    await governanceRewards.connect(admin).setRewardCooldown(86400); // 24 hours
    
    return { 
      dloopToken, governanceRewards,
      owner, admin, proposer, voter1, voter2, voter3, aiNode
    };
  }

  describe("Edge Cases", function () {
    it("Should handle proposals with very low participation", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer, voter3
      } = await loadFixture(deploySimplifiedFixture);
      
      console.log("Step 1: Setup low participation scenario");
      
      // Calculate voting statistics for low participation
      const yesVotes = ethers.parseEther("15000"); // Only voter3's votes
      const noVotes = ethers.parseEther("0");
      const totalSupply = await dloopToken.totalSupply();
      const participationRate = (yesVotes * 100n) / totalSupply;
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 2: Distribute rewards for low participation proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Initial proposer balance: ${ethers.formatEther(initialBalance)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned
      const rewardsEarned = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Rewards earned (low participation): ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed but should be lower due to low participation
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      console.log("Low participation test completed successfully");
    });

    it("Should handle proposals with tied votes", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer
      } = await loadFixture(deploySimplifiedFixture);
      
      console.log("Step 1: Setup tied votes scenario");
      
      // Calculate voting statistics for tied votes
      const yesVotes = ethers.parseEther("25000");
      const noVotes = ethers.parseEther("25000");
      const totalSupply = await dloopToken.totalSupply();
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Yes/No ratio: 50/50`);
      
      console.log("Step 2: Distribute rewards for tied votes proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Initial proposer balance: ${ethers.formatEther(initialBalance)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned
      const rewardsEarned = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Rewards earned (tied votes): ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      console.log("Tied votes test completed successfully");
    });

    it("Should reject multiple proposals from the same proposer within cooldown period", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer
      } = await loadFixture(deploySimplifiedFixture);
      
      console.log("Step 1: Distribute rewards for first proposal");
      
      // Distribute rewards for first proposal
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        ethers.parseEther("50000"), // yes votes
        ethers.parseEther("10000"), // no votes
        ethers.parseEther("1000000") // total supply
      );
      
      console.log("Step 2: Try to distribute rewards again within cooldown period");
      
      // Try to distribute rewards again - should revert due to cooldown period
      await expect(
        governanceRewards.connect(admin).distributeRewards(
          proposer.address,
          ethers.parseEther("40000"), // yes votes
          ethers.parseEther("20000"), // no votes
          ethers.parseEther("1000000") // total supply
        )
      ).to.be.revertedWithCustomError(governanceRewards, "CooldownPeriodNotMet");
      
      console.log("Successfully rejected reward distribution within cooldown period");
    });
  });

  describe("Parameterization Testing", function () {
    it("Should distribute different rewards based on parameter changes", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer
      } = await loadFixture(deploySimplifiedFixture);
      
      console.log("Step 1: Distribute rewards with default parameters");
      
      // Calculate voting statistics
      const yesVotes = ethers.parseEther("50000");
      const noVotes = ethers.parseEther("10000");
      const totalSupply = await dloopToken.totalSupply();
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Initial proposer balance: ${ethers.formatEther(initialBalance)} DLOOP`);
      
      // Distribute rewards with default parameters
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned with default parameters
      const defaultRewards = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Rewards with default parameters: ${ethers.formatEther(defaultRewards)} DLOOP`);
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 2: Update reward parameters");
      
      // Update reward parameters
      await governanceRewards.connect(admin).updateRewardConfig(
        ethers.parseEther("200"),  // doubled baseReward
        3000,                      // increased votingParticipationBonus (30%)
        20000,                     // increased proposalQualityMultiplier (2x)
        15000,                     // increased aiNodeMultiplier (1.5x)
        ethers.parseEther("1000")  // increased rewardCap
      );
      
      console.log("Step 3: Distribute rewards with updated parameters");
      
      // Create a new proposer to avoid cooldown issues
      const [, , , , , , , newProposer] = await ethers.getSigners();
      await dloopToken.connect(admin).mint(newProposer.address, ethers.parseEther("10000"));
      
      // Get initial balance of new proposer
      const initialBalanceNew = await dloopToken.balanceOf(newProposer.address);
      
      // Distribute rewards with updated parameters
      await governanceRewards.connect(admin).distributeRewards(
        newProposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned with updated parameters
      const updatedRewards = await governanceRewards.totalRewardsEarned(newProposer.address);
      console.log(`Rewards with updated parameters: ${ethers.formatEther(updatedRewards)} DLOOP`);
      
      // Verify that updated parameters resulted in higher rewards
      expect(updatedRewards).to.be.gt(defaultRewards);
      
      // Check final balance
      const finalBalanceNew = await dloopToken.balanceOf(newProposer.address);
      
      // Verify balance increased by the reward amount
      expect(finalBalanceNew).to.equal(initialBalanceNew + updatedRewards);
      
      console.log("Parameter change test completed successfully");
    });
  });

  describe("Gas Optimization", function () {
    it("Should profile gas usage of the reward distribution process", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer
      } = await loadFixture(deploySimplifiedFixture);
      
      console.log("Step 1: Setup for gas profiling");
      
      // Calculate voting statistics
      const yesVotes = ethers.parseEther("50000");
      const noVotes = ethers.parseEther("10000");
      const totalSupply = await dloopToken.totalSupply();
      
      console.log("Step 2: Measure gas usage for reward distribution");
      
      // Measure gas usage
      const tx = await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      
      console.log(`Gas used for reward distribution: ${gasUsed.toString()}`);
      
      // In a real optimization scenario, we would compare different implementations
      // For this test, we're just measuring the current implementation
      
      console.log("Gas profiling completed successfully");
    });
  });
});
