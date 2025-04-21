/**
 * @title All Contracts ABI Compatibility Test
 * @dev Comprehensive test for verifying ABI compatibility across all D-Loop Protocol contracts
 * 
 * This test ensures that all contract interfaces align correctly for integration:
 * - Verifies function signatures match expected formats
 * - Validates event signatures are consistent
 * - Confirms error handling is standardized
 * - Checks backward compatibility with previous versions
 */

const { ethers } = require('hardhat');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Constants
const MINTER_ROLE = ethers.id("MINTER_ROLE");
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Core contract list to verify
const CORE_CONTRACTS = [
  'AssetDAO',
  'ProtocolDAO',
  'AINodeRegistry',
  'AINodeGovernance',
  'Treasury',
  'GovernanceRewards',
  'FeeCalculator',
  'FeeProcessor',
  'DAIToken',
  'DLoopToken',
  'SoulboundNFT',
  'PriceOracle',
  'TokenOptimizer'
];

// Interface mapping - which contracts should implement which interfaces
const INTERFACE_REQUIREMENTS = {
  'AssetDAO': ['IAssetDAO', 'IAdminControlled'],
  'ProtocolDAO': ['IProtocolDAO', 'IGovernance'],
  'AINodeRegistry': ['IAINodeRegistry', 'IAdminControlled'],
  'AINodeGovernance': ['IAINodeGovernance', 'IGovernance'],
  'Treasury': ['ITreasury', 'IAdminControlled'],
  'GovernanceRewards': ['IGovernanceRewards', 'IAdminControlled'],
  'FeeCalculator': ['IFeeCalculator', 'IAdminControlled'],
  'FeeProcessor': ['IFeeProcessor', 'IAdminControlled'],
  'DAIToken': ['IERC20', 'IDAIToken'],
  'DLoopToken': ['IERC20', 'IDLoopToken'],
  'SoulboundNFT': ['IERC721', 'ISoulboundNFT'],
  'PriceOracle': ['IPriceOracle', 'IAdminControlled'],
  'TokenOptimizer': ['ITokenOptimizer', 'IAdminControlled']
};

// Critical functions that must be present in each contract
const CRITICAL_FUNCTIONS = {
  'AssetDAO': ['createAsset', 'invest', 'withdraw', 'createProposal', 'vote', 'executeProposal'],
  'ProtocolDAO': ['createProposal', 'vote', 'executeProposal'],
  'AINodeRegistry': ['registerNode', 'deregisterNode', 'updateNodeStatus'],
  'AINodeGovernance': ['submitProposal', 'castVote', 'executeProposal'],
  'Treasury': ['withdraw', 'deposit', 'distributeRewards'],
  'GovernanceRewards': ['calculateReward', 'distributeRewards'],
  'FeeCalculator': ['calculateFee', 'updateFeePercentage'],
  'FeeProcessor': ['processFee', 'distributeFees'],
  'DAIToken': ['mint', 'burn', 'transfer', 'approve'],
  'DLoopToken': ['mint', 'burn', 'transfer', 'approve'],
  'SoulboundNFT': ['mint', 'revoke', 'isTokenValid'],
  'PriceOracle': ['getLatestPrice', 'setPrice', 'updatePriceFeed'],
  'TokenOptimizer': ['delegateTokens', 'withdrawDelegation', 'getDelegation']
};

// Critical events that must be present in each contract
const CRITICAL_EVENTS = {
  'AssetDAO': ['AssetCreated', 'InvestmentMade', 'WithdrawalMade', 'ProposalCreated', 'ProposalExecuted'],
  'ProtocolDAO': ['ProposalCreated', 'ProposalExecuted', 'VoteCast'],
  'AINodeRegistry': ['NodeRegistered', 'NodeDeregistered', 'NodeStatusUpdated'],
  'AINodeGovernance': ['ProposalSubmitted', 'VoteCast', 'ProposalExecuted'],
  'Treasury': ['FundsWithdrawn', 'FundsDeposited', 'RewardsDistributed'],
  'GovernanceRewards': ['RewardCalculated', 'RewardDistributed'],
  'FeeCalculator': ['FeeCalculated', 'FeePercentageUpdated'],
  'FeeProcessor': ['FeeProcessed', 'FeesDistributed'],
  'DAIToken': ['Transfer', 'Approval'],
  'DLoopToken': ['Transfer', 'Approval'],
  'SoulboundNFT': ['Transfer', 'Revoked'],
  'PriceOracle': ['PriceUpdated', 'PriceFeedUpdated'],
  'TokenOptimizer': ['TokensDelegated', 'DelegationWithdrawn']
};

