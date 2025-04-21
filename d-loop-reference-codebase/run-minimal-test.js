// Minimal test script for quick validation
// This script doesn't attempt to compile contracts and runs basic verification only

// Node.js built-in modules
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const REPORT_FILE = 'minimal-test-report.log';

function log(message) {
  console.log(message);
  fs.appendFileSync(REPORT_FILE, message + '\n');
}

// Initialize report file
fs.writeFileSync(REPORT_FILE, `DLOOP Minimal Test Report: ${new Date().toISOString()}\n\n`);

// Check structure without compilation
function checkProjectStructure() {
  log('Checking project structure...');
  
  // Check key directories
  const expectedDirs = ['contracts', 'test', 'scripts'];
  const missingDirs = expectedDirs.filter(dir => !fs.existsSync(dir));
  
  if (missingDirs.length > 0) {
    log(`WARNING: Missing directories: ${missingDirs.join(', ')}`);
  } else {
    log('✓ All expected directories present');
  }
  
  // Check key contract presence
  const contractsDir = 'contracts';
  if (fs.existsSync(contractsDir)) {
    const allFiles = [];
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.sol')) {
          allFiles.push(fullPath);
        }
      }
    };
    
    walkDir(contractsDir);
    log(`Found ${allFiles.length} Solidity files`);
    
    // Look for key contracts
    const keyContracts = [
      'DLoopToken',
      'AssetDAO',
      'ProtocolDAO',
      'Governance',
      'FeeCalculator',
      'Treasury'
    ];
    
    for (const contract of keyContracts) {
      const found = allFiles.some(file => file.includes(contract));
      log(`${found ? '✓' : '✗'} ${contract} contract ${found ? 'found' : 'not found'}`);
    }
  }
  
  // Check for duplicate files
  log('\nChecking for duplicate contract files...');
  const duplicateCheck = {};
  const findDuplicates = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findDuplicates(fullPath);
      } else if (entry.name.endsWith('.sol')) {
        if (!duplicateCheck[entry.name]) {
          duplicateCheck[entry.name] = [fullPath];
        } else {
          duplicateCheck[entry.name].push(fullPath);
        }
      }
    }
  };
  
  if (fs.existsSync('contracts')) {
    findDuplicates('contracts');
    
    // Report duplicates
    let hasDuplicates = false;
    for (const [filename, paths] of Object.entries(duplicateCheck)) {
      if (paths.length > 1) {
        hasDuplicates = true;
        log(`⚠️ Duplicate file: ${filename} found in:`);
        paths.forEach(p => log(`  - ${p}`));
      }
    }
    
    if (!hasDuplicates) {
      log('✓ No duplicate contract files found');
    }
  }
}

// Check hardhat configuration
function checkHardhatConfig() {
  log('\nChecking Hardhat configuration...');
  
  if (!fs.existsSync('hardhat.config.js')) {
    log('✗ hardhat.config.js not found');
    return;
  }
  
  try {
    const config = require('./hardhat.config.js');
    log('✓ hardhat.config.js successfully loaded');
    
    // Check networks configuration
    if (config.networks) {
      const networks = Object.keys(config.networks);
      log(`Networks configured: ${networks.join(', ')}`);
    } else {
      log('⚠️ No networks configured in hardhat.config.js');
    }
    
    // Check compiler settings
    if (config.solidity) {
      if (typeof config.solidity === 'object' && config.solidity.compilers) {
        const versions = config.solidity.compilers.map(c => c.version);
        log(`Compiler versions: ${versions.join(', ')}`);
      } else if (typeof config.solidity === 'string') {
        log(`Compiler version: ${config.solidity}`);
      } else if (typeof config.solidity === 'object') {
        log(`Compiler version: ${config.solidity.version || 'unknown'}`);
      }
    } else {
      log('⚠️ No solidity compiler configured');
    }
    
  } catch (error) {
    log(`✗ Error parsing hardhat.config.js: ${error.message}`);
  }
}

// Check test files structure
function checkTestFiles() {
  log('\nChecking test files...');
  
  if (!fs.existsSync('test')) {
    log('✗ test directory not found');
    return;
  }
  
  const testFiles = [];
  const walkDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
        testFiles.push(fullPath);
      }
    }
  };
  
  walkDir('test');
  log(`Found ${testFiles.length} test files`);
  
  // Categorize tests
  const categories = {
    'Unit tests': testFiles.filter(f => !f.includes('integration') && !f.includes('gas')),
    'Integration tests': testFiles.filter(f => f.includes('integration')),
    'Gas analysis': testFiles.filter(f => f.includes('gas')),
  };
  
  for (const [category, files] of Object.entries(categories)) {
    log(`${category}: ${files.length} files`);
  }
}

// Verify npm packages
function checkDependencies() {
  log('\nChecking dependencies...');
  
  if (!fs.existsSync('package.json')) {
    log('✗ package.json not found');
    return;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check key dependencies
    const requiredDeps = [
      'hardhat',
      '@openzeppelin/contracts',
      '@nomicfoundation/hardhat-toolbox',
      'chai',
      'ethers'
    ];
    
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    for (const dep of requiredDeps) {
      if (allDeps[dep]) {
        log(`✓ ${dep}: ${allDeps[dep]}`);
      } else {
        log(`✗ Missing dependency: ${dep}`);
      }
    }
    
  } catch (error) {
    log(`✗ Error parsing package.json: ${error.message}`);
  }
}

// Run simple test file
function runSimpleTest() {
  log('\nTrying to run a simple test...');
  
  // Create a simple test if it doesn't exist
  const simpleTestPath = 'test/SimpleTest.js';
  if (!fs.existsSync(simpleTestPath)) {
    log('Creating a simple test file...');
    const simpleTest = `
const { expect } = require("chai");

describe("Simple Test", function() {
  it("should pass a basic assertion", function() {
    expect(1 + 1).to.equal(2);
  });
});
`;
    fs.writeFileSync(simpleTestPath, simpleTest);
    log('✓ Simple test file created');
  }
  
  try {
    log('Running simple test with --no-compile flag...');
    const output = execSync('npx hardhat test test/SimpleTest.js --no-compile', { 
      timeout: 30000,
      stdio: 'pipe' 
    }).toString();
    log('✓ Simple test executed successfully');
    log(output);
  } catch (error) {
    log(`✗ Error running simple test: ${error.message}`);
  }
}

// Main function
async function main() {
  log('DLOOP Smart Contracts - Minimal Validation Test\n');
  
  try {
    // Check if Hardhat is installed
    const hardhatVersion = execSync('npx hardhat --version', { stdio: 'pipe' }).toString().trim();
    log(`Hardhat version: ${hardhatVersion}`);
  } catch (error) {
    log('✗ Hardhat not installed or not accessible');
    process.exit(1);
  }
  
  // Run checks
  checkProjectStructure();
  checkHardhatConfig();
  checkTestFiles();
  checkDependencies();
  runSimpleTest();
  
  log('\n--- Summary ---');
  log('Environment validation complete. Check the report for details.');
  log(`Report saved to: ${REPORT_FILE}`);
}

// Run the script
main()
  .then(() => {
    log('\nValidation complete!');
    process.exit(0);
  })
  .catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  });