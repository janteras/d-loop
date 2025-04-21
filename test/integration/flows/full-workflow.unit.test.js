const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("D-Loop Protocol Integration", function () {
  // Test accounts
  let admin, user1, user2, user3, aiNode1, aiNode2, developersMultisig;
  
  // Core contracts
  let dloopToken, daiToken, soulboundNFT, aiNodeRegistry;
  let priceOracle, aiNodeGovernance, treasury, feeCalculator;
  let feeProcessor, governanceRewards, assetDAO, protocolDAO;
  
  // Test tokens
  let weth, link, usdc;
  
  // Constants
  const ZERO_ADDRESS = ethers.ZeroAddress;
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
  const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));
  const FEE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEE_MANAGER_ROLE"));
  const AUTHORIZED_CONTRACT_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTHORIZED_CONTRACT_ROLE"));
  const DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  const FEE_PROCESSOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FEE_PROCESSOR_ROLE"));
  
  // Simplified deployment for all contracts
  beforeEach(async function () {
    // Set up accounts
    [admin, user1, user2, user3, aiNode1, aiNode2, developersMultisig] = await ethers.getSigners();
    
    console.log("Setting up test environment...");
    
    // Deploy mock tokens for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    weth = await MockToken.deploy("Wrapped ETH", "WETH", 18);
    await weth.deployed();
    
    link = await MockToken.deploy("ChainLink Token", "LINK", 18);
    await link.deployed();
    
    usdc = await MockToken.deploy("USD Coin", "USDC", 6);
    await usdc.deployed();
    
    // Mint tokens to users for testing
    for (const token of [weth, link, usdc]) {
      await token.mint(user1.address, token === usdc ? 
        ethers.utils.parseUnits("10000", 6) : 
        ethers.parseEther("100")
      );
      
      await token.mint(user2.address, token === usdc ? 
        ethers.utils.parseUnits("10000", 6) : 
        ethers.parseEther("100")
      );
    }
    
    console.log("Deploying core protocol tokens...");
    
    // Deploy DLOOP token
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    dloopToken = await DLoopToken.deploy(
      "d-loop Governance Token",
      "DLOOP",
      ethers.utils.parseEther("1000000"),
      18,
      ethers.utils.parseEther("10000000"),
      admin.address
    );
    await dloopToken.deployed();
    
    // Distribute DLOOP tokens
    await dloopToken.transfer(user1.address, ethers.utils.parseEther("50000"));
    await dloopToken.transfer(user2.address, ethers.utils.parseEther("50000"));
    await dloopToken.transfer(user3.address, ethers.utils.parseEther("10000"));
    await dloopToken.transfer(aiNode1.address, ethers.utils.parseEther("50000"));
    await dloopToken.transfer(aiNode2.address, ethers.utils.parseEther("50000"));
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("d-loop Asset Index Token", "D-AI", 18);
    await daiToken.deployed();
    
    console.log("Deploying identity and registry contracts...");
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(
      "d-loop AI Node Identity",
      "DLAI",
      "https://api.d-loop.io/metadata/"
    );
    await soulboundNFT.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(
      soulboundNFT.address,
      admin.address
    );
    await aiNodeRegistry.deployed();
    
    // Set up SoulboundNFT minter role
    await soulboundNFT.grantRole(MINTER_ROLE, aiNodeRegistry.address);
    
    console.log("Deploying governance and fee system contracts...");
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();
    await priceOracle.deployed();
    
    // Set up prices in the oracle
    await priceOracle.setDirectPrice(
      weth.address,
      ethers.parseUnits("2000", 8), // $2000 per ETH
      8
    );
    
    await priceOracle.setDirectPrice(
      link.address,
      ethers.parseUnits("20", 8), // $20 per LINK
      8
    );
    
    await priceOracle.setDirectPrice(
      usdc.address,
      ethers.parseUnits("1", 8), // $1 per USDC
      8
    );
    
    // Deploy AINodeGovernance
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    aiNodeGovernance = await AINodeGovernance.deploy(
      dloopToken.address,
      aiNodeRegistry.address
    );
    await aiNodeGovernance.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.deployed();
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.deployed();
    
    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      feeCalculator.address,
      treasury.address,
      developersMultisig.address,
      admin.address // Node operators pool
    );
    await feeProcessor.deployed();
    
    // Set treasury's fee processor
    await treasury.grantRole(FEE_PROCESSOR_ROLE, feeProcessor.address);
    
    // Enable tokens in fee processor
    for (const token of [weth.address, link.address, usdc.address, dloopToken.address]) {
      await feeProcessor.setSupportedToken(token, true);
    }
    
    // Deploy GovernanceRewards
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    governanceRewards = await GovernanceRewards.deploy(
      dloopToken.address,
      admin.address
    );
    await governanceRewards.deployed();
    
    // Fund GovernanceRewards
    await dloopToken.transfer(governanceRewards.address, ethers.parseEther("100000"));
    
    console.log("Deploying DAO contracts...");
    
    // Deploy AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      daiToken.address,
      dloopToken.address,
      priceOracle.address,
      feeProcessor.address
    );
    await assetDAO.deployed();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(
      dloopToken.address,
      aiNodeRegistry.address,
      governanceRewards.address
    );
    await protocolDAO.deployed();
    
    console.log("Setting up permissions...");
    
    // Set up permissions
    await daiToken.grantRole(MINTER_ROLE, assetDAO.address);
    await daiToken.grantRole(BURNER_ROLE, assetDAO.address);
    await feeProcessor.grantRole(AUTHORIZED_CONTRACT_ROLE, assetDAO.address);
    await aiNodeRegistry.grantRole(GOVERNANCE_ROLE, protocolDAO.address);
    await aiNodeRegistry.grantRole(GOVERNANCE_ROLE, aiNodeGovernance.address);
    await governanceRewards.grantRole(DISTRIBUTOR_ROLE, protocolDAO.address);
    
    // Lower governance thresholds for testing
    await assetDAO.updateGovernanceParameters(
      1000, // 10% quorum (10000 = 100%)
      1 * 24 * 60 * 60, // 1 day voting period
      12 * 60 * 60, // 12 hours execution delay
      ethers.utils.parseEther("1000") // 1,000 DLOOP min stake
    );
    
    await protocolDAO.updateGovernanceParameters(
      1000, // 10% quorum
      1 * 24 * 60 * 60, // 1 day voting period
      12 * 60 * 60, // 12 hours execution delay
      ethers.utils.parseEther("1000"), // 1,000 DLOOP min stake
      100 // 100 reputation threshold
    );
    
    console.log("Test environment setup complete.");
  });

  describe("End-to-End Protocol Flow", function () {
    it("Should register and verify AI nodes", async function () {
      console.log("Step 1: Registering and verifying AI nodes");
      
      // Register AI nodes
      await aiNodeRegistry.registerAINode(aiNode1.address);
      await aiNodeRegistry.registerAINode(aiNode2.address);
      
      // Verify AI nodes
      await aiNodeRegistry.verifyAINode(
        aiNode1.address,
        "AI_NODE_1_IDENTIFIER",
        2 // VerificationStatus.Verified
      );
      
      await aiNodeRegistry.verifyAINode(
        aiNode2.address,
        "AI_NODE_2_IDENTIFIER",
        2 // VerificationStatus.Verified
      );
      
      // Check verification status
      expect(await aiNodeRegistry.isActiveAINode(aiNode1.address)).to.be.true;
      expect(await aiNodeRegistry.isActiveAINode(aiNode2.address)).to.be.true;
      
      // Check that SoulboundNFTs were minted
      const node1Details = await aiNodeRegistry.getNodeDetails(aiNode1.address);
      const node2Details = await aiNodeRegistry.getNodeDetails(aiNode2.address);
      
      expect(node1Details.soulboundTokenId).to.be.gt(0);
      expect(node2Details.soulboundTokenId).to.be.gt(0);
      
      console.log("AI nodes successfully registered and verified");
    });

    it("Should set up AI node governance with delegations", async function () {
      console.log("Step 2: Setting up AI node governance");
      
      // Register AI nodes first
      await aiNodeRegistry.registerAINode(aiNode1.address);
      await aiNodeRegistry.registerAINode(aiNode2.address);
      await aiNodeRegistry.verifyAINode(aiNode1.address, "AI_NODE_1", 2);
      await aiNodeRegistry.verifyAINode(aiNode2.address, "AI_NODE_2", 2);
      
      // Approve tokens for staking
      await dloopToken.connect(aiNode1).approve(
        aiNodeGovernance.address,
        ethers.utils.parseEther("30000")
      );
      
      await dloopToken.connect(aiNode2).approve(
        aiNodeGovernance.address,
        ethers.utils.parseEther("25000")
      );
      
      // Register nodes in AINodeGovernance
      await aiNodeGovernance.connect(aiNode1).registerNode(
        0, // NodeType.GovernanceNode
        ethers.utils.parseEther("30000")
      );
      
      await aiNodeGovernance.connect(aiNode2).registerNode(
        1, // NodeType.InvestmentNode
        ethers.utils.parseEther("25000")
      );
      
      // Users delegate to nodes
      await dloopToken.connect(user1).approve(
        aiNodeGovernance.address,
        ethers.parseEther("20000")
      );
      
      await dloopToken.connect(user2).approve(
        aiNodeGovernance.address,
        ethers.parseEther("15000")
      );
      
      await aiNodeGovernance.connect(user1).delegateToNode(
        aiNode1.address,
        ethers.parseEther("20000")
      );
      
      await aiNodeGovernance.connect(user2).delegateToNode(
        aiNode2.address,
        ethers.parseEther("15000")
      );
      
      // Check delegation details
      const user1Delegation = await aiNodeGovernance.getDelegationDetails(
        user1.address,
        aiNode1.address
      );
      
      const user2Delegation = await aiNodeGovernance.getDelegationDetails(
        user2.address,
        aiNode2.address
      );
      
      expect(user1Delegation.amount).to.equal(ethers.parseEther("20000"));
      expect(user2Delegation.amount).to.equal(ethers.parseEther("15000"));
      
      // Check node voting power
      const node1Power = await aiNodeGovernance.getNodeVotingPower(aiNode1.address);
      const node2Power = await aiNodeGovernance.getNodeVotingPower(aiNode2.address);
      
      expect(node1Power).to.equal(ethers.parseEther("50000")); // 30K stake + 20K delegated
      expect(node2Power).to.equal(ethers.parseEther("40000")); // 25K stake + 15K delegated
      
      console.log("AI node governance setup complete");
    });

    it("Should execute full investment and divestment workflow", async function () {
      console.log("Step 3: Testing full investment workflow");
      
      // Register and verify AI nodes (abbreviated)
      await aiNodeRegistry.registerAINode(aiNode1.address);
      await aiNodeRegistry.verifyAINode(aiNode1.address, "AI_NODE_1", 2);
      
      // Approve tokens for investment
      await weth.connect(user1).approve(
        assetDAO.address,
        ethers.parseEther("10")
      );
      
      await link.connect(user2).approve(
        assetDAO.address,
        ethers.parseEther("100")
      );
      
      // Create investment proposals
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        weth.address,
        ethers.parseEther("5"),
        "Invest in WETH"
      );
      
      await assetDAO.connect(user2).createProposal(
        0, // ProposalType.Investment
        link.address,
        ethers.parseEther("50"),
        "Invest in LINK"
      );
      
      // Vote on proposals
      await assetDAO.connect(user1).vote(0, true);
      await assetDAO.connect(user2).vote(0, true);
      await assetDAO.connect(user1).vote(1, true);
      await assetDAO.connect(user2).vote(1, true);
      
      // Wait for voting period to end
      await time.increase(1 * 24 * 60 * 60 + 1); // 1 day + 1 second
      
      // Wait for execution delay
      await time.increase(12 * 60 * 60 + 1); // 12 hours + 1 second
      
      // Execute proposals
      await assetDAO.connect(user1).executeProposal(0);
      await assetDAO.connect(user2).executeProposal(1);
      
      // Check asset balances in AssetDAO
      const wethDetails = await assetDAO.getAssetDetails(weth.address);
      const linkDetails = await assetDAO.getAssetDetails(link.address);
      
      expect(wethDetails.isSupported).to.be.true;
      expect(linkDetails.isSupported).to.be.true;
      expect(wethDetails.balance).to.equal(ethers.parseEther("5"));
      expect(linkDetails.balance).to.equal(ethers.parseEther("50"));
      
      // Check DAI tokens minted to users
      const user1DAIBalance = await daiToken.balanceOf(user1.address);
      const user2DAIBalance = await daiToken.balanceOf(user2.address);
      
      // Expected DAI values (with fee deduction)
      // WETH: 5 ETH * $2000 = $10,000
      // LINK: 50 LINK * $20 = $1,000
      // With 0.3% fee: $9,970 and $997 worth of DAI
      expect(user1DAIBalance).to.be.gt(ethers.parseEther("9900"));
      expect(user2DAIBalance).to.be.gt(ethers.parseEther("990"));
      
      console.log("Investment phase complete");
      console.log("Testing divestment workflow");
      
      // Store DAI balances for later comparison
      const initialUser1DAI = await daiToken.balanceOf(user1.address);
      const initialUser2DAI = await daiToken.balanceOf(user2.address);
      
      // Approve DAI for burning
      await daiToken.connect(user1).approve(
        assetDAO.address,
        initialUser1DAI
      );
      
      await daiToken.connect(user2).approve(
        assetDAO.address,
        initialUser2DAI
      );
      
      // Create divestment proposals
      await assetDAO.connect(user1).createProposal(
        1, // ProposalType.Divestment
        weth.address,
        ethers.parseEther("2"),
        "Divest from WETH"
      );
      
      await assetDAO.connect(user2).createProposal(
        1, // ProposalType.Divestment
        link.address,
        ethers.parseEther("25"),
        "Divest from LINK"
      );
      
      // Vote on proposals
      await assetDAO.connect(user1).vote(2, true);
      await assetDAO.connect(user2).vote(2, true);
      await assetDAO.connect(user1).vote(3, true);
      await assetDAO.connect(user2).vote(3, true);
      
      // Wait for voting and execution delay
      await time.increase(1 * 24 * 60 * 60 + 12 * 60 * 60 + 2); // 1 day + 12 hours + 2 seconds
      
      // Store initial token balances
      const initialUser1WETH = await weth.balanceOf(user1.address);
      const initialUser2LINK = await link.balanceOf(user2.address);
      
      // Execute divestment proposals
      await assetDAO.connect(user1).executeProposal(2);
      await assetDAO.connect(user2).executeProposal(3);
      
      // Check that tokens were returned to users (minus fees)
      const finalUser1WETH = await weth.balanceOf(user1.address);
      const finalUser2LINK = await link.balanceOf(user2.address);
      
      // Due to 0.5% divestment fee, they'll get slightly less than the full amount
      expect(finalUser1WETH).to.be.gt(initialUser1WETH + ethers.parseEther("1.98")); // ~2 WETH
      expect(finalUser2LINK).to.be.gt(initialUser2LINK + ethers.parseEther("24.5")); // ~25 LINK
      
      // Check DAO balances were reduced
      const finalWethDetails = await assetDAO.getAssetDetails(weth.address);
      const finalLinkDetails = await assetDAO.getAssetDetails(link.address);
      
      expect(finalWethDetails.balance).to.equal(ethers.parseEther("3")); // 5 - 2
      expect(finalLinkDetails.balance).to.equal(ethers.parseEther("25")); // 50 - 25
      
      // Check DAI tokens were burned
      const finalUser1DAI = await daiToken.balanceOf(user1.address);
      const finalUser2DAI = await daiToken.balanceOf(user2.address);
      
      expect(finalUser1DAI).to.be.lt(initialUser1DAI);
      expect(finalUser2DAI).to.be.lt(initialUser2DAI);
      
      console.log("Divestment phase complete");
    });

    it("Should execute protocol governance workflow", async function () {
      console.log("Step 4: Testing protocol governance");
      
      // Register and verify AI node
      await aiNodeRegistry.registerAINode(aiNode1.address);
      await aiNodeRegistry.verifyAINode(aiNode1.address, "AI_NODE_1", 2);
      
      // Increase AI node reputation in ProtocolDAO
      await protocolDAO.updateReputationScore(aiNode1.address, 200);
      
      // Create parameter change proposal
      await protocolDAO.connect(aiNode1).createProposal(
        2, // ProposalType.ParameterChange
        protocolDAO.address,
        protocolDAO.interface.encodeFunctionData("updateGovernanceParameters", [
          2000, // 20% quorum
          2 * 24 * 60 * 60, // 2 days voting period
          6 * 60 * 60, // 6 hours execution delay
          ethers.utils.parseEther("2000"), // 2000 DLOOP min stake
          150 // 150 reputation threshold
        ]),
        "Update governance parameters"
      );
      
      // Vote on proposal
      await protocolDAO.connect(aiNode1).vote(0, true);
      await protocolDAO.connect(user1).vote(0, true);
      await protocolDAO.connect(user2).vote(0, true);
      
      // Wait for voting period and execution delay
      await time.increase(1 * 24 * 60 * 60 + 12 * 60 * 60 + 1); // 1 day + 12 hours + 1 second
      
      // Check initial parameters
      const initialQuorum = await protocolDAO.quorum();
      expect(initialQuorum).to.equal(1000); // 10%
      
      // Execute proposal
      await protocolDAO.connect(aiNode1).executeProposal(0);
      
      // Check updated parameters
      expect(await protocolDAO.quorum()).to.equal(2000); // 20%
      expect(await protocolDAO.votingPeriod()).to.equal(2 * 24 * 60 * 60); // 2 days
      expect(await protocolDAO.executionDelay()).to.equal(6 * 60 * 60); // 6 hours
      expect(await protocolDAO.minProposalStake()).to.equal(ethers.utils.parseEther("2000"));
      expect(await protocolDAO.highReputationThreshold()).to.equal(150);
      
      // Check if rewards were distributed (high reputation proposal)
      const finalAINodeBalance = await dloopToken.balanceOf(aiNode1.address);
      expect(finalAINodeBalance).to.be.gt(ethers.utils.parseEther("50000"));
      
      console.log("Protocol governance workflow complete");
    });

    it("Should distribute and collect fees properly", async function () {
      console.log("Step 5: Testing fee collection and distribution");
      
      // First create an investment to generate fees
      await weth.connect(user1).approve(
        assetDAO.address,
        ethers.parseEther("10")
      );
      
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        weth.address,
        ethers.parseEther("10"),
        "Large WETH investment for fees"
      );
      
      await assetDAO.connect(user1).vote(0, true);
      await assetDAO.connect(user2).vote(0, true);
      
      // Wait for voting and execution delay
      await time.increase(1 * 24 * 60 * 60 + 12 * 60 * 60 + 1); // 1 day + 12 hours + 1 second
      
      // Execute investment proposal
      await assetDAO.connect(user1).executeProposal(0);
      
      // Check if fees were collected
      // Investment fee: 0.3% of 10 ETH ($20,000) = ~$60 worth of assets
      
      // Check that FeeProcessor has collected fees
      expect(await feeProcessor.collectedFees(weth.address)).to.be.gt(0);
      
      // Distribute fees
      await feeProcessor.distributeFees(weth.address);
      
      // Check Treasury balance (should be 70% of fees)
      const treasuryBalance = await weth.balanceOf(treasury.address);
      expect(treasuryBalance).to.be.gt(0);
      
      // Check developers received their share (20% of fees)
      const developersBalance = await weth.balanceOf(developersMultisig.address);
      expect(developersBalance).to.be.gt(0);
      
      // Check node operators received their share (10% of fees)
      const nodeOperatorsBalance = await weth.balanceOf(admin.address);
      expect(nodeOperatorsBalance).to.be.gt(0);
      
      // Check fee distribution is correct
      const totalFees = treasuryBalance.add(developersBalance).add(nodeOperatorsBalance);
      
      // Treasury should have ~70% of fees
      expect(treasuryBalance).to.be.closeTo(
        totalFees.mul(7000).div(10000),
        totalFees.div(100) // Allow 1% precision error
      );
      
      // Developers should have ~20% of fees
      expect(developersBalance).to.be.closeTo(
        totalFees.mul(2000).div(10000),
        totalFees.div(100) // Allow 1% precision error
      );
      
      console.log("Fee collection and distribution complete");
      
      // Test Treasury allocation
      await treasury.connect(admin).allocateFunds(
        weth.address,
        treasuryBalance.div(2),
        user3.address,
        0, // AllocationPurpose.Development
        "Development funding"
      );
      
      // Check user3 received the allocation
      expect(await weth.balanceOf(user3.address)).to.equal(treasuryBalance.div(2));
      
      // Check treasury balance was reduced
      expect(await treasury.getBalance(weth.address)).to.equal(treasuryBalance.div(2));
      
      console.log("Treasury allocation complete");
    });
  });

  describe("Error and Recovery Scenarios", function () {
    it("Should handle failed proposals correctly", async function () {
      // Create a controversial proposal
      await assetDAO.connect(user1).createProposal(
        0, // ProposalType.Investment
        weth.address,
        ethers.parseEther("50"), // Very large amount
        "Controversial investment"
      );
      
      // Vote against the proposal
      await assetDAO.connect(user1).vote(0, false);
      await assetDAO.connect(user2).vote(0, false);
      
      // Wait for voting and execution delay
      await time.increase(1 * 24 * 60 * 60 + 12 * 60 * 60 + 1);
      
      // Try to execute the rejected proposal
      await expect(
        assetDAO.connect(user1).executeProposal(0)
      ).to.be.revertedWith("Invalid status");
      
      // Proposal status should be Rejected
      const proposal = await assetDAO.getProposal(0);
      expect(proposal.status).to.equal(3); // Rejected
    });

    it("Should handle pausing and unpausing", async function () {
      // Pause AssetDAO
      await assetDAO.connect(admin).pause();
      
      // Try to create a proposal while paused
      await expect(
        assetDAO.connect(user1).createProposal(
          0,
          weth.address,
          ethers.parseEther("5"),
          "Should fail while paused"
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause AssetDAO
      await assetDAO.connect(admin).unpause();
      
      // Now creation should work
      await assetDAO.connect(user1).createProposal(
        0,
        weth.address,
        ethers.parseEther("5"),
        "Should work after unpausing"
      );
      
      // Proposal should be created successfully
      const proposal = await assetDAO.getProposal(0);
      expect(proposal.assetAddress).to.equal(weth.address);
      expect(proposal.status).to.equal(1); // Active
    });
  });
});
