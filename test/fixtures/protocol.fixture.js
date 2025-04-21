/**
 * @title D-Loop Protocol Test Fixtures
 * @dev Reusable test fixtures for D-Loop Protocol tests
 * 
 * This module provides standardized fixtures for:
 * 1. Core contract deployment
 * 2. Token contract deployment
 * 3. Governance contract deployment
 * 4. Fee system contract deployment
 * 5. Oracle contract deployment
 * 
 * Each fixture is designed to be used with the loadFixture function from hardhat-network-helpers
 */

const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

/**
 * Helper function to load contract artifacts
 * @param {string} contractName - Name of the contract
 * @returns {Object} Contract artifact
 */
function loadArtifact(contractName) {
  const directories = [
    "core",
    "token",
    "fees",
    "oracle",
    "governance",
    "identity",
    "utils",
    "adapters"
  ];
  
  for (const dir of directories) {
    const artifactPath = path.join(__dirname, `../../artifacts/contracts/${dir}/${contractName}.sol/${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      return require(artifactPath);
    }
  }
  
  // Special cases
  if (contractName === "PriceOracle") {
    const oraclePath = path.join(__dirname, `../../artifacts/contracts/oracle/PriceOracle.sol/PriceOracle.json`);
    if (fs.existsSync(oraclePath)) {
      return require(oraclePath);
    }
  }
  
  const defaultPath = path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
  if (fs.existsSync(defaultPath)) {
    return require(defaultPath);
  }
  
  throw new Error(`Artifact for ${contractName} not found`);
}

/**
 * Deploys token contracts (DAIToken and DLoopToken)
 * @returns {Promise<Object>} Deployed token contracts and signers
 */
async function deployTokenFixture() {
  const [owner, admin, user1, user2] = await ethers.getSigners();
  
  // Deploy DAIToken (D-AI Token)
  const DAIToken = await ethers.getContractFactory("DAIToken");
  const daiToken = await DAIToken.deploy();
  await daiToken.waitForDeployment();
  
  // Deploy DLoopToken
  const DLoopToken = await ethers.getContractFactory("DLoopToken");
  const dloopToken = await DLoopToken.deploy();
  await dloopToken.waitForDeployment();
  
  // Setup roles
  await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
  await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
  
  // Mint initial tokens
  const initialMint = ethers.parseEther("1000000");
  await daiToken.mint(owner.address, initialMint);
  await dloopToken.mint(owner.address, initialMint);
  
  // Transfer some tokens to users for testing
  const userAmount = ethers.parseEther("10000");
  await daiToken.transfer(user1.address, userAmount);
  await daiToken.transfer(user2.address, userAmount);
  await dloopToken.transfer(user1.address, userAmount);
  
  return {
    daiToken,
    dloopToken,
    owner,
    admin,
    user1,
    user2,
    initialMint,
    userAmount
  };
}

/**
 * Deploys fee system contracts (FeeCalculator and FeeProcessor)
 * @returns {Promise<Object>} Deployed fee contracts and signers
 */
async function deployFeeSystemFixture() {
  const [owner, admin, user1, user2] = await ethers.getSigners();
  
  // Deploy FeeCalculator
  const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
  const feeCalculator = await FeeCalculator.deploy();
  await feeCalculator.waitForDeployment();
  
  // Deploy FeeProcessor
  const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
  const feeProcessor = await FeeProcessor.deploy(
    await feeCalculator.getAddress(),
    owner.address // treasury address for testing
  );
  await feeProcessor.waitForDeployment();
  
  return {
    feeCalculator,
    feeProcessor,
    owner,
    admin,
    user1,
    user2
  };
}

/**
 * Deploys oracle contracts (PriceOracle and PriceOracleAdapter)
 * @returns {Promise<Object>} Deployed oracle contracts and signers
 */
async function deployOracleFixture() {
  const [owner, admin, oracle, user1] = await ethers.getSigners();
  
  // Deploy PriceOracle
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  
  // Deploy PriceOracleAdapter
  const PriceOracleAdapter = await ethers.getContractFactory("PriceOracleAdapter");
  const priceOracleAdapter = await PriceOracleAdapter.deploy(
    await priceOracle.getAddress()
  );
  await priceOracleAdapter.waitForDeployment();
  
  // Setup oracle roles
  await priceOracle.grantRole(await priceOracle.ORACLE_ROLE(), oracle.address);
  
  return {
    priceOracle,
    priceOracleAdapter,
    owner,
    admin,
    oracle,
    user1
  };
}

/**
 * Deploys governance contracts (ProtocolDAO, AINodeGovernance, GovernanceRewards)
 * @returns {Promise<Object>} Deployed governance contracts and signers
 */
async function deployGovernanceFixture() {
  const [owner, admin, user1, user2] = await ethers.getSigners();
  
  // Deploy ProtocolDAO
  const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
  const protocolDAO = await ProtocolDAO.deploy(owner.address);
  await protocolDAO.waitForDeployment();
  
  // Deploy AINodeGovernance
  const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
  const aiNodeGovernance = await AINodeGovernance.deploy(
    await protocolDAO.getAddress()
  );
  await aiNodeGovernance.waitForDeployment();
  
  // Deploy GovernanceRewards
  const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
  const governanceRewards = await GovernanceRewards.deploy(
    await protocolDAO.getAddress()
  );
  await governanceRewards.waitForDeployment();
  
  return {
    protocolDAO,
    aiNodeGovernance,
    governanceRewards,
    owner,
    admin,
    user1,
    user2
  };
}

/**
 * Deploys core contracts (AssetDAO, Treasury)
 * @returns {Promise<Object>} Deployed core contracts and signers
 */
async function deployCoreFixture() {
  const tokenFixture = await deployTokenFixture();
  const feeFixture = await deployFeeSystemFixture();
  const oracleFixture = await deployOracleFixture();
  const governanceFixture = await deployGovernanceFixture();
  
  const { daiToken, dloopToken, owner, admin, user1, user2 } = tokenFixture;
  const { feeCalculator, feeProcessor } = feeFixture;
  const { priceOracle } = oracleFixture;
  const { protocolDAO } = governanceFixture;
  
  // Deploy Treasury
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(
    admin.address,
    await protocolDAO.getAddress()
  );
  await treasury.waitForDeployment();
  
  // Deploy AssetDAO
  const AssetDAO = await ethers.getContractFactory("AssetDAO");
  const assetDAO = await AssetDAO.deploy(
    await daiToken.getAddress(),
    await dloopToken.getAddress(),
    await priceOracle.getAddress(),
    await feeProcessor.getAddress(),
    await protocolDAO.getAddress()
  );
  await assetDAO.waitForDeployment();
  
  // Setup roles and permissions
  await assetDAO.grantRole(await assetDAO.ADMIN_ROLE(), admin.address);
  
  // Create a new asset for testing
  await assetDAO.createAsset(
    "Test Asset",
    "https://metadata.dloop.io/asset/1"
  );
  
  return {
    ...tokenFixture,
    ...feeFixture,
    ...oracleFixture,
    ...governanceFixture,
    treasury,
    assetDAO
  };
}

/**
 * Deploys all protocol contracts for comprehensive testing
 * @returns {Promise<Object>} All deployed contracts and signers
 */
async function deployFullProtocolFixture() {
  return await deployCoreFixture();
}

module.exports = {
  loadArtifact,
  deployTokenFixture,
  deployFeeSystemFixture,
  deployOracleFixture,
  deployGovernanceFixture,
  deployCoreFixture,
  deployFullProtocolFixture
};
