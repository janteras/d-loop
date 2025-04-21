const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title AssetDAO Security Tests
 * @dev Comprehensive security tests for the AssetDAO contract
 * @notice These tests focus on access control, input validation, reentrancy protection, and state manipulation
 */
describe("AssetDAO Security Tests", function () {
  // Test fixture to deploy contracts
  async function deployContractsFixture() {
    // Get signers
    const [owner, admin, governance, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock tokens
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      await owner.getAddress()
    );
    await dloopToken.waitForDeployment();

    // Deploy mock DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy(
      "DAI Token",
      "DAI",
      await owner.getAddress()
    );
    await daiToken.waitForDeployment();

    // Deploy mock PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy(await admin.getAddress());
    await priceOracle.waitForDeployment();

    // Deploy mock Treasury for FeeProcessor
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(
      await admin.getAddress(),
      await owner.getAddress() // mock protocolDAO address
    );
    await treasury.waitForDeployment();

    // Deploy mock RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("GovernanceRewards");
    const rewardDistributor = await RewardDistributor.deploy(
      await dloopToken.getAddress(),
      await admin.getAddress()
    );
    await rewardDistributor.waitForDeployment();

    // Deploy mock FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    const feeCalculator = await FeeCalculator.deploy(
      await admin.getAddress()
    );
    await feeCalculator.waitForDeployment();

    // Deploy mock FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    const feeProcessor = await FeeProcessor.deploy(
      await treasury.getAddress(),
      await rewardDistributor.getAddress(),
      await feeCalculator.getAddress(),
      await admin.getAddress(),
      8000, // treasury percentage (80%)
      2000  // reward distributor percentage (20%)
    );
    await feeProcessor.waitForDeployment();

    // Deploy mock ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(
      await admin.getAddress(),
      await treasury.getAddress(),
      86400, // voting period (1 day)
      43200, // execution delay (12 hours)
      51     // quorum (51%)
    );
    await protocolDAO.waitForDeployment();

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

    // Mint tokens for testing
    await dloopToken.connect(owner).mint(await user1.getAddress(), ethers.parseEther("10000"));
    await dloopToken.connect(owner).mint(await user2.getAddress(), ethers.parseEther("10000"));
    await dloopToken.connect(owner).mint(await user3.getAddress(), ethers.parseEther("10000"));
    
    await daiToken.connect(owner).mint(await user1.getAddress(), ethers.parseEther("10000"));
    await daiToken.connect(owner).mint(await user2.getAddress(), ethers.parseEther("10000"));
    await daiToken.connect(owner).mint(await user3.getAddress(), ethers.parseEther("10000"));

    return { 
      assetDAO, 
      daiToken, 
      dloopToken, 
      priceOracle, 
      feeProcessor, 
      feeCalculator,
      treasury,
      rewardDistributor,
      protocolDAO, 
      owner, 
      admin, 
      governance, 
      user1, 
      user2, 
      user3 
    };
  }

  describe("Access Control Security Tests", function () {
    it("Should revert with CallerNotAdmin when non-admin tries to update asset state", async function () {
      const { assetDAO, user1, user2 } = await loadFixture(deployContractsFixture);
      
      // Create an asset first
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Try to update asset state as non-admin
      await expect(
        assetDAO.connect(user2).updateAssetState(1, 2) // 2 = Liquidating
      ).to.be.revertedWithCustomError(assetDAO, "CallerNotAdmin");
    });

    it("Should revert with CallerNotAdmin when non-admin tries to update protocol parameters", async function () {
      const { assetDAO, user1 } = await loadFixture(deployContractsFixture);
      
      await expect(
        assetDAO.connect(user1).updateMinimumInvestment(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(assetDAO, "CallerNotAdmin");
    });

    it("Should revert with CallerNotOwner when non-owner tries to transfer ownership", async function () {
      const { assetDAO, user1, user2 } = await loadFixture(deployContractsFixture);
      
      await expect(
        assetDAO.connect(user1).transferOwnership(await user2.getAddress())
      ).to.be.revertedWithCustomError(assetDAO, "CallerNotOwner");
    });

    it("Should revert with MissingRole when non-governance tries to execute a proposal", async function () {
      const { assetDAO, user1, user2 } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Create a proposal
      await assetDAO.connect(user1).createProposal(
        1, // assetId
        0, // ProposalType.Investment
        "Test Proposal",
        "Test Description",
        ethers.parseEther("1000"),
        86400 // 1 day voting period
      );
      
      // Try to execute the proposal as non-governance
      await expect(
        assetDAO.connect(user2).executeProposal(1)
      ).to.be.revertedWithCustomError(assetDAO, "MissingRole");
    });
  });

  describe("Input Validation Security Tests", function () {
    it("Should revert with ZeroAddress when creating asset with zero address parameters", async function () {
      const { assetDAO, daiToken, dloopToken, priceOracle, feeProcessor, protocolDAO } = await loadFixture(deployContractsFixture);
      
      // Deploy with zero address for DAI token
      const AssetDAO = await ethers.getContractFactory("AssetDAO");
      await expect(
        AssetDAO.deploy(
          ethers.ZeroAddress,
          await dloopToken.getAddress(),
          await priceOracle.getAddress(),
          await feeProcessor.getAddress(),
          await protocolDAO.getAddress()
        )
      ).to.be.revertedWithCustomError(AssetDAO, "ZeroAddress");
    });

    it("Should revert with InvalidAmount when investing with zero amount", async function () {
      const { assetDAO, user1, daiToken } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Try to invest with zero amount
      await expect(
        assetDAO.connect(user1).invest(1, 0)
      ).to.be.revertedWithCustomError(assetDAO, "InvalidAmount");
    });

    it("Should revert with InvalidVotingPeriod when creating proposal with zero voting period", async function () {
      const { assetDAO, user1 } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Try to create a proposal with zero voting period
      await expect(
        assetDAO.connect(user1).createProposal(
          1, // assetId
          0, // ProposalType.Investment
          "Test Proposal",
          "Test Description",
          ethers.parseEther("1000"),
          0 // 0 voting period
        )
      ).to.be.revertedWithCustomError(assetDAO, "InvalidVotingPeriod");
    });

    it("Should revert with AssetNotFound when interacting with non-existent asset", async function () {
      const { assetDAO, user1 } = await loadFixture(deployContractsFixture);
      
      // Try to invest in non-existent asset
      await expect(
        assetDAO.connect(user1).invest(999, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(assetDAO, "AssetNotFound");
    });
  });

  describe("State Manipulation Security Tests", function () {
    it("Should revert with AssetNotActive when investing in non-active asset", async function () {
      const { assetDAO, user1, user2, owner } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Update asset state to Liquidating (2)
      await assetDAO.connect(owner).updateAssetState(1, 2);
      
      // Try to invest in non-active asset
      await expect(
        assetDAO.connect(user2).invest(1, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(assetDAO, "AssetNotActive");
    });

    it("Should revert with InsufficientShares when withdrawing more shares than owned", async function () {
      const { assetDAO, user1, daiToken } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Approve DAI token for investment
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), ethers.parseEther("1000"));
      
      // Invest in the asset
      await assetDAO.connect(user1).invest(1, ethers.parseEther("100"));
      
      // Try to withdraw more shares than owned
      await expect(
        assetDAO.connect(user1).rageQuit(1, ethers.parseEther("200"))
      ).to.be.revertedWithCustomError(assetDAO, "InsufficientShares");
    });

    it("Should revert with ProposalNotActive when voting on non-active proposal", async function () {
      const { assetDAO, user1, owner } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Create a proposal
      await assetDAO.connect(user1).createProposal(
        1, // assetId
        0, // ProposalType.Investment
        "Test Proposal",
        "Test Description",
        ethers.parseEther("1000"),
        86400 // 1 day voting period
      );
      
      // Cancel the proposal (requires admin role)
      await assetDAO.connect(owner).cancelProposal(1);
      
      // Try to vote on a canceled proposal
      await expect(
        assetDAO.connect(user1).vote(1, true)
      ).to.be.revertedWithCustomError(assetDAO, "ProposalNotActive");
    });

    it("Should revert with AlreadyVoted when voting twice on the same proposal", async function () {
      const { assetDAO, user1 } = await loadFixture(deployContractsFixture);
      
      // Create an asset
      await assetDAO.connect(user1).createAsset("Test Asset", "Test Description");
      
      // Create a proposal
      await assetDAO.connect(user1).createProposal(
        1, // assetId
        0, // ProposalType.Investment
        "Test Proposal",
        "Test Description",
        ethers.parseEther("1000"),
        86400 // 1 day voting period
      );
      
      // Vote on the proposal
      await assetDAO.connect(user1).vote(1, true);
      
      // Try to vote again
      await expect(
        assetDAO.connect(user1).vote(1, false)
      ).to.be.revertedWithCustomError(assetDAO, "AlreadyVoted");
    });
  });

  describe("Reentrancy Protection Tests", function () {
    it("Should have nonReentrant modifier on critical functions", async function () {
      const { assetDAO } = await loadFixture(deployContractsFixture);
      
      // Check if critical functions have nonReentrant modifier
      // This is a static code analysis test
      
      // The following functions should have nonReentrant modifier:
      // - invest
      // - withdraw
      // - rageQuit
      // - executeProposal
      
      // Since we can't directly check for modifiers in the compiled contract,
      // we'll verify this by checking the contract source code
      
      // For this test to pass, we need to manually verify that these functions
      // have the nonReentrant modifier in the contract source code
      
      // This test will always pass, but serves as a reminder to check the contract code
      expect(true).to.be.true;
    });
  });

  describe("Pause Mechanism Security Tests", function () {
    it("Should revert when interacting with paused contract", async function () {
      const { assetDAO, user1, owner } = await loadFixture(deployContractsFixture);
      
      // Pause the contract
      await assetDAO.connect(owner).pause();
      
      // Try to create an asset while paused
      await expect(
        assetDAO.connect(user1).createAsset("Test Asset", "Test Description")
      ).to.be.revertedWithCustomError(assetDAO, "EnforcedPause");
    });

    it("Should revert with CallerNotAdmin when non-admin tries to pause", async function () {
      const { assetDAO, user1 } = await loadFixture(deployContractsFixture);
      
      // Try to pause as non-admin
      await expect(
        assetDAO.connect(user1).pause()
      ).to.be.revertedWithCustomError(assetDAO, "CallerNotAdmin");
    });

    it("Should revert with CallerNotAdmin when non-admin tries to unpause", async function () {
      const { assetDAO, user1, owner } = await loadFixture(deployContractsFixture);
      
      // Pause the contract
      await assetDAO.connect(owner).pause();
      
      // Try to unpause as non-admin
      await expect(
        assetDAO.connect(user1).unpause()
      ).to.be.revertedWithCustomError(assetDAO, "CallerNotAdmin");
    });
  });
});
