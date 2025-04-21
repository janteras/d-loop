const { ethers } = require("hardhat");
const { expect } = require("chai");

class IntegrationTestHelper {
    constructor() {
        this.contracts = {};
        this.signers = {};
    }

    async setupTestEnvironment() {
        // Get signers
        [
            this.signers.owner,
            this.signers.treasury,
            this.signers.node1,
            this.signers.node2,
            this.signers.user1,
            this.signers.user2
        ] = await ethers.getSigners();

        // Deploy core contracts
        await this.deployContracts();
        
        // Initialize contracts
        await this.initializeContracts();
    }

    async deployContracts() {
        // Deploy mock price oracle
        const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
        this.contracts.mockPriceOracle = await MockPriceOracle.deploy(
            ethers.parseUnits("1800", 8),
            8
        );

        // Deploy price oracle
        const PriceOracle = await ethers.getContractFactory("PriceOracle");
        this.contracts.priceOracle = await PriceOracle.deploy(
            await this.contracts.mockPriceOracle.getAddress()
        );

        // Deploy tokens
        const DAIToken = await ethers.getContractFactory("DAIToken");
        this.contracts.daiToken = await DAIToken.deploy();

        const MockGovernanceToken = await ethers.getContractFactory("MockGovernanceToken");
        this.contracts.governanceToken = await MockGovernanceToken.deploy("Governance Token", "GOV", 18);

        // Deploy SoulboundNFT
        const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
        this.contracts.soulboundNFT = await SoulboundNFT.deploy();

        // Deploy AINodeRegistry
        const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
        this.contracts.aiNodeRegistry = await AINodeRegistry.deploy(
            await this.contracts.soulboundNFT.getAddress(),
            await this.contracts.priceOracle.getAddress()
        );

        // Deploy other contracts
        const TokenOptimizer = await ethers.getContractFactory("TokenOptimizer");
        this.contracts.tokenOptimizer = await TokenOptimizer.deploy();

        const Treasury = await ethers.getContractFactory("Treasury");
        this.contracts.treasury = await Treasury.deploy(
            await this.contracts.daiToken.getAddress()
        );

        const FeeDistributor = await ethers.getContractFactory("FeeDistributor");
        this.contracts.feeDistributor = await FeeDistributor.deploy();

        const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
        this.contracts.aiNodeGovernance = await AINodeGovernance.deploy(
            await this.contracts.governanceToken.getAddress(),
            10, // 10% quorum for testing
            1   // 1 block delay for testing
        );
    }

    async initializeContracts() {
        // Initialize AINodeRegistry
        await this.contracts.aiNodeRegistry.initialize(
            true, // isTestnet
            1000  // minStakeAmount
        );

        // Set up Treasury permissions
        await this.contracts.treasury.setFeeDistributor(
            await this.contracts.feeDistributor.getAddress()
        );

        // Configure TokenOptimizer
        await this.contracts.tokenOptimizer.setTokens([
            await this.contracts.daiToken.getAddress(),
            await this.contracts.governanceToken.getAddress()
        ]);
    }

    // Helper functions for common test operations
    async registerNode(signer, stake = ethers.parseEther("1000")) {
        // Mint and approve tokens
        await this.contracts.governanceToken.mint(signer.address, stake);
        await this.contracts.governanceToken.connect(signer).approve(
            await this.contracts.aiNodeRegistry.getAddress(),
            stake
        );

        // Register node
        return this.contracts.aiNodeRegistry.connect(signer).registerNode(stake);
    }

    async createProposal(signer, description = "Test Proposal") {
        const proposalData = ethers.randomBytes(32);
        return this.contracts.aiNodeGovernance.connect(signer).submitProposal(
            description,
            proposalData
        );
    }

    async delegateTokens(from, to, amount) {
        await this.contracts.governanceToken.mint(from.address, amount);
        await this.contracts.governanceToken.connect(from).approve(
            await this.contracts.tokenOptimizer.getAddress(),
            amount
        );
        return this.contracts.tokenOptimizer.connect(from).delegateTokens(
            await this.contracts.governanceToken.getAddress(),
            to.address,
            amount
        );
    }
}

module.exports = IntegrationTestHelper;
