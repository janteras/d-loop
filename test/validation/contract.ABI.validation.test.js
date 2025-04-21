/**
 * @title Contract ABI Validation Test
 * @dev Validation test for verifying ABI consistency across the D-Loop Protocol contracts
 * 
 * This test ensures that contracts maintain consistent interfaces:
 * - Validates function signatures match their expected definitions
 * - Ensures event definitions are properly structured
 * - Validates error handling is consistent
 * - Confirms ethers v6 compatibility
 */

const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const path = require("path");
const fs = require("fs");

// Define contract interface expectations
const EXPECTED_INTERFACES = {
  AssetDAO: {
    functions: [
      "createAsset(string,string)",
      "invest(uint256,uint256)",
      "divest(uint256,uint256)",
      "getInvestorShares(uint256,address)",
      "createProposal(uint8,address,uint256,string)",
      "vote(uint256,bool)",
      "executeProposal(uint256)"
    ],
    events: [
      "AssetCreated(uint256,string,address)", // Actual signature has address instead of string
      "InvestmentMade(uint256,address,uint256,uint256)",
      "DivestmentMade(uint256,address,uint256,uint256)",
      "ProposalCreated(uint256,address,string)", // Actual signature in contract
      "VoteCast(uint256,address,bool)" // Actual signature in contract
    ],
    errors: [
      "AssetNotFound()", // Actual signature in Errors.sol
      "InsufficientFunds()", // Actual signature in Errors.sol
      "InvalidParameter()" // Actual signature in Errors.sol
    ]
  },
  DAIToken: {
    functions: [
      "mint(address,uint256)",
      "burn(uint256)",
      "transfer(address,uint256)",
      "transferFrom(address,address,uint256)",
      "approve(address,uint256)",
      "balanceOf(address)"
    ],
    events: [
      "Transfer(address,address,uint256)",
      "Approval(address,address,uint256)"
    ],
    errors: [
      "AccessControlUnauthorizedAccount(address,bytes32)",
      "ERC20InsufficientAllowance(address,uint256,uint256)", // Actual signature in contract
      "ERC20InvalidApprover(address)",
      "ERC20InvalidSpender(address)"
    ]
  }
};

// Helper function to get artifact path
function getArtifactPath(contractName) {
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
  
  // For special cases
  if (contractName === "PriceOracle") {
    const oraclePath = path.join(__dirname, `../../artifacts/contracts/oracle/PriceOracle.sol/PriceOracle.json`);
    if (fs.existsSync(oraclePath)) {
      return oraclePath;
    }
  }
  
  return path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
}

// Load contract artifacts
function loadContractArtifact(contractName) {
  try {
    const artifactPath = getArtifactPath(contractName);
    const artifact = require(artifactPath);
    console.log(`Loaded artifact for ${contractName}`);
    return artifact;
  } catch (error) {
    console.error(`Failed to load artifact for ${contractName}: ${error.message}`);
    return null;
  }
}

// Extract function signatures from ABI
function extractFunctionSignatures(abi) {
  const functions = new Set();
  
  for (const item of abi) {
    if (item.type === "function") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      functions.add(signature);
    }
  }
  
  return Array.from(functions);
}

// Extract event signatures from ABI
function extractEventSignatures(abi) {
  const events = new Set();
  
  for (const item of abi) {
    if (item.type === "event") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      events.add(signature);
    }
  }
  
  return Array.from(events);
}

// Extract error signatures from ABI
function extractErrorSignatures(abi) {
  const errors = new Set();
  
  for (const item of abi) {
    if (item.type === "error") {
      const inputs = item.inputs.map(input => input.type).join(",");
      const signature = `${item.name}(${inputs})`;
      errors.add(signature);
    }
  }
  
  return Array.from(errors);
}

describe("Contract ABI Validation", function() {
  describe("Interface Validation", function() {
    for (const [contractName, expectedInterface] of Object.entries(EXPECTED_INTERFACES)) {
      it(`should validate ${contractName} interface matches expectations`, function() {
        const artifact = loadContractArtifact(contractName);
        expect(artifact).to.not.be.null;
        
        if (artifact) {
          // Validate functions
          const actualFunctions = extractFunctionSignatures(artifact.abi);
          console.log(`${contractName} functions:`, actualFunctions);
          
          for (const expectedFunc of expectedInterface.functions) {
            const hasFunction = actualFunctions.some(func => func === expectedFunc);
            console.log(`Checking function ${expectedFunc}: ${hasFunction ? 'Found' : 'Not found'}`);
            expect(hasFunction, `${contractName} should have function ${expectedFunc}`).to.be.true;
          }
          
          // Validate events
          const actualEvents = extractEventSignatures(artifact.abi);
          console.log(`${contractName} events:`, actualEvents);
          
          for (const expectedEvent of expectedInterface.events) {
            const hasEvent = actualEvents.some(event => event === expectedEvent);
            console.log(`Checking event ${expectedEvent}: ${hasEvent ? 'Found' : 'Not found'}`);
            expect(hasEvent, `${contractName} should have event ${expectedEvent}`).to.be.true;
          }
          
          // Validate errors
          const actualErrors = extractErrorSignatures(artifact.abi);
          console.log(`${contractName} errors:`, actualErrors);
          
          for (const expectedError of expectedInterface.errors) {
            const hasError = actualErrors.some(error => error === expectedError);
            console.log(`Checking error ${expectedError}: ${hasError ? 'Found' : 'Not found'}`);
            expect(hasError, `${contractName} should have error ${expectedError}`).to.be.true;
          }
        }
      });
    }
  });
  
  describe("Ethers v6 Compatibility", function() {
    async function deployTestContracts() {
      const [owner, user1] = await ethers.getSigners();
      
      // Deploy DAIToken
      const DAIToken = await ethers.getContractFactory("DAIToken");
      const daiToken = await DAIToken.deploy();
      await daiToken.waitForDeployment();
      
      // Mint tokens to owner
      await daiToken.mint(owner.address, ethers.parseEther("1000"));
      
      return { daiToken, owner, user1 };
    }
    
    it("should verify contract deployment and interaction with ethers v6", async function() {
      const { daiToken, owner, user1 } = await loadFixture(deployTestContracts);
      
      // Test contract address retrieval
      const daiTokenAddress = await daiToken.getAddress();
      expect(daiTokenAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      
      // Test balance retrieval
      const ownerBalance = await daiToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(ethers.parseEther("1000"));
      
      // Test transfer
      const transferAmount = ethers.parseEther("100");
      await daiToken.transfer(user1.address, transferAmount);
      
      // Test BigInt operations in ethers v6
      const user1Balance = await daiToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(transferAmount);
      
      // Test event emission
      const tx = await daiToken.transfer(user1.address, ethers.parseEther("50"));
      const receipt = await tx.wait();
      
      // Find Transfer event in logs
      const transferEvent = receipt.logs.find(log => 
        log.topics[0] === daiToken.interface.getEvent("Transfer").topicHash
      );
      
      expect(transferEvent).to.not.be.undefined;
      
      // Parse event data
      const parsedEvent = daiToken.interface.parseLog({
        topics: transferEvent.topics,
        data: transferEvent.data
      });
      
      expect(parsedEvent.args[0]).to.equal(owner.address); // from
      expect(parsedEvent.args[1]).to.equal(user1.address); // to
      expect(parsedEvent.args[2]).to.equal(ethers.parseEther("50")); // value
    });
  });
});
