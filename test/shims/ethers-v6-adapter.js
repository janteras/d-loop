/**
 * Ethers v6 Adapter
 * 
 * This adapter provides compatibility between ethers v5 and v6 APIs
 * for use in the D-Loop Protocol test suite.
 */

const { ethers } = require("hardhat");
require('../utils/ethers-v6-compat');

// Create an adapter that maps ethers v5 API to ethers v6
const ethersV6Adapter = {
    // Core ethers exports
    ...ethers,
    
    // Utils compatibility layer
    utils: {
        ...ethers.utils,
        parseUnits: (value, decimals) => ethers.parseUnits(value.toString(), decimals),
        formatUnits: (value, decimals) => ethers.formatUnits(value, decimals),
        parseEther: (value) => ethers.parseEther(value.toString()),
        formatEther: (value) => ethers.formatEther(value),
        keccak256: (value) => ethers.keccak256(value),
        defaultAbiCoder: ethers.AbiCoder.defaultAbiCoder(),
        getAddress: (address) => ethers.getAddress(address),
        hexlify: (value) => ethers.hexlify(value),
        toUtf8Bytes: (value) => ethers.toUtf8Bytes(value),
        solidityPack: (types, values) => ethers.solidityPacked(types, values),
        solidityKeccak256: (types, values) => ethers.solidityPackedKeccak256(types, values),
        getContractAddress: (from, nonce) => ethers.getCreateAddress({ from, nonce }),
        arrayify: (value) => ethers.getBytes(value),
        zeroPad: (value, length) => ethers.zeroPadValue(value, length),
        id: (text) => ethers.id(text)
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
        from: (value) => ethers.getBigInt(value)
    },
    
    // Contract factory compatibility
    ContractFactory: ethers.ContractFactory,
    
    // Provider compatibility
    providers: {
        JsonRpcProvider: ethers.JsonRpcProvider,
        Web3Provider: ethers.BrowserProvider,
        getDefaultProvider: ethers.getDefaultProvider
    },
    
    // Wallet compatibility
    Wallet: ethers.Wallet,
    
    // Additional helper methods for tests
    getSigners: async () => {
        try {
            return await ethers.getSigners();
        } catch (error) {
            console.warn("Error in getSigners:", error.message);
            const provider = new ethers.JsonRpcProvider("http://localhost:8545");
            const accounts = await provider.listAccounts();
            return accounts.map(addr => provider.getSigner(addr));
        }
    },
    
    getContractAt: async (contractName, address, signer) => {
        try {
            return await ethers.getContractAt(contractName, address, signer);
        } catch (error) {
            console.warn("Error in getContractAt:", error.message);
            const factory = await ethers.getContractFactory(contractName, signer);
            return factory.attach(address);
        }
    },
    
    getContractFactory: async (contractName, signer) => {
        try {
            return await ethers.getContractFactory(contractName, signer);
        } catch (error) {
            console.warn("Error in getContractFactory:", error.message);
            throw error;
        }
    }
};

module.exports = ethersV6Adapter;
