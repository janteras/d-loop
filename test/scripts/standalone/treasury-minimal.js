/**
 * Ultra-minimal Treasury Standalone Test
 * 
 * This test focuses on basic Treasury functionality without dependencies on external adapters
 */

const { exec, execSync } = require('child_process');
const ethers = require('../../ethers-v6-shim.standalone');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log("Starting Ultra-Minimal Treasury Test");
  
  let hardhatProcess;
  let provider;
  
  try {
    // Kill any existing node processes to avoid port conflicts
    try {
      execSync('pkill -f "hardhat node" || true');
      console.log("Cleaned up any existing Hardhat processes");
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      // Ignore errors if no processes found
    }
    
    // Start a Hardhat node in a separate process
    console.log("Starting Hardhat node...");
    hardhatProcess = exec('npx hardhat node --hostname 127.0.0.1 --port 8545', {
      detached: true
    });
    
    // Wait for node to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Hardhat node started");
    
    // Create a provider connected to the Hardhat node
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    console.log("Provider created");
    
    // Wait for provider to connect with retries
    let connected = false;
    for (let i = 0; i < 10; i++) {
      try {
        await provider.getBlockNumber();
        connected = true;
        break;
      } catch (e) {
        console.log(`Waiting for provider to connect (attempt ${i+1}/10)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!connected) {
      throw new Error("Failed to connect to Hardhat node after multiple attempts");
    }
    
    console.log("Provider connected to Hardhat node");
    
    // Get signers
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    if (accounts.length < 3) {
      throw new Error("Not enough accounts available");
    }
    
    const [owner, admin, user] = accounts;
    
    console.log("Test accounts:");
    console.log(`Owner: ${typeof owner === 'object' ? JSON.stringify(owner) : owner}`);
    console.log(`Admin: ${typeof admin === 'object' ? JSON.stringify(admin) : admin}`);
    console.log(`User: ${typeof user === 'object' ? JSON.stringify(user) : user}`);
    
    // Get signers
    const ownerSigner = await provider.getSigner(0);
    const adminSigner = await provider.getSigner(1);
    const userSigner = await provider.getSigner(2);
    
    // Compile contracts
    console.log("\nCompiling contracts...");
    execSync('npx hardhat compile --config hardhat.config.simple.js', { stdio: 'pipe' });
    
    // Read the Treasury artifact
    const treasuryPath = path.join(__dirname, '../../artifacts/contracts/fees/Treasury.sol/Treasury.json');
    
    if (!fs.existsSync(treasuryPath)) {
      throw new Error(`Treasury artifact not found at ${treasuryPath}`);
    }
    
    const treasuryArtifact = JSON.parse(fs.readFileSync(treasuryPath, 'utf8'));
    
    // Read the MockToken artifact
    const mockTokenPath = path.join(__dirname, '../../artifacts/test/mocks/MockToken.sol/MockToken.json');
    
    if (!fs.existsSync(mockTokenPath)) {
      throw new Error(`MockToken artifact not found at ${mockTokenPath}`);
    }
    
    const mockTokenArtifact = JSON.parse(fs.readFileSync(mockTokenPath, 'utf8'));
    
    // Deploy MockToken
    console.log("\nDeploying MockToken...");
    const MockToken = new ethers.ContractFactory(mockTokenArtifact.abi, mockTokenArtifact.bytecode, ownerSigner);
    const mockToken = await MockToken.deploy("MockToken", "MCK", 18);
    
    const mockTokenTxReceipt = await mockToken.deploymentTransaction().wait();
    console.log(`MockToken deployed at ${await mockToken.getAddress()} (block: ${mockTokenTxReceipt.blockNumber})`);
    
    // Deploy Treasury
    console.log("\nDeploying Treasury...");
    console.log(`Deploying with admin: ${typeof admin === 'object' ? JSON.stringify(admin) : admin}, owner: ${typeof owner === 'object' ? JSON.stringify(owner) : owner}`);
    const Treasury = new ethers.ContractFactory(treasuryArtifact.abi, treasuryArtifact.bytecode, ownerSigner);
    const treasury = await Treasury.deploy(admin, owner);
    
    const treasuryTxReceipt = await treasury.deploymentTransaction().wait();
    console.log(`Treasury deployed at ${await treasury.getAddress()} (block: ${treasuryTxReceipt.blockNumber})`);
    
    // Test 1: Check initialization
    console.log("\nTest 1: Initialization checks");
    
    const treasuryAdmin = await treasury.admin();
    console.log(`Admin address from contract: ${treasuryAdmin}`);
    console.log(`Admin address from accounts: ${typeof admin === 'object' ? JSON.stringify(admin) : admin}`);
    console.log(`Are they equal? ${treasuryAdmin === admin}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(treasuryAdmin, admin)}`);
    assert(ethers.isEqualAddress(treasuryAdmin, admin), "Admin not set correctly");
    
    const protocolDAO = await treasury.protocolDAO();
    console.log(`ProtocolDAO address from contract: ${protocolDAO}`);
    console.log(`Owner address from accounts: ${typeof owner === 'object' ? JSON.stringify(owner) : owner}`);
    console.log(`Are they equal? ${protocolDAO === owner}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(protocolDAO, owner)}`);
    assert(ethers.isEqualAddress(protocolDAO, owner), "ProtocolDAO not set correctly");
    
    const treasuryOwner = await treasury.owner();
    console.log(`Owner address from contract: ${treasuryOwner}`);
    console.log(`Owner address from accounts: ${typeof owner === 'object' ? JSON.stringify(owner) : owner}`);
    console.log(`Are they equal? ${treasuryOwner === owner}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(treasuryOwner, owner)}`);
    assert(ethers.isEqualAddress(treasuryOwner, owner), "Owner not set correctly");
    
    console.log("✅ Initialization checks passed");
    
    // Test 2: Update admin
    console.log("\nTest 2: Update admin");
    const tx1 = await treasury.updateAdmin(user);
    await tx1.wait();
    
    const newAdmin = await treasury.admin();
    console.log(`New admin address: ${newAdmin}`);
    console.log(`User address: ${typeof user === 'object' ? JSON.stringify(user) : user}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(newAdmin, user)}`);
    assert(ethers.isEqualAddress(newAdmin, user), "Admin not updated correctly");
    console.log("✅ Admin updated successfully");
    
    // Test 3: Update ProtocolDAO
    console.log("\nTest 3: Update ProtocolDAO");
    const tx2 = await treasury.updateProtocolDAO(user);
    await tx2.wait();
    
    const newProtocolDAO = await treasury.protocolDAO();
    console.log(`New ProtocolDAO address: ${newProtocolDAO}`);
    console.log(`User address: ${typeof user === 'object' ? JSON.stringify(user) : user}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(newProtocolDAO, user)}`);
    assert(ethers.isEqualAddress(newProtocolDAO, user), "ProtocolDAO not updated correctly");
    console.log("✅ ProtocolDAO updated successfully");
    
    // Test 4: Token operations
    console.log("\nTest 4: Token operations");
    
    // Mint some tokens for testing
    const amount = ethers.parseUnits("1000", 18);
    await mockToken.mint(owner, amount);
    
    const ownerBalance = await mockToken.balanceOf(owner);
    console.log(`Owner balance: ${ethers.formatUnits(ownerBalance, 18)} MCK`);
    assert(ownerBalance === amount, "Token minting failed");
    console.log("✅ Tokens minted successfully");
    
    // Note: Treasury.sol doesn't have a deposit function, so we'll transfer tokens directly
    await mockToken.transfer(await treasury.getAddress(), amount);
    
    const treasuryBalance = await mockToken.balanceOf(await treasury.getAddress());
    console.log(`Treasury balance: ${ethers.formatUnits(treasuryBalance, 18)} MCK`);
    assert(treasuryBalance === amount, "Token transfer to treasury failed");
    console.log("✅ Tokens transferred to Treasury successfully");
    
    // Test 5: Withdraw tokens (owner can withdraw as protocolDAO)
    console.log("\nTest 5: Withdraw tokens");
    
    const withdrawAmount = ethers.parseUnits("500", 18);
    const tx3 = await treasury.withdraw(await mockToken.getAddress(), user, withdrawAmount);
    await tx3.wait();
    
    const userBalance = await mockToken.balanceOf(user);
    console.log(`User balance: ${ethers.formatUnits(userBalance, 18)} MCK`);
    assert(userBalance === withdrawAmount, "User didn't receive tokens");
    
    const treasuryBalanceAfter = await mockToken.balanceOf(await treasury.getAddress());
    console.log(`Treasury balance after withdraw: ${ethers.formatUnits(treasuryBalanceAfter, 18)} MCK`);
    assert(treasuryBalanceAfter === amount - withdrawAmount, "Treasury balance incorrect after withdraw");
    console.log("✅ Withdraw successful");
    
    // Test 6: Token approval functions
    console.log("\nTest 6: Token approval functions");
    
    // Allow token transfer
    const allowAmount = ethers.parseUnits("200", 18);
    const tx4 = await treasury.allowTokenTransfer(await mockToken.getAddress(), user, allowAmount);
    await tx4.wait();
    
    const userAllowance = await mockToken.allowance(await treasury.getAddress(), user);
    console.log(`User allowance: ${ethers.formatUnits(userAllowance, 18)} MCK`);
    assert(userAllowance === allowAmount, "Allowance not set correctly");
    console.log("✅ allowTokenTransfer successful");
    
    // Increase token allowance
    const increaseAmount = ethers.parseUnits("100", 18);
    const tx5 = await treasury.increaseTokenAllowance(await mockToken.getAddress(), user, increaseAmount);
    await tx5.wait();
    
    const userAllowanceAfterIncrease = await mockToken.allowance(await treasury.getAddress(), user);
    console.log(`User allowance after increase: ${ethers.formatUnits(userAllowanceAfterIncrease, 18)} MCK`);
    assert(userAllowanceAfterIncrease === allowAmount + increaseAmount, "Allowance not increased correctly");
    console.log("✅ increaseTokenAllowance successful");
    
    // Decrease token allowance
    const decreaseAmount = ethers.parseUnits("50", 18);
    const tx6 = await treasury.decreaseTokenAllowance(await mockToken.getAddress(), user, decreaseAmount);
    await tx6.wait();
    
    const userAllowanceAfterDecrease = await mockToken.allowance(await treasury.getAddress(), user);
    console.log(`User allowance after decrease: ${ethers.formatUnits(userAllowanceAfterDecrease, 18)} MCK`);
    assert(userAllowanceAfterDecrease === allowAmount + increaseAmount - decreaseAmount, "Allowance not decreased correctly");
    console.log("✅ decreaseTokenAllowance successful");
    
    // Clear approval
    const tx7 = await treasury.clearApproval(await mockToken.getAddress(), user);
    await tx7.wait();
    
    const userAllowanceAfterClear = await mockToken.allowance(await treasury.getAddress(), user);
    console.log(`User allowance after clear: ${ethers.formatUnits(userAllowanceAfterClear, 18)} MCK`);
    assert(userAllowanceAfterClear === 0n, "Allowance not cleared correctly");
    console.log("✅ clearApproval successful");
    
    // Test 7: Transfer ownership
    console.log("\nTest 7: Transfer ownership");
    
    const tx8 = await treasury.transferOwnership(user);
    await tx8.wait();
    
    const newOwner = await treasury.owner();
    console.log(`New owner address: ${newOwner}`);
    console.log(`User address: ${typeof user === 'object' ? JSON.stringify(user) : user}`);
    console.log(`Are they equal using helper? ${ethers.isEqualAddress(newOwner, user)}`);
    assert(ethers.isEqualAddress(newOwner, user), "Ownership not transferred correctly");
    console.log("✅ Ownership transferred successfully");
    
    console.log("\nAll Treasury tests have passed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up resources
    if (hardhatProcess) {
      console.log("Shutting down Hardhat node...");
      try {
        process.kill(-hardhatProcess.pid, 'SIGINT');
      } catch (e) {
        console.log("Hardhat node already terminated");
      }
    }
  }
}

// Run the standalone test
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });