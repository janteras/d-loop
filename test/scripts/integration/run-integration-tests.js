/**
 * @title DLOOP Protocol Integration Test Runner
 * @dev This script orchestrates running integration tests with proper resource management
 *      and enhanced connection handling
 * @author DLOOP Protocol Team
 */

const { spawn, execSync } = require('child_process');
const { promises: fs } = require('fs');
const path = require('path');
const net = require('net');

// Configuration
const DEFAULT_PORT = 8545;
const MAX_PORT = 8599;
const HARDHAT_STARTUP_TIMEOUT = 10000; // 10 seconds
const TEST_TIMEOUT = 30000; // 30 seconds
const CLEANUP_DELAY = 2000; // 2 seconds

// List of test files to run
const TEST_FILES = [
  // Core integration tests
  'integration/enhanced/AINodeRegistrySoulboundNFT.test.js',
  'integration/enhanced/FeeCalculatorTreasury.test.js',
  'integration/ABI.compatibility.hardhat.js'
];

// State tracking
let hardhatProcess = null;
let serverPort = DEFAULT_PORT;
let activeTests = new Set();
let cleanupInProgress = false;

/**
 * Find a free port to use for the Hardhat node
 * @returns {Promise<number>} The available port
 */
async function findFreePort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    try {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.once('listening', () => {
          server.close();
          resolve();
        });
        server.listen(port);
      });
      
      console.log(`Found available port: ${port}`);
      return port;
    } catch (error) {
      // Port is in use, try the next one
      console.log(`Port ${port} is in use, trying next...`);
    }
  }
  
  throw new Error(`No available ports found between ${DEFAULT_PORT} and ${MAX_PORT}`);
}

/**
 * Kill existing Hardhat processes if any
 */
function killExistingHardhatProcesses() {
  try {
    console.log("Checking for existing Hardhat processes...");
    
    let command = process.platform === 'win32' 
      ? 'tasklist | findstr node'
      : "ps aux | grep 'hardhat node' | grep -v grep | awk '{print $2}'";
    
    const output = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    
    if (output) {
      const lines = output.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          if (process.platform === 'win32') {
            const match = line.match(/node.exe\s+(\d+)/);
            if (match && match[1]) {
              execSync(`taskkill /PID ${match[1]} /F`, { stdio: 'ignore' });
            }
          } else {
            execSync(`kill -9 ${line.trim()}`, { stdio: 'ignore' });
          }
          console.log(`Killed process: ${line.trim()}`);
        } catch (e) {
          console.log(`Failed to kill process: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error("Error checking for existing Hardhat processes:", error.message);
  }
}

/**
 * Start a Hardhat node on the specified port
 * @param {number} port Port to run the Hardhat node on
 * @returns {Promise<object>} The Hardhat process
 */
async function startHardhatNode(port) {
  return new Promise((resolve, reject) => {
    console.log(`Starting Hardhat node on port ${port}...`);
    
    // First check if a node is already running on this port
    try {
      // Try to connect to an existing node
      const testProvider = new ethers.JsonRpcProvider(`http://localhost:${port}`);
      testProvider.getBlockNumber()
        .then(() => {
          console.log(`Hardhat node already running on port ${port}, using existing instance`);
          resolve({ isExisting: true });
        })
        .catch(() => {
          // No node running, start a new one
          startNewNode();
        });
    } catch (error) {
      // Error creating provider, start a new node
      startNewNode();
    }
    
    function startNewNode() {
      const process = spawn('npx', ['hardhat', 'node', '--port', port], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: { ...process.env }
      });
      
      let started = false;
      const outputData = [];
      const errorData = [];
      
      // Handle stdout
      process.stdout.on('data', (data) => {
        const output = data.toString();
        outputData.push(output);
        
        console.log(`Hardhat output: ${output.trim()}`);
        
        if (output.includes('Started HTTP and WebSocket JSON-RPC server at')) {
          started = true;
          resolve({ process, isExisting: false });
        }
      });
      
      // Handle stderr
      process.stderr.on('data', (data) => {
        const error = data.toString();
        errorData.push(error);
        console.error(`Hardhat error: ${error}`);
      });
      
      // Handle close
      process.on('close', (code) => {
        if (!started) {
          console.error(`Hardhat node failed to start, exit code: ${code}`);
          console.error(`Stdout: ${outputData.join('')}`);
          console.error(`Stderr: ${errorData.join('')}`);
          
          // Try one more approach - check if it's already running despite the error
          try {
            const retryProvider = new ethers.JsonRpcProvider(`http://localhost:${port}`);
            retryProvider.getBlockNumber()
              .then(() => {
                console.log(`Hardhat node appears to be running on port ${port} despite start errors`);
                resolve({ isExisting: true });
              })
              .catch(() => {
                reject(new Error(`Hardhat node failed to start, exit code: ${code}`));
              });
          } catch (error) {
            reject(new Error(`Hardhat node failed to start, exit code: ${code}`));
          }
        }
      });
      
      // Handle error
      process.on('error', (error) => {
        errorData.push(error.toString());
        console.error(`Failed to start Hardhat node: ${error.message}`);
      });
      
      // Handle timeout
      setTimeout(() => {
        if (!started) {
          console.warn('Hardhat node startup timed out, checking if it is running anyway...');
          
          // Check if node is running despite timeout
          try {
            const timeoutProvider = new ethers.JsonRpcProvider(`http://localhost:${port}`);
            timeoutProvider.getBlockNumber()
              .then(() => {
                console.log(`Hardhat node running on port ${port} despite timeout`);
                resolve({ process, isExisting: false });
              })
              .catch(() => {
                process.kill();
                reject(new Error('Hardhat node startup timed out'));
              });
          } catch (error) {
            process.kill();
            reject(new Error('Hardhat node startup timed out'));
          }
        }
      }, HARDHAT_STARTUP_TIMEOUT);
    }
  });
}

