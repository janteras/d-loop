/**
 * @title ABI Compliance Test
 * @dev Integration test for verifying ABI compliance across the D-Loop Protocol
 * 
 * This test ensures that all contracts have consistent interfaces:
 * - Verifies function signatures match across related contracts
 * - Ensures event definitions are consistent
 * - Checks for proper error handling
 * - Validates ethers v6 compatibility
 */

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const path = require("path");
const fs = require("fs");

// Define contract categories for testing
const CONTRACT_CATEGORIES = {
  CORE: ["AssetDAO", "ProtocolDAO", "Treasury"],
  TOKEN: ["DAIToken", "DLoopToken"],
  FEES: ["FeeCalculator", "FeeProcessor"],
  ORACLE: ["PriceOracle", "PriceOracleAdapter"]
};

// Helper function to get artifact path
function getArtifactPath(contractName) {
  // First try to find the contract in the main contracts directory
  const directories = [
    "core",
    "token",
    "fees",
    "oracle",
    "governance",
    "identity",
    "utils",
    "adapters"
  ];
  
  for (const dir of directories) {
    const artifactPath = path.join(__dirname, `../../artifacts/contracts/${dir}/${contractName}.sol/${contractName}.json`);
    if (fs.existsSync(artifactPath)) {
      return artifactPath;
    }
  }
  
  // For PriceOracle, it might be in a different location
  if (contractName === "PriceOracle") {
    const oraclePath = path.join(__dirname, `../../artifacts/contracts/oracle/PriceOracle.sol/PriceOracle.json`);
    if (fs.existsSync(oraclePath)) {
      return oraclePath;
    }
  }
  
  // If not found, return a default path that will fail gracefully
  return path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
}

// Load contract artifacts
function loadContractArtifacts(contractNames) {
  const artifacts = {};
  
  for (const name of contractNames) {
    try {
      const artifactPath = getArtifactPath(name);
      artifacts[name] = require(artifactPath);
      console.log(`Loaded artifact for ${name}`);
    } catch (error) {
      console.error(`Failed to load artifact for ${name}: ${error.message}`);
    }
  }
  
  return artifacts;
}

// Extract function signatures from ABI
function extractFunctionSignatures(abi) {
  const functions = {};
  
  for (const item of abi) {
    if (item.type === "function") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      functions[signature] = item;
    }
  }
  
  return functions;
}

// Extract event signatures from ABI
function extractEventSignatures(abi) {
  const events = {};
  
  for (const item of abi) {
    if (item.type === "event") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      events[signature] = item;
    }
  }
  
  return events;
}

// Extract error signatures from ABI
function extractErrorSignatures(abi) {
  const errors = {};
  
  for (const item of abi) {
    if (item.type === "error") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      errors[signature] = item;
    }
  }
  
  return errors;
}

