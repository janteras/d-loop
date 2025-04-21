const { ethers } = require("hardhat");
const { expect } = require("chai");
const MockHelper = require('../helpers/MockHelper');
const fs = require("fs");
const path = require("path");

describe("Mock Contract Validation", function() {
    let mockContracts = {};
    let owner;

    before(async function() {
        [owner] = await ethers.getSigners();
        
        // Deploy MockStandardPriceOracle as reference implementation
        const MockStandardPriceOracle = await ethers.getContractFactory("MockStandardPriceOracle");
        mockContracts.MockStandardPriceOracle = await MockStandardPriceOracle.deploy();
        await mockContracts.MockStandardPriceOracle.deployed();
    });

    describe("Mock Contract Standards", function() {
        it("Should verify MockStandardPriceOracle implementation", async function() {
            await MockHelper.verifyStandardImplementation(mockContracts.MockStandardPriceOracle);
        });

        it("Should track function calls correctly", async function() {
            const helper = new MockHelper(mockContracts.MockStandardPriceOracle);
            
            // Test function tracking
            const token = ethers.Wallet.createRandom().address;
            const price = ethers.utils.parseEther("100");
            
            await helper.trackFunctionCall("updatePrice", [token, price]);
            
            const history = await helper.getFunctionHistory("updatePrice");
            expect(history.callCount).to.equal(1);
            expect(history.lastCaller).to.equal(owner.address);
        });

        it("Should handle mock state management", async function() {
            const helper = new MockHelper(mockContracts.MockStandardPriceOracle);
            
            // Test initialization
            await helper.initialize();
            expect(await mockContracts.MockStandardPriceOracle.initialized()).to.be.true;
            
            // Test reset
            await helper.reset();
            expect(await mockContracts.MockStandardPriceOracle.initialized()).to.be.false;
            expect(await mockContracts.MockStandardPriceOracle.callCount()).to.equal(0);
        });
    });

    describe("Mock Naming Convention", function() {
        it("Should follow standard naming convention", async function() {
            const mocksDir = path.join(__dirname, "../mocks");
            const files = fs.readdirSync(mocksDir);
            
            for (const file of files) {
                if (file.endsWith(".sol")) {
                    // Skip base directory
                    if (file === "base") continue;
                    
                    // Verify naming convention
                    expect(
                        file.startsWith("Mock") || file.startsWith("Standard"),
                        `Mock file ${file} should start with 'Mock' or 'Standard'`
                    ).to.be.true;
                    
                    // Verify file extension
                    expect(
                        file.endsWith(".sol"),
                        `Mock file ${file} should have .sol extension`
                    ).to.be.true;
                }
            }
        });
    });

    describe("Mock Implementation Verification", function() {
        it("Should verify all mock implementations", async function() {
            const mocksDir = path.join(__dirname, "../mocks");
            const files = fs.readdirSync(mocksDir);
            
            for (const file of files) {
                if (file.endsWith(".sol") && !file.startsWith("Base")) {
                    const contractName = file.replace(".sol", "");
                    
                    // Deploy and verify each mock
                    const Contract = await ethers.getContractFactory(contractName);
                    const contract = await Contract.deploy();
                    await contract.deployed();
                    
                    try {
                        await MockHelper.verifyStandardImplementation(contract);
                        console.log(`✅ Verified ${contractName}`);
                    } catch (error) {
                        console.error(`❌ Failed to verify ${contractName}: ${error.message}`);
                        throw error;
                    }
                }
            }
        });
    });

    describe("Mock Function Coverage", function() {
        it("Should have complete function coverage", async function() {
            // Get all mock contracts
            for (const [name, contract] of Object.entries(mockContracts)) {
                const functions = Object.keys(contract.interface.functions);
                
                // Verify required base functions
                const requiredFunctions = [
                    "initialize",
                    "reset",
                    "getFunctionCallHistory",
                    "wasFunctionCalled",
                    "getFunctionCallCount"
                ];
                
                for (const reqFn of requiredFunctions) {
                    expect(
                        functions.some(fn => fn.startsWith(reqFn)),
                        `${name} missing required function: ${reqFn}`
                    ).to.be.true;
                }
            }
        });
    });
});
