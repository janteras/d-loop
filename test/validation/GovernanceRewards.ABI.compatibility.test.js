const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');
const { validateFunctionSignatures } = require('../utils/interfaceUtils');

describe('GovernanceRewards ABI Compatibility', function () {
  async function deployGovernanceRewardsFixture() {
    const [admin] = await ethers.getSigners();
    
    // Deploy dependencies with proper initialization
    const Token = await ethers.getContractFactory('TestToken');
    const token = await Token.deploy();
    
    const Treasury = await ethers.getContractFactory('Treasury');
    const treasury = await Treasury.deploy(admin.address);
    
    const PriceOracle = await ethers.getContractFactory('ChainlinkPriceOracle');
    const oracle = await PriceOracle.deploy();
    
    // Deploy GovernanceRewards with all required constructor arguments
    const GovernanceRewards = await ethers.getContractFactory('GovernanceRewards');
    const rewards = await GovernanceRewards.deploy(
      token.address, // rewardToken
      treasury.address, // treasury
      oracle.address, // priceOracle
      admin.address, // admin
      86400, // rewardCooldown
      10000, // baseReward
      500, // votingParticipationBonus
      15000, // proposalQualityMultiplier
      20000, // aiNodeMultiplier
      100000 // rewardCap
    );
    
    return { rewards, admin, token, treasury, oracle };
  }

  describe('Function Signatures', function () {
    it('should match IGovernanceRewards interface exactly', async function () {
      const { rewards } = await loadFixture(deployGovernanceRewardsFixture);
      
      const expectedFunctions = [
        { name: 'distributeReward', params: ['address', 'uint256', 'string'] },
        { name: 'distributeRewardsBatch', params: ['address[]', 'uint256[]', 'string[]'] },
        { name: 'updateRewardConfig', 
          params: ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'] },
        { name: 'rewardToken', params: [], returns: ['address'] },
        { name: 'totalRewardsEarned', params: ['address'], returns: ['uint256'] },
        { name: 'isEligibleForRewards', params: ['address'], returns: ['bool'] }
      ];
      
      await validateFunctionSignatures(rewards, expectedFunctions);
    });
  });

  describe('Event Signatures', function () {
    it('should emit RewardDistributed with correct parameters', async function () {
      const { rewards, admin } = await loadFixture(deployGovernanceRewardsFixture);
      
      await expect(rewards.connect(admin).distributeReward(
        admin.address, 
        ethers.utils.parseEther('1'),
        'test'
      ))
        .to.emit(rewards, 'RewardDistributed')
        .withArgs(admin.address, ethers.utils.parseEther('1'), 'test');
    });
  });
});
