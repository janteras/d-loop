const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { keccak256, toUtf8Bytes } = require("ethers");
const { ethers } = require("hardhat");

describe("FeeProcessor Integration", function () {
  let FeeCalculator, Treasury, RewardDistributor, FeeProcessor, MockToken, MockAINodeIdentifier;
  let feeCalculator, treasury, rewardDistributor, feeProcessor, mockToken, mockAINodeIdentifier;
  let owner, user, aiNode;
  
  // Constants for testing
  const FEE_HANDLER_ROLE = keccak256(toUtf8Bytes("FEE_HANDLER_ROLE"));
  const FEE_COLLECTOR_ROLE = keccak256(toUtf8Bytes("FEE_COLLECTOR_ROLE"));
  const REWARD_MANAGER_ROLE = keccak256(toUtf8Bytes("REWARD_MANAGER_ROLE"));
  
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
          ethers.utils.parseEther("50"), // 5% fee
          ethers.utils.parseEther("35"),  // 70% to treasury
          ethers.utils.parseEther("15")   // 30% to rewards
        );
      
      // Check token balances
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9900")); // 10k - 1k + 950
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("35"));
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(ethers.utils.parseEther("15"));
    });
  });
});
