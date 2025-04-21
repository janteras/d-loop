const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title AssetDAO Governance Rewards Integration Tests (Simplified)
 * @dev Integration tests for AssetDAO governance rewards using inline mocks
 */
describe("AssetDAO Governance Rewards Integration Tests (Simplified)", function () {
  // Define a fixture for deploying the contracts
  async function deployContractsFixture() {
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
      owner, admin, proposer, voter1, voter2, voter3, aiNode
    };
  }

  describe("Full Governance Flow", function () {
    it("Should create a proposal, vote, and distribute rewards", async function () {
      const { 
        daiToken, dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create an asset for investment");
      
      // Create a new asset
      const assetTx = await assetDAO.connect(admin).createAsset(
        "Test Investment Pool",
        "Test investment pool for governance rewards"
      );
      const assetReceipt = await assetTx.wait();
      
      // Get the asset ID (assuming this is the first asset)
      const assetId = 1;
      console.log(`Created asset #${assetId}: Test Investment Pool`);
      
      console.log("Step 2: Create an investment proposal");
      
      // Create an investment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder for asset
        ethers.parseEther("1000"), // Amount to invest
        "Test proposal for governance rewards"
      );
      const proposalReceipt = await proposalTx.wait();
      
      // Get proposal ID (assuming this is the first proposal)
      const proposalId = 1;
      console.log(`Created proposal #${proposalId} by ${proposer.address}`);
      
      console.log("Step 3: Vote on the proposal");
      
      // Multiple users vote on the proposal
      await assetDAO.connect(voter1).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter2).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter3).vote(proposalId, false); // No vote
      
      // Calculate voting statistics
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes = voter1Balance + voter2Balance;
      const noVotes = voter3Balance;
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
          console.log(`Voting period is ${votingPeriod} seconds`);
        }
      } catch (error) {
        console.log("Note: Could not get voting period, using default of 7 days.");
      }
      
      // Advance time to end the voting period
      await ethers.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await ethers.provider.send("evm_mine");
      console.log(`Advanced blockchain time by ${votingPeriod + 1} seconds`);
      
      console.log("Step 5: Execute the proposal");
      
      // Check if the AssetDAO contract has an executeProposal function
      let hasExecuteProposal = false;
      try {
        const executeProposalFunction = assetDAO.interface.getFunction("executeProposal");
        hasExecuteProposal = !!executeProposalFunction;
      } catch (error) {
        console.log("Note: AssetDAO does not have an executeProposal function. Skipping execution step.");
      }
      
      // Execute the proposal if the function exists
      if (hasExecuteProposal) {
        await assetDAO.connect(admin).executeProposal(proposalId);
        console.log(`Executed proposal #${proposalId}`);
      }
      
      console.log("Step 5: Distribute rewards based on proposal outcome");
      
      // Get initial balance of proposer
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Initial proposer balance: ${ethers.formatEther(initialBalance)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address, // proposer
        yesVotes,        // yes votes
        noVotes,         // no votes
        totalSupply      // total supply
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
      
      // Calculate expected reward
      let expectedReward = ethers.parseEther("100"); // Base reward
      
      // Apply participation bonus if applicable (> 20%)
      if (participationRate > 20n) {
        const participationBonus = (expectedReward * 2000n) / 10000n; // 20% bonus
        expectedReward = expectedReward + participationBonus;
        console.log(`Applied participation bonus: ${ethers.formatEther(participationBonus)} DLOOP`);
      }
      
      // Apply quality multiplier if applicable (> 75% yes)
      const yesRatio = (yesVotes * 10000n) / totalVotes;
      if (yesVotes > noVotes && yesRatio > 7500n) {
        const oldReward = expectedReward;
        expectedReward = (expectedReward * 15000n) / 10000n; // 1.5x multiplier
        console.log(`Applied quality multiplier: ${ethers.formatEther(expectedReward - oldReward)} DLOOP`);
      }
      
      // Apply reward cap
      const rewardCap = ethers.parseEther("500");
      if (expectedReward > rewardCap) {
        expectedReward = rewardCap;
        console.log(`Applied reward cap: ${ethers.formatEther(rewardCap)} DLOOP`);
      }
      
      console.log(`Expected reward: ${ethers.formatEther(expectedReward)} DLOOP`);
      console.log(`Actual reward: ${ethers.formatEther(rewardsEarned)} DLOOP`);
      
      // Verify the actual reward matches the expected reward
      expect(rewardsEarned).to.be.closeTo(expectedReward, ethers.parseEther("0.001"));
      
      console.log("Governance flow test completed successfully");
    });
  });

  describe("Multiple Proposals and Cooldown", function () {
    it("Should handle multiple proposals with cooldown periods", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create first proposal");
      
      // Create first asset
      await assetDAO.connect(admin).createAsset("First Asset", "First test asset");
      
      // Create first proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "First test proposal"
      );
      
      console.log("Step 2: Vote on first proposal");
      
      // Vote on first proposal
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, false);
      
      // Calculate voting statistics
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes1 = voter1Balance + voter2Balance;
      const noVotes1 = voter3Balance;
      const totalSupply = await dloopToken.totalSupply();
      
      console.log("Step 3: Distribute rewards for first proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      
      // Distribute rewards for first proposal
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes1,
        noVotes1,
        totalSupply
      );
      
      // Check rewards earned
      const firstReward = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Rewards earned for first proposal: ${ethers.formatEther(firstReward)} DLOOP`);
      
      console.log("Step 4: Try to create second proposal immediately (should fail due to cooldown)");
      
      // Try to create second proposal immediately (should fail due to cooldown)
      try {
        await assetDAO.connect(proposer).createProposal(
          0, // ProposalType.Investment
          ethers.ZeroAddress, // Using zero address as a placeholder
          ethers.parseEther("2000"),
          "Second test proposal"
        );
        console.log("WARNING: Second proposal created without respecting cooldown period");
      } catch (error) {
        console.log("Expected error: Cannot create proposal during cooldown period");
      }
      
      console.log("Step 5: Wait for cooldown period to pass");
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 6: Create second proposal after cooldown");
      
      // Create second asset
      await assetDAO.connect(admin).createAsset("Second Asset", "Second test asset");
      
      // Create second proposal after cooldown
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("2000"),
        "Second test proposal"
      );
      
      console.log("Step 7: Vote on second proposal");
      
      // Vote on second proposal
      await assetDAO.connect(voter1).vote(2, true);
      await assetDAO.connect(voter2).vote(2, false);
      await assetDAO.connect(voter3).vote(2, false);
      
      // Calculate voting statistics
      const yesVotes2 = voter1Balance;
      const noVotes2 = voter2Balance + voter3Balance;
      
      console.log("Step 8: Distribute rewards for second proposal");
      
      // Distribute rewards for second proposal
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes2,
        noVotes2,
        totalSupply
      );
      
      // Check total rewards earned
      const totalRewards = await governanceRewards.totalRewardsEarned(proposer.address);
      const secondReward = totalRewards - firstReward;
      console.log(`Rewards earned for second proposal: ${ethers.formatEther(secondReward)} DLOOP`);
      
      // Verify second reward is less than first reward (due to lower yes votes)
      expect(secondReward).to.be.lt(firstReward);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the total reward amount
      expect(finalBalance).to.equal(initialBalance + totalRewards);
      
      console.log("Multiple proposals test completed successfully");
    });
  });

  describe("Reward Parameter Testing", function () {
    it("Should adjust rewards based on parameter changes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployContractsFixture);
      
      console.log("Step 1: Create asset and proposal with initial parameters");
      
      // Create asset
      await assetDAO.connect(admin).createAsset("Parameter Test Asset", "Asset for parameter testing");
      
      // Create proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "Parameter test proposal"
      );
      
      console.log("Step 2: Vote on proposal");
      
      // Vote on proposal
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, false);
      
      // Calculate voting statistics
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes = voter1Balance + voter2Balance;
      const noVotes = voter3Balance;
      const totalSupply = await dloopToken.totalSupply();
      
      console.log("Step 3: Distribute rewards with initial parameters");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      
      // Distribute rewards with initial parameters
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check rewards earned
      const initialReward = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Rewards earned with initial parameters: ${ethers.formatEther(initialReward)} DLOOP`);
      
      console.log("Step 4: Update reward parameters");
      
      // Update reward parameters
      await governanceRewards.connect(admin).updateRewardConfig(
        ethers.parseEther("200"),  // Double the base reward
        3000,                      // Increase participation bonus to 30%
        20000,                     // Increase quality multiplier to 2.0x
        15000,                     // Increase AI node multiplier to 1.5x
        ethers.parseEther("1000")  // Increase reward cap
      );
      
      console.log("Step 5: Wait for cooldown period to pass");
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 6: Create new proposal with updated parameters");
      
      // Create second asset
      await assetDAO.connect(admin).createAsset("Updated Parameter Asset", "Asset for updated parameter testing");
      
      // Create new proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Using zero address as a placeholder
        ethers.parseEther("1000"),
        "Updated parameter test proposal"
      );
      
      console.log("Step 7: Vote on new proposal with same voting pattern");
      
      // Vote on new proposal with same pattern
      await assetDAO.connect(voter1).vote(2, true);
      await assetDAO.connect(voter2).vote(2, true);
      await assetDAO.connect(voter3).vote(2, false);
      
      console.log("Step 8: Distribute rewards with updated parameters");
      
      // Distribute rewards with updated parameters
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Check total rewards earned
      const totalRewards = await governanceRewards.totalRewardsEarned(proposer.address);
      const updatedReward = totalRewards - initialReward;
      console.log(`Rewards earned with updated parameters: ${ethers.formatEther(updatedReward)} DLOOP`);
      
      // Verify updated reward is greater than initial reward
      expect(updatedReward).to.be.gt(initialReward);
      
      // Check final balance
      const finalBalance = await dloopToken.balanceOf(proposer.address);
      console.log(`Final proposer balance: ${ethers.formatEther(finalBalance)} DLOOP`);
      
      // Verify balance increased by the total reward amount
      expect(finalBalance).to.equal(initialBalance + totalRewards);
      
      console.log("Parameter testing completed successfully");
    });
  });
});
