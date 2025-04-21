const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AI Governance End-to-End Integration", function () {
  // This test might take time to run due to complex setup
  this.timeout(100000);
  
  let mockToken, mockPriceOracle;
  let soulboundNFT, aiNodeRegistry, aiNodeGovernance, governanceRewards;
  let owner, aiNode1, aiNode2, humanUser1, humanUser2, governance, distributor;
  
  // Test assets
  const ETH_ADDRESS = "0x1111111111111111111111111111111111111111";
  const BTC_ADDRESS = "0x2222222222222222222222222222222222222222";
  
  // Initial prices (with 18 decimals)
  const INITIAL_ETH_PRICE = ethers.parseUnits("3000", 18);
  const INITIAL_BTC_PRICE = ethers.parseUnits("60000", 18);
  
  beforeEach(async function () {
    [owner, aiNode1, aiNode2, humanUser1, humanUser2, governance, distributor] = await ethers.getSigners();
    
    // Deploy contracts in sequence
    
    // 1. Deploy mock token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy(
      "DLOOP Token", 
      "DLOOP", 
      ethers.parseUnits("100000000", 18)
    );
    await mockToken.deployed();
    
    // 2. Deploy mock price oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    await mockPriceOracle.deployed();
    
    // Set initial prices
    await mockPriceOracle.setAssetPrice(ETH_ADDRESS, INITIAL_ETH_PRICE);
    await mockPriceOracle.setAssetPrice(BTC_ADDRESS, INITIAL_BTC_PRICE);
    
    // 3. Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // 4. Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
    await aiNodeRegistry.deployed();
    
    // 5. Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(aiNodeRegistry.address);
    await aiNodeGovernance.deployed();
    
    // 6. Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      mockToken.address,
      mockPriceOracle.address
    );
    await governanceRewards.deployed();
    
    // 7. Setup roles and permissions
    
    // Grant MINTER_ROLE to AINodeRegistry
    await soulboundNFT.grantRole(
      await soulboundNFT.MINTER_ROLE(),
      aiNodeRegistry.address
    );
    
    // Grant VERIFIER_ROLE to owner
    await soulboundNFT.grantRole(
      await soulboundNFT.VERIFIER_ROLE(),
      owner.address
    );
    
    // Grant GOVERNANCE_ROLE to governance account in AINodeRegistry
    await aiNodeRegistry.grantRole(
      await aiNodeRegistry.GOVERNANCE_ROLE(),
      governance.address
    );
    
    // Grant ADMIN_ROLE to governance account in AINodeGovernance
    await aiNodeGovernance.grantRole(
      await aiNodeGovernance.ADMIN_ROLE(),
      governance.address
    );
    
    // Grant GOVERNANCE_ROLE to governance account in GovernanceRewards
    await governanceRewards.grantRole(
      await governanceRewards.GOVERNANCE_ROLE(),
      governance.address
    );
    
    // Grant DISTRIBUTOR_ROLE to distributor account in GovernanceRewards
    await governanceRewards.grantRole(
      await governanceRewards.DISTRIBUTOR_ROLE(),
      distributor.address
    );
    
    // 8. Transfer tokens for testing
    await mockToken.transfer(
      governanceRewards.address,
      ethers.parseUnits("20016000", 18)
    );
    
    await mockToken.transfer(aiNode1.address, ethers.parseUnits("1000", 18));
    await mockToken.transfer(aiNode2.address, ethers.parseUnits("1000", 18));
    await mockToken.transfer(humanUser1.address, ethers.parseUnits("1000", 18));
    await mockToken.transfer(humanUser2.address, ethers.parseUnits("1000", 18));
    
    // 9. Set a shorter decision validity period for testing
    await governanceRewards.connect(governance).updateDecisionValidityPeriod(60); // 60 seconds
  });
  
  describe("End-to-End Workflow", function () {
    beforeEach(async function () {
      // Register AI nodes
      await aiNodeRegistry.connect(governance).registerNode(
        aiNode1.address,
        "GPT-4-FINANCE",
        "PROOF_HASH_1"
      );
      
      await aiNodeRegistry.connect(governance).registerNode(
        aiNode2.address,
        "GPT-4-PREDICTION",
        "PROOF_HASH_2"
      );
    });
    
    it("should differentiate between AI nodes and humans in governance", async function () {
      // Check voting periods
      const aiNodePeriod = await aiNodeGovernance.getVotingPeriod(aiNode1.address);
      const humanPeriod = await aiNodeGovernance.getVotingPeriod(humanUser1.address);
      
      expect(aiNodePeriod).to.equal(24 * 60 * 60); // 1 day
      expect(humanPeriod).to.equal(7 * 24 * 60 * 60); // 7 days
      
      // Check quorum requirements
      const aiNodeQuorum = await aiNodeGovernance.getQuorum(true);
      const humanQuorum = await aiNodeGovernance.getQuorum(false);
      
      expect(aiNodeQuorum).to.equal(40); // 40%
      expect(humanQuorum).to.equal(30); // 30%
    });
    
    it("should track and evaluate governance decisions correctly", async function () {
      // Create proposal IDs
      const investProposalId = ethers.keccak256(ethers.toUtf8Bytes("InvestETH"));
      const divestProposalId = ethers.keccak256(ethers.toUtf8Bytes("DivestBTC"));
      
      // Record decisions - mix of AI nodes and humans
      await governanceRewards.connect(governance).recordDecision(
        aiNode1.address,
        investProposalId,
        true, // Invest
        true, // Yes vote
        ETH_ADDRESS
      );
      
      await governanceRewards.connect(governance).recordDecision(
        humanUser1.address,
        investProposalId,
        true, // Invest
        false, // No vote
        ETH_ADDRESS
      );
      
      await governanceRewards.connect(governance).recordDecision(
        aiNode2.address,
        divestProposalId,
        false, // Divest
        true, // Yes vote
        BTC_ADDRESS
      );
      
      await governanceRewards.connect(governance).recordDecision(
        humanUser2.address,
        divestProposalId,
        false, // Divest
        false, // No vote
        BTC_ADDRESS
      );
      
      // Update prices to make some decisions correct
      // ETH price increases (good for Invest+Yes, bad for Invest+No)
      await mockPriceOracle.setAssetPrice(
        ETH_ADDRESS,
        INITIAL_ETH_PRICE.mul(120).div(100) // 20% increase
      );
      
      // BTC price decreases (good for Divest+Yes, bad for Divest+No)
      await mockPriceOracle.setAssetPrice(
        BTC_ADDRESS,
        INITIAL_BTC_PRICE.mul(80).div(100) // 20% decrease
      );
      
      // Fast forward time for evaluation
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Process decisions
      await governanceRewards.processPendingDecisions(10);
      
      // Check correct decisions
      // aiNode1: Invest+Yes+PriceIncrease = Correct
      // humanUser1: Invest+No+PriceIncrease = Incorrect
      // aiNode2: Divest+Yes+PriceDecrease = Correct
      // humanUser2: Divest+No+PriceDecrease = Incorrect
      
      // Fast forward time for distribution
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
      await ethers.provider.send("evm_mine");
      
      // Get initial balances
      const initialBalanceAI1 = await mockToken.balanceOf(aiNode1.address);
      const initialBalanceAI2 = await mockToken.balanceOf(aiNode2.address);
      const initialBalanceHuman1 = await mockToken.balanceOf(humanUser1.address);
      const initialBalanceHuman2 = await mockToken.balanceOf(humanUser2.address);
      
      // Distribute rewards
      await governanceRewards.connect(distributor).distributeRewards();
      
      // Check final balances
      const finalBalanceAI1 = await mockToken.balanceOf(aiNode1.address);
      const finalBalanceAI2 = await mockToken.balanceOf(aiNode2.address);
      const finalBalanceHuman1 = await mockToken.balanceOf(humanUser1.address);
      const finalBalanceHuman2 = await mockToken.balanceOf(humanUser2.address);
      
      // Verify reward distribution
      // Only AI nodes with correct decisions should get rewards
      expect(finalBalanceAI1).to.be.gt(initialBalanceAI1);
      expect(finalBalanceAI2).to.be.gt(initialBalanceAI2);
      expect(finalBalanceHuman1).to.equal(initialBalanceHuman1);
      expect(finalBalanceHuman2).to.equal(initialBalanceHuman2);
      
      // Total rewards should be the monthly distribution amount
      const totalRewardsDistributed = 
        finalBalanceAI1.sub(initialBalanceAI1).add(
          finalBalanceAI2.sub(initialBalanceAI2)
        );
      
      expect(totalRewardsDistributed).to.equal(
        await governanceRewards.MONTHLY_REWARDS()
      );
      
      // Each AI node should get 50% of rewards (since both had 1 correct decision)
      const expectedReward = (await governanceRewards.MONTHLY_REWARDS()).div(2);
      expect(finalBalanceAI1.sub(initialBalanceAI1)).to.equal(expectedReward);
      expect(finalBalanceAI2.sub(initialBalanceAI2)).to.equal(expectedReward);
    });
    
    it("should handle AI node deactivation correctly", async function () {
      // Deactivate an AI node
      const tokenId = 0; // First token ID
      await soulboundNFT.setNodeStatus(tokenId, false);
      
      // Check voting period changes
      const deactivatedNodePeriod = await aiNodeGovernance.getVotingPeriod(aiNode1.address);
      const activeNodePeriod = await aiNodeGovernance.getVotingPeriod(aiNode2.address);
      
      expect(deactivatedNodePeriod).to.equal(7 * 24 * 60 * 60); // Now should return human voting period
      expect(activeNodePeriod).to.equal(24 * 60 * 60); // Should still return AI voting period
      
      // Create proposal ID
      const proposalId = ethers.keccak256(ethers.toUtf8Bytes("TestProposal"));
      
      // Record decisions for both nodes
      await governanceRewards.connect(governance).recordDecision(
        aiNode1.address, // Deactivated node
        proposalId,
        true,
        true,
        ETH_ADDRESS
      );
      
      await governanceRewards.connect(governance).recordDecision(
        aiNode2.address, // Active node
        proposalId,
        true,
        true,
        ETH_ADDRESS
      );
      
      // Increase ETH price
      await mockPriceOracle.setAssetPrice(
        ETH_ADDRESS,
        INITIAL_ETH_PRICE.mul(120).div(100) // 20% increase
      );
      
      // Fast forward time for evaluation
      await ethers.provider.send("evm_increaseTime", [61]); // 61 seconds
      await ethers.provider.send("evm_mine");
      
      // Process decisions
      await governanceRewards.processPendingDecisions(10);
      
      // Fast forward time for distribution
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
      await ethers.provider.send("evm_mine");
      
      // Get initial balances
      const initialBalanceAI1 = await mockToken.balanceOf(aiNode1.address);
      const initialBalanceAI2 = await mockToken.balanceOf(aiNode2.address);
      
      // Distribute rewards
      await governanceRewards.connect(distributor).distributeRewards();
      
      // Check final balances - AI status doesn't affect reward distribution, just governance
      const finalBalanceAI1 = await mockToken.balanceOf(aiNode1.address);
      const finalBalanceAI2 = await mockToken.balanceOf(aiNode2.address);
      
      // Both should receive rewards since both had correct decisions
      expect(finalBalanceAI1).to.be.gt(initialBalanceAI1);
      expect(finalBalanceAI2).to.be.gt(initialBalanceAI2);
    });
    
    it("should update governance parameters correctly", async function () {
      // New values
      const newAINodeVotingPeriod = 12 * 60 * 60; // 12 hours
      const newHumanVotingPeriod = 5 * 24 * 60 * 60; // 5 days
      const newAINodeQuorum = 50; // 50%
      const newHumanQuorum = 25; // 25%
      
      // Update parameters through governance
      await aiNodeGovernance.connect(governance).updateVotingParameters(
        newAINodeVotingPeriod,
        newHumanVotingPeriod,
        newAINodeQuorum,
        newHumanQuorum
      );
      
      // Verify changes
      expect(await aiNodeGovernance.aiNodeVotingPeriod()).to.equal(newAINodeVotingPeriod);
      expect(await aiNodeGovernance.humanVotingPeriod()).to.equal(newHumanVotingPeriod);
      expect(await aiNodeGovernance.aiNodeQuorum()).to.equal(newAINodeQuorum);
      expect(await aiNodeGovernance.humanQuorum()).to.equal(newHumanQuorum);
      
      // Check voting period changes are reflected
      const aiNodePeriod = await aiNodeGovernance.getVotingPeriod(aiNode1.address);
      const humanPeriod = await aiNodeGovernance.getVotingPeriod(humanUser1.address);
      
      expect(aiNodePeriod).to.equal(newAINodeVotingPeriod);
      expect(humanPeriod).to.equal(newHumanVotingPeriod);
    });
  });
});