const { ethers } = require("hardhat");
const { expect } = require("chai");

/**
 * MockHelper provides utilities for working with standardized mock contracts
 */
class MockHelper {
    /**
     * Initialize a new mock helper
     * @param {Contract} mockContract The mock contract instance
     */
    constructor(mockContract) {
        this.mock = mockContract;
    }

    /**
     * Verify that a mock contract follows the standard implementation
     * @param {Contract} mockContract The mock contract to verify
     */
    static async verifyStandardImplementation(mockContract) {
        // Check required functions from BaseMock
        expect(await mockContract.initialized()).to.not.be.undefined;
        expect(await mockContract.lastCaller()).to.not.be.undefined;
        expect(await mockContract.callCount()).to.not.be.undefined;
        
        // Verify function call tracking
        const testFn = Object.keys(mockContract.interface.functions)[0];
        expect(await mockContract.getFunctionCallCount(testFn)).to.not.be.undefined;
        expect(await mockContract.wasFunctionCalled(testFn)).to.not.be.undefined;
        
        // Verify access control
        const adminRole = await mockContract.DEFAULT_ADMIN_ROLE();
        expect(await mockContract.hasRole(adminRole, await mockContract.signer.getAddress())).to.be.true;
    }

    /**
     * Track function calls on a mock contract
     * @param {string} functionName The name of the function to track
     * @param {Array} args The arguments passed to the function
     */
    async trackFunctionCall(functionName, args) {
        const callCount = await this.mock.getFunctionCallCount(functionName);
        const tx = await this.mock[functionName](...args);
        await tx.wait();
        
        const newCallCount = await this.mock.getFunctionCallCount(functionName);
        expect(newCallCount).to.equal(callCount.add(1));
        
        const wasCalled = await this.mock.wasFunctionCalled(functionName);
        expect(wasCalled).to.be.true;
        
        const history = await this.mock.getFunctionCallHistory(functionName);
        expect(history.lastCaller).to.equal(await this.mock.signer.getAddress());
    }

    /**
     * Reset a mock contract's state
     */
    async reset() {
        const tx = await this.mock.reset();
        await tx.wait();
        
        expect(await this.mock.initialized()).to.be.false;
        expect(await this.mock.callCount()).to.equal(0);
    }

    /**
     * Initialize a mock contract
     */
    async initialize() {
        const tx = await this.mock.initialize();
        await tx.wait();
        expect(await this.mock.initialized()).to.be.true;
    }

    /**
     * Get the call history for a function
     * @param {string} functionName The name of the function
     * @returns {Object} The call history
     */
    async getFunctionHistory(functionName) {
        const history = await this.mock.getFunctionCallHistory(functionName);
        return {
            callCount: history.count,
            lastCaller: history.lastCaller_,
            lastCallData: history.lastData
        };
    }
}

module.exports = MockHelper;
