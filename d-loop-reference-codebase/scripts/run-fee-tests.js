const { spawn } = require('child_process');

// Define the test files to run
const testFiles = [
  'test/fees/FeeCalculator.test.js',
  'test/fees/Treasury.test.js',
  'test/fees/FeeProcessor.test.js',
  'test/protocol/FeeParameterAdjuster.test.js'
];

async function runTests() {
  console.log('Running Fee Structure Tests...');
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
  console.log('All Fee Structure Tests completed successfully!');
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});