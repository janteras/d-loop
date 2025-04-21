/**
 * @title AINodeRegistry Token Approval Extended Tests
 * @dev Comprehensive tests for token approval patterns in AINodeRegistry contract
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');
const { expect } = require("chai");
const {
  computeRoleHash,
  toWei,
  deployMockToken,
  getTokenAllowance,
  getTokenBalance,
  calculateGasUsed,
  calculateGasSavings,
  findEvent,
  getRoles
} = require("./BaseApprovalTest");

describe("AINodeRegistry Token Approval Pattern", function() {
  let owner, admin, nodeOperator1, nodeOperator2, governanceContract, delegator, unauthorized;
  let dloopToken, aiNodeRegistry, tokenApprovalOptimizer;
  let ROLES;
  
  // Test constants
  const NODE_METADATA = "ipfs://QmNodeMetadataHash";
  const MIN_NODE_STAKE = toWei(1000);
  const TOKEN_REQUIREMENT_ID = 1;
  
  beforeEach(async function() {
    // Get signers
    [owner, admin, nodeOperator1, nodeOperator2, governanceContract, delegator, unauthorized] = await ethers.getSigners();
    
    // Get roles
    ROLES = getRoles();
    
    // Deploy mock DLoopToken
    dloopToken = await deployMockToken("DLOOP Test Token", "DLOOP", 18, owner);
    
    // Mint tokens to node operators for testing
    await dloopToken.mint(nodeOperator1.address, toWei(2000));
    await dloopToken.mint(nodeOperator2.address, toWei(2000));
    await dloopToken.mint(delegator.address, toWei(1000));
    
    // Deploy AINodeRegistry with zero address for governance contract initially
    const AINodeRegistry = await ethers.getContractFactory("AINodeRegistry");
    aiNodeRegistry = await AINodeRegistry.deploy(admin.address, "0x0000000000000000000000000000000000000000");
    await aiNodeRegistry.waitForDeployment();
    
    // Set governance contract
    await aiNodeRegistry.connect(owner).updateGovernanceContract(governanceContract.address);
    
    // Deploy TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy();
    await tokenApprovalOptimizer.waitForDeployment();
  });
  
  describe("1. Token Requirements Setup", function() {
    beforeEach(async function() {
      // Set token requirement for node registration (to be implemented in AINodeRegistry.sol extension)
      // This is a mock function call that would be added in the future
      if (aiNodeRegistry.setTokenRequirement) {
        await aiNodeRegistry.connect(admin).setTokenRequirement(
          TOKEN_REQUIREMENT_ID,
          dloopToken.address,
          MIN_NODE_STAKE
        );
      }
    });
    
    it("1.1 Should store token requirements correctly", async function() {
      // Skip test if function not implemented yet
      if (!aiNodeRegistry.getTokenRequirement) {
        this.skip();
      }
      
      const requirement = await aiNodeRegistry.getTokenRequirement(TOKEN_REQUIREMENT_ID);
      expect(requirement.token).to.equal(dloopToken.address);
      expect(requirement.amount).to.equal(MIN_NODE_STAKE);
    });
    
    it("1.2 Should restrict token requirement setting to admin", async function() {
      // Skip test if function not implemented yet
      if (!aiNodeRegistry.setTokenRequirement) {
        this.skip();
      }
      
      await expect(
        aiNodeRegistry.connect(unauthorized).setTokenRequirement(
          TOKEN_REQUIREMENT_ID + 1,
          dloopToken.address,
          MIN_NODE_STAKE
        )
      ).to.be.revertedWith("CallerNotAdmin");
    });
  });
  
  describe("2. Node Registration with Token Approval", function() {
    beforeEach(async function() {
      // Set token requirement if the function exists
      if (aiNodeRegistry.setTokenRequirement) {
        await aiNodeRegistry.connect(admin).setTokenRequirement(
          TOKEN_REQUIREMENT_ID,
          dloopToken.address,
          MIN_NODE_STAKE
        );
      }
    });
    
    it("2.1 Should verify token approval before node registration", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        this.skip();
      }
      
      // Try to register without approval
      await expect(
        aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
          nodeOperator1.address,
          NODE_METADATA,
          TOKEN_REQUIREMENT_ID
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
      
      // Approve tokens and then register
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      // Verify node is registered
      const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.owner).to.equal(nodeOperator1.address);
      expect(nodeDetails.metadata).to.equal(NODE_METADATA);
    });
    
    it("2.2 Should handle token transfers correctly during registration", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        this.skip();
      }
      
      // Check initial balance
      const initialBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Approve and register
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      // Check final balance
      const finalBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      expect(initialBalance.sub(finalBalance)).to.equal(MIN_NODE_STAKE);
      
      // Check registry contract received tokens
      const registryBalance = await getTokenBalance(dloopToken, aiNodeRegistry.address);
      expect(registryBalance).to.equal(MIN_NODE_STAKE);
    });
    
    it("2.3 Should revert registration with insufficient token approval", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        this.skip();
      }
      
      // Approve less than required
      const partialAmount = toWei(500); // Half of required amount
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, partialAmount);
      
      // Try to register with insufficient approval
      await expect(
        aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
          nodeOperator1.address,
          NODE_METADATA,
          TOKEN_REQUIREMENT_ID
        )
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
    
    it("2.4 Should measure gas usage for node registration with token approval", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        this.skip();
      }
      
      // Approve tokens
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      
      // Measure gas for registration
      const tx = await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      const gasUsed = await calculateGasUsed(tx);
      console.log(`Gas used for node registration with token approval: ${gasUsed}`);
      
      // Expect reasonable gas usage (adjust threshold as needed)
      expect(gasUsed).to.be.lessThan(300000);
    });
  });
  
  describe("3. Node Deregistration and Token Release", function() {
    beforeEach(async function() {
      // Skip setup if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        return;
      }
      
      // Set token requirement
      if (aiNodeRegistry.setTokenRequirement) {
        await aiNodeRegistry.connect(admin).setTokenRequirement(
          TOKEN_REQUIREMENT_ID,
          dloopToken.address,
          MIN_NODE_STAKE
        );
      }
      
      // Register node with staking
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
    });
    
    it("3.1 Should release staked tokens on node deregistration", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.deregisterNodeWithRefund) {
        this.skip();
      }
      
      // Check balance before deregistration
      const balanceBefore = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Deregister node
      await aiNodeRegistry.connect(nodeOperator1).deregisterNodeWithRefund();
      
      // Check balance after deregistration
      const balanceAfter = await getTokenBalance(dloopToken, nodeOperator1.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(MIN_NODE_STAKE);
      
      // Check node status
      const nodeDetails = await aiNodeRegistry.getNodeDetails(nodeOperator1.address);
      expect(nodeDetails.state).to.equal(0); // Inactive state
    });
    
    it("3.2 Should handle token release failure gracefully", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.deregisterNodeWithRefund) {
        this.skip();
      }
      
      // Disable token transfers (if mock token has this functionality)
      if (dloopToken.setTransfersEnabled) {
        await dloopToken.setTransfersEnabled(false);
      } else {
        this.skip();
      }
      
      // Attempt to deregister
      await expect(
        aiNodeRegistry.connect(nodeOperator1).deregisterNodeWithRefund()
      ).to.be.revertedWith("Transfers disabled");
    });
    
    it("3.3 Should only allow node owner to withdraw staked tokens", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.deregisterNodeWithRefund) {
        this.skip();
      }
      
      // Attempt by non-owner
      await expect(
        aiNodeRegistry.connect(unauthorized).deregisterNodeWithRefund()
      ).to.be.reverted;
    });
    
    it("3.4 Should prevent double withdrawal of staked tokens", async function() {
      // Skip if token staking not implemented yet
      if (!aiNodeRegistry.deregisterNodeWithRefund) {
        this.skip();
      }
      
      // First deregistration should succeed
      await aiNodeRegistry.connect(nodeOperator1).deregisterNodeWithRefund();
      
      // Second attempt should fail
      await expect(
        aiNodeRegistry.connect(nodeOperator1).deregisterNodeWithRefund()
      ).to.be.revertedWith("NodeNotRegistered");
    });
  });
  
  describe("4. Token Approval Optimization", function() {
    it("4.1 Should optimize token approvals using TokenApprovalOptimizer", async function() {
      // Skip if optimized token approval not implemented yet
      if (!aiNodeRegistry.registerNodeWithOptimizedApproval) {
        this.skip();
      }
      
      // First measure gas for standard approval
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, 0);
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      
      const standardTx = await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      const standardGas = await calculateGasUsed(standardTx);
      
      // Now measure with optimized approval
      await dloopToken.connect(nodeOperator2).approve(tokenApprovalOptimizer.address, MIN_NODE_STAKE);
      
      const optimizedTx = await aiNodeRegistry.connect(nodeOperator2).registerNodeWithOptimizedApproval(
        nodeOperator2.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID,
        tokenApprovalOptimizer.address
      );
      
      const optimizedGas = await calculateGasUsed(optimizedTx);
      
      // Calculate and log savings
      const savings = calculateGasSavings(standardGas, optimizedGas);
      console.log(`Gas usage comparison: ${JSON.stringify(savings)}`);
      
      // Expect some gas savings
      expect(optimizedGas).to.be.lessThan(standardGas);
    });
    
    it("4.2 Should handle unsafe approvals securely", async function() {
      // Skip if approval safety checks not implemented yet
      if (!aiNodeRegistry.registerNodeWithSafeApproval) {
        this.skip();
      }
      
      // Setup unsafe approval conditions
      const hugeAmount = toWei(1000000); // Much larger than needed
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, hugeAmount);
      
      // Register with safe approval should reset to appropriate amount
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithSafeApproval(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      // Check that allowance was reduced to zero after operation
      const allowance = await getTokenAllowance(dloopToken, nodeOperator1.address, aiNodeRegistry.address);
      expect(allowance).to.equal(0);
    });
  });
  
  describe("5. Admin Token Management", function() {
    it("5.1 Should allow admin to recover accidentally sent tokens", async function() {
      // Skip if token recovery not implemented yet
      if (!aiNodeRegistry.recoverERC20) {
        this.skip();
      }
      
      // Send tokens directly to the contract
      const amount = toWei(100);
      await dloopToken.connect(owner).transfer(aiNodeRegistry.address, amount);
      
      // Initial admin balance
      const initialAdminBalance = await getTokenBalance(dloopToken, admin.address);
      
      // Recover tokens
      await aiNodeRegistry.connect(admin).recoverERC20(
        dloopToken.address,
        amount,
        admin.address
      );
      
      // Final admin balance
      const finalAdminBalance = await getTokenBalance(dloopToken, admin.address);
      expect(finalAdminBalance.sub(initialAdminBalance)).to.equal(amount);
    });
    
    it("5.2 Should restrict token recovery to admin only", async function() {
      // Skip if token recovery not implemented yet
      if (!aiNodeRegistry.recoverERC20) {
        this.skip();
      }
      
      // Send tokens directly to the contract
      const amount = toWei(100);
      await dloopToken.connect(owner).transfer(aiNodeRegistry.address, amount);
      
      // Attempt recovery by unauthorized user
      await expect(
        aiNodeRegistry.connect(unauthorized).recoverERC20(
          dloopToken.address,
          amount,
          unauthorized.address
        )
      ).to.be.revertedWith("CallerNotAdmin");
    });
    
    it("5.3 Should prevent recovery of staked tokens", async function() {
      // Skip if both staking and token recovery not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking || !aiNodeRegistry.recoverERC20) {
        this.skip();
      }
      
      // Setup staking
      await aiNodeRegistry.connect(admin).setTokenRequirement(
        TOKEN_REQUIREMENT_ID,
        dloopToken.address,
        MIN_NODE_STAKE
      );
      
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
      
      // Try to recover staked tokens
      await expect(
        aiNodeRegistry.connect(admin).recoverERC20(
          dloopToken.address,
          MIN_NODE_STAKE,
          admin.address
        )
      ).to.be.revertedWith("Cannot recover staked tokens");
    });
  });
  
  describe("6. Token-Based Node Status Management", function() {
    beforeEach(async function() {
      // Skip setup if token staking not implemented yet
      if (!aiNodeRegistry.registerNodeWithStaking) {
        return;
      }
      
      // Set token requirement
      if (aiNodeRegistry.setTokenRequirement) {
        await aiNodeRegistry.connect(admin).setTokenRequirement(
          TOKEN_REQUIREMENT_ID,
          dloopToken.address,
          MIN_NODE_STAKE
        );
      }
      
      // Register node with staking
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, MIN_NODE_STAKE);
      await aiNodeRegistry.connect(nodeOperator1).registerNodeWithStaking(
        nodeOperator1.address,
        NODE_METADATA,
        TOKEN_REQUIREMENT_ID
      );
    });
    
    it("6.1 Should allow increasing staked token amount", async function() {
      // Skip if increasing stake not implemented yet
      if (!aiNodeRegistry.increaseNodeStake) {
        this.skip();
      }
      
      const additionalStake = toWei(500);
      
      // Initial balance
      const initialBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Approve and increase stake
      await dloopToken.connect(nodeOperator1).approve(aiNodeRegistry.address, additionalStake);
      await aiNodeRegistry.connect(nodeOperator1).increaseNodeStake(additionalStake);
      
      // Check balance reduced
      const finalBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      expect(initialBalance.sub(finalBalance)).to.equal(additionalStake);
    });
    
    it("6.2 Should allow decreasing staked token amount", async function() {
      // Skip if decreasing stake not implemented yet
      if (!aiNodeRegistry.decreaseNodeStake) {
        this.skip();
      }
      
      const decreaseAmount = toWei(200);
      
      // Initial balance
      const initialBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      
      // Decrease stake
      await aiNodeRegistry.connect(nodeOperator1).decreaseNodeStake(decreaseAmount);
      
      // Check balance increased
      const finalBalance = await getTokenBalance(dloopToken, nodeOperator1.address);
      expect(finalBalance.sub(initialBalance)).to.equal(decreaseAmount);
    });
    
    it("6.3 Should enforce minimum stake requirements", async function() {
      // Skip if decreasing stake not implemented yet
      if (!aiNodeRegistry.decreaseNodeStake) {
        this.skip();
      }
      
      // Try to decrease below minimum
      const tooMuchDecrease = toWei(900);
      
      await expect(
        aiNodeRegistry.connect(nodeOperator1).decreaseNodeStake(tooMuchDecrease)
      ).to.be.revertedWith("Remaining stake below minimum");
    });
  });
});