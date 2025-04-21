const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * @title ABI Compliance Tests
 * @dev Comprehensive tests for verifying contract ABI compliance
 * @notice These tests ensure that all contracts maintain their expected interfaces
 * and that cross-contract interactions work as expected
 */
describe("ABI Compliance Tests", function () {
  // Helper function to load contract artifacts
  function loadArtifact(contractName) {
    try {
      // Search for the contract file recursively
      const findArtifact = (dir, contractName) => {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            const result = findArtifact(filePath, contractName);
            if (result) return result;
          } else if (file === `${contractName}.json`) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
          }
        }
        
        return null;
      };
      
      const artifactPath = path.join(process.cwd(), 'artifacts/contracts');
      const artifact = findArtifact(artifactPath, contractName);
      
      if (!artifact) {
        throw new Error(`Artifact for ${contractName} not found`);
      }
      
      return artifact;
    } catch (error) {
      console.error(`Error loading artifact for ${contractName}:`, error);
      throw error;
    }
  }
  
  // Helper function to deploy a contract
  async function deployContract(contractName, signer, constructorArgs = [], options = {}) {
    try {
      const artifact = loadArtifact(contractName);
      const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
      return await factory.deploy(...constructorArgs, options);
    } catch (error) {
      console.error(`Error deploying ${contractName}:`, error);
      throw error;
    }
  }
  
  // Helper function to get address from contract instance (compatible with ethers v5 and v6)
  function getAddress(contract) {
    return contract.address || contract.target;
  }

  // Test fixture to deploy all contracts
  async function deployAllContracts() {
    const [owner, admin, user1, user2] = await ethers.getSigners();
    
    // Deploy contracts
    const daiToken = await deployContract("DAIToken", owner);
    const dloopToken = await deployContract("DLoopToken", owner);
    const priceOracle = await deployContract("PriceOracle", owner);
    const feeProcessor = await deployContract("FeeProcessor", owner, [
      getAddress(daiToken),
      getAddress(dloopToken)
    ]);
    const protocolDAO = await deployContract("ProtocolDAO", owner, [
      getAddress(dloopToken)
    ]);
    const treasury = await deployContract("Treasury", owner, [
      admin.address,
      getAddress(protocolDAO)
    ]);
    const assetDAO = await deployContract("AssetDAO", owner, [
      getAddress(daiToken),
      getAddress(dloopToken),
      getAddress(priceOracle),
      getAddress(feeProcessor),
      getAddress(protocolDAO)
    ]);
    const soulboundNFT = await deployContract("SoulboundNFT", owner);
    const aiNodeRegistry = await deployContract("AINodeRegistry", owner);
    
    return {
      daiToken,
      dloopToken,
      priceOracle,
      feeProcessor,
      protocolDAO,
      treasury,
      assetDAO,
      soulboundNFT,
      aiNodeRegistry,
      owner,
      admin,
      user1,
      user2
    };
  }

  describe("Contract Interface Verification", function () {
    it("DAIToken should implement the correct ERC20 interface", async function () {
      const { daiToken } = await deployAllContracts();
      
      // Verify ERC20 interface functions exist
      expect(daiToken.totalSupply).to.be.a('function');
      expect(daiToken.balanceOf).to.be.a('function');
      expect(daiToken.transfer).to.be.a('function');
      expect(daiToken.allowance).to.be.a('function');
      expect(daiToken.approve).to.be.a('function');
      expect(daiToken.transferFrom).to.be.a('function');
      
      // Verify D-AI specific functions
      expect(daiToken.mint).to.be.a('function');
      expect(daiToken.pause).to.be.a('function');
      expect(daiToken.unpause).to.be.a('function');
      
      // Verify AccessControl functions
      expect(daiToken.hasRole).to.be.a('function');
      expect(daiToken.getRoleAdmin).to.be.a('function');
      expect(daiToken.grantRole).to.be.a('function');
      expect(daiToken.revokeRole).to.be.a('function');
    });
    
    it("SoulboundNFT should implement the correct ERC721 interface", async function () {
      const { soulboundNFT } = await deployAllContracts();
      
      // Verify ERC721 interface functions exist
      expect(soulboundNFT.balanceOf).to.be.a('function');
      expect(soulboundNFT.ownerOf).to.be.a('function');
      expect(soulboundNFT.tokenURI).to.be.a('function');
      expect(soulboundNFT.approve).to.be.a('function');
      expect(soulboundNFT.getApproved).to.be.a('function');
      expect(soulboundNFT.setApprovalForAll).to.be.a('function');
      expect(soulboundNFT.isApprovedForAll).to.be.a('function');
      expect(soulboundNFT.transferFrom).to.be.a('function');
      expect(soulboundNFT.safeTransferFrom).to.be.a('function');
      
      // Verify SoulboundNFT specific functions
      expect(soulboundNFT.mint).to.be.a('function');
      expect(soulboundNFT.burn).to.be.a('function');
      expect(soulboundNFT.revoke).to.be.a('function');
      expect(soulboundNFT.isTokenValid).to.be.a('function');
      
      // Verify AccessControl functions
      expect(soulboundNFT.hasRole).to.be.a('function');
      expect(soulboundNFT.getRoleAdmin).to.be.a('function');
      expect(soulboundNFT.grantRole).to.be.a('function');
      expect(soulboundNFT.revokeRole).to.be.a('function');
    });
    
    it("AINodeRegistry should implement the correct node management interface", async function () {
      const { aiNodeRegistry } = await deployAllContracts();
      
      // Verify AINodeRegistry interface functions exist
      expect(aiNodeRegistry.registerNode).to.be.a('function');
      expect(aiNodeRegistry.updateNodeState).to.be.a('function');
      expect(aiNodeRegistry.updateReputation).to.be.a('function');
      expect(aiNodeRegistry.getNodeInfo).to.be.a('function');
      expect(aiNodeRegistry.getAllNodeAddresses).to.be.a('function');
    });
    
    it("Treasury should implement the correct treasury management interface", async function () {
      const { treasury } = await deployAllContracts();
      
      // Verify Treasury interface functions exist
      expect(treasury.withdraw).to.be.a('function');
      expect(treasury.deposit).to.be.a('function');
      expect(treasury.getBalance).to.be.a('function');
      
      // Verify TokenApprovalOptimizer functions
      expect(treasury.safeTransferFrom).to.be.a('function');
      expect(treasury.batchApprove).to.be.a('function');
      expect(treasury.singleTransactionApprove).to.be.a('function');
      expect(treasury.clearApproval).to.be.a('function');
    });
    
    it("AssetDAO should implement the correct asset management interface", async function () {
      const { assetDAO } = await deployAllContracts();
      
      // Verify AssetDAO interface functions exist
      expect(assetDAO.createAsset).to.be.a('function');
      expect(assetDAO.invest).to.be.a('function');
      expect(assetDAO.withdraw).to.be.a('function');
      expect(assetDAO.getAssetDetails).to.be.a('function');
      expect(assetDAO.getInvestorShares).to.be.a('function');
      expect(assetDAO.createProposal).to.be.a('function');
      expect(assetDAO.vote).to.be.a('function');
      expect(assetDAO.executeProposal).to.be.a('function');
    });
  });

  describe("Cross-Contract Interface Compatibility", function () {
    it("AssetDAO should be able to interact with DAIToken", async function () {
      const { daiToken, assetDAO, owner, user1 } = await deployAllContracts();
      
      // Mint tokens to test interaction
      const mintAmount = ethers.utils.parseEther("10000");
      await daiToken.mint(owner.address, mintAmount);
      
      // Transfer tokens to user1
      const transferAmount = ethers.utils.parseEther("1000");
      await daiToken.transfer(user1.address, transferAmount);
      
      // Create an asset
      await assetDAO.createAsset(
        "Interface Test Asset",
        "https://metadata.dloop.io/asset/interface",
        ethers.utils.parseEther("5000"),
        86400 * 30 // 30 days
      );
      
      // User1 approves AssetDAO to spend tokens
      await daiToken.connect(user1).approve(getAddress(assetDAO), transferAmount);
      
      // Verify approval was successful
      const allowance = await daiToken.allowance(user1.address, getAddress(assetDAO));
      expect(allowance).to.equal(transferAmount);
      
      // User1 invests in the asset
      const investAmount = ethers.utils.parseEther("500");
      await assetDAO.connect(user1).invest(1, investAmount);
      
      // Verify AssetDAO received the tokens
      const assetDAOBalance = await daiToken.balanceOf(getAddress(assetDAO));
      expect(assetDAOBalance).to.be.gte(investAmount);
    });
    
    it("AINodeRegistry should be able to interact with SoulboundNFT", async function () {
      const { soulboundNFT, aiNodeRegistry, owner, user1 } = await deployAllContracts();
      
      // This test would verify that AINodeRegistry can mint SoulboundNFTs
      // In a real implementation, AINodeRegistry would have a reference to SoulboundNFT
      // For testing purposes, we'll simulate this interaction
      
      // Grant minter role to AINodeRegistry (or owner for testing)
      const minterRole = await soulboundNFT.MINTER_ROLE();
      await soulboundNFT.grantRole(minterRole, getAddress(aiNodeRegistry));
      
      // Mint a token directly (simulating AINodeRegistry's action)
      const tokenId = await soulboundNFT.mint(user1.address, "node:metadata");
      
      // Verify token was minted to the correct owner
      const tokenOwner = await soulboundNFT.ownerOf(tokenId);
      expect(tokenOwner).to.equal(user1.address);
    });
    
    it("Treasury should be able to interact with DAIToken", async function () {
      const { daiToken, treasury, owner, user1 } = await deployAllContracts();
      
      // Mint tokens to test interaction
      const mintAmount = ethers.utils.parseEther("10000");
      await daiToken.mint(owner.address, mintAmount);
      
      // Transfer tokens to user1
      const transferAmount = ethers.utils.parseEther("1000");
      await daiToken.transfer(user1.address, transferAmount);
      
      // User1 approves Treasury to spend tokens
      const depositAmount = ethers.utils.parseEther("500");
      await daiToken.connect(user1).approve(getAddress(treasury), depositAmount);
      
      // User1 deposits tokens to Treasury
      await treasury.connect(user1).deposit(
        getAddress(daiToken),
        depositAmount,
        "ABI Test Deposit"
      );
      
      // Verify Treasury received the tokens
      const treasuryBalance = await daiToken.balanceOf(getAddress(treasury));
      expect(treasuryBalance).to.be.gte(depositAmount);
      
      // Treasury withdraws tokens to owner
      const withdrawAmount = ethers.utils.parseEther("100");
      const ownerBalanceBefore = await daiToken.balanceOf(owner.address);
      
      await treasury.withdraw(
        getAddress(daiToken),
        owner.address,
        withdrawAmount
      );
      
      // Verify owner received the tokens
      const ownerBalanceAfter = await daiToken.balanceOf(owner.address);
      expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(withdrawAmount);
    });
  });

  describe("Event Signature Verification", function () {
    it("DAIToken should emit correct Transfer and Approval events", async function () {
      const { daiToken, owner, user1, user2 } = await deployAllContracts();
      
      // Test Transfer event
      const transferAmount = ethers.utils.parseEther("100");
      await daiToken.mint(owner.address, transferAmount);
      
      const transferTx = await daiToken.transfer(user1.address, transferAmount);
      const transferReceipt = await transferTx.wait();
      
      // Find Transfer event
      const transferEvent = transferReceipt.events.find(e => e.event === "Transfer");
      expect(transferEvent).to.not.be.undefined;
      expect(transferEvent.args.from).to.equal(owner.address);
      expect(transferEvent.args.to).to.equal(user1.address);
      expect(transferEvent.args.value).to.equal(transferAmount);
      
      // Test Approval event
      const approvalAmount = ethers.utils.parseEther("50");
      const approvalTx = await daiToken.connect(user1).approve(user2.address, approvalAmount);
      const approvalReceipt = await approvalTx.wait();
      
      // Find Approval event
      const approvalEvent = approvalReceipt.events.find(e => e.event === "Approval");
      expect(approvalEvent).to.not.be.undefined;
      expect(approvalEvent.args.owner).to.equal(user1.address);
      expect(approvalEvent.args.spender).to.equal(user2.address);
      expect(approvalEvent.args.value).to.equal(approvalAmount);
    });
    
    it("Treasury should emit correct FundsReceived and FundsWithdrawn events", async function () {
      const { daiToken, treasury, owner, user1 } = await deployAllContracts();
      
      // Mint tokens to test events
      const mintAmount = ethers.utils.parseEther("10000");
      await daiToken.mint(owner.address, mintAmount);
      
      // Transfer tokens to user1
      const transferAmount = ethers.utils.parseEther("1000");
      await daiToken.transfer(user1.address, transferAmount);
      
      // User1 approves Treasury to spend tokens
      const depositAmount = ethers.utils.parseEther("500");
      await daiToken.connect(user1).approve(getAddress(treasury), depositAmount);
      
      // User1 deposits tokens to Treasury
      const depositTx = await treasury.connect(user1).deposit(
        getAddress(daiToken),
        depositAmount,
        "Event Test Deposit"
      );
      const depositReceipt = await depositTx.wait();
      
      // Find FundsReceived event
      const receivedEvent = depositReceipt.events.find(e => e.event === "FundsReceived");
      expect(receivedEvent).to.not.be.undefined;
      expect(receivedEvent.args.token).to.equal(getAddress(daiToken));
      expect(receivedEvent.args.amount).to.equal(depositAmount);
      expect(receivedEvent.args.from).to.equal(user1.address);
      
      // Find Deposit event
      const depositEvent = depositReceipt.events.find(e => e.event === "Deposit");
      expect(depositEvent).to.not.be.undefined;
      expect(depositEvent.args.token).to.equal(getAddress(daiToken));
      expect(depositEvent.args.amount).to.equal(depositAmount);
      expect(depositEvent.args.from).to.equal(user1.address);
      
      // Treasury withdraws tokens to owner
      const withdrawAmount = ethers.utils.parseEther("100");
      const withdrawTx = await treasury.withdraw(
        getAddress(daiToken),
        owner.address,
        withdrawAmount
      );
      const withdrawReceipt = await withdrawTx.wait();
      
      // Find FundsWithdrawn event
      const withdrawnEvent = withdrawReceipt.events.find(e => e.event === "FundsWithdrawn");
      expect(withdrawnEvent).to.not.be.undefined;
      expect(withdrawnEvent.args.token).to.equal(getAddress(daiToken));
      expect(withdrawnEvent.args.recipient).to.equal(owner.address);
      expect(withdrawnEvent.args.amount).to.equal(withdrawAmount);
      
      // Find Withdrawal event
      const withdrawalEvent = withdrawReceipt.events.find(e => e.event === "Withdrawal");
      expect(withdrawalEvent).to.not.be.undefined;
      expect(withdrawalEvent.args.token).to.equal(getAddress(daiToken));
      expect(withdrawalEvent.args.amount).to.equal(withdrawAmount);
      expect(withdrawalEvent.args.to).to.equal(owner.address);
    });
  });
});
