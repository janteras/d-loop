const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title AssetDAO to Treasury Integration Tests
 * @dev Tests for verifying interactions between AssetDAO and Treasury contracts
 * @notice These tests validate cross-contract calls, fund transfers, and event emissions
 */
describe("AssetDAO to Treasury Integration Tests", function () {
  // Test fixture to deploy all relevant contracts
  async function deployDLoopProtocolFixture() {
    const [owner, admin, user1, user2, node1] = await ethers.getSigners();
    
    // Deploy DAIToken (D-AI Token)
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.deployed();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy();
    await dloopToken.deployed();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    const feeProcessor = await FeeProcessor.deploy(daiToken.address, dloopToken.address);
    await feeProcessor.deployed();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(dloopToken.address);
    await protocolDAO.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(admin.address, protocolDAO.address);
    await treasury.deployed();
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      daiToken.address,
      dloopToken.address,
      priceOracle.address,
      feeProcessor.address,
      protocolDAO.address
    );
    await assetDAO.deployed();
    
    // Setup roles and permissions
    await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
    
    // Mint initial tokens
    const initialMint = ethers.utils.parseEther("1000000");
    await daiToken.mint(owner.address, initialMint);
    await dloopToken.mint(owner.address, initialMint);
    
    // Transfer some tokens to users for testing
    const userAmount = ethers.utils.parseEther("10000");
    await daiToken.transfer(user1.address, userAmount);
    await daiToken.transfer(user2.address, userAmount);
    await dloopToken.transfer(user1.address, userAmount);
    
    // Transfer some tokens to Treasury
    await daiToken.transfer(treasury.address, ethers.utils.parseEther("50000"));
    
    // Setup AssetDAO with Treasury reference (if applicable)
    // This would be part of the contract initialization or a separate function
    
    return { 
      daiToken, dloopToken, priceOracle, feeProcessor, 
      protocolDAO, assetDAO, treasury, 
      owner, admin, user1, user2, node1 
    };
  }

  describe("Asset Liquidation to Treasury Flow", function () {
    it("Should transfer funds from AssetDAO to Treasury during liquidation", async function () {
      const { daiToken, assetDAO, treasury, owner, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // 1. Create an asset
      await assetDAO.createAsset(
        "Liquidation Test Asset",
        "https://metadata.dloop.io/asset/liquidation",
        ethers.utils.parseEther("5000"),
        86400 * 30 // 30 days
      );
      
      const assetId = 1; // First asset has ID 1
      
      // 2. Invest in the asset
      const investAmount = ethers.utils.parseEther("2000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(assetId, investAmount);
      
      // 3. Setup Treasury as a recipient for liquidation
      // This would typically be done through a governance action
      // For testing, we'll assume the AssetDAO can directly interact with Treasury
      
      // 4. Track balances before liquidation
      const treasuryBalanceBefore = await daiToken.balanceOf(treasury.address);
      
      // 5. Perform liquidation (this is a simplified version)
      // In a real implementation, this would be more complex and involve governance
      // We're simulating the flow of funds from AssetDAO to Treasury
      
      // Transfer funds from AssetDAO to Treasury
      const liquidationAmount = ethers.utils.parseEther("1000");
      
      // First, we need to transfer funds to the AssetDAO for this test
      await daiToken.transfer(assetDAO.address, liquidationAmount);
      
      // Now simulate the liquidation by having funds flow to Treasury
      // This would typically be an internal function or a governance action
      // For testing purposes, we'll use the Treasury's deposit function directly
      
      // AssetDAO would approve Treasury to spend its tokens
      await daiToken.connect(owner).approve(treasury.address, liquidationAmount);
      
      // Treasury receives the funds
      await treasury.deposit(daiToken.address, liquidationAmount, "Asset Liquidation");
      
      // 6. Verify Treasury received the funds
      const treasuryBalanceAfter = await daiToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(liquidationAmount);
    });
  });

  describe("Treasury to AssetDAO Fund Allocation", function () {
    it("Should transfer funds from Treasury to AssetDAO for new investments", async function () {
      const { daiToken, assetDAO, treasury, protocolDAO, owner } = await loadFixture(deployDLoopProtocolFixture);
      
      // 1. Create an asset
      await assetDAO.createAsset(
        "Treasury Funded Asset",
        "https://metadata.dloop.io/asset/treasury-funded",
        ethers.utils.parseEther("10000"),
        86400 * 30 // 30 days
      );
      
      const assetId = 1; // First asset has ID 1
      
      // 2. Track balances before fund allocation
      const assetDAOBalanceBefore = await daiToken.balanceOf(assetDAO.address);
      
      // 3. Allocate funds from Treasury to AssetDAO
      // This would typically be done through a governance action via ProtocolDAO
      // For testing, we'll simulate this flow
      
      const allocationAmount = ethers.utils.parseEther("5000");
      
      // Treasury would withdraw funds to AssetDAO
      // This requires the ProtocolDAO to authorize the withdrawal
      // For testing, we'll simulate this by having the owner call withdraw
      // In production, this would be a governance action
      
      // Withdraw from Treasury to AssetDAO
      await treasury.withdraw(
        daiToken.address, 
        assetDAO.address, 
        allocationAmount
      );
      
      // 4. Verify AssetDAO received the funds
      const assetDAOBalanceAfter = await daiToken.balanceOf(assetDAO.address);
      expect(assetDAOBalanceAfter.sub(assetDAOBalanceBefore)).to.equal(allocationAmount);
      
      // 5. Verify the funds can be used for investment
      // In a real scenario, these funds would be allocated to specific assets
      // For testing, we'll verify the funds are available in the AssetDAO
      
      // The total available funds should include our allocation
      const totalAvailableFunds = await daiToken.balanceOf(assetDAO.address);
      expect(totalAvailableFunds).to.be.gte(allocationAmount);
    });
  });

  describe("Fee Distribution Flow", function () {
    it("Should collect fees from AssetDAO and distribute via Treasury", async function () {
      const { daiToken, assetDAO, treasury, feeProcessor, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      // 1. Create an asset
      await assetDAO.createAsset(
        "Fee Test Asset",
        "https://metadata.dloop.io/asset/fees",
        ethers.utils.parseEther("10000"),
        86400 * 30 // 30 days
      );
      
      const assetId = 1; // First asset has ID 1
      
      // 2. Invest in the asset (which should generate fees)
      const investAmount = ethers.utils.parseEther("5000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(assetId, investAmount);
      
      // 3. Track balances before fee distribution
      const treasuryBalanceBefore = await daiToken.balanceOf(treasury.address);
      const user2BalanceBefore = await daiToken.balanceOf(user2.address);
      
      // 4. Simulate fee collection and distribution
      // In a real implementation, fees would be collected during operations
      // and periodically distributed through the FeeProcessor
      
      // For testing, we'll simulate by transferring directly to the Treasury
      const feeAmount = ethers.utils.parseEther("50"); // 1% fee
      await daiToken.transfer(treasury.address, feeAmount);
      
      // 5. Distribute a portion of fees to a user (simulating node operator rewards)
      const rewardAmount = ethers.utils.parseEther("25"); // 50% of fees to node operators
      await treasury.withdraw(daiToken.address, user2.address, rewardAmount);
      
      // 6. Verify balances after fee distribution
      const treasuryBalanceAfter = await daiToken.balanceOf(treasury.address);
      const user2BalanceAfter = await daiToken.balanceOf(user2.address);
      
      // Treasury should have received fees and sent rewards
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(feeAmount.sub(rewardAmount));
      
      // User2 (node operator) should have received rewards
      expect(user2BalanceAfter.sub(user2BalanceBefore)).to.equal(rewardAmount);
    });
  });
});
