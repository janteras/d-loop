/**
 * D-Loop Protocol - Ethers v6 Compatibility Layer
 * 
 * This file provides a simplified compatibility layer for ethers v5 APIs
 * when using ethers v6. It's designed to be a drop-in replacement for
 * the various ethers-v6-shim files across the codebase.
 */

const { ethers } = require("hardhat");

// Add ethers v5 compatibility functions
const compatEthers = {
  ...ethers,
  
  // Constants
  constants: {
    AddressZero: ethers.ZeroAddress,
    HashZero: ethers.ZeroHash,
    Zero: ethers.getBigInt(0),
    One: ethers.getBigInt(1),
    Two: ethers.getBigInt(2),
    WeiPerEther: ethers.WeiPerEther,
    MaxUint256: ethers.MaxUint256,
    NegativeOne: ethers.getBigInt(-1)
  },
  
  // Utils
  utils: {
    // Number formatting
    parseUnits: (value, decimals) => ethers.parseUnits(value.toString(), decimals),
    formatUnits: (value, decimals) => ethers.formatUnits(value, decimals),
    parseEther: (value) => ethers.parseEther(value.toString()),
    formatEther: (value) => ethers.formatEther(value),
    
    // Hashing and encoding
    keccak256: (value) => ethers.keccak256(value),
    defaultAbiCoder: ethers.AbiCoder.defaultAbiCoder,
    getAddress: (address) => ethers.getAddress(address),
    hexlify: (value) => ethers.hexlify(value),
    toUtf8Bytes: (value) => ethers.toUtf8Bytes(value),
    toUtf8String: (bytes) => ethers.toUtf8String(bytes),
    
    // Solidity helpers
    solidityPack: (types, values) => ethers.solidityPacked(types, values),
    solidityKeccak256: (types, values) => ethers.solidityPackedKeccak256(types, values),
    getContractAddress: (from, nonce) => ethers.getCreateAddress({ from, nonce }),
    
    // Byte manipulation
    arrayify: (value) => ethers.getBytes(value),
    zeroPad: (value, length) => ethers.zeroPadValue(value, length),
    id: (text) => ethers.id(text),
    
    // Address validation
    isAddress: (address) => {
      try {
        ethers.getAddress(address);
        return true;
      } catch (e) {
        return false;
      }
    },
    
    // ENS and string formatting
    namehash: (name) => ethers.namehash(name),
    formatBytes32String: (text) => ethers.formatBytes32String(text),
    parseBytes32String: (bytes) => ethers.parseBytes32String(bytes)
  },
  
  // BigNumber compatibility
  BigNumber: {
    from: (value) => ethers.getBigInt(value),
    isBigNumber: (value) => {
      return typeof value === 'bigint' || 
            (value && value._isBigNumber) || 
            (value && value.constructor && value.constructor.name === 'BigNumber');
    }
  },
  
  // Helper functions
  getEventArguments: (receipt, eventName) => {
    if (!receipt || !receipt.events) return null;
    const event = receipt.events.find(e => e.event === eventName);
    return event ? event.args : null;
  },
  
  // Testing utilities
  toWei: (value) => ethers.parseEther(value.toString()),
  fromWei: (value) => ethers.formatEther(value)
};

// Add BigInt prototype extensions for compatibility if needed
if (!BigInt.prototype.toNumber) {
  BigInt.prototype.toNumber = function() {
    if (this > Number.MAX_SAFE_INTEGER || this < Number.MIN_SAFE_INTEGER) {
      console.warn("BigInt value exceeds safe integer range");
    }
    return Number(this);
  };
}

module.exports = compatEthers;
