/**
 * Script to run all tests and generate a comprehensive coverage report
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure reports directory exists
if (!fs.existsSync('./reports')) {
  fs.mkdirSync('./reports');
}
if (!fs.existsSync('./reports/coverage')) {
  fs.mkdirSync('./reports/coverage');
}

console.log('Running all tests with coverage...');
try {
  // Run hardhat coverage with all test files
  execSync('npx hardhat coverage', { stdio: 'inherit' });
  
  console.log('Coverage report generated successfully!');
  console.log('Check ./reports/coverage/index.html for the HTML report');
  console.log('Check ./reports/coverage/coverage-summary.json for the JSON summary');
} catch (error) {
  console.error('Error running coverage:', error.message);
  process.exit(1);
}
