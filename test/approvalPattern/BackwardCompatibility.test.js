/**
 * @title Backward Compatibility Tests
 * @dev Verifies that the token approval optimizations remain compatible with existing contracts
 */
const { ethers } = require("hardhat");
const { expect } = require("chai");

// Helper functions for approval tests
const computeRoleHash = (role) => ethers.keccak256(ethers.toUtf8Bytes(role));
const toWei = (value) => ethers.parseEther(value.toString());
const fromWei = (value) => ethers.formatEther(value);

async function deployMockToken(name, symbol, decimals = 18) {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  return await MockERC20.deploy(name, symbol, decimals);
}

async function getTokenAllowance(token, owner, spender) {
  return await token.allowance(owner, spender);
}

async function getTokenBalance(token, account) {
  return await token.balanceOf(account);
}

async function calculateGasUsed(tx) {
  const receipt = await tx.wait();
  return receipt.gasUsed;
}

async function calculateGasSavings(tx1, tx2) {
  const gas1 = await calculateGasUsed(tx1);
  const gas2 = await calculateGasUsed(tx2);
  return gas1 - gas2;
}

async function findEvent(receipt, eventName) {
  return receipt.events.find(event => event.event === eventName);
}

function getRoles() {
  return {
    ADMIN_ROLE: computeRoleHash("ADMIN_ROLE"),
    OPERATOR_ROLE: computeRoleHash("OPERATOR_ROLE"),
    TREASURY_ROLE: computeRoleHash("TREASURY_ROLE")
  };
}

