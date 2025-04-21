const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Oracle and Governance Rewards integration...");

  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);

  // Deploy DLOOP token if not already deployed
  console.log("Deploying DLOOP token...");
  const DLoopToken = await ethers.getContractFactory("DLoopToken");
  const dloopToken = await DLoopToken.deploy();
  await dloopToken.deployed();
  console.log(`DLOOP token deployed to: ${dloopToken.address}`);

  // Deploy price oracle
  console.log("Deploying PriceOracle...");
  const updateInterval = 3600; // 1 hour in seconds
  const PriceOracle = await ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy(deployer.address, updateInterval);
  await priceOracle.deployed();
  console.log(`PriceOracle deployed to: ${priceOracle.address}`);

  // Deploy GovernanceRewards
  console.log("Deploying GovernanceRewards...");
  const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
  const governanceRewards = await GovernanceRewards.deploy(deployer.address, dloopToken.address);
  await governanceRewards.deployed();
  console.log(`GovernanceRewards deployed to: ${governanceRewards.address}`);

  // Deploy ProposalTracker
  console.log("Deploying ProposalTracker...");
  const ProposalTracker = await ethers.getContractFactory("ProposalTracker");
  // Initially deploy with a placeholder oracle address (will update later)
  const proposalTracker = await ProposalTracker.deploy(governanceRewards.address, ethers.constants.AddressZero);
  await proposalTracker.deployed();
  console.log(`ProposalTracker deployed to: ${proposalTracker.address}`);

  // Deploy OraclePriceEvaluator
  console.log("Deploying OraclePriceEvaluator...");
  const evaluationDelay = 86400 * 7; // 7 days in seconds
  const OraclePriceEvaluator = await ethers.getContractFactory("OraclePriceEvaluator");
  const oraclePriceEvaluator = await OraclePriceEvaluator.deploy(
    deployer.address,
    proposalTracker.address,
    priceOracle.address
  );
  await oraclePriceEvaluator.deployed();
  console.log(`OraclePriceEvaluator deployed to: ${oraclePriceEvaluator.address}`);

  // Set up sample asset for testing
  console.log("Setting up sample assets...");
  
  // For testing, we'd either create a mock token or use an existing one
  console.log("Deploying MockERC20 for testing...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockAsset = await MockERC20.deploy("Mock Asset", "MOCK");
  await mockAsset.deployed();
  console.log(`Mock Asset token deployed to: ${mockAsset.address}`);

  // Add asset to price oracle
  console.log("Adding asset to price oracle...");
  await priceOracle.addAsset(mockAsset.address);
  
  // Grant price feeder role to deployer for testing
  console.log("Granting price feeder role...");
  await priceOracle.grantPriceFeederRole(deployer.address);
  
  // Set initial price for mock asset
  console.log("Setting initial price...");
  const initialPrice = ethers.utils.parseEther("100"); // $100
  await priceOracle.updatePrice(mockAsset.address, initialPrice);

  // Connect the system together
  console.log("Connecting components...");

  // Update ProposalTracker's oracle to OraclePriceEvaluator
  console.log("Setting OraclePriceEvaluator as ProposalTracker's oracle...");
  await proposalTracker.updateOracle(oraclePriceEvaluator.address);
  
  // Grant ProposalTracker role in GovernanceRewards
  console.log("Granting ProposalTracker role in GovernanceRewards...");
  await governanceRewards.grantProposalTrackerRole(proposalTracker.address);
  
  // Grant OraclePriceEvaluator role in GovernanceRewards
  console.log("Granting OraclePriceEvaluator role in GovernanceRewards...");
  await governanceRewards.grantOracleRole(oraclePriceEvaluator.address);

  console.log("\nDeployment complete!");
  console.log("\nDeployed contract addresses:");
  console.log("----------------------------");
  console.log(`DLOOP Token: ${dloopToken.address}`);
  console.log(`PriceOracle: ${priceOracle.address}`);
  console.log(`GovernanceRewards: ${governanceRewards.address}`);
  console.log(`ProposalTracker: ${proposalTracker.address}`);
  console.log(`OraclePriceEvaluator: ${oraclePriceEvaluator.address}`);
  console.log(`Mock Asset: ${mockAsset.address}`);
  console.log("\nSystem is ready for testing!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });