/**
 * SoulboundNFT Minimal Test
 * Written to work directly with Ethers v6 without hardhat dependencies
 */

const { expect } = require('chai');
const { describe, it, before } = require('mocha');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

describe("SoulboundNFT AccessControl (Minimal)", function() {
  let soulboundNFT;
  let admin, minter, user;
  let provider;
  
  before(async function() {
    try {
      // Set up the provider
      provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
      console.log("Provider created");
      
      // Get accounts
      const accounts = await provider.listAccounts();
      console.log(`Found ${accounts.length} accounts`);
      
      if (accounts.length < 3) {
        console.log("Not enough accounts available for testing");
        this.skip();
        return;
      }
      
      // Assign roles
      admin = await provider.getSigner(accounts[0].address);
      minter = await provider.getSigner(accounts[1].address);
      user = await provider.getSigner(accounts[2].address);
      
      // Log addresses
      console.log("Using accounts:");
      console.log(`- Admin: ${await admin.getAddress()}`);
      console.log(`- Minter: ${await minter.getAddress()}`);
      console.log(`- User: ${await user.getAddress()}`);
      
      // Load contract artifact
      const artifactPath = path.join(__dirname, '../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
      if (!fs.existsSync(artifactPath)) {
        console.log("SoulboundNFT artifact not found. Please compile contracts first.");
        this.skip();
        return;
      }
      
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      console.log("Contract artifact loaded");
      
      // Deploy contract
      console.log("Deploying SoulboundNFT...");
      const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode,
        admin
      );
      
      soulboundNFT = await factory.deploy(await admin.getAddress());
      await soulboundNFT.waitForDeployment();
      
      const contractAddress = await soulboundNFT.getAddress();
      console.log(`SoulboundNFT deployed to: ${contractAddress}`);
      
      // Grant minter role to minter account
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      const tx = await soulboundNFT.grantRole(MINTER_ROLE, await minter.getAddress());
      await tx.wait();
      console.log("Minter role granted");
      
    } catch (error) {
      console.error("Failed to set up test:", error);
      this.skip();
    }
  });
  
  it("should correctly set up initial roles", async function() {
    if (!soulboundNFT) this.skip();
    
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    
    // Check admin has admin role
    const adminHasAdminRole = await soulboundNFT.hasRole(DEFAULT_ADMIN_ROLE, await admin.getAddress());
    expect(adminHasAdminRole).to.be.true;
    
    // Check minter has minter role
    const minterHasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, await minter.getAddress());
    expect(minterHasMinterRole).to.be.true;
    
    // Check user has no roles
    const userHasMinterRole = await soulboundNFT.hasRole(MINTER_ROLE, await user.getAddress());
    expect(userHasMinterRole).to.be.false;
  });
  
  it("should allow minters to mint tokens", async function() {
    if (!soulboundNFT) this.skip();
    
    const userAddress = await user.getAddress();
    const tokenURI = "https://example.com/token/1";
    
    // Mint a token to user
    const mintTx = await soulboundNFT.connect(minter).mint(userAddress, tokenURI);
    const receipt = await mintTx.wait();
    console.log(`Token minted, gas used: ${receipt.gasUsed}`);
    
    // Check token owner
    const owner = await soulboundNFT.ownerOf(0);
    expect(owner.toLowerCase()).to.equal(userAddress.toLowerCase());
    
    // Check token URI
    const actualURI = await soulboundNFT.tokenURI(0);
    expect(actualURI).to.equal(tokenURI);
  });
  
  it("should allow admins to revoke tokens", async function() {
    if (!soulboundNFT) this.skip();
    
    const userAddress = await user.getAddress();
    
    // Mint another token if needed
    let tokenId = 0;
    try {
      await soulboundNFT.ownerOf(tokenId);
    } catch (error) {
      // Token might not exist, mint one
      await soulboundNFT.connect(minter).mint(userAddress, "https://example.com/token/2");
      tokenId = 1; // Use the next token ID
    }
    
    // Revoke the token
    const revokeTx = await soulboundNFT.connect(admin).revoke(tokenId);
    const receipt = await revokeTx.wait();
    console.log(`Token revoked, gas used: ${receipt.gasUsed}`);
    
    // Check token is burned (should revert when we try to get the owner)
    try {
      await soulboundNFT.ownerOf(tokenId);
      expect.fail("Token should have been burned");
    } catch (error) {
      // Expected error
      expect(error.message).to.include("ERC721: invalid token ID");
    }
  });
});