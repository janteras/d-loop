/**
 * @fileoverview Script to reorganize test files according to the new directory structure
 * 
 * This script helps migrate test files to the new directory structure based on
 * the test organization plan. It analyzes test file names and content to determine
 * the appropriate destination directory.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const TEST_ROOT = path.resolve(__dirname, '../test');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Mapping of contract types to directories
const CONTRACT_TYPE_MAPPING = {
  // Core contracts
  'ProtocolDAO': 'core',
  'AssetDAO': 'core',
  
  // Governance contracts
  'AINodeGovernance': 'governance',
  'AINodeRegistry': 'governance',
  'SimplifiedAdminControls': 'governance',
  'GovernanceRewards': 'governance',
  
  // Token contracts
  'DLoopToken': 'token',
  'TokenApprovalOptimizer': 'token',
  'ERC20': 'token',
  
  // Fee contracts
  'FeeCalculator': 'fees',
  'FeeProcessor': 'fees',
  'FeeSystem': 'fees',
  'Treasury': 'fees',
  
  // Identity contracts
  'SoulboundNFT': 'identity'
};

// Test types
const TEST_TYPES = {
  'unit': 'unit',
  'integration': 'integration',
  'security': 'security',
  'performance': 'performance'
};

/**
 * Determines the appropriate destination directory for a test file
 * @param {string} fileName - The name of the test file
 * @param {string} fileContent - The content of the test file
 * @returns {string} The destination directory
 */
function determineDestination(fileName, fileContent) {
  // Extract contract name and test type from filename
  const match = fileName.match(/^([A-Za-z0-9]+)\.([a-z-]+)\.test\.js$/);
  
  if (!match) {
    return null; // Cannot determine destination
  }
  
  const [, contractName, testType] = match;
  
  // Determine contract type directory
  let contractTypeDir = 'other';
  for (const [contract, dir] of Object.entries(CONTRACT_TYPE_MAPPING)) {
    if (contractName.includes(contract)) {
      contractTypeDir = dir;
      break;
    }
  }
  
  // Determine test type directory
  let testTypeDir = 'unit'; // Default to unit tests
  for (const [type, dir] of Object.entries(TEST_TYPES)) {
    if (testType.includes(type)) {
      testTypeDir = dir;
      break;
    }
  }
  
  // Special cases based on file content
  if (fileContent.includes('integration') || 
      fileContent.includes('end-to-end') || 
      fileName.includes('flow')) {
    testTypeDir = 'integration';
  } else if (fileContent.includes('security') || 
             fileContent.includes('reentrancy') || 
             fileContent.includes('access control')) {
    testTypeDir = 'security';
  } else if (fileContent.includes('gas') || 
             fileContent.includes('performance') || 
             fileContent.includes('benchmark')) {
    testTypeDir = 'performance';
  }
  
  return path.join(TEST_ROOT, testTypeDir, contractTypeDir);
}

/**
 * Migrates a test file to the new directory structure
 * @param {string} sourcePath - The source path of the test file
 */
function migrateTestFile(sourcePath) {
  const fileName = path.basename(sourcePath);
  const fileContent = fs.readFileSync(sourcePath, 'utf8');
  const destDir = determineDestination(fileName, fileContent);
  
  if (!destDir) {
    console.log(`Cannot determine destination for ${fileName}`);
    return;
  }
  
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    if (!DRY_RUN) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (VERBOSE) {
      console.log(`Created directory: ${destDir}`);
    }
  }
  
  const destPath = path.join(destDir, fileName);
  
  if (VERBOSE) {
    console.log(`Moving ${sourcePath} to ${destPath}`);
  }
  
  if (!DRY_RUN) {
    // Copy the file to the new location
    fs.copyFileSync(sourcePath, destPath);
    
    // Update import paths in the file
    let updatedContent = fileContent;
    // TODO: Update import paths if needed
    
    fs.writeFileSync(destPath, updatedContent);
  }
}

/**
 * Main function to run the migration
 */
function main() {
  console.log('Starting test reorganization...');
  
  if (DRY_RUN) {
    console.log('DRY RUN: No files will be moved');
  }
  
  // Find all test files
  const testFiles = glob.sync(`${TEST_ROOT}/**/*.test.js`);
  
  console.log(`Found ${testFiles.length} test files`);
  
  // Migrate each test file
  for (const testFile of testFiles) {
    migrateTestFile(testFile);
  }
  
  console.log('Test reorganization complete!');
}

// Run the script
main();
