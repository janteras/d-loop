const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Asset DAO Fee System", function () {
  let admin, assetDAO, user1, user2;
  let mockToken;
  let feeCalculator, treasury, rewardDistributor, feeCollector;
  
  const PERCENTAGE_BASE = ethers.utils.parseEther("1"); // 100% = 1e18
  
  beforeEach(async function () {
    [admin, assetDAO, governance, user1, user2] = await ethers.getSigners();
    
    // Deploy Mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Test Token", "TEST");
    await mockToken.deployed();
    
    // Mint some tokens to assetDAO (simulating the DAO holding assets)
    await mockToken.mint(assetDAO.address, ethers.utils.parseEther("1000000"));
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(admin.address, governance.address);
    await feeCalculator.deployed();
    
    // Deploy RewardDistributor (30 days epoch)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await RewardDistributor.deploy(
      admin.address,
      admin.address, // Temporary treasury address, will update after Treasury deployment
      governance.address,
      30 * 24 * 60 * 60 // 30 days in seconds
    );
    await rewardDistributor.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(
      admin.address,
      admin.address, // Temporary fee collector, will update after FeeCollector deployment
      rewardDistributor.address
    );
    await treasury.deployed();
    
    // Update treasury in RewardDistributor
    await rewardDistributor.addTreasuryRole(treasury.address);
    
    // Deploy FeeCollector
    const FeeCollector = await ethers.getContractFactory("FeeCollector");
    feeCollector = await FeeCollector.deploy(
      admin.address,
      assetDAO.address,
      feeCalculator.address,
      treasury.address
    );
    await feeCollector.deployed();
    
    // Update fee collector in Treasury
    await treasury.updateFeeCollector(feeCollector.address);
  });
  
  describe("FeeCalculator", function () {
    it("should initialize with correct default fees", async function () {
      const [investFee, divestFee, ragequitFee] = await feeCalculator.getCurrentFees();
      
      expect(investFee).to.equal(ethers.utils.parseEther("0.1")); // 10%
      expect(divestFee).to.equal(ethers.utils.parseEther("0.05")); // 5%
      expect(ragequitFee).to.equal(ethers.utils.parseEther("0.2")); // 20%
    });
    
    it("should calculate fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      const investFee = await feeCalculator.calculateFee(amount, 0);
      const divestFee = await feeCalculator.calculateFee(amount, 1);
      const ragequitFee = await feeCalculator.calculateFee(amount, 2);
      
      expect(investFee).to.equal(ethers.utils.parseEther("100")); // 10% of 1000
      expect(divestFee).to.equal(ethers.utils.parseEther("50")); // 5% of 1000
      expect(ragequitFee).to.equal(ethers.utils.parseEther("200")); // 20% of 1000
    });
    
    it("should allow governance to update fees within limits", async function () {
      // Update fees
      await feeCalculator.connect(governance).updateFees(
        ethers.utils.parseEther("0.15"), // 15% invest fee
        ethers.utils.parseEther("0.07"), // 7% divest fee
        ethers.utils.parseEther("0.25")  // 25% ragequit fee
      );
      
      const [investFee, divestFee, ragequitFee] = await feeCalculator.getCurrentFees();
      
      expect(investFee).to.equal(ethers.utils.parseEther("0.15"));
      expect(divestFee).to.equal(ethers.utils.parseEther("0.07"));
      expect(ragequitFee).to.equal(ethers.utils.parseEther("0.25"));
    });
    
    it("should prevent setting fees outside limits", async function () {
      // Try to set invest fee too high
      await expect(
        feeCalculator.connect(governance).updateFees(
          ethers.utils.parseEther("0.25"), // 25% invest fee (above 20% max)
          ethers.utils.parseEther("0.05"),
          ethers.utils.parseEther("0.2")
        )
      ).to.be.revertedWith("FeeCalculator: Invest fee out of range");
      
      // Try to set divest fee too low
      await expect(
        feeCalculator.connect(governance).updateFees(
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("0.005"), // 0.5% divest fee (below 1% min)
          ethers.utils.parseEther("0.2")
        )
      ).to.be.revertedWith("FeeCalculator: Divest fee out of range");
    });
    
    it("should allow admin to update fee limits", async function () {
      // Update fee limits
      await feeCalculator.connect(admin).updateFeeLimits(
        ethers.utils.parseEther("0.08"),  // 8% min invest fee
        ethers.utils.parseEther("0.25"),  // 25% max invest fee
        ethers.utils.parseEther("0.03"),  // 3% min divest fee
        ethers.utils.parseEther("0.15"),  // 15% max divest fee
        ethers.utils.parseEther("0.15"),  // 15% min ragequit fee
        ethers.utils.parseEther("0.28")   // 28% max ragequit fee
      );
      
      const [
        minInvestFee, maxInvestFee,
        minDivestFee, maxDivestFee,
        minRagequitFee, maxRagequitFee
      ] = await feeCalculator.getFeeLimits();
      
      expect(minInvestFee).to.equal(ethers.utils.parseEther("0.08"));
      expect(maxInvestFee).to.equal(ethers.utils.parseEther("0.25"));
      expect(minDivestFee).to.equal(ethers.utils.parseEther("0.03"));
      expect(maxDivestFee).to.equal(ethers.utils.parseEther("0.15"));
      expect(minRagequitFee).to.equal(ethers.utils.parseEther("0.15"));
      expect(maxRagequitFee).to.equal(ethers.utils.parseEther("0.28"));
    });
  });
  
  describe("FeeCollector", function () {
    beforeEach(async function () {
      // Approve FeeCollector to spend AssetDAO's tokens
      await mockToken.connect(assetDAO).approve(feeCollector.address, ethers.constants.MaxUint256);
    });
    
    it("should process invest fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = ethers.utils.parseEther("100"); // 10% of 1000
      
      // Process invest fee
      await expect(feeCollector.connect(assetDAO).processInvestFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeProcessed")
        .withArgs(mockToken.address, amount, expectedFee, 0);
      
      // Check Treasury balance
      expect(await treasury.getBalance(mockToken.address)).to.equal(expectedFee);
    });
    
    it("should process divest fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = ethers.utils.parseEther("50"); // 5% of 1000
      
      // Process divest fee
      await expect(feeCollector.connect(assetDAO).processDivestFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeProcessed")
        .withArgs(mockToken.address, amount, expectedFee, 1);
      
      // Check Treasury balance
      expect(await treasury.getBalance(mockToken.address)).to.equal(expectedFee);
    });
    
    it("should process ragequit fees correctly", async function () {
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = ethers.utils.parseEther("200"); // 20% of 1000
      
      // Process ragequit fee
      await expect(feeCollector.connect(assetDAO).processRagequitFee(mockToken.address, amount))
        .to.emit(feeCollector, "FeeProcessed")
        .withArgs(mockToken.address, amount, expectedFee, 2);
      
      // Check Treasury balance
      expect(await treasury.getBalance(mockToken.address)).to.equal(expectedFee);
    });
    
    it("should prevent non-AssetDAO addresses from processing fees", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Try to process fee from non-authorized address
      await expect(
        feeCollector.connect(user1).processInvestFee(mockToken.address, amount)
      ).to.be.revertedWith("AccessControl: account 0x");
    });
  });
  
  describe("Treasury", function () {
    beforeEach(async function () {
      // Collect some fees to Treasury
      await mockToken.connect(assetDAO).approve(feeCollector.address, ethers.constants.MaxUint256);
      await feeCollector.connect(assetDAO).processInvestFee(mockToken.address, ethers.utils.parseEther("1000"));
      await feeCollector.connect(assetDAO).processDivestFee(mockToken.address, ethers.utils.parseEther("1000"));
    });
    
    it("should have correct allocation percentages", async function () {
      expect(await treasury.treasuryAllocation()).to.equal(70);
      expect(await treasury.rewardsAllocation()).to.equal(30);
    });
    
    it("should distribute fees according to allocation", async function () {
      // Check Treasury balance before distribution
      const balanceBefore = await treasury.getBalance(mockToken.address);
      expect(balanceBefore).to.equal(ethers.utils.parseEther("150")); // 100 + 50
      
      // Distribute fees
      await treasury.connect(admin).distributeFees(mockToken.address);
      
      // Check balances after distribution
      const treasuryAmount = balanceBefore.mul(70).div(100);
      const rewardsAmount = balanceBefore.mul(30).div(100);
      
      expect(await treasury.getBalance(mockToken.address)).to.equal(treasuryAmount);
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(rewardsAmount);
    });
    
    it("should allow updating allocations", async function () {
      // Update allocations to 80/20
      await treasury.connect(admin).updateAllocation(80, 20);
      
      expect(await treasury.treasuryAllocation()).to.equal(80);
      expect(await treasury.rewardsAllocation()).to.equal(20);
      
      // Distribute with new allocation
      const balanceBefore = await treasury.getBalance(mockToken.address);
      await treasury.connect(admin).distributeFees(mockToken.address);
      
      // Check balances
      const treasuryAmount = balanceBefore.mul(80).div(100);
      const rewardsAmount = balanceBefore.mul(20).div(100);
      
      expect(await treasury.getBalance(mockToken.address)).to.equal(treasuryAmount);
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(rewardsAmount);
    });
    
    it("should prevent invalid allocation updates", async function () {
      // Try to set allocations that don't sum to 100
      await expect(
        treasury.connect(admin).updateAllocation(60, 30)
      ).to.be.revertedWith("Treasury: allocations must sum to 100");
    });
  });
  
  describe("RewardDistributor", function () {
    beforeEach(async function () {
      // Collect and distribute some fees
      await mockToken.connect(assetDAO).approve(feeCollector.address, ethers.constants.MaxUint256);
      await feeCollector.connect(assetDAO).processInvestFee(mockToken.address, ethers.utils.parseEther("1000"));
      await treasury.connect(admin).distributeFees(mockToken.address);
      
      // Approve rewards to be received by RewardDistributor
      const rewardsAmount = ethers.utils.parseEther("100").mul(30).div(100);
      await mockToken.connect(admin).approve(rewardDistributor.address, rewardsAmount);
    });
    
    it("should initialize with correct epoch parameters", async function () {
      const [epochId, startTime, endTime, finalized, participants] = await rewardDistributor.getCurrentEpochInfo();
      
      expect(epochId).to.equal(1);
      expect(finalized).to.be.false;
      expect(participants).to.equal(0);
      
      // End time should be 30 days after start time
      expect(endTime.sub(startTime)).to.equal(30 * 24 * 60 * 60);
    });
    
    it("should record contributions correctly", async function () {
      // Record contributions for users
      await rewardDistributor.connect(governance).recordContribution(user1.address, ethers.utils.parseEther("100"));
      await rewardDistributor.connect(governance).recordContribution(user2.address, ethers.utils.parseEther("50"));
      
      // Check participant count
      const [, , , , participants] = await rewardDistributor.getCurrentEpochInfo();
      expect(participants).to.equal(2);
      
      // Check individual contributions
      expect(await rewardDistributor.getUserContribution(1, user1.address)).to.equal(ethers.utils.parseEther("100"));
      expect(await rewardDistributor.getUserContribution(1, user2.address)).to.equal(ethers.utils.parseEther("50"));
    });
    
    it("should finalize epochs and start new ones", async function () {
      // Record some contributions
      await rewardDistributor.connect(governance).recordContribution(user1.address, ethers.utils.parseEther("100"));
      
      // Manually finalize the epoch
      await rewardDistributor.connect(admin).manualFinalizeEpoch();
      
      // Check that first epoch is finalized
      expect(await rewardDistributor.isEpochFinalized(1)).to.be.true;
      
      // Check that we're in a new epoch
      const [epochId] = await rewardDistributor.getCurrentEpochInfo();
      expect(epochId).to.equal(2);
    });
    
    it("should only allow governance to record contributions", async function () {
      // Try to record contribution from non-governance address
      await expect(
        rewardDistributor.connect(user1).recordContribution(user1.address, ethers.utils.parseEther("100"))
      ).to.be.revertedWith("AccessControl: account 0x");
    });
  });
  
  describe("End-to-End Flow", function () {
    it("should handle the full fee and reward process", async function () {
      // 1. AssetDAO approves FeeCollector to spend tokens
      await mockToken.connect(assetDAO).approve(feeCollector.address, ethers.constants.MaxUint256);
      
      // 2. Process invest fee
      const investAmount = ethers.utils.parseEther("10000");
      await feeCollector.connect(assetDAO).processInvestFee(mockToken.address, investAmount);
      
      // 3. Verify Treasury received the fee
      const investFee = investAmount.mul(10).div(100); // 10%
      expect(await treasury.getBalance(mockToken.address)).to.equal(investFee);
      
      // 4. Record governance contributions
      await rewardDistributor.connect(governance).recordContribution(user1.address, ethers.utils.parseEther("100"));
      await rewardDistributor.connect(governance).recordContribution(user2.address, ethers.utils.parseEther("50"));
      
      // 5. Distribute fees from Treasury to RewardDistributor
      await treasury.connect(admin).distributeFees(mockToken.address);
      
      // 6. Verify correct distribution (30% to rewards, 70% stays in Treasury)
      const rewardsAmount = investFee.mul(30).div(100);
      const treasuryAmount = investFee.mul(70).div(100);
      
      expect(await treasury.getBalance(mockToken.address)).to.equal(treasuryAmount);
      expect(await mockToken.balanceOf(rewardDistributor.address)).to.equal(rewardsAmount);
      
      // 7. Finalize epoch
      await rewardDistributor.connect(admin).manualFinalizeEpoch();
      
      // 8. Advance to new epoch
      const [newEpochId] = await rewardDistributor.getCurrentEpochInfo();
      expect(newEpochId).to.equal(2);
      
      // 9. Users should be able to claim rewards in the next test cycle
      // (Note: We can't test claiming here because we'd need to advance time beyond the epoch)
    });
  });
});