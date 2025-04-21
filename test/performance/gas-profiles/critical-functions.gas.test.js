const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title Gas Profiling for Critical Functions
 * @dev Tests to measure gas usage for critical functions and ensure they stay within acceptable limits
 * @notice These tests help maintain gas efficiency across protocol updates
 */
describe("Gas Profiling for Critical Functions", function () {
  // Define gas limits for critical functions
  const GAS_LIMITS = {
    // D-AI Token operations
    daiTransfer: 55000,
    daiApprove: 48000,
    daiMint: 75000,
    
    // AssetDAO operations
    assetCreation: 250000,
    assetInvestment: 180000,
    assetWithdrawal: 120000,
    proposalCreation: 200000,
    proposalVoting: 80000,
    
    // Treasury operations
    treasuryDeposit: 100000,
    treasuryWithdrawal: 90000,
    
    // AINodeRegistry operations
    nodeRegistration: 300000,
    nodeDeregistration: 150000
  };
  
  // Test fixture to deploy all relevant contracts
  async function deployDLoopProtocolFixture() {
    const [owner, admin, user1, user2, node1] = await ethers.getSigners();
    
    // Deploy DAIToken (D-AI Token)
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    // In ethers v6, we wait for the transaction to be mined
    await daiToken.waitForDeployment();
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy();
    await dloopToken.waitForDeployment();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    const soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracle.deploy();
    await priceOracle.waitForDeployment();
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    const feeProcessor = await FeeProcessor.deploy(daiToken.address, dloopToken.address);
    await feeProcessor.waitForDeployment();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(dloopToken.address);
    await protocolDAO.waitForDeployment();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(admin.address, protocolDAO.address);
    await treasury.waitForDeployment();
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      daiToken.address,
      dloopToken.address,
      priceOracle.address,
      feeProcessor.address,
      protocolDAO.address
    );
    await assetDAO.waitForDeployment();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    const aiNodeRegistry = await AINodeRegistry.deploy(admin.address, soulboundNFT.getAddress());
    await aiNodeRegistry.waitForDeployment();
    
    // Setup roles and permissions
    await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), aiNodeRegistry.address);
    
    // Mint initial tokens
    const initialMint = ethers.utils.parseEther("1000000");
    await daiToken.mint(owner.address, initialMint);
    await dloopToken.mint(owner.address, initialMint);
    
    // Transfer some tokens to users for testing
    const userAmount = ethers.utils.parseEther("10000");
    await daiToken.transfer(user1.address, userAmount);
    await daiToken.transfer(user2.address, userAmount);
    await dloopToken.transfer(user1.address, userAmount);
    
    return { 
      daiToken, dloopToken, soulboundNFT, priceOracle, feeProcessor, 
      protocolDAO, assetDAO, treasury, aiNodeRegistry,
      owner, admin, user1, user2, node1 
    };
  }

  // Helper function to measure gas usage
  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed.toNumber();
  }

  describe("D-AI Token Operations", function () {
    it("Should maintain gas efficiency for transfer operations", async function () {
      const { daiToken, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      const transferAmount = ethers.utils.parseEther("100");
      const tx = await daiToken.connect(user1).transfer(user2.address, transferAmount);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for D-AI transfer: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.daiTransfer);
    });
    
    it("Should maintain gas efficiency for approve operations", async function () {
      const { daiToken, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      const approvalAmount = ethers.utils.parseEther("500");
      const tx = await daiToken.connect(user1).approve(user2.address, approvalAmount);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for D-AI approve: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.daiApprove);
    });
    
    it("Should maintain gas efficiency for mint operations", async function () {
      const { daiToken, owner, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      const mintAmount = ethers.utils.parseEther("1000");
      const tx = await daiToken.connect(owner).mint(user1.address, mintAmount);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for D-AI mint: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.daiMint);
    });
  });

  describe("AssetDAO Operations", function () {
    it("Should maintain gas efficiency for asset creation", async function () {
      const { assetDAO } = await loadFixture(deployDLoopProtocolFixture);
      
      const tx = await assetDAO.createAsset(
        "Gas Test Asset",
        "https://metadata.dloop.io/asset/gas",
        ethers.utils.parseEther("5000"),
        86400 * 30 // 30 days
      );
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for asset creation: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.assetCreation);
    });
    
    it("Should maintain gas efficiency for asset investment", async function () {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create an asset first
      await assetDAO.createAsset(
        "Investment Gas Test",
        "https://metadata.dloop.io/asset/investment-gas",
        ethers.utils.parseEther("5000"),
        86400 * 30
      );
      
      const investAmount = ethers.utils.parseEther("1000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      
      const tx = await assetDAO.connect(user1).invest(1, investAmount);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for asset investment: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.assetInvestment);
    });
    
    it("Should maintain gas efficiency for asset withdrawal", async function () {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create an asset first
      await assetDAO.createAsset(
        "Withdrawal Gas Test",
        "https://metadata.dloop.io/asset/withdrawal-gas",
        ethers.utils.parseEther("5000"),
        86400 * 30
      );
      
      // Invest first
      const investAmount = ethers.utils.parseEther("1000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(1, investAmount);
      
      // Now withdraw
      const withdrawAmount = ethers.utils.parseEther("500");
      const tx = await assetDAO.connect(user1).withdraw(1, withdrawAmount);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for asset withdrawal: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.assetWithdrawal);
    });
    
    it("Should maintain gas efficiency for proposal creation", async function () {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create an asset first
      await assetDAO.createAsset(
        "Proposal Gas Test",
        "https://metadata.dloop.io/asset/proposal-gas",
        ethers.utils.parseEther("5000"),
        86400 * 30
      );
      
      // Invest first
      const investAmount = ethers.utils.parseEther("1000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(1, investAmount);
      
      // Create proposal
      const tx = await assetDAO.connect(user1).createProposal(
        1,
        "Gas Test Proposal",
        "https://metadata.dloop.io/proposal/gas",
        86400 * 7 // 7 days
      );
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for proposal creation: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.proposalCreation);
    });
    
    it("Should maintain gas efficiency for proposal voting", async function () {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create an asset first
      await assetDAO.createAsset(
        "Voting Gas Test",
        "https://metadata.dloop.io/asset/voting-gas",
        ethers.utils.parseEther("5000"),
        86400 * 30
      );
      
      // Invest first
      const investAmount = ethers.utils.parseEther("1000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      await assetDAO.connect(user1).invest(1, investAmount);
      
      // Create proposal
      const proposalTx = await assetDAO.connect(user1).createProposal(
        1,
        "Gas Test Proposal",
        "https://metadata.dloop.io/proposal/gas",
        86400 * 7 // 7 days
      );
      
      const proposalReceipt = await proposalTx.wait();
      const proposalEvent = proposalReceipt.events.find(e => e.event === "ProposalCreated");
      const proposalId = proposalEvent.args.proposalId;
      
      // Vote on proposal
      const tx = await assetDAO.connect(user1).vote(proposalId, true);
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for proposal voting: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.proposalVoting);
    });
  });

  describe("Treasury Operations", function () {
    it("Should maintain gas efficiency for treasury deposits", async function () {
      const { daiToken, treasury, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      const depositAmount = ethers.utils.parseEther("500");
      await daiToken.connect(user1).approve(treasury.address, depositAmount);
      
      const tx = await treasury.connect(user1).deposit(
        daiToken.address,
        depositAmount,
        "Gas Test Deposit"
      );
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for treasury deposit: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.treasuryDeposit);
    });
    
    it("Should maintain gas efficiency for treasury withdrawals", async function () {
      const { daiToken, treasury, owner, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // First deposit some funds
      const depositAmount = ethers.utils.parseEther("1000");
      await daiToken.transfer(treasury.address, depositAmount);
      
      // Now withdraw
      const withdrawAmount = ethers.utils.parseEther("500");
      const tx = await treasury.withdraw(
        daiToken.address,
        user1.address,
        withdrawAmount
      );
      
      const gasUsed = await measureGas(tx);
      console.log(`Gas used for treasury withdrawal: ${gasUsed}`);
      
      expect(gasUsed).to.be.at.most(GAS_LIMITS.treasuryWithdrawal);
    });
  });

  describe("Gas Comparison with Previous Versions", function () {
    it("Should generate gas usage report for critical functions", async function () {
      const { 
        daiToken, assetDAO, treasury, owner, user1, user2 
      } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create test data structure to store gas measurements
      const gasReport = {};
      
      // Measure D-AI token operations
      const transferAmount = ethers.utils.parseEther("100");
      const transferTx = await daiToken.connect(user1).transfer(user2.address, transferAmount);
      gasReport.daiTransfer = (await measureGas(transferTx));
      
      const approvalAmount = ethers.utils.parseEther("500");
      const approveTx = await daiToken.connect(user1).approve(user2.address, approvalAmount);
      gasReport.daiApprove = (await measureGas(approveTx));
      
      const mintAmount = ethers.utils.parseEther("1000");
      const mintTx = await daiToken.connect(owner).mint(user1.address, mintAmount);
      gasReport.daiMint = (await measureGas(mintTx));
      
      // Measure AssetDAO operations
      const createAssetTx = await assetDAO.createAsset(
        "Gas Report Asset",
        "https://metadata.dloop.io/asset/gas-report",
        ethers.utils.parseEther("5000"),
        86400 * 30
      );
      gasReport.assetCreation = (await measureGas(createAssetTx));
      
      const investAmount = ethers.utils.parseEther("1000");
      await daiToken.connect(user1).approve(assetDAO.address, investAmount);
      const investTx = await assetDAO.connect(user1).invest(1, investAmount);
      gasReport.assetInvestment = (await measureGas(investTx));
      
      const withdrawAmount = ethers.utils.parseEther("500");
      const withdrawTx = await assetDAO.connect(user1).withdraw(1, withdrawAmount);
      gasReport.assetWithdrawal = (await measureGas(withdrawTx));
      
      // Measure Treasury operations
      const depositAmount = ethers.utils.parseEther("500");
      await daiToken.connect(user1).approve(treasury.address, depositAmount);
      const depositTx = await treasury.connect(user1).deposit(
        daiToken.address,
        depositAmount,
        "Gas Report Deposit"
      );
      gasReport.treasuryDeposit = (await measureGas(depositTx));
      
      const treasuryWithdrawTx = await treasury.withdraw(
        daiToken.address,
        user2.address,
        ethers.utils.parseEther("100")
      );
      gasReport.treasuryWithdrawal = (await measureGas(treasuryWithdrawTx));
      
      // Output gas report
      console.log("=== Gas Usage Report ===");
      Object.entries(gasReport).forEach(([operation, gas]) => {
        const limit = GAS_LIMITS[operation];
        const percentOfLimit = ((gas / limit) * 100).toFixed(2);
        console.log(`${operation}: ${gas} gas (${percentOfLimit}% of limit)`);
      });
      
      // Save gas report to file (would be implemented in a real environment)
      // This would typically write to a JSON file that could be compared with previous runs
      
      // Verify all operations are within limits
      Object.entries(gasReport).forEach(([operation, gas]) => {
        expect(gas).to.be.at.most(GAS_LIMITS[operation]);
      });
    });
  });
});