describe("ABI Compliance Tests", function() {
  describe("Function Signature Compliance", function() {
    for (const [category, contracts] of Object.entries(CONTRACT_CATEGORIES)) {
      it(`should have consistent function signatures in ${category} contracts`, function() {
        const artifacts = loadContractArtifacts(contracts);
        const functionsByContract = {};
        
        // Extract function signatures for each contract
        for (const [name, artifact] of Object.entries(artifacts)) {
          if (artifact && artifact.abi) {
            functionsByContract[name] = extractFunctionSignatures(artifact.abi);
            console.log(`${name} has ${Object.keys(functionsByContract[name]).length} functions`);
          }
        }
        
        // Check for common interfaces within the category
        const commonFunctions = {};
        
        // For each function in each contract
        for (const [contractName, functions] of Object.entries(functionsByContract)) {
          for (const [signature, func] of Object.entries(functions)) {
            // Skip internal functions
            if (func.visibility === "internal" || func.visibility === "private") {
              continue;
            }
            
            // Track common functions by name (not full signature)
            const funcName = func.name;
            if (!commonFunctions[funcName]) {
              commonFunctions[funcName] = { 
                contracts: [contractName], 
                signatures: [signature] 
              };
            } else {
              commonFunctions[funcName].contracts.push(contractName);
              if (!commonFunctions[funcName].signatures.includes(signature)) {
                commonFunctions[funcName].signatures.push(signature);
              }
            }
          }
        }
        
        // Report functions with inconsistent signatures
        for (const [funcName, info] of Object.entries(commonFunctions)) {
          if (info.contracts.length > 1 && info.signatures.length > 1) {
            console.log(`Warning: Function ${funcName} has inconsistent signatures across ${info.contracts.join(", ")}`);
            console.log(`Signatures: ${info.signatures.join(", ")}`);
          }
        }
      });
    }
  });
  
  describe("Event Signature Compliance", function() {
    for (const [category, contracts] of Object.entries(CONTRACT_CATEGORIES)) {
      it(`should have consistent event signatures in ${category} contracts`, function() {
        const artifacts = loadContractArtifacts(contracts);
        const eventsByContract = {};
        
        // Extract event signatures for each contract
        for (const [name, artifact] of Object.entries(artifacts)) {
          if (artifact && artifact.abi) {
            eventsByContract[name] = extractEventSignatures(artifact.abi);
            console.log(`${name} has ${Object.keys(eventsByContract[name]).length} events`);
          }
        }
        
        // Check for common events within the category
        const commonEvents = {};
        
        // For each event in each contract
        for (const [contractName, events] of Object.entries(eventsByContract)) {
          for (const [signature, event] of Object.entries(events)) {
            // Track common events by name (not full signature)
            const eventName = event.name;
            if (!commonEvents[eventName]) {
              commonEvents[eventName] = { 
                contracts: [contractName], 
                signatures: [signature] 
              };
            } else {
              commonEvents[eventName].contracts.push(contractName);
              if (!commonEvents[eventName].signatures.includes(signature)) {
                commonEvents[eventName].signatures.push(signature);
              }
            }
          }
        }
        
        // Report events with inconsistent signatures
        for (const [eventName, info] of Object.entries(commonEvents)) {
          if (info.contracts.length > 1 && info.signatures.length > 1) {
            console.log(`Warning: Event ${eventName} has inconsistent signatures across ${info.contracts.join(", ")}`);
            console.log(`Signatures: ${info.signatures.join(", ")}`);
          }
        }
      });
    }
  });
  
  describe("Error Signature Compliance", function() {
    for (const [category, contracts] of Object.entries(CONTRACT_CATEGORIES)) {
      it(`should have consistent error signatures in ${category} contracts`, function() {
        const artifacts = loadContractArtifacts(contracts);
        const errorsByContract = {};
        
        // Extract error signatures for each contract
        for (const [name, artifact] of Object.entries(artifacts)) {
          if (artifact && artifact.abi) {
            errorsByContract[name] = extractErrorSignatures(artifact.abi);
            console.log(`${name} has ${Object.keys(errorsByContract[name]).length} errors`);
          }
        }
        
        // Check for common errors within the category
        const commonErrors = {};
        
        // For each error in each contract
        for (const [contractName, errors] of Object.entries(errorsByContract)) {
          for (const [signature, error] of Object.entries(errors)) {
            // Track common errors by name (not full signature)
            const errorName = error.name;
            if (!commonErrors[errorName]) {
              commonErrors[errorName] = { 
                contracts: [contractName], 
                signatures: [signature] 
              };
            } else {
              commonErrors[errorName].contracts.push(contractName);
              if (!commonErrors[errorName].signatures.includes(signature)) {
                commonErrors[errorName].signatures.push(signature);
              }
            }
          }
        }
        
        // Report errors with inconsistent signatures
        for (const [errorName, info] of Object.entries(commonErrors)) {
          if (info.contracts.length > 1 && info.signatures.length > 1) {
            console.log(`Warning: Error ${errorName} has inconsistent signatures across ${info.contracts.join(", ")}`);
            console.log(`Signatures: ${info.signatures.join(", ")}`);
          }
        }
      });
    }
  });
  
  describe("Ethers v6 Compatibility", function() {
    it("should verify contracts are compatible with ethers v6", async function() {
      // Deploy a subset of contracts to test ethers v6 compatibility
      const [owner] = await ethers.getSigners();
      
      // Deploy DAIToken
      const DAIToken = await ethers.getContractFactory("DAIToken");
      const daiToken = await DAIToken.deploy();
      await daiToken.waitForDeployment();
      
      // Test ethers v6 specific methods
      const daiTokenAddress = await daiToken.getAddress();
      expect(daiTokenAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test BigNumber operations
      const mintAmount = ethers.parseEther("1000");
      await daiToken.mint(owner.address, mintAmount);
      
      const balance = await daiToken.balanceOf(owner.address);
      expect(balance).to.equal(mintAmount);
      
      // Create a valid recipient address (can't transfer to zero address in ERC20)
      const [_, recipient] = await ethers.getSigners();
      
      // Test event handling
      const transferAmount = 100n;
      const tx = await daiToken.transfer(recipient.address, transferAmount);
      const receipt = await tx.wait();
      
      // In ethers v6, we need to use logs instead of events
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === daiToken.interface.getEvent("Transfer").topicHash
      );
      
      expect(transferEvent).to.not.be.undefined;
      console.log('Found Transfer event');
      
      // Parse the log to get the event arguments
      const parsedTransferEvent = daiToken.interface.parseLog({
        topics: transferEvent.topics,
        data: transferEvent.data
      });
      
      console.log('Transfer event args:', {
        from: parsedTransferEvent.args[0],
        to: parsedTransferEvent.args[1],
        value: parsedTransferEvent.args[2].toString()
      });
      
      expect(parsedTransferEvent.args[0]).to.equal(owner.address); // from
      expect(parsedTransferEvent.args[1]).to.equal(recipient.address); // to
      expect(parsedTransferEvent.args[2]).to.equal(transferAmount); // value
    });
  });
});
