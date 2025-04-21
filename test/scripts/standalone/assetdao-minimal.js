// SPDX-License-Identifier: MIT
const { ethers } = require('hardhat');
const { expect } = require('chai');

// Basic test for AssetDAO
async function main() {
  console.log("Starting minimal AssetDAO test");
  
  try {
    // Configure provider with retry logic
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    
    // Wait for provider to connect
    let connected = false;
    let retries = 10;
    
    while (!connected && retries > 0) {
      try {
        console.log(`Attempting to connect to the network (${retries} retries left)...`);
        await provider.getNetwork();
        connected = true;
        console.log("Successfully connected to the network!");
      } catch (error) {
        console.log(`Connection failed: ${error.message}`);
        retries--;
        // Wait 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!connected) {
      throw new Error("Failed to connect to Hardhat node after multiple attempts");
    }
    
    // Get signers
    const accounts = await ethers.getSigners();
    const [owner, user1, user2] = accounts;
    
    console.log("Connected accounts:");
    console.log(`Owner: ${owner.address}`);
    console.log(`User1: ${user1.address}`);
    
    // Deploy mock tokens
    console.log("Deploying mock tokens...");
    const MockToken = await ethers.getContractFactory("MockToken");
    const daiToken = await MockToken.deploy("Mock DAI", "DAI", 18);
    await daiToken.waitForDeployment();
    
    const dloopToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    await dloopToken.waitForDeployment();
    
    console.log(`DAI Token deployed at: ${await daiToken.getAddress()}`);
    console.log(`DLOOP Token deployed at: ${await dloopToken.getAddress()}`);
    
    // Deploy mock price oracle
    console.log("Deploying mock price oracle...");
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const priceOracle = await MockPriceOracle.deploy();
    await priceOracle.waitForDeployment();
    console.log(`Mock Price Oracle deployed at: ${await priceOracle.getAddress()}`);
    
    // Set token prices
    const daiPrice = ethers.parseUnits("1", 18); // 1 USD
    const dloopPrice = ethers.parseUnits("10", 18); // 10 USD
    await priceOracle.updatePrice(await daiToken.getAddress(), daiPrice);
    await priceOracle.updatePrice(await dloopToken.getAddress(), dloopPrice);
    console.log("Token prices set in price oracle");
    
    // Deploy mock fee processor
    console.log("Deploying mock fee processor...");
    const MockFeeProcessor = await ethers.getContractFactory("MockFeeProcessor");
    const feeProcessor = await MockFeeProcessor.deploy();
    await feeProcessor.waitForDeployment();
    console.log(`Mock Fee Processor deployed at: ${await feeProcessor.getAddress()}`);
    
    // Deploy mock protocol DAO
    console.log("Deploying mock protocol DAO...");
    const MockProtocolDAO = await ethers.getContractFactory("MockProtocolDAO");
    const protocolDAO = await MockProtocolDAO.deploy();
    await protocolDAO.waitForDeployment();
    console.log(`Mock Protocol DAO deployed at: ${await protocolDAO.getAddress()}`);
    
    // Deploy AssetDAO
    console.log("Deploying AssetDAO...");
    const AssetDAO = await ethers.getContractFactory("contracts/core/AssetDAO.sol:AssetDAO");
    const assetDAO = await AssetDAO.deploy(
      await daiToken.getAddress(),
      await dloopToken.getAddress(),
      await priceOracle.getAddress(),
      await feeProcessor.getAddress(),
      await protocolDAO.getAddress()
    );
    await assetDAO.waitForDeployment();
    console.log(`AssetDAO deployed at: ${await assetDAO.getAddress()}`);
    
    // Verify initial settings
    console.log("Verifying initial settings...");
    const depositToken = await assetDAO.daiToken();
    expect(depositToken).to.equal(await daiToken.getAddress());
    console.log("Deposit token (DAI) verified");
    
    const govToken = await assetDAO.dloopToken();
    expect(govToken).to.equal(await dloopToken.getAddress());
    console.log("Governance token (DLOOP) verified");
    
    console.log("Minimal AssetDAO test completed successfully!");
    return true;
  } catch (error) {
    console.error("Test failed:", error);
    return false;
  }
}

// Execute the test
main()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });