const { spawn } = require('child_process');

// Define the test files to run
const testFiles = [
  'test/protocol/ProtocolDAO.test.js',
  'test/protocol/UpgradeExecutor.test.js',
  'test/protocol/ParameterAdjuster.test.js',
  'test/protocol/EmergencyPauser.test.js',
  'test/protocol/DAOExecutorIntegration.test.js'
];

async function runTests() {
  console.log('Running Protocol DAO and Executor tests...');
  console.log('======================================');
  
  for (const testFile of testFiles) {
    console.log(`\nRunning tests in ${testFile}...`);
    console.log('--------------------------------------');
    
    // Run npx hardhat test for each file
    const child = spawn('npx', ['hardhat', 'test', testFile], {
      stdio: 'inherit',
      shell: true
    });
    
    // Wait for the process to complete
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Tests in ${testFile} passed successfully`);
          resolve();
        } else {
          console.error(`✗ Tests in ${testFile} failed with code ${code}`);
          reject(new Error(`Tests failed with code ${code}`));
        }
      });
      
      child.on('error', (err) => {
        console.error(`Failed to start test process: ${err}`);
        reject(err);
      });
    });
  }
  
  console.log('\n======================================');
  console.log('All Protocol DAO and Executor tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});