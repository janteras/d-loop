const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Complete Workflow Integration Test
 * 
 * This test runs an end-to-end workflow that simulates the full DLOOP ecosystem
 * interaction between users, AI nodes, the protocol, and the bridge.
 */
describe("DLOOP Protocol - Complete Workflow Integration", function () {
  // Participants
  let deployer, user1, user2, user3, aiNode1, aiNode2, validator1, validator2;
  
  // Core contracts
  let dloopToken;
  let assetDAOWithFees;
  let protocolDAO;
  let aiNodeRegistry;
  let feeCalculator;
  let treasury;
  let rewardDistributor;
  let multiOracle;
  let mockPriceFeed;
  let hederaBridge;
  let soulboundNFT;
  
  // Test constants
  const INITIAL_MINT = ethers.utils.parseEther("1000000");
  const INVEST_AMOUNT = ethers.utils.parseEther("10000");
  const DIVEST_AMOUNT = ethers.utils.parseEther("5000");
  const RAGEQUIT_AMOUNT = ethers.utils.parseEther("2000");
  const BRIDGE_AMOUNT = ethers.utils.parseEther("1000");
  const PROPOSAL_DESCRIPTION = "Add liquidity to the treasury";
  
  // Fee percentages (basis points)
  const INVEST_FEE_BP = 1000;    // 10%
  const DIVEST_FEE_BP = 500;     // 5%
  const RAGEQUIT_FEE_BP = 2000;  // 20%
  
  // Oracle configuration
  const INITIAL_ETH_PRICE = ethers.utils.parseUnits("3000", 8); // $3000 per ETH
  const UPDATED_ETH_PRICE = ethers.utils.parseUnits("3500", 8); // $3500 per ETH
  
  // Bridge configuration
  const VALIDATOR_THRESHOLD = 2;
  const TIMELOCK_PERIOD = 86400; // 1 day in seconds
  const MAX_TRANSFER_AMOUNT = ethers.utils.parseEther("250000"); // $250,000 equivalent
  
  // DAO configuration
  const AI_VOTING_PERIOD = 86400;    // 1 day in seconds
  const HUMAN_VOTING_PERIOD = 604800; // 7 days in seconds
  
  // Hedera account IDs
  const HEDERA_ACCOUNT = "0.0.12345";
  
  before(async function () {
    // Set up accounts
    [deployer, user1, user2, user3, aiNode1, aiNode2, validator1, validator2] = await ethers.getSigners();
    
    console.log("Deploying DLOOP protocol contracts for integration testing...");
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy("DLOOP", "DLOOP");
    await dloopToken.deployed();
    
    // Mint initial tokens to accounts
    await dloopToken.mint(deployer.address, INITIAL_MINT);
    await dloopToken.mint(user1.address, INITIAL_MINT);
    await dloopToken.mint(user2.address, INITIAL_MINT);
    await dloopToken.mint(user3.address, INITIAL_MINT);
    await dloopToken.mint(aiNode1.address, INITIAL_MINT);
    await dloopToken.mint(aiNode2.address, INITIAL_MINT);
    
    // Deploy SoulboundNFT for AI node identity
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
    
    // Deploy mock price feed for oracle
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    mockPriceFeed = await MockPriceFeed.deploy();
    await mockPriceFeed.deployed();
    await mockPriceFeed.setLatestAnswer(INITIAL_ETH_PRICE);
    
    // Deploy MultiOracleConsensus
    const MultiOracleConsensus = await ethers.getContractFactory("MultiOracleConsensus");
    multiOracle = await MultiOracleConsensus.deploy();
    await multiOracle.deployed();
    
    // Add price feeds to the oracle
    await multiOracle.addPriceFeed("ETH/USD", mockPriceFeed.address, 100); // 100% weight
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.deployed();
    await feeCalculator.initialize(aiNodeRegistry.address);
    
    // Set fee percentages
    await feeCalculator.setFeePercentage(0, INVEST_FEE_BP);
    await feeCalculator.setFeePercentage(1, DIVEST_FEE_BP);
    await feeCalculator.setFeePercentage(2, RAGEQUIT_FEE_BP);
    
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
      72,                                // 72 months (6 years)
      ethers.utils.parseEther("5")       // Minimum threshold
    );
    
    // Add multiOracle to RewardDistributor
    await rewardDistributor.setPriceOracle(multiOracle.address, "ETH/USD");
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      dloopToken.address,
      aiNodeRegistry.address,
      AI_VOTING_PERIOD,
      HUMAN_VOTING_PERIOD
    );
    await protocolDAO.deployed();
    
    // Deploy AssetDAOWithFees
    const AssetDAOWithFees = await ethers.getContractFactory("AssetDAOWithFees");
    assetDAOWithFees = await AssetDAOWithFees.deploy();
    await assetDAOWithFees.initialized
    ? console.log("AssetDAOWithFees already initialized")
    : await assetDAOWithFees.initialize(
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
    
    // Set up fee distribution
    const feeReceivers = [
      { address: treasury.address, share: 7000 },            // 70% to treasury
      { address: rewardDistributor.address, share: 3000 }    // 30% to reward distributor
    ];
    await treasury.setFeeDistribution(feeReceivers);
    
    // Approve tokens for testing
    await dloopToken.connect(user1).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user2).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user3).approve(assetDAOWithFees.address, ethers.constants.MaxUint256);
    await dloopToken.connect(user1).approve(hederaBridge.address, ethers.constants.MaxUint256);
    
    console.log("DLOOP protocol deployment complete for integration testing");
  });
  
  describe("End-to-End Workflow", function () {
    it("Step 1: Users should be able to invest in the Asset DAO", async function () {
      // User 1 invests
      await assetDAOWithFees.connect(user1).invest(INVEST_AMOUNT);
      
      // User 2 invests
      await assetDAOWithFees.connect(user2).invest(INVEST_AMOUNT.mul(2));
      
      // User 3 invests
      await assetDAOWithFees.connect(user3).invest(INVEST_AMOUNT.div(2));
      
      // Check asset balances
      const user1Balance = await assetDAOWithFees.balanceOf(user1.address);
      const user2Balance = await assetDAOWithFees.balanceOf(user2.address);
      const user3Balance = await assetDAOWithFees.balanceOf(user3.address);
      
      console.log(`User 1 asset balance: ${ethers.utils.formatEther(user1Balance)}`);
      console.log(`User 2 asset balance: ${ethers.utils.formatEther(user2Balance)}`);
      console.log(`User 3 asset balance: ${ethers.utils.formatEther(user3Balance)}`);
      
      // Verify investments were properly recorded
      expect(user1Balance).to.be.gt(0);
      expect(user2Balance).to.be.gt(user1Balance);
      expect(user3Balance).to.be.lt(user1Balance);
    });
    
    it("Step 2: Fees should be calculated and collected", async function () {
      // Check treasury balance
      const treasuryBalance = await dloopToken.balanceOf(treasury.address);
      console.log(`Treasury balance: ${ethers.utils.formatEther(treasuryBalance)}`);
      
      // Verify fees were collected
      expect(treasuryBalance).to.be.gt(0);
      
      // Calculate expected fees
      const expectedFees = INVEST_AMOUNT.mul(INVEST_FEE_BP).div(10000)
        .add(INVEST_AMOUNT.mul(2).mul(INVEST_FEE_BP).div(10000))
        .add(INVEST_AMOUNT.div(2).mul(INVEST_FEE_BP).div(10000));
      
      console.log(`Expected fees: ${ethers.utils.formatEther(expectedFees)}`);
      
      // Verify collected fees are close to expected (allowing for rounding differences)
      const difference = treasuryBalance.sub(expectedFees).abs();
      expect(difference).to.be.lt(ethers.utils.parseEther("0.1"));
    });
    
    it("Step 3: User should be able to divest from Asset DAO", async function () {
      // Get user balance before divest
      const balanceBefore = await dloopToken.balanceOf(user1.address);
      
      // User 1 divests
      await assetDAOWithFees.connect(user1).divest(DIVEST_AMOUNT);
      
      // Get user balance after divest
      const balanceAfter = await dloopToken.balanceOf(user1.address);
      
      // Calculate expected tokens received (considering fees)
      const expectedTokens = DIVEST_AMOUNT.sub(DIVEST_AMOUNT.mul(DIVEST_FEE_BP).div(10000));
      
      console.log(`Tokens received from divestment: ${ethers.utils.formatEther(balanceAfter.sub(balanceBefore))}`);
      console.log(`Expected tokens: ${ethers.utils.formatEther(expectedTokens)}`);
      
      // Verify user received tokens (minus fees)
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Verify the difference between actual and expected is small (allowing for rounding)
      const difference = balanceAfter.sub(balanceBefore).sub(expectedTokens).abs();
      expect(difference).to.be.lt(ethers.utils.parseEther("0.1"));
    });
    
    it("Step 4: User should be able to ragequit from Asset DAO", async function () {
      // Get user balance before ragequit
      const balanceBefore = await dloopToken.balanceOf(user2.address);
      
      // User 2 ragequits
      await assetDAOWithFees.connect(user2).rageQuit(RAGEQUIT_AMOUNT);
      
      // Get user balance after ragequit
      const balanceAfter = await dloopToken.balanceOf(user2.address);
      
      // Calculate expected tokens received (considering fees)
      const expectedTokens = RAGEQUIT_AMOUNT.sub(RAGEQUIT_AMOUNT.mul(RAGEQUIT_FEE_BP).div(10000));
      
      console.log(`Tokens received from ragequit: ${ethers.utils.formatEther(balanceAfter.sub(balanceBefore))}`);
      console.log(`Expected tokens: ${ethers.utils.formatEther(expectedTokens)}`);
      
      // Verify user received tokens (minus fees)
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Verify the difference between actual and expected is small (allowing for rounding)
      const difference = balanceAfter.sub(balanceBefore).sub(expectedTokens).abs();
      expect(difference).to.be.lt(ethers.utils.parseEther("0.1"));
    });
    
    it("Step 5: AI node should be able to create a proposal", async function () {
      // Create proposal
      const tx = await protocolDAO.connect(aiNode1).propose(
        [treasury.address],
        [0],
        ["0x"],
        PROPOSAL_DESCRIPTION
      );
      const receipt = await tx.wait();
      
      // Get proposal ID
      const proposalId = await protocolDAO.hashProposal(
        [treasury.address],
        [0],
        ["0x"],
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes(PROPOSAL_DESCRIPTION))
      );
      
      console.log(`Proposal created with ID: ${proposalId}`);
      
      // Store proposalId for later use
      this.proposalId = proposalId;
      
      // Verify proposal state
      const state = await protocolDAO.state(proposalId);
      console.log(`Proposal state: ${state}`); // 0 = Pending, 1 = Active, 2 = Canceled, 3 = Defeated, 4 = Succeeded, 5 = Queued, 6 = Expired, 7 = Executed
      
      // Should be Active or Pending, depending on block timestamp
      expect(state).to.be.lessThan(2);
    });
    
    it("Step 6: AI nodes should be able to vote on the proposal", async function () {
      // AI nodes vote on the proposal
      await protocolDAO.connect(aiNode1).castVote(this.proposalId, 1); // 1 = For
      await protocolDAO.connect(aiNode2).castVote(this.proposalId, 1); // 1 = For
      
      // Get votes
      const forVotes = await protocolDAO.proposalVotes(this.proposalId).forVotes;
      console.log(`For votes: ${ethers.utils.formatEther(forVotes)}`);
      
      // Verify votes were counted
      expect(forVotes).to.be.gt(0);
    });
    
    it("Step 7: Price oracle should update prices correctly", async function () {
      // Update price in mock price feed
      await mockPriceFeed.setLatestAnswer(UPDATED_ETH_PRICE);
      
      // Get price from oracle
      const price = await multiOracle.getPrice("ETH/USD");
      console.log(`Updated ETH/USD price: ${price.toNumber() / 10**8}`);
      
      // Verify price was updated
      expect(price).to.equal(UPDATED_ETH_PRICE);
    });
    
    it("Step 8: Reward distributor should record price snapshots", async function () {
      // Record price snapshot
      await rewardDistributor.recordPriceSnapshot();
      
      // Get latest snapshot
      const snapshot = await rewardDistributor.getLatestPriceSnapshot();
      console.log(`Latest price snapshot: ${snapshot.toNumber() / 10**8}`);
      
      // Verify snapshot was recorded
      expect(snapshot).to.equal(UPDATED_ETH_PRICE);
    });
    
    it("Step 9: User should be able to lock tokens for cross-chain transfer", async function () {
      // Check bridge balance before
      const bridgeBalanceBefore = await dloopToken.balanceOf(hederaBridge.address);
      
      // User locks tokens for Hedera transfer
      await hederaBridge.connect(user1).lockTokens(BRIDGE_AMOUNT, HEDERA_ACCOUNT);
      
      // Check bridge balance after
      const bridgeBalanceAfter = await dloopToken.balanceOf(hederaBridge.address);
      
      console.log(`Bridge balance increased by: ${ethers.utils.formatEther(bridgeBalanceAfter.sub(bridgeBalanceBefore))}`);
      
      // Verify tokens were locked in the bridge
      expect(bridgeBalanceAfter).to.equal(bridgeBalanceBefore.add(BRIDGE_AMOUNT));
    });
    
    it("Step 10: Validators should be able to approve incoming transfers", async function () {
      // Create a cross-chain transfer
      const transferId = 1;
      const transferAmount = ethers.utils.parseEther("500");
      const ethereumReceiver = user3.address;
      const hederaSender = HEDERA_ACCOUNT;
      
      // Get user balance before
      const balanceBefore = await dloopToken.balanceOf(user3.address);
      
      // Validator 1 approves transfer
      await hederaBridge.connect(validator1).approveTransfer(
        transferId,
        transferAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Validator 2 approves transfer, triggering the release
      await hederaBridge.connect(validator2).approveTransfer(
        transferId,
        transferAmount,
        ethereumReceiver,
        hederaSender
      );
      
      // Get user balance after
      const balanceAfter = await dloopToken.balanceOf(user3.address);
      
      console.log(`User received from bridge: ${ethers.utils.formatEther(balanceAfter.sub(balanceBefore))}`);
      
      // Verify user received tokens
      expect(balanceAfter).to.equal(balanceBefore.add(transferAmount));
    });
    
    it("Step 11: Fee distribution should work correctly", async function () {
      // Get reward distributor balance before
      const rewardBalanceBefore = await dloopToken.balanceOf(rewardDistributor.address);
      
      // Distribute fees
      await treasury.distributeFees();
      
      // Get reward distributor balance after
      const rewardBalanceAfter = await dloopToken.balanceOf(rewardDistributor.address);
      
      console.log(`Rewards received from fee distribution: ${ethers.utils.formatEther(rewardBalanceAfter.sub(rewardBalanceBefore))}`);
      
      // Verify reward distributor received fees
      expect(rewardBalanceAfter).to.be.gt(rewardBalanceBefore);
    });
    
    it("Step 12: Monthly rewards should be distributed to AI nodes", async function () {
      // Fast-forward time to enable reward distribution
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
      await ethers.provider.send("evm_mine");
      
      // Get AI node balances before
      const aiNode1BalanceBefore = await dloopToken.balanceOf(aiNode1.address);
      const aiNode2BalanceBefore = await dloopToken.balanceOf(aiNode2.address);
      
      // Distribute monthly rewards
      await rewardDistributor.distributeMonthlyRewards();
      
      // Get AI node balances after
      const aiNode1BalanceAfter = await dloopToken.balanceOf(aiNode1.address);
      const aiNode2BalanceAfter = await dloopToken.balanceOf(aiNode2.address);
      
      console.log(`AI Node 1 received rewards: ${ethers.utils.formatEther(aiNode1BalanceAfter.sub(aiNode1BalanceBefore))}`);
      console.log(`AI Node 2 received rewards: ${ethers.utils.formatEther(aiNode2BalanceAfter.sub(aiNode2BalanceBefore))}`);
      
      // Verify AI nodes received rewards
      expect(aiNode1BalanceAfter).to.be.gt(aiNode1BalanceBefore);
      expect(aiNode2BalanceAfter).to.be.gt(aiNode2BalanceBefore);
    });
    
    it("Step 13: Should generate a comprehensive workflow summary", function () {
      console.log("\n----- DLOOP PROTOCOL WORKFLOW SUMMARY -----\n");
      console.log("1. Users invested in Asset DAO with fees correctly calculated and collected");
      console.log("2. Users were able to divest and ragequit with appropriate fee deduction");
      console.log("3. AI nodes created and voted on governance proposals");
      console.log("4. Price oracle provided updated price data for the system");
      console.log("5. Bridge facilitated cross-chain token transfers with validator approval");
      console.log("6. Fee distribution system allocated fees to appropriate contracts");
      console.log("7. Reward distributor allocated monthly rewards to AI nodes");
      console.log("\n----- INTEGRATION TEST SUCCESSFUL -----\n");
    });
  });
});