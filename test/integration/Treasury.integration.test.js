/**
 * @title Treasury and FeeCalculator Integration Test
 * @dev Integration test for Treasury and FeeCalculator contracts
 * 
 * This test ensures that:
 * 1. Treasury has proper role-based access control
 * 2. FeeCalculator properly calculates fees based on PriceOracle data
 * 3. Integration between Treasury, FeeCalculator, and PriceOracle works correctly
 * 4. ABI compatibility is maintained across all integration points
 */


/**
 * Helper function to handle different ethers.js versions
 * @param {Object} obj The object with address or getAddress
 * @returns {Promise<string>} The address
 */
async function getAddress(obj) {
  return typeof obj.getAddress === 'function' ? await getAddress(obj) : obj.address;
}
const { ethers } = require('hardhat');
require('../utils/ethers-v6-compat');
const { expect } = require('chai');
const deployer = require('../utils/direct-contract-deployer');
const helpers = require('../utils/ethers-helpers');

// Define roles and addresses
const Roles = {
  ADMIN: 'ADMIN_ROLE',
  FEE_MANAGER: 'FEE_MANAGER_ROLE'
};

const Addresses = {
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000'
};

// Test data
const TEST_FEE_PERCENTAGE = 250; // 2.5%
const TEST_PRICE_FEED = ethers.parseEther("1200.0"); // $1200 per token
const TEST_DEPOSIT_AMOUNT = ethers.parseEther("10.0"); // 10 tokens

