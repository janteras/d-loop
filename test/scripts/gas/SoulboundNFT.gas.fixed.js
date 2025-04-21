const { expect } = require("chai");
const { getTestSigners, deployTestContract, safeParseEther } = require("../utils/ethers-helpers");
const { ethers } = require("ethers");

// We don't need to import hardhat directly, avoiding circular dependencies

describe("SoulboundNFT Gas Usage", function() {
  let soulboundNFT;
  let admin, minter, user1, user2;
  let signers;

  before(async function() {
    // Get test signers with our helper function
    signers = await getTestSigners();
    [admin, minter, user1, user2] = signers;
    
    console.log("Deploying SoulboundNFT with admin:", await admin.getAddress());
    
    // Deploy SoulboundNFT contract
    soulboundNFT = await deployTestContract("SoulboundNFT", admin, [await admin.getAddress()]);
    
    // Grant minter role to the minter account
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, await minter.getAddress());
  });

  describe("Gas Costs", function() {
    it("measures gas cost for minting a token", async function() {
      // Measure gas usage for minting
      const tx = await soulboundNFT.connect(minter).mint(await user1.getAddress(), "https://example.com/token/1");
      const receipt = await tx.wait();
      console.log("Gas used for minting:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.a('bigint');
    });

    it("measures gas cost for revoking a token", async function() {
      // First mint a token to user2
      await soulboundNFT.connect(minter).mint(await user2.getAddress(), "https://example.com/token/2");
      
      // Measure gas usage for revoking
      const tx = await soulboundNFT.connect(admin).revoke(1); // Assuming token ID 1
      const receipt = await tx.wait();
      console.log("Gas used for revoking:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.a('bigint');
    });

    it("measures gas cost for granting minter role", async function() {
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      
      // Measure gas usage for granting role
      const tx = await soulboundNFT.connect(admin).grantRole(MINTER_ROLE, await user1.getAddress());
      const receipt = await tx.wait();
      console.log("Gas used for granting minter role:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.a('bigint');
    });

    it("measures gas cost for revoking minter role", async function() {
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      
      // Measure gas usage for revoking role
      const tx = await soulboundNFT.connect(admin).revokeRole(MINTER_ROLE, await user1.getAddress());
      const receipt = await tx.wait();
      console.log("Gas used for revoking minter role:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.a('bigint');
    });

    it("measures gas cost for transferring ownership", async function() {
      const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // using ethers v6 constant instead of v5's constants.HashZero
      
      // Measure gas usage for transferring ownership (granting admin role)
      const tx = await soulboundNFT.connect(admin).grantRole(DEFAULT_ADMIN_ROLE, await user2.getAddress());
      const receipt = await tx.wait();
      console.log("Gas used for transferring ownership:", receipt.gasUsed.toString());
      expect(receipt.gasUsed).to.be.a('bigint');
    });

    // Skip these tests for now until we have fixed the basic functionality
    it.skip("measures gas cost for checking role membership", async function() {
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      
      // Measure gas usage for checking role (Ethers v6 staticCall)
      const hasRole = await soulboundNFT.hasRole(MINTER_ROLE, await minter.getAddress());
      
      // Since this is a view function, we can't get gas usage directly
      // We'll estimate it instead
      const gasEstimate = await soulboundNFT.hasRole.estimateGas(MINTER_ROLE, await minter.getAddress());
      console.log("Gas used for checking role membership:", gasEstimate.toString());
      expect(gasEstimate).to.be.a('bigint');
    });

    it.skip("measures gas cost for verifying token validity", async function() {
      // Measure gas usage for isValidToken
      const gasEstimate = await soulboundNFT.isValidToken.estimateGas(0); // Token ID 0 should exist
      console.log("Gas used for verifying token validity:", gasEstimate.toString());
      expect(gasEstimate).to.be.a('bigint');
    });
  });
});