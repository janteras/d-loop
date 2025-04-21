/**
 * @title PriceOracle Gas Test
 * @dev Test file for validating PriceOracle with gas profiling
 */

const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("PriceOracle Gas Test", function() {
  let priceOracle;
  let mockToken;
  let owner, admin, priceUpdater;
  
  before(async function() {
    // Get signers directly from ethers
    [owner, admin, priceUpdater] = await ethers.getSigners();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();
    
    // Set up price updater role
    await priceOracle.connect(admin).addPriceUpdater(priceUpdater.address);
  });
  
  it("should be properly deployed with correct roles", async function() {
    // Basic role checks
    expect(await priceOracle.owner()).to.equal(owner.address);
    expect(await priceOracle.admin()).to.equal(admin.address);
    expect(await priceOracle.priceUpdaters(priceUpdater.address)).to.be.true;
    
    // Check for default prices
    expect(await priceOracle.getPrice(mockToken.getAddress())).to.equal(0n);
  });
  
  it("should allow price updates from authorized users", async function() {
    const PRICE = ethers.parseEther("1.5");
    
    // Set price by price updater
    await priceOracle.connect(priceUpdater).setPrice(await mockToken.getAddress(), PRICE);
    expect(await priceOracle.getPrice(await mockToken.getAddress())).to.equal(PRICE);
    
    // Update price by admin
    const NEW_PRICE = ethers.parseEther("2.0");
    await priceOracle.connect(admin).setPrice(await mockToken.getAddress(), NEW_PRICE);
    expect(await priceOracle.getPrice(await mockToken.getAddress())).to.equal(NEW_PRICE);
  });
  
  it("should enforce access control for price updates", async function() {
    const PRICE = ethers.parseEther("3.0");
    
    // Owner should not be able to update prices directly
    await expect(
      priceOracle.connect(owner).setPrice(await mockToken.getAddress(), PRICE)
    ).to.be.revertedWith("Not authorized");
    
    // Random address should not be able to update prices
    const [,,, randomUser] = await ethers.getSigners();
    await expect(
      priceOracle.connect(randomUser).setPrice(await mockToken.getAddress(), PRICE)
    ).to.be.revertedWith("Not authorized");
  });
  
  it("should handle batch price updates efficiently", async function() {
    // Deploy multiple mock tokens
    const tokenCount = 5;
    const tokens = [];
    const prices = [];
    
    for (let i = 0; i < tokenCount; i++) {
      const MockToken = await ethers.getContractFactory("MockERC20");
      const token = await MockToken.deploy(`Token ${i}`, `T${i}`, 18);
      await token.waitForDeployment();
      tokens.push(await token.getAddress());
      prices.push(ethers.parseEther((i + 1).toString()));
    }
    
    // Batch update prices
    await priceOracle.connect(admin).setPrices(tokens, prices);
    
    // Verify all prices were set correctly
    for (let i = 0; i < tokenCount; i++) {
      expect(await priceOracle.getPrice(tokens[i])).to.equal(prices[i]);
    }
  });
});