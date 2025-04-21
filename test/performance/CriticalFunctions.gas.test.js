/**
 * @title Critical Functions Gas Profiling Test
 * @dev Comprehensive gas profiling for critical functions in the D-Loop Protocol
 * 
 * This test measures gas consumption for key operations and compares against baseline values.
 * It helps ensure gas optimizations don't break functionality and identifies potential issues.
 */

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const fs = require('fs');
const path = require('path');

// Gas baseline file path
const GAS_BASELINE_PATH = path.join(__dirname, '../../reports/gas-baseline.json');

// Gas limits for critical functions
const GAS_LIMITS = {
  // Token operations
  'daiTransfer': 55000,
  'daiApprove': 48000,
  'dloopTransfer': 55000,
  'dloopApprove': 48000,
  
  // Asset operations
  'assetCreation': 250000,
  'assetInvestment': 180000,
  'assetWithdrawal': 150000,
  
  // Governance operations
  'createProposal': 200000,
  'castVote': 80000,
  'executeProposal': 250000,
  
  // Node operations
  'registerNode': 300000,
  'deregisterNode': 150000,
  'updateNodeStatus': 100000,
  
  // Fee operations
  'calculateFee': 30000,
  'processFee': 120000,
  'distributeFees': 200000,
  
  // Treasury operations
  'treasuryWithdrawal': 90000,
  'treasuryDeposit': 70000,
  'distributeRewards': 180000
};

// Acceptable percentage increase from baseline
const ACCEPTABLE_INCREASE_PERCENTAGE = 3.2;

// Helper function to load gas baseline
function loadGasBaseline() {
  try {
    if (fs.existsSync(GAS_BASELINE_PATH)) {
      return JSON.parse(fs.readFileSync(GAS_BASELINE_PATH, 'utf8'));
    }
  } catch (error) {
    console.error(`Error loading gas baseline: ${error.message}`);
  }
  
  return {};
}

// Helper function to save gas baseline
function saveGasBaseline(baseline) {
  try {
    // Create reports directory if it doesn't exist
    const reportsDir = path.dirname(GAS_BASELINE_PATH);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(GAS_BASELINE_PATH, JSON.stringify(baseline, null, 2));
    console.log(`Gas baseline saved to ${GAS_BASELINE_PATH}`);
  } catch (error) {
    console.error(`Error saving gas baseline: ${error.message}`);
  }
}

// Helper function to measure gas usage
async function measureGas(tx) {
  const receipt = await tx.wait();
  return receipt.gasUsed;
}

