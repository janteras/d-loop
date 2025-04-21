const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Treasury", function () {
  let treasury;
  let mockToken;
  let owner, user1, user2, withdrawalRole;
  
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
  const TREASURY_ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TREASURY_ADMIN_ROLE"));
  const PROTOCOL_DAO_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PROTOCOL_DAO_ROLE"));
  const WITHDRAWAL_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WITHDRAWAL_ROLE"));
  
  beforeEach(async function () {
    [owner, user1, user2, withdrawalRole] = await ethers.getSigners();
    
    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.deployed();
    
    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK", 18);
    await mockToken.deployed();
    
    // Mint tokens to user1
    await mockToken.mint(user1.address, ethers.utils.parseEther("10000"));
    
    // Approve treasury to spend user1's tokens
    await mockToken.connect(user1).approve(treasury.address, ethers.constants.MaxUint256);
    
    // Grant WITHDRAWAL_ROLE to withdrawalRole
    await treasury.addWithdrawalRole(withdrawalRole.address);
  });
  
  describe("Deployment", function () {
    it("Should assign the default admin role to the deployer", async function () {
      expect(await treasury.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.equal(true);
    });
    
    it("Should assign the treasury admin role to the deployer", async function () {
      expect(await treasury.hasRole(TREASURY_ADMIN_ROLE, owner.address)).to.equal(true);
    });
  });
  
  describe("Receiving Funds", function () {
    it("Should receive ETH correctly", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await expect(() => 
        owner.sendTransaction({
          to: treasury.address,
          value: amount,
        })
      ).to.changeEtherBalance(treasury, amount);
      
      expect(await treasury.getETHBalance()).to.equal(amount);
    });
    
    it("Should receive tokens correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(treasury.connect(user1).receiveTokens(mockToken.address, amount))
        .to.emit(treasury, "FundsReceived")
        .withArgs(mockToken.address, user1.address, amount);
      
      expect(await treasury.getTokenBalance(mockToken.address)).to.equal(amount);
    });
    
    it("Should reject token transfers with zero amount", async function () {
      await expect(treasury.connect(user1).receiveTokens(mockToken.address, 0))
        .to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should reject token transfers with zero address", async function () {
      await expect(treasury.connect(user1).receiveTokens(ethers.constants.AddressZero, 100))
        .to.be.revertedWith("Token address cannot be zero");
    });
  });
  
  describe("Withdrawing Funds", function () {
    beforeEach(async function () {
      // Send ETH to treasury
      await owner.sendTransaction({
        to: treasury.address,
        value: ethers.utils.parseEther("10.0"),
      });
      
      // Send tokens to treasury
      await treasury.connect(user1).receiveTokens(mockToken.address, ethers.utils.parseEther("1000"));
    });
    
    it("Should allow withdrawal role to withdraw ETH", async function () {
      const amount = ethers.utils.parseEther("1.0");
      const reason = "Test withdrawal";
      
      await expect(treasury.connect(withdrawalRole).withdrawETH(user2.address, amount, reason))
        .to.emit(treasury, "FundsWithdrawn")
        .withArgs(ethers.constants.AddressZero, user2.address, amount, reason);
      
      const expectedBalance = ethers.utils.parseEther("10.0").sub(amount);
      expect(await treasury.getETHBalance()).to.equal(expectedBalance);
    });
    
    it("Should allow withdrawal role to withdraw tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      const reason = "Test token withdrawal";
      
      await expect(treasury.connect(withdrawalRole).withdrawTokens(mockToken.address, user2.address, amount, reason))
        .to.emit(treasury, "FundsWithdrawn")
        .withArgs(mockToken.address, user2.address, amount, reason);
      
      const expectedBalance = ethers.utils.parseEther("1000").sub(amount);
      expect(await treasury.getTokenBalance(mockToken.address)).to.equal(expectedBalance);
      expect(await mockToken.balanceOf(user2.address)).to.equal(amount);
    });
    
    it("Should reject ETH withdrawals from non-withdrawal role", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await expect(treasury.connect(user1).withdrawETH(user2.address, amount, "Unauthorized"))
        .to.be.reverted;
    });
    
    it("Should reject token withdrawals from non-withdrawal role", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(treasury.connect(user1).withdrawTokens(mockToken.address, user2.address, amount, "Unauthorized"))
        .to.be.reverted;
    });
    
    it("Should reject ETH withdrawals with zero amount", async function () {
      await expect(treasury.connect(withdrawalRole).withdrawETH(user2.address, 0, "Zero amount"))
        .to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should reject token withdrawals with zero amount", async function () {
      await expect(treasury.connect(withdrawalRole).withdrawTokens(mockToken.address, user2.address, 0, "Zero amount"))
        .to.be.revertedWith("Amount must be greater than zero");
    });
    
    it("Should reject ETH withdrawals to zero address", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await expect(treasury.connect(withdrawalRole).withdrawETH(ethers.constants.AddressZero, amount, "Zero address"))
        .to.be.revertedWith("Receiver address cannot be zero");
    });
    
    it("Should reject token withdrawals to zero address", async function () {
      const amount = ethers.utils.parseEther("100");
      
      await expect(treasury.connect(withdrawalRole).withdrawTokens(mockToken.address, ethers.constants.AddressZero, amount, "Zero address"))
        .to.be.revertedWith("Receiver address cannot be zero");
    });
    
    it("Should reject ETH withdrawals exceeding balance", async function () {
      const tooMuch = ethers.utils.parseEther("11.0"); // Treasury has only 10 ETH
      
      await expect(treasury.connect(withdrawalRole).withdrawETH(user2.address, tooMuch, "Too much"))
        .to.be.revertedWith("Insufficient balance");
    });
  });
  
  describe("Pause / Unpause", function () {
    beforeEach(async function () {
      // Send ETH to treasury
      await owner.sendTransaction({
        to: treasury.address,
        value: ethers.utils.parseEther("10.0"),
      });
      
      // Send tokens to treasury
      await treasury.connect(user1).receiveTokens(mockToken.address, ethers.utils.parseEther("1000"));
    });
    
    it("Should allow treasury admin to pause and unpause", async function () {
      await treasury.pause();
      expect(await treasury.paused()).to.equal(true);
      
      await treasury.unpause();
      expect(await treasury.paused()).to.equal(false);
    });
    
    it("Should reject withdrawals when paused", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await treasury.pause();
      
      await expect(treasury.connect(withdrawalRole).withdrawETH(user2.address, amount, "Paused"))
        .to.be.reverted;
      
      await expect(treasury.connect(withdrawalRole).withdrawTokens(mockToken.address, user2.address, amount, "Paused"))
        .to.be.reverted;
    });
    
    it("Should allow withdrawals after unpausing", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await treasury.pause();
      await treasury.unpause();
      
      await expect(treasury.connect(withdrawalRole).withdrawETH(user2.address, amount, "Unpaused"))
        .to.not.be.reverted;
    });
    
    it("Should reject pause/unpause from non-treasury admin", async function () {
      await expect(treasury.connect(user1).pause())
        .to.be.reverted;
      
      await treasury.pause();
      
      await expect(treasury.connect(user1).unpause())
        .to.be.reverted;
    });
  });
  
  describe("Role Management", function () {
    it("Should allow admin to add Protocol DAO role", async function () {
      await treasury.addProtocolDAORole(user1.address);
      expect(await treasury.hasRole(PROTOCOL_DAO_ROLE, user1.address)).to.equal(true);
    });
    
    it("Should allow admin to remove Protocol DAO role", async function () {
      await treasury.addProtocolDAORole(user1.address);
      await treasury.removeProtocolDAORole(user1.address);
      expect(await treasury.hasRole(PROTOCOL_DAO_ROLE, user1.address)).to.equal(false);
    });
    
    it("Should allow admin to add Withdrawal role", async function () {
      await treasury.addWithdrawalRole(user2.address);
      expect(await treasury.hasRole(WITHDRAWAL_ROLE, user2.address)).to.equal(true);
    });
    
    it("Should allow admin to remove Withdrawal role", async function () {
      await treasury.addWithdrawalRole(user2.address);
      await treasury.removeWithdrawalRole(user2.address);
      expect(await treasury.hasRole(WITHDRAWAL_ROLE, user2.address)).to.equal(false);
    });
    
    it("Should reject role management from non-admin", async function () {
      await expect(treasury.connect(user1).addProtocolDAORole(user2.address))
        .to.be.reverted;
      
      await expect(treasury.connect(user1).removeProtocolDAORole(owner.address))
        .to.be.reverted;
      
      await expect(treasury.connect(user1).addWithdrawalRole(user2.address))
        .to.be.reverted;
      
      await expect(treasury.connect(user1).removeWithdrawalRole(withdrawalRole.address))
        .to.be.reverted;
    });
  });
});