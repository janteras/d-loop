/**
 * Universal Ethers v6 Compatibility Shim
 * 
 * This file provides a complete compatibility layer for tests that were written for Ethers v5 but run with Ethers v6.
 * It handles all common issues with BigNumber, constants, and event testing.
 * 
 * Usage: const ethers = require('../../../../test/helpers/unified-ethers-v6-shim');
 */

// Import ethers from hardhat with fallback mechanism
let ethers;
try {
  const hardhat = require("hardhat");
  ethers = hardhat.ethers;
} catch (e) {
  console.warn("Failed to import ethers from hardhat:", e.message);
  ethers = {};
}

// Create a new ethers object if undefined
if (!ethers) ethers = {};

// Add essential constants
const ZeroAddress = '0x0000000000000000000000000000000000000000';
const ZeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
const MaxUint256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

ethers.ZeroAddress = ZeroAddress;
ethers.ZeroHash = ZeroHash;
ethers.MaxUint256 = MaxUint256;

// Add v5 constants for backward compatibility
ethers.constants = {
  AddressZero: ZeroAddress,
  HashZero: ZeroHash,
  MaxUint256: MaxUint256,
  Zero: BigInt(0),
  One: BigInt(1),
  Two: BigInt(2),
  NegativeOne: BigInt(-1)
};

// Ensure utils object exists
if (!ethers.utils) {
  ethers.utils = {};
}

// Add parseUnits and formatUnits if they don't already exist
if (!ethers.parseUnits) {
  ethers.parseUnits = function(value, decimals = 18) {
    if (ethers.utils && ethers.utils.parseUnits) {
      return ethers.utils.parseUnits(value, decimals);
    }
    // Fallback implementation
    const valueStr = String(value);
    const decimalsPart = valueStr.includes('.') ? valueStr.split('.')[1].length : 0;
    const paddedDecimals = Math.max(0, Number(decimals) - decimalsPart);
    const cleanValue = valueStr.replace('.', '');
    return BigInt(cleanValue + '0'.repeat(paddedDecimals));
  };
}

if (!ethers.formatUnits) {
  ethers.formatUnits = function(value, decimals = 18) {
    if (ethers.utils && ethers.utils.formatUnits) {
      return ethers.utils.formatUnits(value, decimals);
    }
    // Fallback implementation
    value = BigInt(value.toString());
    const divisor = BigInt(10) ** BigInt(decimals);
    const quotient = value / divisor;
    const remainder = value % divisor;
    const paddedRemainder = remainder.toString().padStart(decimals, '0');
    return `${quotient}.${paddedRemainder}`;
  };
}

if (!ethers.parseEther) {
  ethers.parseEther = function(value) {
    return ethers.parseUnits(value, 18);
  };
}

if (!ethers.formatEther) {
  ethers.formatEther = function(value) {
    return ethers.formatUnits(value, 18);
  };
}

// Ensure BigNumber compatibility
if (!ethers.BigNumber) {
  ethers.BigNumber = {
    from: (value) => {
      try {
        return BigInt(String(value));
      } catch (e) {
        console.warn("BigNumber conversion error:", e);
        return BigInt(0);
      }
    }
  };
}

// Add keccak256 function if it doesn't exist
if (!ethers.utils.keccak256 && ethers.keccak256) {
  ethers.utils.keccak256 = ethers.keccak256;
} else if (!ethers.utils.keccak256 && !ethers.keccak256) {
  // Very simple fallback (not cryptographically secure but works for tests)
  ethers.utils.keccak256 = function(value) {
    return "0x" + Array.from(String(value))
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('').slice(0, 64).padEnd(64, '0');
  };
}

// Add UTF8 encoding utilities
if (!ethers.utils.toUtf8Bytes && ethers.toUtf8Bytes) {
  ethers.utils.toUtf8Bytes = ethers.toUtf8Bytes;
} else if (!ethers.utils.toUtf8Bytes && !ethers.toUtf8Bytes) {
  ethers.utils.toUtf8Bytes = function(text) {
    return Buffer.from(text);
  };
  ethers.toUtf8Bytes = ethers.utils.toUtf8Bytes;
}

// Add toNumber to BigInt prototype for compatibility if needed
if (!BigInt.prototype.toNumber) {
  BigInt.prototype.toNumber = function() {
    return Number(this);
  };
}

// Add toString to BigInt prototype to match ethers v5 behavior if needed
if (!BigInt.prototype.toString) {
  BigInt.prototype.toString = function() {
    return this.valueOf().toString();
  };
}

// Custom event matchers for better testing compatibility
if (typeof expect !== 'undefined') {
  // Add emit matcher if it doesn't exist
  if (!expect.extend) {
    console.warn("expect.extend not available, skipping custom matchers");
  } else {
    expect.extend({
      toEmitEvent(receipt, contractObj, eventName) {
        try {
          const events = receipt.events || [];
          const matchingEvent = events.find(e => e.event === eventName);
          
          if (matchingEvent) {
            return {
              pass: true,
              message: () => `Expected contract not to emit ${eventName} event, but it did`
            };
          } else {
            return {
              pass: false,
              message: () => `Expected contract to emit ${eventName} event, but it didn't`
            };
          }
        } catch (e) {
          return {
            pass: false,
            message: () => `Error checking for event: ${e.message}`
          };
        }
      }
    });
  }
}

// Export the enhanced ethers object
module.exports = ethers;