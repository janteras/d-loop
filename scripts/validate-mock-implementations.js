/**
 * D-Loop Protocol - Mock Implementation Validator
 * 
 * This script validates that all mock contracts properly implement their respective interfaces.
 * It performs static analysis of the contract code to ensure all required interface methods
 * are implemented in the mock contracts.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const MOCKS_DIR = path.join(__dirname, '../test/mocks');
const INTERFACES_DIR = path.join(__dirname, '../contracts/interfaces');
const CONTRACTS_DIR = path.join(__dirname, '../contracts');

// Function to recursively find all Solidity files in a directory
function findSolidityFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      findSolidityFiles(filePath, fileList);
    } else if (file.name.endsWith('.sol')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Function to extract function signatures from a Solidity file
function extractFunctionSignatures(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const signatures = [];
  
  // Regular expression to match function declarations in interfaces
  // This handles both single-line and multi-line function declarations
  // Updated to match both external and public visibility for more flexibility
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(external|public)\s+([^;{]*)/g;
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const functionName = match[1];
    const params = match[2].trim();
    
    // Create a normalized function signature
    signatures.push({
      name: functionName,
      params: normalizeParams(params),
      fullSignature: `function ${functionName}(${params})`,
      originalText: match[0]
    });
  }
  
  return signatures;
}

// Function to normalize parameter strings for comparison
function normalizeParams(params) {
  if (!params) return [];
  
  return params.split(',')
    .map(param => param.trim())
    .map(param => {
      // Extract parameter type, ignoring parameter name and memory/storage/calldata keywords
      const parts = param.split(' ').filter(p => p.trim() !== '');
      return parts[0]; // Return just the type
    });
}

// Function to check if a mock implements all interface functions
function validateMockImplementation(mockPath, interfacePath) {
  const mockName = path.basename(mockPath, '.sol');
  const interfaceName = path.basename(interfacePath, '.sol');
  
  console.log(`\nValidating ${mockName} against ${interfaceName}...`);
  
  // Extract function signatures
  const interfaceFunctions = extractFunctionSignatures(interfacePath);
  const mockFunctions = extractFunctionSignatures(mockPath);
  
  // Check for missing functions
  const missingFunctions = [];
  
  for (const interfaceFunc of interfaceFunctions) {
    const matchingMockFunc = mockFunctions.find(mockFunc => 
      mockFunc.name === interfaceFunc.name && 
      arraysEqual(mockFunc.params, interfaceFunc.params)
    );
    
    if (!matchingMockFunc) {
      missingFunctions.push(interfaceFunc.fullSignature);
    }
  }
  
  // Report results
  if (missingFunctions.length > 0) {
    console.log(`❌ ${mockName} is missing ${missingFunctions.length} interface functions:`);
    missingFunctions.forEach(func => console.log(`   - ${func}`));
    return false;
  } else {
    console.log(`✅ ${mockName} implements all ${interfaceFunctions.length} interface functions.`);
    return true;
  }
}

// Helper function to compare arrays
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Function to find the corresponding interface for a mock contract
function findCorrespondingInterface(mockPath) {
  const mockName = path.basename(mockPath, '.sol');
  const baseName = mockName.replace(/^Mock/, '');
  
  // Find all interface files
  const interfaceFiles = findSolidityFiles(INTERFACES_DIR);
  
  // Look for an interface with a matching name pattern
  const matchingInterface = interfaceFiles.find(filePath => {
    const interfaceName = path.basename(filePath, '.sol');
    return interfaceName === `I${baseName}`;
  });
  
  return matchingInterface;
}

// Function to find the corresponding contract implementation for a mock
function findCorrespondingImplementation(mockPath) {
  const mockName = path.basename(mockPath, '.sol');
  const baseName = mockName.replace(/^Mock/, '');
  
  // Find all contract files
  const contractFiles = findSolidityFiles(CONTRACTS_DIR);
  
  // Look for a contract with a matching name
  const matchingContract = contractFiles.find(filePath => {
    const contractName = path.basename(filePath, '.sol');
    return contractName === baseName;
  });
  
  return matchingContract;
}

// Main function to validate all mock implementations
function validateAllMocks() {
  console.log('=== D-Loop Protocol Mock Implementation Validator ===\n');
  
  // Find all mock contracts
  const mockFiles = findSolidityFiles(MOCKS_DIR)
    .filter(filePath => path.basename(filePath).startsWith('Mock'));
  
  console.log(`Found ${mockFiles.length} mock contracts.\n`);
  
  // Track validation results
  const results = {
    total: mockFiles.length,
    passed: 0,
    failed: 0,
    noInterface: 0,
    details: []
  };
  
  // Validate each mock contract
  for (const mockPath of mockFiles) {
    const mockName = path.basename(mockPath);
    const interfacePath = findCorrespondingInterface(mockPath);
    const implementationPath = findCorrespondingImplementation(mockPath);
    
    if (interfacePath) {
      const isValid = validateMockImplementation(mockPath, interfacePath);
      
      results.details.push({
        mock: mockName,
        interface: path.basename(interfacePath),
        implementation: implementationPath ? path.basename(implementationPath) : null,
        valid: isValid
      });
      
      if (isValid) {
        results.passed++;
      } else {
        results.failed++;
      }
    } else {
      console.log(`⚠️ No corresponding interface found for ${mockName}.`);
      
      results.details.push({
        mock: mockName,
        interface: null,
        implementation: implementationPath ? path.basename(implementationPath) : null,
        valid: null
      });
      
      results.noInterface++;
    }
  }
  
  // Print summary
  console.log('\n=== Validation Summary ===');
  console.log(`Total mock contracts: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`No interface found: ${results.noInterface}`);
  
  // Print recommendations
  if (results.failed > 0) {
    console.log('\n=== Recommendations ===');
    console.log('The following mock contracts need to be updated to fully implement their interfaces:');
    
    results.details
      .filter(detail => detail.valid === false)
      .forEach(detail => {
        console.log(`- ${detail.mock} (missing methods from ${detail.interface})`);
      });
  }
  
  return results;
}

// Run the validation
validateAllMocks();
