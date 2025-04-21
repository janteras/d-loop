// Local test runner for DLOOP contracts
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_TIMEOUT = 120000; // 2 minutes per test
const LOG_FILE = 'test-results.log';
const SKIP_COMPILATION = process.argv.includes('--no-compile');

// Initialize log file
fs.writeFileSync(LOG_FILE, `DLOOP Test Run: ${new Date().toISOString()}\n\n`);

function log(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + '\n');
}

function runCommand(command, options = {}) {
  const { ignoreErrors = false } = options;
  try {
    log(`\n> Running: ${command}`);
    const output = execSync(command, { 
      timeout: TEST_TIMEOUT,
      stdio: 'pipe'
    }).toString();
    log(`SUCCESS`);
    log(output);
    return { success: true, output };
  } catch (error) {
    log(`FAILED`);
    log(error.message);
    if (!ignoreErrors) {
      log('\nStopping test run due to failure. Use --continue-on-error to ignore failures.');
      process.exit(1);
    }
    return { success: false, error: error.message };
  }
}

// Collect all test files
function findTests(directory = 'test', pattern = '.test.js') {
  const tests = [];
  
  if (!fs.existsSync(directory)) {
    log(`Directory not found: ${directory}`);
    return tests;
  }
  
  const items = fs.readdirSync(directory, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(directory, item.name);
    
    if (item.isDirectory()) {
      tests.push(...findTests(fullPath, pattern));
    } else if (item.name.endsWith(pattern)) {
      tests.push(fullPath);
    }
  }
  
  return tests;
}

async function main() {
  log('Starting DLOOP test runner');
  
  // Check hardhat version
  runCommand('npx hardhat --version');
  
  // First, try the simple test that doesn't require compilation
  log('\n--- Running Simple Test ---');
  runCommand('node run-test.js');
  
  // Get test files
  const allTests = findTests();
  log(`\nFound ${allTests.length} test files`);
  
  // Group tests by category
  const feeTests = allTests.filter(t => t.includes('/fees/') || t.includes('Fee'));
  const governanceTests = allTests.filter(t => t.includes('/governance/') || t.includes('Governance'));
  const assetTests = allTests.filter(t => t.includes('/assets/') || t.includes('Asset'));
  const integrationTests = allTests.filter(t => t.includes('/integration/'));
  const oracleTests = allTests.filter(t => t.includes('/oracles/') || t.includes('Oracle'));
  const gasTests = allTests.filter(t => t.includes('/analysis/') || t.includes('Gas'));
  
  // Define test groups
  const testGroups = [
    { name: 'Fee Structure Tests', tests: feeTests },
    { name: 'Governance Tests', tests: governanceTests },
    { name: 'Asset DAO Tests', tests: assetTests },
    { name: 'Oracle Tests', tests: oracleTests },
    { name: 'Gas Analysis', tests: gasTests },
    { name: 'Integration Tests', tests: integrationTests },
  ];
  
  // Run tests by group
  for (const group of testGroups) {
    if (group.tests.length === 0) continue;
    
    log(`\n--- Running ${group.name} (${group.tests.length} files) ---`);
    
    for (const test of group.tests) {
      const compileFlag = SKIP_COMPILATION ? '--no-compile' : '';
      runCommand(`npx hardhat test ${test} ${compileFlag}`, { ignoreErrors: true });
    }
  }
  
  log('\n--- Test Run Complete ---');
  log(`Results saved to ${LOG_FILE}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`Error in test runner: ${error.message}`);
    process.exit(1);
  });