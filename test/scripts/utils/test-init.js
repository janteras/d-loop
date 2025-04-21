/**
 * @title Common Test Initialization
 * @dev Configures the test environment with proper compatibility settings
 *      for running tests with Ethers v6
 * @author DLOOP Protocol Team
 */

// Set up test environment
console.log("Initializing test environment...");

// This ensures the ethers-v6-shim is loaded before any other modules
try {
  // First try the independent shim (most reliable)
  require('../../ethers-v6-shim.independent.js');
  console.log("Loaded independent ethers v6 compatibility shim");
} catch (error) {
  try {
    // Fall back to the ultra shim as a second option
    require('../../ethers-v6-shim.ultra.js');
    console.log("Loaded ultra ethers v6 compatibility shim");
  } catch (innerError) {
    try {
      // Try the standard shim as a last resort
      require('../../ethers-v6-shim.js');
      console.log("Loaded standard ethers v6 compatibility shim");
    } catch (finalError) {
      console.warn("Failed to load any ethers v6 compatibility shim:", finalError.message);
      console.warn("Test may encounter ethers compatibility issues");
    }
  }
}

// Configure test timeouts and parameters
const chai = require('chai');
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_SLOW = 5000; // 5 seconds to consider a test slow

// Set Mocha timeouts if it's available
if (typeof before === 'function') {
  try {
    // Configure default timeouts
    before(function() {
      this.timeout(DEFAULT_TIMEOUT);
    });
  } catch (error) {
    console.warn("Failed to set Mocha timeout:", error.message);
  }
}

// Set up chai assertions
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

// Utility for handling async errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process, just log the error
});

// Export test configuration
module.exports = {
  DEFAULT_TIMEOUT,
  DEFAULT_SLOW,
  chai
};

console.log("Test environment initialized successfully");