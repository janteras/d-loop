/**
 * This script configures Chainlink price feeds for the DLOOP protocol on Sepolia testnet
 * It uses the latest Chainlink Sepolia aggregator addresses
 */
const { ethers } = require("hardhat");

// Chainlink Price Feed Addresses for Sepolia
// From: https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum-sepolia
const CHAINLINK_FEEDS_SEPOLIA = {
  // Crypto / USD feeds
  "ETH/USD": "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  "BTC/USD": "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  "LINK/USD": "0xc59E3633BAAC79493d908e63626716e204A45EdF",
  "DAI/USD": "0x14866185B1962B63C3Ea9E03Bc1da838bab34C19",
  "USDC/USD": "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
  "USDT/USD": "0xA944BD4b2C10FD2B1DF794483f9c110F5b30B94B",
  // Forex rates
  "EUR/USD": "0x1a81afB8146aeFfCFc5E50e8479e826E7D55b8c3",
  "GBP/USD": "0x91FAB41F5f3bE955963a986366edAcff1cc51DAF",
  // Commodities
  "XAU/USD": "0x7b219F57a8e9C7303204Af681e9fA69d17ef626f",  // Gold
};

// DLOOP tokens (addresses to be updated with actual deployed contracts)
const DLOOP_TOKENS = {
  DAI: "0x84CCe9E26C9E75236CbEb25D4e406EBfC1c41440", // Placeholder address
  USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Placeholder address
  D_AI: "0x4E8E459eBc862F9183A1D7BF8e1B452d5bCF3b63", // DLOOP token address
  TREASURY: "0x2e086D2C4fF42f7C31C7C1686c5165b3FCe2c144", // Treasury token address
};

// Initial prices for tokens (used for manual backup prices)
const INITIAL_PRICES = {
  DAI: 100000000,    // $1.00 with 8 decimals
  USDC: 100000000,   // $1.00 with 8 decimals
  D_AI: 500000000,   // $5.00 with 8 decimals
  TREASURY: 5000000000, // $50.00 with 8 decimals
};

async function main() {
  console.log("Configuring Chainlink price feeds for the DLOOP protocol on Sepolia testnet...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  
  try {
    // Get the PriceOracle contract
    const priceOracle = await ethers.getContract("ChainlinkPriceOracle");
    console.log(`ChainlinkPriceOracle address: ${priceOracle.target}`);
    
    // Set up price feeds for tokens
    console.log("Setting up price feeds...");
    
    // DAI
    console.log("Setting up DAI price feed...");
    const daiAggregator = CHAINLINK_FEEDS_SEPOLIA["DAI/USD"];
    await priceOracle.addPriceFeed(
      DLOOP_TOKENS.DAI,
      daiAggregator,
      INITIAL_PRICES.DAI,
      24 // 24 hour heartbeat
    );
    
    // USDC
    console.log("Setting up USDC price feed...");
    const usdcAggregator = CHAINLINK_FEEDS_SEPOLIA["USDC/USD"];
    await priceOracle.addPriceFeed(
      DLOOP_TOKENS.USDC,
      usdcAggregator,
      INITIAL_PRICES.USDC,
      24 // 24 hour heartbeat
    );
    
    // D-AI (using a manual price since there's no Chainlink feed)
    console.log("Setting up D-AI price feed (manual)...");
    await priceOracle.addPriceFeed(
      DLOOP_TOKENS.D_AI,
      ethers.ZeroAddress, // No chainlink aggregator
      INITIAL_PRICES.D_AI,
      24 // 24 hour heartbeat
    );
    
    // Treasury token (using a manual price)
    console.log("Setting up Treasury token price feed (manual)...");
    await priceOracle.addPriceFeed(
      DLOOP_TOKENS.TREASURY,
      ethers.ZeroAddress, // No chainlink aggregator
      INITIAL_PRICES.TREASURY,
      24 // 24 hour heartbeat
    );
    
    console.log("Price feeds configured successfully!");
    
    // Set up the MultiOracleConsensus to use the ChainlinkPriceOracle
    const multiOracle = await ethers.getContract("MultiOracleConsensus");
    if (multiOracle) {
      console.log(`MultiOracleConsensus address: ${multiOracle.target}`);
      console.log("Adding ChainlinkPriceOracle as a source to MultiOracleConsensus...");
      
      // Add ChainlinkPriceOracle with weight 70 (out of 100)
      await multiOracle.addOracleSource(priceOracle.target, 70);
      
      // Configure tokens in MultiOracle
      console.log("Configuring tokens in MultiOracleConsensus...");
      await multiOracle.configureToken(DLOOP_TOKENS.DAI, true, INITIAL_PRICES.DAI);
      await multiOracle.configureToken(DLOOP_TOKENS.USDC, true, INITIAL_PRICES.USDC);
      await multiOracle.configureToken(DLOOP_TOKENS.D_AI, true, INITIAL_PRICES.D_AI);
      await multiOracle.configureToken(DLOOP_TOKENS.TREASURY, true, INITIAL_PRICES.TREASURY);
      
      console.log("MultiOracleConsensus configured successfully!");
    }
    
  } catch (error) {
    console.error("Error configuring price feeds:", error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });