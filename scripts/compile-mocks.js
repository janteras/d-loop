/**
 * @title Compile Mocks Script
 * @dev Script to compile mock contracts before running tests
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define paths
const MOCKS_DIR = path.join(__dirname, '../test/mocks');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/test/mocks');

// Ensure artifacts directory exists
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

console.log('Compiling mock contracts...');

// Find all mock contracts
const mockFiles = fs.readdirSync(MOCKS_DIR)
  .filter(file => file.endsWith('.sol') && !file.startsWith('.'));

console.log(`Found ${mockFiles.length} mock contracts to compile`);

// Compile each mock contract using solc directly
mockFiles.forEach(file => {
  const filePath = path.join(MOCKS_DIR, file);
  console.log(`Compiling ${file}...`);
  
  try {
    // Use hardhat to compile the contract
    execSync(`npx hardhat compile --files ${filePath}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`Successfully compiled ${file}`);
  } catch (error) {
    console.error(`Error compiling ${file}:`, error.message);
    process.exit(1);
  }
});

console.log('All mock contracts compiled successfully!');
