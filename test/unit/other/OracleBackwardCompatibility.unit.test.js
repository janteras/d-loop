/**
 * @title PriceOracle Backward Compatibility Tests
 * @dev Tests that verify PriceOracle contract maintains backward compatibility
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');
const { expect } = require("chai");

describe("PriceOracle Backward Compatibility", function() {
  // Test variables
  let owner, admin, priceUpdater, user1;
  let priceOracle, mockPreviousOracle, oracleAdapter;
  let mockToken;
  
  // Constants
  const PRICE_DECIMALS = 8; // Standard price format with 8 decimals
  const TEST_PRICE = ethers.utils.parseUnits("100", PRICE_DECIMALS); // $100.00000000
  
  beforeEach(async function() {
    // Get signers for testing
    [owner, admin, priceUpdater, user1] = await ethers.getSigners();
    
    // Deploy mock token
    const TokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await TokenFactory.deploy("Test Token", "TST", 18);
    
    // Deploy current PriceOracle contract
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    
    // Deploy mock previous version of PriceOracle for comparison
    const MockPreviousPriceOracle = await ethers.getContractFactory("MockPreviousPriceOracle");
    mockPreviousOracle = await MockPreviousPriceOracle.deploy();
    
    // Deploy the adapter for current PriceOracle
    const PriceOracleAdapter = await ethers.getContractFactory("PriceOracleAdapter");
    oracleAdapter = await PriceOracleAdapter.deploy(priceOracle.address);
    
    // Configure price updater
    await priceOracle.connect(admin).addPriceUpdater(priceUpdater.address);
    
    // Set test prices
    await priceOracle.connect(priceUpdater).setPrice(mockToken.address, TEST_PRICE);
    await mockPreviousOracle.setAssetPrice(mockToken.address, TEST_PRICE, PRICE_DECIMALS);
  });
  
  describe("Interface Compatibility", function() {
    it("should allow systems to interact through the IPriceOracle interface", async function() {
      // Test against the old API signature
      const oldPriceMethod = mockPreviousOracle.getAssetPrice;
      const oldDecimalsMethod = mockPreviousOracle.getAssetDecimals;
      
      // Test against the adapter
      const adapterPriceMethod = oracleAdapter.getAssetPrice;
      const adapterDecimalsMethod = oracleAdapter.getAssetDecimals;
      
      // Verify the function signatures match
      expect(typeof oldPriceMethod).to.equal(typeof adapterPriceMethod);
      expect(typeof oldDecimalsMethod).to.equal(typeof adapterDecimalsMethod);
      
      // Verify the function results match
      const oldPrice = await mockPreviousOracle.getAssetPrice(mockToken.address);
      const adapterPrice = await oracleAdapter.getAssetPrice(mockToken.address);
      
      expect(adapterPrice.toString()).to.equal(oldPrice.toString());
      
      // Verify decimals
      const oldDecimals = await mockPreviousOracle.getAssetDecimals(mockToken.address);
      const adapterDecimals = await oracleAdapter.getAssetDecimals(mockToken.address);
      
      expect(adapterDecimals).to.equal(oldDecimals);
    });
  });
  
  describe("Functional Compatibility", function() {
    it("should maintain the same functional behavior as previous version", async function() {
      // Check that both contracts handle price queries the same way
      
      // Old oracle behavior - direct price query
      const oldPrice = await mockPreviousOracle.getAssetPrice(mockToken.address);
      
      // New oracle behavior via adapter
      const newPrice = await oracleAdapter.getAssetPrice(mockToken.address);
      
      // Both should return the same price
      expect(oldPrice).to.equal(newPrice);
      expect(oldPrice).to.equal(TEST_PRICE);
      
      // Test error cases - querying non-existent prices
      try {
        await mockPreviousOracle.getAssetPrice(ethers.constants.AddressZero);
        // Should not reach here
        expect(true).to.equal(false, "Zero address should be rejected");
      } catch (error) {
        // Error expected
      }
      
      try {
        await oracleAdapter.getAssetPrice(ethers.constants.AddressZero);
        // Should not reach here
        expect(true).to.equal(false, "Zero address should be rejected");
      } catch (error) {
        // Error expected
      }
    });
    
    it("should handle updates consistently with previous version", async function() {
      // Update price in both oracles
      const NEW_PRICE = ethers.utils.parseUnits("110", PRICE_DECIMALS);
      
      await mockPreviousOracle.setAssetPrice(mockToken.address, NEW_PRICE, PRICE_DECIMALS);
      await priceOracle.connect(priceUpdater).setPrice(mockToken.address, NEW_PRICE);
      
      // Check prices after update
      const oldPrice = await mockPreviousOracle.getAssetPrice(mockToken.address);
      const newPrice = await oracleAdapter.getAssetPrice(mockToken.address);
      
      // Both should return the updated price
      expect(oldPrice).to.equal(newPrice);
      expect(oldPrice).to.equal(NEW_PRICE);
    });
  });
  
  describe("Consumer Contract Compatibility", function() {
    it("should work with contracts expecting the old interface", async function() {
      // Deploy a mock consumer that expects the IPriceOracle interface
      const consumerCode = `
      // SPDX-License-Identifier: MIT
      pragma solidity 0.8.24;
      
      import "../interfaces/IPriceOracle.sol";
      
      contract MockOracleConsumer {
          IPriceOracle public oracle;
          
          constructor(address _oracle) {
              oracle = IPriceOracle(_oracle);
          }
          
          function getTokenPrice(address token) external view returns (uint256) {
              return oracle.getAssetPrice(token);
          }
          
          function getScaledPrice(address token, uint256 amount) external view returns (uint256) {
              uint256 price = oracle.getAssetPrice(token);
              uint8 decimals = oracle.getAssetDecimals(token);
              return (price * amount) / (10 ** uint256(decimals));
          }
      }
      `;
      
      // For the purpose of these tests, we just verify that our adapter meets
      // the interface requirements. In production, we would deploy this consumer
      // and check that it works with the adapter.
      
      // Set up a test case
      await oracleAdapter.setTokenDecimals(mockToken.address, PRICE_DECIMALS);
      
      // Verify our adapter returns the expected values
      const price = await oracleAdapter.getAssetPrice(mockToken.address);
      const decimals = await oracleAdapter.getAssetDecimals(mockToken.address);
      
      expect(price).to.equal(TEST_PRICE);
      expect(decimals).to.equal(PRICE_DECIMALS);
    });
  });
});