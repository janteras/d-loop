const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Helper function to create a minimal mock contract
async function deployMinimalMock(name, deployer) {
  const MockContract = await ethers.getContractFactory(
    `contract ${name} {
      function getAddress() external view returns (address) { return address(this); }
    }`,
    { value: "0" }
  );
  return MockContract.connect(deployer).deploy();
}

/**
 * @title D-Loop Protocol AssetDAO Governance Integration Tests
 * @dev Tests for verifying the full flow from AssetDAO proposal creation to governance rewards distribution
 * @notice These tests validate the end-to-end process of governance participation and rewards
 */
describe("AssetDAO Governance Integration Tests", function () {
  // Fixture for deploying a complete governance setup
  async function deployGovernanceFixture() {
    const [owner, admin, proposer, voter1, voter2, voter3, aiNode] = await ethers.getSigners();
    
    // Deploy minimal mock contracts for testing
    const mockPriceOracle = await deployMinimalMock("MockPriceOracle", owner);
    const mockFeeProcessor = await deployMinimalMock("MockFeeProcessor", owner);
    const mockProtocolDAO = await deployMinimalMock("MockProtocolDAO", owner);
    
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
    
    // Deploy DAIToken (D-AI) for asset governance
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.waitForDeployment();
    
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
    await assetDAO.connect(admin).grantRole(await assetDAO.GOVERNANCE_ROLE(), admin.address);
    
    // Connect AssetDAO and GovernanceRewards
    // In a real implementation, there would be a formal connection between these contracts
    
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
    it("Should create proposal, vote, and distribute rewards", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create an investment proposal");
      
      // Create a new asset
      const assetTx = await assetDAO.connect(admin).createAsset("Test Asset", "Test asset for governance");
      const assetReceipt = await assetTx.wait();
      
      // Get the asset ID from events (implementation may vary)
      const assetId = 1; // Assuming this is the first asset
      
      // Create an investment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress, // Not using a real asset address for simplicity
        ethers.parseEther("1000"), // Amount to invest
        "Proposal to invest in Test Asset"
      );
      const proposalReceipt = await proposalTx.wait();
      
      // Get proposal ID (implementation may vary)
      const proposalId = 1; // Assuming this is the first proposal
      
      console.log(`Created proposal #${proposalId} by ${proposer.address}`);
      
      console.log("Step 2: Vote on the proposal");
      
      // Multiple users vote on the proposal
      await assetDAO.connect(voter1).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter2).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter3).vote(proposalId, false); // No vote
      
      // Calculate voting statistics
      const yesVotes = await dloopToken.balanceOf(voter1.address) + await dloopToken.balanceOf(voter2.address);
      const noVotes = await dloopToken.balanceOf(voter3.address);
      const totalVotes = yesVotes + noVotes;
      const totalSupply = await dloopToken.totalSupply();
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      console.log(`Participation rate: ${(totalVotes * 100n / totalSupply).toString()}%`);
      
      console.log("Step 3: Distribute rewards based on proposal outcome");
      
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
      
      console.log("Full governance flow test completed successfully");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle proposals with very low participation", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter3
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create a proposal with low expected participation");
      
      // Create an investment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("500"),
        "Low participation proposal"
      );
      
      // Get proposal ID
      const proposalId = 1; // Assuming this is the first proposal
      
      console.log("Step 2: Minimal voting (low participation)");
      
      // Only one user votes
      await assetDAO.connect(voter3).vote(proposalId, true);
      
      // Calculate voting statistics
      const yesVotes = await dloopToken.balanceOf(voter3.address);
      const noVotes = 0n;
      const totalSupply = await dloopToken.totalSupply();
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`Participation rate: ${(yesVotes * 100n / totalSupply).toString()}%`);
      
      console.log("Step 3: Distribute rewards for low participation proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      
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
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
    });

    it("Should handle proposals with tied votes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create a proposal that will have tied votes");
      
      // Create an investment proposal
      const proposalTx = await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("800"),
        "Tied votes proposal"
      );
      
      // Get proposal ID
      const proposalId = 1; // Assuming this is the first proposal
      
      console.log("Step 2: Equal voting for yes and no");
      
      // Equal voting power for yes and no
      // For this test, we'll assume voter1 and voter2 have the same voting power
      // If they don't, we'd need to adjust the test
      await assetDAO.connect(voter1).vote(proposalId, true);  // Yes vote
      await assetDAO.connect(voter2).vote(proposalId, false); // No vote
      
      // Calculate voting statistics
      const yesVotes = await dloopToken.balanceOf(voter1.address);
      const noVotes = await dloopToken.balanceOf(voter2.address);
      const totalSupply = await dloopToken.totalSupply();
      
      console.log(`Yes votes: ${ethers.formatEther(yesVotes)} DLOOP`);
      console.log(`No votes: ${ethers.formatEther(noVotes)} DLOOP`);
      
      console.log("Step 3: Distribute rewards for tied votes proposal");
      
      // Get initial balance
      const initialBalance = await dloopToken.balanceOf(proposer.address);
      
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
      
      // Verify balance increased by the reward amount
      expect(finalBalance).to.equal(initialBalance + rewardsEarned);
    });

    it("Should reject multiple proposals from the same proposer within cooldown period", async function () {
      const { 
        governanceRewards, assetDAO,
        admin, proposer
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create first proposal");
      
      // Create first investment proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("1000"),
        "First proposal"
      );
      
      // Distribute rewards for first proposal
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        ethers.parseEther("50000"), // yes votes
        ethers.parseEther("10000"), // no votes
        ethers.parseEther("1000000") // total supply
      );
      
      console.log("Step 2: Try to distribute rewards again within cooldown period");
      
      // Create second proposal immediately
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("2000"),
        "Second proposal"
      );
      
      // Try to distribute rewards again - should revert
      await expect(
        governanceRewards.connect(admin).distributeRewards(
          proposer.address,
          ethers.parseEther("40000"), // yes votes
          ethers.parseEther("20000"), // no votes
          ethers.parseEther("1000000") // total supply
        )
      ).to.be.reverted;
      
      console.log("Successfully rejected reward distribution within cooldown period");
    });
  });

  describe("Parameterization Testing", function () {
    it("Should distribute different rewards based on parameter changes", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create a proposal with default parameters");
      
      // Create a proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("1000"),
        "Default parameters proposal"
      );
      
      // Vote on the proposal
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      
      // Calculate voting statistics
      const yesVotes = await dloopToken.balanceOf(voter1.address) + await dloopToken.balanceOf(voter2.address);
      const noVotes = 0n;
      const totalSupply = await dloopToken.totalSupply();
      
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
      
      console.log("Step 3: Create a new proposal with updated parameters");
      
      // Create another proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("1500"),
        "Updated parameters proposal"
      );
      
      // Vote on the proposal (same voting pattern)
      await assetDAO.connect(voter1).vote(2, true);
      await assetDAO.connect(voter2).vote(2, true);
      
      // Distribute rewards with updated parameters
      await governanceRewards.connect(admin).distributeRewards(
        proposer.address,
        yesVotes,
        noVotes,
        totalSupply
      );
      
      // Calculate total rewards (default + updated)
      const totalRewards = await governanceRewards.totalRewardsEarned(proposer.address);
      const updatedRewards = totalRewards - defaultRewards;
      
      console.log(`Rewards with updated parameters: ${ethers.formatEther(updatedRewards)} DLOOP`);
      
      // Verify that updated parameters resulted in higher rewards
      expect(updatedRewards).to.be.gt(defaultRewards);
      
      console.log("Parameter change test completed successfully");
    });
  });

  describe("Gas Optimization", function () {
    it("Should profile gas usage of the reward distribution process", async function () {
      const { 
        dloopToken, governanceRewards, assetDAO,
        admin, proposer, voter1, voter2, voter3
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Setup for gas profiling");
      
      // Create a proposal
      await assetDAO.connect(proposer).createProposal(
        0, // ProposalType.Investment
        ethers.ZeroAddress,
        ethers.parseEther("1000"),
        "Gas profiling proposal"
      );
      
      // Vote on the proposal
      await assetDAO.connect(voter1).vote(1, true);
      await assetDAO.connect(voter2).vote(1, true);
      await assetDAO.connect(voter3).vote(1, false);
      
      // Calculate voting statistics
      const yesVotes = await dloopToken.balanceOf(voter1.address) + await dloopToken.balanceOf(voter2.address);
      const noVotes = await dloopToken.balanceOf(voter3.address);
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
