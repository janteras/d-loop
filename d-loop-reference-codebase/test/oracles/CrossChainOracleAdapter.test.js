const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainOracleAdapter", function () {
  let owner, admin, feeder, crossChainFeeder, user;
  let oracleAdapter;
  let mockToken;
  
  const ETHEREUM_CHAIN_ID = 1;
  const HEDERA_CHAIN_ID = 295;
  
  beforeEach(async function () {
    [owner, admin, feeder, crossChainFeeder, user] = await ethers.getSigners();
    
    // Deploy a mock token for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");
    await mockToken.deployed();
    
    // Deploy the oracle adapter
    const CrossChainOracleAdapter = await ethers.getContractFactory("CrossChainOracleAdapter");
    oracleAdapter = await CrossChainOracleAdapter.deploy(admin.address);
    await oracleAdapter.deployed();
    
    // Configure roles
    await oracleAdapter.connect(admin).grantPriceFeederRole(feeder.address);
    await oracleAdapter.connect(admin).grantCrossChainFeederRole(crossChainFeeder.address);
  });
  
  describe("Basic Oracle Functions", function () {
    it("should correctly initialize with admin role", async function () {
      expect(await oracleAdapter.hasRole(await oracleAdapter.ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await oracleAdapter.hasRole(await oracleAdapter.PRICE_FEEDER_ROLE(), feeder.address)).to.be.true;
      expect(await oracleAdapter.hasRole(await oracleAdapter.CROSS_CHAIN_FEEDER_ROLE(), crossChainFeeder.address)).to.be.true;
    });
    
    it("should correctly add and remove assets", async function () {
      // Add an asset
      await oracleAdapter.connect(admin).addAsset(mockToken.address, "0.0.1234567");
      
      // Check if asset is supported
      expect(await oracleAdapter.isAssetSupported(mockToken.address)).to.be.true;
      
      // Check asset identifiers
      const identifiers = await oracleAdapter.getAssetIdentifiers(mockToken.address);
      expect(identifiers.ethereumAsset).to.equal(mockToken.address);
      expect(identifiers.hederaAsset).to.equal("0.0.1234567");
      
      // Check reverse mapping
      expect(await oracleAdapter.getEthereumAsset("0.0.1234567")).to.equal(mockToken.address);
      
      // Remove the asset
      await oracleAdapter.connect(admin).removeAsset(mockToken.address);
      
      // Check if asset is no longer supported
      expect(await oracleAdapter.isAssetSupported(mockToken.address)).to.be.false;
      
      // Check reverse mapping is removed
      expect(await oracleAdapter.getEthereumAsset("0.0.1234567")).to.equal(ethers.constants.AddressZero);
    });
    
    it("should enforce role-based access control", async function () {
      // Only admin should be able to add assets
      await expect(
        oracleAdapter.connect(user).addAsset(mockToken.address, "0.0.1234567")
      ).to.be.reverted;
      
      // Add asset with proper role
      await oracleAdapter.connect(admin).addAsset(mockToken.address, "0.0.1234567");
      
      // Only feeders can update prices
      await expect(
        oracleAdapter.connect(user).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("100", 18))
      ).to.be.reverted;
      
      // Only cross-chain feeders can update Hedera prices
      await expect(
        oracleAdapter.connect(feeder).updateHederaPrice("0.0.1234567", ethers.utils.parseUnits("100", 18))
      ).to.be.reverted;
    });
  });
  
  describe("Price Updates and Aggregation", function () {
    beforeEach(async function () {
      // Add an asset for testing
      await oracleAdapter.connect(admin).addAsset(mockToken.address, "0.0.1234567");
    });
    
    it("should update Ethereum prices correctly", async function () {
      const price = ethers.utils.parseUnits("100", 18);
      
      // Update price
      await oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, price);
      
      // Get price by chain
      const [chainPrice, timestamp] = await oracleAdapter.getAssetPriceByChain(mockToken.address, ETHEREUM_CHAIN_ID);
      expect(chainPrice).to.equal(price);
      expect(timestamp).to.be.gt(0);
      
      // Get aggregated price (should match Ethereum price since it's the only one)
      const [aggPrice, aggTimestamp] = await oracleAdapter.getAssetPrice(mockToken.address);
      expect(aggPrice).to.equal(price);
      expect(aggTimestamp).to.equal(timestamp);
    });
    
    it("should update Hedera prices correctly", async function () {
      const price = ethers.utils.parseUnits("105", 18);
      
      // Update price
      await oracleAdapter.connect(crossChainFeeder).updateHederaPrice("0.0.1234567", price);
      
      // Get price by chain
      const [chainPrice, timestamp] = await oracleAdapter.getAssetPriceByChain(mockToken.address, HEDERA_CHAIN_ID);
      expect(chainPrice).to.equal(price);
      expect(timestamp).to.be.gt(0);
      
      // Get aggregated price (should match Hedera price since it's the only one)
      const [aggPrice, aggTimestamp] = await oracleAdapter.getAssetPrice(mockToken.address);
      expect(aggPrice).to.equal(price);
      expect(aggTimestamp).to.equal(timestamp);
    });
    
    it("should aggregate prices from both chains", async function () {
      const ethereumPrice = ethers.utils.parseUnits("100", 18);
      const hederaPrice = ethers.utils.parseUnits("102", 18);
      const expectedAverage = ethereumPrice.add(hederaPrice).div(2);
      
      // Update both prices
      await oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethereumPrice);
      await oracleAdapter.connect(crossChainFeeder).updateHederaPrice("0.0.1234567", hederaPrice);
      
      // Get aggregated price (should be average of both)
      const [aggPrice, _] = await oracleAdapter.getAssetPrice(mockToken.address);
      expect(aggPrice).to.equal(expectedAverage);
    });
    
    it("should reject prices with too much deviation", async function () {
      // Set max deviation to 2%
      await oracleAdapter.connect(admin).setMaxPriceDeviation(200);
      
      // Set initial price
      await oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("100", 18));
      
      // Try to update with too much deviation (3% higher)
      await expect(
        oracleAdapter.connect(crossChainFeeder).updateHederaPrice("0.0.1234567", ethers.utils.parseUnits("103", 18))
      ).to.be.revertedWith("Price deviation too high");
      
      // Update with acceptable deviation (1.5% higher)
      await oracleAdapter.connect(crossChainFeeder).updateHederaPrice("0.0.1234567", ethers.utils.parseUnits("101.5", 18));
    });
    
    it("should enforce minimum update interval", async function () {
      // Set minimum update interval to 1 hour
      await oracleAdapter.connect(admin).setMinUpdateInterval(3600);
      
      // Update price
      await oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("100", 18));
      
      // Try to update again immediately
      await expect(
        oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("101", 18))
      ).to.be.revertedWith("Update too frequent");
    });
    
    it("should batch update prices", async function () {
      // Deploy a second mock token
      const MockERC20_2 = await ethers.getContractFactory("MockERC20");
      const mockToken2 = await MockERC20_2.deploy("Mock Token 2", "MTK2");
      await mockToken2.deployed();
      
      // Add the second token
      await oracleAdapter.connect(admin).addAsset(mockToken2.address, "0.0.7654321");
      
      // Batch update both tokens
      const tokens = [mockToken.address, mockToken2.address];
      const prices = [
        ethers.utils.parseUnits("100", 18),
        ethers.utils.parseUnits("200", 18)
      ];
      
      await oracleAdapter.connect(feeder).updateBatchPrices(tokens, prices, ETHEREUM_CHAIN_ID);
      
      // Check prices
      const [price1, _] = await oracleAdapter.getAssetPrice(mockToken.address);
      const [price2, __] = await oracleAdapter.getAssetPrice(mockToken2.address);
      
      expect(price1).to.equal(prices[0]);
      expect(price2).to.equal(prices[1]);
    });
  });
  
  describe("Oracle Pause/Unpause", function () {
    beforeEach(async function () {
      // Add an asset for testing
      await oracleAdapter.connect(admin).addAsset(mockToken.address, "0.0.1234567");
    });
    
    it("should correctly pause and unpause the oracle", async function () {
      // Pause the oracle
      await oracleAdapter.connect(admin).pause();
      expect(await oracleAdapter.paused()).to.be.true;
      
      // Price updates should be rejected
      await expect(
        oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("100", 18))
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause the oracle
      await oracleAdapter.connect(admin).unpause();
      expect(await oracleAdapter.paused()).to.be.false;
      
      // Price updates should work again
      await oracleAdapter.connect(feeder).updateEthereumPrice(mockToken.address, ethers.utils.parseUnits("100", 18));
      
      // Get price
      const [price, _] = await oracleAdapter.getAssetPrice(mockToken.address);
      expect(price).to.equal(ethers.utils.parseUnits("100", 18));
    });
  });
});