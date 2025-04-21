/**
 * @title SoulboundNFT AccessControl Test
 * @dev Tests the AccessControl implementation in SoulboundNFT contract
 */

const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('SoulboundNFT AccessControl Implementation', function () {
  let deployer, admin, minter, user1, user2;
  let soulboundNFT;
  
  // Constants for roles
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE"));
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  beforeEach(async function () {
    // Get signers
    [deployer, admin, minter, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory('SoulboundNFT');
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    
    // Grant minter role to the minter address
    await soulboundNFT.connect(deployer).grantMinterRole(minter.address);
  });
  
  describe('Role Management', function () {
    it('should set correct roles during deployment', async function () {
      // Deployer should have DEFAULT_ADMIN_ROLE and ADMIN_ROLE
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
      
      // Admin should have ADMIN_ROLE
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
      
      // Minter should have MINTER_ROLE
      expect(await soulboundNFT.hasRole(MINTER_ROLE, minter.address)).to.be.true;
      
      // Helper functions should work correctly
      expect(await soulboundNFT.isAdmin(admin.address)).to.be.true;
      expect(await soulboundNFT.isMinter(minter.address)).to.be.true;
    });
    
    it('should allow admin to grant and revoke minter role', async function () {
      // Admin should be able to grant minter role
      await soulboundNFT.connect(admin).grantMinterRole(user1.address);
      expect(await soulboundNFT.hasRole(MINTER_ROLE, user1.address)).to.be.true;
      
      // Admin should be able to revoke minter role
      await soulboundNFT.connect(admin).revokeMinterRole(user1.address);
      expect(await soulboundNFT.hasRole(MINTER_ROLE, user1.address)).to.be.false;
    });
    
    it('should allow transferring ownership correctly', async function () {
      // Transfer DEFAULT_ADMIN_ROLE to user2
      await soulboundNFT.connect(deployer).transferOwnership(user2.address);
      
      // Verify user2 now has DEFAULT_ADMIN_ROLE
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, user2.address)).to.be.true;
      
      // Verify deployer no longer has DEFAULT_ADMIN_ROLE
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.false;
    });
  });
  
  describe('Token Operations with Role-Based Access', function () {
    it('should allow minter to mint tokens', async function () {
      const tokenURI = 'ipfs://test-token-uri';
      
      // Minter should be able to mint
      await soulboundNFT.connect(minter).mint(user1.address, tokenURI);
      
      // Verify token exists and is assigned to user1
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.true;
      
      // Get token details
      const tokenId = 1; // First token
      const details = await soulboundNFT.getTokenDetails(tokenId);
      
      expect(details[0]).to.equal(user1.address); // owner
      expect(details[1]).to.equal(tokenURI); // tokenURI
      expect(details[3]).to.be.false; // revoked
    });
    
    it('should allow admin to revoke tokens', async function () {
      // First mint a token
      const tokenURI = 'ipfs://test-token-uri';
      await soulboundNFT.connect(minter).mint(user1.address, tokenURI);
      
      // Get token ID
      const tokenId = 1;
      
      // Admin should be able to revoke the token
      await soulboundNFT.connect(admin).revoke(tokenId);
      
      // Verify token is revoked
      expect(await soulboundNFT.isTokenValid(tokenId)).to.be.false;
      
      // User should no longer have a valid token
      expect(await soulboundNFT.hasValidToken(user1.address)).to.be.false;
    });
    
    it('should prevent non-minters from minting tokens', async function () {
      const tokenURI = 'ipfs://test-token-uri';
      
      // User1 should not be able to mint
      await expect(
        soulboundNFT.connect(user1).mint(user2.address, tokenURI)
      ).to.be.revertedWithCustomError(soulboundNFT, 'Unauthorized');
    });
    
    it('should prevent non-admins from revoking tokens', async function () {
      // First mint a token
      const tokenURI = 'ipfs://test-token-uri';
      await soulboundNFT.connect(minter).mint(user1.address, tokenURI);
      
      // Get token ID
      const tokenId = 1;
      
      // User2 should not be able to revoke the token
      await expect(
        soulboundNFT.connect(user2).revoke(tokenId)
      ).to.be.revertedWithCustomError(soulboundNFT, 'CallerNotAdmin');
    });
  });
});