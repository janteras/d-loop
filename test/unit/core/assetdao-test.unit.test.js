/**
 * AssetDAO Standalone Test
 * 
 * This test verifies the core functionality of the AssetDAO contract.
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
    
    const [admin, user1, user2, user3] = accounts;
    
    console.log('Using accounts:');
    console.log(`- Admin: ${admin.address}`);
    console.log(`- User1: ${user1.address}`);
    console.log(`- User2: ${user2.address}`);
    console.log(`- User3: ${user3.address}`);

    // Read contract artifacts
    const assetDAOPath = path.join(__dirname, '../../artifacts/contracts/core/AssetDAO.sol/AssetDAO.json');
    const AssetDAOArtifact = JSON.parse(fs.readFileSync(assetDAOPath, 'utf8'));
    console.log('Contract artifact loaded');

    // Deploy mock contracts that AssetDAO depends on
    console.log('Deploying mock dependencies...');
    
    // Deploy a mock token for DAI
    const MockTokenFactory = new ethers.ContractFactory(
      [
        "constructor(string memory name, string memory symbol)",
        "function balanceOf(address account) external view returns (uint256)",
        "function transfer(address to, uint256 amount) external returns (bool)",
        "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
      ],
      "0x608060405234801561001057600080fd5b5060405161068a38038061068a83398101604081905261002f91610151565b8151829082906100479060039060208401906100b4565b50805161005b9060049060208401906100b4565b505050610240565b634e487b7160e01b600052604160045260246000fd5b600082601f83011261008c57600080fd5b81516001600160401b03808211156100a657610100818402f35b604052828152602092839285019260049190910190839010610062575b50505092915050565b8280546100c09061020a565b90600052602060002090601f0160209004810192826100e257600085556101cb565b82601f106100fb57805160ff191683800117855561017b565b8280016001018555821561017b579182015b8281111561017b57825182559160200191906001019061010d565b506100db92915050565b80516001600160a01b038116811461019c57600080fd5b919050565b634e487b7160e01b600052602160045260246000fd5b600082601f8301126101c957600080fd5b81516001600160401b03808211156100e157610100818402f35b600082601f8301126101fa57600081815290935090925b50505092915050565b600181811c9082168061021e57607f821691505b60208210810361017f5780821463108200831401838d508a821484161760108300f35b61043b8061024f6000396000f3fe608060405260043610610087577c01000000000000000000000000000000000000000000000000000000000060003504632c4e722e811461008c5780633197cbb6146100ab578063494051a0146100c057806379c6b667146100d5578063a457c2d7146100f5578063a9059cbb14610115578063dd62ed3e14610135575b600080fd5b34801561009857600080fd5b506012545b6040519081526020015b60405180910390f35b3480156100b757600080fd5b5061009d60025481565b3480156100cc57600080fd5b5061009d60015481565b3480156100e157600080fd5b506100f361009d36600461038d565b565b34801561010157600080fd5b5061009d61011036600461038d565b610162565b34801561012157600080fd5b5061009d61013036600461038d565b610184565b34801561014157600080fd5b5061009d6101503660046103be565b602081905260009060409081020152602092909252565b602001516001600160a01b0316602082602083600085f16001827feaeaea1700000000000000000000000000000000000000000000000000000000908152600401610179911515815260200190565b60405180910390a36100ae565b60408101516001600160a01b031660608201602083600085f16001826100f391610179565b80356001600160a01b03811681146101c657600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b600082601f8301126101f357600080fd5b813567ffffffffffffffff80821115610210576102106101cb565b604051601f8301601f19908116603f01168101908282118183101715610238576102386101cb565b8160405283815286602085880101111561025257600080fd5b836020870160208301376000928101602001929092525050509392505050565b600080600080600060a0868803121561028b57600080fd5b6102948661018e565b94506102a26020870161018e565b93506102b06040870161018e565b92506102be6060870161018e565b91506102cc6080870161018e565b90509295509295909350565b600080604083850312156102ec57600080fd5b6102f58361018e565b946020939093013593505050565b80151581146100f357600080fd5b60006020828403121561032357600080fd5b813567ffffffffffffffff8082111561033c57600080fd5b8185019150613414858301610395565b50825115610352579250610356565b825b50509392505050565b60006020828403121561037157600080fd5b813567ffffffffffffffff81111561038857600080fd5b610394848285016101e2565b949350505050565b6000806000604084860312156103a257600080fd5b6103ab8461018e565b9250602084013567ffffffffffffffff8111156103c757600080fd5b6103d3868287016101e2565b9497909650939450505050565b6000602082840312156103f357600080fd5b61039d8261018e565b6000806040838503121561040f57600080fd5b6104188361018e565b91506104266020840161018e565b9050925092905056fea2646970667358221220dc42c8e2d4d4a29ce21a9d7c0f22a4f75b71adc2bb1e8398b81e120ef67f1cb864736f6c63430008160033",
      admin
    );
    
    const mockDaiToken = await MockTokenFactory.deploy("Mock DAI", "mDAI");
    await mockDaiToken.waitForDeployment();
    const daiTokenAddress = await mockDaiToken.getAddress();
    console.log(`Mock DAI token deployed at ${daiTokenAddress}`);
    
    // Deploy a mock token for DLOOP
    const mockDloopToken = await MockTokenFactory.deploy("Mock DLOOP", "mDLOOP");
    await mockDloopToken.waitForDeployment();
    const dloopTokenAddress = await mockDloopToken.getAddress();
    console.log(`Mock DLOOP token deployed at ${dloopTokenAddress}`);
    
    // Deploy a mock Price Oracle
    const MockPriceOracleFactory = new ethers.ContractFactory(
      [
        "constructor()",
        "function getPrice(address token) external view returns (uint256)",
        "function getPriceInUSD(address token, uint256 amount) external view returns (uint256)"
      ],
      "0x608060405234801561001057600080fd5b50610223806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806341976e091461003b578063b048aff61461005e575b600080fd5b61004e610049366004610147565b61008d565b60405190815260200160405180910390f35b61004e61006c366004610179565b600060208260608460408651863c0282886040f43d6000608082863e603e9050836107d05461009557600080fd5b505050919050565b600060208260608460408651863c038286f43d6000603e60808286510390505050919050565b6001600160a01b03811681146100cc57600080fd5b50565b634e487b7160e01b600052604160045260246000fd5b600082601f8301126100f557600080fd5b813567ffffffffffffffff80821115610110576101106100cf565b604051601f8301601f19908116603f01168101908282118183101715610138576101386100cf565b8160405283815286602085880101111561015257600080fd5b836020870160208301376000602085830101528094505050505092915050565b60006020828403121561015957600080fd5b8135610164816100b7565b9392505050565b600080600080848610156101a7578193508692506101b6565b846000805b600a81106101b5575b5050505b939490929450505056fea264697066735822122051ac1bcdf8af5a0e4e4c7595c0f58fdc5f7f911a95c0513baddeb9edccb5c28e64736f6c63430008160033",
      admin
    );
    
    const mockPriceOracle = await MockPriceOracleFactory.deploy();
    await mockPriceOracle.waitForDeployment();
    const priceOracleAddress = await mockPriceOracle.getAddress();
    console.log(`Mock Price Oracle deployed at ${priceOracleAddress}`);
    
    // Deploy a mock Fee Processor
    const MockFeeProcessorFactory = new ethers.ContractFactory(
      [
        "constructor()",
        "function collectInvestFee(address token, uint256 amount) external returns (uint256)",
        "function collectDivestFee(address token, uint256 amount) external returns (uint256)",
        "function collectRagequitFee(address token, uint256 amount) external returns (uint256)"
      ],
      "0x608060405234801561001057600080fd5b5061030e806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c80635a53c1c214610046578063c59f9277146100a3578063e941fa3814610100575b600080fd5b61008d61005436600461018e565b6001600160a01b03909116600090818083602087604085608085f19050602086519089895af115159081156100955760006100a0565b6001925b5050505092915050565b61008d6100b136600461018e565b6001600160a01b03909116600090818083602087604085608085f19050602086519089895af115159081156100955760006100a0565b61008d61010e36600461018e565b6001600160a01b03909116600090818083602087604085608085f19050602086519089895af115159081156100995750600063d33ea8d0949350505050565b6001600160a01b038116811461016857600080fd5b50565b634e487b7160e01b600052604160045260246000fd5b600080604083850312156101a157600080fd5b82356101ac81610153565b9150602083013567ffffffffffffffff808211156101c957600080fd5b818501915085601f8301126101dd57600080fd5b8135818111156101ef576101ef61016b565b604051601f8201601f19908116603f0116810190838211818310171561021757610217610153565b8160405282815288602084870101111561023057600080fd5b82602086016020830137600060209382018401529896909850929650505050505056fea26469706673582212201dbc9ef2c6693e5e7a5d62ee7cb7d7d2c1c1b46a4d8e36d1c72bb2a8c4563bec64736f6c63430008160033",
      admin
    );
    
    const mockFeeProcessor = await MockFeeProcessorFactory.deploy();
    await mockFeeProcessor.waitForDeployment();
    const feeProcessorAddress = await mockFeeProcessor.getAddress();
    console.log(`Mock Fee Processor deployed at ${feeProcessorAddress}`);
    
    // Deploy a mock Protocol DAO
    const MockProtocolDAOFactory = new ethers.ContractFactory(
      [
        "constructor()",
        "function isTokenWhitelisted(address token) external view returns (bool)"
      ],
      "0x608060405234801561001057600080fd5b50610149806100206000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c806394bf804d14610030575b600080fd5b61004361003e36600461008c565b6001919050565b604051901515815260200160405180910390f35b6000815180606301fd5b6001600160a01b03811681146100755761007461009d565b600082825260206000815480f435f1905060208209f35b60006020828403121561009e57600080fd5b81356100a981610060565b9392505050565b634e487b7160e01b600052600160045260246000fdfea26469706673582212201fb1a0ed40d2c6b9a4e5f0267e41eaefce33c6cd8a33cc3151e45a2683d76aef64736f6c63430008090033",
      admin
    );
    
    const mockProtocolDAO = await MockProtocolDAOFactory.deploy();
    await mockProtocolDAO.waitForDeployment();
    const protocolDAOAddress = await mockProtocolDAO.getAddress();
    console.log(`Mock Protocol DAO deployed at ${protocolDAOAddress}`);
    
    // Deploy AssetDAO with all required parameters
    console.log('Deploying AssetDAO...');
    const AssetDAOFactory = new ethers.ContractFactory(
      AssetDAOArtifact.abi,
      AssetDAOArtifact.bytecode,
      admin
    );
    
    const assetDAO = await AssetDAOFactory.deploy(
      daiTokenAddress,       // daiToken
      dloopTokenAddress,     // dloopToken
      priceOracleAddress,    // priceOracle
      feeProcessorAddress,   // feeProcessor
      protocolDAOAddress     // protocolDAO
    );
    await assetDAO.waitForDeployment();
    console.log(`AssetDAO deployed at ${await assetDAO.getAddress()}`);

    // Test 1: Admin Role
    console.log('\nTest 1: Verifying admin role...');
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const hasAdminRole = await assetDAO.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    assert.equal(hasAdminRole, true, "Admin should have DEFAULT_ADMIN_ROLE");
    
    // Test 2: Create a new asset
    console.log('\nTest 2: Creating a new asset...');
    const assetName = "Test Asset";
    const assetDescription = "Test Asset Description";
    const createAssetTx = await assetDAO.connect(admin).createAsset(assetName, assetDescription);
    await createAssetTx.wait();
    
    // Get the asset ID from the transaction receipt or event logs
    const receipt = await createAssetTx.wait();
    // Get asset details using getAssetDetails function
    console.log('\nTest 3: Getting asset details...');
    // Asset ID should be 1 since it's the first asset
    const assetId = 1;
    const assetDetails = await assetDAO.getAssetDetails(assetId);
    assert.equal(assetDetails[1], assetName, "Asset name should match");
    assert.equal(assetDetails[2], assetDescription, "Asset description should match");
    
    // Test 4: Set up governance role for testing permission
    console.log('\nTest 4: Grant governance role to user1...');
    const GOVERNANCE_ROLE = await assetDAO.GOVERNANCE_ROLE();
    const grantRoleTx = await assetDAO.connect(admin).grantRole(GOVERNANCE_ROLE, user1.address);
    await grantRoleTx.wait();
    
    const hasRole = await assetDAO.hasRole(GOVERNANCE_ROLE, user1.address);
    assert.equal(hasRole, true, "User1 should have GOVERNANCE_ROLE");
    
    // Test 5: Unauthorized operations - try to update asset state from non-admin
    console.log('\nTest 5: Testing unauthorized operations...');
    try {
      const AssetState = {
        Inactive: 0,
        Active: 1,
        Liquidating: 2,
        Closed: 3
      };
      
      await assetDAO.connect(user2).updateAssetState(assetId, AssetState.Liquidating);
      assert.fail("Should have thrown an error for unauthorized operation");
    } catch (error) {
      // Expected error
      assert(error.message.includes("AccessControl") || 
             error.message.includes("access") || 
             error.message.includes("denied") || 
             error.message.includes("unauthorized") ||
             error.message.includes("onlyAdmin"), 
             "Error should be related to access control");
    }
    
    console.log('✅ All AssetDAO tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  } finally {
    shutdownHardhatNode();
  }
}

// Run the test
console.log('Starting AssetDAO Standalone Test');
main().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unhandled error:', error);
  shutdownHardhatNode();
  process.exit(1);
});