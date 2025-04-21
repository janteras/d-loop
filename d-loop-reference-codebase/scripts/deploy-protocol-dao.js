const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying Protocol DAO with AI Nodes Integration...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Get existing AINodeIdentifier
  const aiNodeIdentifierAddress = process.env.AI_NODE_IDENTIFIER_ADDRESS;
  
  if (!aiNodeIdentifierAddress) {
    console.error("Missing AI_NODE_IDENTIFIER_ADDRESS environment variable.");
    process.exit(1);
  }
  
  console.log("AI Node Identifier:", aiNodeIdentifierAddress);
  
  // Step 1: Deploy ProtocolDAO
  console.log("\nDeploying ProtocolDAOWithAI...");
  const ProtocolDAOWithAI = await ethers.getContractFactory("ProtocolDAOWithAI");
  const protocolDAO = await upgrades.deployProxy(
    ProtocolDAOWithAI,
    [aiNodeIdentifierAddress],
    { initializer: "initialize" }
  );
  await protocolDAO.deployed();
  console.log("ProtocolDAOWithAI deployed to:", protocolDAO.address);
  
  // Step 2: Deploy example executors for demonstration
  console.log("\nDeploying example UpgradeExecutor...");
  const UpgradeExecutor = await ethers.getContractFactory("UpgradeExecutor");
  const exampleUpgradeExecutor = await UpgradeExecutor.deploy(
    protocolDAO.address, // Just an example - would be a real proxy in production
    protocolDAO.address, // Just an example - would be a real implementation in production
    "0x", // No initialization data for this example
    "Example upgrade executor for demonstration"
  );
  await exampleUpgradeExecutor.deployed();
  console.log("Example UpgradeExecutor deployed to:", exampleUpgradeExecutor.address);
  
  console.log("\nDeploying example ParameterAdjuster...");
  const ParameterAdjuster = await ethers.getContractFactory("ParameterAdjuster");
  const exampleParameterAdjuster = await ParameterAdjuster.deploy(
    protocolDAO.address,
    ethers.utils.defaultAbiCoder.encode(
      ["uint64", "uint64"], 
      [1 * 24 * 60 * 60, 7 * 24 * 60 * 60] // 1 day and 7 days
    ),
    "Voting Periods",
    "AI: 1 day, Human: 7 days",
    "Update voting periods to standard values"
  );
  await exampleParameterAdjuster.deployed();
  console.log("Example ParameterAdjuster deployed to:", exampleParameterAdjuster.address);
  
  console.log("\nDeploying example EmergencyPauser...");
  const EmergencyPauser = await ethers.getContractFactory("EmergencyPauser");
  const exampleEmergencyPauser = await EmergencyPauser.deploy(
    protocolDAO.address,
    true, // Pause
    "Market volatility protection"
  );
  await exampleEmergencyPauser.deployed();
  console.log("Example EmergencyPauser deployed to:", exampleEmergencyPauser.address);
  
  // Step 3: Configure the ProtocolDAO
  console.log("\nConfiguring ProtocolDAO...");
  
  // Whitelist the executors
  console.log("Whitelisting executors...");
  await protocolDAO.updateExecutor(exampleUpgradeExecutor.address, true);
  await protocolDAO.updateExecutor(exampleParameterAdjuster.address, true);
  await protocolDAO.updateExecutor(exampleEmergencyPauser.address, true);
  
  // Set up voting power for testing
  console.log("Setting up voting power for deployer...");
  await protocolDAO.updateVotingPower(deployer.address, ethers.utils.parseEther("100"));
  
  console.log("\nDeployment completed successfully!");
  console.log("===========================================");
  console.log("ProtocolDAOWithAI:", protocolDAO.address);
  console.log("Example UpgradeExecutor:", exampleUpgradeExecutor.address);
  console.log("Example ParameterAdjuster:", exampleParameterAdjuster.address);
  console.log("Example EmergencyPauser:", exampleEmergencyPauser.address);
  console.log("===========================================");
  console.log("Next steps:");
  console.log("1. Deploy additional executors as needed");
  console.log("2. Update voting power for DAO participants");
  console.log("3. Create the first governance proposal");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });