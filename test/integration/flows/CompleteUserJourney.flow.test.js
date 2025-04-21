/**
 * @title Complete User Journey Flow Test
 * @dev End-to-end test simulating complete user journeys through the D-Loop Protocol
 * 
 * This test validates the entire protocol flow from user registration to governance to rewards,
 * ensuring all components work together correctly in realistic scenarios.
 */

const { ethers } = require('hardhat');
const { expect } = require('chai');
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("D-Loop Protocol Complete User Journey", function() {
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
    
    // Deploy TokenOptimizer
    const TokenOptimizer = await ethers.getContractFactory("TokenOptimizer");
    const tokenOptimizer = await TokenOptimizer.deploy();
    await tokenOptimizer.waitForDeployment();
    
    // Setup roles and permissions
    await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), await aiNodeRegistry.getAddress());
    await soulboundNFT.grantRole(await soulboundNFT.MINTER_ROLE(), owner.address);
    
    // Mint initial tokens
    const initialMint = ethers.parseEther("1000000");
    await daiToken.mint(owner.address, initialMint);
    await dloopToken.mint(owner.address, initialMint);
    
    // Transfer some tokens to users for testing
    const userAmount = ethers.parseEther("10000");
    await daiToken.connect(owner).transfer(user1.address, userAmount);
    await daiToken.connect(owner).transfer(user2.address, userAmount);
    await dloopToken.connect(owner).transfer(user1.address, userAmount);
    await dloopToken.connect(owner).transfer(user2.address, userAmount);
    await dloopToken.connect(owner).transfer(node1.address, userAmount);
    await dloopToken.connect(owner).transfer(node2.address, userAmount);
    
    // Transfer some tokens to Treasury
    await daiToken.connect(owner).transfer(await treasury.getAddress(), ethers.parseEther("50000"));
    
    return { 
      daiToken, dloopToken, soulboundNFT, priceOracle, feeCalculator, feeProcessor, 
      protocolDAO, assetDAO, treasury, aiNodeRegistry, aiNodeGovernance, governanceRewards,
      tokenOptimizer, owner, admin, user1, user2, node1, node2
    };
  }
  
  // Helper function to advance time
  async function advanceTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }
  
  // Helper function to handle contract errors
  async function handleContractCall(fn) {
    try {
      const result = await fn();
      return { success: true, result, error: null };
    } catch (error) {
      console.error(`Contract call failed: ${error.message}`);
      return { success: false, result: null, error };
    }
  }
  
  describe("Complete User Journey: Registration → Investment → Governance → Rewards", function() {
    it("should complete the full user journey from node registration to rewards distribution", async function() {
      const { 
        daiToken, dloopToken, soulboundNFT, priceOracle, assetDAO, 
        treasury, aiNodeRegistry, aiNodeGovernance, governanceRewards,
        tokenOptimizer, owner, user1, user2, node1, node2
      } = await loadFixture(deployDLoopProtocolFixture);
      
      console.log("\n===== Starting Complete User Journey Test =====");
      
      // Step 1: Node Registration and Identity Verification
      console.log("\n----- Step 1: Node Registration and Identity Verification -----");
      
      // Issue SoulboundNFT to node1 (identity verification)
      const tokenId = await soulboundNFT.mint(node1.address, "https://metadata.dloop.io/node/1");
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(node1.address);
      console.log(`Node1 received SoulboundNFT with token ID: ${tokenId}`);
      
      // Register node1 with AINodeRegistry
      const stakeAmount = ethers.parseEther("5000");
      await dloopToken.connect(node1).approve(await aiNodeRegistry.getAddress(), stakeAmount);
      await aiNodeRegistry.connect(node1).registerNode(stakeAmount);
      
      // Verify node status
      const nodeInfo = await aiNodeRegistry.getNodeInfo(node1.address);
      expect(nodeInfo.isActive).to.be.true;
      expect(nodeInfo.stakedAmount).to.equal(stakeAmount);
      console.log(`Node1 successfully registered with stake: ${ethers.formatEther(stakeAmount)} DLOOP`);
      
      // Step 2: Asset Creation
      console.log("\n----- Step 2: Asset Creation -----");
      
      // User1 creates a new asset
      const assetName = "AI Training Dataset";
      const assetMetadata = "https://metadata.dloop.io/asset/dataset";
      
      const createAssetTx = await assetDAO.connect(user1).createAsset(
        assetName,
        assetMetadata
      );
      const createAssetReceipt = await createAssetTx.wait();
      
      // Extract asset ID from event
      const assetCreatedEvent = createAssetReceipt.logs.find(log => 
        log.fragment && log.fragment.name === "AssetCreated"
      );
      const assetId = assetCreatedEvent.args.assetId;
      console.log(`Asset created with ID: ${assetId}, Name: ${assetName}`);
      
      // Step 3: Token Delegation
      console.log("\n----- Step 3: Token Delegation -----");
      
      // User2 delegates tokens to node1
      const delegationAmount = ethers.parseEther("2000");
      await dloopToken.connect(user2).approve(await tokenOptimizer.getAddress(), delegationAmount);
      await tokenOptimizer.connect(user2).delegateTokens(
        await dloopToken.getAddress(),
        node1.address,
        delegationAmount
      );
      
      // Verify delegation
      const delegation = await tokenOptimizer.getDelegation(
        await dloopToken.getAddress(),
        user2.address,
        node1.address
      );
      expect(delegation).to.equal(delegationAmount);
      console.log(`User2 delegated ${ethers.formatEther(delegationAmount)} DLOOP to Node1`);
      
      // Step 4: Asset Investment
      console.log("\n----- Step 4: Asset Investment -----");
      
      // User1 invests in the asset
      const investAmount = ethers.parseEther("5000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      
      const investTx = await assetDAO.connect(user1).invest(assetId, investAmount);
      await investTx.wait();
      
      // Verify investment shares
      const shares = await assetDAO.getInvestorShares(assetId, user1.address);
      expect(shares).to.be.gt(0);
      console.log(`User1 invested ${ethers.formatEther(investAmount)} DAI in Asset ${assetId}`);
      console.log(`User1 received ${ethers.formatEther(shares)} shares`);
      
      // Step 5: Governance Proposal
      console.log("\n----- Step 5: Governance Proposal Creation -----");
      
      // User1 creates a proposal for the asset
      const proposalDescription = "Allocate funds to node1 for AI training";
      const proposalType = 0; // Assuming 0 is INVEST type
      const proposalAmount = ethers.parseEther("1000");
      
      const createProposalTx = await assetDAO.connect(user1).createProposal(
        proposalType,
        await daiToken.getAddress(),
        proposalAmount,
        proposalDescription
      );
      const createProposalReceipt = await createProposalTx.wait();
      
      // Extract proposal ID from event
      const proposalCreatedEvent = createProposalReceipt.logs.find(log => 
        log.fragment && log.fragment.name === "ProposalCreated"
      );
      const proposalId = proposalCreatedEvent.args.proposalId;
      console.log(`Proposal created with ID: ${proposalId}, Description: ${proposalDescription}`);
      
      // Step 6: Voting on Proposal
      console.log("\n----- Step 6: Voting on Proposal -----");
      
      // User1 votes on the proposal
      await assetDAO.connect(user1).vote(proposalId, true);
      console.log("User1 voted YES on the proposal");
      
      // User2 also invests and votes
      await daiToken.connect(user2).approve(await assetDAO.getAddress(), investAmount);
      await assetDAO.connect(user2).invest(assetId, investAmount);
      await assetDAO.connect(user2).vote(proposalId, true);
      console.log("User2 invested and voted YES on the proposal");
      
      // Step 7: Price Change Simulation
      console.log("\n----- Step 7: Price Change Simulation -----");
      
      // Simulate price increase for the asset
      const newPrice = ethers.parseEther("1.2"); // 20% increase
      await priceOracle.setPrice(await daiToken.getAddress(), newPrice);
      console.log(`Asset price updated to ${ethers.formatEther(newPrice)} (20% increase)`);
      
      // Step 8: Proposal Execution
      console.log("\n----- Step 8: Proposal Execution -----");
      
      // Advance time to end voting period
      await advanceTime(86400); // 1 day
      
      // Execute the proposal
      const executeTx = await assetDAO.connect(admin).executeProposal(proposalId);
      await executeTx.wait();
      console.log("Proposal executed successfully");
      
      // Step 9: Reward Calculation and Distribution
      console.log("\n----- Step 9: Reward Calculation and Distribution -----");
      
      // Calculate rewards for good governance decision (price increased after YES vote)
      const baseReward = ethers.parseEther("100");
      const participationBonus = 20; // 20%
      const qualityMultiplier = 15; // 1.5x
      
      // Mint rewards to the governance rewards contract
      await dloopToken.mint(await governanceRewards.getAddress(), ethers.parseEther("1000"));
      
      // Distribute rewards to participants
      await governanceRewards.connect(admin).distributeRewards(
        proposalId,
        [user1.address, user2.address],
        [ethers.parseEther("60"), ethers.parseEther("40")]
      );
      console.log("Governance rewards distributed to participants");
      
      // Step 10: Fee Collection and Distribution
      console.log("\n----- Step 10: Fee Collection and Distribution -----");
      
      // Treasury distributes rewards to node operators
      const nodeReward = ethers.parseEther("200");
      await daiToken.connect(owner).transfer(await treasury.getAddress(), nodeReward);
      
      await treasury.connect(admin).distributeRewards(
        await daiToken.getAddress(),
        [node1.address],
        [nodeReward]
      );
      console.log(`Node1 received ${ethers.formatEther(nodeReward)} DAI as rewards`);
      
      // Step 11: User Withdrawal
      console.log("\n----- Step 11: User Withdrawal -----");
      
      // User1 withdraws part of their investment
      const withdrawAmount = ethers.parseEther("2000");
      await assetDAO.connect(user1).withdraw(assetId, withdrawAmount);
      console.log(`User1 withdrew ${ethers.formatEther(withdrawAmount)} DAI from Asset ${assetId}`);
      
      // Step 12: Token Undelegation
      console.log("\n----- Step 12: Token Undelegation -----");
      
      // User2 withdraws delegation from node1
      const undelegateAmount = ethers.parseEther("1000");
      await tokenOptimizer.connect(user2).withdrawDelegation(
        await dloopToken.getAddress(),
        node1.address,
        undelegateAmount
      );
      
      // Verify delegation after withdrawal
      const delegationAfter = await tokenOptimizer.getDelegation(
        await dloopToken.getAddress(),
        user2.address,
        node1.address
      );
      expect(delegationAfter).to.equal(delegationAmount - undelegateAmount);
      console.log(`User2 withdrew ${ethers.formatEther(undelegateAmount)} DLOOP delegation from Node1`);
      
      // Step 13: Node Deregistration
      console.log("\n----- Step 13: Node Deregistration -----");
      
      // Node1 deregisters from the network
      await aiNodeRegistry.connect(node1).deregisterNode();
      
      // Verify node status after deregistration
      const nodeInfoAfter = await aiNodeRegistry.getNodeInfo(node1.address);
      expect(nodeInfoAfter.isActive).to.be.false;
      console.log("Node1 successfully deregistered from the network");
      
      console.log("\n===== Complete User Journey Test Completed Successfully =====");
    });
  });
  
  describe("Edge Cases and Error Handling", function() {
    it("should handle investment in non-existent asset", async function() {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Try to invest in non-existent asset
      const nonExistentAssetId = 999;
      const investAmount = ethers.parseEther("1000");
      
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      
      // Expect the transaction to be reverted
      await expect(
        assetDAO.connect(user1).invest(nonExistentAssetId, investAmount)
      ).to.be.reverted;
    });
    
    it("should handle insufficient funds for investment", async function() {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create a new asset
      const createAssetTx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      const createAssetReceipt = await createAssetTx.wait();
      
      // Extract asset ID from event
      const assetCreatedEvent = createAssetReceipt.logs.find(log => 
        log.fragment && log.fragment.name === "AssetCreated"
      );
      const assetId = assetCreatedEvent.args.assetId;
      
      // Try to invest more than user's balance
      const userBalance = await daiToken.balanceOf(user1.address);
      const investAmount = userBalance + 1n;
      
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      
      // Expect the transaction to be reverted
      await expect(
        assetDAO.connect(user1).invest(assetId, investAmount)
      ).to.be.reverted;
    });
    
    it("should handle double voting on the same proposal", async function() {
      const { daiToken, assetDAO, user1 } = await loadFixture(deployDLoopProtocolFixture);
      
      // Create a new asset
      const createAssetTx = await assetDAO.connect(user1).createAsset(
        "Test Asset",
        "https://metadata.dloop.io/asset/1"
      );
      const createAssetReceipt = await createAssetTx.wait();
      
      // Extract asset ID from event
      const assetCreatedEvent = createAssetReceipt.logs.find(log => 
        log.fragment && log.fragment.name === "AssetCreated"
      );
      const assetId = assetCreatedEvent.args.assetId;
      
      // Invest in the asset
      const investAmount = ethers.parseEther("1000");
      await daiToken.connect(user1).approve(await assetDAO.getAddress(), investAmount);
      await assetDAO.connect(user1).invest(assetId, investAmount);
      
      // Create a proposal
      const proposalDescription = "Test Proposal";
      const proposalType = 0; // Assuming 0 is INVEST type
      const proposalAmount = ethers.parseEther("500");
      
      const createProposalTx = await assetDAO.connect(user1).createProposal(
        proposalType,
        await daiToken.getAddress(),
        proposalAmount,
        proposalDescription
      );
      const createProposalReceipt = await createProposalTx.wait();
      
      // Extract proposal ID from event
      const proposalCreatedEvent = createProposalReceipt.logs.find(log => 
        log.fragment && log.fragment.name === "ProposalCreated"
      );
      const proposalId = proposalCreatedEvent.args.proposalId;
      
      // Vote on the proposal
      await assetDAO.connect(user1).vote(proposalId, true);
      
      // Try to vote again on the same proposal
      await expect(
        assetDAO.connect(user1).vote(proposalId, true)
      ).to.be.reverted;
    });
  });
});
