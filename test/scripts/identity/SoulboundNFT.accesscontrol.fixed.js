/**
 * @title SoulboundNFT AccessControl Integration Test (Fixed)
 * @dev Tests SoulboundNFT contract's AccessControl implementation with Ethers v6 compatibility
 */

const { expect } = require('chai');

// Load enhanced ethers shim for compatibility
require('../../utils/ethers-v6-compat.js');

describe('SoulboundNFT AccessControl', function () {
  let soulboundNFT, owner, admin, minter, user1, user2;
  
  // Role constants
  let ADMIN_ROLE;
  let MINTER_ROLE;
  const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  before(async function () {
    // Get signers
    [owner, admin, minter, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(owner.address);
    await soulboundNFT.waitForDeployment();
    
    // Get role constants directly from contract
    ADMIN_ROLE = await soulboundNFT.ADMIN_ROLE();
    MINTER_ROLE = await soulboundNFT.MINTER_ROLE();
    
    // Setup roles for testing
    await soulboundNFT.connect(owner).grantAdminRole(admin.address);
    await soulboundNFT.connect(owner).grantMinterRole(minter.address);
  });
  
  describe('Role Management', function () {
    it('should correctly set up initial roles in constructor', async function () {
      // Owner should have DEFAULT_ADMIN_ROLE and ADMIN_ROLE
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
      
      // Admin should have ADMIN_ROLE but not DEFAULT_ADMIN_ROLE
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.false;
      
      // Minter should have MINTER_ROLE
      expect(await soulboundNFT.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });
    
    it('should allow granting admin role', async function () {
      // Grant admin role to user1
      await soulboundNFT.connect(owner).grantAdminRole(user1.address);
      
      // Verify user1 has ADMIN_ROLE
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, user1.address)).to.be.true;
      expect(await soulboundNFT.isAdmin(user1.address)).to.be.true;
    });
    
    it('should allow granting and revoking minter role', async function () {
      // Grant minter role to user2
      await soulboundNFT.connect(admin).grantMinterRole(user2.address);
      
      // Verify user2 has MINTER_ROLE
      expect(await soulboundNFT.hasRole(MINTER_ROLE, user2.address)).to.be.true;
      expect(await soulboundNFT.isMinter(user2.address)).to.be.true;
      
      // Revoke minter role from user2
      await soulboundNFT.connect(admin).revokeMinterRole(user2.address);
      
      // Verify user2 no longer has MINTER_ROLE
      expect(await soulboundNFT.hasRole(MINTER_ROLE, user2.address)).to.be.false;
      expect(await soulboundNFT.isMinter(user2.address)).to.be.false;
    });
    
    it('should allow transferring ownership (DEFAULT_ADMIN_ROLE)', async function () {
      // First grant admin role to user1 (in case previous test didn't run)
      if (!(await soulboundNFT.hasRole(ADMIN_ROLE, user1.address))) {
        await soulboundNFT.connect(owner).grantAdminRole(user1.address);
      }
      
      // Transfer ownership to user1
      await soulboundNFT.connect(owner).transferOwnership(user1.address);
      
      // Verify user1 has DEFAULT_ADMIN_ROLE and owner no longer has it
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, user1.address)).to.be.true;
      expect(await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.false;
      
      // Transfer ownership back to owner for other tests
      await soulboundNFT.connect(user1).transferOwnership(owner.address);
    });
    
    it('should prevent non-admins from granting roles', async function () {
      // Make sure user1 doesn't have admin role
      if (await soulboundNFT.hasRole(ADMIN_ROLE, user1.address)) {
        await soulboundNFT.connect(owner).revokeRole(ADMIN_ROLE, user1.address);
      }
      
      // User1 should not be able to grant roles
      await expect(
        soulboundNFT.connect(user1).grantMinterRole(user2.address)
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
    
    it('should prevent non-DEFAULT_ADMIN_ROLE from transferring ownership', async function () {
      // Admin should not be able to transfer ownership
      await expect(
        soulboundNFT.connect(admin).transferOwnership(user1.address)
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
  });
  
  describe('Role-Based Functionality', function () {
    it('should allow minters to mint tokens', async function () {
      // Mint a token as minter
      const tx = await soulboundNFT.connect(minter).mint(user1.address, "ipfs://token-metadata");
      const receipt = await tx.wait();
      
      // Extract token ID from events
      let tokenId;
      for (const log of receipt.logs) {
        try {
          const parsedLog = soulboundNFT.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'TokenMinted') {
            tokenId = parsedLog.args[0];
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      expect(tokenId).to.not.be.undefined;
      
      // Verify token details
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[0]).to.equal(user1.address); // owner
      expect(tokenDetails[1]).to.equal("ipfs://token-metadata"); // tokenURI
      expect(tokenDetails[3]).to.be.false; // revoked
    });
    
    it('should allow admins to revoke tokens', async function () {
      // First mint a token
      const tx = await soulboundNFT.connect(minter).mint(user1.address, "ipfs://token-metadata-revokable");
      const receipt = await tx.wait();
      
      // Extract token ID from events
      let tokenId;
      for (const log of receipt.logs) {
        try {
          const parsedLog = soulboundNFT.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'TokenMinted') {
            tokenId = parsedLog.args[0];
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      expect(tokenId).to.not.be.undefined;
      
      // Revoke the token as admin
      await soulboundNFT.connect(admin).revoke(tokenId);
      
      // Verify token is revoked
      const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
      expect(tokenDetails[3]).to.be.true; // revoked
    });
    
    it('should prevent non-minters from minting tokens', async function () {
      // User1 should not be able to mint tokens
      await expect(
        soulboundNFT.connect(user1).mint(user2.address, "ipfs://token-metadata")
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
    
    it('should prevent non-admins from revoking tokens', async function () {
      // First mint a token
      const tx = await soulboundNFT.connect(minter).mint(user1.address, "ipfs://token-metadata-non-revokable");
      const receipt = await tx.wait();
      
      // Extract token ID from events
      let tokenId;
      for (const log of receipt.logs) {
        try {
          const parsedLog = soulboundNFT.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'TokenMinted') {
            tokenId = parsedLog.args[0];
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      expect(tokenId).to.not.be.undefined;
      
      // User2 should not be able to revoke tokens
      await expect(
        soulboundNFT.connect(user2).revoke(tokenId)
      ).to.be.revertedWithCustomError(soulboundNFT, "AccessControlUnauthorizedAccount");
    });
  });
});