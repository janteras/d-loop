/**
 * @title AINodeRegistry SoulboundNFT Gas Profile Test
 * @dev Tests the gas usage of AINodeRegistry with SoulboundNFT integration
 */

const { ethers } = require('ethers');
const { expect } = require('chai');

// Load ethers v6 compatibility shim
require('../../ethers-v6-shim.super');

function parseUnits(value, decimals = 18) {
  return ethers.parseUnits(value.toString(), decimals);
}

describe('AINodeRegistry SoulboundNFT Gas Usage', function () {
  let owner, admin, governance, user1, user2;
  let soulboundNFT, aiNodeRegistry;
  let mockDloopToken;
  
  const INITIAL_STAKE = parseUnits('1000');

  beforeEach(async function () {
    // Get signers
    [owner, admin, governance, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory('SoulboundNFT');
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    
    // Deploy Mock DLoop Token for staking tests
    const MockToken = await ethers.getContractFactory('MockToken');
    mockDloopToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory('AINodeRegistry');
    aiNodeRegistry = await AINodeRegistry.deploy(
      admin.address,
      governance.address,
      await soulboundNFT.getAddress()
    );
    
    // Grant roles
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, await aiNodeRegistry.getAddress());
    
    // Fund users with tokens
    await mockDloopToken.mint(user1.address, INITIAL_STAKE);
    await mockDloopToken.mint(user2.address, INITIAL_STAKE);
    
    // Approve token spending
    await mockDloopToken.connect(user1).approve(await aiNodeRegistry.getAddress(), INITIAL_STAKE);
    await mockDloopToken.connect(user2).approve(await aiNodeRegistry.getAddress(), INITIAL_STAKE);
  });
  
  describe('Gas Usage for Node Registration', function () {
    it('should measure gas for admin node registration', async function () {
      const nodeMetadata = JSON.stringify({
        nodeEndpoint: "https://example.com/node1",
        nodeOperator: user1.address,
        nodeVersion: "1.0.0",
        supportedModels: ["gpt-4", "gpt-3.5-turbo"],
        region: "us-east-1"
      });
      
      // Measure gas usage
      const tx = await aiNodeRegistry.connect(admin).registerNodeByAdmin(
        user1.address,
        user1.address,
        nodeMetadata
      );
      
      const receipt = await tx.wait();
      console.log(`Gas used for admin node registration: ${receipt.gasUsed.toString()}`);
      
      // Verify SoulboundNFT was minted
      const nodeDetails = await aiNodeRegistry.getNodeDetails(user1.address);
      expect(nodeDetails.exists).to.be.true;
      expect(nodeDetails.soulboundTokenId).to.be.gt(0);
    });
    
    it('should measure gas for node registration with staking', async function () {
      const nodeMetadata = JSON.stringify({
        nodeEndpoint: "https://example.com/node2",
        nodeOperator: user2.address,
        nodeVersion: "1.0.0",
        supportedModels: ["gpt-4", "gpt-3.5-turbo"],
        region: "us-east-2"
      });
      
      const stakeAmount = parseUnits('100');
      
      // Measure gas usage
      const tx = await aiNodeRegistry.connect(user2).registerNode(
        user2.address,
        await mockDloopToken.getAddress(),
        stakeAmount,
        nodeMetadata
      );
      
      const receipt = await tx.wait();
      console.log(`Gas used for node registration with staking: ${receipt.gasUsed.toString()}`);
      
      // Verify SoulboundNFT was minted
      const nodeDetails = await aiNodeRegistry.getNodeDetails(user2.address);
      expect(nodeDetails.exists).to.be.true;
      expect(nodeDetails.soulboundTokenId).to.be.gt(0);
    });
  });
  
  describe('Gas Usage for Node Deregistration', function () {
    it('should measure gas for node deregistration with SoulboundNFT revocation', async function () {
      // First register a node
      const nodeMetadata = JSON.stringify({
        nodeEndpoint: "https://example.com/node3",
        nodeOperator: user1.address,
        nodeVersion: "1.0.0"
      });
      
      await aiNodeRegistry.connect(admin).registerNodeByAdmin(
        user1.address,
        user1.address,
        nodeMetadata
      );
      
      // Verify node and SoulboundNFT exist
      const nodeDetails = await aiNodeRegistry.getNodeDetails(user1.address);
      expect(nodeDetails.exists).to.be.true;
      
      // Measure gas for deregistration
      const tx = await aiNodeRegistry.connect(user1).deregisterNodeWithRefund();
      const receipt = await tx.wait();
      console.log(`Gas used for node deregistration with NFT revocation: ${receipt.gasUsed.toString()}`);
      
      // Verify node is deregistered and SoulboundNFT is revoked
      const nodeDetailsAfter = await aiNodeRegistry.getNodeDetails(user1.address);
      expect(nodeDetailsAfter.exists).to.be.false;
      
      const tokenDetails = await soulboundNFT.getTokenDetails(nodeDetails.soulboundTokenId);
      expect(tokenDetails[3]).to.be.true; // revoked
    });
  });
});