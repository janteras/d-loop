const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProtocolDAO Benchmarks", function() {
  let protocolDAO;
  let admin, proposer, voters;
  const NUM_VOTERS = 100;
  const NUM_PROPOSALS = 5;

  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  before(async function() {
    [admin, proposer, ...voters] = await ethers.getSigners();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await (await ProtocolDAO.deploy(
      admin.address,           // _admin
      voters[0].address,      // _treasury
      86400n,                 // _votingPeriod (1 day)
      172800n,                // _executionDelay (2 days)
      10n                     // _quorum (10%)
    )).waitForDeployment();

    // Note: No need for basic setup as parameters are set in constructor
  });

  describe("Voting System Performance", function() {
    it("should benchmark voting patterns with different number of voters", async function() {
      const results = {
        sequential: [],
        batch10: [],
        batch20: []
      };

      // Create a proposal
      const description = "Benchmark Proposal";
      const tx = await protocolDAO.connect(proposer).createProposal(
        description,
        [await protocolDAO.getAddress()],
        [0n],
        [new ethers.AbiCoder().encode(["uint256"], [20])]
      );
      const proposalId = 1;

      // Test sequential voting
      console.log("Testing sequential voting...");
      for (let i = 0; i < NUM_VOTERS; i++) {
        const voter = voters[i];
        // Set voter as admin to allow voting
        await (await protocolDAO.connect(admin).setAdmin(voter.address)).wait();
        const tx = await protocolDAO.connect(voter).castVote(proposalId, true);
        const gasUsed = await measureGas(tx);
        results.sequential.push(Number(gasUsed));
      }

      // Test voting in batches of 10
      console.log("Testing batch voting (10)...");
      for (let i = 0; i < NUM_VOTERS; i += 10) {
        const batchVoters = voters.slice(i, i + 10);
        // Set batch voters as admins to allow voting
        await Promise.all(
          batchVoters.map(voter =>
            protocolDAO.connect(admin).setAdmin(voter.address)
          )
        );
        const batch = await Promise.all(
          batchVoters.map(async voter => {
            const tx = await protocolDAO.connect(voter).castVote(proposalId + 1, true);
            return tx;
          })
        );
        const gasUsed = await Promise.all(batch.map(tx => measureGas(tx)));
        results.batch10.push(...gasUsed.map(g => Number(g)));
      }

      // Test voting in batches of 20
      console.log("Testing batch voting (20)...");
      for (let i = 0; i < NUM_VOTERS; i += 20) {
        const batchVoters = voters.slice(i, i + 20);
        // Set batch voters as admins to allow voting
        await Promise.all(
          batchVoters.map(voter =>
            protocolDAO.connect(admin).setAdmin(voter.address)
          )
        );
        const batch = await Promise.all(
          batchVoters.map(voter =>
            protocolDAO.connect(voter).castVote(proposalId + 2, true)
          )
        );
        const gasUsed = await Promise.all(batch.map(tx => measureGas(tx)));
        results.batch20.push(...gasUsed.map(g => Number(g)));
      }

      // Calculate and display metrics
      const metrics = {};
      for (const [pattern, gasUsages] of Object.entries(results)) {
        metrics[pattern] = {
          min: Math.min(...gasUsages),
          max: Math.max(...gasUsages),
          avg: gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length,
          total: gasUsages.reduce((a, b) => a + b, 0)
        };
      }

      console.log("Performance Metrics:");
      console.table(metrics);
    });

    it("should benchmark proposal creation with varying complexity", async function() {
      const results = [];

      // Test proposals with different numbers of actions
      for (let i = 1; i <= 5; i++) {
        const targets = Array(i).fill(await protocolDAO.getAddress());
        const values = Array(i).fill(0);
        const signatures = Array(i).fill("setQuorum(uint256)");
        const calldatas = Array(i).fill(
          new ethers.AbiCoder().encode(["uint256"], [20])
        );

        const tx = await protocolDAO.connect(proposer).createProposal(
          `Proposal with ${i} actions`,
          targets,
          values,
          calldatas
        );
        
        const gasUsed = await measureGas(tx);
        results.push({
          actions: i,
          gasUsed: Number(gasUsed)
        });
      }

      console.log("Proposal Creation Gas Usage by Complexity:");
      console.table(results);
    });
  });
});
