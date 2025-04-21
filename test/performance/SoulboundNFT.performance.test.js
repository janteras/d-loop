/**
 * SoulboundNFT Gas Profile Test
 * A simple, direct test to measure gas costs of SoulboundNFT operations
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Starting SoulboundNFT Gas Profiling Test");
  
  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545/');
    console.log("Provider created");
    
    // Get accounts
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      console.log("No accounts found. Make sure the Hardhat node is running.");
      return;
    }
    console.log(`Found ${accounts.length} accounts`);
    
    // Define roles
    const admin = accounts[0];
    const minter = accounts[1];
    const user1 = accounts[2];
    const user2 = accounts[3];
    
    console.log("Using accounts:");
    console.log(`- Admin: ${admin.address}`);
    console.log(`- Minter: ${minter.address}`);
    console.log(`- User1: ${user1.address}`);
    console.log(`- User2: ${user2.address}`);
    
    // Create signers
    const adminSigner = await provider.getSigner(admin.address);
    const minterSigner = await provider.getSigner(minter.address);
    
    // Load contract artifact
    const artifactPath = path.join(__dirname, '../../artifacts/contracts/identity/SoulboundNFT.sol/SoulboundNFT.json');
    if (!fs.existsSync(artifactPath)) {
      console.log("SoulboundNFT artifact not found. Please compile contracts first.");
      return;
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    console.log("Contract artifact loaded");
    
    // Deploy SoulboundNFT contract
    console.log("Deploying SoulboundNFT...");
    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.bytecode,
      adminSigner
    );
    
    const soulboundNFT = await factory.deploy(admin.address);
    await soulboundNFT.waitForDeployment();
    const soulboundNFTAddress = await soulboundNFT.getAddress();
    console.log(`SoulboundNFT deployed to: ${soulboundNFTAddress}`);
    
    // Grant minter role to minter account
    console.log("Granting MINTER_ROLE to minter...");
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const grantTx = await soulboundNFT.grantRole(MINTER_ROLE, minter.address);
    const grantReceipt = await grantTx.wait();
    console.log(`Gas used for granting minter role: ${grantReceipt.gasUsed}`);
    
    // 1. Measure gas for minting (use token ID 0)
    console.log("Measuring gas for minting...");
    const mintTx = await soulboundNFT.connect(minterSigner).mint(user1.address, "https://example.com/token/1");
    const mintReceipt = await mintTx.wait();
    console.log(`Gas used for minting: ${mintReceipt.gasUsed}`);
    
    // 2. Measure gas for revoking a token (use the token we just minted)
    try {
      console.log("Measuring gas for revoking token...");
      // First check the token exists and get its ID
      const tokenCount = await soulboundNFT.totalSupply();
      console.log(`Current token count: ${tokenCount}`);
      
      // Get the token ID that was just minted
      let tokenId;
      if (tokenCount > 0) {
        // The token ID is likely 0 if this is the first mint
        tokenId = 0;
        console.log(`Using token ID: ${tokenId}`);
      } else {
        console.log("No tokens found to revoke");
        return;
      }
      
      // Now revoke the token
      const revokeTx = await soulboundNFT.connect(adminSigner).revoke(tokenId);
      const revokeReceipt = await revokeTx.wait();
      console.log(`Gas used for revoking: ${revokeReceipt.gasUsed}`);
    } catch (error) {
      console.error("Error revoking token:", error.message);
      
      // Continue with other gas measurements despite the error
    }
    
    // 3. Mint another token for additional tests
    await soulboundNFT.connect(minterSigner).mint(user2.address, "https://example.com/token/2");
    
    // 4. Measure gas for checking token validity
    console.log("Measuring gas for checking isValidToken...");
    const isValidEstimate = await soulboundNFT.isValidToken.estimateGas(1);
    console.log(`Gas used for isValidToken: ${isValidEstimate}`);
    
    // 5. Measure gas for checking hasRole
    console.log("Measuring gas for checking hasRole...");
    const hasRoleEstimate = await soulboundNFT.hasRole.estimateGas(MINTER_ROLE, minter.address);
    console.log(`Gas used for hasRole: ${hasRoleEstimate}`);
    
    // 6. Measure gas for revoking a role
    console.log("Measuring gas for revoking role...");
    const revokeRoleTx = await soulboundNFT.revokeRole(MINTER_ROLE, minter.address);
    const revokeRoleReceipt = await revokeRoleTx.wait();
    console.log(`Gas used for revoking role: ${revokeRoleReceipt.gasUsed}`);
    
    // 7. Measure gas for transferring ownership (granting admin role)
    console.log("Measuring gas for transferring ownership...");
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const transferTx = await soulboundNFT.grantRole(DEFAULT_ADMIN_ROLE, user1.address);
    const transferReceipt = await transferTx.wait();
    console.log(`Gas used for transferring ownership: ${transferReceipt.gasUsed}`);
    
    // Gas summary
    console.log("\n--- GAS USAGE SUMMARY ---");
    console.log(`Minting: ${mintReceipt.gasUsed}`);
    console.log(`Revoking token: ${revokeReceipt.gasUsed}`);
    console.log(`Granting minter role: ${grantReceipt.gasUsed}`);
    console.log(`Revoking minter role: ${revokeRoleReceipt.gasUsed}`);
    console.log(`Transferring ownership: ${transferReceipt.gasUsed}`);
    console.log(`isValidToken (estimate): ${isValidEstimate}`);
    console.log(`hasRole (estimate): ${hasRoleEstimate}`);
    
    console.log("\nGas profiling completed successfully");
  } catch (error) {
    console.error("Gas profiling failed:", error);
  }
}

// Execute the main function
main();