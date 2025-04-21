const { ethers } = require("hardhat");

async function deployContract(name, args = []) {
    console.log(`Deploying ${name}...`);
    const Factory = await ethers.getContractFactory(name);
    const contract = await Factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`${name} deployed to: ${address}`);
    return contract;
}

async function verifyContract(address, constructorArgs) {
    console.log(`Verifying contract at ${address}...`);
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: constructorArgs,
        });
        console.log("Verification successful");
    } catch (e) {
        console.log("Verification failed:", e);
    }
}

async function initializeContract(contract, initFunction, args) {
    console.log(`Initializing ${await contract.getAddress()}...`);
    try {
        const tx = await contract[initFunction](...args);
        await tx.wait();
        console.log("Initialization successful");
    } catch (e) {
        console.error("Initialization failed:", e);
        throw e;
    }
}

module.exports = {
    deployContract,
    verifyContract,
    initializeContract
};
