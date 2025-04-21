// First require hardhat and chai for environment
const { expect } = require("chai");
const hardhat = require("hardhat");

// Then include enhanced compatibility
const ethers = require("../../utils/ethers-v6-compat.js");
const ethers = enhancedEthers;

// Helper function for safer signer retrieval
async function safeGetSigners() {
  console.log("Attempting to get signers safely...");
  try {
    // Try ethers directly first
    const signers = await ethers.getSigners();
    if (signers && signers.length > 0) {
      console.log("Successfully retrieved signers via ethers.getSigners()");
      return signers;
    }
    throw new Error("No signers returned from ethers.getSigners()");
  } catch (error) {
    console.error("Error with ethers.getSigners():", error.message);
    
    // Try hardhat.ethers as fallback
    try {
      console.log("Trying hardhat.ethers.getSigners() as fallback");
      const hardhatSigners = await hardhat.ethers.getSigners();
      if (hardhatSigners && hardhatSigners.length > 0) {
        console.log("Successfully retrieved signers via hardhat.ethers.getSigners()");
        return hardhatSigners;
      }
      throw new Error("No signers returned from hardhat.ethers.getSigners()");
    } catch (fallbackError) {
      console.error("All signer retrieval methods failed:", fallbackError.message);
      throw error; // Throw the original error
    }
  }
}

// Helper function for safer contract factory retrieval
async function safeGetContractFactory(contractName) {
  console.log(`Attempting to get contract factory for ${contractName}...`);
  try {
    // Try ethers directly first
    return await ethers.getContractFactory(contractName);
  } catch (error) {
    console.error(`Error with ethers.getContractFactory for ${contractName}:`, error.message);
    
    // Try hardhat.ethers as fallback
    try {
      console.log(`Trying hardhat.ethers.getContractFactory for ${contractName} as fallback`);
      return await hardhat.ethers.getContractFactory(contractName);
    } catch (fallbackError) {
      console.error(`All factory retrieval methods failed for ${contractName}:`, fallbackError.message);
      throw error; // Throw the original error
    }
  }
}

describe("PriceOracle Simple Test", function() {
  let priceOracle;
  let mockToken;
  let owner, admin, priceUpdater;
  
  before(async function() {
    console.log("Getting signers from ethers...");
    // Use our safe function instead of direct ethers.getSigners
    const signers = await safeGetSigners();
    [owner, admin, priceUpdater] = signers;
    console.log("Signers obtained successfully");
    
    // Deploy PriceOracle using safe factory function
    console.log("Deploying PriceOracle contract");
    const PriceOracle = await safeGetContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    console.log("PriceOracle deployed successfully");
    
    // Deploy mock token for testing using safe factory function
    console.log("Deploying MockERC20 contract");
    const MockToken = await safeGetContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();
    console.log("MockERC20 deployed successfully");
    
    // Set up price updater role
    await priceOracle.connect(admin).addPriceUpdater(priceUpdater.address);
  });
  
  it("should be properly deployed with correct roles", async function() {
    // Use the already obtained signer references
    console.log("Verifying proper deployment and roles");
    
    // Basic role checks
    expect(await priceOracle.owner()).to.equal(owner.address);
    expect(await priceOracle.admin()).to.equal(admin.address);
    expect(await priceOracle.priceUpdaters(priceUpdater.address)).to.be.true;
    
    // Check for default prices
    const tokenAddress = await mockToken.getAddress();
    expect(await priceOracle.getPrice(tokenAddress)).to.equal(0n);
    console.log("Role verification complete");
  });
  
  it("should allow price updates from authorized users", async function() {
    // Use the already obtained signer references
    console.log("Testing price updates from authorized users");
    const PRICE = ethers.parseEther("1.5");
    
    // Get token address
    const tokenAddress = await mockToken.getAddress();
    
    // Set price by price updater
    console.log("Setting price as price updater");
    await priceOracle.connect(priceUpdater).setPrice(tokenAddress, PRICE);
    expect(await priceOracle.getPrice(tokenAddress)).to.equal(PRICE);
    
    // Update price by admin
    console.log("Updating price as admin");
    const NEW_PRICE = ethers.parseEther("2.0");
    await priceOracle.connect(admin).setPrice(tokenAddress, NEW_PRICE);
    expect(await priceOracle.getPrice(tokenAddress)).to.equal(NEW_PRICE);
    console.log("Price update tests passed");
  });
});