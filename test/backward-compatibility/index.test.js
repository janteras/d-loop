/**
 * @title Backward Compatibility Test Runner
 * @dev Entry point for all backward compatibility tests
 * @notice This file allows running all backward compatibility tests with a single command
 */

// Run all backward compatibility tests
describe("Backward Compatibility Tests", function() {
  // Import and execute individual test suites
  require("./OracleBackwardCompatibility.test.js");
  require("./SoulboundNFTBackwardCompatibility.test.js");
});