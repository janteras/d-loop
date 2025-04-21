/**
 * D-Loop Protocol - Test Categorization Script
 * 
 * This script analyzes and categorizes the remaining uncategorized test files
 * based on their content and purpose. It then moves them to the appropriate
 * test directories according to the new test structure.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test categories and their corresponding directories
const TEST_CATEGORIES = {
  // Unit test categories
  CORE: 'unit/core',
  GOVERNANCE: 'unit/governance',
  TOKEN: 'unit/token',
  FEES: 'unit/fees',
  IDENTITY: 'unit/identity',
  
  // Integration test categories
  INTEGRATION_FLOWS: 'integration/flows',
  INTEGRATION_GOVERNANCE: 'integration/governance',
  INTEGRATION_FEES: 'integration/fees',
  
  // Security test categories
  SECURITY_ACCESS_CONTROL: 'security/access-control',
  SECURITY_REENTRANCY: 'security/reentrancy',
  SECURITY_EDGE_CASES: 'security/edge-cases',
  
  // Performance test categories
  PERFORMANCE_GAS: 'performance/gas-profiles',
  PERFORMANCE_BENCHMARKS: 'performance/benchmarks',
  PERFORMANCE_OPTIMIZATIONS: 'performance/optimizations',
  
  // Miscellaneous
  OTHER: 'unit/other',
  UTILS: 'utils'
};

// Base test directory
const TEST_DIR = path.join(__dirname, '../test');

// Function to create directories if they don't exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

// Create all necessary directories
Object.values(TEST_CATEGORIES).forEach(dir => {
  ensureDirectoryExists(path.join(TEST_DIR, dir));
});

// Function to determine the category of a test file based on its content and name
function categorizeTestFile(filePath) {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Categorization rules based on filename patterns
  if (fileName.includes('ainode') || fileName.includes('AINode')) {
    return TEST_CATEGORIES.GOVERNANCE;
  }
  
  if (fileName.includes('assetdao') || fileName.includes('AssetDAO')) {
    return TEST_CATEGORIES.CORE;
  }
  
  if (fileName.includes('fee') || fileName.includes('Fee') || fileName.includes('Treasury')) {
    return TEST_CATEGORIES.FEES;
  }
  
  if (fileName.includes('soulbound') || fileName.includes('Soulbound') || fileName.includes('NFT')) {
    return TEST_CATEGORIES.IDENTITY;
  }
  
  if (fileName.includes('token') || fileName.includes('Token') || fileName.includes('approval')) {
    return TEST_CATEGORIES.TOKEN;
  }
  
  if (fileName.includes('protocoldao') || fileName.includes('ProtocolDAO')) {
    return TEST_CATEGORIES.CORE;
  }
  
  if (fileName.includes('gas') || fileName.includes('Gas') || fileName.includes('profile')) {
    return TEST_CATEGORIES.PERFORMANCE_GAS;
  }
  
  if (fileName.includes('integration') || fileName.includes('Integration') || fileName.includes('flow')) {
    return TEST_CATEGORIES.INTEGRATION_FLOWS;
  }
  
  if (fileName.includes('security') || fileName.includes('Security') || fileName.includes('reentrancy')) {
    return TEST_CATEGORIES.SECURITY_REENTRANCY;
  }
  
  if (fileName.includes('benchmark') || fileName.includes('Benchmark')) {
    return TEST_CATEGORIES.PERFORMANCE_BENCHMARKS;
  }
  
  if (fileName.includes('optimization') || fileName.includes('Optimization')) {
    return TEST_CATEGORIES.PERFORMANCE_OPTIMIZATIONS;
  }
  
  // Content-based categorization for more complex cases
  if (fileContent.includes('AINodeGovernance') || fileContent.includes('AINodeRegistry')) {
    return TEST_CATEGORIES.GOVERNANCE;
  }
  
  if (fileContent.includes('AssetDAO') || fileContent.includes('ProtocolDAO')) {
    return TEST_CATEGORIES.CORE;
  }
  
  if (fileContent.includes('FeeCalculator') || fileContent.includes('FeeProcessor')) {
    return TEST_CATEGORIES.FEES;
  }
  
  if (fileContent.includes('SoulboundNFT') || fileContent.includes('identity')) {
    return TEST_CATEGORIES.IDENTITY;
  }
  
  if (fileContent.includes('Token') || fileContent.includes('ERC20')) {
    return TEST_CATEGORIES.TOKEN;
  }
  
  if (fileContent.includes('reentrancy') || fileContent.includes('security')) {
    return TEST_CATEGORIES.SECURITY_REENTRANCY;
  }
  
  if (fileContent.includes('gas profile') || fileContent.includes('gas usage')) {
    return TEST_CATEGORIES.PERFORMANCE_GAS;
  }
  
  // Default category for files that don't match any specific pattern
  return TEST_CATEGORIES.OTHER;
}

// Function to move a test file to its appropriate category
function moveTestFile(filePath, dryRun = false) {
  const fileName = path.basename(filePath);
  const category = categorizeTestFile(filePath);
  const destDir = path.join(TEST_DIR, category);
  const destPath = path.join(destDir, fileName);
  
  // Ensure the destination directory exists
  ensureDirectoryExists(destDir);
  
  console.log(`Moving ${filePath} to ${destPath}`);
  
  if (!dryRun) {
    try {
      // Create the destination directory if it doesn't exist
      if (!fs.existsSync(path.dirname(destPath))) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
      }
      
      // Move the file
      fs.renameSync(filePath, destPath);
      console.log(`✅ Successfully moved ${fileName} to ${category}`);
      
      // Update import paths in the file
      updateImportPaths(destPath);
    } catch (error) {
      console.error(`❌ Error moving ${fileName}: ${error.message}`);
    }
  }
}

// Function to update import paths in a file after moving it
function updateImportPaths(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Calculate the relative path depth
  const relativeDepth = filePath.split(path.sep).length - TEST_DIR.split(path.sep).length;
  const relativePath = '../'.repeat(relativeDepth);
  
  // Update relative imports
  content = content.replace(/require\(['"]\.\.\/([^'"]+)['"]\)/g, `require('${relativePath}$1')`);
  content = content.replace(/from ['"]\.\.\/([^'"]+)['"]/g, `from '${relativePath}$1'`);
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content);
  console.log(`✅ Updated import paths in ${filePath}`);
}

// Main function to categorize and move all uncategorized test files
function categorizeRemainingTests(dryRun = false) {
  console.log(`Starting test categorization (${dryRun ? 'DRY RUN' : 'LIVE RUN'})...`);
  
  // Get all test files in the unit directory
  const unitDir = path.join(TEST_DIR, 'unit');
  const files = fs.readdirSync(unitDir)
    .filter(file => file.endsWith('.unit.test.js'))
    .map(file => path.join(unitDir, file));
  
  console.log(`Found ${files.length} uncategorized test files`);
  
  // Process each file
  files.forEach(file => moveTestFile(file, dryRun));
  
  console.log('Test categorization complete!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the script
categorizeRemainingTests(dryRun);
