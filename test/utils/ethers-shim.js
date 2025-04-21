/**
 * D-Loop Protocol - Unified Ethers v6 Compatibility Shim
 * 
 * This file provides a comprehensive compatibility layer for tests written with Ethers v5 APIs
 * but running with Ethers v6. It consolidates all shim implementations across the codebase
 * into a single, standardized interface.
 * 
 * @dev Import using: const ethers = require('./ethers-v6-compat');
 */

// Use a getter to lazy-load ethers from hardhat to avoid circular dependencies
let _ethers = null;
Object.defineProperty(module.exports, 'ethers', {
  get: function() {
    if (!_ethers) {
      _ethers = require('hardhat').ethers;
    }
    return _ethers;
  }
});

// Get ethers for internal use
const getEthers = () => {
  try {
    return require('hardhat').ethers;
  } catch (e) {
    console.warn('Warning: hardhat.ethers not available during initialization');
    return {};
  }
};

const ethers = getEthers();

// Create enhanced ethers object with v5 compatibility
const enhancedEthers = {
    // Dynamically access ethers properties to avoid initialization issues
    get provider() { return getEthers().provider; },
    get getSigners() { return getEthers().getSigners; },
    get getContractFactory() { return getEthers().getContractFactory; },
    get getContractAt() { return getEthers().getContractAt; },
    get Wallet() { return getEthers().Wallet; },
    get ZeroAddress() { return getEthers().ZeroAddress; },
    get ZeroHash() { return getEthers().ZeroHash; },
    get MaxUint256() { return getEthers().MaxUint256; },
    get WeiPerEther() { return getEthers().WeiPerEther; },
    
    // Utils compatibility layer
    utils: {
        // Dynamically access ethers utils to avoid initialization issues
        
        // Number formatting
        parseUnits: (value, decimals) => getEthers().parseUnits(value.toString(), decimals),
        formatUnits: (value, decimals) => getEthers().formatUnits(value, decimals),
        parseEther: (value) => getEthers().parseEther(value.toString()),
        formatEther: (value) => getEthers().formatEther(value),
        
        // Hashing and encoding
        keccak256: (value) => getEthers().keccak256(value),
        get defaultAbiCoder() { return getEthers().AbiCoder.defaultAbiCoder; },
        getAddress: (address) => getEthers().getAddress(address),
        hexlify: (value) => getEthers().hexlify(value),
        toUtf8Bytes: (value) => getEthers().toUtf8Bytes(value),
        toUtf8String: (bytes) => getEthers().toUtf8String(bytes),
        
        // Solidity helpers
        solidityPack: (types, values) => getEthers().solidityPacked(types, values),
        solidityKeccak256: (types, values) => getEthers().solidityPackedKeccak256(types, values),
        getContractAddress: (from, nonce) => getEthers().getCreateAddress({ from, nonce }),
        
        // Byte manipulation
        arrayify: (value) => getEthers().getBytes(value),
        zeroPad: (value, length) => getEthers().zeroPadValue(value, length),
        id: (text) => getEthers().id(text),
        
        // Address validation
        isAddress: (address) => {
            try {
                getEthers().getAddress(address);
                return true;
            } catch (e) {
                return false;
            }
        },
        
        // ENS and string formatting
        namehash: (name) => getEthers().namehash(name),
        formatBytes32String: (text) => getEthers().formatBytes32String(text),
        parseBytes32String: (bytes) => getEthers().parseBytes32String(bytes),
        
        // Additional helpers from various shim implementations
        computeAddress: (key) => getEthers().computeAddress(key),
        recoverAddress: (digest, signature) => getEthers().recoverAddress(digest, signature),
        verifyMessage: (message, signature) => getEthers().verifyMessage(message, signature),
        hashMessage: (message) => getEthers().hashMessage(message)
    },
    
    // Constants compatibility layer
    constants: {
        get AddressZero() { return getEthers().ZeroAddress; },
        get HashZero() { return getEthers().ZeroHash; },
        get Zero() { return getEthers().getBigInt(0); },
        get One() { return getEthers().getBigInt(1); },
        get Two() { return getEthers().getBigInt(2); },
        get WeiPerEther() { return getEthers().WeiPerEther; },
        get MaxUint256() { return getEthers().MaxUint256; },
        get NegativeOne() { return getEthers().getBigInt(-1); }
    },
    
    // BigNumber compatibility layer
    BigNumber: {
        from: (value) => getEthers().getBigInt(value),
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
    
    // Testing utilities
    toWei: (value) => getEthers().parseEther(value.toString()),
    fromWei: (value) => getEthers().formatEther(value),
    
    // Time manipulation helpers for testing
    increaseTime: async (seconds) => {
        const provider = getEthers().provider;
        await provider.send("evm_increaseTime", [seconds]);
        await provider.send("evm_mine");
    },
    
    getBlockTimestamp: async () => {
        const provider = getEthers().provider;
        const blockNumber = await provider.getBlockNumber();
        const block = await provider.getBlock(blockNumber);
        return block.timestamp;
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
