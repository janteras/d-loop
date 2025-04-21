// Standalone Minimal Test for Treasury
// This is a completely self-contained test that doesn't rely on any external adapters

const { execSync } = require('child_process');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log("Starting Standalone Treasury Test");
  
  let hardhatProcess;
  let provider;
  
  try {
    // Kill any existing node processes
    try {
      execSync('pkill -f "hardhat node" || true');
      console.log("Cleaned up any existing Hardhat processes");
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      // Ignore errors if no processes found
    }
    
    // Start a Hardhat node in a separate process
    console.log("Starting Hardhat node...");
    hardhatProcess = require('child_process').spawn('npx', ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', '8545'], {
      detached: true,
      stdio: 'pipe'
    });
    
    // Wait for node to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Hardhat node should be running now");
    
    // Create a provider connected to the Hardhat node
    provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    console.log("Provider created");
    
    // Wait for provider to connect
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
    
    // Get the test accounts
    const accounts = await provider.listAccounts();
    if (accounts.length < 3) {
      throw new Error("Not enough accounts available from Hardhat node");
    }
    
    const [owner, admin, user] = accounts;
    
    console.log("Test accounts:");
    console.log(`Owner: ${owner.address}`);
    console.log(`Admin: ${admin.address}`);
    console.log(`User: ${user.address}`);
    
    // Get signers for the accounts
    const signer1 = await provider.getSigner(0);
    const signer2 = await provider.getSigner(1);
    const signer3 = await provider.getSigner(2);
    
    console.log("\nCompiling contracts...");
    execSync('npx hardhat compile --config hardhat.config.simple.js', { stdio: 'inherit' });
    
    // Read the MockToken and Treasury artifacts
    const mockTokenArtifactPath = path.join(__dirname, '../artifacts/test/mocks/MockToken.sol/MockToken.json');
    const treasuryArtifactPath = path.join(__dirname, '../artifacts/contracts/fees/Treasury.sol/Treasury.json');
    
    if (!fs.existsSync(mockTokenArtifactPath)) {
      throw new Error(`MockToken artifact not found at ${mockTokenArtifactPath}`);
    }
    
    if (!fs.existsSync(treasuryArtifactPath)) {
      throw new Error(`Treasury artifact not found at ${treasuryArtifactPath}`);
    }
    
    const mockTokenArtifact = JSON.parse(fs.readFileSync(mockTokenArtifactPath, 'utf8'));
    const treasuryArtifact = JSON.parse(fs.readFileSync(treasuryArtifactPath, 'utf8'));
    
    // Deploy MockToken
    console.log("\nDeploying MockToken...");
    const MockToken = new ethers.ContractFactory(mockTokenArtifact.abi, mockTokenArtifact.bytecode, signer1);
    // MockToken constructor takes name, symbol, and decimals
    const mockToken = await MockToken.deploy("MockToken", "MCK", 18);
    await mockToken.waitForDeployment();
    
    console.log(`MockToken deployed at ${await mockToken.getAddress()}`);
    
    // Deploy Treasury
    console.log("\nDeploying Treasury...");
    const Treasury = new ethers.ContractFactory(treasuryArtifact.abi, treasuryArtifact.bytecode, signer1);
    const treasury = await Treasury.deploy(admin.address, owner.address);
    await treasury.waitForDeployment();
    
    console.log(`Treasury deployed at ${await treasury.getAddress()}`);
    
    // Test 1: Check initialization
    console.log("\nTest 1: Initialization");
    const treasuryAdmin = await treasury.admin();
    assert(treasuryAdmin === admin.address, "Admin not set correctly");
    console.log("✅ Admin set correctly");
    
    const protocolDAO = await treasury.protocolDAO();
    assert(protocolDAO === owner.address, "ProtocolDAO not set correctly");
    console.log("✅ ProtocolDAO set correctly");
    
    // Test 2: Update admin
    console.log("\nTest 2: Update admin");
    const treasuryAsOwner = treasury.connect(signer1);
    const tx1 = await treasuryAsOwner.updateAdmin(user.address);
    await tx1.wait();
    
    const newAdmin = await treasury.admin();
    assert(newAdmin === user.address, "Admin not updated correctly");
    console.log("✅ Admin updated successfully");
    
    // Test 3: Update ProtocolDAO
    console.log("\nTest 3: Update ProtocolDAO");
    const tx2 = await treasuryAsOwner.updateProtocolDAO(user.address);
    await tx2.wait();
    
    const newProtocolDAO = await treasury.protocolDAO();
    assert(newProtocolDAO === user.address, "ProtocolDAO not updated correctly");
    console.log("✅ ProtocolDAO updated successfully");
    
    // Test 4: Deposit and withdraw tokens
    console.log("\nTest 4: Token operations");
    
    // Mint some tokens for the owner
    const amount = ethers.parseUnits("1000", 18);
    await mockToken.mint(owner.address, amount);
    
    const ownerBalance = await mockToken.balanceOf(owner.address);
    assert(ownerBalance === amount, "Token minting failed");
    console.log("✅ Tokens minted successfully");
    
    // Approve and deposit tokens to Treasury
    await mockToken.approve(await treasury.getAddress(), amount);
    const tx3 = await treasury.deposit(await mockToken.getAddress(), amount);
    await tx3.wait();
    
    const treasuryBalance = await mockToken.balanceOf(await treasury.getAddress());
    assert(treasuryBalance === amount, "Deposit failed");
    console.log("✅ Tokens deposited to Treasury successfully");
    
    // Withdraw tokens from Treasury
    const withdrawAmount = ethers.parseUnits("500", 18);
    const tx4 = await treasuryAsOwner.withdraw(await mockToken.getAddress(), user.address, withdrawAmount);
    await tx4.wait();
    
    const treasuryBalanceAfterWithdraw = await mockToken.balanceOf(await treasury.getAddress());
    assert(treasuryBalanceAfterWithdraw === amount - withdrawAmount, "Withdraw failed");
    
    const userBalance = await mockToken.balanceOf(user.address);
    assert(userBalance === withdrawAmount, "User didn't receive tokens");
    console.log("✅ Tokens withdrawn from Treasury successfully");
    
    // Test 5: Token Approval Management
    console.log("\nTest 5: Token Approval Management");
    
    // Test increase token allowance
    const allowanceAmount = ethers.parseUnits("100", 18);
    const tx5 = await treasuryAsOwner.increaseTokenAllowance(
      await mockToken.getAddress(), 
      user.address, 
      allowanceAmount
    );
    await tx5.wait();
    
    const allowance = await mockToken.allowance(await treasury.getAddress(), user.address);
    assert(allowance === allowanceAmount, "Allowance setting failed");
    console.log("✅ Token allowance increased successfully");
    
    // Test decrease token allowance
    const decreaseAmount = ethers.parseUnits("50", 18);
    const tx6 = await treasuryAsOwner.decreaseTokenAllowance(
      await mockToken.getAddress(), 
      user.address, 
      decreaseAmount
    );
    await tx6.wait();
    
    const allowanceAfterDecrease = await mockToken.allowance(await treasury.getAddress(), user.address);
    assert(allowanceAfterDecrease === allowanceAmount - decreaseAmount, "Allowance decrease failed");
    console.log("✅ Token allowance decreased successfully");
    
    // Test clear approval
    const tx7 = await treasuryAsOwner.clearApproval(
      await mockToken.getAddress(), 
      user.address
    );
    await tx7.wait();
    
    const allowanceAfterClear = await mockToken.allowance(await treasury.getAddress(), user.address);
    assert(allowanceAfterClear === 0n, "Allowance clearing failed");
    console.log("✅ Token allowance cleared successfully");
    
    console.log("\nAll Treasury tests have passed!");
    
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    // Clean up: Kill the Hardhat node process
    if (hardhatProcess) {
      console.log("Cleaning up Hardhat process...");
      process.kill(-hardhatProcess.pid, 'SIGINT');
    }
  }
}

// Run the standalone test
main().catch(error => {
  console.error(error);
  process.exit(1);
});