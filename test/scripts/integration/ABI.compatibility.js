/**
 * @title ABI Compatibility Test
 * @dev Tests the ABI compatibility across different contract interfaces
 *      to ensure backward compatibility for integration
 * @author DLOOP Protocol Team
 */

// Import helper utilities for ethers cross-version compatibility
const helpers = require('../utils/ethers-helpers');
const fs = require('fs');
const path = require('path');

// Use standalone test pattern to avoid hardhat runtime issues
async function main() {
  console.log("==== Starting ABI Compatibility Test ====");
  
  try {
    // Define the contracts we want to check
    const contracts = [
      "SoulboundNFT",
      "AINodeRegistry",
      "ProtocolDAO",
      "Treasury",
      "FeeCalculator"
    ];
    
    // Define key function signatures that should be present for compatibility
    const expectedFunctions = {
      "SoulboundNFT": [
        "mint(address,string)",
        "revoke(uint256)",
        "isValidToken(uint256)",
        "hasRole(bytes32,address)",
        "grantRole(bytes32,address)",
        "revokeRole(bytes32,address)",
        "tokenURI(uint256)"
      ],
      "AINodeRegistry": [
        "registerNode(address,string,string,string,string)",
        "deactivateNode(address)",
        "activateNode(address)",
        "getNodeInfo(address)",
        "getNodeTokenId(address)",
        "updateNodeMetadata(address,string,string)"
      ],
      "ProtocolDAO": [
        "executeProposal(uint256)",
        "hasRole(bytes32,address)",
        "grantRole(bytes32,address)",
        "revokeRole(bytes32,address)"
      ],
      "Treasury": [
        "transferFunds(address,address,uint256)",
        "hasRole(bytes32,address)",
        "deposit(address,uint256)"
      ],
      "FeeCalculator": [
        "calculateFee(uint256)",
        "collectFee(address,address,uint256,string)",
        "setDefaultFeeRate(uint256)"
      ]
    };
    
    // Process each contract for ABI compatibility
    let allCompatible = true;
    
    for (const contractName of contracts) {
      console.log(`\nChecking ABI compatibility for ${contractName}...`);
      
      // Try to locate artifact
      const potentialPaths = [
        path.join(__dirname, `../../artifacts/contracts/${contractName}.sol/${contractName}.json`),
        path.join(__dirname, `../../artifacts/contracts/core/${contractName}.sol/${contractName}.json`),
        path.join(__dirname, `../../artifacts/contracts/fees/${contractName}.sol/${contractName}.json`),
        path.join(__dirname, `../../artifacts/contracts/governance/${contractName}.sol/${contractName}.json`),
        path.join(__dirname, `../../artifacts/contracts/identity/${contractName}.sol/${contractName}.json`),
        path.join(__dirname, `../../artifacts/contracts/oracles/${contractName}.sol/${contractName}.json`),
      ];
      
      let artifact = null;
      let artifactPath = '';
      
      for (const potentialPath of potentialPaths) {
        if (fs.existsSync(potentialPath)) {
          artifactPath = potentialPath;
          artifact = JSON.parse(fs.readFileSync(potentialPath, 'utf8'));
          console.log(`Found artifact at: ${potentialPath}`);
          break;
        }
      }
      
      if (!artifact) {
        console.error(`Error: Could not find artifact for ${contractName}`);
        allCompatible = false;
        continue;
      }
      
      // Extract function signatures from ABI
      const functionSignatures = artifact.abi
        .filter(item => item.type === 'function')
        .map(func => {
          const name = func.name;
          const inputs = func.inputs.map(input => input.type).join(',');
          return `${name}(${inputs})`;
        });
      
      console.log(`Found ${functionSignatures.length} function signatures in ABI`);
      
      // Check if all expected functions are present
      const expectedForContract = expectedFunctions[contractName] || [];
      const missingFunctions = [];
      
      for (const expected of expectedForContract) {
        if (!functionSignatures.some(sig => sig === expected)) {
          missingFunctions.push(expected);
        }
      }
      
      if (missingFunctions.length > 0) {
        console.error(`Missing expected functions in ${contractName}:`);
        for (const missing of missingFunctions) {
          console.error(`  - ${missing}`);
        }
        allCompatible = false;
      } else {
        console.log(`✓ ${contractName} contains all expected functions for backward compatibility`);
      }
      
      // Output all available functions for reference
      console.log(`\nAll available functions in ${contractName}:`);
      for (const sig of functionSignatures) {
        console.log(`  - ${sig}`);
      }
    }
    
    if (allCompatible) {
      console.log("\n✓ All contracts passed ABI compatibility checks");
    } else {
      console.error("\n✗ Some contracts failed ABI compatibility checks");
    }
    
    console.log("\n==== ABI Compatibility Test Complete ====");
    
    return {
      success: allCompatible,
      message: allCompatible ? 
        "All contracts are ABI compatible" : 
        "Some contracts have ABI compatibility issues"
    };
  } catch (error) {
    console.error("Error in ABI compatibility test:", error);
    return {
      success: false,
      message: `Error during ABI compatibility test: ${error.message}`
    };
  }
}

// Only run as a script
if (require.main === module) {
  main()
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}

// Export for testing framework
module.exports = { main };