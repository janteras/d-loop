/**
 * Standalone Test Runner
 * 
 * This script sequentially runs all standalone tests to avoid resource contention
 * and provides a simple report of test results.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const testDir = path.join(__dirname);

// Define tests to run in order of dependency
const tests = [
  {
    name: 'SoulboundNFT Test',
    path: path.join(testDir, 'soulbound-minimal.js'),
    description: 'Tests core SoulboundNFT functionality with role-based access control'
  },
  {
    name: 'TokenApprovalOptimizer Test',
    path: path.join(testDir, 'token-approval-optimizer-minimal.js'),
    description: 'Tests the token approval optimization utility'
  },
  {
    name: 'Treasury Test',
    path: path.join(testDir, 'treasury-minimal.js'),
    description: 'Tests Treasury functionality and authorization'
  },
  {
    name: 'FeeCalculator Test',
    path: path.join(testDir, 'feecalculator-minimal.js'),
    description: 'Tests fee calculation and distribution'
  },
  {
    name: 'AINodeRegistry Test',
    path: path.join(testDir, 'ainode-registry-minimal.js'),
    description: 'Tests AI node registration and management'
  },
  {
    name: 'ProtocolDAO Test',
    path: path.join(testDir, 'protocoldao-minimal.js'),
    description: 'Tests protocol governance functionality'
  },
  {
    name: 'AssetDAO Test',
    path: path.join(testDir, 'assetdao-minimal.js'), 
    description: 'Tests asset management functionality'
  },
  {
    name: 'Treasury-FeeCalculator Integration',
    path: path.join(__dirname, '../integration/treasury-feecalculator-integration-test.js'),
    description: 'Tests integration between Treasury and FeeCalculator'
  }
];

// Function to run a command and return output
function runCommand(command) {
  console.log(`\n========== RUNNING: ${command} ==========\n`);
  try {
    const output = execSync(command, { 
      stdio: 'inherit', // Show output in real-time
      timeout: 120000   // 2 minute timeout per test
    });
    return { success: true, output };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      stdout: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    };
  }
}

// Main function to run all tests
async function runAllTests() {
  console.log('Starting Sequential Standalone Tests\n');
  
  // To track results
  const results = [];
  
  // Ensure Hardhat node is not running
  try {
    execSync('pkill -f "hardhat node" || true');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for process to terminate
  } catch (e) {
    // Ignore errors if no process exists
  }
  
  // Compile contracts first
  console.log('Compiling contracts...');
  try {
    execSync('npx hardhat compile', { stdio: 'inherit' });
    console.log('Compilation successful\n');
  } catch (error) {
    console.error('Compilation failed:', error.message);
    process.exit(1);
  }
  
  // Run each test in sequence
  for (const test of tests) {
    if (!fs.existsSync(test.path)) {
      console.log(`Test file ${test.path} not found. Skipping...`);
      results.push({
        name: test.name,
        success: false,
        error: 'Test file not found'
      });
      continue;
    }
    
    console.log(`\n----- Running ${test.name} -----`);
    console.log(`Description: ${test.description}`);
    
    const result = runCommand(`node ${test.path}`);
    results.push({
      name: test.name,
      success: result.success,
      error: result.error
    });
    
    // Allow some time between tests for resources to be cleaned up
    console.log('Waiting for resources to be released...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Print summary
  console.log('\n\n===== TEST SUMMARY =====');
  let passCount = 0;
  let failCount = 0;
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.name} - PASSED`);
      passCount++;
    } else {
      console.log(`❌ ${result.name} - FAILED`);
      if (result.error) {
        console.log(`   Error: ${result.error.substring(0, 100)}...`);
      }
      failCount++;
    }
  }
  
  console.log(`\nResults: ${passCount} passed, ${failCount} failed, ${results.length} total`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});