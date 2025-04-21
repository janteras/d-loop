/**
 * @title AssetDAO Governance Rewards Test Fixtures
 * @dev Reusable test fixtures for AssetDAO governance rewards integration tests
 * 
 * This module provides standardized fixtures for testing the full flow from
 * AssetDAO proposal creation to governance rewards distribution
 */

const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

/**
 * Helper function to load contract artifacts
 * @param {string} contractName - Name of the contract
 * @returns {Object} Contract artifact
 */
function loadMockArtifact(contractName) {
  const mockPath = path.join(__dirname, `../../artifacts/test/mocks/${contractName}.sol/${contractName}.json`);
  if (fs.existsSync(mockPath)) {
    return require(mockPath);
  }
  throw new Error(`Mock artifact not found: ${mockPath}`);
}

/**
 * Deploys a complete fixture for AssetDAO governance rewards integration testing
 * @returns {Promise<Object>} Deployed contracts and signers
 */
async function deployAssetDAOGovernanceFixture() {
  const [owner, admin, proposer, voter1, voter2, voter3, aiNode] = await ethers.getSigners();
  
  // Deploy DLoopToken for governance
  const DLoopToken = await ethers.getContractFactory("DLoopToken");
  const dloopToken = await DLoopToken.deploy(
    "D-Loop Token",
    "DLOOP",
    ethers.parseEther("1000000"), // initialSupply
    18, // decimals
    ethers.parseEther("100000000"), // maxSupply
    admin.address
  );
  await dloopToken.waitForDeployment();
  
  // Deploy DAIToken (D-AI) for asset governance
  const DAIToken = await ethers.getContractFactory("DAIToken");
  const daiToken = await DAIToken.deploy();
  await daiToken.waitForDeployment();
  
  // Deploy MockERC20 tokens for assets
  const MockERC20 = await ethers.getContractFactory("MockERC20", {
    signer: owner,
    libraries: {}
  });
  const ethToken = await MockERC20.deploy(
    "Ethereum", 
    "ETH", 
    ethers.parseEther("1000"),
    18
  );
  await ethToken.waitForDeployment();
  
  const linkToken = await MockERC20.deploy(
    "Chainlink", 
    "LINK", 
    ethers.parseEther("5000"),
    18
  );
  await linkToken.waitForDeployment();
  
  const wbtcToken = await MockERC20.deploy(
    "Wrapped Bitcoin", 
    "WBTC", 
    ethers.parseUnits("100", 8),
    8
  );
  await wbtcToken.waitForDeployment();
  
  // Deploy MockPriceOracle
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const mockPriceOracle = await MockPriceOracle.deploy();
  await mockPriceOracle.waitForDeployment();
  
  // Deploy MockFeeProcessor
  const MockFeeProcessor = await ethers.getContractFactory("MockFeeProcessor");
  const mockFeeProcessor = await MockFeeProcessor.deploy();
  await mockFeeProcessor.waitForDeployment();
  
  // Deploy MockProtocolDAO
  const MockProtocolDAO = await ethers.getContractFactory("MockProtocolDAO");
  const mockProtocolDAO = await MockProtocolDAO.deploy();
  await mockProtocolDAO.waitForDeployment();
  
  // Deploy GovernanceRewards
  const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
  const governanceRewards = await GovernanceRewards.deploy(
    await dloopToken.getAddress(), // reward token
    admin.address // admin
  );
  await governanceRewards.waitForDeployment();
  
  // Deploy AssetDAO
  const AssetDAO = await ethers.getContractFactory("AssetDAO");
  const assetDAO = await AssetDAO.deploy(
    await daiToken.getAddress(), // D-AI token
    await dloopToken.getAddress(), // DLOOP token
    await mockPriceOracle.getAddress(), // price oracle
    await mockFeeProcessor.getAddress(), // fee processor
    await mockProtocolDAO.getAddress() // protocol DAO
  );
  await assetDAO.waitForDeployment();
  
  // Setup roles and permissions
  await governanceRewards.connect(admin).grantRole(await governanceRewards.DISTRIBUTOR_ROLE(), admin.address);
  await dloopToken.connect(admin).grantRole(await dloopToken.MINTER_ROLE(), admin.address);
  
  // Mint tokens to users for governance participation
  await dloopToken.connect(admin).mint(proposer.address, ethers.parseEther("10000"));
  await dloopToken.connect(admin).mint(voter1.address, ethers.parseEther("20000"));
  await dloopToken.connect(admin).mint(voter2.address, ethers.parseEther("30000"));
  await dloopToken.connect(admin).mint(voter3.address, ethers.parseEther("15000"));
  await dloopToken.connect(admin).mint(aiNode.address, ethers.parseEther("25000"));
  
  // Mint tokens to governance rewards contract
  await dloopToken.connect(admin).mint(await governanceRewards.getAddress(), ethers.parseEther("1000000"));
  
  // Configure reward parameters
  await governanceRewards.connect(admin).updateRewardConfig(
    ethers.parseEther("100"),  // baseReward
    2000,                      // votingParticipationBonus (20%)
    15000,                     // proposalQualityMultiplier (1.5x)
    12000,                     // aiNodeMultiplier (1.2x)
    ethers.parseEther("500")   // rewardCap
  );
  
  // Set reward cooldown to 1 day
  await governanceRewards.connect(admin).setRewardCooldown(86400); // 24 hours
  
  return { 
    daiToken, dloopToken, governanceRewards, assetDAO,
    ethToken, linkToken, wbtcToken,
    mockPriceOracle, mockFeeProcessor, mockProtocolDAO,
    owner, admin, proposer, voter1, voter2, voter3, aiNode
  };
}

module.exports = {
  deployAssetDAOGovernanceFixture
};