describe("Treasury and FeeCalculator Integration", function() {
  let provider;
  let owner, admin, user, feeManager;
  let mockToken, treasury, priceOracle, feeCalculator;
  
  before(async function() {
    try {
      // Initialize provider and signers
      provider = deployer.createProvider();
      
      // Get accounts
      const accounts = await provider.listAccounts();
      console.log(`Found ${accounts.length} accounts`);
      
      // Use the first few accounts for different roles
      owner = provider.getSigner(0);
      admin = provider.getSigner(1);
      user = provider.getSigner(2);
      feeManager = provider.getSigner(3);
      
      // Get addresses for easier assertions
      // Check if getAddress is a function (ethers v6) or a property (ethers v5)
      const ownerAddress = typeof owner.getAddress === 'function' ? await getAddress(owner) : owner.address;
      const adminAddress = typeof admin.getAddress === 'function' ? await getAddress(admin) : admin.address;
      const userAddress = typeof user.getAddress === 'function' ? await getAddress(user) : user.address;
      const feeManagerAddress = typeof feeManager.getAddress === 'function' ? await getAddress(feeManager) : feeManager.address;
    
      console.log("Test accounts:");
      console.log(`Owner: ${ownerAddress}`);
      console.log(`Admin: ${adminAddress}`);
      console.log(`User: ${userAddress}`);
      console.log(`Fee Manager: ${feeManagerAddress}`);
      
      // Deploy contracts
      console.log("\nDeploying contracts for Treasury and FeeCalculator integration tests...");
      
      // Deploy MockToken
      mockToken = await deployer.deployContract('MockToken', owner, ["DLOOP Test Token", "DTEST", 18]);
      console.log(`MockToken deployed at: ${await getAddress(mockToken)}`);
      
      // Mint some tokens to test accounts
      const mintAmount = ethers.parseEther("1000.0");
      await mockToken.mint(userAddress, mintAmount);
      await mockToken.mint(ownerAddress, mintAmount);
      await mockToken.mint(adminAddress, mintAmount);
      
      // Deploy Treasury
      treasury = await deployer.deployContract('Treasury', owner, [
        adminAddress,
        await getAddress(mockToken)
      ]);
      console.log(`Treasury deployed at: ${await getAddress(treasury)}`);
      
      // Deploy PriceOracle
      priceOracle = await deployer.deployContract('PriceOracle', owner, [adminAddress]);
      console.log(`PriceOracle deployed at: ${await getAddress(priceOracle)}`);
      
      // Deploy FeeCalculator
      feeCalculator = await deployer.deployContract('FeeCalculator', owner, [
        adminAddress,
        await getAddress(priceOracle)
      ]);
      console.log(`FeeCalculator deployed at: ${await getAddress(feeCalculator)}`);
      
      // Set up roles and initial configuration
      
      // 1. Set up price feed in PriceOracle
      await priceOracle.connect(admin).setPrice(await getAddress(mockToken), TEST_PRICE_FEED);
      
      // 2. Grant FEE_MANAGER_ROLE to feeManager account
      const FEE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes(Roles.FEE_MANAGER_ROLE));
      await feeCalculator.connect(admin).grantRole(FEE_MANAGER_ROLE, feeManagerAddress);
      
      // 3. Set up fee percentage in FeeCalculator
      await feeCalculator.connect(feeManager).setFeePercentage(TEST_FEE_PERCENTAGE);
      
      // 4. Grant TREASURY_MANAGER_ROLE to admin account in Treasury
      const TREASURY_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('TREASURY_MANAGER_ROLE'));
      await treasury.connect(admin).grantRole(TREASURY_MANAGER_ROLE, adminAddress);
    } catch (error) {
      console.error("Error in setup:", error);
      throw error;
    }
  });
  
  describe("Role Configuration", function() {
    it("should correctly assign roles in Treasury", async function() {
      const adminAddress = await getAddress(admin);
      
      // Check DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const hasDefaultAdminRole = await treasury.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
      expect(hasDefaultAdminRole).to.be.true;
      
      // Check TREASURY_MANAGER_ROLE
      const TREASURY_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('TREASURY_MANAGER_ROLE'));
      const hasTreasuryManagerRole = await treasury.hasRole(TREASURY_MANAGER_ROLE, adminAddress);
      expect(hasTreasuryManagerRole).to.be.true;
    });
    
    it("should correctly assign roles in FeeCalculator", async function() {
      const adminAddress = await getAddress(admin);
      const feeManagerAddress = await getAddress(feeManager);
      
      // Check DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const hasDefaultAdminRole = await feeCalculator.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
      expect(hasDefaultAdminRole).to.be.true;
      
      // Check FEE_MANAGER_ROLE
      const FEE_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes(Roles.FEE_MANAGER_ROLE));
      const hasFeeManagerRole = await feeCalculator.hasRole(FEE_MANAGER_ROLE, feeManagerAddress);
      expect(hasFeeManagerRole).to.be.true;
    });
    
    it("should correctly assign roles in PriceOracle", async function() {
      const adminAddress = await getAddress(admin);
      
      // Check DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const hasDefaultAdminRole = await priceOracle.hasRole(DEFAULT_ADMIN_ROLE, adminAddress);
      expect(hasDefaultAdminRole).to.be.true;
      
      // Check PRICE_FEEDER_ROLE
      const PRICE_FEEDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes('PRICE_FEEDER_ROLE'));
      const hasPriceFeederRole = await priceOracle.hasRole(PRICE_FEEDER_ROLE, adminAddress);
      expect(hasPriceFeederRole).to.be.true;
    });
  });
  
  describe("Configuration Integrity", function() {
    it("should correctly set and retrieve fee percentage", async function() {
      const feePercentage = await feeCalculator.getFeePercentage();
      expect(feePercentage).to.equal(TEST_FEE_PERCENTAGE);
    });
    
    it("should correctly set and retrieve price feed", async function() {
      const tokenAddress = await getAddress(mockToken);
      const price = await priceOracle.getPrice(tokenAddress);
      expect(price).to.equal(TEST_PRICE_FEED);
    });
    
    it("should correctly link FeeCalculator to PriceOracle", async function() {
      const priceOracleAddress = await feeCalculator.getPriceOracle();
      const deployedPriceOracleAddress = await getAddress(priceOracle);
      
      expect(priceOracleAddress.toLowerCase()).to.equal(deployedPriceOracleAddress.toLowerCase());
    });
  });
  
  describe("Fee Calculation", function() {
    it("should correctly calculate fees based on price oracle data", async function() {
      const tokenAddress = await getAddress(mockToken);
      const amount = TEST_DEPOSIT_AMOUNT;
      
      // Calculate expected fee
      const price = await priceOracle.getPrice(tokenAddress);
      const feePercentage = await feeCalculator.getFeePercentage();
      
      // Value = amount * price
      const value = (BigInt(amount) * BigInt(price)) / BigInt(10**18);
      
      // Expected fee = value * feePercentage / 10000 (fee percentage is in basis points)
      const expectedFee = (value * BigInt(feePercentage)) / BigInt(10000);
      
      // Get calculated fee from contract
      const calculatedFee = await feeCalculator.calculateFee(tokenAddress, amount);
      
      console.log(`Amount: ${ethers.formatEther(amount)}`);
      console.log(`Price: ${ethers.formatEther(price)}`);
      console.log(`Value: ${value}`);
      console.log(`Fee Percentage: ${feePercentage / 100}%`);
      console.log(`Expected Fee: ${expectedFee}`);
      console.log(`Calculated Fee: ${calculatedFee}`);
      
      expect(calculatedFee).to.equal(expectedFee);
    });
    
    it("should update fee calculation when price changes", async function() {
      const tokenAddress = await getAddress(mockToken);
      const amount = TEST_DEPOSIT_AMOUNT;
      
      // Get initial fee
      const initialFee = await feeCalculator.calculateFee(tokenAddress, amount);
      
      // Change price in oracle
      const newPrice = TEST_PRICE_FEED * 2n; // Double the price
      await priceOracle.connect(admin).setPrice(tokenAddress, newPrice);
      
      // Get new fee
      const newFee = await feeCalculator.calculateFee(tokenAddress, amount);
      
      // New fee should be double the initial fee
      expect(newFee).to.equal(initialFee * BigInt(2));
      
      // Reset price for other tests
      await priceOracle.connect(admin).setPrice(tokenAddress, TEST_PRICE_FEED);
    });
    
    it("should update fee calculation when fee percentage changes", async function() {
      const tokenAddress = await getAddress(mockToken);
      const amount = TEST_DEPOSIT_AMOUNT;
      
      // Get initial fee
      const initialFee = await feeCalculator.calculateFee(tokenAddress, amount);
      
      // Change fee percentage
      const newFeePercentage = TEST_FEE_PERCENTAGE * 2; // Double the fee percentage
      await feeCalculator.connect(feeManager).setFeePercentage(newFeePercentage);
      
      // Get new fee
      const newFee = await feeCalculator.calculateFee(tokenAddress, amount);
      
      // New fee should be double the initial fee
      expect(newFee).to.equal(initialFee * BigInt(2));
      
      // Reset fee percentage for other tests
      await feeCalculator.connect(feeManager).setFeePercentage(TEST_FEE_PERCENTAGE);
    });
  });
  
  describe("Treasury Operations", function() {
    it("should allow deposits to Treasury", async function() {
      const userAddress = await getAddress(user);
      const depositAmount = parseBigInt("5.0");
      
      // Get initial balances
      const initialUserBalance = await mockToken.balanceOf(userAddress);
      const initialTreasuryBalance = await mockToken.balanceOf(await getAddress(treasury));
      
      // Approve tokens for transfer
      await mockToken.connect(user).approve(await getAddress(treasury), depositAmount);
      
      // Deposit tokens
      await treasury.connect(user).deposit(depositAmount);
      
      // Get final balances
      const finalUserBalance = await mockToken.balanceOf(userAddress);
      const finalTreasuryBalance = await mockToken.balanceOf(await getAddress(treasury));
      
      // Verify balances
      expect(finalUserBalance).to.equal(initialUserBalance - depositAmount);
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance + depositAmount);
    });
    
    it("should allow withdrawals by authorized accounts only", async function() {
      const adminAddress = await getAddress(admin);
      const withdrawAmount = parseBigInt("1.0");
      
      // Get initial balances
      const initialAdminBalance = await mockToken.balanceOf(adminAddress);
      const initialTreasuryBalance = await mockToken.balanceOf(await getAddress(treasury));
      
      // Withdraw tokens as admin (who has TREASURY_MANAGER_ROLE)
      await treasury.connect(admin).withdraw(adminAddress, withdrawAmount);
      
      // Get final balances
      const finalAdminBalance = await mockToken.balanceOf(adminAddress);
      const finalTreasuryBalance = await mockToken.balanceOf(await getAddress(treasury));
      
      // Verify balances
      expect(finalAdminBalance).to.equal(initialAdminBalance + withdrawAmount);
      expect(finalTreasuryBalance).to.equal(initialTreasuryBalance - withdrawAmount);
      
      // Verify unauthorized account cannot withdraw
      await expect(
        treasury.connect(user).withdraw(await getAddress(user), withdrawAmount)
      ).to.be.revertedWithCustomError(
        treasury,
        "AccessControlUnauthorizedAccount"
      );
    });
  });
  
  describe("ABI Compatibility", function() {
    it("should verify Treasury has correct function interfaces", async function() {
      // Check essential functions
      const depositFunc = treasury.interface.getFunction("deposit");
      expect(depositFunc).to.not.be.undefined;
      expect(depositFunc.inputs.length).to.equal(1);
      
      const withdrawFunc = treasury.interface.getFunction("withdraw");
      expect(withdrawFunc).to.not.be.undefined;
      expect(withdrawFunc.inputs.length).to.equal(2);
      
      // Check role functions
      const hasRoleFunc = treasury.interface.getFunction("hasRole");
      expect(hasRoleFunc).to.not.be.undefined;
      expect(hasRoleFunc.inputs.length).to.equal(2);
    });
    
    it("should verify FeeCalculator has correct function interfaces", async function() {
      // Check essential functions
      const calculateFeeFunc = feeCalculator.interface.getFunction("calculateFee");
      expect(calculateFeeFunc).to.not.be.undefined;
      expect(calculateFeeFunc.inputs.length).to.equal(2);
      
      const getFeePercentageFunc = feeCalculator.interface.getFunction("getFeePercentage");
      expect(getFeePercentageFunc).to.not.be.undefined;
      
      const setFeePercentageFunc = feeCalculator.interface.getFunction("setFeePercentage");
      expect(setFeePercentageFunc).to.not.be.undefined;
      expect(setFeePercentageFunc.inputs.length).to.equal(1);
    });
    
    it("should verify PriceOracle has correct function interfaces", async function() {
      // Check essential functions
      const getPriceFunc = priceOracle.interface.getFunction("getPrice");
      expect(getPriceFunc).to.not.be.undefined;
      expect(getPriceFunc.inputs.length).to.equal(1);
      
      const setPriceFunc = priceOracle.interface.getFunction("setPrice");
      expect(setPriceFunc).to.not.be.undefined;
      expect(setPriceFunc.inputs.length).to.equal(2);
    });
    
    it("should verify event signatures across contracts", async function() {
      // Check Treasury events
      const depositEvent = treasury.interface.getEvent("Deposit");
      expect(depositEvent).to.not.be.undefined;
      
      const withdrawEvent = treasury.interface.getEvent("Withdrawal");
      expect(withdrawEvent).to.not.be.undefined;
      
      // Check FeeCalculator events
      const feePercentageChangedEvent = feeCalculator.interface.getEvent("FeePercentageChanged");
      expect(feePercentageChangedEvent).to.not.be.undefined;
      
      // Check PriceOracle events
      const priceUpdatedEvent = priceOracle.interface.getEvent("PriceUpdated");
      expect(priceUpdatedEvent).to.not.be.undefined;
    });
  });
});