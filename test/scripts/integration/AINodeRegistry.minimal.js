const { expect } = require("chai");
const hre = require("hardhat");

function parseUnits(value, decimals = 18) {
  return BigInt(Math.floor(Number(value) * 10**Number(decimals)));
}

// This is a minimal test to demonstrate the integration between AINodeRegistry and SoulboundNFT
describe("AINodeRegistry SoulboundNFT Integration Minimal Test", function() {
  let registry, soulboundNFT, mockToken;
  let accounts;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  
  beforeEach(async function() {
    // Get accounts using hre.ethers instead of ethers
    const provider = hre.ethers.provider;
    
    // We'll use account #0 as owner, #1 as admin, #2 and #3 as users
    accounts = await Promise.all([
      provider.getSigner(0),
      provider.getSigner(1),
      provider.getSigner(2),
      provider.getSigner(3)
    ]);
    
    // Get the addresses of the signers
    const [owner, admin, user1, user2] = await Promise.all(
      accounts.map(account => account.getAddress())
    );
    
    console.log("Got accounts:", owner, admin, user1, user2);
    
    // Deploy SoulboundNFT
    const SoulboundNFT = await hre.ethers.getContractFactory("SoulboundNFT", accounts[0]);
    soulboundNFT = await SoulboundNFT.deploy(admin);
    await soulboundNFT.waitForDeployment();
    
    console.log("SoulboundNFT deployed at:", await soulboundNFT.getAddress());
    
    // Deploy MockToken
    const MockToken = await hre.ethers.getContractFactory("MockERC20", accounts[0]);
    mockToken = await MockToken.deploy("DLOOP Token", "DLOOP", 18);
    await mockToken.waitForDeployment();
    
    console.log("MockToken deployed at:", await mockToken.getAddress());
    
    // Mint tokens to users
    await mockToken.connect(accounts[0]).mint(user1, parseUnits("1000", 18));
    await mockToken.connect(accounts[0]).mint(user2, parseUnits("1000", 18));
    
    // Deploy AINodeRegistry
    const AINodeRegistry = await hre.ethers.getContractFactory("AINodeRegistry", accounts[0]);
    registry = await AINodeRegistry.deploy(
      admin,
      ZERO_ADDRESS,
      await soulboundNFT.getAddress()
    );
    await registry.waitForDeployment();
    
    console.log("AINodeRegistry deployed at:", await registry.getAddress());
    
    // Set token requirement
    const tokenAddress = await mockToken.getAddress();
    const registryAddress = await registry.getAddress();
    
    await registry.connect(accounts[1]).setTokenRequirement(1, tokenAddress, parseUnits("100", 18), true);
    
    // Approve tokens
    await mockToken.connect(accounts[2]).approve(registryAddress, parseUnits("1000", 18));
    await mockToken.connect(accounts[3]).approve(registryAddress, parseUnits("1000", 18));
  });
  
  it("should mint an NFT when registering a node", async function() {
    const user1Address = await accounts[2].getAddress();
    const nodeAddress = "0x1111111111111111111111111111111111111111";
    const metadata = "ipfs://node-metadata-1";
    
    // Register node
    await registry.connect(accounts[1]).registerNode(nodeAddress, user1Address, metadata);
    
    // Get node details
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    
    expect(nodeDetails.nodeOwner).to.equal(user1Address);
    expect(nodeDetails.metadata).to.equal(metadata);
    expect(nodeDetails.soulboundTokenId).to.be.above(0);
    
    // Check NFT details
    const tokenId = nodeDetails.soulboundTokenId;
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    
    expect(tokenDetails.tokenOwner).to.equal(user1Address);
    expect(tokenDetails.tokenURI).to.equal(metadata);
    expect(tokenDetails.revoked).to.be.false;
  });
  
  it("should burn the NFT when deregistering a node", async function() {
    const user1Address = await accounts[2].getAddress();
    const nodeAddress = "0x2222222222222222222222222222222222222222";
    const metadata = "ipfs://node-metadata-2";
    
    // Register node
    await registry.connect(accounts[1]).registerNode(nodeAddress, user1Address, metadata);
    
    // Get node details and token ID
    const nodeDetails = await registry.getNodeDetails(nodeAddress);
    const tokenId = nodeDetails.soulboundTokenId;
    
    // Deregister the node
    await registry.connect(accounts[2]).deregisterNodeWithRefund();
    
    // Check NFT status
    const tokenDetails = await soulboundNFT.getTokenDetails(tokenId);
    expect(tokenDetails.revoked).to.be.true;
  });
});