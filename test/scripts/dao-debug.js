// Include the ethers v6 adapter for compatibility
require('../shims/ethers-v6-adapter');

const { expect } = require("chai");

// Import ethers directly first
const ethersLib = require("ethers");
// Add compatibility utilities from ethers
const parseEther = ethersLib.parseEther;

// Then import hardhat runtime 
const { ethers } = require("hardhat");

describe("AssetDAO Debug Test", function () {
  let daiToken;
  let assetDAO;
  let owner, investor;

  beforeEach(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    [owner, investor] = signers;
    
    // Print addresses for debugging
    console.log("All signers:", signers.map(s => s.address));
    console.log("Owner (0):", owner.address);
    console.log("Investor (1):", investor.address);
    console.log("signer[2]:", signers[2].address);
    console.log("signer[3]:", signers[3].address);
    
    // Deploy DAI token
    const DAIToken = await ethers.getContractFactory("DAIToken");
    daiToken = await DAIToken.deploy("Test DAI", "DAI", 18);
    await daiToken.waitForDeployment();
    console.log("DAI Token address:", daiToken.target);
    
    // Mint tokens to multiple accounts to ensure we have them
    const accounts = [
      owner.address,
      investor.address,
      signers[2].address,
      signers[3].address,
      "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" // hardcoded account from error
    ];
    
    for (const account of accounts) {
      await daiToken.mint(account, parseEther("1000000"));
      console.log(`Minted 1000000 DAI to ${account}`);
      
      // Get the balance to verify
      const balance = await daiToken.balanceOf(account);
      console.log(`Balance for ${account}: ${balance.toString()}`);
    }
    
    // Create a basic AssetDAO
    const AssetDAO = await ethers.getContractFactory("AssetDAO");
    assetDAO = await AssetDAO.deploy(
      daiToken.target,
      owner.address, // placeholder for token
      owner.address, // placeholder for oracle
      owner.address  // placeholder for fee processor
    );
    await assetDAO.waitForDeployment();
    console.log("AssetDAO deployed at:", assetDAO.target);
    
    // First, check if approvals work properly
    console.log("Testing approval from investor to AssetDAO");
    await daiToken.connect(investor).approve(assetDAO.target, parseEther("50000"));
    const allowance = await daiToken.allowance(investor.address, assetDAO.target);
    console.log("Allowance after approval:", allowance.toString());
    
    // Test direct transfer to see if that works
    console.log("Testing direct transfer from investor to AssetDAO");
    await daiToken.connect(investor).transfer(assetDAO.target, parseEther("1000"));
    const assetDAOBalance = await daiToken.balanceOf(assetDAO.target);
    console.log("AssetDAO balance after direct transfer:", assetDAOBalance.toString());
  });

  it("Should verify wallet addresses and test transferFrom directly", async function () {
    try {
      // Test transferFrom directly to rule out AssetDAO contract issues
      console.log("Testing transferFrom directly from DAI token contract");
      
      await daiToken.connect(owner).transferFrom(investor.address, assetDAO.target, parseEther("1000"));
      
      const balanceAfter = await daiToken.balanceOf(assetDAO.target);
      console.log("AssetDAO balance after transferFrom:", balanceAfter.toString());
      expect(balanceAfter).to.be.above(parseEther("1000"));
      
    } catch (error) {
      console.log("TransferFrom error:", error.message);
      if (error.message.includes("ERC20InsufficientBalance")) {
        console.log("Found ERC20InsufficientBalance error, details:");
        const matches = error.message.match(/ERC20InsufficientBalance\("([^"]+)", ([^,]+), ([^)]+)\)/);
        if (matches) {
          console.log("Account:", matches[1]);
          console.log("Current balance:", matches[2]);
          console.log("Required balance:", matches[3]);
        }
      }
    }
  });
});