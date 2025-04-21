/**
 * @title SoulboundNFT Contract Test Suite
 * @dev Comprehensive tests for the SoulboundNFT smart contract
 * @notice Tests cover all core functionality, edge cases, and backward compatibility
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');
const { expect } = require("chai");

describe("SoulboundNFT", function() {
  // Test variables
  let owner, admin, user1, user2, user3;
  let soulboundNFT;
  
  // Constants
  const ZERO_ADDRESS = ethers.ZeroAddress;
  const TOKEN_URI_1 = "ipfs://QmSampleHash1";
  const TOKEN_URI_2 = "ipfs://QmSampleHash2";
  const UPDATED_TOKEN_URI = "ipfs://QmUpdatedHash";
  
  beforeEach(async function() {
    // Get signers for testing
    [owner, admin, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy SoulboundNFT contract
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
  });
  
  describe("Deployment", function() {
    it("should set the correct owner and admin", async function() {
      expect(await soulboundNFT.owner()).to.equal(owner.address);
      expect(await soulboundNFT.admin()).to.equal(admin.address);
    });
    
    it("should revert if zero address is provided for admin", async function() {
      const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
      await expect(
        SoulboundNFT.deploy(ZERO_ADDRESS)
      ).to.be.revertedWith("Invalid address");
    });
    
    it("should initialize token counter to zero", async function() {
      expect(await soulboundNFT.getTokenCount()).to.equal(0);
    });
  });
  
  describe("Token Minting", function() {
    it("should allow admin to mint tokens", async function() {
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Check token count
      expect(await soulboundNFT.getTokenCount()).to.equal(1);
      
      // Check token ownership
      const tokensByOwner = await soulboundNFT.getTokensByOwner(user1.address);
      expect(tokensByOwner.length).to.equal(1);
      expect(tokensByOwner[0]).to.equal(1); // First token ID
    });
    
    it("should allow owner to mint tokens", async function() {
      await soulboundNFT.connect(owner).mint(user1.address, TOKEN_URI_1);
      
      // Check token count
      expect(await soulboundNFT.getTokenCount()).to.equal(1);
    });
    
    it("should revert if unauthorized user tries to mint", async function() {
      await expect(
        soulboundNFT.connect(user1).mint(user2.address, TOKEN_URI_1)
      ).to.be.reverted;
    });
    
    it("should revert if minting to zero address", async function() {
      await expect(
        soulboundNFT.connect(admin).mint(ZERO_ADDRESS, TOKEN_URI_1)
      ).to.be.reverted;
    });
    
    it("should emit TokenMinted event", async function() {
      await expect(
        soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1)
      ).to.emit(soulboundNFT, "TokenMinted")
       .withArgs(1, user1.address, TOKEN_URI_1);
    });
    
    it("should allow minting multiple tokens to the same address", async function() {
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_2);
      
      // Check token count
      expect(await soulboundNFT.getTokenCount()).to.equal(2);
      
      // Check tokens by owner
      const tokens = await soulboundNFT.getTokensByOwner(user1.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1);
      expect(tokens[1]).to.equal(2);
    });
    
    it("should store correct token metadata", async function() {
      const timestamp = (await ethers.provider.getBlock('latest')).timestamp;
      
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Get token details
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      
      // Check details
      expect(tokenDetails.owner).to.equal(user1.address);
      expect(tokenDetails.tokenURI).to.equal(TOKEN_URI_1);
      expect(tokenDetails.revoked).to.be.false;
      
      // Check timestamp approximately (allow small difference due to mining time)
      const mintedAt = Number(tokenDetails.mintedAt);
      expect(mintedAt).to.be.closeTo(timestamp + 1, 5);
    });
  });
  
  describe("Token Revocation", function() {
    beforeEach(async function() {
      // Mint tokens for testing
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      await soulboundNFT.connect(admin).mint(user2.address, TOKEN_URI_2);
    });
    
    it("should allow admin to revoke tokens", async function() {
      await soulboundNFT.connect(admin).revoke(1);
      
      // Check token status
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.revoked).to.be.true;
    });
    
    it("should allow owner to revoke tokens", async function() {
      await soulboundNFT.connect(owner).revoke(1);
      
      // Check token status
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.revoked).to.be.true;
    });
    
    it("should revert if unauthorized user tries to revoke", async function() {
      await expect(
        soulboundNFT.connect(user1).revoke(1)
      ).to.be.reverted;
    });
    
    it("should revert if token doesn't exist", async function() {
      await expect(
        soulboundNFT.connect(admin).revoke(999)
      ).to.be.reverted;
    });
    
    it("should revert if token is already revoked", async function() {
      // First revoke
      await soulboundNFT.connect(admin).revoke(1);
      
      // Try to revoke again
      await expect(
        soulboundNFT.connect(admin).revoke(1)
      ).to.be.reverted;
    });
    
    it("should emit TokenRevoked event", async function() {
      await expect(
        soulboundNFT.connect(admin).revoke(1)
      ).to.emit(soulboundNFT, "TokenRevoked")
       .withArgs(1, user1.address);
    });
    
    it("should consider revoked tokens as invalid", async function() {
      // Initially the token is valid
      expect(await soulboundNFT.isTokenValid(1)).to.be.true;
      
      // After revocation, it should be invalid
      await soulboundNFT.connect(admin).revoke(1);
      expect(await soulboundNFT.isTokenValid(1)).to.be.false;
    });
  });
  
  describe("Token URI Updates", function() {
    beforeEach(async function() {
      // Mint token for testing
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
    });
    
    it("should allow admin to update token URI", async function() {
      await soulboundNFT.connect(admin).updateTokenURI(1, UPDATED_TOKEN_URI);
      
      // Check updated URI
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.tokenURI).to.equal(UPDATED_TOKEN_URI);
    });
    
    it("should allow owner to update token URI", async function() {
      await soulboundNFT.connect(owner).updateTokenURI(1, UPDATED_TOKEN_URI);
      
      // Check updated URI
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.tokenURI).to.equal(UPDATED_TOKEN_URI);
    });
    
    it("should revert if unauthorized user tries to update URI", async function() {
      await expect(
        soulboundNFT.connect(user1).updateTokenURI(1, UPDATED_TOKEN_URI)
      ).to.be.reverted;
    });
    
    it("should revert if token doesn't exist", async function() {
      await expect(
        soulboundNFT.connect(admin).updateTokenURI(999, UPDATED_TOKEN_URI)
      ).to.be.reverted;
    });
    
    it("should revert if token is revoked", async function() {
      // First revoke the token
      await soulboundNFT.connect(admin).revoke(1);
      
      // Try to update URI
      await expect(
        soulboundNFT.connect(admin).updateTokenURI(1, UPDATED_TOKEN_URI)
      ).to.be.reverted;
    });
    
    it("should emit TokenURIUpdated event", async function() {
      await expect(
        soulboundNFT.connect(admin).updateTokenURI(1, UPDATED_TOKEN_URI)
      ).to.emit(soulboundNFT, "TokenURIUpdated")
       .withArgs(1, TOKEN_URI_1, UPDATED_TOKEN_URI);
    });
  });
  
  describe("Token Querying", function() {
    beforeEach(async function() {
      // Mint multiple tokens for testing
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_2);
      await soulboundNFT.connect(admin).mint(user2.address, TOKEN_URI_1);
    });
    
    it("should correctly return tokens owned by an address", async function() {
      // Check user1's tokens
      const user1Tokens = await soulboundNFT.getTokensByOwner(user1.address);
      expect(user1Tokens.length).to.equal(2);
      expect(user1Tokens[0]).to.equal(1);
      expect(user1Tokens[1]).to.equal(2);
      
      // Check user2's tokens
      const user2Tokens = await soulboundNFT.getTokensByOwner(user2.address);
      expect(user2Tokens.length).to.equal(1);
      expect(user2Tokens[0]).to.equal(3);
      
      // Check user3's tokens (should be empty)
      const user3Tokens = await soulboundNFT.getTokensByOwner(user3.address);
      expect(user3Tokens.length).to.equal(0);
    });
    
    it("should correctly check if an address has valid tokens", async function() {
      // Initially all users with tokens should have valid tokens
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.true;
      expect(await soulboundNFT.hasValidToken(user2.address)).to.be.true;
      expect(await soulboundNFT.hasValidToken(user3.address)).to.be.false;
      
      // Revoke all of user1's tokens
      await soulboundNFT.connect(admin).revoke(1);
      await soulboundNFT.connect(admin).revoke(2);
      
      // Check validity again
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.false;
      expect(await soulboundNFT.hasValidToken(user2.address)).to.be.true;
    });
    
    it("should correctly report token validity status", async function() {
      // Initially all tokens should be valid
      expect(await soulboundNFT.isTokenValid(1)).to.be.true;
      expect(await soulboundNFT.isTokenValid(2)).to.be.true;
      expect(await soulboundNFT.isTokenValid(3)).to.be.true;
      
      // Non-existent token should be invalid
      expect(await soulboundNFT.isTokenValid(999)).to.be.false;
      
      // Revoke token #2
      await soulboundNFT.connect(admin).revoke(2);
      
      // Check validity again
      expect(await soulboundNFT.isTokenValid(1)).to.be.true;
      expect(await soulboundNFT.isTokenValid(2)).to.be.false;
      expect(await soulboundNFT.isTokenValid(3)).to.be.true;
    });
  });
  
  describe("Administrative Functions", function() {
    it("should allow owner to update admin", async function() {
      await soulboundNFT.connect(owner).updateAdmin(user1.address);
      expect(await soulboundNFT.admin()).to.equal(user1.address);
    });
    
    it("should not allow non-owner to update admin", async function() {
      await expect(
        soulboundNFT.connect(admin).updateAdmin(user1.address)
      ).to.be.reverted;
    });
    
    it("should revert when updating admin to zero address", async function() {
      await expect(
        soulboundNFT.connect(owner).updateAdmin(ZERO_ADDRESS)
      ).to.be.reverted;
    });
    
    it("should emit AdminUpdated event when updating admin", async function() {
      await expect(
        soulboundNFT.connect(owner).updateAdmin(user1.address)
      ).to.emit(soulboundNFT, "AdminUpdated")
       .withArgs(admin.address, user1.address);
    });
    
    it("should allow owner to transfer ownership", async function() {
      await soulboundNFT.connect(owner).transferOwnership(user1.address);
      expect(await soulboundNFT.owner()).to.equal(user1.address);
    });
    
    it("should not allow non-owner to transfer ownership", async function() {
      await expect(
        soulboundNFT.connect(admin).transferOwnership(user1.address)
      ).to.be.reverted;
    });
    
    it("should revert when transferring ownership to zero address", async function() {
      await expect(
        soulboundNFT.connect(owner).transferOwnership(ZERO_ADDRESS)
      ).to.be.reverted;
    });
    
    it("should emit OwnershipTransferred event when transferring ownership", async function() {
      await expect(
        soulboundNFT.connect(owner).transferOwnership(user1.address)
      ).to.emit(soulboundNFT, "OwnershipTransferred")
       .withArgs(owner.address, user1.address);
    });
  });
  
  describe("Non-transferability", function() {
    // This section is for illustrating the soulbound nature, though we can't directly test it
    // since the tokens don't implement transfer functions.
    
    it("should maintain token ownership after minting", async function() {
      // Mint a token
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Check ownership
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.owner).to.equal(user1.address);
      
      // Since the contract doesn't implement transfer functions,
      // the token is effectively soulbound to user1
    });
  });
  
  describe("Delegation", function() {
    let futureTime;
    
    beforeEach(async function() {
      // Mint tokens for testing
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Set up future expiry time (1 hour from now)
      const currentTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
      futureTime = currentTimestamp + 3600; // 1 hour later
    });
    
    it("Allows temporary delegation with expiry", async function() {
      // User1 delegates to user2
      await soulboundNFT.connect(user1).delegateVote(user2.address, futureTime);
      
      // Check delegation is correctly recorded with expiry
      const expiry = await soulboundNFT.delegatedUntil(user1.address, user2.address);
      expect(expiry).to.equal(futureTime);
    });
    
    it("Returns zero for expired delegations", async function() {
      // Set up an expiry time in the past
      const pastTime = (await ethers.provider.getBlock('latest')).timestamp - 100;
      
      // Cannot directly set past expiry through the contract, so we'll manipulate time
      // Instead, we'll use a short expiry and then advance time
      const shortExpiryTime = (await ethers.provider.getBlock('latest')).timestamp + 10;
      
      // User1 delegates to user2 with short expiry
      await soulboundNFT.connect(user1).delegateVote(user2.address, shortExpiryTime);
      
      // Mine blocks to advance time
      await ethers.provider.send("evm_increaseTime", [20]); // Advance 20 seconds
      await ethers.provider.send("evm_mine");
      
      // Check delegation is correctly expired
      const expiry = await soulboundNFT.delegatedUntil(user1.address, user2.address);
      expect(expiry).to.equal(0); // Should return 0 for expired delegation
    });
    
    it("Requires a valid token to delegate", async function() {
      // User3 doesn't have a token
      await expect(
        soulboundNFT.connect(user3).delegateVote(user2.address, futureTime)
      ).to.be.reverted;
    });
    
    it("Rejects delegation to zero address", async function() {
      await expect(
        soulboundNFT.connect(user1).delegateVote(ethers.ZeroAddress, futureTime)
      ).to.be.reverted;
    });
    
    it("Rejects delegation with past expiry time", async function() {
      const pastTime = (await ethers.provider.getBlock('latest')).timestamp - 100;
      
      await expect(
        soulboundNFT.connect(user1).delegateVote(user2.address, pastTime)
      ).to.be.reverted;
    });
    
    it("Emits VoteDelegated event on successful delegation", async function() {
      await expect(
        soulboundNFT.connect(user1).delegateVote(user2.address, futureTime)
      ).to.emit(soulboundNFT, "VoteDelegated")
       .withArgs(user1.address, user2.address, futureTime);
    });
  });
  
  describe("Interface Compatibility", function() {
    it("should be compatible with ISoulboundNFT interface", async function() {
      // This test demonstrates that our implementation has the core functionality
      // expected by the ISoulboundNFT interface, even if the function names differ
      
      // Test mint function (compatible with ISoulboundNFT.mint)
      const tokenId = await soulboundNFT.connect(admin).callStatic.mint(user1.address, TOKEN_URI_1);
      expect(tokenId).to.equal(1);
      
      // Actually perform the mint
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Our implementation uses revoke instead of burn, but functionality is similar
      // Test revoke function (similar to ISoulboundNFT.burn functionality)
      await soulboundNFT.connect(admin).revoke(1);
      expect(await soulboundNFT.isTokenValid(1)).to.be.false;
    });
  });
  
  describe("Backward Compatibility", function() {
    it("should maintain legacy behavior expected by existing systems", async function() {
      // Mint a token
      await soulboundNFT.connect(admin).mint(user1.address, TOKEN_URI_1);
      
      // Legacy systems would expect this token to be valid
      expect(await soulboundNFT.isTokenValid(1)).to.be.true;
      
      // Legacy systems would expect this user to have a valid token
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.true;
      
      // Legacy systems would expect this token to have the correct owner
      const tokenDetails = await soulboundNFT.getTokenDetails(1);
      expect(tokenDetails.owner).to.equal(user1.address);
      
      // After revocation, legacy systems would expect this token to be invalid
      await soulboundNFT.connect(admin).revoke(1);
      expect(await soulboundNFT.isTokenValid(1)).to.be.false;
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.false;
    });
  });
});