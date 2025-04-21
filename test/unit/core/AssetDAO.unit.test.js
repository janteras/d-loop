// Include the ethers v6 adapter for compatibility
require('../../../../shims/ethers-v6-adapter');

const { expect } = require("chai");
// Import ethers directly first
const ethersLib = require("ethers");
// Add compatibility utilities from ethers
const { keccak256, toUtf8Bytes } = ethersLib;
const parseEther = ethersLib.parseEther;
const parseUnits = ethersLib.parseUnits;
const formatEther = ethersLib.formatEther;
const formatUnits = ethersLib.formatUnits;

// Then import hardhat runtime 
const { ethers } = require("hardhat");

/**
 * Helper function to compute role hashes consistent with solidity keccak256
 */
function computeRoleHash(role) {
  return keccak256(toUtf8Bytes(role));
}

// Helper function to replace hardhat-network-helpers time functionality
const time = {
  async increase(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }
};

// Mock contracts and helpers will be created through the ethers getContractFactory pattern
// We're ensuring the test can find the correct artifacts
// See the mock contracts in contracts/test/ directory

// computeRoleHash is already imported above

describe("AssetDAO", function () {
  let assetDAO;
  let daiToken;
  let dloopToken;
  let priceOracle;
  let feeProcessor;
  let feeCalculator;
  let mockToken;
  let admin;
  let user1;
  let user2;

  // Constants
  const ZERO_ADDRESS = ethers.ZeroAddress;
  const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
  const MINTER_ROLE = computeRoleHash("MINTER_ROLE");
  const BURNER_ROLE = computeRoleHash("BURNER_ROLE");
  const GOVERNANCE_ROLE = computeRoleHash("GOVERNANCE_ROLE");
  const AUTHORIZED_CONTRACT_ROLE = computeRoleHash("AUTHORIZED_CONTRACT_ROLE");

  beforeEach(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    // Reassign signers to match most basic test expectation
    admin = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    
    console.log("Admin address:", admin.address);
    console.log("User1 address:", user1.address);
    console.log("User2 address:", user2.address);

    // Deploy MockToken for testing with admin as deployer
    const MockToken = await ethers.getContractFactory("MockERC20", admin);
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.waitForDeployment();

    // Mint tokens to users for testing
    await mockToken.connect(admin).mint(user1.address, ethers.parseEther("1000"));
    await mockToken.connect(admin).mint(user2.address, ethers.parseEther("1000"));

    // Deploy DAI token with admin as the deployer
    const DAIToken = await ethers.getContractFactory("DAIToken", admin);
    daiToken = await DAIToken.deploy("d-loop Asset Index Token", "D-AI", 18);
    await daiToken.waitForDeployment();
    
    // Mint initial DAI to admin and users for testing (using admin account)
    await daiToken.connect(admin).mint(admin.address, ethers.parseEther("1000000"));
    await daiToken.connect(admin).mint(user1.address, ethers.parseEther("10000"));
    await daiToken.connect(admin).mint(user2.address, ethers.parseEther("10000"));

    // Deploy DLOOP token with admin address specified explicitly
    // This ensures the admin account gets the DEFAULT_ADMIN_ROLE
    const DLoopToken = await ethers.getContractFactory("DLoopToken", admin);
    dloopToken = await DLoopToken.deploy(
      "d-loop Governance Token",
      "DLOOP",
      ethers.parseEther("1000000"),
      18,
      ethers.parseEther("10000000"),
      admin.address  // Important: explicitly set admin address as the admin parameter
    );
    await dloopToken.waitForDeployment();

    // In our updated DLoopToken, the deployer (admin in this case) gets the initial tokens
    // Since admin is signers[0], admin now has the tokens
    
    // Transfer tokens to users directly from admin
    await dloopToken.connect(admin).transfer(user1.address, ethers.parseEther("10000"));
    await dloopToken.connect(admin).transfer(user2.address, ethers.parseEther("10000"));

    // Deploy PriceOracle with admin as deployer
    const PriceOracle = await ethers.getContractFactory("PriceOracle", admin);
    priceOracle = await PriceOracle.deploy(ethers.ZeroAddress);
    await priceOracle.waitForDeployment();

    // Set up price for mockToken
    await priceOracle.connect(admin).setDirectPrice(
      mockToken.address,
      ethers.parseUnits("2.0", 8), // $2.00 with 8 decimals
      8
    );

    // Deploy FeeCalculator with admin as deployer
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator", admin);
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.waitForDeployment();

    // Deploy Treasury with admin as deployer
    const Treasury = await ethers.getContractFactory("Treasury", admin);
    const treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.waitForDeployment();

    // Deploy FeeProcessor with admin as deployer
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor", admin);
    feeProcessor = await FeeProcessor.deploy(
      feeCalculator.address,
      treasury.address,
      admin.address,
      admin.address
    );
    await feeProcessor.waitForDeployment();

    // Set supported token in FeeProcessor
    await feeProcessor.connect(admin).setSupportedToken(mockToken.address, true);
    await feeProcessor.connect(admin).setSupportedToken(daiToken.address, true);

    // Deploy AssetDAO with admin as deployer
    const AssetDAO = await ethers.getContractFactory("AssetDAO", admin);
    assetDAO = await AssetDAO.deploy(
      daiToken.address,
      dloopToken.address,
      priceOracle.address,
      feeProcessor.address
    );
    await assetDAO.waitForDeployment();

    // Set up permissions (using admin account for all role assignments)
    await daiToken.connect(admin).grantRole(MINTER_ROLE, assetDAO.address);
    await daiToken.connect(admin).grantRole(BURNER_ROLE, assetDAO.address);
    await feeProcessor.connect(admin).grantRole(AUTHORIZED_CONTRACT_ROLE, assetDAO.address);
  });

  describe("Initialization", function () {
    it("Should initialize with correct parameters", async function () {
      expect(await assetDAO.daiToken()).to.equal(daiToken.address);
      expect(await assetDAO.dloopToken()).to.equal(dloopToken.address);
      expect(await assetDAO.priceOracle()).to.equal(priceOracle.address);
      expect(await assetDAO.feeProcessor()).to.equal(feeProcessor.address);
      expect(await assetDAO.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should revert if zero addresses are provided", async function () {
      const AssetDAO = await ethers.getContractFactory("AssetDAO", admin);
      
      await expect(
        AssetDAO.deploy(ZERO_ADDRESS, dloopToken.address, priceOracle.address, feeProcessor.address)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "ZeroAddress");
      
      await expect(
        AssetDAO.deploy(daiToken.address, ZERO_ADDRESS, priceOracle.address, feeProcessor.address)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "ZeroAddress");
      
      await expect(
        AssetDAO.deploy(daiToken.address, dloopToken.address, ZERO_ADDRESS, feeProcessor.address)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "ZeroAddress");
      
      await expect(
        AssetDAO.deploy(daiToken.address, dloopToken.address, priceOracle.address, ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "ZeroAddress");
    });
  });

  describe("Proposal Creation and Voting", function () {
    it("Should allow creating an investment proposal", async function () {
      // Create a proposal from user1
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );

      const proposalId = 0;
      const proposal = await assetDAO.getProposal(proposalId);

      expect(proposal.proposalType).to.equal(0); // Investment
      expect(proposal.assetAddress).to.equal(mockToken.address);
      expect(proposal.amount).to.equal(ethers.parseEther("100"));
      expect(proposal.status).to.equal(1); // Active
    });

    it("Should allow voting on a proposal", async function () {
      // Create proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(0, true); // Yes vote
      await assetDAO.connect(user2).vote(0, false); // No vote

      const proposal = await assetDAO.getProposal(0);
      
      expect(proposal.yesVotes).to.equal(ethers.parseEther("10000")); // user1's balance
      expect(proposal.noVotes).to.equal(ethers.parseEther("10000")); // user2's balance
    });

    it("Should prevent voting twice", async function () {
      // Create proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );

      // Vote on proposal
      await assetDAO.connect(user1).vote(0, true);

      // Try to vote again
      await expect(
        assetDAO.connect(user1).vote(0, false)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "AlreadyVoted");
    });

    it("Should prevent voting after the voting period", async function () {
      // Create proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );

      // Fast forward to after voting period (3 days)
      await time.increase(3 * 24 * 60 * 60 + 1);

      // Try to vote
      await expect(
        assetDAO.connect(user1).vote(0, true)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "VotingEnded");
    });
  });

  describe("Proposal Execution", function () {
    beforeEach(async function () {
      // Approve AssetDAO to spend user1's mockToken
      await mockToken.connect(user1).approve(assetDAO.address, ethers.parseEther("1000"));
      
      // Create an investment proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );

      // Vote yes (only user1, which has 10K DLOOP)
      await assetDAO.connect(user1).vote(0, true);

      // Set quorum to 5% to allow the proposal to pass with just user1's vote
      await assetDAO.connect(admin).updateGovernanceParameters(
        500, // 5% quorum
        3 * 24 * 60 * 60, // 3 days voting period
        1 * 24 * 60 * 60, // 1 day execution delay
        ethers.parseEther("1000") // 1000 DLOOP min stake
      );
    });

    it("Should execute an investment proposal after delay", async function () {
      // Wait for voting period and execution delay
      await time.increase(4 * 24 * 60 * 60 + 1); // 4 days (voting + execution delay)

      // Get initial balances
      const initialUserMockBalance = await mockToken.balanceOf(user1.address);
      const initialDAOMockBalance = await mockToken.balanceOf(assetDAO.address);
      const initialUserDAIBalance = await daiToken.balanceOf(user1.address);

      // Execute the proposal
      await assetDAO.connect(user1).executeProposal(0);

      // Check final state
      const proposal = await assetDAO.getProposal(0);
      expect(proposal.status).to.equal(4); // Executed

      // Check token transfers
      expect(await mockToken.balanceOf(user1.address)).to.equal(
        initialUserMockBalance - ethers.parseEther("100")
      );
      expect(await mockToken.balanceOf(assetDAO.address)).to.equal(
        initialDAOMockBalance + ethers.parseEther("100")
      );

      // Check DAI minting (without accounting for fees for simplicity)
      expect(await daiToken.balanceOf(user1.address)).to.be.gt(initialUserDAIBalance);

      // Check asset is supported
      expect(await assetDAO.supportedAssets(mockToken.address)).to.be.true;
    });

    it("Should execute a divestment proposal", async function () {
      // First invest in the asset
      await time.increase(4 * 24 * 60 * 60 + 1);
      await assetDAO.connect(user1).executeProposal(0);
      
      // Check DAI balance
      const userDAIBalance = await daiToken.balanceOf(user1.address);
      
      // Approve DAO to burn DAI tokens
      await daiToken.connect(user1).approve(assetDAO.address, userDAIBalance);
      
      // Create divestment proposal
      await assetDAO.connect(user1).createProposal(
        1, // ProposalType.Divestment
        mockToken.address,
        ethers.parseEther("50"), // Divest half
        "Divest from MockToken"
      );
      
      // Vote yes
      await assetDAO.connect(user1).vote(1, true);
      
      // Wait for voting period and execution delay
      await time.increase(4 * 24 * 60 * 60 + 1);
      
      // Get initial balances
      const initialUserMockBalance = await mockToken.balanceOf(user1.address);
      const initialDAOMockBalance = await mockToken.balanceOf(assetDAO.address);
      
      // Execute the proposal
      await assetDAO.connect(user1).executeProposal(1);
      
      // Check token transfers (not accounting for fees for simplicity)
      expect(await mockToken.balanceOf(user1.address)).to.be.gt(initialUserMockBalance);
      expect(await mockToken.balanceOf(assetDAO.address)).to.be.lt(initialDAOMockBalance);
    });

    it("Should reject execution if not passed", async function () {
      // Create a new proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("200"),
        "Invest more in MockToken"
      );
      
      // Vote no
      await assetDAO.connect(user1).vote(1, false);
      
      // Wait for voting period and execution delay
      await time.increase(4 * 24 * 60 * 60 + 1);
      
      // Try to execute
      await expect(
        assetDAO.connect(user1).executeProposal(1)
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "InvalidAssetState");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update governance parameters", async function () {
      await assetDAO.connect(admin).updateGovernanceParameters(
        6000, // 60% quorum
        7 * 24 * 60 * 60, // 7 days voting period
        2 * 24 * 60 * 60, // 2 days execution delay
        ethers.parseEther("5000") // 5000 DLOOP min stake
      );
      
      expect(await assetDAO.quorum()).to.equal(6000);
      expect(await assetDAO.votingPeriod()).to.equal(7 * 24 * 60 * 60);
      expect(await assetDAO.executionDelay()).to.equal(2 * 24 * 60 * 60);
      expect(await assetDAO.minProposalStake()).to.equal(ethers.parseEther("5000"));
    });

    it("Should allow admin to update price oracle", async function () {
      const newOracle = await ethers.getContractFactory("PriceOracle", admin).then(f => f.deploy(ethers.ZeroAddress));
      await newOracle.waitForDeployment();
      
      await assetDAO.connect(admin).updatePriceOracle(newOracle.address);
      
      expect(await assetDAO.priceOracle()).to.equal(newOracle.address);
    });

    it("Should allow admin to update fee processor", async function () {
      const newProcessor = await ethers.getContractFactory("FeeProcessor", admin).then(
        f => f.deploy(feeCalculator.address, admin.address, admin.address, admin.address)
      );
      await newProcessor.waitForDeployment();
      
      await assetDAO.connect(admin).updateFeeProcessor(newProcessor.address);
      
      expect(await assetDAO.feeProcessor()).to.equal(newProcessor.address);
    });

    it("Should allow admin to pause and unpause", async function () {
      await assetDAO.connect(admin).pause();
      expect(await assetDAO.paused()).to.be.true;
      
      await expect(
        assetDAO.connect(user1).createProposal(
          0,
          mockToken.address,
          ethers.parseEther("100"),
          "Invest in MockToken"
        )
      ).to.be.revertedWithCustomError(await ethers.getContractFactory("Errors", admin), "ContractPaused");
      
      await assetDAO.connect(admin).unpause();
      expect(await assetDAO.paused()).to.be.false;
      
      // Should work after unpausing
      await assetDAO.connect(user1).createProposal(
        0,
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );
    });
  });

  describe("Asset Management", function () {
    it("Should correctly track asset balances", async function () {
      // Approve AssetDAO to spend user1's mockToken
      await mockToken.connect(user1).approve(assetDAO.address, ethers.parseEther("1000"));
      
      // Create an investment proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        mockToken.address,
        ethers.parseEther("100"),
        "Invest in MockToken"
      );
      
      // Vote yes
      await assetDAO.connect(user1).vote(0, true);
      
      // Lower quorum for testing
      await assetDAO.connect(admin).updateGovernanceParameters(
        500, // 5% quorum
        3 * 24 * 60 * 60, // 3 days voting period
        1 * 24 * 60 * 60, // 1 day execution delay
        ethers.parseEther("1000") // 1000 DLOOP min stake
      );
      
      // Wait for voting period and execution delay
      await time.increase(4 * 24 * 60 * 60 + 1);
      
      // Execute the proposal
      await assetDAO.connect(user1).executeProposal(0);
      
      // Check asset details
      const assetDetails = await assetDAO.getAssetDetails(mockToken.address);
      
      expect(assetDetails.isSupported).to.be.true;
      expect(assetDetails.balance).to.equal(ethers.parseEther("100"));
      
      // Get all supported assets
      const supportedAssets = await assetDAO.getSupportedAssets();
      expect(supportedAssets.length).to.equal(1);
      expect(supportedAssets[0]).to.equal(mockToken.address);
      
      // Check asset count
      expect(await assetDAO.getAssetCount()).to.equal(1);
    });

    it("Should update total pool value after asset changes", async function () {
      // Approve and invest
      await mockToken.connect(user1).approve(assetDAO.address, ethers.parseEther("1000"));
      await assetDAO.connect(user1).createProposal(0, mockToken.address, ethers.parseEther("100"), "Invest");
      await assetDAO.connect(user1).vote(0, true);
      await assetDAO.connect(admin).updateGovernanceParameters(500, 3 * 24 * 60 * 60, 1 * 24 * 60 * 60, ethers.parseEther("1000"));
      await time.increase(4 * 24 * 60 * 60 + 1);
      await assetDAO.connect(user1).executeProposal(0);
      
      // Check pool value (mockToken price = $2.00)
      // 100 tokens * $2.00 = $200.00
      const expectedValue = ethers.parseUnits("200", 8); // 8 decimals from oracle
      
      // Allow for small differences due to fees
      const totalPoolValue = await assetDAO.totalPoolValue();
      expect(totalPoolValue).to.be.closeTo(expectedValue, ethers.parseUnits("5", 8)); // Within $5
      
      // Check DAI price
      const daiPrice = await assetDAO.getDAIPrice();
      expect(daiPrice).to.be.gt(0);
    });
  });
});
