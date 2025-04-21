/**
 * @title Direct Token Test
 * @dev Simple test focusing exclusively on token approvals without complex contract interactions
 * @notice This test uses minimal contract interactions to isolate token approval functionality
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Direct Token Approvals", function() {
  // Test variables
  let daiToken;
  let owner, investor, spender;
  
  beforeEach(async function() {
    try {
      // Get accounts
      [owner, investor, spender] = await ethers.getSigners();
      
      console.log("Test accounts:");
      console.log("- Owner:", owner.address);
      console.log("- Investor:", investor.address);
      console.log("- Spender:", spender.address);
      
      // Deploy DAI token contract
      const DAIToken = await ethers.getContractFactory("DAIToken");
      daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
      await daiToken.waitForDeployment();
      console.log("DAI Token deployed at:", daiToken.target);
      
      // Mint tokens to investor
      const mintAmount = ethers.parseEther("1000");
      await daiToken.mint(investor.address, mintAmount);
      console.log(`Minted ${ethers.formatEther(mintAmount)} DAI to investor`);
      
      // Check initial balance using direct provider call to avoid issues
      const encoded = daiToken.interface.encodeFunctionData("balanceOf", [investor.address]);
      const result = await ethers.provider.send("eth_call", [{
        to: daiToken.target,
        data: encoded
      }, "latest"]);
      
      const decodedBalance = daiToken.interface.decodeFunctionResult("balanceOf", result);
      console.log(`Initial investor balance (raw call): ${decodedBalance[0].toString()}`);
    } catch (error) {
      console.error("Setup error:", error);
    }
  });

  // Run 10 iterations to ensure consistency
  for (let i = 1; i <= 10; i++) {
    it(`Iteration ${i}: should approve tokens and verify allowance`, async function() {
      try {
        console.log(`\n--- Running iteration ${i} ---`);
        
        // Amount to approve
        const approvalAmount = ethers.parseEther("100");
        console.log(`Approving ${ethers.formatEther(approvalAmount)} DAI from investor to spender`);
        
        // Approve via transaction
        const approveTx = await daiToken.connect(investor).approve(spender.address, approvalAmount);
        
        // Wait for approval transaction
        await approveTx.wait();
        console.log("Approval transaction completed");
        
        // Check allowance using direct provider call
        const encoded = daiToken.interface.encodeFunctionData("allowance", [investor.address, spender.address]);
        const result = await ethers.provider.send("eth_call", [{
          to: daiToken.target,
          data: encoded
        }, "latest"]);
        
        const decodedAllowance = daiToken.interface.decodeFunctionResult("allowance", result);
        const allowance = decodedAllowance[0];
        console.log(`Allowance (raw call): ${allowance.toString()}`);
        
        // Verify allowance
        expect(allowance).to.equal(approvalAmount);
        console.log("✓ Allowance verified successfully");
        
        // Test transfer from investor to spender
        const transferAmount = ethers.parseEther("50");
        console.log(`Testing transferFrom of ${ethers.formatEther(transferAmount)} DAI`);
        
        // Execute transferFrom
        const transferTx = await daiToken.connect(spender).transferFrom(
          investor.address, 
          spender.address, 
          transferAmount
        );
        
        await transferTx.wait();
        console.log("TransferFrom transaction completed");
        
        // Check final balances using direct provider calls
        const encodedInvestor = daiToken.interface.encodeFunctionData("balanceOf", [investor.address]);
        const encodedSpender = daiToken.interface.encodeFunctionData("balanceOf", [spender.address]);
        
        const investorResult = await ethers.provider.send("eth_call", [{
          to: daiToken.target,
          data: encodedInvestor
        }, "latest"]);
        
        const spenderResult = await ethers.provider.send("eth_call", [{
          to: daiToken.target,
          data: encodedSpender
        }, "latest"]);
        
        const investorBalance = daiToken.interface.decodeFunctionResult("balanceOf", investorResult)[0];
        const spenderBalance = daiToken.interface.decodeFunctionResult("balanceOf", spenderResult)[0];
        
        console.log(`Final investor balance: ${investorBalance.toString()}`);
        console.log(`Final spender balance: ${spenderBalance.toString()}`);
        
        // Verify balances changed as expected
        expect(spenderBalance).to.be.at.least(transferAmount);
        console.log("✓ Token transfer completed successfully");
        
        // Check remaining allowance
        const encodedRemaining = daiToken.interface.encodeFunctionData("allowance", [investor.address, spender.address]);
        const remainingResult = await ethers.provider.send("eth_call", [{
          to: daiToken.target,
          data: encodedRemaining
        }, "latest"]);
        
        const remainingAllowance = daiToken.interface.decodeFunctionResult("allowance", remainingResult)[0];
        console.log(`Remaining allowance: ${remainingAllowance.toString()}`);
        
        // Verify remaining allowance
        expect(remainingAllowance).to.equal(approvalAmount - transferAmount);
        console.log("✓ Remaining allowance verified correctly");
        
      } catch (error) {
        console.error(`Iteration ${i} failed:`, error);
        throw error;
      }
    });
  }
});