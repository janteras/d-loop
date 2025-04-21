/**
 * @title Critical Economic Functions Test
 * @dev Comprehensive test suite for critical economic functions in the D-Loop Protocol
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Load ethers v6 compatibility layer
require("../utils/ethers-v6-compat");

describe("Economic Critical Functions", function () {
  // Test variables
  let governanceRewards;
  let priceOracle;
  let treasury;
  let dloopToken;
  let mockToken;
  let owner;
  let admin;
  let treasuryAdmin;
  let nodeOperator1;
  let nodeOperator2;
  let user1;
  
  // Constants
  const EPOCH_DURATION = 86400; // 1 day in seconds
  const REWARD_AMOUNT = ethers.parseEther("1000");
  const INITIAL_PRICE = ethers.parseEther("2"); // $2 per token
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, treasuryAdmin, nodeOperator1, nodeOperator2, user1] = await ethers.getSigners();
    
    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK", 18);
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // 1 million initial supply
      ethers.parseEther("10000000"), // 10 million max supply
      owner.address,
      admin.address
    );
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(owner.address, admin.address);
    
    // Set initial price
    await priceOracle.connect(admin).updatePrice(dloopToken.address, INITIAL_PRICE);
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(treasuryAdmin.address, owner.address);
    await treasury.deployed();
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      owner.address,
      admin.address,
      treasury.address,
      dloopToken.address,
      priceOracle.address,
      EPOCH_DURATION
    );
    
    // Setup roles
    const MINTER_ROLE = await dloopToken.MINTER_ROLE();
    await dloopToken.connect(owner).grantRole(MINTER_ROLE, treasury.address);
    
    // Fund treasury
    await dloopToken.connect(owner).transfer(treasury.address, ethers.parseEther("100000"));
    
    // Setup treasury to recognize governance rewards
    await treasury.connect(treasuryAdmin).setRewardsContract(governanceRewards.address, true);
    
    // Register node operators for rewards
    await governanceRewards.connect(admin).registerParticipant(nodeOperator1.address, 100); // 100 reputation points
    await governanceRewards.connect(admin).registerParticipant(nodeOperator2.address, 150); // 150 reputation points
  });
  
  describe("Critical Function: calculateRewards", function () {
    it("Should calculate rewards correctly based on reputation", async function () {
      const nodeOperator1Reward = await governanceRewards.calculateReward(nodeOperator1.address);
      const nodeOperator2Reward = await governanceRewards.calculateReward(nodeOperator2.address);
      
      // Total reputation is 250 (100 + 150)
      // nodeOperator1 should get 100/250 = 40% of rewards
      // nodeOperator2 should get 150/250 = 60% of rewards
      
      // Check that rewards are proportional to reputation
      expect(nodeOperator2Reward).to.be.gt(nodeOperator1Reward);
      
      // Check the exact ratio (allowing for small rounding errors)
      const ratio = Number(nodeOperator2Reward) / Number(nodeOperator1Reward);
      expect(ratio).to.be.closeTo(1.5, 0.01); // 150/100 = 1.5
    });
    
    it("Should return zero for non-registered participants", async function () {
      const reward = await governanceRewards.calculateReward(user1.address);
      expect(reward).to.equal(0);
    });
    
    it("Should adjust rewards based on participation level", async function () {
      // Update participation level for nodeOperator1
      await governanceRewards.connect(admin).updateParticipationLevel(nodeOperator1.address, 80); // 80% participation
      
      const nodeOperator1Reward = await governanceRewards.calculateReward(nodeOperator1.address);
      const nodeOperator2Reward = await governanceRewards.calculateReward(nodeOperator2.address);
      
      // nodeOperator1 effective reputation is now 100 * 0.8 = 80
      // Total effective reputation is 80 + 150 = 230
      // nodeOperator1 should get 80/230 = ~34.8% of rewards
      // nodeOperator2 should get 150/230 = ~65.2% of rewards
      
      // Check the exact ratio (allowing for small rounding errors)
      const ratio = Number(nodeOperator2Reward) / Number(nodeOperator1Reward);
      expect(ratio).to.be.closeTo(150/80, 0.01); // 150/80 = 1.875
    });
  });
  
  describe("Critical Function: distributeEpochRewards", function () {
    it("Should distribute rewards correctly at the end of an epoch", async function () {
      // Advance time to end of epoch
      await time.increase(EPOCH_DURATION);
      
      // Set reward amount for the epoch
      await governanceRewards.connect(admin).setEpochReward(REWARD_AMOUNT);
      
      // Get initial balances
      const initialBalance1 = await dloopToken.balanceOf(nodeOperator1.address);
      const initialBalance2 = await dloopToken.balanceOf(nodeOperator2.address);
      
      // Distribute rewards
      await expect(governanceRewards.connect(admin).distributeEpochRewards())
        .to.emit(governanceRewards, "RewardsDistributed");
      
      // Get final balances
      const finalBalance1 = await dloopToken.balanceOf(nodeOperator1.address);
      const finalBalance2 = await dloopToken.balanceOf(nodeOperator2.address);
      
      // Calculate rewards received
      const reward1 = finalBalance1 - initialBalance1;
      const reward2 = finalBalance2 - initialBalance2;
      
      // Total reputation is 250 (100 + 150)
      // nodeOperator1 should get 100/250 = 40% of rewards = 400 tokens
      // nodeOperator2 should get 150/250 = 60% of rewards = 600 tokens
      
      expect(reward1).to.be.closeTo(REWARD_AMOUNT * 100n / 250n, ethers.parseEther("0.1"));
      expect(reward2).to.be.closeTo(REWARD_AMOUNT * 150n / 250n, ethers.parseEther("0.1"));
      
      // Check that total distributed is close to REWARD_AMOUNT (allowing for small rounding errors)
      expect(reward1 + reward2).to.be.closeTo(REWARD_AMOUNT, ethers.parseEther("0.1"));
    });
    
    it("Should revert if called before epoch end", async function () {
      // Set reward amount for the epoch
      await governanceRewards.connect(admin).setEpochReward(REWARD_AMOUNT);
      
      // Try to distribute rewards before epoch end
      await expect(
        governanceRewards.connect(admin).distributeEpochRewards()
      ).to.be.revertedWith("Epoch not ended yet");
    });
    
    it("Should revert if called by non-admin", async function () {
      // Advance time to end of epoch
      await time.increase(EPOCH_DURATION);
      
      // Set reward amount for the epoch
      await governanceRewards.connect(admin).setEpochReward(REWARD_AMOUNT);
      
      // Try to distribute rewards as non-admin
      await expect(
        governanceRewards.connect(user1).distributeEpochRewards()
      ).to.be.reverted; // AccessControl error
    });
    
    it("Should start a new epoch after distribution", async function () {
      // Advance time to end of epoch
      await time.increase(EPOCH_DURATION);
      
      // Set reward amount for the epoch
      await governanceRewards.connect(admin).setEpochReward(REWARD_AMOUNT);
      
      // Distribute rewards
      await governanceRewards.connect(admin).distributeEpochRewards();
      
      // Check that a new epoch has started
      const currentEpoch = await governanceRewards.currentEpoch();
      expect(currentEpoch).to.equal(2); // Epochs start at 1
      
      // Check that the new epoch end time is set correctly
      const epochEndTime = await governanceRewards.epochEndTime();
      const expectedEndTime = (await time.latest()) + EPOCH_DURATION;
      expect(epochEndTime).to.be.closeTo(expectedEndTime, 5); // Allow for small timing differences
    });
  });
  
  describe("Critical Function: updatePrices", function () {
    it("Should allow admin to update token prices", async function () {
      const newPrice = ethers.parseEther("3"); // $3 per token
      
      await expect(priceOracle.connect(admin).updatePrice(dloopToken.address, newPrice))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(dloopToken.address, INITIAL_PRICE, newPrice);
      
      expect(await priceOracle.getPrice(dloopToken.address)).to.equal(newPrice);
    });
    
    it("Should revert if non-admin tries to update prices", async function () {
      const newPrice = ethers.parseEther("3"); // $3 per token
      
      await expect(
        priceOracle.connect(user1).updatePrice(dloopToken.address, newPrice)
      ).to.be.reverted; // AccessControl error
    });
    
    it("Should revert if price is zero", async function () {
      await expect(
        priceOracle.connect(admin).updatePrice(dloopToken.address, 0)
      ).to.be.revertedWith("Price cannot be zero");
    });
    
    it("Should affect reward calculations based on USD value", async function () {
      // First calculate rewards with initial price
      const initialReward1 = await governanceRewards.calculateReward(nodeOperator1.address);
      
      // Update price to double the value
      const newPrice = INITIAL_PRICE * 2n;
      await priceOracle.connect(admin).updatePrice(dloopToken.address, newPrice);
      
      // Calculate rewards with new price
      const newReward1 = await governanceRewards.calculateReward(nodeOperator1.address);
      
      // The USD value should be the same, so token amount should be half
      expect(newReward1).to.be.closeTo(initialReward1 / 2n, ethers.parseEther("0.01"));
    });
  });
});
