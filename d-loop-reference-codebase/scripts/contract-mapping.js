// SPDX-License-Identifier: MIT
/**
 * Contract Mapping Utility
 * 
 * This script provides a mapping between original contracts and their consolidated equivalents.
 * Use this as a reference when updating deployment scripts or migrating existing systems.
 */

const contractMapping = {
  // Core tokens
  "DLoopToken": {
    original: "contracts/token/DLoopToken.sol",
    consolidated: "consolidated-contracts/tokens/DLoopToken.sol",
    notes: "Implementation remains largely the same with minor optimizations"
  },
  
  // Oracle system
  "RateQuoterV2": {
    original: "attached_assets/RateQuoterV2.sol",
    consolidated: "consolidated-contracts/oracles/ChainlinkPriceOracle.sol",
    notes: "Functionality split between ChainlinkPriceOracle and MultiOracleConsensus"
  },
  
  // Asset management
  "AssetDAO": {
    original: "contracts/dao/AssetDAO.sol",
    consolidated: "consolidated-contracts/fees/AssetDAOWithFees.sol",
    notes: "Enhanced with fee collection and treasury integration"
  },
  
  // Treasury
  "Treasury": {
    original: "contracts/treasury/Treasury.sol",
    consolidated: "consolidated-contracts/fees/Treasury.sol",
    notes: "Enhanced to support fee distribution"
  },
  
  // Governance
  "ProtocolDAO": {
    original: "contracts/governance/ProtocolDAO.sol",
    consolidated: "consolidated-contracts/governance/ProtocolDAO.sol",
    notes: "Enhanced with AI node voting capabilities"
  },
  
  // Utilities and services
  "FeeCalculator": {
    original: "contracts/fees/FeeCalculator.sol",
    consolidated: "consolidated-contracts/fees/FeeCalculator.sol",
    notes: "Enhanced with configurable parameters"
  },
  
  // Identity
  "AINodeRegistry": {
    original: "contracts/identity/AINodeRegistry.sol",
    consolidated: "consolidated-contracts/identity/AINodeRegistry.sol",
    notes: "Enhanced with SoulboundNFT integration"
  },
  
  "SoulboundNFT": {
    original: "contracts/identity/SoulboundNFT.sol",
    consolidated: "consolidated-contracts/identity/SoulboundNFT.sol",
    notes: "Enhanced with verification capabilities"
  },
  
  // Oracles
  "MultiOracleConsensus": {
    original: "contracts/oracles/MultiOracleConsensus.sol",
    consolidated: "consolidated-contracts/oracles/MultiOracleConsensus.sol",
    notes: "Enhanced with weighted consensus algorithms"
  },
  
  "ChainlinkPriceOracle": {
    original: "contracts/oracles/ChainlinkPriceOracle.sol",
    consolidated: "consolidated-contracts/oracles/ChainlinkPriceOracle.sol",
    notes: "Enhanced with circuit breaker mechanism"
  },
  
  // Bridges
  "HederaBridge": {
    original: "contracts/bridge/HederaBridge.sol",
    consolidated: "consolidated-contracts/bridge/HederaBridge.sol",
    notes: "Enhanced with security features and validator threshold"
  }
};

// Function to get the consolidated equivalent of an original contract
function getConsolidatedEquivalent(originalContractName) {
  const mapping = contractMapping[originalContractName];
  if (!mapping) {
    return {
      error: `No mapping found for contract: ${originalContractName}`
    };
  }
  return mapping;
}

// Export the mapping and helper function
module.exports = {
  contractMapping,
  getConsolidatedEquivalent
};

// Example usage (if run directly)
if (require.main === module) {
  console.log("DLOOP Contract Mapping Reference");
  console.log("===============================");
  
  Object.keys(contractMapping).forEach(contract => {
    const mapping = contractMapping[contract];
    console.log(`\n${contract}:`);
    console.log(`  Original: ${mapping.original}`);
    console.log(`  Consolidated: ${mapping.consolidated}`);
    console.log(`  Notes: ${mapping.notes}`);
  });
}