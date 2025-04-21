const { ethers } = require("hardhat");
const { expect } = require("chai");
const PerformanceHelper = require('../../helpers/PerformanceHelper');
const IntegrationTestHelper = require("../../../integration/helpers/IntegrationTestHelper");

describe("Rewards and Oracle Performance Tests", function() {
    let helper, perfHelper;
    let contracts, signers;
    
    before(async function() {
        helper = new IntegrationTestHelper();
        await helper.setupTestEnvironment();
        perfHelper = new PerformanceHelper();
        
        contracts = helper.contracts;
        signers = helper.signers;

        // Setup initial state
        await setupTestState();
    });

    async function setupTestState() {
        // Register nodes
        const stakeAmount = ethers.parseEther("1000");
        await helper.registerNode(signers.node1, stakeAmount);
        await helper.registerNode(signers.node2, stakeAmount);

        // Setup delegations
        const delegationAmount = ethers.parseEther("500");
        await helper.delegateTokens(signers.user1, signers.node1, delegationAmount);
        await helper.delegateTokens(signers.user2, signers.node2, delegationAmount);
    }

    describe("1. Reward Distribution Performance", function() {
        it("should benchmark reward calculation and distribution", async function() {
            const rewardAmount = ethers.parseEther("1000");
            
            // Mint rewards
            await contracts.daiToken.mint(
                signers.treasury.address,
                rewardAmount
            );

            // Approve rewards
            await contracts.daiToken.connect(signers.treasury).approve(
                await contracts.feeDistributor.getAddress(),
                rewardAmount
            );

            // Measure distribution performance
            const distributionGas = await perfHelper.benchmarkFunction(
                "reward_distribution",
                contracts.feeDistributor.connect(signers.treasury),
                "distributeRewards",
                [rewardAmount],
                3
            );

            console.log("\nReward Distribution Gas Usage:");
            console.log(distributionGas);
        });

        it("should measure batch reward claims efficiency", async function() {
            const batchSizes = [1, 5, 10, 20];
            
            const results = await perfHelper.measureBatchThroughput(
                contracts.treasury,
                "batchClaimRewards",
                batchSizes,
                [[signers.node1.address, signers.node2.address]]
            );

            console.log("\nBatch Reward Claims Performance:");
            for (const [size, data] of Object.entries(results)) {
                console.log(`Batch Size ${size}:`);
                console.log(`  Gas Used: ${data.gasUsed}`);
                console.log(`  Gas per Claim: ${data.gasPerItem}`);
                console.log(`  Time (ms): ${data.timeMs}\n`);
            }
        });
    });

    describe("2. Price Oracle Performance", function() {
        it("should measure price update and fetch performance", async function() {
            const newPrice = ethers.parseUnits("2000", 8);

            // Measure price update performance
            const updateGas = await perfHelper.benchmarkFunction(
                "price_update",
                contracts.mockPriceOracle,
                "setPrice",
                [newPrice],
                5
            );

            // Measure price fetch performance
            const fetchGas = await perfHelper.benchmarkFunction(
                "price_fetch",
                contracts.priceOracle,
                "getLatestPrice",
                [],
                10
            );

            console.log("\nPrice Oracle Performance:");
            console.log("Update Gas:", updateGas);
            console.log("Fetch Gas:", fetchGas);
        });

        it("should benchmark price aggregation with multiple sources", async function() {
            // Deploy additional price sources
            const sourceCounts = [1, 3, 5, 10];
            const results = {};

            for (const count of sourceCounts) {
                // Deploy price sources
                const sources = await Promise.all(
                    Array(count).fill(0).map(async () => {
                        const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
                        return MockPriceOracle.deploy(
                            ethers.parseUnits("1800", 8),
                            8
                        );
                    })
                );

                // Add sources to oracle
                for (const source of sources) {
                    await contracts.priceOracle.addPriceSource(
                        await source.getAddress()
                    );
                }

                // Measure aggregation performance
                const gas = await perfHelper.benchmarkFunction(
                    `price_aggregation_${count}_sources`,
                    contracts.priceOracle,
                    "getAggregatedPrice",
                    [],
                    3
                );

                results[count] = gas;
            }

            console.log("\nPrice Aggregation Performance:");
            Object.entries(results).forEach(([count, gas]) => {
                console.log(`\nSources: ${count}`);
                console.log(`Average Gas: ${gas.average}`);
                console.log(`Min Gas: ${gas.minimum}`);
                console.log(`Max Gas: ${gas.maximum}`);
            });
        });
    });

    after(function() {
        perfHelper.printReport();
    });
});
