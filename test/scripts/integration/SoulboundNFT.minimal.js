/**
 * @title SoulboundNFT Minimal Test
 * @dev Tests the SoulboundNFT contract with minimal dependencies
 */

const { expect } = require("chai");

// Import ethers from hardhat for better compatibility
const hre = require("hardhat");
const { ethers } = hre;

describe("SoulboundNFT", function() {
  let soulboundNFT;
  let owner, admin, minter, user1, user2;
  
  // Set up constants for our roles
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  
  // Calculate role hashes directly
  function getRoleHash(role) {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(role));
  }
  
  const ADMIN_ROLE = getRoleHash("ADMIN_ROLE");
  const MINTER_ROLE = getRoleHash("MINTER_ROLE");
  
  beforeEach(async function() {
    // Get signers
    const signers = await ethers.getSigners();
    owner = signers[0];
    admin = signers[1];
    minter = signers[2];
    user1 = signers[3];
    user2 = signers[4];
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Grant minter role
    await soulboundNFT.connect(owner).grantMinterRole(minter.address);
  });
  
  describe("Basic Functionality", function() {
    it("should correctly assign roles on deployment", async function() {
      // Default admin role
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      
      // Admin role
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      
      // Minter role
      expect(await soulboundNFT.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });
    
    it("should allow minting tokens", async function() {
      const tokenURI = "ipfs://test-uri";
      
      // Mint a token
      await soulboundNFT.connect(minter).mint(user1.address, tokenURI);
      
      // Verify token exists
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(1);
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.true;
      
      // Check token details
      const tokenId = 1;
      const details = await soulboundNFT.getTokenDetails(tokenId);
      expect(details[0]).to.equal(user1.address); // owner
      expect(details[1]).to.equal(tokenURI); // tokenURI
      expect(details[3]).to.be.false; // not revoked
    });
    
    it("should allow token revocation by admin", async function() {
      // Mint a token
      await soulboundNFT.connect(minter).mint(user1.address, "ipfs://test-uri");
      
      // Admin revokes the token
      await soulboundNFT.connect(admin).revoke(1);
      
      // Verify token is revoked
      expect(await soulboundNFT.isTokenValid(1)).to.be.false;
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.false;
      
      // Token should still exist (it's soulbound)
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(1);
      
      const details = await soulboundNFT.getTokenDetails(1);
      expect(details[3]).to.be.true; // revoked
    });
    
    it("should enforce access control", async function() {
      const tokenURI = "ipfs://test-uri";
      
      // Non-minter should not be able to mint
      await expect(
        soulboundNFT.connect(user1).mint(user2.address, tokenURI)
      ).to.be.reverted;
      
      // First mint a token for testing revocation
      await soulboundNFT.connect(minter).mint(user1.address, tokenURI);
      
      // Non-admin should not be able to revoke
      await expect(
        soulboundNFT.connect(user2).revoke(1)
      ).to.be.reverted;
    });
  });
});