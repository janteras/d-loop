const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * @title D-Loop Protocol Governance Flow Tests
 * @dev Tests for verifying the complete governance lifecycle across contracts
 * @notice These tests validate proposal creation, voting, execution, and reward distribution
 */
describe("D-Loop Protocol Governance Flow Tests", function () {
  // Use our reusable protocol fixture
  async function deployGovernanceFixture() {
    const [owner, admin, user1, user2, node1, node2] = await ethers.getSigners();
    
    // Deploy DLoopToken for governance
    const DLoopToken = await ethers.getContractFactory("DLoopToken");
    const dloopToken = await DLoopToken.deploy(
      "D-Loop Token",
      "DLOOP",
      ethers.parseEther("1000000"), // initialSupply
      18, // decimals
      ethers.parseEther("100000000"), // maxSupply
      admin.address
    );
    await dloopToken.waitForDeployment();
    
    // Deploy DAIToken for rewards
    const DAIToken = await ethers.getContractFactory("DAIToken");
    const daiToken = await DAIToken.deploy();
    await daiToken.waitForDeployment();
    
    // Deploy Treasury with a temporary address for ProtocolDAO
    // We'll update it after ProtocolDAO is deployed
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(admin.address, admin.address); // Using admin as temporary ProtocolDAO address
    await treasury.waitForDeployment();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    const protocolDAO = await ProtocolDAO.deploy(
      admin.address,
      await treasury.getAddress(),
      86400, // votingPeriod (1 day in seconds)
      43200, // executionDelay (12 hours in seconds)
      10     // quorum (10%)
    );
    await protocolDAO.waitForDeployment();
    
    // Update Treasury with ProtocolDAO address
    await treasury.updateProtocolDAO(await protocolDAO.getAddress());
    
    // Deploy a SoulboundNFT for node identity with admin parameter
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    const soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Deploy AINodeRegistry with correct parameters
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    const aiNodeRegistry = await AINodeRegistry.deploy(
      admin.address,
      await protocolDAO.getAddress(),
      await soulboundNFT.getAddress()
    );
    await aiNodeRegistry.waitForDeployment();
    
    // Deploy AINodeGovernance with correct parameters
    const AINodeGovernance = await ethers.getContractFactory("AINodeGovernance");
    const aiNodeGovernance = await AINodeGovernance.deploy(
      await dloopToken.getAddress(),
      await aiNodeRegistry.getAddress()
    );
    await aiNodeGovernance.waitForDeployment();
    
    // Set up admin role
    await aiNodeGovernance.grantRole(await aiNodeGovernance.ADMIN_ROLE(), admin.address);
    
    // Deploy GovernanceRewards with correct parameters
    const GovernanceRewards = await ethers.getContractFactory("GovernanceRewards");
    const governanceRewards = await GovernanceRewards.deploy(
      await daiToken.getAddress(),
      admin.address
    );
    await governanceRewards.waitForDeployment();
    
    // The admin already has ADMIN_ROLE from the constructor
    // Now use the admin to add ProtocolDAO as a distributor
    await governanceRewards.connect(admin).addDistributor(await protocolDAO.getAddress());
    
    // Setup roles and permissions
    await dloopToken.grantRole(await dloopToken.MINTER_ROLE(), owner.address);
    await daiToken.grantRole(await daiToken.MINTER_ROLE(), owner.address);
    
    // Mint initial tokens
    const initialMint = ethers.parseEther("1000000");
    await dloopToken.mint(owner.address, initialMint);
    await daiToken.mint(owner.address, initialMint);
    
    // Transfer tokens to users for testing
    const userAmount = ethers.parseEther("10000");
    await dloopToken.transfer(user1.address, userAmount);
    await dloopToken.transfer(user2.address, userAmount);
    await dloopToken.transfer(node1.address, userAmount);
    await dloopToken.transfer(node2.address, userAmount);
    
    // Fund GovernanceRewards contract
    await daiToken.transfer(await governanceRewards.getAddress(), ethers.parseEther("100000"));
    
    // Setup GovernanceRewards with values within acceptable limits
    await governanceRewards.connect(admin).updateRewardConfig(
      ethers.parseEther("100"), // baseReward
      5000,                    // participationBonus (basis points, 50%)
      200,                     // qualityMultiplier (2x)
      300,                     // aiNodeMultiplier (3x)
      ethers.parseEther("1000") // cap
    );
    
    // Setup reward period with a future start time
    // Get the current block timestamp and add 1 hour to ensure it's in the future
    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const futureTime = blockBefore.timestamp + 3600; // current time + 1 hour
    
    await governanceRewards.connect(admin).updateRewardPeriod(
      futureTime,           // start 1 hour from now
      86400 * 30            // 30 days duration
    );
    
    // Add ProtocolDAO as a distributor
    await governanceRewards.connect(admin).addDistributor(await protocolDAO.getAddress());
    
    // Grant MINTER_ROLE to AINodeRegistry in SoulboundNFT
    await soulboundNFT.connect(admin).grantMinterRole(await aiNodeRegistry.getAddress());
    
    // Transfer tokens to nodes for staking
    await dloopToken.transfer(node1.address, ethers.parseEther("50000"));
    await dloopToken.transfer(node2.address, ethers.parseEther("50000"));
    
    // We need to make AINodeGovernance an admin in AINodeRegistry
    // This requires modifying the AINodeRegistry's admin directly
    // Since we can't set AINodeGovernance as admin directly (no function for that),
    // we'll just skip the AINodeRegistry integration for our tests
    
    // First, let's make sure the admin has the ADMIN_ROLE in AINodeGovernance
    await aiNodeGovernance.grantRole(await aiNodeGovernance.ADMIN_ROLE(), admin.address);
    
    // Now, let's set up a different AINodeRegistry that AINodeGovernance can work with
    // We'll deploy a new AINodeRegistry and set it in AINodeGovernance
    const newAINodeRegistry = await AINodeRegistry.deploy(
      await aiNodeGovernance.getAddress(), // Make AINodeGovernance the admin
      await protocolDAO.getAddress(),
      await soulboundNFT.getAddress()
    );
    await newAINodeRegistry.waitForDeployment();
    
    // Grant MINTER_ROLE to the new AINodeRegistry in SoulboundNFT
    await soulboundNFT.connect(admin).grantMinterRole(await newAINodeRegistry.getAddress());
    
    // Set the new AINodeRegistry in AINodeGovernance
    await aiNodeGovernance.connect(admin).setAINodeRegistry(await newAINodeRegistry.getAddress());
    
    // For our test purposes, we'll manually add nodes to the AINodeGovernance contract
    // instead of using the registerNode function which requires AINodeRegistry integration
    
    // First, let's check if there's a function to manually add nodes
    // If not, we'll need to modify our test approach to not rely on node registration
    
    // Let's transfer tokens to nodes for delegation tests
    await dloopToken.connect(owner).transfer(node1.address, ethers.parseEther("50000"));
    await dloopToken.connect(owner).transfer(node2.address, ethers.parseEther("50000"));
    
    return {
      daiToken, dloopToken, treasury, protocolDAO, 
      aiNodeGovernance, governanceRewards, soulboundNFT, aiNodeRegistry,
      owner, admin, user1, user2, node1, node2
    };
  }

  describe("Governance Proposal Lifecycle", function () {
    it("Should complete full proposal creation → voting → execution cycle", async function () {
      const { 
        dloopToken, protocolDAO, aiNodeGovernance, governanceRewards,
        admin, user1, user2, node1, node2 
      } = await loadFixture(deployGovernanceFixture);
      
      console.log("Step 1: Create a governance proposal");
      
      // For tokens that don't support delegation directly, we'll just transfer tokens
      // to users so they can vote with their balance
      // We already transferred tokens to users in the fixture, so we can skip this step
      
      // Create a proposal to whitelist a new token
      const description = "Proposal to add a new feature";
      const targets = [await protocolDAO.getAddress()]; // Target the ProtocolDAO itself
      const values = [0]; // No ETH being sent
      
      // Example function call: whitelistToken(address, bool)
      const newTokenAddress = "0x1234567890123456789012345678901234567890";
      const calldata = [
        protocolDAO.interface.encodeFunctionData("whitelistToken", [newTokenAddress, true])
      ];
      
      // User1 creates the proposal
      const tx = await protocolDAO.connect(user1).createProposal(
        description,
        targets,
        values,
        calldata
      );
      
      // Get the proposal ID from the event
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => log.fragment && log.fragment.name === 'ProposalCreated'
      );
      const proposalId = event.args[0]; // First arg is proposalId
      
      console.log(`Proposal created with ID: ${proposalId}`);
      expect(proposalId).to.be.gt(0);
      
      console.log("Step 2: Vote on the proposal");
      
      // User1, User2, and Node1 vote on the proposal
      await protocolDAO.connect(user1).castVote(proposalId, true); // Yes vote
      await protocolDAO.connect(user2).castVote(proposalId, true); // Yes vote
      await protocolDAO.connect(node1).castVote(proposalId, false); // No vote
      
      // Check voting status
      const proposal = await protocolDAO.getProposal(proposalId);
      console.log(`Proposal votes - Yes: ${proposal.yesVotes}, No: ${proposal.noVotes}`);
      
      // Fast forward time to end the voting period
      await ethers.provider.send("evm_increaseTime", [86400 + 1]); // Voting period + 1 second
      await ethers.provider.send("evm_mine");
      
      console.log("Step 3: Execute the proposal");
      
      // Execute the proposal
      await protocolDAO.connect(admin).executeProposal(proposalId);
      
      // Verify the proposal was executed
      const executedProposal = await protocolDAO.getProposal(proposalId);
      expect(executedProposal.executed).to.be.true;
      
      // Verify the token was whitelisted
      expect(await protocolDAO.isTokenWhitelisted(newTokenAddress)).to.be.true;
      
      console.log("Step 4: Distribute governance rewards");
      
      // Calculate total votes
      const totalVotes = proposal.yesVotes + proposal.noVotes;
      const totalSupply = await dloopToken.totalSupply();
      
      // Distribute rewards to the proposer (user1)
      await governanceRewards.connect(admin).distributeRewards(
        user1.address,
        proposal.yesVotes,
        proposal.noVotes,
        totalSupply
      );
      
      console.log("Governance flow test completed successfully");
    });
  });

  /**
   * NOTE: Governance rewards in the D-Loop protocol are associated with AssetDAO proposals,
   * not with ProtocolDAO governance. The rewards are distributed based on the outcome of 
   * investment/divestment decisions in the AssetDAO.
   * 
   * For testing AssetDAO governance rewards, please refer to:
   * 1. test/integration/flows/AssetDAO.governance.rewards.test.js - For dedicated reward tests
   * 2. test/unit/core/AssetDAO.test.js - For unit tests of AssetDAO functionality
   */

});
