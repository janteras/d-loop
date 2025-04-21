const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { deployContract, verifyContract, initializeContract } = require("./utils/deploymentUtils");
const DEPLOYMENT_CONFIG = require("./config/deploymentConfig");

async function main() {
    console.log("Starting deployment to Sepolia...");
    
    const deployments = {};
    const deploymentInfo = {
        network: "sepolia",
        timestamp: new Date().toISOString(),
        contracts: {}
    };

    try {
        // Deploy all contracts in order
        for (const contractName of DEPLOYMENT_CONFIG.deploymentOrder) {
            const initParams = DEPLOYMENT_CONFIG.initParams[contractName] 
                ? DEPLOYMENT_CONFIG.initParams[contractName](deployments) 
                : [];
            
            const contract = await deployContract(contractName, initParams);
            deployments[contractName] = contract;
            
            // Save deployment info
            deploymentInfo.contracts[contractName] = {
                address: await contract.getAddress(),
                constructorArgs: initParams
            };
        }

        // Post-deployment initialization
        console.log("\nPerforming post-deployment initialization...");

        // Initialize AINodeRegistry with initial parameters
        await initializeContract(
            deployments.AINodeRegistry,
            "initialize",
            [true, // isTestnet
             1000] // minStakeAmount (for testnet)
        );

        // Set up Treasury permissions
        await initializeContract(
            deployments.Treasury,
            "setFeeDistributor",
            [await deployments.FeeDistributor.getAddress()]
        );

        // Configure TokenOptimizer
        await initializeContract(
            deployments.TokenOptimizer,
            "setTokens",
            [[await deployments.DAIToken.getAddress(),
              await deployments.GovernanceToken.getAddress()]]
        );

        // Save deployment information
        const deploymentPath = path.join(__dirname, "../deployments");
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath);
        }
        
        fs.writeFileSync(
            path.join(deploymentPath, `sepolia-deployment-${Date.now()}.json`),
            JSON.stringify(deploymentInfo, null, 2)
        );

        console.log("\nVerifying contracts on Etherscan...");
        for (const [name, info] of Object.entries(deploymentInfo.contracts)) {
            await verifyContract(info.address, info.constructorArgs);
        }

        console.log("\nDeployment completed successfully!");
        console.log("\nDeployed Contracts:");
        Object.entries(deploymentInfo.contracts).forEach(([name, info]) => {
            console.log(`${name}: ${info.address}`);
        });

    } catch (error) {
        console.error("Deployment failed:", error);
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
