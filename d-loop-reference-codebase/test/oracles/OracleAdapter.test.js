const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OracleAdapter", function () {
  // Test accounts
  let admin, user1, user2;
  
  // Contracts
  let mockOracleProvider, oracleAdapter;
  
  // Mock token addresses
  const BTC_ADDRESS = "0x1111111111111111111111111111111111111111";
  const ETH_ADDRESS = "0x2222222222222222222222222222222222222222";
  const USDC_ADDRESS = "0x3333333333333333333333333333333333333333";
  
  // Asset identifiers
  const BTC_ID = "BTC";
  const ETH_ID = "ETH";
  const USDC_ID = "USDC";

  // Sample prices (in wei, 18 decimals)
  const BTC_PRICE = ethers.parseUnits("60000", 18);
  const ETH_PRICE = ethers.parseUnits("3000", 18);
  const USDC_PRICE = ethers.parseUnits("1", 18);

  beforeEach(async function () {
    // Get signers
    [admin, user1, user2] = await ethers.getSigners();
    
    // Deploy mock oracle provider
    const MockOracleProvider = await ethers.getContractFactory("MockOracleProvider");
    mockOracleProvider = await MockOracleProvider.deploy();
    
    // Add assets to mock oracle
    await mockOracleProvider.addAsset(BTC_ID, BTC_PRICE);
    await mockOracleProvider.addAsset(ETH_ID, ETH_PRICE);
    await mockOracleProvider.addAsset(USDC_ID, USDC_PRICE);
    
    // Deploy oracle adapter
    const OracleAdapter = await ethers.getContractFactory("OracleAdapter");
    oracleAdapter = await OracleAdapter.deploy(admin.address, await mockOracleProvider.getAddress());
    
    // Map assets
    await oracleAdapter.mapAsset(BTC_ADDRESS, BTC_ID);
    await oracleAdapter.mapAsset(ETH_ADDRESS, ETH_ID);
    await oracleAdapter.mapAsset(USDC_ADDRESS, USDC_ID);
  });

  describe("Asset Mapping", function () {
    it("should correctly map assets", async function () {
      // Check that mapped assets are recognized
      expect(await oracleAdapter.isAssetSupported(BTC_ADDRESS)).to.be.true;
      expect(await oracleAdapter.isAssetSupported(ETH_ADDRESS)).to.be.true;
      expect(await oracleAdapter.isAssetSupported(USDC_ADDRESS)).to.be.true;
      
      // Check that unmapped assets are not recognized
      expect(await oracleAdapter.isAssetSupported("0x9999999999999999999999999999999999999999")).to.be.false;
    });
    
    it("should return the correct list of supported assets", async function () {
      const supportedAssets = await oracleAdapter.getSupportedAssets();
      expect(supportedAssets.length).to.equal(3);
      expect(supportedAssets).to.include(BTC_ADDRESS);
      expect(supportedAssets).to.include(ETH_ADDRESS);
      expect(supportedAssets).to.include(USDC_ADDRESS);
    });
    
    it("should only allow admin to map assets", async function () {
      const NEW_TOKEN = "0x4444444444444444444444444444444444444444";
      const NEW_ID = "NEW";
      
      // Add asset to oracle provider
      await mockOracleProvider.addAsset(NEW_ID, ethers.parseUnits("10", 18));
      
      // Non-admin should not be able to map assets
      await expect(
        oracleAdapter.connect(user1).mapAsset(NEW_TOKEN, NEW_ID)
      ).to.be.revertedWithCustomError(oracleAdapter, "AccessControlUnauthorizedAccount");
      
      // Admin should be able to map assets
      await oracleAdapter.connect(admin).mapAsset(NEW_TOKEN, NEW_ID);
      expect(await oracleAdapter.isAssetSupported(NEW_TOKEN)).to.be.true;
    });
  });

  describe("Price Queries", function () {
    it("should return correct prices for mapped assets", async function () {
      const [btcPrice, btcTimestamp] = await oracleAdapter.getAssetPrice(BTC_ADDRESS);
      expect(btcPrice).to.equal(BTC_PRICE);
      
      const [ethPrice, ethTimestamp] = await oracleAdapter.getAssetPrice(ETH_ADDRESS);
      expect(ethPrice).to.equal(ETH_PRICE);
      
      const [usdcPrice, usdcTimestamp] = await oracleAdapter.getAssetPrice(USDC_ADDRESS);
      expect(usdcPrice).to.equal(USDC_PRICE);
    });
    
    it("should revert when querying unmapped assets", async function () {
      await expect(
        oracleAdapter.getAssetPrice("0x9999999999999999999999999999999999999999")
      ).to.be.revertedWith("OracleAdapter: Asset not mapped");
    });
    
    it("should reflect price updates from the original oracle", async function () {
      // Update price in the mock oracle
      const NEW_BTC_PRICE = ethers.parseUnits("65000", 18);
      await mockOracleProvider.updatePrice(BTC_ID, NEW_BTC_PRICE);
      
      // Check that the adapter reflects the updated price
      const [updatedPrice, timestamp] = await oracleAdapter.getAssetPrice(BTC_ADDRESS);
      expect(updatedPrice).to.equal(NEW_BTC_PRICE);
    });
  });

  describe("Oracle Management", function () {
    it("should return the correct price decimals", async function () {
      expect(await oracleAdapter.getPriceDecimals()).to.equal(18);
    });
    
    it("should be able to switch to a new oracle provider", async function () {
      // Deploy a new mock oracle provider
      const MockOracleProvider = await ethers.getContractFactory("MockOracleProvider");
      const newMockProvider = await MockOracleProvider.deploy();
      
      // Add assets with different prices
      const NEW_BTC_PRICE = ethers.parseUnits("70000", 18);
      await newMockProvider.addAsset(BTC_ID, NEW_BTC_PRICE);
      await newMockProvider.addAsset(ETH_ID, ethers.parseUnits("4000", 18));
      await newMockProvider.addAsset(USDC_ID, ethers.parseUnits("1", 18));
      
      // Update the oracle provider
      await oracleAdapter.connect(admin).updateOriginalOracle(await newMockProvider.getAddress());
      
      // Verify new prices are used
      const [btcPrice, timestamp] = await oracleAdapter.getAssetPrice(BTC_ADDRESS);
      expect(btcPrice).to.equal(NEW_BTC_PRICE);
    });
    
    it("should only allow admin to update the oracle provider", async function () {
      // Deploy a new mock oracle provider
      const MockOracleProvider = await ethers.getContractFactory("MockOracleProvider");
      const newMockProvider = await MockOracleProvider.deploy();
      
      // Non-admin should not be able to update the oracle provider
      await expect(
        oracleAdapter.connect(user1).updateOriginalOracle(await newMockProvider.getAddress())
      ).to.be.revertedWithCustomError(oracleAdapter, "AccessControlUnauthorizedAccount");
      
      // Admin should be able to update the oracle provider
      await oracleAdapter.connect(admin).updateOriginalOracle(await newMockProvider.getAddress());
    });
  });

  describe("Original Oracle Integration", function () {
    it("should correctly check if an identifier is supported by the original oracle", async function () {
      expect(await oracleAdapter.checkIdentifierSupported(BTC_ID)).to.be.true;
      expect(await oracleAdapter.checkIdentifierSupported(ETH_ID)).to.be.true;
      expect(await oracleAdapter.checkIdentifierSupported(USDC_ID)).to.be.true;
      expect(await oracleAdapter.checkIdentifierSupported("XYZ")).to.be.false;
    });
    
    it("should return the original oracle's supported assets", async function () {
      const assets = await oracleAdapter.getOriginalOracleAssets();
      expect(assets.length).to.equal(3);
      expect(assets).to.include(BTC_ID);
      expect(assets).to.include(ETH_ID);
      expect(assets).to.include(USDC_ID);
    });
    
    it("should emit events when updating oracle and mapping assets", async function () {
      // Deploy a new mock oracle provider
      const MockOracleProvider = await ethers.getContractFactory("MockOracleProvider");
      const newMockProvider = await MockOracleProvider.deploy();
      
      // Check for OracleUpdated event
      await expect(oracleAdapter.connect(admin).updateOriginalOracle(await newMockProvider.getAddress()))
        .to.emit(oracleAdapter, "OracleUpdated")
        .withArgs(await newMockProvider.getAddress());
      
      // Add a new asset to the new provider
      const NEW_TOKEN = "0x5555555555555555555555555555555555555555";
      const NEW_ID = "XRP";
      await newMockProvider.addAsset(NEW_ID, ethers.parseUnits("1", 18));
      
      // Check for AssetMapped event
      await expect(oracleAdapter.connect(admin).mapAsset(NEW_TOKEN, NEW_ID))
        .to.emit(oracleAdapter, "AssetMapped")
        .withArgs(NEW_TOKEN, NEW_ID);
    });
  });
});

// MockOracleProvider implementation for testing
contract("MockOracleProvider", () => {
  class MockOracleProvider {
    constructor() {
      this.prices = new Map();
      this.timestamps = new Map();
      this.assetList = [];
      this.isActive = true;
    }

    async addAsset(asset, price) {
      if (!this.prices.has(asset)) {
        this.assetList.push(asset);
      }
      this.prices.set(asset, price);
      this.timestamps.set(asset, Math.floor(Date.now() / 1000));
    }

    async updatePrice(asset, price) {
      if (!this.prices.has(asset)) {
        throw new Error("Asset not supported");
      }
      this.prices.set(asset, price);
      this.timestamps.set(asset, Math.floor(Date.now() / 1000));
    }

    async getLatestPrice(asset) {
      if (!this.prices.has(asset)) {
        throw new Error("Asset not supported");
      }
      return [this.prices.get(asset), this.timestamps.get(asset)];
    }

    async supportedAssets() {
      return this.assetList;
    }

    async setActive(active) {
      this.isActive = active;
    }

    async isActive() {
      return this.isActive;
    }

    async decimals() {
      return 18;
    }
  }
});