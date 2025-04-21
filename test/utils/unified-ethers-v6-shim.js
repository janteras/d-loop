/**
 * Unified Ethers v6 Compatibility Shim
 * 
 * This file provides a comprehensive compatibility layer for tests that were written for Ethers v5 but run with Ethers v6.
 * It consolidates all shim implementations across the D-Loop Protocol codebase into a single, standardized interface.
 * 
 * Usage: 
 * - With alias (recommended): const ethers = require('./ethers-v6-compat');
 * - Direct path: const ethers = require('test/utils/unified-ethers-v6-shim');
 */

const { ethers } = require("hardhat");

// Create enhanced ethers object with v5 compatibility
const enhancedEthers = {
    ...ethers,
    
    // Utils compatibility layer
    utils: {
        ...ethers.utils,
        
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
        
        // Solidity helpers
        solidityPack: (types, values) => ethers.solidityPacked(types, values),
        solidityKeccak256: (types, values) => ethers.solidityPackedKeccak256(types, values),
        getContractAddress: (from, nonce) => ethers.getCreateAddress({ from, nonce }),
        
        // Byte manipulation
        arrayify: (value) => ethers.getBytes(value),
        zeroPad: (value, length) => ethers.zeroPadValue(value, length),
        id: (text) => ethers.id(text),
        
        // Additional helpers from various shim implementations
        toUtf8String: (bytes) => ethers.toUtf8String(bytes),
        isAddress: (address) => {
            try {
                ethers.getAddress(address);
                return true;
            } catch (e) {
                return false;
            }
        },
        namehash: (name) => ethers.namehash(name),
        formatBytes32String: (text) => ethers.formatBytes32String(text),
        parseBytes32String: (bytes) => ethers.parseBytes32String(bytes)
    },
    
    // Constants compatibility layer
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
    
    // BigNumber compatibility layer
    BigNumber: {
        from: (value) => ethers.getBigInt(value),
        isBigNumber: (value) => {
            return typeof value === 'bigint' || 
                  (value && value._isBigNumber) || 
                  (value && value.constructor && value.constructor.name === 'BigNumber');
        }
    },
    
    // Contract event testing helpers
    getEventArguments: (receipt, eventName) => {
        if (!receipt || !receipt.events) return null;
        const event = receipt.events.find(e => e.event === eventName);
        return event ? event.args : null;
    },
    
    // Additional helper methods for testing
    getSigners: async () => await ethers.getSigners(),
    provider: ethers.provider,
    
    // Contract factory helpers
    getContractFactory: async (name, signer) => {
        return await ethers.getContractFactory(name, signer);
    },
    
    getContractAt: async (nameOrAbi, address, signer) => {
        return await ethers.getContractAt(nameOrAbi, address, signer);
    }
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

// Add toString to BigInt prototype to match ethers v5 behavior if needed
if (!BigInt.prototype._ethersV5ToString) {
    BigInt.prototype._ethersV5ToString = BigInt.prototype.toString;
    BigInt.prototype.toString = function() {
        return this._ethersV5ToString();
    };
}

module.exports = enhancedEthers;
