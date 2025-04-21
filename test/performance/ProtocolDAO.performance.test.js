const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const PROPOSAL_STATES = {
  PENDING: 0,
  ACTIVE: 1,
  CANCELED: 2,
  DEFEATED: 3,
  SUCCEEDED: 4,
  EXECUTED: 5
};

describe("ProtocolDAO Performance Benchmarks", function() {
  let protocolDAO;
  let admin, proposer, voter1, voter2, voter3;
  let mockToken;
  let snapshotId;

  // Test parameters
  const NUM_PROPOSALS = 5;
  const NUM_VOTES = 10;
  const QUORUM = 10; // 10%
  const VOTING_PERIOD = 5; // 5 blocks

  before(async function() {
    this.timeout(60000); // Extend timeout for setup
    [admin, proposer, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(admin.address);
    await protocolDAO.waitForDeployment();

    // Setup initial state
    await protocolDAO.setQuorum(10); // 10% quorum
    await protocolDAO.setVotingPeriod(5); // 5 blocks voting period
  });

  beforeEach(async function() {
    snapshotId = await ethers.provider.send('evm_snapshot', []);
  });

  afterEach(async function() {
    await ethers.provider.send('evm_revert', [snapshotId]);
  });

  describe("Proposal Creation and Voting Performance", function() {
    it("should benchmark batch proposal creation", async function() {
      console.log('\nBenchmarking Proposal Creation:');
      const proposals = [];
      
      for (let i = 0; i < NUM_PROPOSALS; i++) {
        const description = `Test Proposal ${i}`;
        const targets = [mockToken.address];
        const values = [0];
        const calldatas = [mockToken.interface.encodeFunctionData('transfer', [voter1.address, 100])];

        const tx = await protocolDAO.connect(proposer).propose(
          targets,
          values,
          calldatas,
          description
        );
        const receipt = await tx.wait();
        
        console.log(`Proposal ${i + 1} creation gas used: ${receipt.gasUsed.toString()}`);
        proposals.push(tx);
      }
    });

    it("should benchmark voting performance", async function() {
      console.log('\nBenchmarking Voting Performance:');
      
      // Create a test proposal
      const tx = await protocolDAO.connect(proposer).propose(
        [mockToken.address],
        [0],
        [mockToken.interface.encodeFunctionData('transfer', [voter1.address, 100])],
        'Performance Test Proposal'
      );
      const receipt = await tx.wait();
      const proposalId = receipt.events[0].args.proposalId;

      // Wait for voting delay
      await time.advanceBlock();
      
      console.log(`\nProposal creation gas used: ${receipt.gasUsed.toString()}`);
      
      // Benchmark voting
      const voters = [voter1, voter2, voter3];
      for (let i = 0; i < NUM_VOTES; i++) {
        const voter = voters[i % voters.length];
        const tx = await protocolDAO.connect(voter).castVote(proposalId, true);
        const receipt = await tx.wait();
        console.log(`Vote ${i + 1} gas used: ${receipt.gasUsed.toString()}`);
      }
    });

    it("should benchmark proposal execution", async function() {
      console.log('\nBenchmarking Proposal Execution:');
      
      // Create and pass proposal
      const tx = await protocolDAO.connect(proposer).propose(
        [mockToken.address],
        [0],
        [mockToken.interface.encodeFunctionData('transfer', [voter1.address, 100])],
        'Execution Test Proposal'
      );
      const receipt = await tx.wait();
      const proposalId = receipt.events[0].args.proposalId;

      // Vote on proposal
      await time.advanceBlock();
      await protocolDAO.connect(voter1).castVote(proposalId, true);
      await protocolDAO.connect(voter2).castVote(proposalId, true);
      
      // Advance past voting period
      for (let i = 0; i < VOTING_PERIOD + 1; i++) {
        await time.advanceBlock();
      }

      // Execute proposal
      const execTx = await protocolDAO.execute(
        [mockToken.address],
        [0],
        [mockToken.interface.encodeFunctionData('transfer', [voter1.address, 100])],
        ethers.id('Execution Test Proposal')
      );
      const execReceipt = await execTx.wait();
      
      console.log(`Proposal execution gas used: ${execReceipt.gasUsed.toString()}`);
    });
  });
  
  describe("Voting Pattern Comparison", function() {
    it("should compare gas usage between different voting patterns", async function() {
      // Create a test proposal first
      const tx = await protocolDAO.connect(proposer).propose(
        [mockToken.address],
        [0],
        [mockToken.interface.encodeFunctionData('transfer', [voter1.address, 100])],
        'Voting Pattern Test Proposal'
      );
      const receipt = await tx.wait();
      const proposalId = receipt.events[0].args.proposalId;

      // Wait for voting delay
      await time.advanceBlock();
      
      // Single vote
      const tx1 = await protocolDAO.connect(voter1).castVote(proposalId, true);
      const receipt1 = await tx1.wait();
      console.log("Gas used for single vote:", receipt1.gasUsed.toString());

      // Multiple votes in sequence
      const tx2 = await protocolDAO.connect(voter2).castVote(proposalId, true);
      const receipt2 = await tx2.wait();
      const tx3 = await protocolDAO.connect(voter3).castVote(proposalId, false);
      const receipt3 = await tx3.wait();

      console.log("Average gas for sequential votes:", 
        ((receipt2.gasUsed + receipt3.gasUsed) / 2).toString()
      );
    });
  });

  describe("Queue and Execute Gas Usage", function() {
    it("should measure gas usage for queueing proposals", async function() {
      await ethers.provider.send("evm_mine", []);
      const tx = await protocolDAO.queue(1);
      const receipt = await tx.wait();
      console.log("Gas used for queueing:", receipt.gasUsed.toString());
    });

    it("should measure gas usage for executing proposals", async function() {
      await ethers.provider.send("evm_increaseTime", [172800]); // 2 days
      await ethers.provider.send("evm_mine", []);
      
      const tx = await protocolDAO.execute(1);
      const receipt = await tx.wait();
      console.log("Gas used for execution:", receipt.gasUsed.toString());
    });
  });

  describe("Parameter Updates Gas Usage", function() {
    it("should compare gas usage of different parameter updates", async function() {
      // Update quorum
      const tx1 = await protocolDAO.setQuorum(15);
      const receipt1 = await tx1.wait();
      console.log("Gas used for quorum update:", receipt1.gasUsed.toString());

      // Update voting period
      const tx2 = await protocolDAO.setVotingPeriod(10);
      const receipt2 = await tx2.wait();
      console.log("Gas used for voting period update:", receipt2.gasUsed.toString());
    });
  });
});
