// Standalone Test Runner Script
// This script runs comprehensive test suites for core contracts one by one
// to avoid resource contention and port conflicts

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configure the tests to run
const tests = [
  // Original test suite
  {
    name: "SoulboundNFT Tests",
    command: "npx hardhat test test/gas/SoulboundNFT.gas.js --config hardhat.config.gas.js",
    needsNode: false
  },
  {
    name: "Treasury Tests",
    command: "npx hardhat test test/fees/Treasury.reentrancy.minimal.js --config hardhat.config.simple.js",
    needsNode: false
  },
  {
    name: "FeeCalculator Tests",
    command: "npx hardhat test test/fees/FeeCalculator.simple.js --config hardhat.config.simple.js",
    needsNode: false
  },
  {
    name: "ProtocolDAO Tests",
    command: "npx hardhat test test/core/ProtocolDAO.test.simple.js --config hardhat.config.simple.js",
    needsNode: false
  },
  {
    name: "AssetDAO Tests",
    command: "npx hardhat test test/core/AssetDAO.test.js --config hardhat.config.simple.js",
    needsNode: false
  },
  {
    name: "GovernanceRewards Tests",
    command: "npx hardhat test test/approvalPattern/GovernanceRewards.test.js --config hardhat.config.simple.js",
    needsNode: false
  },
  
  // Standalone minimal test suite
  {
    name: "Standalone Tests Suite",
    command: "node test/standalone/run-tests.js",
    needsNode: false
  }
];

// Create a results file
const resultsFile = path.join(__dirname, 'comprehensive-test-results.log');
fs.writeFileSync(resultsFile, '# Comprehensive Test Results\n\n');

// Run tests sequentially
async function runTests() {
  console.log('Starting comprehensive tests for critical contracts...');
  
  for (const test of tests) {
    // Add test header to results file
    fs.appendFileSync(resultsFile, `\n## ${test.name}\n\`\`\`\n`);
    
    console.log(`\n\n==== Running ${test.name} ====`);
    console.log(`Command: ${test.command}`);
    
    // Ensure no node processes are running
    try {
      require('child_process').execSync('pkill -f "hardhat node" || true');
      require('child_process').execSync('pkill -f "node test" || true');
      // Small delay to ensure processes are killed
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      // Ignore errors if no processes found
    }
    
    // Run the test
    try {
      const result = await runCommand(test.command);
      fs.appendFileSync(resultsFile, result);
      console.log(`✅ ${test.name} completed`);
    } catch (error) {
      const errorMessage = `Error executing ${test.name}: ${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`;
      fs.appendFileSync(resultsFile, errorMessage);
      console.error(`❌ ${test.name} failed: ${error.message}`);
    }
    
    fs.appendFileSync(resultsFile, '```\n');
    
    // Allow a short break between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('\n\nAll tests completed! Results saved to:', resultsFile);
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const proc = spawn(cmd, args, { shell: true });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });
    
    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const error = new Error(`Process exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

// Run the tests
runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});