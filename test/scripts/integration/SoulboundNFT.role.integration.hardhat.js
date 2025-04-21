/**
 * SoulboundNFT Role Integration Test
 * 
 * This test verifies the role management functionality of SoulboundNFT
 * and its integration with AINodeRegistry.
 * 
 * Uses Hardhat's testing environment to ensure compatibility.
 */

// Import Hardhat and Ethers utilities
const { ethers } = require("hardhat");
const { expect } = require("chai");

// Import role constants - Compatible with Ethers v6
const Roles = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", // keccak256("MINTER_ROLE")
  BURNER_ROLE: "0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848", // keccak256("BURNER_ROLE")
  PAUSER_ROLE: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"  // keccak256("PAUSER_ROLE")
};

// Test constants
const TEST_TOKEN_NAME = "DLoop Identity Token";
const TEST_TOKEN_SYMBOL = "DLOOPID";
const TEST_TOKEN_URI = "https://example.com/token/";
const TEST_NODE_NAME = "Test AI Node";
const TEST_NODE_ENDPOINT = "https://api.example.com/ainode";

// Integration test suite
describe("SoulboundNFT Role Integration", function() {
  // Test variables
  let admin, minter, burner, pauser, user;
  let SoulboundNFT, AINodeRegistry;
  let soulboundNFT, aiNodeRegistry;

  // Deploy contracts before each test
  beforeEach(async function() {
    // Get signers for different roles
    [admin, minter, burner, pauser, user] = await ethers.getSigners();

    // Deploy SoulboundNFT contract
    SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    
    soulboundNFT = await SoulboundNFT.connect(admin).deploy(
      TEST_TOKEN_NAME,
      TEST_TOKEN_SYMBOL,
      TEST_TOKEN_URI,
      admin.address // Admin address
    );
    
    await soulboundNFT.waitForDeployment();
    
    console.log(`SoulboundNFT deployed at: ${await soulboundNFT.getAddress()}`);
    
    // Deploy a mock governance contract for AINodeRegistry
    const MockGovernance = await ethers.getContractFactory("SimpleAdminControls");
    const mockGovernance = await MockGovernance.connect(admin).deploy(admin.address);
    await mockGovernance.waitForDeployment();
    
    // Deploy AINodeRegistry contract
    AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    
    aiNodeRegistry = await AINodeRegistry.connect(admin).deploy(
      admin.address,
      await mockGovernance.getAddress(),
      await soulboundNFT.getAddress()
    );
    
    await aiNodeRegistry.waitForDeployment();
    
    console.log(`AINodeRegistry deployed at: ${await aiNodeRegistry.getAddress()}`);
    
    // Grant MINTER_ROLE to the AINodeRegistry contract
    await soulboundNFT.connect(admin).grantRole(
      Roles.MINTER_ROLE,
      await aiNodeRegistry.getAddress()
    );
    
    // Grant roles to test accounts
    await soulboundNFT.connect(admin).grantRole(Roles.MINTER_ROLE, minter.address);
    await soulboundNFT.connect(admin).grantRole(Roles.BURNER_ROLE, burner.address);
    await soulboundNFT.connect(admin).grantRole(Roles.PAUSER_ROLE, pauser.address);
  });

  describe("Role Assignment and Management", function() {
    it("should assign the DEFAULT_ADMIN_ROLE to the admin", async function() {
      expect(
        await soulboundNFT.hasRole(Roles.DEFAULT_ADMIN_ROLE, admin.address)
      ).to.be.true;
    });

    it("should assign the MINTER_ROLE to the minter", async function() {
      expect(
        await soulboundNFT.hasRole(Roles.MINTER_ROLE, minter.address)
      ).to.be.true;
    });

    it("should assign the BURNER_ROLE to the burner", async function() {
      expect(
        await soulboundNFT.hasRole(Roles.BURNER_ROLE, burner.address)
      ).to.be.true;
    });

    it("should assign the PAUSER_ROLE to the pauser", async function() {
      expect(
        await soulboundNFT.hasRole(Roles.PAUSER_ROLE, pauser.address)
      ).to.be.true;
    });

    it("should assign the MINTER_ROLE to the AINodeRegistry contract", async function() {
      expect(
        await soulboundNFT.hasRole(Roles.MINTER_ROLE, await aiNodeRegistry.getAddress())
      ).to.be.true;
    });

    it("should allow the admin to revoke roles", async function() {
      await soulboundNFT.connect(admin).revokeRole(Roles.MINTER_ROLE, minter.address);
      
      expect(
        await soulboundNFT.hasRole(Roles.MINTER_ROLE, minter.address)
      ).to.be.false;
    });

    it("should allow accounts to renounce their roles", async function() {
      await soulboundNFT.connect(pauser).renounceRole(Roles.PAUSER_ROLE, pauser.address);
      
      expect(
        await soulboundNFT.hasRole(Roles.PAUSER_ROLE, pauser.address)
      ).to.be.false;
    });
  });

  describe("Minting with Role Control", function() {
    it("should allow accounts with MINTER_ROLE to mint tokens", async function() {
      await soulboundNFT.connect(minter).mint(user.address, "https://example.com/metadata/1");
      
      expect(await soulboundNFT.balanceOf(user.address)).to.equal(1);
    });

    it("should revert when non-minters try to mint tokens", async function() {
      await expect(
        soulboundNFT.connect(user).mint(user.address, "https://example.com/metadata/1")
      ).to.be.revertedWithCustomError(
        soulboundNFT,
        "AccessControlUnauthorizedAccount"
      );
    });

    it("should mint tokens when AINodeRegistry registers a node", async function() {
      // Register a new node, which should mint a token
      await aiNodeRegistry.connect(admin).registerNode(
        user.address,
        TEST_NODE_NAME,
        TEST_NODE_ENDPOINT
      );
      
      // Check if a token was minted
      expect(await soulboundNFT.balanceOf(user.address)).to.equal(1);
    });
  });

  describe("Integration: Role Revocation Impact", function() {
    it("should prevent AINodeRegistry from minting if MINTER_ROLE is revoked", async function() {
      // Revoke MINTER_ROLE from AINodeRegistry
      await soulboundNFT.connect(admin).revokeRole(
        Roles.MINTER_ROLE,
        await aiNodeRegistry.getAddress()
      );
      
      // Attempt to register a node, which should revert due to the revoked role
      await expect(
        aiNodeRegistry.connect(admin).registerNode(
          user.address,
          TEST_NODE_NAME,
          TEST_NODE_ENDPOINT
        )
      ).to.be.reverted;
    });
  });

  describe("ABI Compatibility", function() {
    it("should have the correct role interfaces", async function() {
      // Check hasRole function
      const hasRoleFunction = soulboundNFT.interface.getFunction("hasRole");
      expect(hasRoleFunction).to.not.be.undefined;
      expect(hasRoleFunction.inputs.length).to.equal(2);
      
      // Check grantRole function
      const grantRoleFunction = soulboundNFT.interface.getFunction("grantRole");
      expect(grantRoleFunction).to.not.be.undefined;
      expect(grantRoleFunction.inputs.length).to.equal(2);
      
      // Check revokeRole function
      const revokeRoleFunction = soulboundNFT.interface.getFunction("revokeRole");
      expect(revokeRoleFunction).to.not.be.undefined;
      expect(revokeRoleFunction.inputs.length).to.equal(2);
      
      // Check renounceRole function
      const renounceRoleFunction = soulboundNFT.interface.getFunction("renounceRole");
      expect(renounceRoleFunction).to.not.be.undefined;
      expect(renounceRoleFunction.inputs.length).to.equal(2);
    });

    it("should have the correct events for role management", async function() {
      // Check RoleGranted event
      const roleGrantedEvent = soulboundNFT.interface.getEvent("RoleGranted");
      expect(roleGrantedEvent).to.not.be.undefined;
      expect(roleGrantedEvent.inputs.length).to.equal(3);
      
      // Check RoleRevoked event
      const roleRevokedEvent = soulboundNFT.interface.getEvent("RoleRevoked");
      expect(roleRevokedEvent).to.not.be.undefined;
      expect(roleRevokedEvent.inputs.length).to.equal(3);
    });

    it("should emit proper events when roles are granted", async function() {
      const testAccount = user.address;
      
      // Test event emission for role granting
      await expect(soulboundNFT.connect(admin).grantRole(Roles.MINTER_ROLE, testAccount))
        .to.emit(soulboundNFT, "RoleGranted")
        .withArgs(Roles.MINTER_ROLE, testAccount, admin.address);
    });

    it("should emit proper events when roles are revoked", async function() {
      const testAccount = minter.address;
      
      // Test event emission for role revocation
      await expect(soulboundNFT.connect(admin).revokeRole(Roles.MINTER_ROLE, testAccount))
        .to.emit(soulboundNFT, "RoleRevoked")
        .withArgs(Roles.MINTER_ROLE, testAccount, admin.address);
    });
  });
});