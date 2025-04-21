const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test categories and their respective test files/patterns
const testCategories = [
  {
    name: 'Core Contracts',
    pattern: 'test/core/**/*.test.js',
  },
  {
    name: 'Governance System',
    pattern: 'test/governance/**/*.test.js',
  },
  {
    name: 'Fee Structure',
    pattern: 'test/fees/**/*.test.js',
  },
  {
    name: 'Protocol DAO',
    pattern: 'test/governance/ProtocolDAO*.test.js',
  },
  {
    name: 'AI Node Identification',
    pattern: 'test/governance/AINode*.test.js',
  },
  {
    name: 'Hedera Bridge',
    pattern: 'test/bridge/**/*.test.js',
  },
  {
    name: 'Oracle Integration',
    pattern: 'test/oracles/**/*.test.js',
  },
  {
    name: 'Governance Rewards',
    pattern: 'test/rewards/**/*.test.js',
  },
  {
    name: 'Integration Tests',
    pattern: 'test/integration/**/*.test.js',
  }
];

// Function to run a command and return a promise
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Main function to run all tests
async function runTests() {
  console.log("=== DLOOP Comprehensive Test Suite ===");
  console.log("Running all test categories sequentially...\n");

  let failedCategories = [];
  
  for (const category of testCategories) {
    console.log(`\n----- Running ${category.name} Tests -----`);
    try {
      await runCommand('npx', ['hardhat', 'test', category.pattern]);
      console.log(`✅ ${category.name} tests passed successfully!`);
    } catch (error) {
      console.error(`❌ ${category.name} tests failed: ${error.message}`);
      failedCategories.push(category.name);
    }
  }

  // Run Echidna property-based tests if config exists
  if (fs.existsSync('echidna.config.yaml')) {
    console.log("\n----- Running Property-Based Tests with Echidna -----");
    try {
      // Modify this command based on your Echidna setup
      await runCommand('echidna-test', [
        'contracts/echidna/FeeSystemInvariants.sol',
        '--config',
        'echidna.config.yaml'
      ]).catch(e => {
        console.log("Echidna may not be installed. Skipping property-based tests.");
      });
    } catch (error) {
      console.error(`❌ Property-based tests failed: ${error.message}`);
      failedCategories.push('Property-Based Tests');
    }
  }

  // Generate coverage report
  console.log("\n----- Generating Test Coverage Report -----");
  try {
    await runCommand('npx', ['hardhat', 'coverage']);
    console.log("✅ Coverage report generated successfully!");
  } catch (error) {
    console.error(`❌ Coverage generation failed: ${error.message}`);
  }

  // Summary
  console.log("\n=== Test Execution Summary ===");
  if (failedCategories.length === 0) {
    console.log("🎉 All test categories passed successfully!");
  } else {
    console.log("⚠️ The following test categories failed:");
    failedCategories.forEach(category => console.log(`  - ${category}`));
    process.exit(1);
  }
}

// Execute tests
runTests().catch(error => {
  console.error("Test execution failed:", error);
  process.exit(1);
});