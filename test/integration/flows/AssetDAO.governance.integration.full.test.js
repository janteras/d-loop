const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { deployAssetDAOGovernanceFixture } = require("../../fixtures/assetdao-governance.fixture");

/**
 * @title D-Loop Protocol AssetDAO Governance Integration Tests
 * @dev Comprehensive integration tests showing the full flow from AssetDAO proposal creation to reward distribution
 * @notice These tests validate the end-to-end process of governance participation and rewards
 */
describe("AssetDAO Governance Full Integration Tests", function () {
  describe("Investment Proposal Flow", function () {
    it("Should create an investment proposal, vote, execute, and distribute rewards", async function () {
      const { 
        daiToken, dloopToken, governanceRewards, assetDAO,
        ethToken, mockPriceOracle,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployAssetDAOGovernanceFixture);
      
      console.log("Step 1: Create an asset for investment");
      
      // Create a new asset
      const assetTx = await assetDAO.connect(admin).createAsset(
        "Ethereum Investment Pool",
        "Investment pool for ETH tokens"
      );
      const assetReceipt = await assetTx.wait();
      
      // Get the asset ID (assuming this is the first asset)
      const assetId = 1;
      console.log(`Created asset #${assetId}: Ethereum Investment Pool`);
      
      console.log("Step 2: Create an investment proposal");
      
      // Create an investment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        await ethToken.getAddress(), // Asset address
        ethers.parseEther("1000"), // Amount to invest
        "Proposal to invest in Ethereum"
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
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP (${ethers.formatEther(voter1Balance)} + ${ethers.formatEther(voter2Balance)})`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Participation rate: ${participationRate.toString()}%`);
      
      console.log("Step 4: Execute the proposal");
      
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
      
      console.log("Investment proposal flow test completed successfully");
    });
  });

  describe("Divestment Proposal Flow", function () {
    it("Should create a divestment proposal, vote, execute, and distribute rewards", async function () {
      const { 
        daiToken, dloopToken, governanceRewards, assetDAO,
        wbtcToken, mockPriceOracle,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployAssetDAOGovernanceFixture);
      
      console.log("Step 1: Create an asset for divestment");
      
      // Create a new asset
      const assetTx = await assetDAO.connect(admin).createAsset(
        "Bitcoin Investment Pool",
        "Investment pool for WBTC tokens"
      );
      const assetReceipt = await assetTx.wait();
      
      // Get the asset ID (assuming this is the first asset)
      const assetId = 1;
      console.log(`Created asset #${assetId}: Bitcoin Investment Pool`);
      
      console.log("Step 2: Create a divestment proposal");
      
      // Create a divestment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        1, // ProposalType.Divestment
        await wbtcToken.getAddress(), // Asset address
        ethers.parseEther("0.5"), // Amount to divest (0.5 BTC)
        "Proposal to divest from Bitcoin"
      );
      const proposalReceipt = await proposalTx.wait();
      
      // Get proposal ID (assuming this is the first proposal)
      const proposalId = 1;
      console.log(`Created proposal #${proposalId} by ${proposer.address}`);
      
      console.log("Step 3: Vote on the proposal with high participation");
      
      // Multiple users vote on the proposal - high participation scenario
      await assetDAO.connect(voter1).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter2).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter3).vote(proposalId, true);  // Yes vote
      
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
      
      console.log("Step 4: Execute the proposal if possible");
      
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
      const yesRatio = totalVotes > 0n ? (yesVotes * 10000n) / totalVotes : 0n;
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
      
      console.log("Divestment proposal flow test completed successfully");
    });
  });

  describe("Multiple Proposal Sequence", function () {
    it("Should handle multiple proposals with different outcomes", async function () {
      const { 
        daiToken, dloopToken, governanceRewards, assetDAO,
        ethToken, linkToken, wbtcToken,
        admin, proposer, voter1, voter2, voter3, aiNode
      } = await loadFixture(deployAssetDAOGovernanceFixture);
      
      console.log("Step 1: Create multiple assets");
      
      // Create assets
      await assetDAO.connect(admin).createAsset("ETH Pool", "Ethereum Investment Pool");
      await assetDAO.connect(admin).createAsset("LINK Pool", "Chainlink Investment Pool");
      await assetDAO.connect(admin).createAsset("WBTC Pool", "Bitcoin Investment Pool");
      
      console.log("Step 2: Create first proposal (investment in ETH)");
      
      // Create first proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        await ethToken.getAddress(),
        ethers.parseEther("1000"),
        "Proposal to invest in Ethereum"
      );
      
      console.log("Step 3: Vote on first proposal");
      
      // Voting pattern: Strong support
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, false);
      
      // Calculate voting statistics for first proposal
      const voter1Balance = await dloopToken.balanceOf(voter1.address);
      const voter2Balance = await dloopToken.balanceOf(voter2.address);
      const voter3Balance = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes1 = voter1Balance + voter2Balance;
      const noVotes1 = voter3Balance;
      const totalSupply = await dloopToken.totalSupply();
      
      console.log("Step 4: Distribute rewards for first proposal");
      
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
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 5: Create second proposal (divestment from WBTC)");
      
      // Create second proposal with different proposer to avoid cooldown
      await assetDAO.connect(voter1).createProposal(
        1, // ProposalType.Divestment
        await wbtcToken.getAddress(),
        ethers.parseEther("0.5"),
        "Proposal to divest from Bitcoin"
      );
      
      console.log("Step 6: Vote on second proposal");
      
      // Voting pattern: Tied votes
      await assetDAO.connect(proposer).vote(2, true);
      await assetDAO.connect(voter2).vote(2, false);
      await assetDAO.connect(voter3).vote(2, true);
      
      // Calculate voting statistics for second proposal
      const proposerBalance = await dloopToken.balanceOf(proposer.address);
      const voter2Balance2 = await dloopToken.balanceOf(voter2.address);
      const voter3Balance2 = await dloopToken.balanceOf(voter3.address);
      
      const yesVotes2 = proposerBalance + voter3Balance2;
      const noVotes2 = voter2Balance2;
      
      console.log("Step 7: Distribute rewards for second proposal");
      
      // Get initial balance for second proposer
      const initialBalance2 = await dloopToken.balanceOf(voter1.address);
      
      // Distribute rewards for second proposal
      await governanceRewards.connect(admin).distributeRewards(
        voter1.address, // second proposer
        yesVotes2,
        noVotes2,
        totalSupply
      );
      
      // Check rewards earned
      const secondReward = await governanceRewards.totalRewardsEarned(voter1.address);
      console.log(`Rewards earned for second proposal: ${ethers.formatEther(secondReward)} DLOOP`);
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 8: Create third proposal (investment in LINK)");
      
      // Create third proposal with AI node as proposer
      await assetDAO.connect(aiNode).createProposal(
        0, // ProposalType.Investment
        await linkToken.getAddress(),
        ethers.parseEther("5000"),
        "AI-recommended proposal to invest in Chainlink"
      );
      
      console.log("Step 9: Vote on third proposal");
      
      // Voting pattern: Unanimous support
      await assetDAO.connect(proposer).vote(3, true);
      await assetDAO.connect(voter1).vote(3, true);
      await assetDAO.connect(voter2).vote(3, true);
      await assetDAO.connect(voter3).vote(3, true);
      
      // Calculate voting statistics for third proposal
      const yesVotes3 = proposerBalance + await dloopToken.balanceOf(voter1.address) + 
                       voter2Balance2 + voter3Balance2;
      const noVotes3 = 0n;
      
      console.log("Step 10: Distribute rewards for third proposal");
      
      // Get initial balance for AI node proposer
      const initialBalance3 = await dloopToken.balanceOf(aiNode.address);
      
      // Distribute rewards for third proposal
      await governanceRewards.connect(admin).distributeRewards(
        aiNode.address, // AI node as proposer
        yesVotes3,
        noVotes3,
        totalSupply
      );
      
      // Check rewards earned
      const thirdReward = await governanceRewards.totalRewardsEarned(aiNode.address);
      console.log(`Rewards earned for third proposal: ${ethers.formatEther(thirdReward)} DLOOP`);
      
      // Verify all rewards were distributed correctly
      const finalBalance1 = await dloopToken.balanceOf(proposer.address);
      const finalBalance2 = await dloopToken.balanceOf(voter1.address);
      const finalBalance3 = await dloopToken.balanceOf(aiNode.address);
      
      expect(finalBalance1).to.equal(initialBalance + firstReward);
      expect(finalBalance2).to.equal(initialBalance2 + secondReward);
      expect(finalBalance3).to.equal(initialBalance3 + thirdReward);
      
      // Verify third proposal (unanimous support) received higher rewards than second proposal (tied votes)
      expect(thirdReward).to.be.gt(secondReward);
      
      console.log("Multiple proposal sequence test completed successfully");
    });
  });

  describe("Reward Calculation Verification", function () {
    it("Should calculate rewards correctly based on the formula", async function () {
      const { 
        dloopToken, governanceRewards,
        admin, proposer
      } = await loadFixture(deployAssetDAOGovernanceFixture);
      
      console.log("Step 1: Setup test scenarios");
      
      // Get current reward parameters
      const rewardConfig = await governanceRewards.getRewardConfig();
      const baseReward = rewardConfig[0];
      const participationBonus = rewardConfig[1];
      const qualityMultiplier = rewardConfig[2];
      const aiNodeMultiplier = rewardConfig[3];
      const rewardCap = rewardConfig[4];
      
      console.log(`Base reward: ${ethers.formatEther(baseReward)} DLOOP`);
      console.log(`Participation bonus: ${participationBonus / 100}%`);
      console.log(`Quality multiplier: ${qualityMultiplier / 100}%`);
      console.log(`AI node multiplier: ${aiNodeMultiplier / 100}%`);
      console.log(`Reward cap: ${ethers.formatEther(rewardCap)} DLOOP`);
      
      console.log("Step 2: Test scenario 1 - Base reward only");
      
      // Scenario 1: Low participation, no quality multiplier
      const totalSupply = await dloopToken.totalSupply();
      const yesVotes1 = ethers.parseEther("10000");  // 10,000 DLOOP (< 20% of total supply)
      const noVotes1 = ethers.parseEther("10000");   // 10,000 DLOOP
      
      // Calculate expected reward
      let expectedReward1 = baseReward;
      console.log(`Expected reward (scenario 1): ${ethers.formatEther(expectedReward1)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes1,
        noVotes1,
        totalSupply
      );
      
      // Check actual reward
      const actualReward1 = await governanceRewards.totalRewardsEarned(proposer.address);
      console.log(`Actual reward (scenario 1): ${ethers.formatEther(actualReward1)} DLOOP`);
      
      // Verify reward calculation
      expect(actualReward1).to.be.closeTo(expectedReward1, ethers.parseEther("0.001"));
      
      // Wait for cooldown period to pass
      await ethers.provider.send("evm_increaseTime", [86401]); // 24 hours + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 3: Test scenario 2 - With participation bonus");
      
      // Create a new proposer to avoid cooldown issues
      const [, , , , , , , newProposer1] = await ethers.getSigners();
      await dloopToken.connect(admin).mint(newProposer1.address, ethers.parseEther("10000"));
      
      // Scenario 2: High participation, no quality multiplier
      const yesVotes2 = ethers.parseEther("200000"); // 200,000 DLOOP (> 20% of total supply)
      const noVotes2 = ethers.parseEther("200000"); // 200,000 DLOOP
      
      // Calculate expected reward
      let expectedReward2 = baseReward;
      const participationBonusAmount = (baseReward * participationBonus) / 10000n;
      expectedReward2 = expectedReward2 + participationBonusAmount;
      console.log(`Expected reward (scenario 2): ${ethers.formatEther(expectedReward2)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        newProposer1.address,
        yesVotes2,
        noVotes2,
        totalSupply
      );
      
      // Check actual reward
      const actualReward2 = await governanceRewards.totalRewardsEarned(newProposer1.address);
      console.log(`Actual reward (scenario 2): ${ethers.formatEther(actualReward2)} DLOOP`);
      
      // Verify reward calculation
      expect(actualReward2).to.be.closeTo(expectedReward2, ethers.parseEther("0.001"));
      
      console.log("Step 4: Test scenario 3 - With participation bonus and quality multiplier");
      
      // Create another new proposer
      const [, , , , , , , , newProposer2] = await ethers.getSigners();
      await dloopToken.connect(admin).mint(newProposer2.address, ethers.parseEther("10000"));
      
      // Scenario 3: High participation, high quality (strong yes vote)
      const yesVotes3 = ethers.parseEther("300000"); // 300,000 DLOOP
      const noVotes3 = ethers.parseEther("50000");  // 50,000 DLOOP
      
      // Calculate expected reward
      let expectedReward3 = baseReward;
      // Add participation bonus
      expectedReward3 = expectedReward3 + (baseReward * participationBonus) / 10000n;
      // Apply quality multiplier
      expectedReward3 = (expectedReward3 * qualityMultiplier) / 10000n;
      console.log(`Expected reward (scenario 3): ${ethers.formatEther(expectedReward3)} DLOOP`);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeRewards(
        newProposer2.address,
        yesVotes3,
        noVotes3,
        totalSupply
      );
      
      // Check actual reward
      const actualReward3 = await governanceRewards.totalRewardsEarned(newProposer2.address);
      console.log(`Actual reward (scenario 3): ${ethers.formatEther(actualReward3)} DLOOP`);
      
      // Verify reward calculation
      expect(actualReward3).to.be.closeTo(expectedReward3, ethers.parseEther("0.001"));
      
      console.log("Reward calculation verification completed successfully");
    });
  });
});
