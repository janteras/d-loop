/**
 * @title ABI Compatibility Test
 * @dev Integration test for verifying ABI compatibility between contracts
 * 
 * This test ensures that contract interfaces align correctly for integration:
 * - SoulboundNFT exposes expected AccessControl interfaces
 * - AINodeRegistry correctly interacts with SoulboundNFT
 * - Event signatures match between contracts
 * - Error handling is consistent
 */

const { ethers } = require('ethers');
const { expect } = require('chai');
const deployer = require('../../utils/direct-contract-deployer');

// Constants
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

describe("ABI Compatibility Verification", function() {
  let provider;
  let owner, admin, user;
  let soulboundNFT, mockToken, aiNodeRegistry, treasury, priceOracle, feeCalculator;
  
  // Helper function to check if an interface is supported (AccessControl, ERC721, etc)
  async function supportsInterface(contract, interfaceId) {
    try {
      return await contract.supportsInterface(interfaceId);
    } catch (error) {
      console.log(`Error checking interface support: ${error.message}`);
      return false;
    }
  }
  
  // Calculate interface IDs (EIP-165)
  function calculateInterfaceId(contract, functionNames) {
    // Get function selectors
    const selectors = functionNames.map(name => {
      const fragment = contract.interface.getFunction(name);
      if (!fragment) return '0x00000000';
      return contract.interface.getFunction(name).selector;
    });
    
    // XOR all selectors
    let interfaceId = '0x00000000';
    for (const selector of selectors) {
      // Convert to BigInt for XOR operation
      interfaceId = (BigInt(interfaceId) ^ BigInt(selector)).toString(16);
      // Ensure proper formatting with 0x prefix and 8 characters
      interfaceId = '0x' + interfaceId.padStart(8, '0').substring(0, 8);
    }
    
    return interfaceId;
  }
  
  before(async function() {
    // Initialize provider and signers
    provider = deployer.createProvider();
    
    // Get accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    // Use the first few accounts for different roles
    owner = provider.getSigner(0);
    admin = provider.getSigner(1);
    user = provider.getSigner(2);
    
    // Deploy contracts for testing
    console.log("\nDeploying contracts for ABI compatibility tests...");
    
    try {
      // Deploy all core contracts
      const ownerAddress = await owner.getAddress();
      const adminAddress = await admin.getAddress();
      
      // Deploy SoulboundNFT
      soulboundNFT = await deployer.deployContract('SoulboundNFT', owner, [adminAddress]);
      console.log(`SoulboundNFT deployed at: ${await soulboundNFT.getAddress()}`);
      
      // Deploy MockToken
      mockToken = await deployer.deployContract('MockToken', owner, ["DLOOP Token", "DLOOP", 18]);
      console.log(`MockToken deployed at: ${await mockToken.getAddress()}`);
      
      // Deploy AINodeRegistry
      aiNodeRegistry = await deployer.deployContract('AINodeRegistry', owner, [
        adminAddress,
        await mockToken.getAddress(),
        await soulboundNFT.getAddress()
      ]);
      console.log(`AINodeRegistry deployed at: ${await aiNodeRegistry.getAddress()}`);
      
      // Deploy Treasury
      treasury = await deployer.deployContract('Treasury', owner, [
        adminAddress,
        await mockToken.getAddress()
      ]);
      console.log(`Treasury deployed at: ${await treasury.getAddress()}`);
      
      // Deploy PriceOracle
      priceOracle = await deployer.deployContract('PriceOracle', owner, [adminAddress]);
      console.log(`PriceOracle deployed at: ${await priceOracle.getAddress()}`);
      
      // Deploy FeeCalculator
      feeCalculator = await deployer.deployContract('FeeCalculator', owner, [
        adminAddress,
        await priceOracle.getAddress()
      ]);
      console.log(`FeeCalculator deployed at: ${await feeCalculator.getAddress()}`);
      
      // Grant necessary roles for integration
      console.log("Setting up roles for integration tests...");
      await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, await aiNodeRegistry.getAddress());
      
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });
  
  describe("Core Interface Detection", function() {
    it("should verify SoulboundNFT implements ERC721 interface", async function() {
      // ERC721 interface ID
      const ERC721_INTERFACE_ID = '0x80ac58cd';
      
      const supportsERC721 = await supportsInterface(soulboundNFT, ERC721_INTERFACE_ID);
      expect(supportsERC721).to.be.true;
    });
    
    it("should verify SoulboundNFT implements AccessControl interface", async function() {
      // AccessControl interface ID
      const ACCESS_CONTROL_INTERFACE_ID = '0x7965db0b';
      
      const supportsAccessControl = await supportsInterface(soulboundNFT, ACCESS_CONTROL_INTERFACE_ID);
      expect(supportsAccessControl).to.be.true;
    });
    
    it("should verify contract implements ERC165 correctly", async function() {
      // ERC165 interface ID
      const ERC165_INTERFACE_ID = '0x01ffc9a7';
      
      const supportsERC165 = await supportsInterface(soulboundNFT, ERC165_INTERFACE_ID);
      expect(supportsERC165).to.be.true;
    });
  });
  
  describe("Role Management Method Compatibility", function() {
    it("should verify AccessControl methods in SoulboundNFT have correct signatures", async function() {
      // Check core AccessControl function signatures
      const requiredFunctions = [
        "hasRole",
        "getRoleAdmin",
        "grantRole",
        "revokeRole",
        "renounceRole"
      ];
      
      for (const funcName of requiredFunctions) {
        const fragment = soulboundNFT.interface.getFunction(funcName);
        expect(fragment, `Missing function: ${funcName}`).to.not.be.undefined;
      }
      
      // Verify specific function parameters
      const hasRoleFunc = soulboundNFT.interface.getFunction("hasRole");
      expect(hasRoleFunc.inputs.length).to.equal(2);
      expect(hasRoleFunc.inputs[0].type).to.equal("bytes32"); // role
      expect(hasRoleFunc.inputs[1].type).to.equal("address"); // account
      
      const grantRoleFunc = soulboundNFT.interface.getFunction("grantRole");
      expect(grantRoleFunc.inputs.length).to.equal(2);
      expect(grantRoleFunc.inputs[0].type).to.equal("bytes32"); // role
      expect(grantRoleFunc.inputs[1].type).to.equal("address"); // account
    });
    
    it("should verify AINodeRegistry correctly interfaces with SoulboundNFT's minting methods", async function() {
      // Check that AINodeRegistry references SoulboundNFT in its ABI
      // Check for function parameters that might call SoulboundNFT methods
      
      const registerNodeFunc = aiNodeRegistry.interface.getFunction("registerNode");
      expect(registerNodeFunc).to.not.be.undefined;
      
      const registerNodeByAdminFunc = aiNodeRegistry.interface.getFunction("registerNodeByAdmin");
      expect(registerNodeByAdminFunc).to.not.be.undefined;
      
      // Check initialization parameters
      const initializeFunc = aiNodeRegistry.interface.getFunction("initialize");
      if (initializeFunc) {
        // If using upgradeable pattern with initialize
        let soulboundParamFound = false;
        for (const input of initializeFunc.inputs) {
          if (input.name.includes("soulbound") || input.name.includes("nft")) {
            soulboundParamFound = true;
            break;
          }
        }
        expect(soulboundParamFound, "SoulboundNFT parameter not found in initialize function").to.be.true;
      } else {
        // Check constructor if initialize doesn't exist
        const constructorFunc = aiNodeRegistry.interface.deploy;
        expect(constructorFunc).to.not.be.undefined;
        let soulboundParamFound = false;
        for (const input of constructorFunc.inputs) {
          if (input.name.includes("soulbound") || input.name.includes("nft")) {
            soulboundParamFound = true;
            break;
          }
        }
        expect(soulboundParamFound, "SoulboundNFT parameter not found in constructor").to.be.true;
      }
    });
  });
  
  describe("Event Compatibility", function() {
    it("should verify event signatures in SoulboundNFT", async function() {
      // Check AccessControl events
      const roleGrantedEvent = soulboundNFT.interface.getEvent("RoleGranted");
      expect(roleGrantedEvent).to.not.be.undefined;
      expect(roleGrantedEvent.inputs.length).to.equal(3);
      expect(roleGrantedEvent.inputs[0].type).to.equal("bytes32"); // role
      expect(roleGrantedEvent.inputs[1].type).to.equal("address"); // account
      expect(roleGrantedEvent.inputs[2].type).to.equal("address"); // sender
      
      const roleRevokedEvent = soulboundNFT.interface.getEvent("RoleRevoked");
      expect(roleRevokedEvent).to.not.be.undefined;
      expect(roleRevokedEvent.inputs.length).to.equal(3);
      
      // Check ERC721 events
      const transferEvent = soulboundNFT.interface.getEvent("Transfer");
      expect(transferEvent).to.not.be.undefined;
      expect(transferEvent.inputs.length).to.equal(3);
      expect(transferEvent.inputs[0].type).to.equal("address"); // from
      expect(transferEvent.inputs[1].type).to.equal("address"); // to
      expect(transferEvent.inputs[2].type).to.equal("uint256"); // tokenId
    });
    
    it("should verify AINodeRegistry emits events with correct signatures", async function() {
      // Check node registration events
      const nodeRegisteredEvent = aiNodeRegistry.interface.getEvent("NodeRegistered");
      expect(nodeRegisteredEvent).to.not.be.undefined;
      
      const nodeUpdatedEvent = aiNodeRegistry.interface.getEvent("NodeUpdated");
      expect(nodeUpdatedEvent).to.not.be.undefined;
    });
  });
  
  describe("Error Handling Compatibility", function() {
    it("should verify SoulboundNFT exposes standard AccessControl errors", async function() {
      // Check AccessControl errors
      const unauthorizedError = soulboundNFT.interface.getError("AccessControlUnauthorizedAccount");
      expect(unauthorizedError).to.not.be.undefined;
      expect(unauthorizedError.inputs.length).to.equal(2);
      expect(unauthorizedError.inputs[0].type).to.equal("address"); // account
      expect(unauthorizedError.inputs[1].type).to.equal("bytes32"); // role
      
      const badConfirmationError = soulboundNFT.interface.getError("AccessControlBadConfirmation");
      expect(badConfirmationError).to.not.be.undefined;
    });
    
    it("should verify AINodeRegistry exposes proper error interfaces", async function() {
      // Check custom errors in AINodeRegistry
      const alreadyRegisteredError = aiNodeRegistry.interface.getError("NodeAlreadyRegistered");
      const notActiveError = aiNodeRegistry.interface.getError("NodeNotActive");
      
      // At least one of these errors should be defined
      expect(
        alreadyRegisteredError !== undefined || notActiveError !== undefined,
        "AINodeRegistry should define at least one node-related error"
      ).to.be.true;
    });
  });
  
  describe("Integration Function Testing", function() {
    it("should validate token minting through AINodeRegistry", async function() {
      const userAddress = await user.getAddress();
      const adminAddress = await admin.getAddress();
      
      // Admin should have permission to register nodes
      const aiNodeRegistryWithAdmin = aiNodeRegistry.connect(admin);
      
      // Register a node which should mint an NFT
      await aiNodeRegistryWithAdmin.registerNodeByAdmin(
        userAddress,
        "Integration Test Node",
        "https://integration-test.example.com",
        100,
        Math.floor(Date.now() / 1000) + 31536000, // 1 year from now
        "Test Location",
        "Test Specifications"
      );
      
      // Verify the NFT was minted and assigned to user
      const tokenId = await soulboundNFT.tokenOfOwner(userAddress);
      expect(Number(tokenId)).to.be.greaterThan(0);
      
      // Verify ownership
      const owner = await soulboundNFT.ownerOf(tokenId);
      expect(owner.toLowerCase()).to.equal(userAddress.toLowerCase());
    });
    
    it("should validate NFT token URI compatibility", async function() {
      const userAddress = await user.getAddress();
      const tokenId = await soulboundNFT.tokenOfOwner(userAddress);
      
      // TokenURI should work without errors
      const tokenURI = await soulboundNFT.tokenURI(tokenId);
      expect(tokenURI).to.be.a('string');
    });
  });
  
  describe("Cross-Contract Interactions", function() {
    it("should verify SoulboundNFT roles apply correctly in integration context", async function() {
      // Verify AINodeRegistry has MINTER_ROLE
      const aiNodeRegistryAddress = await aiNodeRegistry.getAddress();
      expect(await soulboundNFT.hasRole(MINTER_ROLE, aiNodeRegistryAddress)).to.be.true;
      
      // Remove MINTER_ROLE and verify node registration fails
      await soulboundNFT.connect(admin).revokeRole(MINTER_ROLE, aiNodeRegistryAddress);
      
      // Try to register another node
      const anotherUser = provider.getSigner(4);
      const anotherUserAddress = await anotherUser.getAddress();
      
      // Should fail or not mint NFT when AINodeRegistry lacks MINTER_ROLE
      let error;
      try {
        await aiNodeRegistry.connect(admin).registerNodeByAdmin(
          anotherUserAddress,
          "Another Test Node",
          "https://another-test.example.com",
          100,
          Math.floor(Date.now() / 1000) + 31536000,
          "Another Location",
          "Another Specifications"
        );
      } catch (e) {
        error = e;
      }
      
      if (!error) {
        // If no error, check if the NFT was actually minted
        const tokenId = await soulboundNFT.tokenOfOwner(anotherUserAddress);
        expect(Number(tokenId)).to.equal(0); // Should not have minted
      } else {
        // Error should be about access control
        expect(error.message).to.include("AccessControlUnauthorizedAccount");
      }
    });
  });
});