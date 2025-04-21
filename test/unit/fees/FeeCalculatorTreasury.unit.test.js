/**
 * @title FeeCalculator-Treasury Integration Test
 * @dev Tests the integration between FeeCalculator and Treasury contracts
 *      focusing on fee calculation, distribution and access control
 * @author DLOOP Protocol Team
 */

// Use the independent ethers v6 compatibility shim for maximum reliability
require('../../../../utils/test-init');
const { ethers } = require('hardhat');
const { expect } = require('chai');
const { 
  safeGetSigners, 
  safeDeployContract, 
  safeParseEther, 
  safeFormatEther,
  safeConnect
} = require('../../../../utils/ethers-helpers');

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const INVEST_FEE_PERCENTAGE = 200; // 2%
const DIVEST_FEE_PERCENTAGE = 100; // 1%
const RAGEQUIT_FEE_PERCENTAGE = 500; // 5%
const TREASURY_PERCENTAGE = 7000; // 70%
const REWARD_DIST_PERCENTAGE = 3000; // 30%
const TEST_AMOUNT = safeParseEther("10.0");
const TEST_INVEST_AMOUNT = safeParseEther("5.0");
const TEST_DIVEST_AMOUNT = safeParseEther("2.0");
const TEST_RAGEQUIT_AMOUNT = safeParseEther("1.0");

