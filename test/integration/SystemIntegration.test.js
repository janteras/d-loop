const { ethers } = require("hardhat");
const { expect } = require("chai");
const IntegrationTestHelper = require("./helpers/IntegrationTestHelper");

describe("System Integration Tests", function() {
    let helper;
    let owner, treasury, node1, node2, user1, user2;
    let contracts;

    before(async function() {
        helper = new IntegrationTestHelper();
        await helper.setupTestEnvironment();
        
        // Get references from helper
        ({ owner, treasury, node1, node2, user1, user2 } = helper.signers);
        contracts = helper.contracts;
    });

    describe("1. Complete Node Registration and Governance Flow", function() {
        it("should allow node registration with identity verification", async function() {
            // Issue SoulboundNFT to node1
            await contracts.soulboundNFT.mint(node1.address);
            
            // Register node
            const stakeAmount = ethers.parseEther("1000");
            await helper.registerNode(node1, stakeAmount);

            // Verify node status
            const nodeInfo = await contracts.aiNodeRegistry.getNodeInfo(node1.address);
            expect(nodeInfo.isActive).to.be.true;
            expect(nodeInfo.stakedAmount).to.equal(stakeAmount);
        });

        it("should process governance proposals end-to-end", async function() {
            // Create and submit proposal
            const tx = await helper.createProposal(node1);
            const receipt = await tx.wait();
            const proposalId = receipt.logs[0].args.proposalId;

            // Cast votes
            await contracts.aiNodeGovernance.connect(node1).castVote(proposalId, true);
            
            // Advance blocks for voting period
            await hre.network.provider.send("hardhat_mine", ["0x100"]);

            // Execute proposal
            await contracts.aiNodeGovernance.executeProposal(proposalId);

            const proposal = await contracts.aiNodeGovernance.getProposal(proposalId);
            expect(proposal.executed).to.be.true;
        });
    });

    describe("2. Token Delegation and Rewards", function() {
        it("should handle token delegation through optimizer", async function() {
            const delegationAmount = ethers.parseEther("500");
            await helper.delegateTokens(user1, node1, delegationAmount);

            const delegation = await contracts.tokenOptimizer.getDelegation(
                await contracts.governanceToken.getAddress(),
                user1.address,
                node1.address
            );
            expect(delegation).to.equal(delegationAmount);
        });

        it("should distribute rewards correctly", async function() {
            // Set mock price for reward calculation
            await contracts.mockPriceOracle.setPrice(
                ethers.parseUnits("1800", 8) // $1800 USD
            );

            // Simulate epoch rewards
            const rewardAmount = ethers.parseEther("100");
            await contracts.daiToken.mint(treasury.address, rewardAmount);
            await contracts.daiToken.connect(treasury).approve(
                await contracts.feeDistributor.getAddress(),
                rewardAmount
            );

            // Distribute rewards
            await contracts.feeDistributor.connect(treasury).distributeRewards(rewardAmount);

            // Check reward distribution
            const nodeReward = await contracts.treasury.getNodeReward(node1.address);
            expect(nodeReward).to.be.gt(0);
        });
    });

    describe("3. Price Oracle Integration", function() {
        it("should update and fetch prices correctly", async function() {
            const newPrice = ethers.parseUnits("2000", 8); // $2000 USD
            await contracts.mockPriceOracle.setPrice(newPrice);

            const fetchedPrice = await contracts.priceOracle.getLatestPrice();
            expect(fetchedPrice).to.equal(newPrice);
        });
    });

    describe("4. System Security and Edge Cases", function() {
        it("should handle node deregistration and fund recovery", async function() {
            // Register a new node
            const stakeAmount = ethers.parseEther("1000");
            await helper.registerNode(node2, stakeAmount);

            // Deregister node
            await contracts.aiNodeRegistry.connect(node2).deregisterNode();

            // Verify node status and stake return
            const nodeInfo = await contracts.aiNodeRegistry.getNodeInfo(node2.address);
            expect(nodeInfo.isActive).to.be.false;

            const finalBalance = await contracts.governanceToken.balanceOf(node2.address);
            expect(finalBalance).to.equal(stakeAmount);
        });

        it("should prevent unauthorized access to critical functions", async function() {
            await expect(
                contracts.treasury.connect(user1).setFeeDistributor(user1.address)
            ).to.be.revertedWith("Unauthorized");

            await expect(
                contracts.aiNodeRegistry.connect(user1).initialize(true, 1000)
            ).to.be.revertedWith("Initialized");
        });
    });

    describe("5. Cross-Contract Integration", function() {
        it("should maintain consistent state across contract interactions", async function() {
            // Register node and delegate tokens
            const stakeAmount = ethers.parseEther("1500");
            const delegationAmount = ethers.parseEther("500");

            await helper.registerNode(node2, stakeAmount);
            await helper.delegateTokens(user2, node2, delegationAmount);

            // Verify states across contracts
            const nodeInfo = await contracts.aiNodeRegistry.getNodeInfo(node2.address);
            const delegation = await contracts.tokenOptimizer.getDelegation(
                await contracts.governanceToken.getAddress(),
                user2.address,
                node2.address
            );
            const hasIdentity = await contracts.soulboundNFT.balanceOf(node2.address);

            expect(nodeInfo.isActive).to.be.true;
            expect(nodeInfo.stakedAmount).to.equal(stakeAmount);
            expect(delegation).to.equal(delegationAmount);
            expect(hasIdentity).to.be.gt(0);
        });
    });
});
