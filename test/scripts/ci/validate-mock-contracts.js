/**
 * @title Mock Contract Validation Script
 * @dev CI script to validate that all mock contracts follow D-Loop Protocol standards
 * @notice Run this script as part of CI to ensure mock contract standards are maintained
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const MOCKS_DIR = path.join(__dirname, '../../mocks');
const BASE_MOCK_PATH = path.join(MOCKS_DIR, 'base/BaseMock.sol');
const EXEMPTIONS = [
  'base/BaseMock.sol', // Base mock itself doesn't extend BaseMock
  'MockLegacyConsumer.sol', // Legacy mocks may not follow standards
  'MockPreviousGovernance.sol',
  'MockPreviousNodeRegistry.sol',
  'MockPreviousPriceOracle.sol',
  'MockPreviousSoulboundNFT.sol',
  'MockPreviousVersionDAO.sol'
];

// Validation rules
const rules = {
  namingConvention: {
    description: 'Mock contracts should be prefixed with "Mock"',
    validate: (content, filename) => {
      // Skip BaseMock and legacy mocks
      if (EXEMPTIONS.includes(filename)) return true;
      
      const contractName = getContractName(content);
      
      // Check if contract name starts with Mock
      return contractName.startsWith('Mock');
    }
  },
  extendsBaseMock: {
    description: 'Mock contracts should extend BaseMock',
    validate: (content, filename) => {
      if (EXEMPTIONS.includes(filename)) return true;
      return content.includes('BaseMock') && 
             (content.includes('is BaseMock') || 
              content.includes('is Ownable, BaseMock') || 
              content.includes('is ERC20, Ownable, BaseMock') ||
              content.match(/is [A-Za-z0-9]+, BaseMock/));
    }
  },
  importsBaseMock: {
    description: 'Mock contracts should import BaseMock',
    validate: (content, filename) => {
      if (EXEMPTIONS.includes(filename)) return true;
      return content.includes('import "./base/BaseMock.sol"');
    }
  },
  recordsFunctionCalls: {
    description: 'Mock contracts should record function calls using _recordFunctionCall',
    validate: (content, filename) => {
      if (EXEMPTIONS.includes(filename)) return true;
      return content.includes('_recordFunctionCall');
    }
  },
  hasConstructor: {
    description: 'Mock contracts should have a constructor that calls BaseMock constructor',
    validate: (content, filename) => {
      if (EXEMPTIONS.includes(filename)) return true;
      return content.includes('BaseMock()');
    }
  }
};

// Helper function to extract contract name from content
function getContractName(content) {
  // More robust regex to handle different formatting styles
  const contractMatch = content.match(/contract\s+([A-Za-z0-9_]+)\s+(?:is|\{)/);
  return contractMatch ? contractMatch[1] : '';
}

// Main validation function
function validateMockContracts() {
  console.log('Validating mock contracts against D-Loop Protocol standards...');
  
  // Check if BaseMock exists
  if (!fs.existsSync(BASE_MOCK_PATH)) {
    console.error('❌ BaseMock.sol not found at', BASE_MOCK_PATH);
    process.exit(1);
  }
  
  // Get all mock contract files
  const mockFiles = [];
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        scanDir(filePath);
      } else if (file.endsWith('.sol')) {
        const relativePath = path.relative(MOCKS_DIR, filePath);
        mockFiles.push({
          path: filePath,
          name: relativePath
        });
      }
    });
  }
  scanDir(MOCKS_DIR);
  
  console.log(`Found ${mockFiles.length} mock contract files`);
  
  // Validate each mock contract
  let failedValidations = 0;
  
  mockFiles.forEach(file => {
    console.log(`\nValidating ${file.name}...`);
    const content = fs.readFileSync(file.path, 'utf8');
    
    // Extract contract name for debugging
    const contractName = getContractName(content);
    
    // Apply each validation rule
    Object.entries(rules).forEach(([ruleName, rule]) => {
      const isValid = rule.validate(content, file.name);
      if (isValid) {
        console.log(`  ✅ ${rule.description}`);
      } else {
        if (ruleName === 'namingConvention') {
          console.log(`  ❌ ${rule.description} (Contract name: ${contractName})`);
        } else {
          console.log(`  ❌ ${rule.description}`);
        }
        failedValidations++;
      }
    });
  });
  
  // Report results
  console.log('\n--- Mock Contract Validation Summary ---');
  if (failedValidations === 0) {
    console.log('✅ All mock contracts follow D-Loop Protocol standards');
    return 0;
  } else {
    console.error(`❌ Found ${failedValidations} validation failures`);
    return 1;
  }
}

// Run validation
const exitCode = validateMockContracts();
process.exit(exitCode);
