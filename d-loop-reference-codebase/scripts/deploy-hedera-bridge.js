const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Hedera Bridge and related contracts...");

  // Get the signers
  const [deployer, admin, operator, relayer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Admin address: ${admin.address}`);
  console.log(`Operator address: ${operator.address}`);
  console.log(`Relayer address: ${relayer.address}`);

  // Deploy the bridge on Ethereum side
  console.log("\nDeploying HederaBridge...");
  const HederaBridge = await ethers.getContractFactory("HederaBridge");
  const bridge = await HederaBridge.deploy(admin.address, operator.address, relayer.address);
  await bridge.deployed();
  console.log(`HederaBridge deployed to: ${bridge.address}`);

  // Deploy the cross-chain oracle adapter
  console.log("\nDeploying CrossChainOracleAdapter...");
  const CrossChainOracleAdapter = await ethers.getContractFactory("CrossChainOracleAdapter");
  const oracleAdapter = await CrossChainOracleAdapter.deploy(admin.address);
  await oracleAdapter.deployed();
  console.log(`CrossChainOracleAdapter deployed to: ${oracleAdapter.address}`);

  // Grant roles to the operator and relayer
  console.log("\nSetting up roles for CrossChainOracleAdapter...");
  await oracleAdapter.connect(admin).grantPriceFeederRole(operator.address);
  await oracleAdapter.connect(admin).grantCrossChainFeederRole(relayer.address);
  console.log("Roles granted successfully");

  // Deploy mock tokens for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  
  console.log("\nDeploying test tokens...");
  const usdcMock = await MockERC20.deploy("USD Coin Mock", "USDC");
  await usdcMock.deployed();
  console.log(`Mock USDC deployed to: ${usdcMock.address}`);

  const dloopMock = await MockERC20.deploy("DLOOP Token Mock", "DLOOP");
  await dloopMock.deployed();
  console.log(`Mock DLOOP deployed to: ${dloopMock.address}`);

  // Add token mappings to the bridge
  console.log("\nAdding token mappings to bridge...");
  
  // USDC: 100 minimum amount, 0.5% fee
  await bridge.connect(operator).addTokenMapping(
    usdcMock.address,
    "0.0.123456", // Example Hedera token ID
    ethers.utils.parseUnits("100", 6), // 100 USDC minimum (assuming 6 decimals)
    50 // 0.5% fee (50 basis points)
  );
  
  // DLOOP: 1 minimum amount, 0.3% fee
  await bridge.connect(operator).addTokenMapping(
    dloopMock.address,
    "0.0.654321", // Example Hedera token ID
    ethers.utils.parseUnits("1", 18), // 1 DLOOP minimum (assuming 18 decimals)
    30 // 0.3% fee (30 basis points)
  );
  
  console.log("Token mappings added successfully");

  // Add assets to the oracle adapter
  console.log("\nAdding assets to CrossChainOracleAdapter...");
  await oracleAdapter.connect(admin).addAsset(usdcMock.address, "0.0.123456");
  await oracleAdapter.connect(admin).addAsset(dloopMock.address, "0.0.654321");
  console.log("Assets added successfully");

  // Set initial prices
  console.log("\nSetting initial asset prices...");
  await oracleAdapter.connect(operator).updateEthereumPrice(
    usdcMock.address,
    ethers.utils.parseUnits("1", 18) // $1 USD
  );
  
  await oracleAdapter.connect(operator).updateEthereumPrice(
    dloopMock.address,
    ethers.utils.parseUnits("0.25", 18) // $0.25 USD
  );
  
  console.log("Initial prices set successfully");

  // Deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log(`HederaBridge: ${bridge.address}`);
  console.log(`CrossChainOracleAdapter: ${oracleAdapter.address}`);
  console.log(`Mock USDC: ${usdcMock.address}`);
  console.log(`Mock DLOOP: ${dloopMock.address}`);
  console.log("\nDeployment complete!");

  // Additional notes for Hedera deployment
  console.log("\nNOTE: To complete the cross-chain setup, you would need to:");
  console.log("1. Deploy the HederaTokenManager contract on Hedera network");
  console.log("2. Configure the HederaTokenManager with the Ethereum bridge address");
  console.log("3. Set up the relayer service to monitor events on both chains");
  console.log("4. Configure price oracles on both networks");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });