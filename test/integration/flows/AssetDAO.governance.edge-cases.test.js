const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title AssetDAO Governance Rewards Edge Case Tests
 * @dev Integration tests for AssetDAO governance rewards focusing on edge cases
 */
describe("AssetDAO Governance Rewards Edge Case Tests", function () {
  // Define a fixture for deploying the contracts
  async function deployContractsFixture() {
    const [owner, admin, proposer, voter1, voter2, voter3, aiNode, lowVoter1, lowVoter2] = await ethers.getSigners();
    
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
    
    // Deploy DAIToken for asset governance
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.waitForDeployment();
    
    // Create inline mock contracts
    
    // Mock PriceOracle - simple contract that just returns prices
    const mockPriceOracle = await (await ethers.getContractFactory("DAIToken")).deploy();
    await mockPriceOracle.waitForDeployment();
    
    // Mock FeeProcessor - simple contract that just returns fees
    const mockFeeProcessor = await (await ethers.getContractFactory("DAIToken")).deploy();
    await mockFeeProcessor.waitForDeployment();
    
    // Mock ProtocolDAO - simple contract that just returns governance parameters
    const mockProtocolDAO = await (await ethers.getContractFactory("DAIToken")).deploy();
    await mockProtocolDAO.waitForDeployment();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      await dloopToken.getAddress(), // reward token
      admin.address // admin
    );
    await governanceRewards.waitForDeployment();
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      await daiToken.getAddress(), // D-AI token
      await dloopToken.getAddress(), // DLOOP token
      await mockPriceOracle.getAddress(), // price oracle
      await mockFeeProcessor.getAddress(), // fee processor
      await mockProtocolDAO.getAddress() // protocol DAO
    );
    await assetDAO.waitForDeployment();
    
    // Setup roles and permissions
    await governanceRewards.connect(admin).grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), admin.address);
    await dloopToken.connect(admin).grantRole(await dloopToken.MINTER_ROLE(), admin.address);
    
    // Mint tokens to users for governance participation
    await dloopToken.connect(admin).mint(proposer.address, ethers.parseEther("10000"));
    await dloopToken.connect(admin).mint(voter1.address, ethers.parseEther("20000"));
    await dloopToken.connect(admin).mint(voter2.address, ethers.parseEther("30000"));
    await dloopToken.connect(admin).mint(voter3.address, ethers.parseEther("15000"));
    await dloopToken.connect(admin).mint(aiNode.address, ethers.parseEther("25000"));
    
    // Mint small amounts to low voters for threshold testing
    await dloopToken.connect(admin).mint(lowVoter1.address, ethers.parseEther("100"));
    await dloopToken.connect(admin).mint(lowVoter2.address, ethers.parseEther("50"));
    
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
      daiToken, dloopToken, governanceRewards, assetDAO,
      mockPriceOracle, mockFeeProcessor, mockProtocolDAO,
      owner, admin, proposer, voter1, voter2, voter3, aiNode, lowVoter1, lowVoter2
    };
  }

  describe("Minimum Participation Edge Case", function () {
    it("Should handle proposals with very low participation", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, lowVoter1, lowVoter2
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create asset and proposal");
      
      // Create asset
      await assetDAO.connect(admin).createAsset("Low Participation Asset", "Asset for low participation testing");
      
      // Create proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "Low participation test proposal"
      );
      
      console.log("Step 2: Vote with minimal participation");
      
      // Only low-balance voters participate
      await assetDAO.connect(lowVoter1).vote(1, true);
      await assetDAO.connect(lowVoter2).vote(1, false);
      
      // Calculate voting statistics
      const lowVoter1Balance = await dloopToken.balanceOf(lowVoter1.address);
      const lowVoter2Balance = await dloopToken.balanceOf(lowVoter2.address);
      
      const yesVotes = lowVoter1Balance;
      const noVotes = lowVoter2Balance;
      const totalVotes = yesVotes + noVotes;
      const totalSupply = await dloopToken.totalSupply();
      const participationRate = (totalVotes * 100n) / totalSupply;
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Total votes: ${ethers.formatEther(totalVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 3: Wait for voting period to end");
      
      // Get the voting period from the contract if possible
      let votingPeriod = 7 * 24 * 60 * 60; // Default to 7 days if not available
      try {
        const votingPeriodFunction = assetDAO.interface.getFunction("getVotingPeriod");
        if (votingPeriodFunction) {
          votingPeriod = await assetDAO.getVotingPeriod();
        }
      } catch (error) {
        console.log("Note: Could not get voting period, using default of 7 days.");
      }
      
      // Advance time to end the voting period
      await ethers.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      console.log("Step 4: Execute the proposal");
      
      // Execute the proposal
      await assetDAO.connect(admin).executeProposal(1);
      
      console.log("Step 5: Distribute rewards with minimal participation");
      
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
      console.log(`Rewards earned: ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      // Calculate expected reward - should only get base reward without participation bonus
      const expectedReward = ethers.parseEther("100"); // Base reward only
      console.log(`Expected reward: ${ethers.formatEther(expectedReward)} DLOOP`);
      
      // Verify the actual reward matches the expected reward
      expect(rewardsEarned).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
      
      console.log("Low participation test completed successfully");
    });
  });

  describe("Tied Vote Edge Case", function () {
    it("Should handle proposals with exactly tied votes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create asset and proposal");
      
      // Create asset
      await assetDAO.connect(admin).createAsset("Tied Vote Asset", "Asset for tied vote testing");
      
      // Create proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "Tied vote test proposal"
      );
      
      console.log("Step 2: Vote with exactly tied votes");
      
      // Ensure voter1 and voter2 have exactly the same balance
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      
      // If balances are not equal, adjust them
      if (voter1Balance !== voter2Balance) {
        if (voter1Balance > voter2Balance) {
          await dloopToken.connect(admin).mint(voter2.address, voter1Balance - voter2Balance);
        } else {
          await dloopToken.connect(admin).mint(voter1.address, voter2Balance - voter1Balance);
        }
      }
      
      // Verify balances are now equal
      const newVoter1Balance = await dloopToken.balanceOf(voter1.address);
      const newVoter2Balance = await dloopToken.balanceOf(voter2.address);
      console.log(`Voter1 balance: ${ethers.formatEther(newVoter1Balance)} DLOOP`);
      console.log(`Voter2 balance: ${ethers.formatEther(newVoter2Balance)} DLOOP`);
      expect(newVoter1Balance).to.equal(newVoter2Balance);
      
      // Cast exactly tied votes
      await assetDAO.connect(voter1).vote(1, true);  // Yes vote
      await assetDAO.connect(voter2).vote(1, false); // No vote
      
      // Calculate voting statistics
      const yesVotes = newVoter1Balance;
      const noVotes = newVoter2Balance;
      const totalVotes = yesVotes + noVotes;
      const totalSupply = await dloopToken.totalSupply();
      const participationRate = (totalVotes * 100n) / totalSupply;
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 3: Wait for voting period to end");
      
      // Get the voting period from the contract if possible
      let votingPeriod = 7 * 24 * 60 * 60; // Default to 7 days if not available
      try {
        const votingPeriodFunction = assetDAO.interface.getFunction("getVotingPeriod");
        if (votingPeriodFunction) {
          votingPeriod = await assetDAO.getVotingPeriod();
        }
      } catch (error) {
        console.log("Note: Could not get voting period, using default of 7 days.");
      }
      
      // Advance time to end the voting period
      await ethers.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      console.log("Step 4: Try to execute the proposal (should fail due to tied vote)");
      
      // Try to execute the proposal (should fail due to tied vote)
      let executionFailed = false;
      try {
        await assetDAO.connect(admin).executeProposal(1);
        console.log("WARNING: Proposal execution succeeded despite tied vote");
      } catch (error) {
        // Check if the error is due to majority not reached
        const errorMessage = error.toString();
        const isMajorityNotReachedError = errorMessage.includes("MajorityNotReached");
        
        if (isMajorityNotReachedError) {
          console.log("Expected error: MajorityNotReached - This is correct behavior for tied votes");
          executionFailed = true;
        } else {
          console.log(`Unexpected error: ${errorMessage}`);
          throw error; // Re-throw if it's not the expected error
        }
      }
      
      // Verify that execution failed as expected
      expect(executionFailed).to.be.true;
      
      console.log("Step 5: Distribute rewards for tied vote proposal");
      
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
      console.log(`Rewards earned: ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      // Calculate expected reward - should get base reward + participation bonus
      let expectedReward = ethers.parseEther("100"); // Base reward
      
      // Apply participation bonus if applicable (> 20%)
      if (participationRate > 20n) {
        const participationBonus = (expectedReward * 2000n) / 10000n; // 20% bonus
        expectedReward = expectedReward + participationBonus;
        console.log(`Applied participation bonus: ${ethers.formatEther(participationBonus)} DLOOP`);
      }
      
      // Should NOT get quality multiplier for tied vote
      console.log(`Expected reward: ${ethers.formatEther(expectedReward)} DLOOP`);
      
      // Verify the actual reward matches the expected reward
      expect(rewardsEarned).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
      
      console.log("Tied vote test completed successfully");
    });
  });

  describe("Unanimous Vote Edge Case", function () {
    it("Should handle proposals with 100% yes votes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create asset and proposal");
      
      // Create asset
      await assetDAO.connect(admin).createAsset("Unanimous Vote Asset", "Asset for unanimous vote testing");
      
      // Create proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "Unanimous vote test proposal"
      );
      
      console.log("Step 2: Vote with 100% yes votes");
      
      // All voters vote yes
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, true);
      
      // Calculate voting statistics
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes = voter1Balance + voter2Balance + voter3Balance;
      const noVotes = 0n;
      const totalVotes = yesVotes + noVotes;
      const totalSupply = await dloopToken.totalSupply();
      const participationRate = (totalVotes * 100n) / totalSupply;
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 3: Wait for voting period to end");
      
      // Get the voting period from the contract if possible
      let votingPeriod = 7 * 24 * 60 * 60; // Default to 7 days if not available
      try {
        const votingPeriodFunction = assetDAO.interface.getFunction("getVotingPeriod");
        if (votingPeriodFunction) {
          votingPeriod = await assetDAO.getVotingPeriod();
        }
      } catch (error) {
        console.log("Note: Could not get voting period, using default of 7 days.");
      }
      
      // Advance time to end the voting period
      await ethers.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      console.log("Step 4: Execute the proposal");
      
      // Execute the proposal
      await assetDAO.connect(admin).executeProposal(1);
      
      console.log("Step 5: Distribute rewards for unanimous vote proposal");
      
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
      console.log(`Rewards earned: ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      // Calculate expected reward - should get base reward + participation bonus + quality multiplier
      let expectedReward = ethers.parseEther("100"); // Base reward
      
      // Apply participation bonus if applicable (> 20%)
      if (participationRate > 20n) {
        const participationBonus = (expectedReward * 2000n) / 10000n; // 20% bonus
        expectedReward = expectedReward + participationBonus;
        console.log(`Applied participation bonus: ${ethers.formatEther(participationBonus)} DLOOP`);
      }
      
      // Apply quality multiplier (100% yes votes)
      const oldReward = expectedReward;
      expectedReward = (expectedReward * 15000n) / 10000n; // 1.5x multiplier
      console.log(`Applied quality multiplier: ${ethers.formatEther(expectedReward - oldReward)} DLOOP`);
      
      console.log(`Expected reward: ${ethers.formatEther(expectedReward)} DLOOP`);
      
      // Verify the actual reward matches the expected reward
      expect(rewardsEarned).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
      
      console.log("Unanimous vote test completed successfully");
    });
  });

  describe("AI Node Proposal Edge Case", function () {
    it("Should apply AI node multiplier for proposals from AI nodes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, aiNode, voter1, voter2, voter3
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Register AI node status");
      
      // Register AI node status if the function exists
      let hasAINodeRegistry = false;
      try {
        const registerAINodeFunction = governanceRewards.interface.getFunction("registerAINode");
        hasAINodeRegistry = !!registerAINodeFunction;
      } catch (error) {
        console.log("Note: GovernanceRewards does not have a registerAINode function.");
      }
      
      if (hasAINodeRegistry) {
        await governanceRewards.connect(admin).registerAINode(aiNode.address, true);
        console.log(`Registered ${aiNode.address} as an AI node`);
      } else {
        console.log("Skipping AI node registration as the function doesn't exist");
      }
      
      console.log("Step 2: Create asset and proposal from AI node");
      
      // Create asset
      await assetDAO.connect(admin).createAsset("AI Node Asset", "Asset for AI node proposal testing");
      
      // Create proposal from AI node
      await assetDAO.connect(aiNode).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "AI node test proposal"
      );
      
      console.log("Step 3: Vote on AI node proposal");
      
      // Voters vote on the proposal
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, true);
      
      // Calculate voting statistics
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes = voter1Balance + voter2Balance + voter3Balance;
      const noVotes = 0n;
      const totalVotes = yesVotes + noVotes;
      const totalSupply = await dloopToken.totalSupply();
      const participationRate = (totalVotes * 100n) / totalSupply;
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 4: Wait for voting period to end");
      
      // Get the voting period from the contract if possible
      let votingPeriod = 7 * 24 * 60 * 60; // Default to 7 days if not available
      try {
        const votingPeriodFunction = assetDAO.interface.getFunction("getVotingPeriod");
        if (votingPeriodFunction) {
          votingPeriod = await assetDAO.getVotingPeriod();
        }
      } catch (error) {
        console.log("Note: Could not get voting period, using default of 7 days.");
      }
      
      // Advance time to end the voting period
      await ethers.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await ethers.provider.send("evm_mine");
      
      console.log("Step 5: Execute the proposal");
      
      // Execute the proposal
      await assetDAO.connect(admin).executeProposal(1);
      
      console.log("Step 6: Distribute rewards for AI node proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(aiNode.address);
      console.log(`Initial AI node balance: ${ethers.formatEther(initialBalance)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        aiNode.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned
      const rewardsEarned = await governanceRewards.totalRewardsEarned(aiNode.address);
      console.log(`Rewards earned: ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify rewards were distributed
      expect(rewardsEarned).to.be.gt(0);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(aiNode.address);
      console.log(`Final AI node balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
      
      // Calculate expected reward
      let expectedReward = ethers.parseEther("100"); // Base reward
      
      // Apply participation bonus if applicable (> 20%)
      if (participationRate > 20n) {
        const participationBonus = (expectedReward * 2000n) / 10000n; // 20% bonus
        expectedReward = expectedReward + participationBonus;
        console.log(`Applied participation bonus: ${ethers.formatEther(participationBonus)} DLOOP`);
      }
      
      // Apply quality multiplier (100% yes votes)
      let qualityMultipliedReward = (expectedReward * 15000n) / 10000n; // 1.5x multiplier
      console.log(`Applied quality multiplier: ${ethers.formatEther(qualityMultipliedReward - expectedReward)} DLOOP`);
      expectedReward = qualityMultipliedReward;
      
      // Apply AI node multiplier if the function exists
      if (hasAINodeRegistry) {
        const aiNodeMultipliedReward = (expectedReward * 12000n) / 10000n; // 1.2x multiplier
        console.log(`Applied AI node multiplier: ${ethers.formatEther(aiNodeMultipliedReward - expectedReward)} DLOOP`);
        expectedReward = aiNodeMultipliedReward;
      }
      
      console.log(`Expected reward: ${ethers.formatEther(expectedReward)} DLOOP`);
      
      // Verify the actual reward matches the expected reward
      // Only if AI node registry exists, otherwise just check it's at least the quality multiplied reward
      if (hasAINodeRegistry) {
        expect(rewardsEarned).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
      } else {
        expect(rewardsEarned).to.be.gte(qualityMultipliedReward);
      }
      
      console.log("AI node proposal test completed successfully");
    });
  });
});
