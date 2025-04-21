const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Gas Consumption Analysis Tests
 * 
 * This file provides comprehensive gas measurement for key operations
 * in the DLOOP protocol. It deploys all contracts and measures real gas
 * consumption for critical operations.
 */
describe("Comprehensive Gas Consumption Analysis", function () {
  let owner, user1, user2, aiNode1, aiNode2, validator1, validator2;
  let dloopToken, assetDAOWithFees, protocolDAO, aiNodeRegistry, feeCalculator;
  let treasury, rewardDistributor, multiOracle, mockPriceFeed, hederaBridge;
  let soulboundNFT;
  
  // Standard test values
  const investAmount = ethers.utils.parseEther("10000");
  const divestAmount = ethers.utils.parseEther("5000");
  const rageQuitAmount = ethers.utils.parseEther("2000");
  const proposalDescription = "Test proposal";
  const calldata = "0x";
  const VALIDATOR_THRESHOLD = 2;
  const TIMELOCK_PERIOD = 86400; // 1 day in seconds
  const MAX_TRANSFER_AMOUNT = ethers.utils.parseEther("250000"); // $250,000
  
  before(async function () {
    [owner, user1, user2, aiNode1, aiNode2, validator1, validator2] = await ethers.getSigners();
    
    // Deploy all contracts
    console.log("Deploying contracts for gas analysis...");
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("DLOOP", "DLOOP");
    await dloopToken.deployed();
    
    // Mint tokens to users for testing
    const initialBalance = ethers.utils.parseEther("1000000");
    await dloopToken.mint(owner.address, initialBalance);
    await dloopToken.mint(user1.address, initialBalance);
    await dloopToken.mint(user2.address, initialBalance);
    await dloopToken.mint(aiNode1.address, initialBalance);
    await dloopToken.mint(aiNode2.address, initialBalance);
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy("AI Node Credential", "AINC");
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // Transfer ownership of SoulboundNFT to AINodeRegistry
    await soulboundNFT.transferOwnership(aiNodeRegistry.address);
    
    // Register AI nodes
    await aiNodeRegistry.registerAINode(aiNode1.address, "AI Node 1", "https://metadata.dloop.org/ainode1");
    await aiNodeRegistry.registerAINode(aiNode2.address, "AI Node 2", "https://metadata.dloop.org/ainode2");
    
    // Deploy mock price feed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy();
    await mockPriceFeed.deployed();
    await mockPriceFeed.setLatestAnswer(ethers.utils.parseUnits("3000", 8)); // $3000 per ETH
    
    // Deploy MultiOracleConsensus
    const MultiOracleConsensus = await ethers.getContractFactory("MultiOracleConsensus");
    multiOracle = await MultiOracleConsensus.deploy();
    await multiOracle.deployed();
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.deployed();
    await feeCalculator.initialize(aiNodeRegistry.address);
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(dloopToken.address);
    await treasury.deployed();
    
    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(dloopToken.address, aiNodeRegistry.address);
    await rewardDistributor.deployed();
    
    // Set up reward distribution parameters
    await rewardDistributor.setRewardParameters(
      ethers.utils.parseEther("100000"), // Total rewards for the period
      72,                                // 72 months
      ethers.utils.parseEther("5")       // Minimum threshold
    );
    
    // Add multiOracle to RewardDistributor
    await rewardDistributor.setPriceOracle(multiOracle.address, "ETH/USD");
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      dloopToken.address,
      aiNodeRegistry.address,
      86400, // 1 day in seconds for AI nodes
      604800 // 7 days in seconds for humans
    );
    await protocolDAO.deployed();
    
    // Deploy AssetDAOWithFees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAOWithFees = await AssetDAOWithFees.deploy();
    await assetDAOWithFees.initialize(
      dloopToken.address,
      feeCalculator.address,
      treasury.address,
      rewardDistributor.address,
      multiOracle.address
    );
    
    // Deploy HederaBridge
    const validators = [validator1.address, validator2.address];
    const HederaBridge = await ethers.getContractFactory("HederaBridge");
    hederaBridge = await HederaBridge.deploy(
      dloopToken.address,
      validators,
      VALIDATOR_THRESHOLD,
      MAX_TRANSFER_AMOUNT,
      TIMELOCK_PERIOD
    );
    await hederaBridge.deployed();
    
    // Grant roles and permissions
    await treasury.grantRole(await treasury.FEE_MANAGER_ROLE(), assetDAOWithFees.address);
    await rewardDistributor.grantRole(await rewardDistributor.DISTRIBUTOR_ROLE(), assetDAOWithFees.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), hederaBridge.address);
    
    // Approve tokens for testing
    await dloopToken.connect(user1).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user2).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user1).approve(hederaBridge.address, ethers.constants.MaxUint256);
    
    console.log("Contract setup complete for gas analysis.");
  });
  
  describe("Asset DAO Operations Gas Analysis", function () {
    it("should measure gas for investment operation", async function () {
      // First call might be higher due to cold storage
      await assetDAOWithFees.connect(user1).invest(investAmount);
      
      // Measure gas for second call with warm storage
      const tx = await assetDAOWithFees.connect(user1).invest(investAmount);
      const receipt = await tx.wait();
      console.log(`Gas used for investment operation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(300000, "Investment operation should use less than 300,000 gas");
    });
    
    it("should measure gas for divestment operation", async function () {
      const tx = await assetDAOWithFees.connect(user1).divest(divestAmount);
      const receipt = await tx.wait();
      console.log(`Gas used for divestment operation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(350000, "Divestment operation should use less than 350,000 gas");
    });
    
    it("should measure gas for ragequit operation", async function () {
      const tx = await assetDAOWithFees.connect(user1).rageQuit(rageQuitAmount);
      const receipt = await tx.wait();
      console.log(`Gas used for ragequit operation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(400000, "Ragequit operation should use less than 400,000 gas");
    });
  });
  
  describe("Governance Operations Gas Analysis", function () {
    it("should measure gas for proposal creation", async function () {
      const tx = await protocolDAO.connect(aiNode1).propose(
        [treasury.address],
        [0],
        [calldata],
        proposalDescription
      );
      const receipt = await tx.wait();
      console.log(`Gas used for proposal creation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(250000, "Proposal creation should use less than 250,000 gas");
      
      // Get the proposal ID for voting tests
      this.proposalId = await protocolDAO.hashProposal(
        [treasury.address],
        [0],
        [calldata],
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(proposalDescription))
      );
    });
    
    it("should measure gas for voting operation", async function () {
      const tx = await protocolDAO.connect(aiNode1).castVote(this.proposalId, 1); // Vote FOR
      const receipt = await tx.wait();
      console.log(`Gas used for voting operation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(100000, "Voting operation should use less than 100,000 gas");
    });
  });
  
  describe("Bridge Operations Gas Analysis", function () {
    it("should measure gas for locking tokens", async function () {
      const transferAmount = ethers.utils.parseEther("10");
      const hederaReceiver = "0.0.12345"; // Hedera account ID format
      
      const tx = await hederaBridge.connect(user1).lockTokens(transferAmount, hederaReceiver);
      const receipt = await tx.wait();
      console.log(`Gas used for locking tokens: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(200000, "Token locking should use less than 200,000 gas");
    });
    
    it("should measure gas for validator approval", async function () {
      const transferId = 1;
      const transferAmount = ethers.utils.parseEther("5");
      const ethereumReceiver = user2.address;
      const hederaSender = "0.0.12345";
      
      const tx = await hederaBridge.connect(validator1).approveTransfer(
        transferId,
        transferAmount,
        ethereumReceiver,
        hederaSender
      );
      const receipt = await tx.wait();
      console.log(`Gas used for validator approval: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(150000, "Validator approval should use less than 150,000 gas");
    });
  });
  
  describe("Fee Operations Gas Analysis", function () {
    it("should measure gas for fee calculation", async function () {
      const asset = dloopToken.address;
      const amount = ethers.utils.parseEther("1000");
      
      const tx = await feeCalculator.calculateFee(0, asset, amount, user1.address); // 0 = INVEST
      const receipt = await tx.wait();
      console.log(`Gas used for fee calculation: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(100000, "Fee calculation should use less than 100,000 gas");
    });
  });
  
  describe("AINode Operations Gas Analysis", function () {
    it("should measure gas for AINode registration", async function () {
      const tx = await aiNodeRegistry.registerAINode(
        user2.address,
        "Test AI Node",
        "https://metadata.dloop.org/testnode"
      );
      const receipt = await tx.wait();
      console.log(`Gas used for AINode registration: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(300000, "AINode registration should use less than 300,000 gas");
    });
    
    it("should measure gas for AINode verification level update", async function () {
      const tx = await aiNodeRegistry.updateNodeVerificationLevel(user2.address, 2); // level 2
      const receipt = await tx.wait();
      console.log(`Gas used for verification level update: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(100000, "Verification level update should use less than 100,000 gas");
    });
  });
  
  describe("Reward Operations Gas Analysis", function () {
    it("should measure gas for reward distribution", async function () {
      // Record price snapshot for reward calculation
      await rewardDistributor.recordPriceSnapshot();
      
      // Fast-forward to enable distribution
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
      
      const tx = await rewardDistributor.distributeMonthlyRewards();
      const receipt = await tx.wait();
      console.log(`Gas used for reward distribution: ${receipt.gasUsed.toString()}`);
      
      // This is a complex operation, so the gas limit is higher
      expect(receipt.gasUsed.toNumber()).to.be.lessThan(500000, "Reward distribution should use less than 500,000 gas");
    });
  });
  
  describe("Gas Optimization Recommendations", function () {
    it("should summarize gas optimization recommendations", function () {
      console.log("Gas Optimization Recommendations:");
      console.log("1. Use batch operations for token transfers where possible");
      console.log("2. Cache storage values in memory during complex operations");
      console.log("3. Minimize storage operations, especially in loops");
      console.log("4. Use fixed-point math (basis points) for fee calculations");
      console.log("5. Consider Hedera's resource-based pricing model for cross-chain optimizations");
      console.log("6. Implement gas-efficient vote counting mechanisms");
      console.log("7. Optimize array operations, prefer mappings for lookups");
      console.log("8. Use events for off-chain data needs rather than storing in contract");
    });
  });
});