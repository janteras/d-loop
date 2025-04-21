const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OraclePriceEvaluator", function () {
  let owner, admin, governance, rewardDistributor, user;
  let priceEvaluator, mockOracle, mockToken;
  
  // Test decision IDs
  const decisionIds = {
    invest1: ethers.utils.id("invest-decision-1"),
    invest2: ethers.utils.id("invest-decision-2"),
    divest1: ethers.utils.id("divest-decision-1"),
    divest2: ethers.utils.id("divest-decision-2"),
    ragequit1: ethers.utils.id("ragequit-decision-1")
  };
  
  // Event types
  const EventType = {
    Invest: 0,
    Divest: 1,
    Ragequit: 2
  };
  
  const advanceTime = async (seconds) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  };
  
  beforeEach(async function () {
    [owner, admin, governance, rewardDistributor, user] = await ethers.getSigners();
    
    // Deploy a mock token for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");
    await mockToken.deployed();
    
    // Deploy a mock oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockOracle = await MockPriceOracle.deploy();
    await mockOracle.deployed();
    
    // Configure the mock oracle with our token and initial price
    await mockOracle.addAsset(mockToken.address, ethers.utils.parseUnits("100", 18));
    
    // Deploy the price evaluator
    const OraclePriceEvaluator = await ethers.getContractFactory("OraclePriceEvaluator");
    priceEvaluator = await OraclePriceEvaluator.deploy(admin.address, mockOracle.address);
    await priceEvaluator.deployed();
    
    // Grant roles
    await priceEvaluator.connect(admin).grantGovernanceRole(governance.address);
    await priceEvaluator.connect(admin).grantRewardDistributorRole(rewardDistributor.address);
  });
  
  describe("Basic Functionality", function () {
    it("should initialize correctly", async function () {
      expect(await priceEvaluator.oracle()).to.equal(mockOracle.address);
      expect(await priceEvaluator.hasRole(await priceEvaluator.ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await priceEvaluator.hasRole(await priceEvaluator.GOVERNANCE_ROLE(), governance.address)).to.be.true;
      expect(await priceEvaluator.hasRole(await priceEvaluator.REWARD_DISTRIBUTOR_ROLE(), rewardDistributor.address)).to.be.true;
    });
    
    it("should record decisions correctly", async function () {
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.invest1,
        EventType.Invest,
        mockToken.address
      );
      
      const decision = await priceEvaluator.getDecision(decisionIds.invest1);
      
      expect(decision.eventType).to.equal(EventType.Invest);
      expect(decision.assetAddress).to.equal(mockToken.address);
      expect(decision.initialPrice).to.equal(ethers.utils.parseUnits("100", 18));
      expect(decision.evaluated).to.be.false;
      
      // Check that it's in the pending decisions
      const pendingDecisions = await priceEvaluator.getPendingDecisions();
      expect(pendingDecisions).to.include(decisionIds.invest1);
    });
    
    it("should not allow recording duplicate decisions", async function () {
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.invest1,
        EventType.Invest,
        mockToken.address
      );
      
      await expect(
        priceEvaluator.connect(governance).recordDecision(
          decisionIds.invest1,
          EventType.Invest,
          mockToken.address
        )
      ).to.be.revertedWith("Decision already recorded");
    });
    
    it("should not allow recording decisions for unsupported assets", async function () {
      // Using a non-existent token address
      const fakeToken = ethers.constants.AddressZero;
      
      await expect(
        priceEvaluator.connect(governance).recordDecision(
          decisionIds.invest2,
          EventType.Invest,
          fakeToken
        )
      ).to.be.revertedWith("Asset not supported by oracle");
    });
  });
  
  describe("Decision Evaluation", function () {
    beforeEach(async function () {
      // Record test decisions
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.invest1,
        EventType.Invest,
        mockToken.address
      );
      
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.divest1,
        EventType.Divest,
        mockToken.address
      );
      
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.ragequit1,
        EventType.Ragequit,
        mockToken.address
      );
    });
    
    it("should evaluate decisions correctly when price increases", async function () {
      // Set a higher price in the oracle
      await mockOracle.updatePrice(mockToken.address, ethers.utils.parseUnits("110", 18));
      
      // Advance time past the evaluation delay
      await advanceTime(86400); // 1 day
      
      // Evaluate the decision
      const [success, priceIncreased] = await priceEvaluator.evaluateDecision(decisionIds.invest1);
      
      expect(success).to.be.true;
      expect(priceIncreased).to.be.true;
      
      // Check the decision details
      const decision = await priceEvaluator.getDecision(decisionIds.invest1);
      expect(decision.evaluated).to.be.true;
      expect(decision.finalPrice).to.equal(ethers.utils.parseUnits("110", 18));
      expect(decision.priceIncreased).to.be.true;
    });
    
    it("should evaluate decisions correctly when price decreases", async function () {
      // Set a lower price in the oracle
      await mockOracle.updatePrice(mockToken.address, ethers.utils.parseUnits("90", 18));
      
      // Advance time past the evaluation delay
      await advanceTime(86400); // 1 day
      
      // Evaluate the decision
      const [success, priceIncreased] = await priceEvaluator.evaluateDecision(decisionIds.divest1);
      
      expect(success).to.be.true;
      expect(priceIncreased).to.be.false;
      
      // Check the decision details
      const decision = await priceEvaluator.getDecision(decisionIds.divest1);
      expect(decision.evaluated).to.be.true;
      expect(decision.finalPrice).to.equal(ethers.utils.parseUnits("90", 18));
      expect(decision.priceIncreased).to.be.false;
    });
    
    it("should correctly determine if votes were correct", async function () {
      // First decision: Invest + Price Increase
      await mockOracle.updatePrice(mockToken.address, ethers.utils.parseUnits("110", 18));
      await advanceTime(86400);
      await priceEvaluator.evaluateDecision(decisionIds.invest1);
      
      // For invest: Yes is correct if price increased
      expect(await priceEvaluator.isVoteCorrect(decisionIds.invest1, true)).to.be.true;
      expect(await priceEvaluator.isVoteCorrect(decisionIds.invest1, false)).to.be.false;
      
      // Second decision: Divest + Price Decrease
      await mockOracle.updatePrice(mockToken.address, ethers.utils.parseUnits("90", 18));
      await priceEvaluator.evaluateDecision(decisionIds.divest1);
      
      // For divest: Yes is correct if price decreased
      expect(await priceEvaluator.isVoteCorrect(decisionIds.divest1, true)).to.be.true;
      expect(await priceEvaluator.isVoteCorrect(decisionIds.divest1, false)).to.be.false;
      
      // Third decision: Ragequit + Price Decrease
      await priceEvaluator.evaluateDecision(decisionIds.ragequit1);
      
      // For ragequit: same as divest - Yes is correct if price decreased
      expect(await priceEvaluator.isVoteCorrect(decisionIds.ragequit1, true)).to.be.true;
      expect(await priceEvaluator.isVoteCorrect(decisionIds.ragequit1, false)).to.be.false;
    });
    
    it("should batch evaluate pending decisions", async function () {
      // Record additional decisions
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.invest2,
        EventType.Invest,
        mockToken.address
      );
      
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.divest2,
        EventType.Divest,
        mockToken.address
      );
      
      // Update price
      await mockOracle.updatePrice(mockToken.address, ethers.utils.parseUnits("105", 18));
      
      // Advance time past the evaluation delay
      await advanceTime(86400); // 1 day
      
      // Batch evaluate
      const evaluated = await priceEvaluator.evaluatePendingDecisions();
      
      // Should have evaluated all 5 decisions
      expect(evaluated).to.equal(5);
      
      // Check that pending list is now empty (all have been evaluated)
      const pendingDecisions = await priceEvaluator.getPendingDecisions();
      expect(pendingDecisions.length).to.equal(0);
      
      // Verify all decisions are evaluated
      for (const id of Object.values(decisionIds)) {
        const decision = await priceEvaluator.getDecision(id);
        expect(decision.evaluated).to.be.true;
      }
    });
  });
  
  describe("Admin Functions", function () {
    it("should update oracle address", async function () {
      // Deploy a new mock oracle
      const MockPriceOracle2 = await ethers.getContractFactory("MockPriceOracle");
      const newOracle = await MockPriceOracle2.deploy();
      await newOracle.deployed();
      
      // Update oracle
      await priceEvaluator.connect(admin).updateOracle(newOracle.address);
      
      // Check oracle address
      expect(await priceEvaluator.oracle()).to.equal(newOracle.address);
    });
    
    it("should update evaluation window parameters", async function () {
      const newDelay = 2 * 86400; // 2 days
      const newWindow = 10 * 86400; // 10 days
      
      await priceEvaluator.connect(admin).updateEvaluationWindow(newDelay, newWindow);
      
      expect(await priceEvaluator.evaluationDelay()).to.equal(newDelay);
      expect(await priceEvaluator.evaluationWindow()).to.equal(newWindow);
    });
    
    it("should enforce role-based permissions", async function () {
      // Non-admin trying to update oracle
      await expect(
        priceEvaluator.connect(user).updateOracle(mockOracle.address)
      ).to.be.reverted;
      
      // Non-admin trying to update evaluation window
      await expect(
        priceEvaluator.connect(user).updateEvaluationWindow(86400, 10 * 86400)
      ).to.be.reverted;
      
      // Non-governance trying to record decision
      await expect(
        priceEvaluator.connect(user).recordDecision(
          decisionIds.invest1,
          EventType.Invest,
          mockToken.address
        )
      ).to.be.reverted;
    });
    
    it("should pause and unpause contract functionality", async function () {
      // Pause the contract
      await priceEvaluator.connect(admin).pause();
      
      // Try to record a decision while paused
      await expect(
        priceEvaluator.connect(governance).recordDecision(
          decisionIds.invest1,
          EventType.Invest,
          mockToken.address
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause
      await priceEvaluator.connect(admin).unpause();
      
      // Should work now
      await priceEvaluator.connect(governance).recordDecision(
        decisionIds.invest1,
        EventType.Invest,
        mockToken.address
      );
    });
  });
});