/**
 * D-Loop Protocol - Ethers Shim Registration
 * 
 * This file sets up the module resolution for the ethers-shim.
 * It should be required at the beginning of test files or in the Hardhat setup.
 */

const path = require('path');
const Module = require('module');

// Store the original require function
const originalRequire = Module.prototype.require;

// Override the require function to handle our custom aliases
Module.prototype.require = function(id) {
  if (id === '@ethers-shim') {
    // Resolve to our unified ethers shim
    return originalRequire.call(this, path.resolve(__dirname, 'ethers-shim.js'));
  }
  
  // For all other modules, use the original require
  return originalRequire.call(this, id);
};

// Don't export the ethers shim directly to avoid circular dependencies
module.exports = { registerShim: true };
