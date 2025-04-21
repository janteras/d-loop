const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FeeProcessor Integration", function () {
  let FeeCalculator, Treasury, RewardDistributor, FeeProcessor, MockToken, MockAINodeIdentifier;
  let feeCalculator, treasury, rewardDistributor, feeProcessor, mockToken, mockAINodeIdentifier;
  let owner, user, aiNode;
  
  // Constants for testing
  const FEE_HANDLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_HANDLER_ROLE"));
  const FEE_COLLECTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_COLLECTOR_ROLE"));
  const REWARD_MANAGER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("REWARD_MANAGER_ROLE"));
  
  beforeEach(async function () {
    [owner, user, aiNode] = await ethers.getSigners();
    
    // Deploy mock AI node identifier
    MockAINodeIdentifier = await ethers.getContractFactory("MockAINodeIdentifier");
    mockAINodeIdentifier = await MockAINodeIdentifier.deploy();
    await mockAINodeIdentifier.deployed();
    
    // Set AI node
    await mockAINodeIdentifier.setNodeActive(aiNode.address, true);
    
    // Deploy mock ERC20 token
    MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    await mockToken.deployed();
    
    // Mint tokens to user
    await mockToken.mint(user.address, ethers.utils.parseEther("10000"));
    
    // Deploy Treasury
    Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.deployed();
    
    // Deploy FeeCalculator
    FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await upgrades.deployProxy(FeeCalculator, [
      treasury.address,
      owner.address // Temporary rewardDistributor placeholder
    ]);
    await feeCalculator.deployed();
    
    // Deploy RewardDistributor
    RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      mockAINodeIdentifier.address,
      30 * 24 * 60 * 60 // 30 day distribution period
    ]);
    await rewardDistributor.deployed();
    
    // Update fee recipients in FeeCalculator
    await feeCalculator.updateFeeRecipients(treasury.address, rewardDistributor.address);
    
    // Deploy FeeProcessor
    FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await upgrades.deployProxy(FeeProcessor, [
      feeCalculator.address,
      treasury.address,
      rewardDistributor.address
    ]);
    await feeProcessor.deployed();
    
    // Grant roles
    await treasury.grantRole(FEE_COLLECTOR_ROLE, feeProcessor.address);
    await rewardDistributor.grantRole(FEE_COLLECTOR_ROLE, feeProcessor.address);
    await rewardDistributor.grantRole(REWARD_MANAGER_ROLE, owner.address);
    await feeProcessor.grantRole(FEE_HANDLER_ROLE, user.address); // For testing
  });
  
  describe("Fee Processing Flow", function () {
    it("should process investment fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Approve FeeProcessor to spend tokens
      await mockToken.connect(user).approve(feeProcessor.address, amount);
      
      // Create reward pool
      await feeProcessor.createRewardPool(
        mockToken.address,
        8000, // 80% to governance
        2000  // 20% to AI nodes
      );
      
      // Process investment fee
      await expect(
        feeProcessor.connect(user).processInvestmentFee(mockToken.address, amount)
      )
        .to.emit(feeProcessor, "FeeProcessed")
        .withArgs(
          mockToken.address,
          "INVEST",
          amount,
          ethers.utils.parseEther("100"), // 10% fee
          ethers.utils.parseEther("70"),  // 70% to treasury
          ethers.utils.parseEther("30")   // 30% to rewards
        );
      
      // Check token balances
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9900")); // 10k - 1k + 900
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("70"));
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(ethers.utils.parseEther("30"));
    });
    
    it("should process divestment fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Approve FeeProcessor to spend tokens
      await mockToken.connect(user).approve(feeProcessor.address, amount);
      
      // Create reward pool
      await feeProcessor.createRewardPool(
        mockToken.address,
        8000, // 80% to governance
        2000  // 20% to AI nodes
      );
      
      // Process divestment fee
      await expect(
        feeProcessor.connect(user).processDivestmentFee(mockToken.address, amount)
      )
        .to.emit(feeProcessor, "FeeProcessed")
        .withArgs(
          mockToken.address,
          "DIVEST",
          amount,
          ethers.utils.parseEther("50"),  // 5% fee
          ethers.utils.parseEther("35"),  // 70% to treasury
          ethers.utils.parseEther("15")   // 30% to rewards
        );
      
      // Check token balances
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9950")); // 10k - 1k + 950
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("35"));
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(ethers.utils.parseEther("15"));
    });
    
    it("should process ragequit fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Approve FeeProcessor to spend tokens
      await mockToken.connect(user).approve(feeProcessor.address, amount);
      
      // Create reward pool
      await feeProcessor.createRewardPool(
        mockToken.address,
        8000, // 80% to governance
        2000  // 20% to AI nodes
      );
      
      // Process ragequit fee
      await expect(
        feeProcessor.connect(user).processRagequitFee(mockToken.address, amount)
      )
        .to.emit(feeProcessor, "FeeProcessed")
        .withArgs(
          mockToken.address,
          "RAGEQUIT",
          amount,
          ethers.utils.parseEther("200"), // 20% fee
          ethers.utils.parseEther("140"), // 70% to treasury
          ethers.utils.parseEther("60")   // 30% to rewards
        );
      
      // Check token balances
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9800")); // 10k - 1k + 800
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("140"));
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(ethers.utils.parseEther("60"));
    });
  });
  
  describe("Reward Distribution", function () {
    beforeEach(async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Approve FeeProcessor to spend tokens
      await mockToken.connect(user).approve(feeProcessor.address, amount);
      
      // Create reward pool and process fee
      await feeProcessor.createRewardPool(
        mockToken.address,
        8000, // 80% to governance
        2000  // 20% to AI nodes
      );
      
      await feeProcessor.connect(user).processInvestmentFee(mockToken.address, amount);
    });
    
    it("should distribute rewards to governance participants", async function () {
      // Get reward pool ID
      const poolId = (await rewardDistributor.getPoolCount()).sub(1);
      
      // Simulate time passing
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Distribute rewards
      const distribution = await rewardDistributor.distributeRewards(poolId);
      
      // Allocate rewards
      await rewardDistributor.allocateGovernanceReward(
        user.address,
        poolId,
        distribution.governanceAmount
      );
      
      // Check pending rewards
      expect(await rewardDistributor.getPendingRewards(user.address, poolId)).to.equal(
        ethers.utils.parseEther("24") // 80% of 30 ETH
      );
      
      // Claim rewards
      await expect(
        rewardDistributor.connect(user).claimRewards(poolId)
      )
        .to.emit(rewardDistributor, "RewardClaimed")
        .withArgs(user.address, poolId, ethers.utils.parseEther("24"));
      
      // Check token balances
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9924")); // 9900 + 24
    });
    
    it("should distribute rewards to AI nodes", async function () {
      // Get reward pool ID
      const poolId = (await rewardDistributor.getPoolCount()).sub(1);
      
      // Simulate time passing
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Distribute rewards
      const distribution = await rewardDistributor.distributeRewards(poolId);
      
      // Allocate rewards
      await rewardDistributor.allocateAINodeReward(
        aiNode.address,
        poolId,
        distribution.aiNodeAmount
      );
      
      // Check pending rewards
      expect(await rewardDistributor.getPendingRewards(aiNode.address, poolId)).to.equal(
        ethers.utils.parseEther("6") // 20% of 30 ETH
      );
      
      // Claim rewards
      await expect(
        rewardDistributor.connect(aiNode).claimRewards(poolId)
      )
        .to.emit(rewardDistributor, "RewardClaimed")
        .withArgs(aiNode.address, poolId, ethers.utils.parseEther("6"));
      
      // Check token balances
      expect(await mockToken.balanceOf(aiNode.address)).to.equal(ethers.utils.parseEther("6"));
    });
  });
});