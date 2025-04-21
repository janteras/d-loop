const { ethers } = require("hardhat");
const { expect } = require("chai");
const PerformanceHelper = require("../../performance/helpers/PerformanceHelper");
const IntegrationTestHelper = require("../../../integration/helpers/IntegrationTestHelper");

describe("Token Operations Performance Tests", function() {
    let helper, perfHelper;
    let contracts, signers;
    
    before(async function() {
        helper = new IntegrationTestHelper();
        await helper.setupTestEnvironment();
        perfHelper = new PerformanceHelper();
        
        contracts = helper.contracts;
        signers = helper.signers;
    });

    describe("1. Token Approval Optimization", function() {
        it("should compare gas costs between standard and optimized approval", async function() {
            const amount = ethers.parseEther("1000");
            const spender = signers.node1.address;

            const implementations = {
                standard: {
                    contract: contracts.governanceToken.connect(signers.user1),
                    method: "approve",
                    args: [spender, amount]
                },
                optimized: {
                    contract: contracts.tokenOptimizer.connect(signers.user1),
                    method: "optimizedApprove",
                    args: [await contracts.governanceToken.getAddress(), spender, amount]
                }
            };

            const results = await perfHelper.compareImplementations(
                "token_approval",
                implementations
            );

            // Verify optimization
            expect(results.optimized.average).to.be.lt(results.standard.average);
        });
    });

    describe("2. Batch Operations Performance", function() {
        it("should measure batch delegation throughput", async function() {
            const batchSizes = [1, 5, 10, 20];
            const amount = ethers.parseEther("100");

            const results = await perfHelper.measureBatchThroughput(
                contracts.tokenOptimizer.connect(signers.user1),
                "batchDelegate",
                batchSizes,
                [await contracts.governanceToken.getAddress(), amount]
            );

            console.log("\nBatch Delegation Performance:");
            for (const [size, data] of Object.entries(results)) {
                console.log(`Batch Size ${size}:`);
                console.log(`  Gas Used: ${data.gasUsed}`);
                console.log(`  Gas per Item: ${data.gasPerItem}`);
                console.log(`  Time (ms): ${data.timeMs}\n`);
            }
        });
    });

    describe("3. Node Registration Performance", function() {
        it("should benchmark node registration process", async function() {
            const stakeAmount = ethers.parseEther("1000");
            
            // Prepare tokens
            await contracts.governanceToken.mint(
                signers.node2.address,
                stakeAmount
            );

            const gas = await perfHelper.benchmarkFunction(
                "node_registration",
                contracts.aiNodeRegistry.connect(signers.node2),
                "registerNode",
                [stakeAmount],
                3 // Run 3 iterations
            );

            console.log("\nNode Registration Gas Usage:");
            console.log(`Average: ${gas.average}`);
            console.log(`Min: ${gas.minimum}`);
            console.log(`Max: ${gas.maximum}`);
        });
    });

    describe("4. Governance Operations", function() {
        it("should measure proposal creation and voting gas costs", async function() {
            // Create proposal
            const proposalGas = await perfHelper.benchmarkFunction(
                "create_proposal",
                contracts.aiNodeGovernance.connect(signers.node1),
                "submitProposal",
                ["Test Proposal", ethers.randomBytes(32)],
                3
            );

            // Vote on proposal
            const voteTx = await contracts.aiNodeGovernance.connect(signers.node1).submitProposal(
                "Test Proposal",
                ethers.randomBytes(32)
            );
            const receipt = await voteTx.wait();
            const proposalId = receipt.logs[0].args.proposalId;

            const voteGas = await perfHelper.benchmarkFunction(
                "cast_vote",
                contracts.aiNodeGovernance.connect(signers.node1),
                "castVote",
                [proposalId, true],
                3
            );

            console.log("\nGovernance Operation Costs:");
            console.log("Proposal Creation:", proposalGas);
            console.log("Vote Casting:", voteGas);
        });
    });

    after(function() {
        perfHelper.printReport();
    });
});
