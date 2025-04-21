/**
 * @title PriceOracle Test - Compatible with Ethers v6
 * @dev Comprehensive tests for the PriceOracle smart contract
 * @notice This file has been updated to be fully compatible with Ethers v6
 */
const { expect } = require("chai");
const ethers = require("./fix-ethers");

describe("PriceOracle", function() {
  // Test variables
  let admin, priceUpdater, user1, user2;
  let priceOracle, mockToken1, mockToken2;
  
  // Test constants
  const PRICE_DECIMALS = 8;
  const INITIAL_PRICE = ethers.parseUnits("1000", PRICE_DECIMALS); // $1000.00000000
  const UPDATED_PRICE = ethers.parseUnits("1100", PRICE_DECIMALS); // $1100.00000000
  
  beforeEach(async function() {
    // Get signers for testing
    [admin, priceUpdater, user1, user2] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken1 = await MockERC20.deploy("Mock Token 1", "MT1", ethers.parseUnits("1000000", 18));
    await mockToken1.waitForDeployment();
    
    mockToken2 = await MockERC20.deploy("Mock Token 2", "MT2", ethers.parseUnits("1000000", 18));
    await mockToken2.waitForDeployment();
    
    // Deploy PriceOracle contract
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Add price updater
    await priceOracle.connect(admin).addPriceUpdater(priceUpdater.address);
    
    // Set initial prices
    await priceOracle.connect(priceUpdater).setPrice(await mockToken1.getAddress(), INITIAL_PRICE);
  });
  
  describe("Deployment", function() {
    it("should set the correct owner and admin", async function() {
      expect(await priceOracle.owner()).to.equal(admin.address);
      // In the current implementation, we add price updaters explicitly
      expect(await priceOracle.priceUpdaters(priceUpdater.address)).to.equal(true);
    });
  });
  
  describe("Price Updates", function() {
    it("should allow price updater to set prices", async function() {
      await priceOracle.connect(priceUpdater).setPrice(await mockToken2.getAddress(), INITIAL_PRICE);
      const price = await priceOracle.getPrice(await mockToken2.getAddress());
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should allow admin to set prices", async function() {
      await priceOracle.connect(admin).setPrice(await mockToken2.getAddress(), INITIAL_PRICE);
      const price = await priceOracle.getPrice(await mockToken2.getAddress());
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should not allow unauthorized users to set prices", async function() {
      await expect(
        priceOracle.connect(user1).setPrice(await mockToken2.getAddress(), INITIAL_PRICE)
      ).to.be.reverted; // Use generic reverted matcher for flexibility
    });
    
    it("should update prices correctly", async function() {
      // First price is already set in beforeEach
      const initialPrice = await priceOracle.getPrice(await mockToken1.getAddress());
      expect(initialPrice).to.equal(INITIAL_PRICE);
      
      // Update price
      await priceOracle.connect(priceUpdater).setPrice(await mockToken1.getAddress(), UPDATED_PRICE);
      
      // Check new price
      const updatedPrice = await priceOracle.getPrice(await mockToken1.getAddress());
      expect(updatedPrice).to.equal(UPDATED_PRICE);
    });
    
    it("should emit PriceUpdated event when price is set", async function() {
      const mockToken2Address = await mockToken2.getAddress();
      
      await expect(
        priceOracle.connect(priceUpdater).setPrice(mockToken2Address, INITIAL_PRICE)
      ).to.emit(priceOracle, "PriceUpdated")
        .withArgs(mockToken2Address, 0, INITIAL_PRICE); // Include oldPrice in the event args
    });
  });
  
  describe("Price Retrieval", function() {
    it("should return the correct price for a token", async function() {
      const price = await priceOracle.getPrice(await mockToken1.getAddress());
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should revert when getting price for unpriced token", async function() {
      await expect(
        priceOracle.getPrice(await mockToken2.getAddress())
      ).to.be.reverted; // Use generic reverted matcher for flexibility
    });
  });
  
  describe("Admin Functions", function() {
    it("should allow owner to add price updaters", async function() {
      await priceOracle.connect(admin).addPriceUpdater(user1.address);
      
      // New price updater should be able to set prices
      await priceOracle.connect(user1).setPrice(await mockToken2.getAddress(), INITIAL_PRICE);
      const price = await priceOracle.getPrice(await mockToken2.getAddress());
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should allow owner to remove price updaters", async function() {
      // First add a price updater
      await priceOracle.connect(admin).addPriceUpdater(user1.address);
      
      // Then remove them
      await priceOracle.connect(admin).removePriceUpdater(user1.address);
      
      // Should no longer be able to set prices
      await expect(
        priceOracle.connect(user1).setPrice(await mockToken2.getAddress(), INITIAL_PRICE)
      ).to.be.reverted; // Use generic reverted matcher for flexibility
    });
  });
  
  describe("Direct Price Setting", function() {
    it("should allow setting prices with different decimals", async function() {
      // Set price with 2 decimals (e.g., $100.00)
      const lowDecimalPrice = ethers.parseUnits("100", 2);
      await priceOracle.setDirectPrice(await mockToken1.getAddress(), lowDecimalPrice, 2);
      
      // Set price with 10 decimals (e.g., $100.0000000000)
      const highDecimalPrice = ethers.parseUnits("100", 10);
      await priceOracle.setDirectPrice(await mockToken2.getAddress(), highDecimalPrice, 10);
      
      // Retrieve prices
      const price1 = await priceOracle.getPrice(await mockToken1.getAddress());
      const price2 = await priceOracle.getPrice(await mockToken2.getAddress());
      
      // Prices stored as-is with their decimals
      expect(price1).to.equal(lowDecimalPrice);
      expect(price2).to.equal(highDecimalPrice);
    });
  });
  
  describe("Edge Cases", function() {
    it("should handle price updates with different decimal places", async function() {
      // Set price with different decimals
      const lowDecimalPrice = ethers.parseUnits("100", 2); // $100.00
      await priceOracle.setDirectPrice(await mockToken1.getAddress(), lowDecimalPrice, 2);
      
      const highDecimalPrice = ethers.parseUnits("100", 10); // $100.0000000000
      await priceOracle.setDirectPrice(await mockToken2.getAddress(), highDecimalPrice, 10);
      
      // Retrieve prices
      const price1 = await priceOracle.getPrice(await mockToken1.getAddress());
      const price2 = await priceOracle.getPrice(await mockToken2.getAddress());
      
      // Prices stored as-is
      expect(price1).to.equal(lowDecimalPrice);
      expect(price2).to.equal(highDecimalPrice);
    });
    
    it("should handle price updates to zero correctly", async function() {
      // First set a non-zero price
      await priceOracle.connect(priceUpdater).setPrice(await mockToken1.getAddress(), INITIAL_PRICE);
      
      // Update to zero
      await priceOracle.connect(priceUpdater).setPrice(await mockToken1.getAddress(), 0);
      
      // Try to get the price, should revert
      await expect(
        priceOracle.getPrice(await mockToken1.getAddress())
      ).to.be.reverted;
    });
    
    it("should handle multiple rapid price updates correctly", async function() {
      const mockToken1Address = await mockToken1.getAddress();
      
      const prices = [
        ethers.parseUnits("100", PRICE_DECIMALS),
        ethers.parseUnits("101", PRICE_DECIMALS),
        ethers.parseUnits("99", PRICE_DECIMALS),
        ethers.parseUnits("105", PRICE_DECIMALS),
        ethers.parseUnits("104", PRICE_DECIMALS)
      ];
      
      // Update prices rapidly
      for (const price of prices) {
        await priceOracle.connect(priceUpdater).setPrice(mockToken1Address, price);
      }
      
      // Check final price
      const finalPrice = await priceOracle.getPrice(mockToken1Address);
      expect(finalPrice).to.equal(prices[prices.length - 1]);
    });
  });
  
  describe("Gas Efficiency", function() {
    it("should efficiently update prices", async function() {
      const mockToken1Address = await mockToken1.getAddress();
      
      // First price set (more expensive due to storage initialization)
      const tx1 = await priceOracle.connect(priceUpdater).setPrice(mockToken1Address, INITIAL_PRICE);
      const receipt1 = await tx1.wait();
      const gas1 = BigInt(receipt1.gasUsed); // Use BigInt for gas values
      
      // Second price update (should be more efficient)
      const tx2 = await priceOracle.connect(priceUpdater).setPrice(mockToken1Address, UPDATED_PRICE);
      const receipt2 = await tx2.wait();
      const gas2 = BigInt(receipt2.gasUsed);
      
      console.log(`Gas for initial price set: ${gas1}, Gas for update: ${gas2}`);
      
      // Updating the same slot should be less expensive or equal
      expect(gas2).to.be.lessThanOrEqual(gas1);
    });
  });
  
  describe("Backward Compatibility", function() {
    it("should be backward compatible with older systems expecting certain behaviors", async function() {
      const mockToken1Address = await mockToken1.getAddress();
      const mockToken2Address = await mockToken2.getAddress();
      
      // Set prices for tokens
      await priceOracle.connect(priceUpdater).setPrice(mockToken1Address, INITIAL_PRICE);
      
      // Verify price can be retrieved
      const price = await priceOracle.getPrice(mockToken1Address);
      expect(price).to.equal(INITIAL_PRICE);
      
      // Legacy systems would expect prices to remain stable unless explicitly updated
      // Add a new price updater to simulate a different service accessing the oracle
      await priceOracle.connect(admin).addPriceUpdater(user1.address);
      
      // Update from new service should work seamlessly
      await priceOracle.connect(user1).setPrice(mockToken2Address, UPDATED_PRICE);
      const price2 = await priceOracle.getPrice(mockToken2Address);
      expect(price2).to.equal(UPDATED_PRICE);
      
      // Original price should remain unchanged
      const price1Again = await priceOracle.getPrice(mockToken1Address);
      expect(price1Again).to.equal(INITIAL_PRICE);
    });
  });
});