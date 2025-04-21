const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying Governance Rewards Integration...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get existing contracts
  const protocolDAOAddress = process.env.PROTOCOL_DAO_ADDRESS;
  const rewardDistributorAddress = process.env.REWARD_DISTRIBUTOR_ADDRESS;
  
  if (!protocolDAOAddress || !rewardDistributorAddress) {
    console.error("Missing required environment variables. Set PROTOCOL_DAO_ADDRESS and REWARD_DISTRIBUTOR_ADDRESS");
    process.exit(1);
  }
  
  console.log("Protocol DAO:", protocolDAOAddress);
  console.log("Reward Distributor:", rewardDistributorAddress);
  
  // Constants
  const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;
  
  // Step 1: Deploy GovernanceTracker
  console.log("\nDeploying GovernanceTracker...");
  const GovernanceTracker = await ethers.getContractFactory("GovernanceTracker");
  const governanceTracker = await upgrades.deployProxy(
    GovernanceTracker,
    [MONTH_IN_SECONDS] // Monthly reward periods
  );
  await governanceTracker.deployed();
  console.log("GovernanceTracker deployed to:", governanceTracker.address);
  
  // Step 2: Deploy RewardAllocator
  console.log("\nDeploying RewardAllocator...");
  const RewardAllocator = await ethers.getContractFactory("RewardAllocator");
  const rewardAllocator = await upgrades.deployProxy(
    RewardAllocator,
    [governanceTracker.address, rewardDistributorAddress]
  );
  await rewardAllocator.deployed();
  console.log("RewardAllocator deployed to:", rewardAllocator.address);
  
  // Step 3: Deploy GovernanceOracle
  console.log("\nDeploying GovernanceOracle...");
  const GovernanceOracle = await ethers.getContractFactory("GovernanceOracle");
  const governanceOracle = await GovernanceOracle.deploy(governanceTracker.address);
  await governanceOracle.deployed();
  console.log("GovernanceOracle deployed to:", governanceOracle.address);
  
  // Step 4: Deploy new ProtocolDAOTracker
  console.log("\nDeploying ProtocolDAOTracker...");
  const ProtocolDAOTracker = await ethers.getContractFactory("ProtocolDAOTracker");
  const protocolDAOTracker = await ProtocolDAOTracker.deploy(await ethers.provider.getSigner());
  await protocolDAOTracker.deployed();
  console.log("ProtocolDAOTracker deployed to:", protocolDAOTracker.address);
  
  // Step 5: Configure the contracts
  console.log("\nConfiguring contracts...");
  
  // Grant oracle role to GovernanceOracle
  const ORACLE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORACLE_ROLE"));
  console.log("Granting ORACLE_ROLE to GovernanceOracle...");
  await governanceTracker.grantRole(ORACLE_ROLE, governanceOracle.address);
  
  // Grant allocator role to deployer (for testing)
  const ALLOCATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALLOCATOR_ROLE"));
  console.log("Granting ALLOCATOR_ROLE to deployer...");
  await rewardAllocator.grantRole(ALLOCATOR_ROLE, deployer.address);
  
  // Set GovernanceTracker in ProtocolDAOTracker
  console.log("Setting GovernanceTracker in ProtocolDAOTracker...");
  await protocolDAOTracker.setGovernanceTracker(governanceTracker.address);
  
  // Grant governance role to ProtocolDAOTracker
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  console.log("Granting GOVERNANCE_ROLE to ProtocolDAOTracker...");
  await governanceTracker.grantRole(GOVERNANCE_ROLE, protocolDAOTracker.address);
  
  console.log("\nDeployment completed successfully!");
  console.log("===========================================");
  console.log("GovernanceTracker:", governanceTracker.address);
  console.log("RewardAllocator:", rewardAllocator.address);
  console.log("GovernanceOracle:", governanceOracle.address);
  console.log("ProtocolDAOTracker:", protocolDAOTracker.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });