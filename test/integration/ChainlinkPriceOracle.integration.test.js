const { ethers: hardhatEthers } = require("hardhat");
const { ethers, ZeroAddress } = require("ethers");
const { expect } = require("chai");

// Integration test for ChainlinkPriceOracle using MockChainlinkAggregator

describe("ChainlinkPriceOracle Integration", function () {
  let owner, fallbackAdmin, user, feedManager, admin;
  let chainlinkOracle, mockAggregator, mockToken, assetDAO;

  const PRICE_DECIMALS = 8;
  const INITIAL_PRICE = ethers.parseUnits("1800", PRICE_DECIMALS);
  const UPDATED_PRICE = ethers.parseUnits("2000", PRICE_DECIMALS);

  beforeEach(async function () {
    [owner, fallbackAdmin, user, feedManager, admin] = await hardhatEthers.getSigners();

    // Deploy mock token
    const TokenFactory = await hardhatEthers.getContractFactory("test/mocks/MockToken.sol:MockToken");
    mockToken = await TokenFactory.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();
    if (!mockToken) throw new Error('MockToken deployment failed (null)');
    if (typeof mockToken === 'undefined') throw new Error('MockToken deployment failed (undefined)');
    console.log('mockToken:', mockToken);
    expect(mockToken.target).to.be.properAddress;

    // Deploy mock aggregator
    const AggregatorFactory = await hardhatEthers.getContractFactory("test/mocks/MockChainlinkAggregator.sol:MockChainlinkAggregator");
    mockAggregator = await AggregatorFactory.deploy(PRICE_DECIMALS, INITIAL_PRICE);
    await mockAggregator.waitForDeployment();
    if (!mockAggregator) throw new Error('MockChainlinkAggregator deployment failed (null)');
    if (typeof mockAggregator === 'undefined') throw new Error('MockChainlinkAggregator deployment failed (undefined)');
    console.log('mockAggregator:', mockAggregator);
    expect(mockAggregator.target).to.be.properAddress;

    // Deploy ChainlinkPriceOracle
    const OracleFactory = await hardhatEthers.getContractFactory("ChainlinkPriceOracle");
    chainlinkOracle = await OracleFactory.deploy(fallbackAdmin.address);
    await chainlinkOracle.waitForDeployment();
    if (!chainlinkOracle) throw new Error('ChainlinkPriceOracle deployment failed (null)');
    if (typeof chainlinkOracle === 'undefined') throw new Error('ChainlinkPriceOracle deployment failed (undefined)');
    console.log('chainlinkOracle:', chainlinkOracle);
    expect(chainlinkOracle.target).to.be.properAddress;

    // Grant roles for role-based access control
    await chainlinkOracle.connect(fallbackAdmin).grantRole(await chainlinkOracle.ADMIN_ROLE(), admin.address);
    await chainlinkOracle.connect(fallbackAdmin).grantRole(await chainlinkOracle.FEED_MANAGER_ROLE(), feedManager.address);

    // Register the aggregator for the token
    await chainlinkOracle.connect(feedManager).setFeed(
      mockToken.target,
      mockAggregator.target,
      3600, // 1 hour staleness
      60,   // heartbeat
      95    // reliabilityScore
    );

    // Deploy AssetDAO and set up with the oracle
    const AssetDAOFactory = await hardhatEthers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAOFactory.deploy(
    // Add waitForDeployment for AssetDAO
    // (If AssetDAO is a proxy, adjust accordingly)
    
      mockToken.target,
      mockToken.target,
      chainlinkOracle.target,
      fallbackAdmin.address,
      fallbackAdmin.address
    );
    await assetDAO.waitForDeployment();
    if (!assetDAO) throw new Error('AssetDAO deployment failed (null)');
    if (typeof assetDAO === 'undefined') throw new Error('AssetDAO deployment failed (undefined)');
    console.log('assetDAO:', assetDAO);
    expect(assetDAO.target).to.be.properAddress;
  });
  });

  it("should fetch the correct price from the aggregator", async function () {
    const price = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(price).to.equal(INITIAL_PRICE);
  });

  it("should allow AssetDAO to fetch normalized price via _getAssetPrice", async function () {
    // Assume AssetDAO exposes a public test function for _getAssetPrice
    const price = await assetDAO.callStatic._getAssetPrice(mockToken.target);
    expect(price).to.equal(INITIAL_PRICE);
  });

  it("should update heartbeat and reliability and reflect in tests", async function () {
    await mockAggregator.setHeartbeat(120);
    await mockAggregator.setReliabilityScore(80);
    expect(await mockAggregator.heartbeat()).to.equal(120);
    expect(await mockAggregator.reliabilityScore()).to.equal(80);
  });

  it("should simulate staleness and fallback in integration", async function () {
    // Simulate staleness
    const block = await hardhatEthers.provider.getBlock("latest");
    await mockAggregator.setTimestamp(block.timestamp - 4000);
    await expect(chainlinkOracle.getAssetPrice(mockToken.target)).to.be.revertedWith("Chainlink price stale");
    // Remove feed and set fallback
    await chainlinkOracle.connect(feedManager).removeFeed(mockToken.target);
    await chainlinkOracle.connect(admin).setFallbackPrice(mockToken.target, INITIAL_PRICE, PRICE_DECIMALS);
    const price = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(price).to.equal(hardhatEthers.parseUnits("1800", 18));
  });

  it("should normalize price to 18 decimals for various aggregator decimals", async function () {
    await mockAggregator.setDecimals(6);
    const price6 = hardhatEthers.parseUnits("1800", 6);
    await mockAggregator.setAnswer(price6);
    await chainlinkOracle.connect(feedManager).setFeed(mockToken.target, mockAggregator.target, 3600, 60, 90);
    const norm6 = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(norm6).to.equal(hardhatEthers.parseUnits("1800", 18));
    await mockAggregator.setDecimals(18);
    const price18 = hardhatEthers.parseUnits("1800", 18);
    await mockAggregator.setAnswer(price18);
    await chainlinkOracle.connect(feedManager).setFeed(mockToken.target, mockAggregator.target, 3600, 60, 90);
    const norm18 = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(norm18).to.equal(price18);
  });

  it("should enforce role-based access control in integration", async function () {
    await expect(chainlinkOracle.connect(user).setFeed(mockToken.target, mockAggregator.target, 3600, 60, 90)).to.be.reverted;
    await expect(chainlinkOracle.connect(user).setFallbackPrice(mockToken.target, INITIAL_PRICE, PRICE_DECIMALS)).to.be.reverted;
  });

  it("should reflect price updates from the aggregator", async function () {
    await mockAggregator.setAnswer(UPDATED_PRICE);
    const price = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(price).to.equal(UPDATED_PRICE);
  });

  it("should revert if the price is stale", async function () {
    const block = await hardhatEthers.provider.getBlock("latest");
    await mockAggregator.setTimestamp(block.timestamp - 4000);
    await expect(chainlinkOracle.getAssetPrice(mockToken.target)).to.be.revertedWith("Chainlink price stale");
  });

  it("should fallback to fallback price if aggregator is unset", async function () {
    await chainlinkOracle.connect(fallbackAdmin).setFeed(mockToken.target, ZeroAddress, 3600);
    await chainlinkOracle.connect(fallbackAdmin).setFallbackPrice(mockToken.target, INITIAL_PRICE, PRICE_DECIMALS);
    const price = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(price).to.equal(INITIAL_PRICE);
  });

  it("should handle decimal changes in aggregator", async function () {
    // Set new decimals and price
    await mockAggregator.setDecimals(6);
    const newPrice = ethers.parseUnits("1800", 6);
    await mockAggregator.setAnswer(newPrice);
    // Update feed to reflect new decimals
    await chainlinkOracle.connect(fallbackAdmin).setFeed(mockToken.target, mockAggregator.target, 3600);
    const price = await chainlinkOracle.getAssetPrice(mockToken.target);
    expect(price).to.equal(newPrice);
  });

  it("should not allow non-admin to set feed or fallback price", async function () {
    await expect(
      chainlinkOracle.connect(user).setFeed(mockToken.target, mockAggregator.target, 3600)
    ).to.be.reverted;
    await expect(
      chainlinkOracle.connect(user).setFallbackPrice(mockToken.target, INITIAL_PRICE, PRICE_DECIMALS)
    ).to.be.reverted;
  });
});
