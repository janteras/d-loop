/**
 * @title SoulboundNFT Role Integration Test
 * @dev Comprehensive integration test for SoulboundNFT role management
 * 
 * This test suite verifies:
 * 1. Proper role assignment during deployment
 * 2. Role-based access control for all key functions
 * 3. Role management operations (grant, revoke, renounce)
 * 4. Integration compatibility with AINodeRegistry
 */

const { ethers } = require('ethers');
const { expect } = require('chai');
const deployer = require('../utils/direct-contract-deployer');

// Constants
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
const METADATA_ROLE = ethers.keccak256(ethers.toUtf8Bytes("METADATA_ROLE"));
const UPGRADER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE"));
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Test data
const TEST_URI = "ipfs://QmTest";
const NODE_DATA = {
  name: "Test Node",
  endpoint: "https://test-node.example.com",
  capacity: 100,
  certificateExpiry: Math.floor(Date.now() / 1000) + 31536000, // 1 year from now
  location: "Test Location",
  specifications: "Test Specifications"
};

describe("SoulboundNFT Role Integration", function() {
  let provider;
  let owner, admin, user, unauthorized;
  let soulboundNFT, mockToken, aiNodeRegistry;
  
  before(async function() {
    // Initialize provider and signers
    provider = deployer.createProvider();
    
    // Need to get signers with proper compatibility for ethers v6
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    // Use the first few accounts for different roles
    owner = provider.getSigner(0);
    admin = provider.getSigner(1);
    user = provider.getSigner(2);
    unauthorized = provider.getSigner(3);
    
    // Get addresses for easier assertions
    const ownerAddress = await owner.getAddress();
    const adminAddress = await admin.getAddress();
    const userAddress = await user.getAddress();
    const unauthorizedAddress = await unauthorized.getAddress();
    
    console.log("Test accounts:");
    console.log(`Owner: ${ownerAddress}`);
    console.log(`Admin: ${adminAddress}`);
    console.log(`User: ${userAddress}`);
    console.log(`Unauthorized: ${unauthorizedAddress}`);
    
    // Deploy contracts
    console.log("\nDeploying contracts for role integration tests...");
    
    // Deploy SoulboundNFT with owner as the admin
    soulboundNFT = await deployer.deployContract('SoulboundNFT', owner, [adminAddress]);
    console.log(`SoulboundNFT deployed at: ${await soulboundNFT.getAddress()}`);
    
    // Deploy MockToken for AINodeRegistry
    mockToken = await deployer.deployContract('MockToken', owner, ["DLOOP Test Token", "DTEST", 18]);
    console.log(`MockToken deployed at: ${await mockToken.getAddress()}`);
    
    // Deploy AINodeRegistry
    aiNodeRegistry = await deployer.deployContract('AINodeRegistry', owner, [
      adminAddress,
      await mockToken.getAddress(),
      await soulboundNFT.getAddress()
    ]);
    console.log(`AINodeRegistry deployed at: ${await aiNodeRegistry.getAddress()}`);
  });
  
  describe("Initial Role Configuration", function() {
    it("should correctly assign DEFAULT_ADMIN_ROLE to admin", async function() {
      const adminAddress = await admin.getAddress();
      const hasRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
      expect(hasRole).to.be.true;
    });
    
    it("should correctly grant roles directly", async function() {
      const adminAddress = await admin.getAddress();
      
      // Admin should have the admin role
      const hasAdminRole = await soulboundNFT.hasRole(ADMIN_ROLE, adminAddress);
      expect(hasAdminRole).to.be.true;
      
      // Roles should be properly separated
      const soulboundNFTAddress = await soulboundNFT.getAddress();
      expect(await soulboundNFT.hasRole(MINTER_ROLE, adminAddress)).to.be.true;
      expect(await soulboundNFT.hasRole(BURNER_ROLE, adminAddress)).to.be.true;
      expect(await soulboundNFT.hasRole(METADATA_ROLE, adminAddress)).to.be.true;
      
      // Verify that the unauthorized account doesn't have any roles
      const unauthorizedAddress = await unauthorized.getAddress();
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, unauthorizedAddress)).to.be.false;
      expect(await soulboundNFT.hasRole(MINTER_ROLE, unauthorizedAddress)).to.be.false;
    });
    
    it("should correctly identify role admins", async function() {
      // Each role's admin should be DEFAULT_ADMIN_ROLE
      expect(await soulboundNFT.getRoleAdmin(MINTER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      expect(await soulboundNFT.getRoleAdmin(ADMIN_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      expect(await soulboundNFT.getRoleAdmin(BURNER_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      expect(await soulboundNFT.getRoleAdmin(METADATA_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
      expect(await soulboundNFT.getRoleAdmin(DEFAULT_ADMIN_ROLE)).to.equal(DEFAULT_ADMIN_ROLE);
    });
  });
  
  describe("Role Management", function() {
    it("should allow admin to grant roles", async function() {
      const userAddress = await user.getAddress();
      
      // Admin grants MINTER_ROLE to user
      const soulboundNFTWithAdmin = soulboundNFT.connect(admin);
      await soulboundNFTWithAdmin.grantRole(MINTER_ROLE, userAddress);
      
      // Verify role assignment
      expect(await soulboundNFT.hasRole(MINTER_ROLE, userAddress)).to.be.true;
    });
    
    it("should prevent unauthorized accounts from granting roles", async function() {
      const userAddress = await user.getAddress();
      const ownerAddress = await owner.getAddress();
      
      // User tries to grant ADMIN_ROLE to owner (should fail)
      const soulboundNFTWithUser = soulboundNFT.connect(user);
      
      await expect(
        soulboundNFTWithUser.grantRole(ADMIN_ROLE, ownerAddress)
      ).to.be.revertedWithCustomError(
        soulboundNFT,
        "AccessControlUnauthorizedAccount"
      );
      
      // Verify role was not assigned
      expect(await soulboundNFT.hasRole(ADMIN_ROLE, ownerAddress)).to.be.false;
    });
    
    it("should allow admin to revoke roles", async function() {
      const userAddress = await user.getAddress();
      
      // Admin revokes MINTER_ROLE from user
      const soulboundNFTWithAdmin = soulboundNFT.connect(admin);
      await soulboundNFTWithAdmin.revokeRole(MINTER_ROLE, userAddress);
      
      // Verify role revocation
      expect(await soulboundNFT.hasRole(MINTER_ROLE, userAddress)).to.be.false;
    });
    
    it("should allow accounts to renounce their own roles", async function() {
      const adminAddress = await admin.getAddress();
      
      // Admin has BURNER_ROLE
      expect(await soulboundNFT.hasRole(BURNER_ROLE, adminAddress)).to.be.true;
      
      // Admin renounces BURNER_ROLE
      const soulboundNFTWithAdmin = soulboundNFT.connect(admin);
      await soulboundNFTWithAdmin.renounceRole(BURNER_ROLE, adminAddress);
      
      // Verify role was renounced
      expect(await soulboundNFT.hasRole(BURNER_ROLE, adminAddress)).to.be.false;
    });
  });
  
  describe("Integration with AINodeRegistry", function() {
    it("should grant MINTER_ROLE to AINodeRegistry", async function() {
      const aiNodeRegistryAddress = await aiNodeRegistry.getAddress();
      
      // Admin grants MINTER_ROLE to AINodeRegistry
      const soulboundNFTWithAdmin = soulboundNFT.connect(admin);
      await soulboundNFTWithAdmin.grantRole(MINTER_ROLE, aiNodeRegistryAddress);
      
      // Verify role assignment
      expect(await soulboundNFT.hasRole(MINTER_ROLE, aiNodeRegistryAddress)).to.be.true;
    });
    
    it("should allow AINodeRegistry to mint tokens when it has MINTER_ROLE", async function() {
      const userAddress = await user.getAddress();
      
      // AINodeRegistry should have MINTER_ROLE
      const aiNodeRegistryAddress = await aiNodeRegistry.getAddress();
      expect(await soulboundNFT.hasRole(MINTER_ROLE, aiNodeRegistryAddress)).to.be.true;
      
      // Admin registers a node, which should mint a token
      const adminConnectedRegistry = aiNodeRegistry.connect(admin);
      await adminConnectedRegistry.registerNodeByAdmin(
        userAddress,
        NODE_DATA.name,
        NODE_DATA.endpoint,
        NODE_DATA.capacity,
        NODE_DATA.certificateExpiry,
        NODE_DATA.location,
        NODE_DATA.specifications
      );
      
      // Verify token was minted and assigned
      const tokenId = await soulboundNFT.tokenOfOwner(userAddress);
      expect(Number(tokenId)).to.be.greaterThan(0);
      
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner.toLowerCase()).to.equal(userAddress.toLowerCase());
    });
    
    it("should prevent AINodeRegistry from minting when MINTER_ROLE is revoked", async function() {
      // Create another user for this test
      const anotherUser = provider.getSigner(4);
      const anotherUserAddress = await anotherUser.getAddress();
      
      // Admin revokes MINTER_ROLE from AINodeRegistry
      const soulboundNFTWithAdmin = soulboundNFT.connect(admin);
      const aiNodeRegistryAddress = await aiNodeRegistry.getAddress();
      await soulboundNFTWithAdmin.revokeRole(MINTER_ROLE, aiNodeRegistryAddress);
      
      // Verify role revocation
      expect(await soulboundNFT.hasRole(MINTER_ROLE, aiNodeRegistryAddress)).to.be.false;
      
      // Admin tries to register another node (should fail the NFT minting part)
      const adminConnectedRegistry = aiNodeRegistry.connect(admin);
      
      try {
        await adminConnectedRegistry.registerNodeByAdmin(
          anotherUserAddress,
          "Another Node",
          "https://another-node.example.com",
          150,
          NODE_DATA.certificateExpiry,
          "Another Location",
          "Another Specifications"
        );
        
        // If we get here, we need to check if the NFT was actually minted
        const tokenId = await soulboundNFT.tokenOfOwner(anotherUserAddress);
        expect(Number(tokenId)).to.equal(0); // Should not have minted
      } catch (error) {
        // Expected to fail with AccessControlUnauthorizedAccount
        expect(error.message).to.include("AccessControlUnauthorizedAccount");
      }
    });
  });
  
  describe("ABI Compatibility Verification", function() {
    it("should expose standard role management functions with correct signatures", async function() {
      const soulboundNFTAddress = await soulboundNFT.getAddress();
      const fragment = soulboundNFT.interface.getFunction("hasRole");
      expect(fragment).to.not.be.undefined;
      expect(fragment.inputs.length).to.equal(2);
      
      // Verify other important role functions
      expect(soulboundNFT.interface.getFunction("grantRole")).to.not.be.undefined;
      expect(soulboundNFT.interface.getFunction("revokeRole")).to.not.be.undefined;
      expect(soulboundNFT.interface.getFunction("renounceRole")).to.not.be.undefined;
      expect(soulboundNFT.interface.getFunction("getRoleAdmin")).to.not.be.undefined;
    });
    
    it("should have compatible event definitions for role management", async function() {
      // Test RoleGranted event
      const grantedEvent = soulboundNFT.interface.getEvent("RoleGranted");
      expect(grantedEvent).to.not.be.undefined;
      expect(grantedEvent.inputs.length).to.equal(3);
      
      // Verify RoleRevoked event
      const revokedEvent = soulboundNFT.interface.getEvent("RoleRevoked");
      expect(revokedEvent).to.not.be.undefined;
      expect(revokedEvent.inputs.length).to.equal(3);
    });
    
    it("should properly parse role-related errors", async function() {
      // Check that error definitions are available in ABI
      const accessControlError = soulboundNFT.interface.getError("AccessControlUnauthorizedAccount");
      expect(accessControlError).to.not.be.undefined;
      expect(accessControlError.inputs.length).to.equal(2);
      
      const invalidRoleError = soulboundNFT.interface.getError("AccessControlBadConfirmation");
      expect(invalidRoleError).to.not.be.undefined;
    });
  });
});