/**
 * Run a test file using Hardhat
 * @param {string} testFile Path to the test file
 * @param {number} port Port the Hardhat node is running on
 * @returns {Promise<boolean>} Whether the test passed
 */
async function runTest(testFile, port) {
  return new Promise((resolve) => {
    console.log(`\nRunning test: ${testFile}`);
    
    const args = [
      'hardhat', 
      'test', 
      `test/${testFile}`, 
      '--network', 
      'localhost',
      '--config',
      'hardhat.config.simple.js'
    ];
    
    const env = {
      ...process.env,
      HARDHAT_NETWORK: 'localhost',
      HARDHAT_PORT: port.toString()
    };
    
    const process = spawn('npx', args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    activeTests.add(process);
    
    // Handle stdout
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    // Handle stderr
    process.stderr.on('data', (data) => {
      console.error(`Test error: ${data.toString()}`);
    });
    
    // Handle close
    process.on('close', (code) => {
      activeTests.delete(process);
      const passed = code === 0;
      console.log(`Test ${testFile} ${passed ? 'passed' : 'failed'} with exit code ${code}`);
      resolve(passed);
    });
    
    // Handle timeout
    setTimeout(() => {
      if (activeTests.has(process)) {
        console.error(`Test ${testFile} timed out`);
        process.kill();
        activeTests.delete(process);
        resolve(false);
      }
    }, TEST_TIMEOUT);
  });
}

/**
 * Cleanup resources before exiting
 */
async function cleanup() {
  if (cleanupInProgress) return;
  cleanupInProgress = true;
  
  console.log("\nCleaning up...");
  
  // Kill all active test processes
  for (const process of activeTests) {
    try {
      process.kill();
    } catch (e) {
      console.error(`Error killing test process: ${e.message}`);
    }
  }
  
  // Kill the Hardhat process
  if (hardhatProcess) {
    try {
      hardhatProcess.kill();
      await new Promise(resolve => setTimeout(resolve, CLEANUP_DELAY));
    } catch (e) {
      console.error(`Error killing Hardhat process: ${e.message}`);
    }
  }
  
  // Additional cleanup to ensure no zombie processes
  killExistingHardhatProcesses();
  
  console.log("Cleanup complete");
}

/**
 * Main function to run all integration tests
 */
async function main() {
  try {
    console.log("==== DLOOP Protocol Integration Test Runner ====");
    
    // Clean up existing Hardhat processes
    killExistingHardhatProcesses();
    
    // Find a free port
    serverPort = await findFreePort();
    
    // Start Hardhat node
    hardhatProcess = await startHardhatNode(serverPort);
    
    // Run all tests
    const results = [];
    for (const testFile of TEST_FILES) {
      const passed = await runTest(testFile, serverPort);
      results.push({ testFile, passed });
    }
    
    // Print summary
    console.log("\n==== Test Results ====");
    let allPassed = true;
    
    for (const { testFile, passed } of results) {
      console.log(`${passed ? '✅' : '❌'} ${testFile}`);
      if (!passed) allPassed = false;
    }
    
    console.log(`\nOverall result: ${allPassed ? '✅ All tests passed' : '❌ Some tests failed'}`);
    
    // Cleanup and exit
    await cleanup();
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error("Integration test runner failed:", error.message);
    await cleanup();
    process.exit(1);
  }
}

// Handle signals for cleanup
process.on('SIGINT', async () => {
  console.log("\nReceived SIGINT, cleaning up...");
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log("\nReceived SIGTERM, cleaning up...");
  await cleanup();
  process.exit(1);
});

// Start tests
main();