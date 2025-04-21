const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SoulboundNFT", function () {
  let owner, admin, minter, user1, user2;
  let soulboundNFT;
  
  beforeEach(async function () {
    [owner, admin, minter, user1, user2] = await ethers.getSigners();
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await ethers.getContractFactory("SoulboundNFT");
    soulboundNFT = await SoulboundNFT.deploy(admin.address);
    await soulboundNFT.deployed();
    
    // Grant minter role
    await soulboundNFT.connect(admin).grantMinterRole(minter.address);
  });
  
  describe("Basic Functionality", function () {
    it("should initialize with correct name and symbol", async function () {
      expect(await soulboundNFT.name()).to.equal("AI Node Identifier");
      expect(await soulboundNFT.symbol()).to.equal("AINODE");
    });
    
    it("should assign admin role correctly", async function () {
      expect(await soulboundNFT.hasRole(await soulboundNFT.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await soulboundNFT.hasRole(await soulboundNFT.MINTER_ROLE(), admin.address)).to.be.true;
      expect(await soulboundNFT.hasRole(await soulboundNFT.MINTER_ROLE(), minter.address)).to.be.true;
    });
  });
  
  describe("Minting", function () {
    it("should allow minter to mint a token", async function () {
      const metadata = "ipfs://QmTest";
      await soulboundNFT.connect(minter).mintSoulboundToken(user1.address, metadata);
      
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(1);
      
      const tokenId = await soulboundNFT.getTokenIdByOwner(user1.address);
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(user1.address);
      expect(await soulboundNFT.tokenURI(tokenId)).to.equal(metadata);
      expect(await soulboundNFT.getNodeMetadata(tokenId)).to.equal(metadata);
    });
    
    it("should prevent minting multiple tokens to the same address", async function () {
      await soulboundNFT.connect(minter).mintSoulboundToken(user1.address, "ipfs://QmTest1");
      
      await expect(
        soulboundNFT.connect(minter).mintSoulboundToken(user1.address, "ipfs://QmTest2")
      ).to.be.revertedWith("Address already has a token");
    });
    
    it("should prevent non-minters from minting", async function () {
      await expect(
        soulboundNFT.connect(user1).mintSoulboundToken(user2.address, "ipfs://QmTest")
      ).to.be.reverted;
    });
  });
  
  describe("Transfer Restriction", function () {
    beforeEach(async function () {
      // Mint a token for testing
      await soulboundNFT.connect(minter).mintSoulboundToken(user1.address, "ipfs://QmTest");
      this.tokenId = await soulboundNFT.getTokenIdByOwner(user1.address);
    });
    
    it("should prevent transferring tokens", async function () {
      await expect(
        soulboundNFT.connect(user1).transferFrom(user1.address, user2.address, this.tokenId)
      ).to.be.revertedWith("Soulbound tokens cannot be transferred");
      
      await expect(
        soulboundNFT.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, this.tokenId)
      ).to.be.revertedWith("Soulbound tokens cannot be transferred");
    });
    
    it("should allow burning tokens", async function () {
      await soulboundNFT.connect(minter).burnSoulboundToken(this.tokenId);
      
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(0);
      await expect(soulboundNFT.ownerOf(this.tokenId)).to.be.reverted;
    });
    
    it("should allow token owner to burn their token", async function () {
      await soulboundNFT.connect(user1).burnSoulboundToken(this.tokenId);
      
      expect(await soulboundNFT.balanceOf(user1.address)).to.equal(0);
    });
    
    it("should prevent non-owners from burning tokens", async function () {
      await expect(
        soulboundNFT.connect(user2).burnSoulboundToken(this.tokenId)
      ).to.be.revertedWith("Not approved or owner");
    });
  });
  
  describe("Query Functions", function () {
    beforeEach(async function () {
      // Mint tokens for testing
      await soulboundNFT.connect(minter).mintSoulboundToken(user1.address, "ipfs://QmTest1");
      await soulboundNFT.connect(minter).mintSoulboundToken(user2.address, "ipfs://QmTest2");
    });
    
    it("should check if an address has a soulbound token", async function () {
      expect(await soulboundNFT.hasSoulboundToken(user1.address)).to.be.true;
      expect(await soulboundNFT.hasSoulboundToken(owner.address)).to.be.false;
    });
    
    it("should get token ID by owner", async function () {
      const tokenId = await soulboundNFT.getTokenIdByOwner(user1.address);
      expect(await soulboundNFT.ownerOf(tokenId)).to.equal(user1.address);
      
      await expect(
        soulboundNFT.getTokenIdByOwner(owner.address)
      ).to.be.revertedWith("Address doesn't have a token");
    });
    
    it("should get metadata for a token", async function () {
      const tokenId = await soulboundNFT.getTokenIdByOwner(user1.address);
      expect(await soulboundNFT.getNodeMetadata(tokenId)).to.equal("ipfs://QmTest1");
      
      // Burn the token and check that metadata is removed
      await soulboundNFT.connect(user1).burnSoulboundToken(tokenId);
      await expect(
        soulboundNFT.getNodeMetadata(tokenId)
      ).to.be.revertedWith("Token doesn't exist");
    });
  });
});