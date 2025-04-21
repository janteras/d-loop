/**
 * @title SoulboundNFT Batch Minting Test Suite
 * @dev Test for the batch minting functionality in the SoulboundNFT contract
 * @notice Tests cover batch size limits and proper token creation
 */
const { ethers } = require("hardhat");
require("../../ethers-v6-shim.enhanced");
const { expect } = require("chai");

describe("SoulboundNFT - Batch Minting", function() {
  // Test variables
  let owner, admin, user1, user2, user3;
  let soulboundNFT;
  
  // Constants
  const ZERO_ADDRESS = ethers.ZeroAddress;
  const TOKEN_URI_BASE = "ipfs://QmBatchHash";
  
  beforeEach(async function() {
    // Get signers for testing
    [owner, admin, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy SoulboundNFT contract
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
  });
  
  describe("Batch Minting Functionality", function() {
    it("should mint multiple tokens in a single batch", async function() {
      // Prepare batch data
      const recipients = [user1.address, user2.address, user3.address];
      const tokenURIs = [
        `${TOKEN_URI_BASE}1`,
        `${TOKEN_URI_BASE}2`,
        `${TOKEN_URI_BASE}3`
      ];
      
      // Execute batch mint
      const tx = await soulboundNFT.connect(admin).batchMint(recipients, tokenURIs);
      const receipt = await tx.wait();
      
      // Verify token count
      expect(await soulboundNFT.getTokenCount()).to.equal(3);
      
      // Verify each recipient received their token
      const user1Tokens = await soulboundNFT.getTokensByOwner(user1.address);
      const user2Tokens = await soulboundNFT.getTokensByOwner(user2.address);
      const user3Tokens = await soulboundNFT.getTokensByOwner(user3.address);
      
      expect(user1Tokens.length).to.equal(1);
      expect(user2Tokens.length).to.equal(1);
      expect(user3Tokens.length).to.equal(1);
      
      // Verify token details
      const token1Details = await soulboundNFT.getTokenDetails(1);
      const token2Details = await soulboundNFT.getTokenDetails(2);
      const token3Details = await soulboundNFT.getTokenDetails(3);
      
      expect(token1Details[0]).to.equal(user1.address); // owner
      expect(token1Details[1]).to.equal(`${TOKEN_URI_BASE}1`); // tokenURI
      expect(token1Details[3]).to.equal(false); // revoked
      
      expect(token2Details[0]).to.equal(user2.address);
      expect(token2Details[1]).to.equal(`${TOKEN_URI_BASE}2`);
      
      expect(token3Details[0]).to.equal(user3.address);
      expect(token3Details[1]).to.equal(`${TOKEN_URI_BASE}3`);
    });
    
    it("should enforce maximum batch size limit", async function() {
      // Get the MAX_BATCH_SIZE from the contract
      const MAX_BATCH_SIZE = await soulboundNFT.MAX_BATCH_SIZE();
      
      // Prepare oversized batch (MAX_BATCH_SIZE + 1)
      const recipients = [];
      const tokenURIs = [];
      
      for (let i = 0; i <= MAX_BATCH_SIZE; i++) {
        recipients.push(user1.address);
        tokenURIs.push(`${TOKEN_URI_BASE}${i}`);
      }
      
      // Test should revert when exceeding the max batch size
      await expect(
        soulboundNFT.connect(admin).batchMint(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(soulboundNFT, "ExceedsBatchLimit");
    });
    
    it("should handle batch size exactly at the limit", async function() {
      // Get the MAX_BATCH_SIZE from the contract
      const MAX_BATCH_SIZE = await soulboundNFT.MAX_BATCH_SIZE();
      console.log(`MAX_BATCH_SIZE: ${MAX_BATCH_SIZE}`);
      
      // Prepare batch exactly at the size limit
      const recipients = [];
      const tokenURIs = [];
      
      for (let i = 0; i < MAX_BATCH_SIZE; i++) {
        recipients.push(user1.address);
        tokenURIs.push(`${TOKEN_URI_BASE}${i}`);
      }
      
      // This should succeed
      await soulboundNFT.connect(admin).batchMint(recipients, tokenURIs);
      
      // Verify token count
      expect(await soulboundNFT.getTokenCount()).to.equal(MAX_BATCH_SIZE);
      
      // Verify user1 received all tokens
      const user1Tokens = await soulboundNFT.getTokensByOwner(user1.address);
      expect(user1Tokens.length).to.equal(MAX_BATCH_SIZE);
    });
    
    it("should revert if arrays have different lengths", async function() {
      // Prepare mismatched arrays
      const recipients = [user1.address, user2.address, user3.address];
      const tokenURIs = [`${TOKEN_URI_BASE}1`, `${TOKEN_URI_BASE}2`]; // One fewer URI
      
      // Test should revert due to mismatched array lengths
      await expect(
        soulboundNFT.connect(admin).batchMint(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(soulboundNFT, "InvalidInput");
    });
    
    it("should revert if any recipient is zero address", async function() {
      // Prepare batch with one zero address
      const recipients = [user1.address, ZERO_ADDRESS, user3.address];
      const tokenURIs = [
        `${TOKEN_URI_BASE}1`,
        `${TOKEN_URI_BASE}2`,
        `${TOKEN_URI_BASE}3`
      ];
      
      // Test should revert due to zero address
      await expect(
        soulboundNFT.connect(admin).batchMint(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(soulboundNFT, "ZeroAddress");
    });
    
    it("should revert if caller doesn't have minter role", async function() {
      // Prepare valid batch data
      const recipients = [user1.address, user2.address];
      const tokenURIs = [`${TOKEN_URI_BASE}1`, `${TOKEN_URI_BASE}2`];
      
      // Test should revert due to caller not having minter role
      await expect(
        soulboundNFT.connect(user1).batchMint(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(soulboundNFT, "Unauthorized");
    });
  });
});