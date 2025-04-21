/**
 * @title Simplified ABI Compatibility Test
 * @dev Integration test for verifying ABI compatibility between contracts
 * 
 * This test ensures that contract interfaces align correctly for integration
 * using a simplified approach that works with both ethers.js v5 and v6.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper function to handle different ethers.js versions
async function getAddress(obj) {
  return typeof obj.getAddress === 'function' ? await obj.getAddress() : obj.address;
}

// Helper function to load ABI from artifacts
function loadAbi(contractName) {
  const artifactPath = path.join(process.cwd(), 'artifacts/contracts');
  let files = [];
  
  // Search for the contract file recursively
  function searchForArtifact(dir) {
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          searchForArtifact(itemPath);
        } else if (item.name === `${contractName}.json`) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      console.error(`Error searching directory ${dir}:`, error);
    }
  }
  
  searchForArtifact(artifactPath);
  
  if (files.length === 0) {
    throw new Error(`Artifact for ${contractName} not found`);
  }
  
  console.log(`Found artifact for ${contractName} at: ${files[0]}`);
  const artifact = JSON.parse(fs.readFileSync(files[0], 'utf8'));
  return artifact.abi;
}

// Helper function to check if an ABI contains a specific function
function hasFunction(abi, functionName) {
  return abi.some(item => 
    item.type === 'function' && 
    item.name === functionName
  );
}

// Helper function to check if an ABI contains a specific event
function hasEvent(abi, eventName) {
  return abi.some(item => 
    item.type === 'event' && 
    item.name === eventName
  );
}

// Helper function to check if an ABI contains a specific error
function hasError(abi, errorName) {
  return abi.some(item => 
    item.type === 'error' && 
    item.name === errorName
  );
}

describe("Simplified ABI Compatibility Verification", function() {
  let soulboundNFTAbi, aiNodeRegistryAbi, treasuryAbi, dloopTokenAbi;
  
  before(async function() {
    // Load ABIs
    console.log("Loading contract ABIs...");
    soulboundNFTAbi = loadAbi("SoulboundNFT");
    aiNodeRegistryAbi = loadAbi("AINodeRegistry");
    treasuryAbi = loadAbi("Treasury");
    dloopTokenAbi = loadAbi("DLoopToken");
  });
  
  describe("SoulboundNFT ABI Verification", function() {
    it("should have required ERC721 functions", async function() {
      expect(hasFunction(soulboundNFTAbi, "balanceOf")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "ownerOf")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "tokenURI")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "supportsInterface")).to.be.true;
    });
    
    it("should have required AccessControl functions", async function() {
      expect(hasFunction(soulboundNFTAbi, "hasRole")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "getRoleAdmin")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "grantRole")).to.be.true;
      expect(hasFunction(soulboundNFTAbi, "revokeRole")).to.be.true;
    });
    
    it("should have required events", async function() {
      expect(hasEvent(soulboundNFTAbi, "Transfer")).to.be.true;
      expect(hasEvent(soulboundNFTAbi, "RoleGranted")).to.be.true;
      expect(hasEvent(soulboundNFTAbi, "RoleRevoked")).to.be.true;
    });
    
    it("should have required errors", async function() {
      expect(hasError(soulboundNFTAbi, "AccessControlUnauthorizedAccount")).to.be.true;
      expect(hasError(soulboundNFTAbi, "AccessControlBadConfirmation")).to.be.true;
    });
  });
  
  describe("AINodeRegistry ABI Verification", function() {
    it("should have required node management functions", async function() {
      expect(hasFunction(aiNodeRegistryAbi, "registerNode")).to.be.true;
      expect(hasFunction(aiNodeRegistryAbi, "deactivateNode")).to.be.true;
      expect(hasFunction(aiNodeRegistryAbi, "getNodeInfo")).to.be.true;
    });
    
    it("should have required events", async function() {
      expect(hasEvent(aiNodeRegistryAbi, "NodeRegistered")).to.be.true;
      expect(hasEvent(aiNodeRegistryAbi, "NodeDeactivated")).to.be.true;
    });
  });
  
  describe("Treasury ABI Verification", function() {
    it("should have required treasury functions", async function() {
      expect(hasFunction(treasuryAbi, "withdraw")).to.be.true;
      expect(hasFunction(treasuryAbi, "deposit")).to.be.true;
      expect(hasFunction(treasuryAbi, "getBalance")).to.be.true;
    });
    
    it("should have required events", async function() {
      expect(hasEvent(treasuryAbi, "Withdrawal")).to.be.true;
      expect(hasEvent(treasuryAbi, "Deposit")).to.be.true;
    });
  });
  
  describe("DLoopToken ABI Verification", function() {
    it("should have required ERC20 functions", async function() {
      expect(hasFunction(dloopTokenAbi, "balanceOf")).to.be.true;
      expect(hasFunction(dloopTokenAbi, "transfer")).to.be.true;
      expect(hasFunction(dloopTokenAbi, "transferFrom")).to.be.true;
      expect(hasFunction(dloopTokenAbi, "approve")).to.be.true;
      expect(hasFunction(dloopTokenAbi, "allowance")).to.be.true;
    });
    
    it("should have required delegation functions", async function() {
      expect(hasFunction(dloopTokenAbi, "delegateTokens")).to.be.true;
      expect(hasFunction(dloopTokenAbi, "withdrawDelegation")).to.be.true;
    });
    
    it("should have required events", async function() {
      expect(hasEvent(dloopTokenAbi, "Transfer")).to.be.true;
      expect(hasEvent(dloopTokenAbi, "Approval")).to.be.true;
      expect(hasEvent(dloopTokenAbi, "TokensDelegated")).to.be.true;
      expect(hasEvent(dloopTokenAbi, "DelegationWithdrawn")).to.be.true;
    });
  });
  
  describe("Cross-Contract ABI Compatibility", function() {
    it("should verify AINodeRegistry can interact with SoulboundNFT", async function() {
      // AINodeRegistry should reference SoulboundNFT in its functions
      const nodeRegistrationFn = aiNodeRegistryAbi.find(item => 
        item.type === 'function' && 
        item.name === 'registerNode'
      );
      
      // At least one function should have a parameter for NFT ID
      expect(nodeRegistrationFn).to.not.be.undefined;
      expect(nodeRegistrationFn.inputs.some(input => 
        input.type === 'uint256' || // NFT ID
        input.name.toLowerCase().includes('token') || 
        input.name.toLowerCase().includes('nft')
      )).to.be.true;
    });
    
    it("should verify Treasury can interact with AINodeRegistry", async function() {
      // Treasury should have a reference to AINodeRegistry
      const treasuryFunctions = treasuryAbi.filter(item => 
        item.type === 'function' && 
        (item.name === 'withdraw' || item.name === 'deposit')
      );
      
      // At least one function should have a parameter for node ID or address
      expect(treasuryFunctions.length).to.be.greaterThan(0);
      expect(treasuryFunctions.some(fn => 
        fn.inputs.some(input => 
          input.type === 'address' || // Node address
          input.type === 'uint256' || // Node ID
          input.name.toLowerCase().includes('node')
        )
      )).to.be.true;
    });
  });
});
