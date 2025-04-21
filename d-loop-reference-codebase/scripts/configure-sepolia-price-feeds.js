// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * @notice Configures price feeds for the ChainlinkPriceOracle on Sepolia testnet
 * This script should be run after deploying the consolidated contracts
 */
async function main() {
  console.log("Configuring Chainlink price feeds for DLOOP on Sepolia testnet...");
  
  // Read deployment information
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("deployment-consolidated-info.json"));
  } catch (error) {
    console.error("Failed to read deployment info. Run deploy-sepolia-consolidated.js first.");
    process.exit(1);
  }
  
  // Get the network information
  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (${network.chainId})`);
  
  // Verify we're on Sepolia
  if (network.chainId !== 11155111) {
    console.error(`Invalid network. Expected Sepolia (11155111), got ${network.name} (${network.chainId})`);
    process.exit(1);
  }
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Configuring with account: ${deployer.address}`);
  
  // Get contract instances
  const priceOracle = await ethers.getContractAt(
    "consolidated-contracts/oracles/ChainlinkPriceOracle", 
    deploymentInfo.contracts.priceOracle
  );
  
  const oracleConsensus = await ethers.getContractAt(
    "consolidated-contracts/oracles/MultiOracleConsensus", 
    deploymentInfo.contracts.oracleConsensus
  );
  
  // Chainlink Price Feed Addresses for Sepolia
  // Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1
  const ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  const BTC_USD_FEED = "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43";
  const LINK_USD_FEED = "0xc59E3633BAAC79493d908e63626716e204A45EdF";
  const DAI_USD_FEED = "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19";
  const USDC_USD_FEED = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";
  
  // Token addresses on Sepolia (these would be the actual token addresses)
  // Note: These are example addresses and would need to be replaced with actual deployed tokens
  const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"; // Example WETH on Sepolia
  const WBTC_ADDRESS = "0xf864F8aea15290CAeA441a0b4cb8628B35864fCF"; // Example WBTC on Sepolia
  const LINK_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // LINK on Sepolia
  const DAI_ADDRESS = "0x68194a729C2450ad26072b3D33ADaCbcef39844d"; // Example DAI on Sepolia
  const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Example USDC on Sepolia
  
  console.log("\nRegistering price feeds in ChainlinkPriceOracle...");
  
  // Register price feeds
  const registerFeed = async (tokenAddress, feedAddress, symbol) => {
    console.log(`Registering ${symbol} price feed...`);
    const tx = await priceOracle.registerPriceFeed(tokenAddress, feedAddress, symbol);
    await tx.wait();
    console.log(`${symbol} price feed registered successfully`);
  };
  
  await registerFeed(WETH_ADDRESS, ETH_USD_FEED, "WETH");
  await registerFeed(WBTC_ADDRESS, BTC_USD_FEED, "WBTC");
  await registerFeed(LINK_ADDRESS, LINK_USD_FEED, "LINK");
  await registerFeed(DAI_ADDRESS, DAI_USD_FEED, "DAI");
  await registerFeed(USDC_ADDRESS, USDC_USD_FEED, "USDC");
  
  console.log("\nConfiguring MultiOracleConsensus parameters...");
  
  // Configure MultiOracleConsensus
  await oracleConsensus.setConsensusParameters(
    1,           // Minimum oracle count
    200,         // Maximum deviation (2%)
    3600         // Freshness period (1 hour)
  );
  console.log("Oracle consensus parameters set successfully");
  
  // Add price feeds to MultiOracleConsensus for each token
  console.log("\nAdding price feeds to MultiOracleConsensus...");
  
  await oracleConsensus.addOracleSource(WETH_ADDRESS, priceOracle.address, 100); // Weight: 100%
  await oracleConsensus.addOracleSource(WBTC_ADDRESS, priceOracle.address, 100);
  await oracleConsensus.addOracleSource(LINK_ADDRESS, priceOracle.address, 100);
  await oracleConsensus.addOracleSource(DAI_ADDRESS, priceOracle.address, 100);
  await oracleConsensus.addOracleSource(USDC_ADDRESS, priceOracle.address, 100);
  
  console.log("Oracle sources added to MultiOracleConsensus successfully");
  
  // Verify that everything is working
  console.log("\nVerifying price feed configuration...");
  
  const verifyPriceFeed = async (token, symbol) => {
    try {
      const price = await oracleConsensus.getPrice(token);
      console.log(`${symbol} price: $${ethers.utils.formatUnits(price, 18)}`);
      return true;
    } catch (error) {
      console.error(`Failed to get price for ${symbol}: ${error.message}`);
      return false;
    }
  };
  
  let success = true;
  success = success && await verifyPriceFeed(WETH_ADDRESS, "WETH");
  success = success && await verifyPriceFeed(WBTC_ADDRESS, "WBTC");
  success = success && await verifyPriceFeed(LINK_ADDRESS, "LINK");
  success = success && await verifyPriceFeed(DAI_ADDRESS, "DAI");
  success = success && await verifyPriceFeed(USDC_ADDRESS, "USDC");
  
  if (success) {
    console.log("\nAll price feeds configured and verified successfully!");
  } else {
    console.error("\nSome price feeds failed verification. Check the logs above for details.");
  }
  
  // Save configuration information
  const configInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString()
    },
    priceOracle: deploymentInfo.contracts.priceOracle,
    oracleConsensus: deploymentInfo.contracts.oracleConsensus,
    priceFeedAddresses: {
      ETH_USD: ETH_USD_FEED,
      BTC_USD: BTC_USD_FEED,
      LINK_USD: LINK_USD_FEED,
      DAI_USD: DAI_USD_FEED,
      USDC_USD: USDC_USD_FEED
    },
    tokens: {
      WETH: WETH_ADDRESS,
      WBTC: WBTC_ADDRESS,
      LINK: LINK_ADDRESS,
      DAI: DAI_ADDRESS,
      USDC: USDC_ADDRESS
    },
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "price-feed-config.json", 
    JSON.stringify(configInfo, null, 2)
  );
  console.log("\nPrice feed configuration saved to price-feed-config.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });