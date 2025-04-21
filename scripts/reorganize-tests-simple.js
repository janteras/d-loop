/**
 * @fileoverview Simple script to reorganize test files according to the new directory structure
 * 
 * This script helps migrate test files to the new directory structure based on
 * file naming patterns. It uses only built-in Node.js modules.
 */

const fs = require('fs');
const path = require('path');

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
 * Get all files in a directory recursively
 * @param {string} dir - Directory to search
 * @param {Array<string>} fileList - Accumulator for file list
 * @returns {Array<string>} List of files
 */
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.test.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Determines the appropriate destination directory for a test file
 * @param {string} fileName - The name of the test file
 * @returns {string} The destination directory
 */
function determineDestination(fileName) {
  // Extract contract name and test type from filename
  const baseName = path.basename(fileName);
  const match = baseName.match(/^([A-Za-z0-9]+)\.([a-z-]+)\.test\.js$/);
  
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
  
  return path.join(TEST_ROOT, testTypeDir, contractTypeDir);
}

/**
 * Migrates a test file to the new directory structure
 * @param {string} sourcePath - The source path of the test file
 */
function migrateTestFile(sourcePath) {
  const destDir = determineDestination(sourcePath);
  
  if (!destDir) {
    console.log(`Cannot determine destination for ${path.basename(sourcePath)}`);
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
  
  const destPath = path.join(destDir, path.basename(sourcePath));
  
  if (VERBOSE) {
    console.log(`Moving ${sourcePath} to ${destPath}`);
  }
  
  if (!DRY_RUN) {
    // Copy the file to the new location
    fs.copyFileSync(sourcePath, destPath);
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
  const testFiles = getAllFiles(path.join(TEST_ROOT, 'unit'));
  
  console.log(`Found ${testFiles.length} test files`);
  
  // Migrate each test file
  for (const testFile of testFiles) {
    migrateTestFile(testFile);
  }
  
  console.log('Test reorganization complete!');
}

// Run the script
main();
