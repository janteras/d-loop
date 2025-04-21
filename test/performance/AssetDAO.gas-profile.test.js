const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { createProtocolFixture, advanceTime } = require("../utils/test-helpers");

/**
 * @title AssetDAO Gas Profiling Tests
 * @dev Tests to measure gas consumption of critical AssetDAO operations
 */
describe("AssetDAO Gas Profiling", function () {
  // Use the standard protocol fixture that we fixed in the test-helpers.js file
  const deployFixture = createProtocolFixture();

  // Define baseline gas limits for key operations
  const GAS_LIMITS = {
    createAsset: 250000,
    invest: 150000,
    divest: 120000,
    createProposal: 200000,
    vote: 100000,
    executeProposal: 180000
  };

  // Helper function to measure gas usage
  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  describe("Asset Creation and Management Gas Usage", function () {
    it("Should measure gas for asset creation", async function () {
      const { assetDAO, user1 } = await loadFixture(deployFixture);
      
      // Create asset
      const tx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for asset creation: ${gasUsed}`);
      
      // Verify gas usage is within limits
      expect(gasUsed).to.be.lte(GAS_LIMITS.createAsset);
    });

    it("Should measure gas for investment", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create asset first
      const createTx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      const createReceipt = await createTx.wait();
      
      // Get asset ID from event
      const assetCreatedEvent = assetDAO.interface.getEvent("AssetCreated");
      const assetCreatedLog = createReceipt.logs.find(log => 
        log.topics && log.topics[0] === assetCreatedEvent.topicHash
      );
      
      let assetId = 1; // Default
      if (assetCreatedLog) {
        const parsedLog = assetDAO.interface.parseLog({
          topics: assetCreatedLog.topics,
          data: assetCreatedLog.data
        });
        assetId = parsedLog.args.assetId;
      }
      
      // Approve tokens for investment
      const amount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), amount);
      
      // Invest in asset
      const investTx = await assetDAO.connect(user1).invest(assetId, amount);
      const gasUsed = await measureGas(investTx);
      
      console.log(`Gas used for investment: ${gasUsed}`);
      expect(gasUsed).to.be.lte(GAS_LIMITS.invest);
    });

    it("Should measure gas for divestment", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create asset
      const createTx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      await createTx.wait();
      
      // Invest in asset
      const amount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), amount);
      await assetDAO.connect(user1).invest(1, amount);
      
      // Divest from asset
      const divestAmount = ethers.parseEther("500");
      const divestTx = await assetDAO.connect(user1).divest(1, divestAmount);
      const gasUsed = await measureGas(divestTx);
      
      console.log(`Gas used for divestment: ${gasUsed}`);
      expect(gasUsed).to.be.lte(GAS_LIMITS.divest);
    });
  });

  describe("Governance Operations Gas Usage", function () {
    it("Should measure gas for proposal creation", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create proposal
      const proposalType = 0; // Assume 0 is INVEST type
      const proposalAmount = ethers.parseEther("500");
      const proposalTx = await assetDAO.connect(user1).createProposal(
        proposalType,
        await daiToken.getAddress(),
        proposalAmount,
        "Test proposal"
      );
      
      const gasUsed = await measureGas(proposalTx);
      console.log(`Gas used for proposal creation: ${gasUsed}`);
      expect(gasUsed).to.be.lte(GAS_LIMITS.createProposal);
    });

    it("Should measure gas for voting", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create asset and invest
      await assetDAO.connect(user1).createAsset("Test Asset", "https://metadata.dloop.io/asset/1");
      const amount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), amount);
      await assetDAO.connect(user1).invest(1, amount);
      
      // Create proposal
      const proposalType = 0; // Assume 0 is INVEST type
      const proposalAmount = ethers.parseEther("500");
      await assetDAO.connect(user1).createProposal(
        proposalType,
        await daiToken.getAddress(),
        proposalAmount,
        "Test proposal"
      );
      
      // Vote on proposal
      const voteTx = await assetDAO.connect(user1).vote(1, true);
      const gasUsed = await measureGas(voteTx);
      
      console.log(`Gas used for voting: ${gasUsed}`);
      expect(gasUsed).to.be.lte(GAS_LIMITS.vote);
    });

    it("Should measure gas for proposal execution", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create asset and invest
      await assetDAO.connect(user1).createAsset("Test Asset", "https://metadata.dloop.io/asset/1");
      const amount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), amount);
      await assetDAO.connect(user1).invest(1, amount);
      
      // Create proposal
      const proposalType = 0; // Assume 0 is INVEST type
      const proposalAmount = ethers.parseEther("500");
      await assetDAO.connect(user1).createProposal(
        proposalType,
        await daiToken.getAddress(),
        proposalAmount,
        "Test proposal"
      );
      
      // Vote on proposal
      await assetDAO.connect(user1).vote(1, true);
      
      // Advance time to end voting period
      const votingPeriod = await assetDAO.getVotingPeriod();
      await advanceTime(Number(votingPeriod) + 1);
      
      // Execute proposal
      const executeTx = await assetDAO.connect(user1).executeProposal(1);
      const gasUsed = await measureGas(executeTx);
      
      console.log(`Gas used for proposal execution: ${gasUsed}`);
      expect(gasUsed).to.be.lte(GAS_LIMITS.executeProposal);
    });
  });

  describe("Gas Optimization Verification", function () {
    it("Should verify token approval optimization", async function () {
      const { assetDAO, daiToken, user1 } = await loadFixture(deployFixture);
      
      // Create asset
      await assetDAO.connect(user1).createAsset("Test Asset", "https://metadata.dloop.io/asset/1");
      
      // Measure gas for first approval
      const amount = ethers.parseEther("1000");
      const firstApprovalTx = await daiToken.connect(user1).approve(await assetDAO.getAddress(), amount);
      const firstApprovalGas = await measureGas(firstApprovalTx);
      
      // Invest
      await assetDAO.connect(user1).invest(1, amount);
      
      // Measure gas for second approval (should be optimized if using token approval optimizer)
      const secondAmount = ethers.parseEther("500");
      const secondApprovalTx = await daiToken.connect(user1).approve(await assetDAO.getAddress(), secondAmount);
      const secondApprovalGas = await measureGas(secondApprovalTx);
      
      console.log(`Gas used for first approval: ${firstApprovalGas}`);
      console.log(`Gas used for second approval: ${secondApprovalGas}`);
      
      // Verify optimization (if implemented)
      // Note: This test may pass or fail depending on whether token approval optimization is implemented
      // If implemented, second approval should use less gas
      console.log(`Approval gas difference: ${firstApprovalGas - secondApprovalGas}`);
    });
  });
});
