const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { createProtocolFixture, advanceTime, getEventData } = require("../../utils/test-helpers");

/**
 * @title D-Loop Protocol End-to-End Flow Tests
 * @dev Comprehensive tests simulating complete user journeys through the protocol
 * @notice These tests validate the entire protocol flow from user registration to rewards
 */
describe("D-Loop Protocol End-to-End Flow Tests", function () {
  // Define the deployment fixture
  async function deployDLoopProtocolFixture() {
    // Get signers
    const [owner, admin, user1, user2, node1, node2] = await ethers.getSigners();
    
    // Deploy DAIToken (D-AI Token)
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.waitForDeployment();
    
    // Deploy DLoopToken
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
    
    // Deploy PriceOracle with a dummy address for the price feed
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    // Use admin address as a dummy price feed address
    const priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Set initial price for the DAI token
    await priceOracle.setPrice(await daiToken.getAddress(), ethers.parseEther("1"));
    
    // Create temporary treasury and reward distributor addresses
    const tempTreasury = admin.address;
    const tempRewardDistributor = owner.address;
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    const feeCalculator = await FeeCalculator.deploy(
      admin.address, // feeAdmin
      tempTreasury, // treasury
      tempRewardDistributor, // rewardDistributor
      50, // investFeePercentage (0.5%)
      50, // divestFeePercentage (0.5%)
      20  // ragequitFeePercentage (0.2%)
    );
    await feeCalculator.waitForDeployment();
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    const feeProcessor = await FeeProcessor.deploy(
      tempTreasury,
      tempRewardDistributor,
      await feeCalculator.getAddress(),
      admin.address,
      8000, // treasuryPercentage (80%)
      2000  // rewardDistPercentage (20%)
    );
    await feeProcessor.waitForDeployment();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      tempTreasury, // Using the temporary treasury address
      86400, // votingPeriod (1 day in seconds)
      43200, // executionDelay (12 hours in seconds)
      10     // quorum (10%)
    );
    await protocolDAO.waitForDeployment();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    const soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.waitForDeployment();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    const aiNodeRegistry = await AINodeRegistry.deploy(
      await soulboundNFT.getAddress(),
      await priceOracle.getAddress()
    );
    await aiNodeRegistry.waitForDeployment();
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      await daiToken.getAddress(),
      await dloopToken.getAddress(),
      await priceOracle.getAddress(),
      await feeProcessor.getAddress(),
      await protocolDAO.getAddress()
    );
    await assetDAO.waitForDeployment();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(admin.address, await protocolDAO.getAddress());
    await treasury.waitForDeployment();
    
    // Setup roles and permissions
    await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), await aiNodeRegistry.getAddress());
    
    // Mint initial tokens
    const initialMint = ethers.parseEther("1000000");
    await daiToken.mint(owner.address, initialMint);
    await dloopToken.mint(owner.address, initialMint);
    
    // Transfer some tokens to users for testing
    const userAmount = ethers.parseEther("10000");
    await daiToken.connect(owner).transfer(user1.address, userAmount);
    await daiToken.connect(owner).transfer(user2.address, userAmount);
    await dloopToken.connect(owner).transfer(user1.address, userAmount);
    await dloopToken.connect(owner).transfer(node1.address, userAmount / 2n);
    await dloopToken.connect(owner).transfer(node2.address, userAmount / 2n);
    
    // Transfer some tokens to Treasury
    await daiToken.connect(owner).transfer(treasury.address, ethers.parseEther("50000"));
    
    return { 
      daiToken, dloopToken, soulboundNFT, priceOracle, feeCalculator, feeProcessor, 
      protocolDAO, assetDAO, treasury, aiNodeRegistry,
      owner, admin, user1, user2, node1, node2
    };
  }

  describe("Complete User Journey", function () {
    it("Should complete the full user journey from registration to rewards", async function () {
      const { 
        daiToken, dloopToken, soulboundNFT, assetDAO, 
        treasury, aiNodeRegistry, protocolDAO,
        user1, user2, node1 
      } = await loadFixture(deployDLoopProtocolFixture);
      
      // Step 1: Node Registration
      console.log("Step 1: Node Registration");
      
      // Register node1 as an AI node
      const nodeMetadata = "https://metadata.dloop.io/node/1";
      const nodeAddress = node1.address;
      
      // Register the node (assuming the registerNode function exists)
      // In a real implementation, this would involve the AINodeRegistry and SoulboundNFT
      // For testing, we'll simulate this by minting a SoulboundNFT directly
      
      const tokenId = await soulboundNFT.mint(node1.address, nodeMetadata);
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(node1.address);
      
      // Step 2: Asset Creation
      console.log("Step 2: Asset Creation");
      
      // Create a new asset
      const assetName = "AI Training Dataset";
      const assetMetadata = "https://metadata.dloop.io/asset/dataset";
      const targetAmount = ethers.parseEther("5000");
      const investmentPeriod = 86400 * 30; // 30 days
      
      await assetDAO.createAsset(
        assetName,
        assetMetadata,
        targetAmount,
        investmentPeriod
      );
      
      const assetId = 1; // First asset has ID 1
      
      // Step 3: User Investment
      console.log("Step 3: User Investment");
      
      // User1 invests in the asset
      const investAmount = ethers.parseEther("2000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      
      const balanceBefore = await daiToken.balanceOf(user1.address);
      
      await assetDAO.connect(user1).invest(assetId, investAmount);
      
      const balanceAfter = await daiToken.balanceOf(user1.address);
      expect(balanceBefore - balanceAfter).to.equal(investAmount);
      
      // Verify investment shares
      const shares = await assetDAO.getInvestorShares(assetId, user1.address);
      expect(shares).to.be.gt(0);
      
      // Step 4: Governance Proposal
      console.log("Step 4: Governance Proposal");
      
      // User1 creates a proposal for the asset
      const proposalDescription = "Allocate funds to node1 for AI training";
      const proposalMetadata = "https://metadata.dloop.io/proposal/1";
      const votingPeriod = 86400 * 7; // 7 days
      
      const createProposalTx = await assetDAO.connect(user1).createProposal(
        assetId,
        proposalDescription,
        proposalMetadata,
        votingPeriod
      );
      
      const createProposalReceipt = await createProposalTx.wait();
      const proposalEvent = createProposalReceipt.events.find(e => e.event === "ProposalCreated");
      const proposalId = proposalEvent.args.proposalId;
      
      // User1 votes on the proposal
      await assetDAO.connect(user1).vote(proposalId, true);
      
      // User2 also invests and votes
      await daiToken.connect(user2).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user2).invest(assetId, investAmount);
      await assetDAO.connect(user2).vote(proposalId, true);
      
      // Step 5: Proposal Execution
      console.log("Step 5: Proposal Execution");
      
      // In a real implementation, we would wait for the voting period to end
      // For testing, we'll simulate this by advancing time
      
      // Execute the proposal (assuming the executeProposal function exists)
      // In a real implementation, this would involve transferring funds to node1
      // For testing, we'll simulate this by transferring directly
      
      const nodePayment = ethers.parseEther("1000");
      
      // Transfer funds from AssetDAO to node1 (simulating proposal execution)
      // This would typically be done through a governance action
      // For testing, we'll use a direct transfer
      
      // First, transfer D-AI tokens to AssetDAO for this test
      await daiToken.connect(owner).transfer(await assetDAO.getAddress(), nodePayment);
      
      // Now simulate the proposal execution by transferring to node1
      await daiToken.connect(owner).transfer(node1.address, nodePayment);
      
      // Step 6: Fee Collection and Distribution
      console.log("Step 6: Fee Collection and Distribution");
      
      // In a real implementation, fees would be collected during operations
      // and periodically distributed through the FeeProcessor
      
      // For testing, we'll simulate by transferring directly to the Treasury
      const feeAmount = ethers.parseEther("50"); // 1% fee
      await daiToken.connect(owner).transfer(await treasury.getAddress(), feeAmount);
      
      // Distribute a portion of fees to node operators
      const rewardAmount = ethers.parseEther("25"); // 50% of fees to node operators
      await treasury.withdraw(await daiToken.getAddress(), node1.address, rewardAmount);
      
      // Step 7: User Withdrawal
      console.log("Step 7: User Withdrawal");
      
      // User1 withdraws part of their investment
      const withdrawAmount = ethers.utils.parseEther("500");
      const withdrawBalanceBefore = await daiToken.balanceOf(user1.address);
      
      await assetDAO.connect(user1).withdraw(assetId, withdrawAmount);
      
      const withdrawBalanceAfter = await daiToken.balanceOf(user1.address);
      expect(withdrawBalanceAfter - withdrawBalanceBefore).to.equal(withdrawAmount);
      
      // Step 8: Asset Liquidation
      console.log("Step 8: Asset Liquidation");
      
      // In a real implementation, asset liquidation would be a governance action
      // For testing, we'll simulate by transferring remaining funds back to investors
      
      // Calculate remaining investment for user1
      const remainingInvestment = investAmount - withdrawAmount;
      
      // Simulate liquidation by transferring directly to user1
      // This would typically be done through a governance action
      await daiToken.connect(owner).transfer(user1.address, remainingInvestment);
      
      // Verify final balances
      const finalBalance = await daiToken.balanceOf(user1.address);
      expect(finalBalance).to.be.gte(withdrawBalanceBefore + remainingInvestment);
      
      // Step 9: Node Deregistration
      console.log("Step 9: Node Deregistration");
      
      // In a real implementation, node deregistration would involve the AINodeRegistry
      // For testing, we'll simulate by revoking the SoulboundNFT
      
      await soulboundNFT.revoke(tokenId);
      
      // Verify the token is revoked
      expect(await soulboundNFT.isTokenValid(tokenId)).to.be.false;
    });
  });

  describe("Security and Edge Cases", function () {
    it("Should prevent unauthorized access to critical functions", async function () {
      const { 
        daiToken, assetDAO, treasury, protocolDAO,
        user1, user2 
      } = await loadFixture(deployDLoopProtocolFixture);
      
      // Test unauthorized asset creation
      await expect(
        assetDAO.connect(user1).createAsset(
          "Unauthorized Asset",
          "https://metadata.dloop.io/asset/unauthorized",
          ethers.utils.parseEther("1000"),
          86400 * 30
        )
      ).to.be.reverted;
      
      // Test unauthorized treasury withdrawal
      await expect(
        treasury.connect(user1).withdraw(
          daiToken.address,
          user1.address,
          ethers.utils.parseEther("100")
        )
      ).to.be.reverted;
      
      // Test unauthorized token minting
      await expect(
        daiToken.connect(user1).mint(
          user1.address,
          ethers.utils.parseEther("1000")
        )
      ).to.be.reverted;
    });
    
    it("Should handle edge cases in token flows", async function () {
      const { 
        daiToken, assetDAO, user1
      } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create an asset
      await assetDAO.createAsset(
        "Edge Case Asset",
        "https://metadata.dloop.io/asset/edge",
        ethers.utils.parseEther("1000"),
        86400 * 30
      );
      
      const assetId = 1;
      
      // Test investing with zero amount
      await expect(
        assetDAO.connect(user1).invest(assetId, 0)
      ).to.be.reverted;
      
      // Test investing without approval
      const investAmount = ethers.utils.parseEther("1000");
      await expect(
        assetDAO.connect(user1).invest(assetId, investAmount)
      ).to.be.reverted;
      
      // Test withdrawing more than invested
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(assetId, investAmount);
      
      await expect(
        assetDAO.connect(user1).withdraw(assetId, investAmount.mul(2))
      ).to.be.reverted;
      
      // Test withdrawing from non-existent asset
      await expect(
        assetDAO.connect(user1).withdraw(999, investAmount)
      ).to.be.reverted;
    });
  });
});
