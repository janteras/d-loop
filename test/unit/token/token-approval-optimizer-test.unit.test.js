const { expect } = require("chai");
const { ethers } = require("hardhat");

// Load enhanced ethers compatibility layer
const ethers = require("../../../utils/ethers-v6-compat.js");

describe("TokenApprovalOptimizer", function() {
  let tokenApprovalOptimizer;
  let owner;
  let user1;
  let user2;
  let mockToken;
  
  beforeEach(async function() {
    [owner, user1, user2] = await ethers.getSigners();
    
    console.log("Account addresses:");
    console.log("Owner:", owner.address);
    console.log("User1:", user1.address);
    console.log("User2:", user2.address);
    
    // Deploy a mock token for testing
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();
    
    console.log("MockToken deployed at:", await mockToken.getAddress());
    
    // Deploy the TokenApprovalOptimizer
    const TokenApprovalOptimizer = await ethers.getContractFactory("TokenApprovalOptimizer");
    tokenApprovalOptimizer = await TokenApprovalOptimizer.deploy(20); // 20% threshold
    await tokenApprovalOptimizer.waitForDeployment();
    
    console.log("TokenApprovalOptimizer deployed at:", await tokenApprovalOptimizer.getAddress());
    
    // Mint some tokens to the owner and approval optimizer
    const mintAmount = ethersAdapter.parseEther("1000");
    await mockToken.mint(owner.address, mintAmount);
    await mockToken.mint(await tokenApprovalOptimizer.getAddress(), ethersAdapter.parseEther("100"));
    
    console.log("Setup complete");
  });
  
  describe("transferTokens", function() {
    it("should correctly transfer tokens from the optimizer to a recipient", async function() {
      const optimizerAddress = await tokenApprovalOptimizer.getAddress();
      const tokenAddress = await mockToken.getAddress();
      const transferAmount = ethersAdapter.parseEther("50");
      
      // Check initial balances
      const initialOptimizerBalance = await mockToken.balanceOf(optimizerAddress);
      const initialUser1Balance = await mockToken.balanceOf(user1.address);
      
      console.log("Initial optimizer balance:", ethersAdapter.formatEther(initialOptimizerBalance));
      console.log("Initial user1 balance:", ethersAdapter.formatEther(initialUser1Balance));
      
      // Execute the transferTokens function
      await tokenApprovalOptimizer.transferTokens(
        tokenAddress,
        user1.address,
        transferAmount
      );
      
      // Check final balances
      const finalOptimizerBalance = await mockToken.balanceOf(optimizerAddress);
      const finalUser1Balance = await mockToken.balanceOf(user1.address);
      
      console.log("Final optimizer balance:", ethersAdapter.formatEther(finalOptimizerBalance));
      console.log("Final user1 balance:", ethersAdapter.formatEther(finalUser1Balance));
      
      // Verify the transfer
      expect(finalOptimizerBalance).to.equal(initialOptimizerBalance - transferAmount);
      expect(finalUser1Balance).to.equal(initialUser1Balance + transferAmount);
    });
    
    it("should revert when trying to transfer more tokens than the contract has", async function() {
      const tokenAddress = await mockToken.getAddress();
      const tooMuchAmount = ethersAdapter.parseEther("200"); // More than the 100 minted to the optimizer
      
      // Attempt to transfer too many tokens
      await expect(
        tokenApprovalOptimizer.transferTokens(
          tokenAddress,
          user1.address,
          tooMuchAmount
        )
      ).to.be.revertedWith("Insufficient balance for transfer");
    });
    
    it("should revert when transferring to the zero address", async function() {
      const tokenAddress = await mockToken.getAddress();
      const transferAmount = ethersAdapter.parseEther("10");
      
      // Attempt to transfer to the zero address
      await expect(
        tokenApprovalOptimizer.transferTokens(
          tokenAddress,
          ethersAdapter.ZeroAddress,
          transferAmount
        )
      ).to.be.revertedWith("Invalid recipient address");
    });
  });
  
  describe("optimizeApproval", function() {
    it("should optimize approvals when allowance is below threshold", async function() {
      const tokenAddress = await mockToken.getAddress();
      const spenderAddress = user2.address;
      const approvalAmount = ethersAdapter.parseEther("100");
      
      // First approve a small amount
      await mockToken.approve(spenderAddress, ethersAdapter.parseEther("10"));
      
      // Get initial allowance
      const initialAllowance = await mockToken.allowance(owner.address, spenderAddress);
      console.log("Initial allowance:", ethersAdapter.formatEther(initialAllowance));
      
      // Optimize the approval
      await tokenApprovalOptimizer.optimizeApproval(
        tokenAddress,
        owner.address,
        spenderAddress,
        approvalAmount
      );
      
      // Get final allowance
      const finalAllowance = await mockToken.allowance(owner.address, spenderAddress);
      console.log("Final allowance:", ethersAdapter.formatEther(finalAllowance));
      
      // Verify the optimization - should be maximum uint256
      const maxAllowance = await tokenApprovalOptimizer.MAX_APPROVAL();
      expect(finalAllowance).to.equal(maxAllowance);
    });
  });
});