describe("Token Approval Backward Compatibility", function() {
  let owner, user1, user2, user3, attacker, legacySystem;
  let mockToken, treasury, feeProcessor, assetDAO, protocolDAO;
  let mockLegacyConsumer, mockAllowanceChecker, mockPreviousVersionDAO;
  let ROLES;
  
  beforeEach(async function() {
    // Get signers
    [owner, user1, user2, user3, attacker, legacySystem] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock token for testing
    mockToken = await deployMockToken("Backward Compatibility Test", "BCT", 18, owner);
    
    // Deploy the contracts in the correct order
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(owner.address, owner.address);
    await treasury.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      treasury.address,
      treasury.address, // Using treasury as reward distributor for simplicity
      treasury.address, // Using treasury as fee calculator for simplicity
      owner.address,
      7000, // 70% treasury
      3000  // 30% reward distributor
    );
    await feeProcessor.grantRole(ROLES.ADMIN_ROLE, owner.address);
    await feeProcessor.grantRole(ROLES.AUTHORIZED_CONTRACT_ROLE, owner.address);
    
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      feeProcessor.address,
      owner.address // Using owner as protocolDAO for simplicity
    );
    await assetDAO.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
    protocolDAO = await ProtocolDAO.deploy(owner.address);
    await protocolDAO.grantRole(ROLES.ADMIN_ROLE, owner.address);
    
    // Deploy the mock contracts for legacy testing
    const MockLegacyConsumer = await ethers.getContractFactory("MockLegacyConsumer");
    mockLegacyConsumer = await MockLegacyConsumer.deploy();
    
    const MockAllowanceChecker = await ethers.getContractFactory("MockAllowanceChecker");
    mockAllowanceChecker = await MockAllowanceChecker.deploy();
    
    const MockPreviousVersionDAO = await ethers.getContractFactory("MockPreviousVersionDAO");
    mockPreviousVersionDAO = await MockPreviousVersionDAO.deploy();
    
    // Distribute tokens for testing
    await mockToken.transfer(assetDAO.address, toWei(1000));
    await mockToken.transfer(protocolDAO.address, toWei(1000));
    await mockToken.transfer(treasury.address, toWei(1000));
    await mockToken.transfer(feeProcessor.address, toWei(1000));
    await mockToken.transfer(user1.address, toWei(100));
    await mockToken.transfer(user2.address, toWei(100));
  });
  
  describe("Legacy Contract Interaction", function() {
    it("should allow legacy contracts to use approvals", async function() {
      // AssetDAO approves the legacy consumer
      await assetDAO.allowTokenTransfer(mockToken.address, mockLegacyConsumer.address, toWei(500));
      
      // Verify the approval was successful
      const allowance = await mockToken.allowance(assetDAO.address, mockLegacyConsumer.address);
      expect(allowance).to.equal(toWei(500));
      
      // Legacy contract executes a transfer using the approval
      await mockLegacyConsumer.executeTransfer(mockToken.address, assetDAO.address, user1.address, toWei(100));
      
      // Verify user1 received the tokens
      const user1Balance = await mockToken.balanceOf(user1.address);
      expect(user1Balance).to.equal(toWei(200)); // 100 original + 100 transferred
      
      // Check remaining allowance
      const remainingAllowance = await mockToken.allowance(assetDAO.address, mockLegacyConsumer.address);
      expect(remainingAllowance).to.equal(toWei(400));
    });
    
    it("should handle contracts that check allowance before each operation", async function() {
      // Treasury approves the allowance checker
      await treasury.allowTokenTransfer(mockToken.address, mockAllowanceChecker.address, toWei(250));
      
      // Perform 5 consecutive operations that check allowance each time
      for (let i = 0; i < 5; i++) {
        await mockAllowanceChecker.performOperation(
          mockToken.address,
          treasury.address,
          user2.address,
          toWei(50)
        );
      }
      
      // Verify user2 received all the tokens
      const user2Balance = await mockToken.balanceOf(user2.address);
      expect(user2Balance).to.equal(toWei(350)); // 100 original + 250 transferred
      
      // Allowance should be fully consumed
      const finalAllowance = await mockToken.allowance(treasury.address, mockAllowanceChecker.address);
      expect(finalAllowance).to.equal(toWei(0));
    });
    
    it("should support previous contract versions that used direct approvals", async function() {
      // FeeProcessor approves tokens to a previous version contract
      await feeProcessor.allowTokenTransfer(mockToken.address, mockPreviousVersionDAO.address, toWei(300));
      
      // Previous version contract uses the approval to transfer tokens
      await mockPreviousVersionDAO.useApproval(
        mockToken.address,
        feeProcessor.address,
        user3.address,
        toWei(200)
      );
      
      // Verify the tokens were transferred
      const user3Balance = await mockToken.balanceOf(user3.address);
      expect(user3Balance).to.equal(toWei(200));
      
      // Check remaining allowance
      const remainingAllowance = await mockToken.allowance(feeProcessor.address, mockPreviousVersionDAO.address);
      expect(remainingAllowance).to.equal(toWei(100));
    });
  });
  
  describe("Cross-Contract Approval Chain", function() {
    it("should support multi-contract approval chains", async function() {
      // Create an approval chain: protocolDAO -> treasury -> feeProcessor -> assetDAO
      await protocolDAO.allowTokenTransfer(mockToken.address, treasury.address, toWei(400));
      await treasury.allowTokenTransfer(mockToken.address, feeProcessor.address, toWei(300));
      await feeProcessor.allowTokenTransfer(mockToken.address, assetDAO.address, toWei(200));
      
      // Check all allowances are set correctly
      const allowance1 = await mockToken.allowance(protocolDAO.address, treasury.address);
      const allowance2 = await mockToken.allowance(treasury.address, feeProcessor.address);
      const allowance3 = await mockToken.allowance(feeProcessor.address, assetDAO.address);
      
      expect(allowance1).to.equal(toWei(400));
      expect(allowance2).to.equal(toWei(300));
      expect(allowance3).to.equal(toWei(200));
      
      // Now have each contract use the approval from the previous contract
      await treasury.withdrawFromProtocol(
        mockToken.address,
        protocolDAO.address,
        feeProcessor.address,
        toWei(100),
        "First step in chain"
      );
      
      await feeProcessor.transferTokens(
        mockToken.address,
        treasury.address,
        assetDAO.address,
        toWei(100),
        "Second step in chain"
      );
      
      // Check final balances to confirm the transfers worked
      const finalProtocolBalance = await mockToken.balanceOf(protocolDAO.address);
      const finalTreasuryBalance = await mockToken.balanceOf(treasury.address);
      const finalFeeProcessorBalance = await mockToken.balanceOf(feeProcessor.address);
      const finalAssetDAOBalance = await mockToken.balanceOf(assetDAO.address);
      
      // ProtocolDAO should have lost 100
      expect(finalProtocolBalance).to.equal(toWei(900));
      
      // Treasury received 100 from protocolDAO but sent 100 to feeProcessor, so balance unchanged
      expect(finalTreasuryBalance).to.equal(toWei(1000));
      
      // FeeProcessor received 100 from treasury but sent 100 to assetDAO, so balance unchanged
      expect(finalFeeProcessorBalance).to.equal(toWei(1000));
      
      // AssetDAO received 100 from feeProcessor
      expect(finalAssetDAOBalance).to.equal(toWei(1100));
    });
  });
  
  describe("Gas Optimization vs Backward Compatibility", function() {
    it("should achieve gas savings while maintaining compatibility", async function() {
      // First, do a standard ERC20 approve
      const standardApproveTx = await mockToken.connect(owner).approve(user1.address, toWei(1000));
      const standardApproveGas = await calculateGasUsed(standardApproveTx);
      
      // Then, do an optimized approve through a contract
      const optimizedApproveTx = await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(1000));
      const optimizedApproveGas = await calculateGasUsed(optimizedApproveTx);
      
      // Calculate savings
      const savings = calculateGasSavings(standardApproveGas, optimizedApproveGas);
      
      // Verify both approaches work by having user1 transfer tokens
      // First reset the approvals
      await mockToken.connect(owner).approve(user1.address, 0);
      await treasury.allowTokenTransfer(mockToken.address, user1.address, 0);
      
      // Then set them both to the same value
      await mockToken.connect(owner).approve(user1.address, toWei(100));
      await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(100));
      
      // Have user1 transfer tokens from both approaches
      await mockToken.connect(user1).transferFrom(owner.address, user3.address, toWei(50));
      await mockToken.connect(user1).transferFrom(treasury.address, user3.address, toWei(50));
      
      // Verify user3 received both transfers
      const user3Balance = await mockToken.balanceOf(user3.address);
      expect(user3Balance).to.equal(toWei(100));
      
      // Log the gas savings for analysis
      console.log("Gas optimization results:", savings);
    });
    
    it("should handle large token approval batches efficiently", async function() {
      // Create a batch of 10 tokens (using the same token for simplicity)
      const tokens = Array(10).fill(mockToken.address);
      const amounts = Array(10).fill(toWei(100));
      
      // Test batch approval
      const batchApproveTx = await treasury.batchAllowTokenTransfers(tokens, user1.address, amounts);
      const batchApproveGas = await calculateGasUsed(batchApproveTx);
      
      // Compare to 10 individual approvals
      let totalIndividualGas = 0;
      for (let i = 0; i < 10; i++) {
        const tx = await treasury.allowTokenTransfer(mockToken.address, user1.address, toWei(100));
        totalIndividualGas += await calculateGasUsed(tx);
      }
      
      // Calculate savings
      const savings = calculateGasSavings(totalIndividualGas, batchApproveGas);
      
      // Verify the batch approval worked
      const allowance = await mockToken.allowance(treasury.address, user1.address);
      expect(allowance).to.equal(toWei(100)); // The last approval is what counts
      
      // Log the gas savings for analysis
      console.log("Batch approval gas savings:", savings);
    });
    
    it("should detect and prevent approval exploits", async function() {
      // Simulate a scenario where an attacker tries to exploit non-atomicity of approve-transferFrom
      
      // Initial state: assetDAO approves attacker for 1000 tokens
      await assetDAO.allowTokenTransfer(mockToken.address, attacker.address, toWei(1000));
      
      // Attacker partially uses the approval
      await mockToken.connect(attacker).transferFrom(assetDAO.address, attacker.address, toWei(300));
      
      // AssetDAO decides to decrease the approval to 500, but the attacker might front-run
      // In a vulnerable implementation, the attacker could spend the original 1000,
      // then the owner sets it to 500, and the attacker gets to spend another 500
      
      // With our optimized implementation, this should detect the existing approval
      // and prevent the exploit by requiring a reset to 0 first or using the safe decrease method
      
      // Use the decrease method instead of setting a new value directly
      await assetDAO.connect(owner).decreaseTokenAllowance(
        mockToken.address, 
        attacker.address, 
        toWei(500)
      );
      
      // Check that the allowance is now correctly decreased
      const allowanceAfterDecrease = await mockToken.allowance(assetDAO.address, attacker.address);
      expect(allowanceAfterDecrease).to.equal(toWei(200)); // 1000 - 300 - 500 = 200
      
      // Attacker tries to spend more than the new allowance
      await expect(
        mockToken.connect(attacker).transferFrom(assetDAO.address, attacker.address, toWei(300))
      ).to.be.reverted; // Should revert due to insufficient allowance
      
      // Attacker can only spend the remaining allowance
      await mockToken.connect(attacker).transferFrom(assetDAO.address, attacker.address, toWei(200));
      
      // Now allowance should be zero
      const finalAllowance = await mockToken.allowance(assetDAO.address, attacker.address);
      expect(finalAllowance).to.equal(toWei(0));
    });
  });
});