describe("D-Loop Protocol Gas Profiling", function() {
  // Load gas baseline
  const gasBaseline = loadGasBaseline();
  const gasResults = {};
  
  // Helper function to check gas usage against baseline and limits
  function checkGasUsage(functionName, gasUsed) {
    const baseline = gasBaseline[functionName];
    const limit = GAS_LIMITS[functionName];
    
    gasResults[functionName] = gasUsed;
    
    console.log(`${functionName} gas usage: ${gasUsed}`);
    
    if (baseline) {
      const percentChange = ((gasUsed - baseline) / baseline) * 100;
      console.log(`  Baseline: ${baseline}, Change: ${percentChange.toFixed(2)}%`);
      
      if (percentChange > ACCEPTABLE_INCREASE_PERCENTAGE) {
        console.warn(`  WARNING: Gas usage increased by ${percentChange.toFixed(2)}% over baseline`);
      }
    } else {
      console.log(`  No baseline available for comparison`);
    }
    
    if (limit) {
      console.log(`  Limit: ${limit}`);
      
      if (gasUsed > limit) {
        console.warn(`  WARNING: Gas usage exceeds limit of ${limit}`);
      }
    } else {
      console.log(`  No limit defined`);
    }
    
    console.log('');
  }
  
  // Deploy all contracts for testing
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
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
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
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    const aiNodeGovernance = await AINodeGovernance.deploy(
      await dloopToken.getAddress(),
      10, // 10% quorum for testing
      1   // 1 block delay for testing
    );
    await aiNodeGovernance.waitForDeployment();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      admin.address,
      await dloopToken.getAddress()
    );
    await governanceRewards.waitForDeployment();
    
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
    await daiToken.connect(owner).transfer(await treasury.getAddress(), ethers.parseEther("50000"));
    
    return { 
      daiToken, dloopToken, soulboundNFT, priceOracle, feeCalculator, feeProcessor, 
      protocolDAO, assetDAO, treasury, aiNodeRegistry, aiNodeGovernance, governanceRewards,
      owner, admin, user1, user2, node1, node2
    };
  }
  
  describe("Token Operations Gas Profiling", function() {
    it("should profile DAI token operations", async function() {
      const { daiToken, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure DAI transfer gas usage
      const transferAmount = ethers.parseEther("100");
      const transferTx = await daiToken.connect(user1).transfer(user2.address, transferAmount);
      const transferGas = await measureGas(transferTx);
      checkGasUsage('daiTransfer', transferGas);
      
      // Measure DAI approve gas usage
      const approveTx = await daiToken.connect(user1).approve(user2.address, transferAmount);
      const approveGas = await measureGas(approveTx);
      checkGasUsage('daiApprove', approveGas);
    });
    
    it("should profile DLOOP token operations", async function() {
      const { dloopToken, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure DLOOP transfer gas usage
      const transferAmount = ethers.parseEther("100");
      const transferTx = await dloopToken.connect(user1).transfer(user2.address, transferAmount);
      const transferGas = await measureGas(transferTx);
      checkGasUsage('dloopTransfer', transferGas);
      
      // Measure DLOOP approve gas usage
      const approveTx = await dloopToken.connect(user1).approve(user2.address, transferAmount);
      const approveGas = await measureGas(approveTx);
      checkGasUsage('dloopApprove', approveGas);
    });
  });
  
  describe("Asset Operations Gas Profiling", function() {
    it("should profile asset creation and investment", async function() {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure asset creation gas usage
      const createAssetTx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      const createAssetGas = await measureGas(createAssetTx);
      checkGasUsage('assetCreation', createAssetGas);
      
      // Get asset ID
      const receipt = await createAssetTx.wait();
      const assetCreatedEvent = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "AssetCreated"
      );
      const assetId = assetCreatedEvent.args.assetId;
      
      // Approve tokens for investment
      const investAmount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      
      // Measure asset investment gas usage
      const investTx = await assetDAO.connect(user1).invest(assetId, investAmount);
      const investGas = await measureGas(investTx);
      checkGasUsage('assetInvestment', investGas);
      
      // Measure asset withdrawal gas usage
      const withdrawAmount = ethers.parseEther("500");
      const withdrawTx = await assetDAO.connect(user1).withdraw(assetId, withdrawAmount);
      const withdrawGas = await measureGas(withdrawTx);
      checkGasUsage('assetWithdrawal', withdrawGas);
    });
  });
  
  describe("Governance Operations Gas Profiling", function() {
    it("should profile governance operations", async function() {
      const { aiNodeGovernance, dloopToken, user1, user2 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure proposal creation gas usage
      const proposalDescription = "Test Proposal";
      const proposalData = ethers.randomBytes(32);
      const createProposalTx = await aiNodeGovernance.connect(user1).submitProposal(
        proposalDescription,
        proposalData
      );
      const createProposalGas = await measureGas(createProposalTx);
      checkGasUsage('createProposal', createProposalGas);
      
      // Get proposal ID
      const receipt = await createProposalTx.wait();
      const proposalEvent = receipt.logs.find(log => 
        log.fragment && log.fragment.name === "ProposalSubmitted"
      );
      const proposalId = proposalEvent.args.proposalId;
      
      // Measure vote casting gas usage
      const voteTx = await aiNodeGovernance.connect(user1).castVote(proposalId, true);
      const voteGas = await measureGas(voteTx);
      checkGasUsage('castVote', voteGas);
      
      // Have user2 vote as well to reach quorum
      await aiNodeGovernance.connect(user2).castVote(proposalId, true);
      
      // Advance blocks for voting period
      for (let i = 0; i < 10; i++) {
        await ethers.provider.send("evm_mine");
      }
      
      // Measure proposal execution gas usage
      const executeTx = await aiNodeGovernance.connect(user1).executeProposal(proposalId);
      const executeGas = await measureGas(executeTx);
      checkGasUsage('executeProposal', executeGas);
    });
  });
  
  describe("Node Operations Gas Profiling", function() {
    it("should profile node registration and management", async function() {
      const { aiNodeRegistry, dloopToken, soulboundNFT, node1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure node registration gas usage
      const stakeAmount = ethers.parseEther("1000");
      await dloopToken.connect(node1).approve(await aiNodeRegistry.getAddress(), stakeAmount);
      
      const registerTx = await aiNodeRegistry.connect(node1).registerNode(stakeAmount);
      const registerGas = await measureGas(registerTx);
      checkGasUsage('registerNode', registerGas);
      
      // Measure node status update gas usage
      const updateStatusTx = await aiNodeRegistry.connect(node1).updateNodeStatus(false);
      const updateStatusGas = await measureGas(updateStatusTx);
      checkGasUsage('updateNodeStatus', updateStatusGas);
      
      // Measure node deregistration gas usage
      const deregisterTx = await aiNodeRegistry.connect(node1).deregisterNode();
      const deregisterGas = await measureGas(deregisterTx);
      checkGasUsage('deregisterNode', deregisterGas);
    });
  });
  
  describe("Fee Operations Gas Profiling", function() {
    it("should profile fee calculation and processing", async function() {
      const { feeCalculator, feeProcessor, daiToken, owner, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure fee calculation gas usage
      const amount = ethers.parseEther("1000");
      const calculateFeeTx = await feeCalculator.calculateFee(0, amount); // 0 = INVEST type
      const calculateFeeGas = await measureGas(calculateFeeTx);
      checkGasUsage('calculateFee', calculateFeeGas);
      
      // Measure fee processing gas usage
      const feeAmount = ethers.parseEther("50");
      await daiToken.connect(owner).transfer(await feeProcessor.getAddress(), feeAmount);
      
      const processFeeTx = await feeProcessor.connect(owner).processFee(
        await daiToken.getAddress(),
        feeAmount,
        0 // 0 = INVEST type
      );
      const processFeeGas = await measureGas(processFeeTx);
      checkGasUsage('processFee', processFeeGas);
      
      // Measure fee distribution gas usage
      const distributeFeeTx = await feeProcessor.connect(owner).distributeFees();
      const distributeFeeGas = await measureGas(distributeFeeTx);
      checkGasUsage('distributeFees', distributeFeeGas);
    });
  });
  
  describe("Treasury Operations Gas Profiling", function() {
    it("should profile treasury operations", async function() {
      const { treasury, daiToken, owner, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Measure treasury deposit gas usage
      const depositAmount = ethers.parseEther("1000");
      await daiToken.connect(owner).approve(await treasury.getAddress(), depositAmount);
      
      const depositTx = await treasury.connect(owner).deposit(
        await daiToken.getAddress(),
        depositAmount
      );
      const depositGas = await measureGas(depositTx);
      checkGasUsage('treasuryDeposit', depositGas);
      
      // Measure treasury withdrawal gas usage
      const withdrawAmount = ethers.parseEther("500");
      const withdrawTx = await treasury.connect(owner).withdraw(
        await daiToken.getAddress(),
        user1.address,
        withdrawAmount
      );
      const withdrawGas = await measureGas(withdrawTx);
      checkGasUsage('treasuryWithdrawal', withdrawGas);
      
      // Measure reward distribution gas usage
      const rewardAmount = ethers.parseEther("250");
      const distributeTx = await treasury.connect(owner).distributeRewards(
        await daiToken.getAddress(),
        [user1.address],
        [rewardAmount]
      );
      const distributeGas = await measureGas(distributeTx);
      checkGasUsage('distributeRewards', distributeGas);
    });
  });
  
  after(function() {
    // Save gas results as new baseline if requested
    if (process.env.UPDATE_GAS_BASELINE === 'true') {
      saveGasBaseline(gasResults);
    }
    
    // Print gas usage report
    console.log('\n=== Gas Usage Analysis ===');
    console.log('Function                 | Current | Baseline | % Change | Hard Limit | Status');
    console.log('----------------------------------------------------------------------------------');
    
    for (const [functionName, gasUsed] of Object.entries(gasResults)) {
      const baseline = gasBaseline[functionName];
      const limit = GAS_LIMITS[functionName];
      
      let percentChange = baseline ? ((gasUsed - baseline) / baseline) * 100 : 0;
      let status = 'OK';
      
      if (baseline && percentChange > ACCEPTABLE_INCREASE_PERCENTAGE) {
        status = `EXCEEDS BASELINE (+${percentChange.toFixed(2)}%)`;
      }
      
      if (limit && gasUsed > limit) {
        status = 'EXCEEDS LIMIT';
      }
      
      console.log(
        `${functionName.padEnd(25)} | ${gasUsed.toString().padStart(7)} | ${baseline ? baseline.toString().padStart(8) : '    N/A'} | ${
          baseline ? percentChange.toFixed(2).padStart(6) + '%' : '   N/A'
        } | ${limit ? limit.toString().padStart(9) : '    N/A'} | ${status}`
      );
    }
  });
});
