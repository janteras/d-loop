/**
 * ProtocolDAO Standalone Test
 * 
 * This test verifies the core functionality of the ProtocolDAO contract.
 */

// Load the improved ethers v6 shim
require('../../utils/ethers-v6-compat');
const { ethers } = require('ethers');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Hardhat node process
let hardhatProcess = null;

// Utility function to check if addresses are the same (case-insensitive)
function isSameAddress(addr1, addr2) {
  return addr1.toLowerCase() === addr2.toLowerCase();
}

// Start Hardhat node if not running
async function startHardhatNode() {
  try {
    // Try to connect to existing node
    const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');
    await provider.getBlockNumber();
    console.log('Connected to existing Hardhat node');
    return provider;
  } catch (error) {
    console.log('No existing Hardhat node found, starting a new one...');
    // Start a new Hardhat node
    const { spawn } = require('child_process');
    hardhatProcess = spawn('npx', ['hardhat', 'node', '--hostname', '0.0.0.0', '--port', '8545'], {
      stdio: 'pipe'
    });
    
    // Wait for the node to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const provider = new ethers.JsonRpcProvider('http://0.0.0.0:8545');
    return provider;
  }
}

// Shutdown Hardhat node if we started it
function shutdownHardhatNode() {
  if (hardhatProcess) {
    console.log('Shutting down Hardhat node...');
    hardhatProcess.kill();
  }
}

async function main() {
  try {
    // Start provider
    const provider = await startHardhatNode();
    console.log('Provider created');

    // Get accounts
    const accounts = await provider.listAccounts();
    console.log(`Found ${accounts.length} accounts`);
    
    const [admin, proposer, executor, user1] = accounts;
    
    console.log('Using accounts:');
    console.log(`- Admin: ${admin.address}`);
    console.log(`- Proposer: ${proposer.address}`);
    console.log(`- Executor: ${executor.address}`);
    console.log(`- User1: ${user1.address}`);

    // Read contract artifacts
    const protocolDAOPath = path.join(__dirname, '../../artifacts/contracts/dao/ProtocolDAO.sol/ProtocolDAO.json');
    const ProtocolDAOArtifact = JSON.parse(fs.readFileSync(protocolDAOPath, 'utf8'));
    console.log('Contract artifact loaded');

    // Deploy ProtocolDAO
    console.log('Deploying ProtocolDAO...');
    const ProtocolDAOFactory = new ethers.ContractFactory(
      ProtocolDAOArtifact.abi,
      ProtocolDAOArtifact.bytecode,
      admin
    );
    
    const protocolDAO = await ProtocolDAOFactory.deploy();
    await protocolDAO.waitForDeployment();
    const protocolDAOAddress = await protocolDAO.getAddress();
    console.log(`ProtocolDAO deployed at ${protocolDAOAddress}`);

    // Test 1: Admin Role
    console.log('\nTest 1: Verifying admin role...');
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const hasAdminRole = await protocolDAO.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    assert.equal(hasAdminRole, true, "Admin should have DEFAULT_ADMIN_ROLE");
    
    // Test 2: Grant PROPOSER_ROLE
    console.log('\nTest 2: Granting PROPOSER_ROLE...');
    const PROPOSER_ROLE = await protocolDAO.PROPOSER_ROLE();
    await protocolDAO.connect(admin).grantRole(PROPOSER_ROLE, proposer.address);
    
    const hasProposerRole = await protocolDAO.hasRole(PROPOSER_ROLE, proposer.address);
    assert.equal(hasProposerRole, true, "Proposer should have PROPOSER_ROLE");
    
    // Test 3: Grant EXECUTOR_ROLE
    console.log('\nTest 3: Granting EXECUTOR_ROLE...');
    const EXECUTOR_ROLE = await protocolDAO.EXECUTOR_ROLE();
    await protocolDAO.connect(admin).grantRole(EXECUTOR_ROLE, executor.address);
    
    const hasExecutorRole = await protocolDAO.hasRole(EXECUTOR_ROLE, executor.address);
    assert.equal(hasExecutorRole, true, "Executor should have EXECUTOR_ROLE");
    
    // Test 4: Create and execute a proposal
    console.log('\nTest 4: Creating and executing a proposal...');
    
    // Create a mock target contract for the proposal
    const mockTargetABI = [
      "function setValue(uint256 newValue) external",
      "function value() external view returns (uint256)"
    ];
    
    const MockTargetFactory = new ethers.ContractFactory(
      [
        {
          "inputs": [],
          "stateMutability": "nonpayable",
          "type": "constructor"
        },
        {
          "inputs": [
            {
              "internalType": "uint256",
              "name": "newValue",
              "type": "uint256"
            }
          ],
          "name": "setValue",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        },
        {
          "inputs": [],
          "name": "value",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ],
      "0x608060405234801561001057600080fd5b50600080819055506101c5806100276000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80633fa4f2451461003b5780635524107714610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220032bd41232873f0d112bbc65d2271b3898af6facdf3de3ae55c2a0df08bcacf464736f6c63430008160033",
      admin
    );
    
    const mockTarget = await MockTargetFactory.deploy();
    await mockTarget.waitForDeployment();
    const mockTargetAddress = await mockTarget.getAddress();
    console.log(`Mock target contract deployed at ${mockTargetAddress}`);
    
    // Create an interface for the mock target
    const mockTargetInterface = new ethers.Interface(mockTargetABI);
    
    // Create calldata for the setValue function
    const newValue = 42;
    const callData = mockTargetInterface.encodeFunctionData("setValue", [newValue]);
    
    // Create a proposal
    await protocolDAO.connect(proposer).propose(
      [mockTargetAddress],  // targets
      [0],                  // values (no ETH sent)
      [callData],           // calldata
      "Set value to 42"     // description
    );
    
    // Get the proposal ID
    const proposalId = await protocolDAO.getLatestProposalId();
    console.log(`Created proposal with ID: ${proposalId}`);
    
    // Check proposal state
    const initialState = await protocolDAO.state(proposalId);
    console.log(`Initial proposal state: ${initialState}`);
    
    // Execute the proposal
    await protocolDAO.connect(executor).execute(
      [mockTargetAddress],  // targets
      [0],                  // values
      [callData],           // calldata
      ethers.keccak256(ethers.toUtf8Bytes("Set value to 42"))  // descriptionHash
    );
    
    // Verify the proposal was executed
    const newState = await protocolDAO.state(proposalId);
    console.log(`New proposal state: ${newState}`);
    
    // Verify the target contract's value was updated
    const mockTargetContract = new ethers.Contract(mockTargetAddress, mockTargetABI, provider);
    const updatedValue = await mockTargetContract.value();
    console.log(`Updated value in target contract: ${updatedValue}`);
    
    assert.equal(updatedValue, newValue, "Target contract value should be updated after proposal execution");
    
    // Test 5: Unauthorized operations
    console.log('\nTest 5: Testing unauthorized operations...');
    try {
      await protocolDAO.connect(user1).propose(
        [mockTargetAddress],
        [0],
        [callData],
        "Unauthorized proposal"
      );
      assert.fail("Should have thrown an error for unauthorized proposal");
    } catch (error) {
      // Expected error
      assert(error.message.includes("AccessControl") || 
             error.message.includes("access") || 
             error.message.includes("denied") || 
             error.message.includes("unauthorized"), 
             "Error should be related to access control");
    }
    
    console.log('✅ All ProtocolDAO tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting ProtocolDAO Standalone Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});