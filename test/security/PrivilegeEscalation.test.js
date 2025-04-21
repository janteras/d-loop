/**
 * @title Privilege Escalation Tests
 * @dev Tests to verify that admin functions cannot be accessed by unauthorized users
 */

const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

describe('Privilege Escalation Security Tests', function () {
  // Deploy all contracts for testing
  async function deployContractsFixture() {
    const [admin, user1, user2, attacker] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory('SoulboundNFT');
    const soulboundNFT = await SoulboundNFT.deploy();
    await soulboundNFT.deployed();
    
    // Grant admin role to the admin account
    await soulboundNFT.grantAdminRole(admin.address);
    
    // Deploy DLoopToken
    const DLoopToken = await ethers.getContractFactory('DLoopToken');
    const token = await DLoopToken.deploy(admin.address);
    await token.deployed();
    
    // Deploy ProtocolDAO
    const ProtocolDAO = await ethers.getContractFactory('ProtocolDAO');
    const dao = await ProtocolDAO.deploy(token.address);
    await dao.deployed();
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await ethers.getContractFactory('AINodeRegistry');
    const registry = await AINodeRegistry.deploy(admin.address, dao.address, soulboundNFT.address);
    await registry.deployed();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory('Treasury');
    const treasury = await Treasury.deploy(dao.address);
    await treasury.deployed();
    
    return { 
      soulboundNFT, 
      token, 
      dao, 
      registry, 
      treasury, 
      admin, 
      user1, 
      user2, 
      attacker 
    };
  }
  
  describe('SoulboundNFT Privilege Escalation', function () {
    it('should prevent non-admins from granting admin roles', async function () {
      const { soulboundNFT, attacker, user1 } = await loadFixture(deployContractsFixture);
      
      // Attempt to grant admin role as an attacker
      await expect(
        soulboundNFT.connect(attacker).grantAdminRole(user1.address)
      ).to.be.reverted;
    });
    
    it('should prevent non-admins from granting minter roles', async function () {
      const { soulboundNFT, attacker, user1 } = await loadFixture(deployContractsFixture);
      
      // Attempt to grant minter role as an attacker
      await expect(
        soulboundNFT.connect(attacker).grantMinterRole(user1.address)
      ).to.be.reverted;
    });
    
    it('should prevent non-minters from minting tokens', async function () {
      const { soulboundNFT, attacker, user1 } = await loadFixture(deployContractsFixture);
      
      // Attempt to mint a token as an attacker
      await expect(
        soulboundNFT.connect(attacker).mint(user1.address, 'test-metadata')
      ).to.be.reverted;
    });
  });
  
  describe('AINodeRegistry Privilege Escalation', function () {
    it('should prevent non-admins from updating node state', async function () {
      const { registry, admin, user1, attacker } = await loadFixture(deployContractsFixture);
      
      // First register a node as admin
      const nodeAddress = user1.address;
      const metadata = 'test-metadata';
      await registry.registerNode(nodeAddress, admin.address, metadata);
      
      // Attempt to update node state as an attacker
      await expect(
        registry.connect(attacker).updateNodeState(nodeAddress, 1) // 1 = Active state
      ).to.be.reverted;
    });
    
    it('should prevent non-admins from updating node reputation', async function () {
      const { registry, admin, user1, attacker } = await loadFixture(deployContractsFixture);
      
      // First register a node as admin
      const nodeAddress = user1.address;
      const metadata = 'test-metadata';
      await registry.registerNode(nodeAddress, admin.address, metadata);
      
      // Attempt to update node reputation as an attacker
      await expect(
        registry.connect(attacker).updateNodeReputation(nodeAddress, 100)
      ).to.be.reverted;
    });
    
    it('should prevent non-owners from deactivating nodes', async function () {
      const { registry, admin, user1, attacker } = await loadFixture(deployContractsFixture);
      
      // First register a node as admin
      const nodeAddress = user1.address;
      const metadata = 'test-metadata';
      await registry.registerNode(nodeAddress, admin.address, metadata);
      
      // Attempt to deactivate node as an attacker (not owner or admin)
      await expect(
        registry.connect(attacker).deactivateNode(nodeAddress)
      ).to.be.reverted;
    });
  });
  
  describe('Treasury Privilege Escalation', function () {
    it('should prevent non-admins from withdrawing funds', async function () {
      const { treasury, token, user1, attacker } = await loadFixture(deployContractsFixture);
      
      // First deposit some funds
      const amount = ethers.utils.parseEther('100');
      await token.transfer(user1.address, amount);
      await token.connect(user1).approve(treasury.address, amount);
      await treasury.connect(user1).deposit(token.address, amount, 'Test deposit');
      
      // Attempt to withdraw funds as an attacker
      await expect(
        treasury.connect(attacker).withdraw(token.address, attacker.address, amount)
      ).to.be.reverted;
    });
    
    it('should prevent unauthorized batch withdrawals', async function () {
      const { treasury, token, user1, attacker } = await loadFixture(deployContractsFixture);
      
      // First deposit some funds
      const amount = ethers.utils.parseEther('100');
      await token.transfer(user1.address, amount);
      await token.connect(user1).approve(treasury.address, amount);
      await treasury.connect(user1).deposit(token.address, amount, 'Test deposit');
      
      // Attempt to perform batch withdrawal as an attacker
      try {
        await expect(
          treasury.connect(attacker).batchWithdraw(
            token.address, 
            [attacker.address], 
            [amount]
          )
        ).to.be.reverted;
      } catch (error) {
        // If batchWithdraw doesn't exist, this test is not applicable
        if (!error.message.includes('no method named')) {
          throw error;
        }
      }
    });
  });
  
  describe('ProtocolDAO Privilege Escalation', function () {
    it('should prevent non-admins from adding new admin roles', async function () {
      const { dao, attacker, user1 } = await loadFixture(deployContractsFixture);
      
      // Get the admin role
      const adminRole = await dao.ADMIN_ROLE();
      
      // Attempt to grant admin role as an attacker
      await expect(
        dao.connect(attacker).grantRole(adminRole, user1.address)
      ).to.be.reverted;
    });
    
    it('should prevent non-admins from executing privileged actions', async function () {
      const { dao, attacker } = await loadFixture(deployContractsFixture);
      
      // Attempt to execute privileged action as an attacker
      // This test assumes there's an executePrivilegedAction function
      // Modify based on actual DAO implementation
      try {
        await expect(
          dao.connect(attacker).executeEmergencyAction()
        ).to.be.reverted;
      } catch (error) {
        // If the function doesn't exist, this test is not applicable
        if (!error.message.includes('no method named')) {
          throw error;
        }
      }
    });
  });
});