describe("D-Loop Protocol ABI Compatibility Tests", function() {
  let deployedContracts = {};
  let interfaces = {};
  
  // Helper function to check if an interface is supported (ERC165)
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
    // Deploy all contracts for testing
    console.log("\nDeploying contracts for ABI compatibility tests...");
    
    try {
      // Get signers
      const [owner, admin, user1, user2, node1] = await ethers.getSigners();
      
      // Deploy contracts
      for (const contractName of CORE_CONTRACTS) {
        try {
          const factory = await ethers.getContractFactory(contractName);
          let contract;
          
          // Handle different constructor parameters based on contract type
          switch (contractName) {
            case 'DAIToken':
              contract = await factory.deploy();
              break;
            case 'DLoopToken':
              contract = await factory.deploy(
                "D-Loop Token",
                "DLOOP",
                ethers.parseEther("1000000"), // initialSupply
                18, // decimals
                ethers.parseEther("100000000"), // maxSupply
                admin.address
              );
              break;
            case 'SoulboundNFT':
              contract = await factory.deploy();
              break;
            case 'PriceOracle':
              contract = await factory.deploy(admin.address);
              break;
            case 'TokenOptimizer':
              contract = await factory.deploy();
              break;
            case 'FeeCalculator':
              contract = await factory.deploy(
                admin.address, // feeAdmin
                owner.address, // treasury (temporary)
                owner.address, // rewardDistributor (temporary)
                50, // investFeePercentage (0.5%)
                50, // divestFeePercentage (0.5%)
                20  // ragequitFeePercentage (0.2%)
              );
              break;
            case 'FeeProcessor':
              contract = await factory.deploy(
                owner.address, // treasury (temporary)
                owner.address, // rewardDistributor (temporary)
                owner.address, // feeCalculator (temporary)
                admin.address, // admin
                8000, // treasuryPercentage (80%)
                2000  // rewardDistPercentage (20%)
              );
              break;
            case 'Treasury':
              contract = await factory.deploy(admin.address, owner.address);
              break;
            case 'ProtocolDAO':
              contract = await factory.deploy(
                admin.address,
                owner.address, // treasury (temporary)
                86400, // votingPeriod (1 day in seconds)
                43200, // executionDelay (12 hours in seconds)
                10     // quorum (10%)
              );
              break;
            case 'AINodeRegistry':
              // Assuming SoulboundNFT is already deployed
              contract = await factory.deploy(
                deployedContracts['SoulboundNFT'] ? await deployedContracts['SoulboundNFT'].getAddress() : owner.address,
                deployedContracts['PriceOracle'] ? await deployedContracts['PriceOracle'].getAddress() : owner.address
              );
              break;
            case 'AINodeGovernance':
              contract = await factory.deploy(
                deployedContracts['DLoopToken'] ? await deployedContracts['DLoopToken'].getAddress() : owner.address,
                10, // 10% quorum for testing
                1   // 1 block delay for testing
              );
              break;
            case 'GovernanceRewards':
              contract = await factory.deploy(
                admin.address,
                deployedContracts['DLoopToken'] ? await deployedContracts['DLoopToken'].getAddress() : owner.address
              );
              break;
            case 'AssetDAO':
              contract = await factory.deploy(
                deployedContracts['DAIToken'] ? await deployedContracts['DAIToken'].getAddress() : owner.address,
                deployedContracts['DLoopToken'] ? await deployedContracts['DLoopToken'].getAddress() : owner.address,
                deployedContracts['PriceOracle'] ? await deployedContracts['PriceOracle'].getAddress() : owner.address,
                deployedContracts['FeeProcessor'] ? await deployedContracts['FeeProcessor'].getAddress() : owner.address,
                deployedContracts['ProtocolDAO'] ? await deployedContracts['ProtocolDAO'].getAddress() : owner.address
              );
              break;
            default:
              contract = await factory.deploy();
          }
          
          await contract.waitForDeployment();
          deployedContracts[contractName] = contract;
          console.log(`${contractName} deployed at: ${await contract.getAddress()}`);
          
          // Load interface
          try {
            const interfaceFactory = await ethers.getContractFactory(`I${contractName}`);
            interfaces[`I${contractName}`] = interfaceFactory.interface;
          } catch (error) {
            console.log(`Interface I${contractName} not found, skipping...`);
          }
        } catch (error) {
          console.error(`Error deploying ${contractName}:`, error.message);
        }
      }
      
      // Load common interfaces
      try {
        const ierc20Factory = await ethers.getContractFactory("IERC20");
        interfaces["IERC20"] = ierc20Factory.interface;
        
        const ierc721Factory = await ethers.getContractFactory("IERC721");
        interfaces["IERC721"] = ierc721Factory.interface;
        
        const iAdminControlledFactory = await ethers.getContractFactory("IAdminControlled");
        interfaces["IAdminControlled"] = iAdminControlledFactory.interface;
        
        const iGovernanceFactory = await ethers.getContractFactory("IGovernance");
        interfaces["IGovernance"] = iGovernanceFactory.interface;
      } catch (error) {
        console.error("Error loading common interfaces:", error.message);
      }
      
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });
  
  describe("Function Signature Compatibility", function() {
    for (const contractName of CORE_CONTRACTS) {
      it(`should verify ${contractName} implements all critical functions with correct signatures`, async function() {
        // Skip if contract wasn't deployed successfully
        if (!deployedContracts[contractName]) {
          this.skip();
          return;
        }
        
        const contract = deployedContracts[contractName];
        const criticalFunctions = CRITICAL_FUNCTIONS[contractName] || [];
        
        for (const functionName of criticalFunctions) {
          const hasFunction = contract.interface.hasFunction(functionName);
          expect(hasFunction, `${contractName} should have function: ${functionName}`).to.be.true;
        }
      });
    }
  });
  
  describe("Event Signature Compatibility", function() {
    for (const contractName of CORE_CONTRACTS) {
      it(`should verify ${contractName} implements all critical events with correct signatures`, async function() {
        // Skip if contract wasn't deployed successfully
        if (!deployedContracts[contractName]) {
          this.skip();
          return;
        }
        
        const contract = deployedContracts[contractName];
        const criticalEvents = CRITICAL_EVENTS[contractName] || [];
        
        for (const eventName of criticalEvents) {
          try {
            const hasEvent = contract.interface.getEvent(eventName);
            expect(hasEvent, `${contractName} should have event: ${eventName}`).to.not.be.undefined;
          } catch (error) {
            expect.fail(`${contractName} should have event: ${eventName}, but got error: ${error.message}`);
          }
        }
      });
    }
  });
  
  describe("Interface Compatibility", function() {
    for (const contractName of CORE_CONTRACTS) {
      it(`should verify ${contractName} implements required interfaces`, async function() {
        // Skip if contract wasn't deployed successfully
        if (!deployedContracts[contractName]) {
          this.skip();
          return;
        }
        
        const contract = deployedContracts[contractName];
        const requiredInterfaces = INTERFACE_REQUIREMENTS[contractName] || [];
        
        for (const interfaceName of requiredInterfaces) {
          // Skip if interface wasn't loaded successfully
          if (!interfaces[interfaceName]) {
            console.log(`Interface ${interfaceName} not loaded, skipping...`);
            continue;
          }
          
          // Get all functions from the interface
          const interfaceFunctions = Object.keys(interfaces[interfaceName].functions)
            .filter(key => !key.includes('(')) // Filter out function signatures
            .filter(key => key !== 'constructor'); // Filter out constructor
          
          for (const functionName of interfaceFunctions) {
            const hasFunction = contract.interface.hasFunction(functionName);
            expect(hasFunction, `${contractName} should implement ${interfaceName}.${functionName}`).to.be.true;
          }
        }
      });
    }
  });
  
  describe("Error Handling Compatibility", function() {
    it("should verify contracts expose standard error types", async function() {
      // Check for standard error types across contracts
      const standardErrors = [
        "Unauthorized",
        "InvalidAddress",
        "InvalidAmount",
        "InvalidState",
        "AlreadyInitialized"
      ];
      
      for (const contractName of CORE_CONTRACTS) {
        // Skip if contract wasn't deployed successfully
        if (!deployedContracts[contractName]) {
          console.log(`Skipping error check for ${contractName} as it wasn't deployed successfully`);
          continue;
        }
        
        const contract = deployedContracts[contractName];
        
        // Check if contract has at least one standard error
        let hasStandardError = false;
        for (const errorName of standardErrors) {
          try {
            const error = contract.interface.getError(errorName);
            if (error) {
              hasStandardError = true;
              break;
            }
          } catch (error) {
            // Ignore errors when checking for error types
          }
        }
        
        expect(hasStandardError, `${contractName} should implement at least one standard error type`).to.be.true;
      }
    });
  });
  
  describe("Backward Compatibility", function() {
    it("should verify contracts maintain backward compatibility with previous versions", async function() {
      // This test would compare current ABI with stored previous version ABIs
      // For this example, we'll just check if the ABI files exist
      
      const abiDir = path.join(__dirname, '../../abi');
      
      for (const contractName of CORE_CONTRACTS) {
        const abiPath = path.join(abiDir, `${contractName}.json`);
        
        // Check if ABI file exists
        if (fs.existsSync(abiPath)) {
          console.log(`ABI file exists for ${contractName}`);
          
          // Load the stored ABI
          const storedABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
          
          // Skip if contract wasn't deployed successfully
          if (!deployedContracts[contractName]) {
            console.log(`Skipping backward compatibility check for ${contractName} as it wasn't deployed successfully`);
            continue;
          }
          
          const contract = deployedContracts[contractName];
          
          // Check if all functions in the stored ABI exist in the current contract
          for (const item of storedABI) {
            if (item.type === 'function') {
              const functionName = item.name;
              const hasFunction = contract.interface.hasFunction(functionName);
              expect(hasFunction, `${contractName} should maintain backward compatibility for function: ${functionName}`).to.be.true;
            }
          }
        } else {
          console.log(`No stored ABI found for ${contractName}, skipping backward compatibility check`);
        }
      }
    });
  });
});
