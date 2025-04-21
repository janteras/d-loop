const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const MockHelper = require("./MockHelper");

/**
 * TestUtils provides utilities for testing smart contracts
 */
class TestUtils {
    /**
     * Deploy a contract with its mocks
     * @param {string} contractName Name of the contract to deploy
     * @param {Object} mockConfig Configuration for required mocks
     * @returns {Object} Deployed contracts
     */
    static async deployWithMocks(contractName, mockConfig = {}) {
        const mocks = {};
        const mockHelper = {};
        
        // Deploy required mocks
        for (const [mockName, config] of Object.entries(mockConfig)) {
            const MockContract = await ethers.getContractFactory(mockName);
            mocks[mockName] = await MockContract.deploy();
            await mocks[mockName].deployed();
            
            // Initialize mock
            mockHelper[mockName] = new MockHelper(mocks[mockName]);
            await mockHelper[mockName].initialize();
            
            // Configure mock if needed
            if (config.setup) {
                await config.setup(mocks[mockName]);
            }
        }
        
        // Deploy main contract
        const Contract = await ethers.getContractFactory(contractName);
        const constructorArgs = mockConfig.constructorArgs || [];
        const contract = await Contract.deploy(...constructorArgs);
        await contract.deployed();
        
        return { contract, mocks, mockHelper };
    }
    
    /**
     * Setup a test scenario
     * @param {Object} scenario Scenario configuration
     * @returns {Object} Scenario context
     */
    static async setupScenario(scenario) {
        const context = {
            signers: await ethers.getSigners(),
            timestamp: await time.latest()
        };
        
        // Deploy contracts
        const { contract, mocks, mockHelper } = await this.deployWithMocks(
            scenario.contract,
            scenario.mocks
        );
        
        context.contract = contract;
        context.mocks = mocks;
        context.mockHelper = mockHelper;
        
        // Setup initial state
        if (scenario.setup) {
            await scenario.setup(context);
        }
        
        return context;
    }
    
    /**
     * Expect a transaction to revert
     * @param {Promise} promise Promise that should revert
     * @param {string} reason Expected revert reason
     */
    static async expectRevert(promise, reason) {
        try {
            await promise;
            throw new Error("Expected transaction to revert");
        } catch (error) {
            if (!error.message.includes(reason)) {
                throw new Error(
                    `Expected revert reason "${reason}" but got "${error.message}"`
                );
            }
        }
    }
    
    /**
     * Increase blockchain time
     * @param {number} seconds Number of seconds to increase
     */
    static async increaseTime(seconds) {
        await time.increase(seconds);
    }
    
    /**
     * Get event arguments from transaction receipt
     * @param {Object} receipt Transaction receipt
     * @param {string} eventName Name of the event
     * @returns {Object} Event arguments
     */
    static getEventArgs(receipt, eventName) {
        const event = receipt.events?.find(e => e.event === eventName);
        if (!event) {
            throw new Error(`Event ${eventName} not found in transaction`);
        }
        return event.args;
    }
    
    /**
     * Setup roles for a contract
     * @param {Contract} contract Contract instance
     * @param {Object} roles Role configuration
     */
    static async setupRoles(contract, roles) {
        for (const [role, addresses] of Object.entries(roles)) {
            const roleHash = await contract[role]();
            for (const address of addresses) {
                await contract.grantRole(roleHash, address);
            }
        }
    }
    
    /**
     * Verify access control
     * @param {Contract} contract Contract instance
     * @param {string} functionName Function to test
     * @param {Array} args Function arguments
     * @param {Object} roles Role configuration
     */
    static async verifyAccessControl(contract, functionName, args, roles) {
        const [owner, unauthorized] = await ethers.getSigners();
        
        // Test unauthorized access
        await this.expectRevert(
            contract.connect(unauthorized)[functionName](...args),
            "AccessControl:"
        );
        
        // Test authorized access
        for (const [role, addresses] of Object.entries(roles)) {
            const roleHash = await contract[role]();
            await contract.grantRole(roleHash, owner.address);
            await contract[functionName](...args);
        }
    }
}

module.exports = TestUtils;
