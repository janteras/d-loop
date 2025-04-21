require("../../ethers-v6-shim.simple");
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("FeeCalculator Authorization", function() {
  // Test accounts
  let owner, feeAdmin, treasury, rewardDistributor, user, newAdmin, newTreasury;
  
  // Contracts
  let feeCalculator, tokenApprovalOptimizer, mockToken;
  
  // Constants
  const INVEST_FEE = 1000; // 10%
  const DIVEST_FEE = 500;  // 5%
  const RAGEQUIT_FEE = 2000; // 20%
  const TREASURY_PERCENTAGE = 7000; // 70%
  const REWARDS_PERCENTAGE = 3000; // 30%
  
  const FEE_ADMIN_ROLE = "0x0fa3ffc1a85bc349d9a263a1f8fa65e874a4d922b680dae790b9f4a1d1e2773c";
  const FEE_COLLECTOR_ROLE = "0x27160668f6d176583786adef588762eb9a084873f161023c1e0dff73cf2cf0cd";
  const PARAMETER_SETTER_ROLE = "0x7065cb49fd77b2d88a4afde758e3ae8bba3db46b00c1bfecf3b89b5acfc4a536";
  
  beforeEach(async function() {
    // Use hardcoded test addresses for simplicity
    // These accounts are commonly available in Hardhat's default test environment
    const testAccounts = [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // owner
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // feeAdmin
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // treasury
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // rewardDistributor
      "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // user
      "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // newAdmin
      "0x976EA74026E726554dB657fA54763abd0C3a0aa9"  // newTreasury
    ];
    
    // Create signer objects
    try {
      owner = await ethers.getSigner(testAccounts[0]);
      feeAdmin = await ethers.getSigner(testAccounts[1]);
      treasury = await ethers.getSigner(testAccounts[2]);
      rewardDistributor = await ethers.getSigner(testAccounts[3]);
      user = await ethers.getSigner(testAccounts[4]);
      newAdmin = await ethers.getSigner(testAccounts[5]);
      newTreasury = await ethers.getSigner(testAccounts[6]);
    } catch (e) {
      // Fallback approach - direct addresses
      owner = { address: testAccounts[0] };
      feeAdmin = { address: testAccounts[1] };
      treasury = { address: testAccounts[2] };
      rewardDistributor = { address: testAccounts[3] };
      user = { address: testAccounts[4] };
      newAdmin = { address: testAccounts[5] };
      newTreasury = { address: testAccounts[6] };
    }
    
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy();
    await tokenApprovalOptimizer.waitForDeployment();
    
    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy(
      feeAdmin.address,
      treasury.address,
      rewardDistributor.address,
      INVEST_FEE,
      DIVEST_FEE,
      RAGEQUIT_FEE
    );
    await feeCalculator.waitForDeployment();
    
    // Set up token approval optimizer
    await feeCalculator.connect(owner).setApprovalOptimizer(tokenApprovalOptimizer.address);
    
    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();
    
    // Mint some tokens to test accounts
    // Helper function for parseEther
    function parseEther(value) {
      return BigInt(Math.floor(parseFloat(value) * 10 ** 18));
    }
    await mockToken.mint(user.address, parseEther("10000"));
    await mockToken.mint(feeCalculator.address, parseEther("100")); // For recovery tests
  });
  
  describe("Role-Based Access Control", function() {
    it("should correctly assign roles during deployment", async function() {
      // Check legacy roles
      expect(await feeCalculator.owner()).to.equal(owner.address);
      expect(await feeCalculator.feeAdmin()).to.equal(feeAdmin.address);
      
      // Check OpenZeppelin AccessControl roles
      const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"; // DEFAULT_ADMIN_ROLE
      expect(await feeCalculator.hasRole(ZERO_HASH, owner.address)).to.be.true; // DEFAULT_ADMIN_ROLE
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, feeAdmin.address)).to.be.true;
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, owner.address)).to.be.true; // Owner should also have fee admin role
      
      // Check fee collector roles for treasury and reward distributor
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, treasury.address)).to.be.true;
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, rewardDistributor.address)).to.be.true;
      
      // Check parameter setter roles
      expect(await feeCalculator.hasRole(PARAMETER_SETTER_ROLE, owner.address)).to.be.true;
      expect(await feeCalculator.hasRole(PARAMETER_SETTER_ROLE, feeAdmin.address)).to.be.true;
    });
    
    it("should allow owner to grant and revoke fee collector role", async function() {
      // Grant fee collector role to a new address
      await feeCalculator.connect(owner).grantFeeCollectorRole(newAdmin.address);
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, newAdmin.address)).to.be.true;
      
      // Revoke fee collector role
      await feeCalculator.connect(owner).revokeFeeCollectorRole(newAdmin.address);
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, newAdmin.address)).to.be.false;
    });
    
    it("should prevent non-owners from managing fee collector roles", async function() {
      // Fee admin tries to grant role (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).grantFeeCollectorRole(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // User tries to grant role (should fail)
      await expect(
        feeCalculator.connect(user).grantFeeCollectorRole(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
    });
  });
  
  describe("Fee Parameter Management", function() {
    it("should allow fee admin to update fee percentages", async function() {
      const newInvestFee = 1200; // 12%
      
      // Update invest fee percentage
      await expect(feeCalculator.connect(feeAdmin).updateInvestFeePercentage(newInvestFee))
        .to.emit(feeCalculator, "FeeParameterUpdated")
        .withArgs("Invest", INVEST_FEE, newInvestFee);
      
      // Verify fee was updated
      expect(await feeCalculator.investFeePercentage()).to.equal(newInvestFee);
    });
    
    it("should prevent unauthorized users from updating fee percentages", async function() {
      const newInvestFee = 1200; // 12%
      
      // User tries to update fee (should fail)
      await expect(
        feeCalculator.connect(user).updateInvestFeePercentage(newInvestFee)
      ).to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
      
      // Verify fee wasn't updated
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
    });
    
    it("should allow fee admin to request parameter changes with timelock", async function() {
      const paramType = "Invest";
      const newValue = 1200; // 12%
      
      // Request parameter change
      const tx = await feeCalculator.connect(feeAdmin).requestParameterChange(paramType, newValue);
      const receipt = await tx.wait();
      
      // Verify event was emitted
      const paramChangeEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ParameterChangeRequested"
      );
      expect(paramChangeEvent).to.not.be.undefined;
      
      // Verify fee wasn't immediately updated
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
    });
    
    it("should prevent executing parameter changes before timelock expires", async function() {
      const paramType = "Invest";
      const newValue = 1200; // 12%
      
      // Request parameter change
      const tx = await feeCalculator.connect(feeAdmin).requestParameterChange(paramType, newValue);
      const receipt = await tx.wait();
      
      // Get operation ID
      const paramChangeEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ParameterChangeRequested"
      );
      const operationId = paramChangeEvent.args[0];
      
      // Try to execute immediately (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).executeParameterChange(operationId, paramType, newValue)
      ).to.be.revertedWithCustomError(feeCalculator, "OperationFailed");
      
      // Verify fee wasn't updated
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
    });
    
    it("should allow executing parameter changes after timelock expires", async function() {
      const paramType = "Invest";
      const newValue = 1200; // 12%
      
      // Request parameter change
      const tx = await feeCalculator.connect(feeAdmin).requestParameterChange(paramType, newValue);
      const receipt = await tx.wait();
      
      // Get operation ID
      const paramChangeEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ParameterChangeRequested"
      );
      const operationId = paramChangeEvent.args[0];
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [86400 * 3]); // 3 days
      await ethers.provider.send("evm_mine");
      
      // Execute parameter change
      await expect(feeCalculator.connect(feeAdmin).executeParameterChange(operationId, paramType, newValue))
        .to.emit(feeCalculator, "FeeParameterUpdated")
        .withArgs(paramType, INVEST_FEE, newValue);
      
      // Verify fee was updated
      expect(await feeCalculator.investFeePercentage()).to.equal(newValue);
    });
    
    it("should allow fee admin to cancel parameter change requests", async function() {
      const paramType = "Invest";
      const newValue = 1200; // 12%
      
      // Request parameter change
      const tx = await feeCalculator.connect(feeAdmin).requestParameterChange(paramType, newValue);
      const receipt = await tx.wait();
      
      // Get operation ID
      const paramChangeEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ParameterChangeRequested"
      );
      const operationId = paramChangeEvent.args[0];
      
      // Cancel parameter change
      await expect(feeCalculator.connect(feeAdmin).cancelParameterChange(operationId))
        .to.emit(feeCalculator, "ParameterChangeCancelled")
        .withArgs(operationId);
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [86400 * 3]); // 3 days
      await ethers.provider.send("evm_mine");
      
      // Try to execute cancelled change (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).executeParameterChange(operationId, paramType, newValue)
      ).to.be.revertedWithCustomError(feeCalculator, "OperationFailed");
      
      // Verify fee wasn't updated
      expect(await feeCalculator.investFeePercentage()).to.equal(INVEST_FEE);
    });
  });
  
  describe("Fee Distribution Settings", function() {
    it("should allow fee admin to update distribution percentages", async function() {
      const newTreasuryPct = 6000; // 60%
      const newRewardPct = 4000;   // 40%
      
      // Update distribution percentages
      await expect(feeCalculator.connect(feeAdmin).updateDistributionPercentages(newTreasuryPct, newRewardPct))
        .to.emit(feeCalculator, "DistributionPercentagesUpdated")
        .withArgs(newTreasuryPct, newRewardPct);
      
      // Verify percentages were updated
      const [treasuryPct, rewardPct] = await feeCalculator.getDistributionPercentages();
      expect(treasuryPct).to.equal(newTreasuryPct);
      expect(rewardPct).to.equal(newRewardPct);
    });
    
    it("should prevent invalid distribution percentages", async function() {
      const invalidTreasuryPct = 6000; // 60%
      const invalidRewardPct = 3000;   // 30% (total 90%)
      
      // Try to update with percentages that don't add up to 100% (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).updateDistributionPercentages(invalidTreasuryPct, invalidRewardPct)
      ).to.be.revertedWithCustomError(feeCalculator, "InvalidDistributionPercentages");
      
      // Verify percentages weren't updated
      const [treasuryPct, rewardPct] = await feeCalculator.getDistributionPercentages();
      expect(treasuryPct).to.equal(TREASURY_PERCENTAGE);
      expect(rewardPct).to.equal(REWARDS_PERCENTAGE);
    });
  });
  
  describe("Destination Address Management", function() {
    it("should allow owner to update treasury address with proper role transfers", async function() {
      // Update treasury address
      await expect(feeCalculator.connect(owner).updateTreasury(newTreasury.address))
        .to.emit(feeCalculator, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury.address);
      
      // Verify address was updated
      expect(await feeCalculator.treasury()).to.equal(newTreasury.address);
      
      // Verify roles were transferred
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, treasury.address)).to.be.false;
      expect(await feeCalculator.hasRole(FEE_COLLECTOR_ROLE, newTreasury.address)).to.be.true;
    });
    
    it("should prevent non-owners from updating treasury", async function() {
      // Fee admin tries to update treasury (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).updateTreasury(newTreasury.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // User tries to update treasury (should fail)
      await expect(
        feeCalculator.connect(user).updateTreasury(newTreasury.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // Verify address wasn't updated
      expect(await feeCalculator.treasury()).to.equal(treasury.address);
    });
    
    it("should prevent updating treasury to invalid destinations", async function() {
      // Try to set zero address (should fail)
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      await expect(
        feeCalculator.connect(owner).updateTreasury(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(feeCalculator, "ZeroAddress");
      
      // Try to set self address (should fail)
      await expect(
        feeCalculator.connect(owner).updateTreasury(await feeCalculator.getAddress())
      ).to.be.revertedWithCustomError(feeCalculator, "InvalidDestination");
      
      // Verify address wasn't updated
      expect(await feeCalculator.treasury()).to.equal(treasury.address);
    });
  });
  
  describe("Fee Admin Management", function() {
    it("should allow owner to update fee admin with proper role transfers", async function() {
      // Update fee admin
      await expect(feeCalculator.connect(owner).updateFeeAdmin(newAdmin.address))
        .to.emit(feeCalculator, "FeeAdminUpdated")
        .withArgs(feeAdmin.address, newAdmin.address);
      
      // Verify address was updated
      expect(await feeCalculator.feeAdmin()).to.equal(newAdmin.address);
      
      // Verify roles were transferred
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, feeAdmin.address)).to.be.false;
      expect(await feeCalculator.hasRole(PARAMETER_SETTER_ROLE, feeAdmin.address)).to.be.false;
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, newAdmin.address)).to.be.true;
      expect(await feeCalculator.hasRole(PARAMETER_SETTER_ROLE, newAdmin.address)).to.be.true;
    });
    
    it("should prevent non-owners from updating fee admin", async function() {
      // Fee admin tries to update fee admin (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).updateFeeAdmin(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // User tries to update fee admin (should fail)
      await expect(
        feeCalculator.connect(user).updateFeeAdmin(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // Verify address wasn't updated
      expect(await feeCalculator.feeAdmin()).to.equal(feeAdmin.address);
    });
  });
  
  describe("Ownership Transfer", function() {
    it("should allow owner to transfer ownership with proper role transfers", async function() {
      // Transfer ownership
      await expect(feeCalculator.connect(owner).transferOwnership(newAdmin.address))
        .to.emit(feeCalculator, "OwnershipTransferred")
        .withArgs(owner.address, newAdmin.address);
      
      // Verify owner was updated
      expect(await feeCalculator.owner()).to.equal(newAdmin.address);
      
      // Verify roles were transferred
      const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"; // DEFAULT_ADMIN_ROLE
      expect(await feeCalculator.hasRole(ZERO_HASH, owner.address)).to.be.false;
      expect(await feeCalculator.hasRole(ZERO_HASH, newAdmin.address)).to.be.true;
      
      // Verify new owner has admin roles
      expect(await feeCalculator.hasRole(FEE_ADMIN_ROLE, newAdmin.address)).to.be.true;
      expect(await feeCalculator.hasRole(PARAMETER_SETTER_ROLE, newAdmin.address)).to.be.true;
    });
    
    it("should prevent non-owners from transferring ownership", async function() {
      // Fee admin tries to transfer ownership (should fail)
      await expect(
        feeCalculator.connect(feeAdmin).transferOwnership(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // User tries to transfer ownership (should fail)
      await expect(
        feeCalculator.connect(user).transferOwnership(newAdmin.address)
      ).to.be.revertedWithCustomError(feeCalculator, "CallerNotOwner");
      
      // Verify owner wasn't updated
      expect(await feeCalculator.owner()).to.equal(owner.address);
    });
  });
  
  describe("Fee Recovery", function() {
    it("should allow fee admin to recover stuck tokens", async function() {
      const initialBalance = await mockToken.balanceOf(feeCalculator.address);
      const treasuryBalance = await mockToken.balanceOf(treasury.address);
      
      // Recover tokens (should be sent to treasury)
      await feeCalculator.connect(feeAdmin).recoverTokens(mockToken.address);
      
      // Verify tokens were transferred to treasury
      expect(await mockToken.balanceOf(feeCalculator.address)).to.equal(0);
      expect(await mockToken.balanceOf(treasury.address)).to.equal(treasuryBalance + initialBalance);
    });
    
    it("should prevent unauthorized users from recovering tokens", async function() {
      // User tries to recover tokens (should fail)
      await expect(
        feeCalculator.connect(user).recoverTokens(mockToken.address)
      ).to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
      
      // Verify tokens weren't transferred
      expect(await mockToken.balanceOf(feeCalculator.address)).to.be.greaterThan(0);
    });
  });
  
  describe("Security and Access Control", function() {
    it("should enforce proper access control for fee calculation", async function() {
      const amount = BigInt("1000000000000000000"); // 1 ETH
      
      // Non-authorized user tries to calculate fees (should fail)
      await expect(
        feeCalculator.connect(user).calculateInvestFee(amount)
      ).to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
      
      // Grant collector role to user (so they can call calculateInvestFee)
      await feeCalculator.connect(owner).grantFeeCollectorRole(user.address);
      
      // Now user should be able to calculate fees
      const result = await feeCalculator.connect(user).calculateInvestFee(amount);
      expect(result).to.equal(amount * BigInt(INVEST_FEE) / BigInt(10000));
    });
    
    it("should enforce role-based access control for sensitive functions", async function() {
      // Test for parameter setter role
      await expect(
        feeCalculator.connect(user).requestParameterChange("Invest", 1200)
      ).to.be.revertedWithCustomError(feeCalculator, "Unauthorized");
      
      // Grant parameter setter role
      await feeCalculator.connect(owner).grantRole(PARAMETER_SETTER_ROLE, user.address);
      
      // Now user should be able to request parameter changes
      const tx = await feeCalculator.connect(user).requestParameterChange("Invest", 1200);
      const receipt = await tx.wait();
      
      // Verify event was emitted
      const paramChangeEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "ParameterChangeRequested"
      );
      expect(paramChangeEvent).to.not.be.undefined;
    });
  });
});