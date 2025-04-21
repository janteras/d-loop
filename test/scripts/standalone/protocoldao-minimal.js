/**
 * Ultra-minimal ProtocolDAO Standalone Test
 * 
 * This test focuses on basic ProtocolDAO functionality without dependencies on external adapters
 */

const { exec, execSync } = require('child_process');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function main() {
  console.log("Starting Ultra-Minimal ProtocolDAO Test");
  
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
    console.log(`Owner: ${owner}`);
    console.log(`Admin: ${admin}`);
    console.log(`User: ${user}`);
    
    // Get signers
    const ownerSigner = await provider.getSigner(0);
    const adminSigner = await provider.getSigner(1);
    const userSigner = await provider.getSigner(2);
    
    // Compile contracts
    console.log("\nCompiling contracts...");
    execSync('npx hardhat compile --config hardhat.config.simple.js', { stdio: 'pipe' });
    
    // Read the ProtocolDAO artifact
    const protocolDAOPath = path.join(__dirname, '../../artifacts/contracts/core/ProtocolDAO.sol/ProtocolDAO.json');
    
    if (!fs.existsSync(protocolDAOPath)) {
      throw new Error(`ProtocolDAO artifact not found at ${protocolDAOPath}`);
    }
    
    const protocolDAOArtifact = JSON.parse(fs.readFileSync(protocolDAOPath, 'utf8'));
    
    // Deploy ProtocolDAO
    console.log("\nDeploying ProtocolDAO...");
    const ProtocolDAO = new ethers.ContractFactory(protocolDAOArtifact.abi, protocolDAOArtifact.bytecode, ownerSigner);
    
    // Initialize with default values
    const votingPeriod = 86400; // 1 day in seconds
    const executionDelay = 43200; // 12 hours in seconds
    const quorum = 51; // 51% quorum
    
    const protocolDAO = await ProtocolDAO.deploy(admin, owner, votingPeriod, executionDelay, quorum);
    
    const protocolDAOTxReceipt = await protocolDAO.deploymentTransaction().wait();
    console.log(`ProtocolDAO deployed at ${await protocolDAO.getAddress()} (block: ${protocolDAOTxReceipt.blockNumber})`);
    
    // Test 1: Check initialization
    console.log("\nTest 1: Initialization checks");
    
    const daoAdmin = await protocolDAO.admin();
    console.log(`Admin address: ${daoAdmin}`);
    assert(daoAdmin === admin, "Admin not set correctly");
    
    const daoTreasury = await protocolDAO.treasury();
    console.log(`Treasury address: ${daoTreasury}`);
    assert(daoTreasury === owner, "Treasury not set correctly");
    
    const daoOwner = await protocolDAO.owner();
    console.log(`Owner address: ${daoOwner}`);
    assert(daoOwner === owner, "Owner not set correctly");
    
    const initialVotingPeriod = await protocolDAO.votingPeriod();
    console.log(`Voting period: ${initialVotingPeriod} seconds`);
    assert(initialVotingPeriod.toString() === votingPeriod.toString(), "Voting period not set correctly");
    
    const initialExecutionDelay = await protocolDAO.executionDelay();
    console.log(`Execution delay: ${initialExecutionDelay} seconds`);
    assert(initialExecutionDelay.toString() === executionDelay.toString(), "Execution delay not set correctly");
    
    const initialQuorum = await protocolDAO.quorum();
    console.log(`Quorum: ${initialQuorum}%`);
    assert(initialQuorum.toString() === quorum.toString(), "Quorum not set correctly");
    
    console.log("✅ Initialization checks passed");
    
    // Test 2: Update admin
    console.log("\nTest 2: Update admin");
    const tx1 = await protocolDAO.updateAdmin(user);
    await tx1.wait();
    
    const newAdmin = await protocolDAO.admin();
    console.log(`New admin address: ${newAdmin}`);
    assert(newAdmin === user, "Admin not updated correctly");
    console.log("✅ Admin updated successfully");
    
    // Test 3: Update treasury
    console.log("\nTest 3: Update treasury");
    const tx2 = await protocolDAO.updateTreasury(user);
    await tx2.wait();
    
    const newTreasury = await protocolDAO.treasury();
    console.log(`New treasury address: ${newTreasury}`);
    assert(newTreasury === user, "Treasury not updated correctly");
    console.log("✅ Treasury updated successfully");
    
    // Test 4: Update voting parameters
    console.log("\nTest 4: Update voting parameters");
    
    // First, restore admin rights to owner for these operations
    const tx3 = await protocolDAO.updateAdmin(owner);
    await tx3.wait();
    
    // Update voting period
    const newVotingPeriod = 172800; // 2 days in seconds
    const tx4 = await protocolDAO.updateVotingPeriod(newVotingPeriod);
    await tx4.wait();
    
    const updatedVotingPeriod = await protocolDAO.votingPeriod();
    console.log(`Updated voting period: ${updatedVotingPeriod} seconds`);
    assert(updatedVotingPeriod.toString() === newVotingPeriod.toString(), "Voting period not updated correctly");
    
    // Update execution delay
    const newExecutionDelay = 86400; // 1 day in seconds
    const tx5 = await protocolDAO.updateExecutionDelay(newExecutionDelay);
    await tx5.wait();
    
    const updatedExecutionDelay = await protocolDAO.executionDelay();
    console.log(`Updated execution delay: ${updatedExecutionDelay} seconds`);
    assert(updatedExecutionDelay.toString() === newExecutionDelay.toString(), "Execution delay not updated correctly");
    
    // Update quorum
    const newQuorum = 60; // 60% quorum
    const tx6 = await protocolDAO.updateQuorum(newQuorum);
    await tx6.wait();
    
    const updatedQuorum = await protocolDAO.quorum();
    console.log(`Updated quorum: ${updatedQuorum}%`);
    assert(updatedQuorum.toString() === newQuorum.toString(), "Quorum not updated correctly");
    
    console.log("✅ Voting parameters updated successfully");
    
    // Test 5: Token whitelisting
    console.log("\nTest 5: Token whitelisting");
    
    const mockTokenAddress = "0x1234567890123456789012345678901234567890";
    
    // Initially not whitelisted
    const initialWhitelistStatus = await protocolDAO.isTokenWhitelisted(mockTokenAddress);
    console.log(`Initial whitelist status: ${initialWhitelistStatus}`);
    assert(!initialWhitelistStatus, "Token should not be whitelisted initially");
    
    // Whitelist the token
    const tx7 = await protocolDAO.whitelistToken(mockTokenAddress, true);
    await tx7.wait();
    
    const whitelistStatus = await protocolDAO.isTokenWhitelisted(mockTokenAddress);
    console.log(`Whitelist status after adding: ${whitelistStatus}`);
    assert(whitelistStatus, "Token should be whitelisted");
    
    // Blacklist the token
    const tx8 = await protocolDAO.whitelistToken(mockTokenAddress, false);
    await tx8.wait();
    
    const blacklistStatus = await protocolDAO.isTokenWhitelisted(mockTokenAddress);
    console.log(`Whitelist status after removing: ${blacklistStatus}`);
    assert(!blacklistStatus, "Token should be blacklisted");
    
    console.log("✅ Token whitelisting functionality works correctly");
    
    // Test 6: Create proposal
    console.log("\nTest 6: Create proposal");
    
    // Simple proposal to update the quorum to 75%
    const description = "Update quorum to 75%";
    const targets = [await protocolDAO.getAddress()];
    const values = [0];
    
    // Create calldata for updateQuorum(75)
    const iface = new ethers.Interface(protocolDAOArtifact.abi);
    const calldata = iface.encodeFunctionData("updateQuorum", [75]);
    const calldatas = [calldata];
    
    // Create the proposal
    const tx9 = await protocolDAO.createProposal(description, targets, values, calldatas);
    const tx9Receipt = await tx9.wait();
    
    // Check proposal count
    const proposalCount = await protocolDAO.getProposalCount();
    console.log(`Proposal count: ${proposalCount}`);
    assert(proposalCount.toString() === "1", "Proposal count should be 1");
    
    // Get the proposal details
    const proposal = await protocolDAO.proposals(1);
    console.log(`Proposal ID: ${proposal.id}`);
    console.log(`Proposal description: ${proposal.description}`);
    console.log(`Proposal proposer: ${proposal.proposer}`);
    
    assert(proposal.description === description, "Proposal description mismatch");
    assert(proposal.proposer === owner, "Proposal proposer mismatch");
    assert(!proposal.executed, "Proposal should not be executed yet");
    assert(!proposal.canceled, "Proposal should not be canceled");
    
    console.log("✅ Proposal created successfully");
    
    // Test 7: Cast votes
    console.log("\nTest 7: Cast votes");
    
    // Owner votes for the proposal
    const tx10 = await protocolDAO.castVote(1, true);
    await tx10.wait();
    
    // Admin votes for the proposal
    const protocolDAOAsAdmin = protocolDAO.connect(adminSigner);
    const tx11 = await protocolDAOAsAdmin.castVote(1, true);
    await tx11.wait();
    
    // User votes against the proposal
    const protocolDAOAsUser = protocolDAO.connect(userSigner);
    const tx12 = await protocolDAOAsUser.castVote(1, false);
    await tx12.wait();
    
    // Check vote counts
    const updatedProposal = await protocolDAO.proposals(1);
    console.log(`For votes: ${updatedProposal.forVotes}`);
    console.log(`Against votes: ${updatedProposal.againstVotes}`);
    
    assert(updatedProposal.forVotes.toString() === "2", "Should have 2 for votes");
    assert(updatedProposal.againstVotes.toString() === "1", "Should have 1 against vote");
    
    console.log("✅ Votes cast successfully");
    
    // Test 8: Transfer ownership
    console.log("\nTest 8: Transfer ownership");
    
    const tx13 = await protocolDAO.transferOwnership(admin);
    await tx13.wait();
    
    const newOwner = await protocolDAO.owner();
    console.log(`New owner address: ${newOwner}`);
    assert(newOwner === admin, "Ownership not transferred correctly");
    
    console.log("✅ Ownership transferred successfully");
    
    console.log("\nAll ProtocolDAO tests have passed!");
    
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