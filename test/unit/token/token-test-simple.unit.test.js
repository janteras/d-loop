/**
 * @title Token Test (Simple Version)
 * @dev Basic test for token approvals using direct provider calls
 */

// Import ethers v6 adapter for compatibility
require('../../../shims/ethers-v6-adapter');

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Define helper functions directly in this file
async function getTokenBalance(tokenAddress, account) {
  try {
    const token = await ethers.getContractAt("DAIToken", tokenAddress);
    const encoded = token.interface.encodeFunctionData("balanceOf", [account]);
    const result = await ethers.provider.send("eth_call", [{
      to: tokenAddress,
      data: encoded
    }, "latest"]);
    
    const decoded = token.interface.decodeFunctionResult("balanceOf", result);
    return decoded[0];
  } catch (error) {
    console.error(`Error getting balance for ${account}:`, error.message);
    return ethers.parseEther("0");
  }
}

async function getTokenAllowance(tokenAddress, owner, spender) {
  try {
    const token = await ethers.getContractAt("DAIToken", tokenAddress);
    const encoded = token.interface.encodeFunctionData("allowance", [owner, spender]);
    const result = await ethers.provider.send("eth_call", [{
      to: tokenAddress,
      data: encoded
    }, "latest"]);
    
    const decoded = token.interface.decodeFunctionResult("allowance", result);
    return decoded[0];
  } catch (error) {
    console.error(`Error getting allowance for ${owner} -> ${spender}:`, error.message);
    return ethers.parseEther("0");
  }
}

describe("Basic Token Approvals", function() {
  // Test variables
  let daiToken;
  let owner, investor, spender;
  
  beforeEach(async function() {
    // Get signers
    [owner, investor, spender] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log("- Owner:", owner.address);
    console.log("- Investor:", investor.address);
    console.log("- Spender:", spender.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("DAI Stablecoin", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token deployed at:", daiToken.target);
    
    // Mint tokens to investor
    const mintAmount = ethers.parseEther("1000");
    await daiToken.mint(investor.address, mintAmount);
    console.log(`Minted ${ethers.formatEther(mintAmount)} DAI to investor`);
    
    // Check balance using helper
    const balance = await getTokenBalance(daiToken.target, investor.address);
    console.log(`Verified investor balance: ${ethers.formatEther(balance)} DAI`);
  });
  
  it("should correctly approve and transfer tokens", async function() {
    // Amount to approve
    const approvalAmount = ethers.parseEther("500");
    console.log(`\nApproving ${ethers.formatEther(approvalAmount)} DAI from investor to spender`);
    
    // Approve tokens
    await daiToken.connect(investor).approve(spender.address, approvalAmount);
    
    // Check allowance using helper
    const allowance = await getTokenAllowance(daiToken.target, investor.address, spender.address);
    console.log(`Allowance after approval: ${ethers.formatEther(allowance)} DAI`);
    
    // Verify allowance
    expect(allowance).to.equal(approvalAmount);
    console.log("✓ Allowance verified successfully");
    
    // Transfer tokens using allowance
    const transferAmount = ethers.parseEther("200");
    console.log(`\nTransferring ${ethers.formatEther(transferAmount)} DAI from investor to spender`);
    
    await daiToken.connect(spender).transferFrom(investor.address, spender.address, transferAmount);
    
    // Check balances after transfer
    const investorFinalBalance = await getTokenBalance(daiToken.target, investor.address);
    const spenderFinalBalance = await getTokenBalance(daiToken.target, spender.address);
    
    console.log(`Final investor balance: ${ethers.formatEther(investorFinalBalance)} DAI`);
    console.log(`Final spender balance: ${ethers.formatEther(spenderFinalBalance)} DAI`);
    
    // Verify balances
    expect(investorFinalBalance).to.equal(ethers.parseEther("800"));
    expect(spenderFinalBalance).to.equal(ethers.parseEther("200"));
    console.log("✓ Balances verified after transfer");
    
    // Check remaining allowance
    const finalAllowance = await getTokenAllowance(daiToken.target, investor.address, spender.address);
    console.log(`Remaining allowance: ${ethers.formatEther(finalAllowance)} DAI`);
    
    // Verify remaining allowance
    expect(finalAllowance).to.equal(ethers.parseEther("300"));
    console.log("✓ Remaining allowance verified");
  });
});