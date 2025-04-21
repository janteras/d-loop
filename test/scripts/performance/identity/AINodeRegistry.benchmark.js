const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AINodeRegistry Performance Benchmarks", function() {
  let aiNodeRegistry;
  let soulboundNFT;
  let admin;
  let nodes;

  async function measureGas(tx) {
    const receipt = await tx.wait();
    return receipt.gasUsed;
  }

  before(async function() {
    [admin, ...nodes] = await ethers.getSigners();
    
    // Deploy SoulboundNFT first
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await (await SoulboundNFT.deploy(admin.address)).waitForDeployment();

    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await (await AINodeRegistry.deploy(
      admin.address,
      admin.address, // governance contract
      await soulboundNFT.getAddress()
    )).waitForDeployment();

    // Set AINodeRegistry as minter in SoulboundNFT
    const MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    await (await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, await aiNodeRegistry.getAddress())).wait();
  });

  describe("Node Registration Performance", function() {
    it("should benchmark node registration process", async function() {
      const results = {
        registration: [],
        verification: [],
        statusUpdate: []
      };

      const NUM_NODES = 10;
      const METADATA_URI = "ipfs://QmTest";
      
      console.log("\\nTesting node registration...");
      for (let i = 0; i < NUM_NODES; i++) {
        const tx = await aiNodeRegistry.connect(nodes[i]).registerNode(
          nodes[i].address,
          nodes[i].address,
          METADATA_URI
        );
        const gasUsed = await measureGas(tx);
        results.registration.push(Number(gasUsed));
      }

      console.log("\\nTesting node verification...");
      for (let i = 0; i < NUM_NODES; i++) {
        const tx = await aiNodeRegistry.connect(admin).verifyNodeIdentity(
          nodes[i].address,
          true
        );
        const gasUsed = await measureGas(tx);
        results.verification.push(Number(gasUsed));
      }

      console.log("\\nTesting status updates...");
      for (let i = 0; i < NUM_NODES; i++) {
        const tx = await aiNodeRegistry.connect(nodes[i]).updateNodeStatus(
          true // active
        );
        const gasUsed = await measureGas(tx);
        results.statusUpdate.push(Number(gasUsed));
      }

      // Calculate and display metrics
      const avgRegistration = results.registration.reduce((a, b) => a + b, 0) / NUM_NODES;
      const avgVerification = results.verification.reduce((a, b) => a + b, 0) / NUM_NODES;
      const avgStatusUpdate = results.statusUpdate.reduce((a, b) => a + b, 0) / NUM_NODES;
      
      console.log("\\nPerformance Metrics:");
      console.log("Average Registration Gas:", avgRegistration);
      console.log("Average Verification Gas:", avgVerification);
      console.log("Average Status Update Gas:", avgStatusUpdate);
      console.log("Total Flow Gas Cost:", avgRegistration + avgVerification + avgStatusUpdate);
    });

    it("should benchmark node query performance", async function() {
      const results = {
        getDetails: [],
        getAllNodes: []
      };

      const NUM_QUERIES = 10;
      
      console.log("\\nTesting getNodeDetails queries...");
      for (let i = 0; i < NUM_QUERIES; i++) {
        const startTime = process.hrtime.bigint();
        await aiNodeRegistry.getNodeDetails(nodes[i].address);
        const endTime = process.hrtime.bigint();
        results.getDetails.push(Number(endTime - startTime));
      }

      console.log("\\nTesting getAllNodeAddresses queries...");
      for (let i = 0; i < NUM_QUERIES; i++) {
        const startTime = process.hrtime.bigint();
        await aiNodeRegistry.getAllNodeAddresses();
        const endTime = process.hrtime.bigint();
        results.getAllNodes.push(Number(endTime - startTime));
      }

      // Calculate and display metrics
      const avgDetailsTime = results.getDetails.reduce((a, b) => a + b, 0) / NUM_QUERIES;
      const avgAllNodesTime = results.getAllNodes.reduce((a, b) => a + b, 0) / NUM_QUERIES;
      
      console.log("\\nQuery Performance Metrics (nanoseconds):");
      console.log("Average getNodeDetails Time:", avgDetailsTime);
      console.log("Average getAllNodeAddresses Time:", avgAllNodesTime);
    });
  });
});
