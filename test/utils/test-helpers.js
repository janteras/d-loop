/**
 * @title D-Loop Protocol Test Helpers
 * @dev Utility functions to standardize testing approaches and handle ethers.js v6 compatibility
 */
const { ethers } = require("hardhat");

/**
 * Helper function to safely parse BigInt values
 * @param {any} value - The value to parse
 * @returns {BigInt} - The parsed BigInt value
 */
function safeBigInt(value) {
  try {
    return BigInt(value.toString());
  } catch (error) {
    console.error('Error parsing BigInt:', error.message);
    return BigInt(0);
  }
}

/**
 * Helper function to extract event data from transaction receipt
 * @param {Object} receipt - Transaction receipt from ethers.js
 * @param {Object} contract - Contract instance with interface
 * @param {string} eventName - Name of the event to extract
 * @returns {Object|null} - Parsed event data or null if not found
 */
async function getEventData(receipt, contract, eventName) {
  if (!receipt || !receipt.logs || receipt.logs.length === 0) {
    console.log(`No logs found in receipt when looking for ${eventName}`);
    return null;
  }

  try {
    const eventFragment = contract.interface.getEvent(eventName);
    const eventTopic = eventFragment.topicHash;
    
    const eventLog = receipt.logs.find(log => 
      log.topics && log.topics[0] === eventTopic
    );
    
    if (!eventLog) {
      console.log(`${eventName} event not found in logs`);
      return null;
    }
    
    const parsedLog = contract.interface.parseLog({
      topics: eventLog.topics,
      data: eventLog.data
    });
    
    return parsedLog.args;
  } catch (error) {
    console.error(`Error extracting ${eventName} event data:`, error.message);
    return null;
  }
}

/**
 * Helper function to advance blockchain time
 * @param {number} seconds - Number of seconds to advance
 */
async function advanceTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

/**
 * Helper function to deploy a contract with proper error handling
 * @param {string} contractName - Name of the contract to deploy
 * @param {Array} args - Constructor arguments
 * @returns {Object} - Deployed contract instance
 */
async function deployContract(contractName, args = []) {
  try {
    const ContractFactory = await ethers.getContractFactory(contractName);
    const contract = await ContractFactory.deploy(...args);
    await contract.waitForDeployment();
    console.log(`${contractName} deployed at: ${await contract.getAddress()}`);
    return contract;
  } catch (error) {
    console.error(`Error deploying ${contractName}:`, error.message);
    throw error;
  }
}

/**
 * Helper function to create a standard test fixture for D-Loop protocol
 * @returns {Function} - Async function that deploys all required contracts
 */
function createProtocolFixture() {
  return async function deployFixture() {
    const [owner, admin, user1, user2, node1] = await ethers.getSigners();
    
    // Deploy DAIToken
    const daiToken = await deployContract("DAIToken");
    
    // Mint tokens to test accounts
    const mintAmount = ethers.parseEther("10000");
    await daiToken.mint(user1.address, mintAmount);
    await daiToken.mint(user2.address, mintAmount);
    
    // Deploy DLoopToken
    const dloopToken = await deployContract("DLoopToken", [
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // initialSupply
      18, // decimals
      ethers.parseEther("100000000"), // maxSupply
      admin.address
    ]);
    
    // Deploy a simple PriceOracle for testing
    // This is a simplified version that doesn't rely on Chainlink price feeds
    const PriceOracleFactory = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await PriceOracleFactory.deploy(admin.address);
    
    // For testing purposes, we'll just use the PriceOracle as is
    // In a real scenario, the price would come from the Chainlink price feed
    
    // Deploy ProtocolDAO first (needed for Treasury constructor)
    const protocolDAO = await deployContract("ProtocolDAO", [
      admin.address,
      admin.address, // Temporary treasury address, will update later
      86400, // votingPeriod (1 day in seconds)
      43200, // executionDelay (12 hours in seconds)
      10     // quorum (10%)
    ]);
    
    // Deploy Treasury with correct constructor arguments
    const treasury = await deployContract("Treasury", [
      admin.address,
      await protocolDAO.getAddress()
    ]);
    
    // Deploy FeeCalculator with correct constructor arguments
    const feeCalculator = await deployContract("FeeCalculator", [
      admin.address,                  // _feeAdmin
      await treasury.getAddress(),    // _treasury
      admin.address,                  // _rewardDistributor (using admin for testing)
      1000,                           // _investFeePercentage (10%)
      500,                            // _divestFeePercentage (5%)
      40                              // _ragequitFeePercentage (0.4%)
    ]);
    
    // Deploy FeeProcessor with correct constructor arguments
    const feeProcessor = await deployContract("FeeProcessor", [
      await treasury.getAddress(),
      admin.address
    ]);
    
    // Deploy GovernanceRewards
    const governanceRewards = await deployContract("GovernanceRewards", [
      await dloopToken.getAddress(),
      admin.address
    ]);
    
    // Deploy AssetDAO with correct constructor arguments
    const assetDAO = await deployContract("AssetDAO", [
      await daiToken.getAddress(),
      await dloopToken.getAddress(),
      await priceOracle.getAddress(),
      await feeProcessor.getAddress(),
      await protocolDAO.getAddress()
    ]);
    
    // Grant roles
    const ASSET_MANAGER_ROLE = await assetDAO.ASSET_MANAGER_ROLE();
    await assetDAO.connect(admin).grantRole(ASSET_MANAGER_ROLE, user1.address);
    
    // Update ProtocolDAO with the correct treasury address
    await protocolDAO.connect(admin).setTreasury(await treasury.getAddress());
    
    // Connect contracts
    await feeProcessor.connect(admin).setAssetDAO(await assetDAO.getAddress());
    await feeProcessor.connect(admin).setFeeCalculator(await feeCalculator.getAddress());
    await governanceRewards.connect(admin).setAssetDAO(await assetDAO.getAddress());
    
    return {
      owner,
      admin,
      user1,
      user2,
      node1,
      daiToken,
      dloopToken,
      priceOracle,
      treasury,
      feeCalculator,
      feeProcessor,
      governanceRewards,
      assetDAO,
      protocolDAO
    };
  };
}

module.exports = {
  safeBigInt,
  getEventData,
  advanceTime,
  deployContract,
  createProtocolFixture
};
