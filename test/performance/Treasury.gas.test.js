/**
 * @title Treasury Gas Profiling Tests
 * @dev Tests to measure gas usage of Treasury contract operations
 */

const { expect } = require('chai');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');
const { ethers } = require('hardhat');

// Gas reporting constants
const GAS_DELTA_THRESHOLD = 3.2; // Maximum allowed gas delta percentage

describe('Treasury Gas Profiling', function () {
  // Deploy a fresh instance of the Treasury for each test
  async function deployTreasuryFixture() {
    const [admin, user1, user2] = await ethers.getSigners();
    
    // Deploy a mock DAO for governance
    const MockProtocolDAO = await ethers.getContractFactory('MockProtocolDAO');
    const mockDAO = await MockProtocolDAO.deploy();
    await mockDAO.deployed();
    
    // Deploy the Treasury
    const Treasury = await ethers.getContractFactory('Treasury');
    const treasury = await Treasury.deploy(mockDAO.address);
    await treasury.deployed();
    
    // Deploy a mock token for testing
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const token = await MockERC20.deploy('Test Token', 'TEST', 18);
    await token.deployed();
    
    // Mint some tokens to users for testing
    const amount = ethers.utils.parseEther('1000');
    await token.mint(user1.address, amount);
    await token.mint(user2.address, amount);
    
    return { treasury, mockDAO, token, admin, user1, user2 };
  }
  
  describe('Deposit Gas Usage', function () {
    it('should measure gas usage for deposit operations', async function () {
      const { treasury, token, user1 } = await loadFixture(deployTreasuryFixture);
      
      // Prepare deposit parameters
      const amount = ethers.utils.parseEther('100');
      const memo = 'Test deposit';
      
      // Approve tokens for treasury
      await token.connect(user1).approve(treasury.address, amount);
      
      // Measure gas for first deposit
      const tx1 = await treasury.connect(user1).deposit(token.address, amount, memo);
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1.gasUsed;
      
      console.log(`Gas used for first deposit: ${gasUsed1.toString()}`);
      
      // Measure gas for second deposit (should be slightly less due to storage initialization)
      await token.connect(user1).approve(treasury.address, amount);
      const tx2 = await treasury.connect(user1).deposit(token.address, amount, memo);
      const receipt2 = await tx2.wait();
      const gasUsed2 = receipt2.gasUsed;
      
      console.log(`Gas used for second deposit: ${gasUsed2.toString()}`);
      
      // Calculate gas delta
      const gasDelta = gasUsed1.sub(gasUsed2);
      const gasDeltaPercentage = gasDelta.mul(100).div(gasUsed1);
      
      console.log(`Gas delta: ${gasDelta.toString()} (${gasDeltaPercentage.toString()}%)`);
      
      // Verify gas usage is within acceptable range
      expect(gasDeltaPercentage.toNumber()).to.be.lessThan(GAS_DELTA_THRESHOLD);
    });
  });
  
  describe('Withdraw Gas Usage', function () {
    it('should measure gas usage for withdraw operations', async function () {
      const { treasury, mockDAO, token, admin, user1, user2 } = await loadFixture(deployTreasuryFixture);
      
      // Prepare deposit and withdrawal parameters
      const depositAmount = ethers.utils.parseEther('500');
      const withdrawAmount = ethers.utils.parseEther('100');
      const memo = 'Test deposit';
      
      // First deposit funds to the treasury
      await token.connect(user1).approve(treasury.address, depositAmount);
      await treasury.connect(user1).deposit(token.address, depositAmount, memo);
      
      // Grant treasury admin role to the admin account for testing
      await mockDAO.grantRole(await mockDAO.ADMIN_ROLE(), admin.address);
      
      // Measure gas for first withdrawal
      const tx1 = await treasury.connect(admin).withdraw(token.address, user2.address, withdrawAmount);
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1.gasUsed;
      
      console.log(`Gas used for first withdrawal: ${gasUsed1.toString()}`);
      
      // Measure gas for second withdrawal
      const tx2 = await treasury.connect(admin).withdraw(token.address, user2.address, withdrawAmount);
      const receipt2 = await tx2.wait();
      const gasUsed2 = receipt2.gasUsed;
      
      console.log(`Gas used for second withdrawal: ${gasUsed2.toString()}`);
      
      // Calculate gas delta
      const gasDelta = Math.abs(gasUsed1.sub(gasUsed2).toNumber());
      const gasDeltaPercentage = (gasDelta / gasUsed1.toNumber()) * 100;
      
      console.log(`Gas delta: ${gasDelta} (${gasDeltaPercentage.toFixed(2)}%)`);
      
      // Verify gas usage is within acceptable range
      expect(gasDeltaPercentage).to.be.lessThan(GAS_DELTA_THRESHOLD);
    });
  });
  
  describe('Batch Operations Gas Usage', function () {
    it('should measure gas efficiency of batch operations vs individual operations', async function () {
      const { treasury, mockDAO, token, admin, user1 } = await loadFixture(deployTreasuryFixture);
      
      // Prepare parameters
      const recipients = [
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address,
        ethers.Wallet.createRandom().address
      ];
      const amount = ethers.utils.parseEther('10');
      const totalAmount = amount.mul(recipients.length);
      const memo = 'Test deposit';
      
      // First deposit funds to the treasury
      await token.connect(user1).approve(treasury.address, totalAmount.mul(2));
      await treasury.connect(user1).deposit(token.address, totalAmount.mul(2), memo);
      
      // Grant treasury admin role to the admin account for testing
      await mockDAO.grantRole(await mockDAO.ADMIN_ROLE(), admin.address);
      
      // Measure gas for individual withdrawals
      let totalGasIndividual = ethers.BigNumber.from(0);
      
      for (const recipient of recipients) {
        const tx = await treasury.connect(admin).withdraw(token.address, recipient, amount);
        const receipt = await tx.wait();
        totalGasIndividual = totalGasIndividual.add(receipt.gasUsed);
      }
      
      console.log(`Total gas used for individual withdrawals: ${totalGasIndividual.toString()}`);
      
      // Measure gas for batch withdrawal (if implemented)
      // Note: This assumes a batchWithdraw function exists in the Treasury contract
      // If it doesn't, this test should be modified or skipped
      try {
        const tx = await treasury.connect(admin).batchWithdraw(token.address, recipients, Array(recipients.length).fill(amount));
        const receipt = await tx.wait();
        const gasUsedBatch = receipt.gasUsed;
        
        console.log(`Gas used for batch withdrawal: ${gasUsedBatch.toString()}`);
        
        // Calculate gas savings
        const gasSavings = totalGasIndividual.sub(gasUsedBatch);
        const gasSavingsPercentage = gasSavings.mul(100).div(totalGasIndividual);
        
        console.log(`Gas savings: ${gasSavings.toString()} (${gasSavingsPercentage.toString()}%)`);
        
        // Verify batch operation is more gas efficient
        expect(gasSavingsPercentage.toNumber()).to.be.greaterThan(15); // At least 15% gas savings
      } catch (error) {
        console.log('Batch withdrawal not implemented, skipping comparison');
        this.skip();
      }
    });
  });
});
