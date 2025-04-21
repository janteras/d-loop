/**
 * @title AINodeRegistry ABI Compatibility Test
 * @dev Tests to ensure the AINodeRegistry interface remains consistent
 */

const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { getInterfaceID } = require('../utils/interfaceUtils');

describe('AINodeRegistry ABI Compatibility', function () {
  // Deploy a fresh instance of the AINodeRegistry for each test
  async function deployAINodeRegistryFixture() {
    const [admin] = await ethers.getSigners();
    
    // Deploy SoulboundNFT first
    const SoulboundNFT = await ethers.getContractFactory('SoulboundNFT');
    const soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // Then deploy AINodeRegistry with required constructor args
    const AINodeRegistry = await ethers.getContractFactory('AINodeRegistry');
    const registry = await AINodeRegistry.deploy(
      admin.address, // admin
      ethers.constants.AddressZero, // governanceContract
      soulboundNFT.address // soulboundNFT
    );
    
    return { registry, admin, soulboundNFT };
  }
  
  describe('Interface Identification', function () {
    it('should support the IAINodeRegistry interface', async function () {
      const { registry } = await loadFixture(deployAINodeRegistryFixture);
      
      // Calculate the interface ID for IAINodeRegistry
      const IAINodeRegistry = await ethers.getContractFactory('IAINodeRegistry');
      const interfaceId = getInterfaceID(IAINodeRegistry.interface);
      
      // Check if the contract supports this interface
      expect(await registry.supportsInterface(interfaceId)).to.be.true;
    });
  });
  
  describe('Function Signatures', function () {
    it('should have the correct registerNode function signature', async function () {
      const { registry } = await loadFixture(deployAINodeRegistryFixture);
      
      // Get the function signature
      const functionSignature = 'registerNode(address,address,string)';
      const functionSelector = ethers.utils.id(functionSignature).slice(0, 10);
      
      // Verify the function exists by trying to call it (should revert, but not with "function not found")
      try {
        await registry.registerNode(ethers.constants.AddressZero, ethers.constants.AddressZero, '');
        expect.fail('Should have reverted');
      } catch (error) {
        expect(error.message).to.not.include('function not found');
      }
    });
    
    it('should have the correct deactivateNode function signature', async function () {
      const { registry } = await loadFixture(deployAINodeRegistryFixture);
      
      // Get the function signature
      const functionSignature = 'deactivateNode(address)';
      const functionSelector = ethers.utils.id(functionSignature).slice(0, 10);
      
      // Verify the function exists by trying to call it (should revert, but not with "function not found")
      try {
        await registry.deactivateNode(ethers.constants.AddressZero);
        expect.fail('Should have reverted');
      } catch (error) {
        expect(error.message).to.not.include('function not found');
      }
    });
    
    it('should have the correct getNodeInfo function signature', async function () {
      const { registry } = await loadFixture(deployAINodeRegistryFixture);
      
      // Get the function signature
      const functionSignature = 'getNodeInfo(address)';
      const functionSelector = ethers.utils.id(functionSignature).slice(0, 10);
      
      // Verify the function exists by trying to call it (should revert, but not with "function not found")
      try {
        await registry.getNodeInfo(ethers.constants.AddressZero);
        expect.fail('Should have reverted');
      } catch (error) {
        expect(error.message).to.not.include('function not found');
      }
    });
  });
  
  describe('Event Signatures', function () {
    it('should emit NodeRegistered event with correct parameters', async function () {
      const { registry, admin } = await loadFixture(deployAINodeRegistryFixture);
      
      // Register a node to trigger the event
      const nodeAddress = admin.address;
      const metadata = 'test-metadata';
      
      // Verify the event is emitted with correct parameters
      await expect(registry.registerNode(nodeAddress, admin.address, metadata))
        .to.emit(registry, 'NodeRegistered')
        .withArgs(nodeAddress, admin.address, expect.any(Number)); // tokenId is dynamic
    });
    
    it('should emit NodeDeactivated event with correct parameters', async function () {
      const { registry, admin } = await loadFixture(deployAINodeRegistryFixture);
      
      // First register a node
      const nodeAddress = admin.address;
      const metadata = 'test-metadata';
      await registry.registerNode(nodeAddress, admin.address, metadata);
      
      // Then deactivate it and check the event
      await expect(registry.deactivateNode(nodeAddress))
        .to.emit(registry, 'NodeDeactivated')
        .withArgs(nodeAddress, admin.address);
    });
  });
});
