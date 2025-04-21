const hardhat = require("hardhat");
const { expect } = require("chai");

describe("PriceOracle Approval Mechanisms", function() {
  // Test accounts
  let owner, admin, priceUpdater, unauthorizedUser, newOwner, newAdmin;
  
  // Contracts
  let priceOracle, mockToken;
  
  // Constants
  const INITIAL_PRICE = BigInt("1000000000000000000"); // 1 ETH in wei
  const UPDATED_PRICE = BigInt("1500000000000000000"); // 1.5 ETH in wei
  const PRICE_DECIMALS = 18;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  // Role identifiers - compute inline instead of using utility functions
  const ADMIN_ROLE = "0xdf8b4c520ffe197c5343c6f5aec59570151ef9a492f2c624fd45ddde6135ec42";
  const PRICE_UPDATER_ROLE = "0x8f2248b23ecb7ac4b4b91875e4b7aafeb4882df6aa3438d4a744f46c98a79e7a";
  
  beforeEach(async function() {
    // Use hardcoded test addresses for simplicity
    // These accounts are commonly available in Hardhat's default test environment
    const testAccounts = [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // owner
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // admin
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // priceUpdater
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906", // unauthorizedUser
      "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", // newOwner
      "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"  // newAdmin
    ];
    
    // Create signer objects
    try {
      owner = await hardhat.ethers.getSigner(testAccounts[0]);
      admin = await hardhat.ethers.getSigner(testAccounts[1]);
      priceUpdater = await hardhat.ethers.getSigner(testAccounts[2]);
      unauthorizedUser = await hardhat.ethers.getSigner(testAccounts[3]);
      newOwner = await hardhat.ethers.getSigner(testAccounts[4]);
      newAdmin = await hardhat.ethers.getSigner(testAccounts[5]);
    } catch (e) {
      // Fallback approach - direct addresses
      owner = { address: testAccounts[0] };
      admin = { address: testAccounts[1] };
      priceUpdater = { address: testAccounts[2] };
      unauthorizedUser = { address: testAccounts[3] };
      newOwner = { address: testAccounts[4] };
      newAdmin = { address: testAccounts[5] };
    }
    
    // Deploy PriceOracle contract
    const PriceOracle = await hardhat.ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy(admin.address);
    await priceOracle.waitForDeployment();
    
    // Deploy mock token for testing
    const MockToken = await hardhat.ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();
    
    // Configure priceUpdater role
    await priceOracle.connect(admin).addPriceUpdater(priceUpdater.address);
  });
  
  describe("Role-Based Access Control", function() {
    it("should correctly assign roles during deployment", async function() {
      // Check legacy roles
      expect(await priceOracle.owner()).to.equal(owner.address);
      expect(await priceOracle.admin()).to.equal(admin.address);
      
      // Check OpenZeppelin AccessControl roles
      const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"; // DEFAULT_ADMIN_ROLE
      expect(await priceOracle.hasRole(ZERO_HASH, owner.address)).to.be.true; // DEFAULT_ADMIN_ROLE
      expect(await priceOracle.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
      expect(await priceOracle.hasRole(ADMIN_ROLE, owner.address)).to.be.true; // Owner should also have admin role
    });
    
    it("should properly manage price updater roles", async function() {
      // Check both legacy and new role systems
      expect(await priceOracle.priceUpdaters(priceUpdater.address)).to.be.true;
      expect(await priceOracle.hasRole(PRICE_UPDATER_ROLE, priceUpdater.address)).to.be.true;
      
      // Add a new price updater
      await priceOracle.connect(admin).addPriceUpdater(newAdmin.address);
      
      // Check the new updater is registered in both systems
      expect(await priceOracle.priceUpdaters(newAdmin.address)).to.be.true;
      expect(await priceOracle.hasRole(PRICE_UPDATER_ROLE, newAdmin.address)).to.be.true;
      
      // Remove a price updater
      await priceOracle.connect(admin).removePriceUpdater(priceUpdater.address);
      
      // Check the updater is removed from both systems
      expect(await priceOracle.priceUpdaters(priceUpdater.address)).to.be.false;
      expect(await priceOracle.hasRole(PRICE_UPDATER_ROLE, priceUpdater.address)).to.be.false;
    });
    
    it("should emit proper events when adding/removing price updaters", async function() {
      // Test adding a price updater
      await expect(priceOracle.connect(admin).addPriceUpdater(newAdmin.address))
        .to.emit(priceOracle, "PriceUpdaterAdded")
        .withArgs(newAdmin.address, admin.address);
      
      // Test removing a price updater
      await expect(priceOracle.connect(admin).removePriceUpdater(priceUpdater.address))
        .to.emit(priceOracle, "PriceUpdaterRemoved")
        .withArgs(priceUpdater.address, admin.address);
    });
  });
  
  describe("Admin Management", function() {
    it("should correctly update admin with proper role management", async function() {
      // Update admin
      await expect(priceOracle.connect(owner).updateAdmin(newAdmin.address))
        .to.emit(priceOracle, "AdminUpdated")
        .withArgs(admin.address, newAdmin.address);
      
      // Check the admin state
      expect(await priceOracle.admin()).to.equal(newAdmin.address);
      
      // Check roles are properly updated
      expect(await priceOracle.hasRole(ADMIN_ROLE, admin.address)).to.be.false;
      expect(await priceOracle.hasRole(ADMIN_ROLE, newAdmin.address)).to.be.true;
      expect(await priceOracle.hasRole(ADMIN_ROLE, owner.address)).to.be.true; // Owner should still have admin role
    });
    
    it("should prevent non-owners from updating admin", async function() {
      // Admin tries to update admin (should fail)
      await expect(
        priceOracle.connect(admin).updateAdmin(newAdmin.address)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
      
      // Unauthorized user tries to update admin (should fail)
      await expect(
        priceOracle.connect(unauthorizedUser).updateAdmin(newAdmin.address)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
    });
    
    it("should prevent updating admin to zero address", async function() {
      await expect(
        priceOracle.connect(owner).updateAdmin(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(priceOracle, "ZeroAddress");
    });
  });
  
  describe("Ownership Transfer with Timelock", function() {
    it("should initiate an ownership transfer request", async function() {
      // Request ownership transfer
      const tx = await priceOracle.connect(owner).requestOwnershipTransfer(newOwner.address);
      const receipt = await tx.wait();
      
      // Find the event
      const ownershipRequestedEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "OwnershipTransferRequested"
      );
      
      // Verify event was emitted
      expect(ownershipRequestedEvent).to.not.be.undefined;
      
      // Get the operation ID from the TimelockOperationRequested event
      const timelockEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TimelockOperationRequested"
      );
      expect(timelockEvent).to.not.be.undefined;
      
      // Check that ownership hasn't transferred yet
      expect(await priceOracle.owner()).to.equal(owner.address);
    });
    
    it("should prevent executing ownership transfer before timelock expires", async function() {
      // Request ownership transfer
      await priceOracle.connect(owner).requestOwnershipTransfer(newOwner.address);
      
      // Try to execute transfer immediately (should fail)
      await expect(
        priceOracle.connect(owner).executeOwnershipTransfer(newOwner.address)
      ).to.be.revertedWithCustomError(priceOracle, "OperationFailed");
      
      // Check ownership hasn't changed
      expect(await priceOracle.owner()).to.equal(owner.address);
    });
    
    it("should allow emergency ownership transfer without timelock", async function() {
      // Transfer ownership directly with the emergency function
      await expect(priceOracle.connect(owner).transferOwnership(newOwner.address))
        .to.emit(priceOracle, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);
      
      // Check the owner has been updated
      expect(await priceOracle.owner()).to.equal(newOwner.address);
      
      // Check roles are properly transferred
      const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"; // DEFAULT_ADMIN_ROLE
      expect(await priceOracle.hasRole(ZERO_HASH, owner.address)).to.be.false;
      expect(await priceOracle.hasRole(ZERO_HASH, newOwner.address)).to.be.true;
    });
    
    it("should prevent non-owners from transferring ownership", async function() {
      // Admin tries to transfer ownership (should fail)
      await expect(
        priceOracle.connect(admin).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
      
      // Unauthorized user tries to transfer ownership (should fail)
      await expect(
        priceOracle.connect(unauthorizedUser).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
    });
  });
  
  describe("Price Update Authorization", function() {
    beforeEach(async function() {
      // Set initial price with authorized user
      await priceOracle.connect(priceUpdater).setPrice(mockToken.address, INITIAL_PRICE);
    });
    
    it("should allow price updaters to update prices", async function() {
      // Update price with authorized updater
      await expect(priceOracle.connect(priceUpdater).setPrice(mockToken.address, UPDATED_PRICE))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(mockToken.address, INITIAL_PRICE, UPDATED_PRICE);
      
      // Verify the price was updated
      expect(await priceOracle.getPrice(mockToken.address)).to.equal(UPDATED_PRICE);
    });
    
    it("should allow admin to update prices", async function() {
      // Update price with admin
      await expect(priceOracle.connect(admin).setPrice(mockToken.address, UPDATED_PRICE))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(mockToken.address, INITIAL_PRICE, UPDATED_PRICE);
      
      // Verify the price was updated
      expect(await priceOracle.getPrice(mockToken.address)).to.equal(UPDATED_PRICE);
    });
    
    it("should allow owner to update prices", async function() {
      // Update price with owner
      await expect(priceOracle.connect(owner).setPrice(mockToken.address, UPDATED_PRICE))
        .to.emit(priceOracle, "PriceUpdated")
        .withArgs(mockToken.address, INITIAL_PRICE, UPDATED_PRICE);
      
      // Verify the price was updated
      expect(await priceOracle.getPrice(mockToken.address)).to.equal(UPDATED_PRICE);
    });
    
    it("should prevent unauthorized users from updating prices", async function() {
      // Try to update price with unauthorized user (should fail)
      await expect(
        priceOracle.connect(unauthorizedUser).setPrice(mockToken.address, UPDATED_PRICE)
      ).to.be.revertedWithCustomError(priceOracle, "Unauthorized");
      
      // Verify the price hasn't changed
      expect(await priceOracle.getPrice(mockToken.address)).to.equal(INITIAL_PRICE);
    });
    
    it("should allow access through both legacy and new role systems", async function() {
      // Add a price updater only through AccessControl system
      await priceOracle.grantRole(PRICE_UPDATER_ROLE, newAdmin.address);
      
      // User should be able to update prices through new role system even though not in legacy system
      expect(await priceOracle.priceUpdaters(newAdmin.address)).to.be.false;
      expect(await priceOracle.hasRole(PRICE_UPDATER_ROLE, newAdmin.address)).to.be.true;
      
      // Update price with the new updater
      await priceOracle.connect(newAdmin).setPrice(mockToken.address, UPDATED_PRICE);
      
      // Verify the price was updated
      expect(await priceOracle.getPrice(mockToken.address)).to.equal(UPDATED_PRICE);
    });
  });
  
  describe("IPriceOracle Interface Compatibility", function() {
    beforeEach(async function() {
      // Set price for test token
      await priceOracle.connect(admin).setDirectPrice(mockToken.address, INITIAL_PRICE, PRICE_DECIMALS);
    });
    
    it("should implement getAssetPrice from IPriceOracle interface", async function() {
      // Get price through the interface method
      const price = await priceOracle.getAssetPrice(mockToken.address);
      
      // Verify price is correct
      expect(price).to.equal(INITIAL_PRICE);
    });
    
    it("should implement getAssetDecimals from IPriceOracle interface", async function() {
      // Get decimals through the interface method
      const decimals = await priceOracle.getAssetDecimals(mockToken.address);
      
      // Verify decimals are correct
      expect(decimals).to.equal(PRICE_DECIMALS);
    });
    
    it("should prevent unauthorized direct price setting", async function() {
      // Only admin/owner should be able to set direct prices
      await expect(
        priceOracle.connect(priceUpdater).setDirectPrice(mockToken.address, UPDATED_PRICE, PRICE_DECIMALS)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotAdmin");
      
      await expect(
        priceOracle.connect(unauthorizedUser).setDirectPrice(mockToken.address, UPDATED_PRICE, PRICE_DECIMALS)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotAdmin");
    });
  });
  
  describe("Timelock Operations", function() {
    it("should allow cancelling a pending ownership transfer", async function() {
      // Request ownership transfer
      const tx = await priceOracle.connect(owner).requestOwnershipTransfer(newOwner.address);
      const receipt = await tx.wait();
      
      // Get the operation ID
      const timelockEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TimelockOperationRequested"
      );
      const operationId = timelockEvent.args[0];
      
      // Cancel the operation
      await expect(priceOracle.connect(owner).cancelTimelockOperation(operationId))
        .to.emit(priceOracle, "TimelockOperationCancelled")
        .withArgs(operationId, owner.address);
      
      // Check that the timelock has been cleared
      // We'll try to execute it and it should fail because the operation ID is no longer valid
      await hardhat.ethers.provider.send("evm_increaseTime", [86400 * 2]); // Fast forward 2 days
      await hardhat.ethers.provider.send("evm_mine");
      
      await expect(
        priceOracle.connect(owner).executeOwnershipTransfer(newOwner.address)
      ).to.be.revertedWithCustomError(priceOracle, "OperationFailed");
    });
    
    it("should prevent non-owners from cancelling timelock operations", async function() {
      // Request ownership transfer
      const tx = await priceOracle.connect(owner).requestOwnershipTransfer(newOwner.address);
      const receipt = await tx.wait();
      
      // Get the operation ID
      const timelockEvent = receipt.logs.find(
        log => log.fragment && log.fragment.name === "TimelockOperationRequested"
      );
      const operationId = timelockEvent.args[0];
      
      // Try to cancel as unauthorized users
      await expect(
        priceOracle.connect(admin).cancelTimelockOperation(operationId)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
      
      await expect(
        priceOracle.connect(unauthorizedUser).cancelTimelockOperation(operationId)
      ).to.be.revertedWithCustomError(priceOracle, "CallerNotOwner");
    });
  });
});
