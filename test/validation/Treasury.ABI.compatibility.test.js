const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { validateFunctionSignatures } = require('../utils/interfaceUtils');

describe('Treasury ABI Compatibility', function () {
  async function deployTreasuryFixture() {
    const [admin] = await ethers.getSigners();
    
    const Treasury = await ethers.getContractFactory('Treasury');
    const treasury = await Treasury.deploy(admin.address);
    await treasury.deployed();
    
    return { treasury, admin };
  }

  describe('Function Signatures', function () {
    it('should have all expected functions with correct signatures', async function () {
      const { treasury } = await loadFixture(deployTreasuryFixture);
      
      const expectedFunctions = [
        { name: 'distributeRewards', params: ['address', 'address[]', 'uint256[]'] },
        { name: 'withdraw', params: ['address', 'address', 'uint256'] },
        { name: 'deposit', params: ['address', 'uint256', 'string'] },
        { name: 'setRewardsContract', params: ['address', 'bool'] }
      ];
      
      await validateFunctionSignatures(treasury, expectedFunctions);
    });
  });

  describe('distributeRewards Functionality', function () {
    it('should distribute rewards to multiple recipients', async function () {
      const { treasury, admin } = await loadFixture(deployTreasuryFixture);
      
      // Deploy test token
      const TestToken = await ethers.getContractFactory('TestToken');
      const token = await TestToken.deploy();
      await token.deployed();
      
      // Fund treasury
      await token.transfer(treasury.address, ethers.utils.parseEther('100'));
      
      // Test distribution
      const recipients = [
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address
      ];
      const amounts = [
        ethers.utils.parseEther('10'),
        ethers.utils.parseEther('20')
      ];
      
      await expect(treasury.connect(admin).distributeRewards(
        token.address,
        recipients,
        amounts
      )).to.not.be.reverted;
    });
  });
});
