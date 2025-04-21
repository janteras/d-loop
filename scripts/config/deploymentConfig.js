const { ethers } = require("hardhat");

const DEPLOYMENT_CONFIG = {
    // Initial parameters
    initialPrice: ethers.parseUnits("1800", 8), // $1800 with 8 decimals
    priceDecimals: 8,
    quorum: 10, // 10% for testnet
    minProposalDelay: 1, // 1 block delay for testnet
    
    // Contract deployment order and dependencies
    deploymentOrder: [
        "MockPriceOracle",
        "PriceOracle",
        "DAIToken",
        "TokenOptimizer",
        "SoulboundNFT",
        "AINodeRegistry",
        "Treasury",
        "FeeDistributor",
        "GovernanceToken",
        "AINodeGovernance"
    ],

    // Contract initialization parameters
    initParams: {
        MockPriceOracle: (deployments) => [
            DEPLOYMENT_CONFIG.initialPrice,
            DEPLOYMENT_CONFIG.priceDecimals
        ],
        PriceOracle: (deployments) => [
            deployments.MockPriceOracle.address
        ],
        AINodeRegistry: (deployments) => [
            deployments.SoulboundNFT.address,
            deployments.PriceOracle.address
        ],
        Treasury: (deployments) => [
            deployments.DAIToken.address,
            deployments.FeeDistributor.address
        ],
        AINodeGovernance: (deployments) => [
            deployments.GovernanceToken.address,
            DEPLOYMENT_CONFIG.quorum,
            DEPLOYMENT_CONFIG.minProposalDelay
        ]
    }
};

module.exports = DEPLOYMENT_CONFIG;
