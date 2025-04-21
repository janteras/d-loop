const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("AssetDAO System", function () {
  let owner;
  let user1, user2, user3;
  let treasury;
  let mockERC20;
  let mockPriceOracle;
  let daiToken;
  let feeCalculator;
  let assetDAO;
  let ragequitHandler;
  let protocolDAO;
  let daoIntegrator;

  // Constants for testing
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const PROTOCOL_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROTOCOL_DAO_ROLE"));
  const EXECUTOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EXECUTOR_ROLE"));
  const GOVERNANCE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("GOVERNANCE_ROLE"));
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const ASSET_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ASSET_DAO_ROLE"));

  // Initial parameters
  const INITIAL_QUORUM = 3000; // 30%
  const INITIAL_VOTING_PERIOD = 86400; // 1 day in seconds
  const INITIAL_EXECUTION_DELAY = 43200; // 12 hours in seconds
  const INITIAL_MINTING_CAP = ethers.utils.parseEther("10000000"); // 10 million DAI tokens
  const INVEST_FEE = ethers.utils.parseEther("0.1"); // 10%
  const DIVEST_FEE = ethers.utils.parseEther("0.05"); // 5%
  const RAGEQUIT_FEE = ethers.utils.parseEther("0.2"); // 20%
  const COOLDOWN_PERIOD = 604800; // 7 days in seconds
  const MAX_RAGEQUIT_AMOUNT = 1000; // 10% of total supply per day

  beforeEach(async function () {
    // Get signers
    [owner, user1, user2, user3, treasury] = await ethers.getSigners();

    // Deploy mock token for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Mock Token", "MOCK", 18);
    await mockERC20.deployed();

    // Deploy mock price oracle
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    await mockPriceOracle.deployed();

    // Add asset to oracle
    await mockPriceOracle.addAsset(mockERC20.address, ethers.utils.parseEther("100")); // Initial price $100

    // Deploy DAI token (upgradeable)
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await upgrades.deployProxy(DAIToken, [
      owner.address,
      owner.address, // Temporary - will be updated after AssetDAO deployment
      treasury.address,
      INITIAL_MINTING_CAP
    ]);
    await daiToken.deployed();

    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      owner.address,
      treasury.address,
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    await feeCalculator.deployed();

    // Deploy ProtocolDAO (simplified for testing)
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(owner.address);
    await protocolDAO.deployed();

    // Deploy AssetDAO (upgradeable)
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await upgrades.deployProxy(AssetDAO, [
      owner.address,
      protocolDAO.address,
      daiToken.address,
      feeCalculator.address,
      mockPriceOracle.address,
      treasury.address,
      INITIAL_QUORUM,
      INITIAL_VOTING_PERIOD,
      INITIAL_EXECUTION_DELAY
    ]);
    await assetDAO.deployed();

    // Update DAI token's AssetDAO role
    await daiToken.grantRole(ASSET_DAO_ROLE, assetDAO.address);
    await daiToken.grantRole(MINTER_ROLE, assetDAO.address);

    // Deploy RagequitHandler (upgradeable)
    const RagequitHandler = await ethers.getContractFactory("RagequitHandler");
    ragequitHandler = await upgrades.deployProxy(RagequitHandler, [
      owner.address,
      assetDAO.address,
      daiToken.address,
      feeCalculator.address,
      mockPriceOracle.address,
      COOLDOWN_PERIOD,
      MAX_RAGEQUIT_AMOUNT
    ]);
    await ragequitHandler.deployed();

    // Deploy DAOIntegrator (upgradeable)
    const DAOIntegrator = await ethers.getContractFactory("DAOIntegrator");
    daoIntegrator = await upgrades.deployProxy(DAOIntegrator, [
      owner.address,
      protocolDAO.address,
      assetDAO.address
    ]);
    await daoIntegrator.deployed();

    // Mint test tokens to users
    await mockERC20.mint(user1.address, ethers.utils.parseEther("1000"));
    await mockERC20.mint(user2.address, ethers.utils.parseEther("1000"));
    await mockERC20.mint(user3.address, ethers.utils.parseEther("1000"));

    // Approve tokens for AssetDAO
    await mockERC20.connect(user1).approve(assetDAO.address, ethers.utils.parseEther("1000"));
    await mockERC20.connect(user2).approve(assetDAO.address, ethers.utils.parseEther("1000"));
    await mockERC20.connect(user3).approve(assetDAO.address, ethers.utils.parseEther("1000"));
  });

  describe("Initialization", function () {
    it("Should correctly initialize the AssetDAO", async function () {
      expect(await assetDAO.quorum()).to.equal(INITIAL_QUORUM);
      expect(await assetDAO.votingPeriod()).to.equal(INITIAL_VOTING_PERIOD);
      expect(await assetDAO.executionDelay()).to.equal(INITIAL_EXECUTION_DELAY);
      expect(await assetDAO.treasury()).to.equal(treasury.address);
      expect(await assetDAO.daiToken()).to.equal(daiToken.address);
      expect(await assetDAO.feeCalculator()).to.equal(feeCalculator.address);
      expect(await assetDAO.priceOracle()).to.equal(mockPriceOracle.address);
      expect(await assetDAO.proposalCount()).to.equal(0);
      expect(await assetDAO.activeProposalCount()).to.equal(0);
    });

    it("Should correctly initialize the DAI token", async function () {
      expect(await daiToken.name()).to.equal("D-AI Token");
      expect(await daiToken.symbol()).to.equal("D-AI");
      expect(await daiToken.treasury()).to.equal(treasury.address);
      expect(await daiToken.mintingCap()).to.equal(INITIAL_MINTING_CAP);
      expect(await daiToken.totalSupply()).to.equal(0);
    });

    it("Should have the correct roles assigned", async function () {
      // AssetDAO roles
      expect(await assetDAO.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await assetDAO.hasRole(PROTOCOL_DAO_ROLE, protocolDAO.address)).to.be.true;
      expect(await assetDAO.hasRole(EXECUTOR_ROLE, owner.address)).to.be.true;
      expect(await assetDAO.hasRole(GOVERNANCE_ROLE, owner.address)).to.be.true;

      // DAI token roles
      expect(await daiToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await daiToken.hasRole(ASSET_DAO_ROLE, assetDAO.address)).to.be.true;
      expect(await daiToken.hasRole(MINTER_ROLE, assetDAO.address)).to.be.true;
    });
  });

  describe("Proposal Creation", function () {
    it("Should create an AddAsset proposal", async function () {
      await expect(assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      )).to.emit(assetDAO, "ProposalCreated").withArgs(0, user1.address, 1, mockERC20.address);

      const proposal = await assetDAO.getProposal(0);
      expect(proposal.proposalType).to.equal(1);
      expect(proposal.asset).to.equal(mockERC20.address);
      expect(proposal.status).to.equal(1); // Active
      expect(proposal.description).to.equal("Add MOCK token");
    });

    it("Should not allow adding an asset already supported", async function () {
      // First add the asset
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      );
      
      // Fast forward time to end voting period
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");
      
      // Vote on proposal
      await assetDAO.connect(user1).vote(0, true, 1);
      
      // Execute proposal
      await assetDAO.connect(owner).executeProposal(0);
      
      // Try to add the same asset again
      await expect(assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token again"
      )).to.be.revertedWith("AssetDAO: asset already supported");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      // Create a proposal
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      );
    });

    it("Should allow voting on an active proposal", async function () {
      await expect(assetDAO.connect(user2).vote(0, true, 1))
        .to.emit(assetDAO, "ProposalVoted")
        .withArgs(0, user2.address, true, 1);

      const proposal = await assetDAO.getProposal(0);
      expect(proposal.votesFor).to.equal(1);
      expect(proposal.votesAgainst).to.equal(0);
    });

    it("Should not allow voting twice on the same proposal", async function () {
      await assetDAO.connect(user2).vote(0, true, 1);
      await expect(assetDAO.connect(user2).vote(0, false, 1))
        .to.be.revertedWith("AssetDAO: already voted");
    });

    it("Should not allow voting after the voting period has ended", async function () {
      // Fast forward time to end voting period
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");

      await expect(assetDAO.connect(user2).vote(0, true, 1))
        .to.be.revertedWith("AssetDAO: voting period ended");
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      // Create a proposal
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      );

      // Vote on proposal to meet quorum
      await assetDAO.connect(user1).vote(0, true, INITIAL_QUORUM);
    });

    it("Should execute a passed proposal after execution delay", async function () {
      // Fast forward time to end voting period + execution delay
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      await expect(assetDAO.connect(owner).executeProposal(0))
        .to.emit(assetDAO, "ProposalExecuted")
        .withArgs(0, owner.address);

      const proposal = await assetDAO.getProposal(0);
      expect(proposal.executed).to.be.true;
      expect(proposal.status).to.equal(2); // Executed

      // Check that the asset was added
      const asset = await assetDAO.supportedAssets(mockERC20.address);
      expect(asset.supported).to.be.true;
    });

    it("Should not execute a proposal during execution delay", async function () {
      // Fast forward time to end voting period but not execution delay
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");

      await expect(assetDAO.connect(owner).executeProposal(0))
        .to.be.revertedWith("AssetDAO: execution delay not passed");
    });

    it("Should not execute a proposal that didn't pass", async function () {
      // Create another proposal
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token 2"
      );

      // Vote against the proposal with higher count
      await assetDAO.connect(user1).vote(1, false, INITIAL_QUORUM + 1);

      // Fast forward time to end voting period + execution delay
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      await expect(assetDAO.connect(owner).executeProposal(1))
        .to.be.revertedWith("AssetDAO: proposal did not pass");
    });
  });

  describe("Invest/Divest Operations", function () {
    beforeEach(async function () {
      // Add the mock token as a supported asset
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(0, true, INITIAL_QUORUM);

      // Fast forward time to end voting period + execution delay
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      // Execute proposal
      await assetDAO.connect(owner).executeProposal(0);
    });

    it("Should create and execute an Invest proposal", async function () {
      const investAmount = ethers.utils.parseEther("100");
      const currentPrice = ethers.utils.parseEther("100");
      const minPrice = currentPrice.mul(95).div(100); // 95% of current price
      const maxPrice = currentPrice.mul(105).div(100); // 105% of current price

      // Create invest proposal
      await assetDAO.connect(user1).createProposal(
        3, // Invest
        mockERC20.address,
        investAmount,
        minPrice,
        maxPrice,
        "Invest in MOCK"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(1, true, INITIAL_QUORUM);

      // Fast forward time to end voting period + execution delay
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      // Execute invest proposal
      await expect(assetDAO.connect(owner).executeProposal(1))
        .to.emit(assetDAO, "ProposalExecuted")
        .withArgs(1, owner.address);

      // Check that the asset balance was updated
      const asset = await assetDAO.supportedAssets(mockERC20.address);
      expect(asset.balance).to.equal(investAmount.mul(90).div(100)); // 90% after 10% fee

      // Check that the user received DAI tokens
      const daiBalance = await daiToken.balanceOf(user1.address);
      expect(daiBalance).to.be.gt(0);
    });

    it("Should create and execute a Divest proposal", async function () {
      // First invest
      const investAmount = ethers.utils.parseEther("100");
      const currentPrice = ethers.utils.parseEther("100");
      const minPrice = currentPrice.mul(95).div(100);
      const maxPrice = currentPrice.mul(105).div(100);

      // Create invest proposal
      await assetDAO.connect(user1).createProposal(
        3, // Invest
        mockERC20.address,
        investAmount,
        minPrice,
        maxPrice,
        "Invest in MOCK"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(1, true, INITIAL_QUORUM);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      // Execute invest proposal
      await assetDAO.connect(owner).executeProposal(1);

      // Get user's DAI balance
      const initialDaiBalance = await daiToken.balanceOf(user1.address);

      // Now divest half
      const divestAmount = investAmount.mul(90).div(100).div(2); // Half of the invested amount after fees

      // Create divest proposal
      await assetDAO.connect(user1).createProposal(
        4, // Divest
        mockERC20.address,
        divestAmount,
        minPrice,
        maxPrice,
        "Divest from MOCK"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(2, true, INITIAL_QUORUM);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");

      // Execute divest proposal
      await expect(assetDAO.connect(owner).executeProposal(2))
        .to.emit(assetDAO, "ProposalExecuted")
        .withArgs(2, owner.address);

      // Check that the asset balance was updated
      const asset = await assetDAO.supportedAssets(mockERC20.address);
      expect(asset.balance).to.equal(investAmount.mul(90).div(100).sub(divestAmount));

      // Check that the user's DAI balance decreased
      const finalDaiBalance = await daiToken.balanceOf(user1.address);
      expect(finalDaiBalance).to.be.lt(initialDaiBalance);
    });
  });

  describe("DAO Integrator", function () {
    it("Should execute an action from Protocol DAO to Asset DAO", async function () {
      // Define new parameters
      const newQuorum = 4000; // 40%
      const newVotingPeriod = 172800; // 2 days
      const newExecutionDelay = 86400; // 1 day

      // Encode parameters
      const actionData = ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [newQuorum, newVotingPeriod, newExecutionDelay]
      );

      // Execute action
      await expect(daoIntegrator.connect(owner).executeAction(1, actionData)) // 1 = UpdateParameters
        .to.emit(daoIntegrator, "ActionExecuted");

      // Check that parameters were updated
      expect(await assetDAO.quorum()).to.equal(newQuorum);
      expect(await assetDAO.votingPeriod()).to.equal(newVotingPeriod);
      expect(await assetDAO.executionDelay()).to.equal(newExecutionDelay);
    });
  });

  describe("Ragequit", function () {
    beforeEach(async function () {
      // Add the mock token as a supported asset
      await assetDAO.connect(user1).createProposal(
        1, // AddAsset
        mockERC20.address,
        0,
        0,
        0,
        "Add MOCK token"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(0, true, INITIAL_QUORUM);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");
      
      // Execute proposal
      await assetDAO.connect(owner).executeProposal(0);

      // Invest to get DAI tokens
      const investAmount = ethers.utils.parseEther("100");
      const currentPrice = ethers.utils.parseEther("100");
      const minPrice = currentPrice.mul(95).div(100);
      const maxPrice = currentPrice.mul(105).div(100);

      // Create invest proposal
      await assetDAO.connect(user1).createProposal(
        3, // Invest
        mockERC20.address,
        investAmount,
        minPrice,
        maxPrice,
        "Invest in MOCK"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(1, true, INITIAL_QUORUM);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [INITIAL_VOTING_PERIOD + INITIAL_EXECUTION_DELAY]);
      await ethers.provider.send("evm_mine");
      
      // Execute invest proposal
      await assetDAO.connect(owner).executeProposal(1);

      // Check user has DAI tokens
      const daiBalance = await daiToken.balanceOf(user1.address);
      expect(daiBalance).to.be.gt(0);
    });

    it("Should execute ragequit", async function () {
      // Note: Full implementation of ragequit test would require more setup
      // This is a simplified test to check basic functionality
      
      // For a complete test, we would need:
      // 1. Connect ragequitHandler to assetDAO
      // 2. Grant required permissions
      // 3. Approve DAI tokens for burning
      // 4. Execute ragequit
      // 5. Check balances were updated correctly
      
      // For now, just verify the handler was deployed correctly
      expect(await ragequitHandler.assetDAO()).to.equal(assetDAO.address);
      expect(await ragequitHandler.daiToken()).to.equal(daiToken.address);
      expect(await ragequitHandler.ragequitCooldown()).to.equal(COOLDOWN_PERIOD);
      expect(await ragequitHandler.maxRagequitAmount()).to.equal(MAX_RAGEQUIT_AMOUNT);
    });
  });
});