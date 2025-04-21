/**
 * @title SoulboundNFT AccessControl Ultra Simple Test
 * @dev Extremely simplified test for AccessControl functionality
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('SoulboundNFT AccessControl', function () {
  let soulboundNFT, owner, admin, minter, user1, user2;
  
  // Use string constants directly for role identification
  const ADMIN_ROLE_STRING = "ADMIN_ROLE";
  const MINTER_ROLE_STRING = "MINTER_ROLE";
  
  beforeEach(async function () {
    // Get signers
    [owner, admin, minter, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT contract
    const SoulboundNFT = await ethers.getContractFactory('SoulboundNFT');
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Grant minter role to the minter account
    await soulboundNFT.connect(admin).grantMinterRole(minter.address);
  });
  
  describe('Basic Role Management', function () {
    it('should correctly set up initial roles', async function () {
      // Owner should be admin
      expect(await soulboundNFT.isAdmin(owner.address)).to.be.true;
      
      // Admin should be admin
      expect(await soulboundNFT.isAdmin(admin.address)).to.be.true;
      
      // Minter should be minter
      expect(await soulboundNFT.isMinter(minter.address)).to.be.true;
    });
    
    it('should allow granting and revoking roles', async function () {
      // Grant minter role to user1
      await soulboundNFT.connect(admin).grantMinterRole(user1.address);
      
      // Verify user1 is a minter
      expect(await soulboundNFT.isMinter(user1.address)).to.be.true;
      
      // Revoke minter role
      await soulboundNFT.connect(admin).revokeMinterRole(user1.address);
      
      // Verify user1 is no longer a minter
      expect(await soulboundNFT.isMinter(user1.address)).to.be.false;
    });
  });
  
  describe('Role-Based Access Control', function () {
    it('should allow minters to mint tokens', async function () {
      // Mint a token as minter
      await soulboundNFT.connect(minter).mint(user1.address, "ipfs://token-metadata");
      
      // Verify user1 has a valid token
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.true;
    });
    
    it('should prevent unauthorized minting', async function () {
      // User1 should not be able to mint tokens
      await expect(
        soulboundNFT.connect(user1).mint(user2.address, "ipfs://token-metadata")
      ).to.be.reverted;
    });
    
    it('should allow admins to mint and revoke tokens', async function () {
      // Admin mints a token
      await soulboundNFT.connect(admin).mint(user1.address, "ipfs://token-metadata");
      
      // Get token ID (should be 1 as it's the first token)
      const tokenId = 1;
      
      // Admin revokes the token
      await soulboundNFT.connect(admin).revoke(tokenId);
      
      // Verify token is revoked
      expect(await soulboundNFT.isTokenValid(tokenId)).to.be.false;
    });
  });
});