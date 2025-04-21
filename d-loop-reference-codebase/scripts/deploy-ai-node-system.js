// Script to deploy the AI Node Identification and Governance Rewards system
const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  console.log("Deploying DLOOP AI Node Identification and Governance Rewards System...");

  // Get signers
  const [deployer, governance, treasury] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Governance address: ${governance.address}`);
  console.log(`Treasury address: ${treasury.address}`);

  // Deploy SoulboundNFT
  const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
  const soulboundNFT = await SoulboundNFT.deploy();
  await soulboundNFT.deployed();
  console.log(`SoulboundNFT deployed to: ${soulboundNFT.address}`);

  // Deploy AINodeRegistry
  const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
  const aiNodeRegistry = await AINodeRegistry.deploy(soulboundNFT.address);
  await aiNodeRegistry.deployed();
  console.log(`AINodeRegistry deployed to: ${aiNodeRegistry.address}`);

  // Deploy AINodeGovernance
  const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
  const aiNodeGovernance = await AINodeGovernance.deploy(aiNodeRegistry.address);
  await aiNodeGovernance.deployed();
  console.log(`AINodeGovernance deployed to: ${aiNodeGovernance.address}`);

  // For testing/demo purposes: Deploy MockERC20 as DLOOP token
  // In production, use the actual DLOOP token address
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const dloopToken = await MockERC20.deploy(
    "DLOOP Token", 
    "DLOOP", 
    ethers.utils.parseUnits("100000000", 18)
  );
  await dloopToken.deployed();
  console.log(`MockERC20 (DLOOP) deployed to: ${dloopToken.address}`);

  // For testing/demo purposes: Deploy MockPriceOracle
  // In production, use an actual price oracle
  const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
  const priceOracle = await MockPriceOracle.deploy();
  await priceOracle.deployed();
  console.log(`MockPriceOracle deployed to: ${priceOracle.address}`);

  // Deploy GovernanceRewards
  const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
  const governanceRewards = await GovernanceRewards.deploy(
    dloopToken.address,
    priceOracle.address
  );
  await governanceRewards.deployed();
  console.log(`GovernanceRewards deployed to: ${governanceRewards.address}`);

  // Set up roles and permissions
  console.log("Setting up roles and permissions...");

  // Grant MINTER_ROLE to AINodeRegistry
  const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
  await soulboundNFT.grantRole(MINTER_ROLE, aiNodeRegistry.address);
  console.log(`Granted MINTER_ROLE to AINodeRegistry`);

  // Grant VERIFIER_ROLE to governance
  const VERIFIER_ROLE = await soulboundNFT.VERIFIER_ROLE();
  await soulboundNFT.grantRole(VERIFIER_ROLE, governance.address);
  console.log(`Granted VERIFIER_ROLE to Governance`);

  // Grant GOVERNANCE_ROLE to governance in AINodeRegistry
  const REGISTRY_GOVERNANCE_ROLE = await aiNodeRegistry.GOVERNANCE_ROLE();
  await aiNodeRegistry.grantRole(REGISTRY_GOVERNANCE_ROLE, governance.address);
  console.log(`Granted GOVERNANCE_ROLE to Governance in AINodeRegistry`);

  // Grant ADMIN_ROLE to governance in AINodeGovernance
  const ADMIN_ROLE = await aiNodeGovernance.ADMIN_ROLE();
  await aiNodeGovernance.grantRole(ADMIN_ROLE, governance.address);
  console.log(`Granted ADMIN_ROLE to Governance in AINodeGovernance`);

  // Grant roles for GovernanceRewards
  const REWARDS_GOVERNANCE_ROLE = await governanceRewards.GOVERNANCE_ROLE();
  const DISTRIBUTOR_ROLE = await governanceRewards.DISTRIBUTOR_ROLE();
  
  await governanceRewards.grantRole(REWARDS_GOVERNANCE_ROLE, governance.address);
  console.log(`Granted GOVERNANCE_ROLE to Governance in GovernanceRewards`);
  
  await governanceRewards.grantRole(DISTRIBUTOR_ROLE, treasury.address);
  console.log(`Granted DISTRIBUTOR_ROLE to Treasury in GovernanceRewards`);

  // Transfer DLOOP tokens to GovernanceRewards for distribution
  const rewardsAmount = ethers.utils.parseUnits("20016000", 18); // 20,016,000 DLOOP
  await dloopToken.transfer(governanceRewards.address, rewardsAmount);
  console.log(`Transferred ${ethers.utils.formatUnits(rewardsAmount, 18)} DLOOP to GovernanceRewards`);

  // For demo purposes: Setup test asset prices
  const ETH_ADDRESS = "0x1111111111111111111111111111111111111111";
  const BTC_ADDRESS = "0x2222222222222222222222222222222222222222";
  
  await priceOracle.setAssetPrice(ETH_ADDRESS, ethers.utils.parseUnits("3000", 18));
  await priceOracle.setAssetPrice(BTC_ADDRESS, ethers.utils.parseUnits("60000", 18));
  console.log("Setup test asset prices in MockPriceOracle");

  // For demo purposes: Register an AI node
  const aiNodeAddress = "0x3333333333333333333333333333333333333333";
  await aiNodeRegistry.connect(governance).registerNode(
    aiNodeAddress,
    "GPT-4-FINANCE",
    "VERIFICATION_PROOF_HASH"
  );
  console.log(`Registered example AI node at ${aiNodeAddress}`);

  console.log("Deployment completed successfully!");
  
  // Return all deployed contract addresses for reference
  return {
    soulboundNFT: soulboundNFT.address,
    aiNodeRegistry: aiNodeRegistry.address,
    aiNodeGovernance: aiNodeGovernance.address,
    dloopToken: dloopToken.address,
    priceOracle: priceOracle.address,
    governanceRewards: governanceRewards.address
  };
}

// Execute the deployment
main()
  .then((deployedAddresses) => {
    console.log("Deployed contract addresses:");
    console.log(deployedAddresses);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });