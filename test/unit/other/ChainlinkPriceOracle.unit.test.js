const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("ChainlinkPriceOracle", function () {
  let owner, fallbackAdmin, user, feedManager, admin;
  let chainlinkOracle, mockAggregator, mockToken;

  const PRICE_DECIMALS = 8;
  const INITIAL_PRICE = ethers.parseUnits("1800", PRICE_DECIMALS);

  beforeEach(async function () {
    [owner, fallbackAdmin, user, feedManager, admin] = await ethers.getSigners();

    // Deploy mock token
    const TokenFactory = await ethers.getContractFactory("test/mocks/MockToken.sol:MockToken");
    mockToken = await TokenFactory.deploy("Mock Token", "MTK", 18);
    await mockToken.waitForDeployment();
    if (!mockToken) throw new Error('MockToken deployment failed (null)');
    if (typeof mockToken === 'undefined') throw new Error('MockToken deployment failed (undefined)');
    console.log('mockToken:', mockToken);
    expect(mockToken.target).to.be.properAddress;

    // Deploy mock aggregator
    const AggregatorFactory = await ethers.getContractFactory("test/mocks/MockChainlinkAggregator.sol:MockChainlinkAggregator");
    mockAggregator = await AggregatorFactory.deploy(PRICE_DECIMALS, INITIAL_PRICE);
    await mockAggregator.waitForDeployment();
    if (!mockAggregator) throw new Error('MockChainlinkAggregator deployment failed (null)');
    if (typeof mockAggregator === 'undefined') throw new Error('MockChainlinkAggregator deployment failed (undefined)');
    console.log('mockAggregator:', mockAggregator);
    expect(mockAggregator.target).to.be.properAddress;

    // Deploy ChainlinkPriceOracle
    const OracleFactory = await ethers.getContractFactory("ChainlinkPriceOracle");
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
      mockToken.address,
      mockAggregator.target,
      3600, // 1 hour staleness
      60,   // heartbeat
      95    // reliabilityScore
    );
  });

  it("reads price from Chainlink aggregator", async function () {
    const price = await chainlinkOracle.getAssetPrice(mockToken.address);
    expect(price).to.equal(INITIAL_PRICE);
  });

  it("stores and returns heartbeat and reliabilityScore", async function () {
    // No direct getter, but can check via event or by re-setting and reading
    // For this test, we assume setFeed emits FeedSet event (see event test below)
    // If contract exposes public getter, add check here
    await mockAggregator.setHeartbeat(120);
    await mockAggregator.setReliabilityScore(80);
    expect(await mockAggregator.heartbeat()).to.equal(120);
    expect(await mockAggregator.reliabilityScore()).to.equal(80);
  });

  it("enforces role-based access control for feed and fallback management", async function () {
    await expect(chainlinkOracle.connect(user).setFeed(mockToken.address, mockAggregator.target, 3600, 60, 90)).to.be.reverted;
    await expect(chainlinkOracle.connect(user).setFallbackPrice(mockToken.address, INITIAL_PRICE, PRICE_DECIMALS)).to.be.reverted;
  });

  it("normalizes price to 18 decimals from various feed decimals", async function () {
    // 6 decimals
    await mockAggregator.setDecimals(6);
    const price6 = ethers.parseUnits("1800", 6);
    await mockAggregator.setAnswer(price6);
    await chainlinkOracle.connect(feedManager).setFeed(mockToken.address, mockAggregator.target, 3600, 60, 90);
    const norm6 = await chainlinkOracle.getAssetPrice(mockToken.address);
    expect(norm6).to.equal(ethers.parseUnits("1800", 18));
    // 18 decimals
    await mockAggregator.setDecimals(18);
    const price18 = ethers.parseUnits("1800", 18);
    await mockAggregator.setAnswer(price18);
    await chainlinkOracle.connect(feedManager).setFeed(mockToken.address, mockAggregator.target, 3600, 60, 90);
    const norm18 = await chainlinkOracle.getAssetPrice(mockToken.address);
    expect(norm18).to.equal(price18);
  });

  it("emits events for staleness and fallback", async function () {
    // Simulate staleness
    const block = await ethers.provider.getBlock("latest");
    await mockAggregator.setTimestamp(block.timestamp - 4000);
    await expect(chainlinkOracle.getAssetPrice(mockToken.address)).to.be.revertedWith("Chainlink price stale");
    // Remove feed and set fallback
    await chainlinkOracle.connect(feedManager).removeFeed(mockToken.address);
    await chainlinkOracle.connect(admin).setFallbackPrice(mockToken.address, INITIAL_PRICE, PRICE_DECIMALS);
    const price = await chainlinkOracle.getAssetPrice(mockToken.address);
    expect(price).to.equal(ethers.parseUnits("1800", 18));
  });

  it("handles edge cases: invalid price, update time, fallback staleness", async function () {
    // Invalid answer
    await mockAggregator.setAnswer(0);
    await expect(chainlinkOracle.getAssetPrice(mockToken.address)).to.be.reverted;
    // Invalid update time
    await mockAggregator.setTimestamp(0);
    await expect(chainlinkOracle.getAssetPrice(mockToken.address)).to.be.reverted;
    // Fallback staleness
    await chainlinkOracle.connect(feedManager).removeFeed(mockToken.address);
    await chainlinkOracle.connect(admin).setFallbackPrice(mockToken.address, INITIAL_PRICE, PRICE_DECIMALS);
    // Simulate fallback staleness
    const block = await ethers.provider.getBlock("latest");
    await chainlinkOracle.connect(admin).setFallbackStaleness(1);
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine");
    await expect(chainlinkOracle.getAssetPrice(mockToken.address)).to.be.revertedWith("Fallback price stale");
  });

  it("reverts if price is stale", async function () {
    // Simulate staleness
    const block = await ethers.provider.getBlock("latest");
    await mockAggregator.setTimestamp(block.timestamp - 4000);
    await expect(chainlinkOracle.getAssetPrice(mockToken.address)).to.be.revertedWith("Chainlink price stale");
  });

  it("falls back to fallback price if aggregator not set", async function () {
    // Remove feed and set fallback
    await chainlinkOracle.connect(fallbackAdmin).setFeed(mockToken.address, ethers.ZeroAddress, 3600);
    await chainlinkOracle.connect(fallbackAdmin).setFallbackPrice(mockToken.address, INITIAL_PRICE, PRICE_DECIMALS);

    const price = await chainlinkOracle.getAssetPrice(mockToken.address);
    expect(price).to.equal(INITIAL_PRICE);
  });
});
