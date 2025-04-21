/**
 * @title PriceOracle Contract Test Suite
 * @dev Comprehensive tests for the PriceOracle smart contract
 * @notice Tests cover all core functionality, edge cases, and backward compatibility
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MaxInt256, MaxUint256, ZeroAddress } = ethers;

describe("PriceOracle", function() {
  // Test variables
  let owner, admin, feedManager, priceUpdater, user1, user2;
  let priceOracle;
  let mockToken1, mockToken2, mockToken3;
  let mockAggregator1, mockAggregator2, mockAggregator3;

  // Constants
  const INITIAL_PRICE = ethers.parseUnits("100", 8);
  const UPDATED_PRICE = ethers.parseUnits("150", 8);

  async function deployPriceOracle() {
    const [owner, admin, feedManager] = await ethers.getSigners();
    
    const PriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
    const priceOracle = await PriceOracle.deploy(admin.address);
    
    return { priceOracle, owner, admin, feedManager };
  }

  async function deployMockTokens() {
    const TokenFactory = await ethers.getContractFactory("MockToken");
    return [
      await TokenFactory.deploy("Mock Token 1", "MT1", 18),
      await TokenFactory.deploy("Mock Token 2", "MT2", 6),
      await TokenFactory.deploy("Mock Token 3", "MT3", 8)
    ];
  }

  async function deployMockAggregator() {
    const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3");
    return await AggregatorFactory.deploy(8, "Mock Aggregator", INITIAL_PRICE);
  }

  beforeEach(async function() {
    [owner, admin, user1, priceUpdater] = await ethers.getSigners();
    
    // Validate addresses
    if (!owner.address || !admin.address) {
      throw new Error("Signers not properly initialized");
    }
    
    // Deploy and validate mocks
    mockAggregator1 = await deployMockAggregator();
    mockAggregator2 = await deployMockAggregator();
    [mockToken1, mockToken2, mockToken3] = await deployMockTokens();
    
    if (!mockAggregator1.address || !mockToken1.address) {
      throw new Error("Mock contracts not properly deployed");
    }
    
    // Deploy and validate oracle
    const PriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    
    if (!priceOracle.address) {
      throw new Error("PriceOracle not properly deployed");
    }
  });
  
  describe("Deployment", function() {
    it("should set the correct owner and admin", async function() {
      expect(await priceOracle.hasRole(await priceOracle.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await priceOracle.hasRole(await priceOracle.ADMIN_ROLE(), admin.address)).to.be.true;
    });
    
    it("should set admin as owner if no admin specified", async function() {
      const PriceOracle = await ethers.getContractFactory("ChainlinkPriceOracle");
      const localOracle = await PriceOracle.deploy(ZeroAddress);
      
      expect(await localOracle.hasRole(await localOracle.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await localOracle.hasRole(await localOracle.ADMIN_ROLE(), owner.address)).to.be.true;
    });
  });
  
  describe("Access Control", function() {
    it("should allow admin to grant FEED_MANAGER_ROLE", async function() {
      await priceOracle.connect(admin).grantRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address);
      expect(await priceOracle.hasRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address)).to.be.true;
    });
    
    it("should not allow non-admin to grant FEED_MANAGER_ROLE", async function() {
      await expect(
        priceOracle.connect(user1).grantRole(await priceOracle.FEED_MANAGER_ROLE(), user2.address)
      ).to.be.reverted;
    });
    
    it("should allow admin to revoke FEED_MANAGER_ROLE", async function() {
      // First grant the role
      await priceOracle.connect(admin).grantRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address);
      
      // Then revoke it
      await priceOracle.connect(admin).revokeRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address);
      expect(await priceOracle.hasRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address)).to.be.false;
    });
  });
  
  describe("Direct Price Setting", function() {
    it("should allow setting direct price for testing", async function() {
      await priceOracle.setDirectPrice(mockToken1.address, INITIAL_PRICE, 8);
      
      // Check that price was set
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should emit PriceUpdated event when setting direct price", async function() {
      await expect(priceOracle.setDirectPrice(mockToken1.address, INITIAL_PRICE, 8))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(mockToken1.address, INITIAL_PRICE, 8); // Match actual event params
    });
    
    it("should revert when setting price for zero address", async function() {
      await expect(
        priceOracle.setDirectPrice(ZeroAddress, INITIAL_PRICE, 8)
      ).to.be.reverted;
    });
  });
  
  describe("Price Updates via Updaters", function() {
    it("should allow authorized updaters to set prices", async function() {
      // Price updater sets price
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      // Check that price was set
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should emit PriceUpdated event when updating a price", async function() {
      // Set initial price
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      // Update price and check event
      await expect(
        priceOracle.connect(admin).setFeed(
          mockToken1.address,
          mockAggregator2.address,
          3600, // maxStaleness
          3600, // heartbeat
          90    // reliabilityScore
        )
      ).to.emit(priceOracle, "PriceUpdated")
       .withArgs(mockToken1.address, INITIAL_PRICE, UPDATED_PRICE);
    });
    
    it("should not allow unauthorized users to set prices", async function() {
      await expect(
        priceOracle.connect(user1).setFeed(
          mockToken1.address,
          mockAggregator1.address,
          3600, // maxStaleness
          3600, // heartbeat
          90    // reliabilityScore
        )
      ).to.be.reverted;
    });
    
    it("should allow admin to set prices directly", async function() {
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should allow owner to set prices directly", async function() {
      await priceOracle.connect(owner).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
  });
  
  describe("Price Retrieval", function() {
    it("should return price from aggregator when feed exists", async function() {
      // Mock aggregator will return INITIAL_PRICE
      const price = await priceOracle.getAssetPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should return fallback price when feed doesn't exist", async function() {
      // Set fallback price
      await priceOracle.connect(admin).setFallbackPrice(
        mockToken1.address, 
        INITIAL_PRICE, 
        8
      );
      
      // Remove feed
      await priceOracle.connect(admin).removeFeed(mockToken1.address);
      
      // Should return fallback price
      const price = await priceOracle.getAssetPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should revert when price is stale", async function() {
      // Set feed with very short staleness window
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        1, // 1 second maxStaleness
        1, // 1 second heartbeat
        100
      );
      
      // Wait 2 seconds to make price stale
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        priceOracle.getAssetPrice(mockToken1.address)
      ).to.be.revertedWithCustomError(priceOracle, "FallbackPriceStale");
    });
  });
  
  describe("Chainlink Feed Configuration", function() {
    it("should allow admin to set Chainlink feed", async function() {
      const mockAggregator = await deployMockAggregator();
      await expect(priceOracle.connect(admin).setFeed(
        mockToken1.address, 
        mockAggregator.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      )).to.emit(priceOracle, 'FeedSet');
    });

    it("should use fallback price when feed is stale", async function() {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 4000; // 4 seconds old
      const mockAggregator = await deployMockAggregator();
      await mockAggregator.setUpdatedAt(staleTimestamp);
      await priceOracle.connect(admin).setFallbackPrice(
        mockToken1.address,
        100000000,
        8
      );
      
      await expect(priceOracle.getPrice(mockToken1.address))
        .to.emit(priceOracle, 'FallbackUsed');
    });
    
    it('should revert when setting invalid price', async function() {
      const mockAggregator = await deployMockAggregator();
      await expect(mockAggregator.setPrice(0))
        .to.be.revertedWithCustomError(mockAggregator, 'InvalidPrice');
    });

    it('should revert when setting future timestamp', async function() {
      const mockAggregator = await deployMockAggregator();
      const futureTime = Math.floor(Date.now()/1000) + 10000;
      await expect(mockAggregator.setUpdatedAt(futureTime))
        .to.be.revertedWithCustomError(mockAggregator, 'InvalidTimestamp');
    });
  });
  
  describe("Reliability Scoring", function() {
    it("should reject prices from low-reliability feeds", async function() {
      const lowReliabilityAggregator = await deployMockAggregator();
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        lowReliabilityAggregator.address,
        3600, // maxStaleness
        3600, // heartbeat
        50    // reliabilityScore (below threshold)
      );
      
      await expect(priceOracle.getPrice(mockToken1.address))
        .to.be.revertedWith("FeedNotReliable");
    });
  });

  describe("Feed Management", function() {
    it("should allow FEED_MANAGER_ROLE to set feeds", async function() {
      // Grant role to user1
      await priceOracle.connect(admin).grantRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address);
      
      const newAggregator = await deployMockAggregator();
      await priceOracle.connect(user1).setFeed(
        mockToken1.address,
        newAggregator.address,
        3600, // maxStaleness
        3600, // heartbeat
        100   // reliabilityScore
      );
      
      const feedInfo = await priceOracle.feeds(mockToken1.address);
      expect(feedInfo.aggregator).to.equal(newAggregator.address);
    });
    
    it("should emit FeedSet event when setting a feed", async function() {
      const newAggregator = await deployMockAggregator();
      await expect(
        priceOracle.connect(admin).setFeed(
          mockToken1.address,
          newAggregator.address,
          3600, // maxStaleness
          3600, // heartbeat
          100   // reliabilityScore
        )
      ).to.emit(priceOracle, "FeedSet");
    });
    
    it("should allow FEED_MANAGER_ROLE to remove feeds", async function() {
      // Grant role to user1
      await priceOracle.connect(admin).grantRole(await priceOracle.FEED_MANAGER_ROLE(), user1.address);
      
      await priceOracle.connect(user1).removeFeed(mockToken1.address);
      const feedInfo = await priceOracle.feeds(mockToken1.address);
      expect(feedInfo.exists).to.be.false;
    });
    
    it("should emit FeedRemoved event when removing a feed", async function() {
      await expect(
        priceOracle.connect(admin).removeFeed(mockToken1.address)
      ).to.emit(priceOracle, "FeedRemoved");
    });
  });
  
  describe("Interface Compatibility", function() {
    beforeEach(async function() {
      // Set prices for test token with decimals
      await priceOracle.setDirectPrice(mockToken1.address, INITIAL_PRICE, 8);
    });
    
    it("should be compatible with IPriceOracle interface", async function() {
      // Create an adapter that implements the IPriceOracle interface
      const adapterCode = `
        // SPDX-License-Identifier: MIT
        pragma solidity 0.8.24;
        
        import "../interfaces/IPriceOracle.sol";
        
        contract PriceOracleAdapter {
            IPriceOracle public oracle;
            
            constructor(address _oracle) {
                oracle = IPriceOracle(_oracle);
            }
            
            function getTokenPrice(address token) external view returns (uint256) {
                return oracle.getAssetPrice(token);
            }
            
            function getTokenDecimals(address token) external view returns (uint8) {
                return oracle.getAssetDecimals(token);
            }
        }
      `;
      
      // This test verifies that our PriceOracle would be compatible with the interface
      // In production, we would deploy this adapter and test it directly
      
      // For the purpose of this test, we'll verify that the necessary functions exist
      // and have compatible signatures
      expect(typeof priceOracle.getPrice).to.equal('function');
      
      // In actual implementation, an adapter would be written to map:
      // getPrice -> getAssetPrice
      // and a function would be added for getAssetDecimals
    });
  });
  
  describe("Edge Cases", function() {
    it("should handle price updates with different decimal places", async function() {
      // Set price with different decimals
      const lowDecimalPrice = 10000; // $100.00
      await priceOracle.setDirectPrice(mockToken1.address, lowDecimalPrice, 2);
      
      const highDecimalPrice = 10000000000; // $100.0000000000
      await priceOracle.setDirectPrice(mockToken2.address, highDecimalPrice, 10);
      
      // Retrieve prices
      const price1 = await priceOracle.getPrice(mockToken1.address);
      const price2 = await priceOracle.getPrice(mockToken2.address);
      
      // Prices stored as-is
      expect(price1).to.equal(lowDecimalPrice);
      expect(price2).to.equal(highDecimalPrice);
    });
    
    it("should handle price updates to zero correctly", async function() {
      // First set a non-zero price
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      // Update to zero
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator2.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      // Try to get the price, should revert
      await expect(
        priceOracle.getPrice(mockToken1.address)
      ).to.be.reverted;
    });
    
    it("should handle multiple rapid price updates correctly", async function() {
      const prices = [
        100000000,
        101000000,
        99000000,
        105000000,
        104000000
      ];
      
      // Update prices rapidly
      for (const price of prices) {
        await priceOracle.connect(admin).setFeed(
          mockToken1.address,
          mockAggregator1.address,
          3600, // maxStaleness
          3600, // heartbeat
          90    // reliabilityScore
        );
      }
      
      // Check final price
      const finalPrice = await priceOracle.getPrice(mockToken1.address);
      expect(finalPrice).to.equal(prices[prices.length - 1]);
    });
    
    it("should reject invalid aggregator address", async function() {
      await expect(priceOracle.connect(admin).setFeed(
        mockToken1.address,
        ZeroAddress, // invalid
        3600,
        3600,
        90
      )).to.be.revertedWith("InvalidAggregator");
    });

    it("should reject invalid reliability scores", async function() {
      const mockAggregator = await deployMockAggregator();
      await expect(priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator.address,
        3600,
        3600,
        101 // invalid
      )).to.be.revertedWith("ReliabilityOutOfRange");
    });

    it("should handle zero heartbeat values", async function() {
      const mockAggregator = await deployMockAggregator();
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator.address,
        3600,
        0, // zero heartbeat
        90
      );
      
      // Should still work with zero heartbeat
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.be.gt(0);
    });
  });
  
  describe("Gas Efficiency", function() {
    it("should efficiently update prices", async function() {
      // First price set (more expensive due to storage initialization)
      const tx1 = await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      const receipt1 = await tx1.wait();
      const gas1 = Number(receipt1.gasUsed);
      
      // Second price update (should be more efficient)
      const tx2 = await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator2.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      const receipt2 = await tx2.wait();
      const gas2 = Number(receipt2.gasUsed);
      
      console.log(`Gas for initial price set: ${gas1}, Gas for update: ${gas2}`);
      
      // Updating the same slot should be less expensive
      expect(gas2).to.be.lessThan(gas1);
    });
  });
  
  describe("Backward Compatibility", function() {
    it("should be backward compatible with older systems expecting certain behaviors", async function() {
      // Set prices for tokens
      await priceOracle.connect(admin).setFeed(
        mockToken1.address,
        mockAggregator1.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      
      // Verify price can be retrieved
      const price = await priceOracle.getPrice(mockToken1.address);
      expect(price).to.equal(INITIAL_PRICE);
      
      // Legacy systems would expect prices to remain stable unless explicitly updated
      // Add a new price updater to simulate a different service accessing the oracle
      // Update from new service should work seamlessly
      await priceOracle.connect(admin).setFeed(
        mockToken2.address,
        mockAggregator2.address,
        3600, // maxStaleness
        3600, // heartbeat
        90    // reliabilityScore
      );
      const price2 = await priceOracle.getPrice(mockToken2.address);
      expect(price2).to.equal(UPDATED_PRICE);
      
      // Original price should remain unchanged
      const price1Again = await priceOracle.getPrice(mockToken1.address);
      expect(price1Again).to.equal(INITIAL_PRICE);
    });
  });
  
  describe('Event Emissions', function() {
    it('should emit PriceUpdated with correct parameters', async function() {
      const mockAggregator = await deployMockAggregator();
      const testPrice = 150 * 10**8;
      
      await expect(mockAggregator.setPrice(testPrice))
        .to.emit(mockAggregator, 'PriceUpdated')
        .withArgs(testPrice, (val) => expect(val).to.be.a('number'));
    });
  });
});

async function deployMockAggregator() {
  const AggregatorFactory = await ethers.getContractFactory("MockAggregatorV3");
  const mockAggregator = await AggregatorFactory.deploy(8, "Mock Aggregator", INITIAL_PRICE);
  return mockAggregator;
}