// Test suite
describe('FeeCalculator Treasury Integration', function() {
  // Extend timeout for the entire test suite
  this.timeout(TEST_TIMEOUT);
  
  // Test variables
  let owner, admin, user1, user2, rewardDistributor;
  let feeCalculator, treasury, mockToken;
  
  // Set up test environment before tests
  before(async function() {
    console.log("Setting up FeeCalculator and Treasury integration test...");
    
    try {
      // Get signers
      [owner, admin, user1, user2, rewardDistributor] = await safeGetSigners();
      
      console.log("Test accounts:");
      console.log(`- Owner: ${owner.address}`);
      console.log(`- Admin: ${admin.address}`);
      console.log(`- User1: ${user1.address}`);
      console.log(`- User2: ${user2.address}`);
      console.log(`- Reward Distributor: ${rewardDistributor.address}`);
      
      // Deploy MockToken for testing
      console.log("Deploying MockToken...");
      mockToken = await safeDeployContract("MockToken", ["Mock DAI", "mDAI", 18]);
      console.log(`MockToken deployed to: ${await mockToken.getAddress()}`);
      
      // Mint test tokens to users
      await mockToken.mint(user1.address, TEST_AMOUNT);
      await mockToken.mint(user2.address, TEST_AMOUNT);
      
      console.log(`Minted ${safeFormatEther(TEST_AMOUNT)} tokens to User1`);
      console.log(`Minted ${safeFormatEther(TEST_AMOUNT)} tokens to User2`);
      
      // Deploy Treasury
      console.log("Deploying Treasury...");
      treasury = await safeDeployContract("Treasury", [admin.address, owner.address]);
      console.log(`Treasury deployed to: ${await treasury.getAddress()}`);
      
      // Deploy FeeCalculator
      console.log("Deploying FeeCalculator...");
      feeCalculator = await safeDeployContract(
        "FeeCalculator", 
        [
          owner.address,
          admin.address,
          await treasury.getAddress(),
          rewardDistributor.address,
          TREASURY_PERCENTAGE,
          REWARD_DIST_PERCENTAGE
        ]
      );
      console.log(`FeeCalculator deployed to: ${await feeCalculator.getAddress()}`);
      
      // Configure fee percentages
      await feeCalculator.updateInvestFeePercentage(INVEST_FEE_PERCENTAGE);
      await feeCalculator.updateDivestFeePercentage(DIVEST_FEE_PERCENTAGE);
      await feeCalculator.updateRagequitFeePercentage(RAGEQUIT_FEE_PERCENTAGE);
      
      console.log("Fee percentages configured");
      
      // Grant fee collector role to user1
      const FEE_COLLECTOR_ROLE = await feeCalculator.FEE_COLLECTOR_ROLE();
      await feeCalculator.grantFeeCollectorRole(user1.address);
      
      console.log(`Granted fee collector role to User1: ${user1.address}`);
      
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });
  
  describe('Fee Calculation Flow', function() {
    it('should calculate invest fee correctly', async function() {
      const investAmount = TEST_INVEST_AMOUNT;
      const expectedFee = investAmount.mul(INVEST_FEE_PERCENTAGE).div(10000);
      
      const calculatedFee = await feeCalculator.calculateInvestFee(investAmount);
      expect(calculatedFee).to.equal(expectedFee);
      
      console.log(`Invest fee calculation verified: ${safeFormatEther(calculatedFee)} for ${safeFormatEther(investAmount)}`);
    });
    
    it('should calculate divest fee correctly', async function() {
      const divestAmount = TEST_DIVEST_AMOUNT;
      const expectedFee = divestAmount.mul(DIVEST_FEE_PERCENTAGE).div(10000);
      
      const calculatedFee = await feeCalculator.calculateDivestFee(divestAmount);
      expect(calculatedFee).to.equal(expectedFee);
      
      console.log(`Divest fee calculation verified: ${safeFormatEther(calculatedFee)} for ${safeFormatEther(divestAmount)}`);
    });
    
    it('should calculate ragequit fee correctly', async function() {
      const ragequitAmount = TEST_RAGEQUIT_AMOUNT;
      const expectedFee = ragequitAmount.mul(RAGEQUIT_FEE_PERCENTAGE).div(10000);
      
      const calculatedFee = await feeCalculator.calculateRagequitFee(ragequitAmount);
      expect(calculatedFee).to.equal(expectedFee);
      
      console.log(`Ragequit fee calculation verified: ${safeFormatEther(calculatedFee)} for ${safeFormatEther(ragequitAmount)}`);
    });
  });
  
  describe('Fee Distribution Flow', function() {
    it('should process invest fee and distribute to treasury and reward distributor', async function() {
      // Approve FeeCalculator to spend user1's tokens
      await mockToken.connect(safeConnect(user1, mockToken)).approve(
        await feeCalculator.getAddress(),
        TEST_INVEST_AMOUNT
      );
      
      // Process invest fee
      const txResponse = await feeCalculator.connect(safeConnect(user1, feeCalculator)).processInvestFee(
        await mockToken.getAddress(),
        user2.address, // Destination
        TEST_INVEST_AMOUNT
      );
      
      const receipt = await txResponse.wait();
      
      // Calculate expected fees
      const totalFee = TEST_INVEST_AMOUNT.mul(INVEST_FEE_PERCENTAGE).div(10000);
      const treasuryFee = totalFee.mul(TREASURY_PERCENTAGE).div(10000);
      const rewardFee = totalFee.mul(REWARD_DIST_PERCENTAGE).div(10000);
      
      // Verify treasury received its portion
      const treasuryBalance = await mockToken.balanceOf(await treasury.getAddress());
      expect(treasuryBalance).to.equal(treasuryFee);
      
      // Verify reward distributor received its portion
      const rewardBalance = await mockToken.balanceOf(rewardDistributor.address);
      expect(rewardBalance).to.equal(rewardFee);
      
      console.log(`Invest fee distribution verified:`);
      console.log(`- Total fee: ${safeFormatEther(totalFee)}`);
      console.log(`- Treasury received: ${safeFormatEther(treasuryFee)}`);
      console.log(`- Reward distributor received: ${safeFormatEther(rewardFee)}`);
    });
  });
  
  describe('Treasury Withdrawal Flow', function() {
    it('should allow treasury to withdraw funds', async function() {
      // Get treasury balance
      const treasuryAddress = await treasury.getAddress();
      const initialBalance = await mockToken.balanceOf(treasuryAddress);
      
      // Withdraw funds to user2
      await treasury.connect(safeConnect(admin, treasury)).withdraw(
        await mockToken.getAddress(),
        user2.address,
        initialBalance.div(2) // Withdraw half the balance
      );
      
      // Verify user2 received the funds
      const expectedUser2Balance = TEST_AMOUNT.add(initialBalance.div(2));
      const actualUser2Balance = await mockToken.balanceOf(user2.address);
      
      expect(actualUser2Balance).to.equal(expectedUser2Balance);
      
      // Verify treasury balance decreased
      const finalTreasuryBalance = await mockToken.balanceOf(treasuryAddress);
      expect(finalTreasuryBalance).to.equal(initialBalance.div(2));
      
      console.log(`Treasury withdrawal verified:`);
      console.log(`- Initial treasury balance: ${safeFormatEther(initialBalance)}`);
      console.log(`- Amount withdrawn: ${safeFormatEther(initialBalance.div(2))}`);
      console.log(`- Final treasury balance: ${safeFormatEther(finalTreasuryBalance)}`);
    });
  });
  
  describe('Access Control Integration', function() {
    it('should enforce fee collector role', async function() {
      // Approve tokens first
      await mockToken.connect(safeConnect(user2, mockToken)).approve(
        await feeCalculator.getAddress(),
        TEST_DIVEST_AMOUNT
      );
      
      // Attempt to process fee from non-collector
      await expect(
        feeCalculator.connect(safeConnect(user2, feeCalculator)).processDivestFee(
          await mockToken.getAddress(),
          user1.address,
          TEST_DIVEST_AMOUNT
        )
      ).to.be.revertedWith("Caller is not a fee collector");
    });
    
    it('should enforce treasury admin role', async function() {
      // Get remaining treasury balance
      const treasuryAddress = await treasury.getAddress();
      const treasuryBalance = await mockToken.balanceOf(treasuryAddress);
      
      // Attempt to withdraw as non-admin
      await expect(
        treasury.connect(safeConnect(user1, treasury)).withdraw(
          await mockToken.getAddress(),
          user1.address,
          treasuryBalance
        )
      ).to.be.revertedWith("Caller is not admin");
    });
  });
});