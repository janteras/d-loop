// Standalone Test for ProtocolDAO
// This test does not require a running Hardhat node and includes necessary ethers compatibility

const { ethers } = require('hardhat');
const { expect } = require('chai');

// Add missing constants and utility functions
if (!ethers.constants) {
  ethers.constants = {
    AddressZero: "0x0000000000000000000000000000000000000000",
    Zero: ethers.toBigInt(0),
    One: ethers.toBigInt(1)
  };
}

if (!ethers.utils) {
  ethers.utils = {
    parseEther: (value) => ethers.parseUnits(value, 18),
    formatEther: (value) => ethers.formatUnits(value, 18),
    keccak256: ethers.keccak256,
    toUtf8Bytes: ethers.toUtf8Bytes,
    defaultAbiCoder: ethers.AbiCoder.defaultAbiCoder(),
    id: ethers.id
  };
}

// Helper function for role hash calculation (kept for potential future use)
function computeRoleHash(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role));
}

async function main() {
  console.log("Starting ProtocolDAO Standalone Test");
  
  // Get signers
  const [owner, user1, user2, user3] = await ethers.getSigners();
  console.log("Test accounts:");
  console.log(`Owner: ${owner.address}`);
  console.log(`User1: ${user1.address}`);
  console.log(`User2: ${user2.address}`);
  console.log(`User3: ${user3.address}`);
  
  console.log("\nDeploying contracts...");
  
  // Deploy mock token for testing
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy();
  await mockToken.waitForDeployment();
  console.log(`Mock Token deployed at: ${await mockToken.getAddress()}`);
  
  // Deploy ProtocolDAO
  const ProtocolDAO = await ethers.getContractFactory("ProtocolDAO");
  const protocolDAO = await ProtocolDAO.deploy(
    owner.address,  // admin
    user1.address,  // treasury
    86400,          // voting period (1 day)
    600,            // execution delay (10 minutes)
    51              // quorum (51%)
  );
  await protocolDAO.waitForDeployment();
  console.log(`ProtocolDAO deployed at: ${await protocolDAO.getAddress()}`);
  
  // Test Initialization
  console.log("\nTest 1: Initialization");
  console.log("Checking initial parameters...");
  
  expect(await protocolDAO.admin()).to.equal(owner.address);
  expect(await protocolDAO.treasury()).to.equal(user1.address);
  expect(await protocolDAO.executionDelay()).to.equal(600);
  expect(await protocolDAO.quorum()).to.equal(51);
  expect(await protocolDAO.votingPeriod()).to.equal(86400);
  
  console.log("✅ Initialization test passed!");
  
  // Test Admin Updates
  console.log("\nTest 2: Admin Management");
  
  // Update admin to user2
  console.log(`Updating admin to ${user2.address}`);
  await protocolDAO.updateAdmin(user2.address);
  
  // Check if admin was updated
  expect(await protocolDAO.admin()).to.equal(user2.address);
  console.log("✅ Admin update test passed!");
  
  // Test Parameter Updates
  console.log("\nTest 3: Parameter Updates");
  
  // Update quorum
  const newQuorum = 75;
  console.log(`Updating quorum from 51% to ${newQuorum}%`);
  await protocolDAO.updateQuorum(newQuorum);
  expect(await protocolDAO.quorum()).to.equal(newQuorum);
  
  // Update voting period
  const newVotingPeriod = 172800; // 2 days
  console.log(`Updating voting period from 86400 to ${newVotingPeriod}`);
  await protocolDAO.updateVotingPeriod(newVotingPeriod);
  expect(await protocolDAO.votingPeriod()).to.equal(newVotingPeriod);
  
  // Update execution delay
  const newDelay = 1200; // 20 minutes
  console.log(`Updating execution delay from 600 to ${newDelay}`);
  await protocolDAO.updateExecutionDelay(newDelay);
  expect(await protocolDAO.executionDelay()).to.equal(newDelay);
  
  console.log("✅ Parameter updates test passed!");
  
  // Test Token Whitelisting
  console.log("\nTest 4: Token Whitelisting");
  
  // Whitelist token
  console.log(`Whitelisting token at ${await mockToken.getAddress()}`);
  await protocolDAO.whitelistToken(await mockToken.getAddress(), true);
  
  // Check if token is whitelisted
  expect(await protocolDAO.isTokenWhitelisted(await mockToken.getAddress())).to.be.true;
  
  // Remove token from whitelist
  console.log("Removing token from whitelist");
  await protocolDAO.whitelistToken(await mockToken.getAddress(), false);
  
  // Check if token is no longer whitelisted
  expect(await protocolDAO.isTokenWhitelisted(await mockToken.getAddress())).to.be.false;
  
  console.log("✅ Token whitelisting test passed!");
  
  // Test Proposal Creation and Execution
  console.log("\nTest 5: Proposal Creation and Execution");
  
  // Re-whitelist token for proposals
  await protocolDAO.whitelistToken(await mockToken.getAddress(), true);
  
  // Create proposal
  const proposalDescription = "Test Proposal";
  const targets = [await protocolDAO.getAddress()];
  const values = [0];
  const calldata = protocolDAO.interface.encodeFunctionData("updateQuorum", [2000]);
  
  console.log("Creating proposal...");
  await protocolDAO.createProposal(proposalDescription, targets, values, [calldata]);
  
  // Check proposal count
  expect(await protocolDAO.getProposalCount()).to.equal(1);
  
  // Get proposal details
  const proposal = await protocolDAO.proposals(1); // IDs start at 1, not 0
  expect(proposal.description).to.equal(proposalDescription);
  expect(proposal.executed).to.be.false;
  
  console.log("✅ Proposal creation test passed!");
  
  console.log("\nAll ProtocolDAO tests have passed!");
}

// Run the test
main().catch((error) => {
  console.error("Test failed:", error);
  process.exitCode = 1;
});