/**
 * @title AINodeRegistry SoulboundNFT Gas Optimization Test
 * @dev Tests gas usage of AINodeRegistry with SoulboundNFT integration
 */

// First include the enhanced ethers shim
require("../utils/ethers-v6-compat.js");

// Then require hardhat and chai
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AINodeRegistry SoulboundNFT Gas Usage", function() {
  let nodeRegistry;
  let soulboundNFT;
  let mockToken;
  let admin, governance, operator1, operator2, operator3;
  
  const STAKE_AMOUNT = ethers.parseEther("100");
  
  beforeEach(async function() {
    [admin, governance, operator1, operator2, operator3] = await ethers.getSigners();
    
    // Deploy mock token
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    nodeRegistry = await AINodeRegistry.deploy(
      admin.address, 
      governance.address, 
      soulboundNFT.target
    );
    
    // Grant minter role to node registry
    await soulboundNFT.connect(admin).grantMinterRole(nodeRegistry.target);
    
    // Mint tokens for operators
    await mockToken.mint(operator1.address, STAKE_AMOUNT);
    await mockToken.mint(operator2.address, STAKE_AMOUNT);
    await mockToken.mint(operator3.address, STAKE_AMOUNT);
    
    // Approve token spending
    await mockToken.connect(operator1).approve(nodeRegistry.target, STAKE_AMOUNT);
    await mockToken.connect(operator2).approve(nodeRegistry.target, STAKE_AMOUNT);
    await mockToken.connect(operator3).approve(nodeRegistry.target, STAKE_AMOUNT);
  });
  
  describe("Gas usage for registration with NFT minting", function() {
    it("should measure gas for first node registration", async function() {
      const nodeType = 1;
      const endpoint = "https://node1.example.com";
      
      // Measure gas for first registration (includes first NFT mint)
      const tx = await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        nodeType,
        endpoint,
        mockToken.target,
        STAKE_AMOUNT
      );
      
      const receipt = await tx.wait();
      console.log(`Gas used for first node registration with NFT mint: ${receipt.gasUsed}`);
      
      // Verify NFT was minted
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
    });
    
    it("should measure gas for subsequent node registrations", async function() {
      // First register node 1
      await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        1,
        "https://node1.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Measure gas for second registration
      const tx = await nodeRegistry.connect(admin).registerNode(
        operator2.address,
        1,
        "https://node2.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      
      const receipt = await tx.wait();
      console.log(`Gas used for second node registration with NFT mint: ${receipt.gasUsed}`);
      
      // Verify both NFTs were minted
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
      expect(await soulboundNFT.hasValidToken(operator2.address)).to.be.true;
    });
  });
  
  describe("Gas usage for deregistration with NFT burning", function() {
    it("should measure gas for node deregistration", async function() {
      // First register a node
      await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        1,
        "https://node1.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      
      // Measure gas for deregistration (includes NFT revocation)
      const tx = await nodeRegistry.connect(admin).deregisterNode(operator1.address);
      
      const receipt = await tx.wait();
      console.log(`Gas used for node deregistration with NFT revocation: ${receipt.gasUsed}`);
      
      // Verify NFT was revoked
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.false;
    });
  });
  
  describe("Comparison with different registration variants", function() {
    it("should compare gas usage between different registration methods", async function() {
      // 1. Register with regular admin function
      const tx1 = await nodeRegistry.connect(admin).registerNode(
        operator1.address,
        1,
        "https://node1.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      const receipt1 = await tx1.wait();
      
      // 2. Register with optimized approval (assuming this variant exists)
      await mockToken.connect(operator2).approve(nodeRegistry.target, STAKE_AMOUNT);
      const tx2 = await nodeRegistry.connect(admin).registerNodeWithOptimizedApproval(
        operator2.address,
        1,
        "https://node2.example.com",
        mockToken.target,
        STAKE_AMOUNT
      );
      const receipt2 = await tx2.wait();
      
      console.log(`Gas comparison:`);
      console.log(`- Regular registration: ${receipt1.gasUsed}`);
      console.log(`- Optimized approval registration: ${receipt2.gasUsed}`);
      console.log(`- Gas savings: ${receipt1.gasUsed - receipt2.gasUsed}`);
      
      // Verify both NFTs were minted
      expect(await soulboundNFT.hasValidToken(operator1.address)).to.be.true;
      expect(await soulboundNFT.hasValidToken(operator2.address)).to.be.true;
    });
  });
});