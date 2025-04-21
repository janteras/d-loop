/**
 * @title Basic Token Test
 * @dev Simple test for token approvals with minimal dependencies
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Include ethers v6 adapter for compatibility
require('../../../shims/ethers-v6-adapter');

describe("Basic Token Test", function() {
  let daiToken;
  let owner, user1, user2;
  
  beforeEach(async function() {
    // Get signers
    [owner, user1, user2] = await ethers.getSigners();
    
    console.log("Test accounts:");
    console.log("- Owner:", owner.address);
    console.log("- User1:", user1.address);
    console.log("- User2:", user2.address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("Test DAI", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI deployed at:", daiToken.target);
    
    // Mint tokens to users
    await daiToken.mint(user1.address, ethers.parseEther("1000"));
    console.log("Minted 1000 DAI to User1");
  });
  
  it("should allow approvals and transfers", async function() {
    // Approve tokens
    const amount = ethers.parseEther("500");
    await daiToken.connect(user1).approve(user2.address, amount);
    console.log("User1 approved User2 to spend 500 DAI");
    
    // Check allowance
    const allowance = await daiToken.allowance(user1.address, user2.address);
    console.log("Current allowance:", ethers.formatEther(allowance), "DAI");
    expect(allowance).to.equal(amount);
    
    // Transfer tokens
    await daiToken.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("200"));
    console.log("User2 transferred 200 DAI from User1's account");
    
    // Check balances
    const user1Balance = await daiToken.balanceOf(user1.address);
    const user2Balance = await daiToken.balanceOf(user2.address);
    
    console.log("User1 final balance:", ethers.formatEther(user1Balance), "DAI");
    console.log("User2 final balance:", ethers.formatEther(user2Balance), "DAI");
    
    // Verify balances
    expect(user1Balance).to.equal(ethers.parseEther("800"));
    expect(user2Balance).to.equal(ethers.parseEther("200"));
    
    // Check remaining allowance
    const remainingAllowance = await daiToken.allowance(user1.address, user2.address);
    console.log("Remaining allowance:", ethers.formatEther(remainingAllowance), "DAI");
    expect(remainingAllowance).to.equal(ethers.parseEther("300"));
  });
});