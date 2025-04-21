const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fee System", function () {
  let feeCalculator;
  let feeProcessor;
  let treasury;
  let mockToken;
  let admin;
  let feeManager;
  let user;
  let developersMultisig;
  let nodeOperatorsPool;

  // Constants
  const ZERO_ADDRESS = ethers.constants.AddressZero;
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const FEE_MANAGER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_MANAGER_ROLE"));
  const AUTHORIZED_CONTRACT_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUTHORIZED_CONTRACT_ROLE"));
  const FEE_PROCESSOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FEE_PROCESSOR_ROLE"));
  const ALLOCATOR_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ALLOCATOR_ROLE"));

  beforeEach(async function () {
    [admin, feeManager, user, developersMultisig, nodeOperatorsPool] = await ethers.getSigners();

    // Deploy MockToken for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    await mockToken.deployed();

    // Mint tokens to user for testing
    await mockToken.mint(user.address, ethers.utils.parseEther("10000"));

    // Deploy FeeCalculator
    const FeeCalculator = await ethers.getContractFactory("FeeCalculator");
    feeCalculator = await FeeCalculator.deploy();
    await feeCalculator.deployed();

    // Grant FEE_MANAGER_ROLE to feeManager
    await feeCalculator.grantRole(FEE_MANAGER_ROLE, feeManager.address);

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy(admin.address, admin.address);
    await treasury.deployed();

    // Grant ALLOCATOR_ROLE to admin
    await treasury.grantRole(ALLOCATOR_ROLE, admin.address);

    // Deploy FeeProcessor
    const FeeProcessor = await ethers.getContractFactory("FeeProcessor");
    feeProcessor = await FeeProcessor.deploy(
      feeCalculator.address,
      treasury.address,
      developersMultisig.address,
      nodeOperatorsPool.address
    );
    await feeProcessor.deployed();

    // Grant AUTHORIZED_CONTRACT_ROLE to admin for testing
    await feeProcessor.grantRole(AUTHORIZED_CONTRACT_ROLE, admin.address);

    // Grant FEE_PROCESSOR_ROLE to feeProcessor in Treasury
    await treasury.grantRole(FEE_PROCESSOR_ROLE, feeProcessor.address);

    // Set supported token in FeeProcessor
    await feeProcessor.setSupportedToken(mockToken.address, true);
  });

  describe("FeeCalculator", function () {
    it("Should initialize with default fees", async function () {
      // Check default investment fee
      const investmentFee = await feeCalculator.getFeeConfig(0); // FeeType.Investment
      expect(investmentFee.baseFee).to.equal(30); // 0.3%
      expect(investmentFee.isActive).to.be.true;

      // Check default divestment fee
      const divestmentFee = await feeCalculator.getFeeConfig(1); // FeeType.Divestment
      expect(divestmentFee.baseFee).to.equal(50); // 0.5%
      expect(divestmentFee.isActive).to.be.true;
    });

    it("Should update fees correctly", async function () {
      // Update investment fee
      await feeCalculator.connect(feeManager).setFee(
        0, // FeeType.Investment
        40, // 0.4%
        ethers.utils.parseEther("1"), // min fee
        ethers.utils.parseEther("500"), // max fee
        true // active
      );

      const updatedFee = await feeCalculator.getFeeConfig(0);
      expect(updatedFee.baseFee).to.equal(40);
      expect(updatedFee.minFee).to.equal(ethers.utils.parseEther("1"));
      expect(updatedFee.maxFee).to.equal(ethers.utils.parseEther("500"));
    });

    it("Should set tiered fees correctly", async function () {
      // Set tiered fee for investments
      await feeCalculator.connect(feeManager).setTieredFee(
        0, // FeeType.Investment
        ethers.utils.parseEther("10000"), // threshold
        20 // 0.2% for amounts above threshold
      );

      const updatedFee = await feeCalculator.getFeeConfig(0);
      expect(updatedFee.tieredThreshold).to.equal(ethers.utils.parseEther("10000"));
      expect(updatedFee.tieredRate).to.equal(20);
    });

    it("Should calculate investment fee correctly", async function () {
      // Standard fee calculation (0.3%)
      const amount = ethers.utils.parseEther("1000");
      const expectedFee = amount.mul(30).div(10000); // 0.3% of 1000 = 3 tokens
      
      const calculatedFee = await feeCalculator.calculateInvestmentFee(amount);
      expect(calculatedFee).to.equal(expectedFee);
    });

    it("Should calculate tiered fee correctly", async function () {
      // Set tiered fee
      await feeCalculator.connect(feeManager).setTieredFee(
        0, // FeeType.Investment
        ethers.utils.parseEther("500"), // threshold
        50 // 0.5% for amounts above threshold
      );

      // Calculate fee for 1000 tokens (500 at base rate, 500 at tiered rate)
      const amount = ethers.utils.parseEther("1000");
      
      // Base fee: 500 * 0.3% = 1.5 tokens
      // Tiered fee: 500 * 0.5% = 2.5 tokens
      // Total: 4 tokens
      const expectedBaseFee = ethers.utils.parseEther("500").mul(30).div(10000);
      const expectedTieredFee = ethers.utils.parseEther("500").mul(50).div(10000);
      const expectedTotalFee = expectedBaseFee.add(expectedTieredFee);
      
      const calculatedFee = await feeCalculator.calculateInvestmentFee(amount);
      expect(calculatedFee).to.equal(expectedTotalFee);
    });

    it("Should respect minimum and maximum fee limits", async function () {
      // Set fee with min and max
      await feeCalculator.connect(feeManager).setFee(
        0, // FeeType.Investment
        30, // 0.3%
        ethers.utils.parseEther("5"), // min fee
        ethers.utils.parseEther("10"), // max fee
        true // active
      );

      // Test minimum fee (amount too small to reach min fee)
      const smallAmount = ethers.utils.parseEther("100"); // 0.3% = 0.3 tokens, below min
      expect(await feeCalculator.calculateInvestmentFee(smallAmount)).to.equal(ethers.utils.parseEther("5"));

      // Test maximum fee (amount large enough to exceed max fee)
      const largeAmount = ethers.utils.parseEther("10000"); // 0.3% = 30 tokens, above max
      expect(await feeCalculator.calculateInvestmentFee(largeAmount)).to.equal(ethers.utils.parseEther("10"));
    });

    it("Should calculate management fee based on period", async function () {
      const amount = ethers.utils.parseEther("1000");
      const periodInDays = 30; // 30 days
      
      // Annual fee: 1000 * 2% = 20 tokens
      // 30-day fee: 20 * (30/365) = ~1.64 tokens
      const annualFee = amount.mul(200).div(10000); // 2%
      const expectedFee = annualFee.mul(periodInDays).div(365);
      
      const calculatedFee = await feeCalculator.calculateManagementFee(amount, periodInDays);
      expect(calculatedFee).to.equal(expectedFee);
    });

    it("Should calculate performance fee correctly", async function () {
      // Set performance fee to active
      await feeCalculator.connect(feeManager).setFee(
        4, // FeeType.Performance
        2000, // 20%
        0, // no min
        0, // no max
        true // active
      );

      const profitAmount = ethers.utils.parseEther("500");
      const expectedFee = profitAmount.mul(2000).div(10000); // 20% of 500 = 100 tokens
      
      const calculatedFee = await feeCalculator.calculatePerformanceFee(profitAmount);
      expect(calculatedFee).to.equal(expectedFee);
    });
  });

  describe("FeeProcessor", function () {
    beforeEach(async function () {
      // Transfer tokens to FeeProcessor for testing
      await mockToken.connect(user).transfer(feeProcessor.address, ethers.utils.parseEther("100"));
    });

    it("Should initialize with correct parameters", async function () {
      expect(await feeProcessor.feeCalculator()).to.equal(feeCalculator.address);
      expect(await feeProcessor.treasury()).to.equal(treasury.address);
      expect(await feeProcessor.developersMultisig()).to.equal(developersMultisig.address);
      expect(await feeProcessor.nodeOperatorsPool()).to.equal(nodeOperatorsPool.address);
      
      // Check default fee distribution
      const feeDistribution = await feeProcessor.getFeeDistribution();
      expect(feeDistribution.treasuryShare).to.equal(7000); // 70%
      expect(feeDistribution.developersShare).to.equal(2000); // 20%
      expect(feeDistribution.nodeOperatorsShare).to.equal(1000); // 10%
    });

    it("Should process fees correctly", async function () {
      await feeProcessor.processFee(mockToken.address, ethers.utils.parseEther("50"));
      
      expect(await feeProcessor.collectedFees(mockToken.address)).to.equal(ethers.utils.parseEther("50"));
    });

    it("Should distribute fees according to distribution percentages", async function () {
      // Process fees
      await feeProcessor.processFee(mockToken.address, ethers.utils.parseEther("100"));
      
      // Check initial balances
      expect(await mockToken.balanceOf(treasury.address)).to.equal(0);
      expect(await mockToken.balanceOf(developersMultisig.address)).to.equal(0);
      expect(await mockToken.balanceOf(nodeOperatorsPool.address)).to.equal(0);
      
      // Distribute fees
      await feeProcessor.distributeFees(mockToken.address);
      
      // Check distributed amounts
      // 70% to treasury = 70 tokens
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("70"));
      
      // 20% to developers = 20 tokens
      expect(await mockToken.balanceOf(developersMultisig.address)).to.equal(ethers.utils.parseEther("20"));
      
      // 10% to node operators = 10 tokens
      expect(await mockToken.balanceOf(nodeOperatorsPool.address)).to.equal(ethers.utils.parseEther("10"));
      
      // Check that collected fees are reset
      expect(await feeProcessor.collectedFees(mockToken.address)).to.equal(0);
    });

    it("Should update fee distribution", async function () {
      await feeProcessor.connect(feeManager).updateFeeDistribution(
        6000, // 60% treasury
        3000, // 30% developers
        1000  // 10% node operators
      );
      
      const updatedDistribution = await feeProcessor.getFeeDistribution();
      expect(updatedDistribution.treasuryShare).to.equal(6000);
      expect(updatedDistribution.developersShare).to.equal(3000);
      expect(updatedDistribution.nodeOperatorsShare).to.equal(1000);
    });

    it("Should reject invalid fee distribution", async function () {
      await expect(
        feeProcessor.connect(feeManager).updateFeeDistribution(
          6000, // 60% treasury
          3000, // 30% developers
          2000  // 20% node operators (total 110%)
        )
      ).to.be.revertedWith("Invalid distribution");
    });

    it("Should calculate investment and divestment fees", async function () {
      const amount = ethers.utils.parseEther("1000");
      
      // Investment fee should be 0.3% (from FeeCalculator)
      const expectedInvestmentFee = amount.mul(30).div(10000);
      expect(await feeProcessor.calculateInvestmentFee(amount)).to.equal(expectedInvestmentFee);
      
      // Divestment fee should be 0.5% (from FeeCalculator)
      const expectedDivestmentFee = amount.mul(50).div(10000);
      expect(await feeProcessor.calculateDivestmentFee(amount)).to.equal(expectedDivestmentFee);
    });

    it("Should update configuration addresses", async function () {
      // Deploy new calculator
      const newCalculator = await ethers.getContractFactory("FeeCalculator").then(f => f.deploy());
      await newCalculator.deployed();
      
      // Deploy new treasury
      const newTreasury = await ethers.getContractFactory("Treasury").then(f => 
        f.deploy(admin.address, admin.address)
      );
      await newTreasury.deployed();
      
      // Update configuration
      await feeProcessor.connect(admin).setFeeCalculator(newCalculator.address);
      await feeProcessor.connect(admin).setTreasury(newTreasury.address);
      await feeProcessor.connect(admin).setDevelopersMultisig(user.address);
      await feeProcessor.connect(admin).setNodeOperatorsPool(user.address);
      
      expect(await feeProcessor.feeCalculator()).to.equal(newCalculator.address);
      expect(await feeProcessor.treasury()).to.equal(newTreasury.address);
      expect(await feeProcessor.developersMultisig()).to.equal(user.address);
      expect(await feeProcessor.nodeOperatorsPool()).to.equal(user.address);
    });
  });

  describe("Treasury", function () {
    beforeEach(async function () {
      // Transfer tokens to Treasury for testing
      await mockToken.connect(user).transfer(treasury.address, ethers.utils.parseEther("1000"));
      
      // Record the funds in the treasury
      await treasury.connect(admin).receiveFunds(mockToken.address, ethers.utils.parseEther("1000"));
    });

    it("Should track token balances correctly", async function () {
      expect(await treasury.getBalance(mockToken.address)).to.equal(ethers.utils.parseEther("1000"));
    });

    it("Should allow allocating funds", async function () {
      await treasury.connect(admin).allocateFunds(
        mockToken.address,
        ethers.utils.parseEther("200"),
        user.address,
        0, // AllocationPurpose.Development
        "Funding development team"
      );
      
      // Check updated balance
      expect(await treasury.getBalance(mockToken.address)).to.equal(ethers.utils.parseEther("800"));
      
      // Check allocation record
      const allocation = await treasury.getAllocation(0);
      expect(allocation.token).to.equal(mockToken.address);
      expect(allocation.amount).to.equal(ethers.utils.parseEther("200"));
      expect(allocation.recipient).to.equal(user.address);
      expect(allocation.purpose).to.equal(0); // Development
      expect(allocation.description).to.equal("Funding development team");
      expect(allocation.allocator).to.equal(admin.address);
      
      // Check user received the funds
      expect(await mockToken.balanceOf(user.address)).to.equal(ethers.utils.parseEther("9900")); // 10000 - 1000 + 200 + 700
    });

    it("Should respect allocation limits", async function () {
      // Set lower allocation limit
      await treasury.connect(admin).updateAllocationLimit(ethers.utils.parseEther("100"));
      
      // Try to allocate more than the limit
      await expect(
        treasury.connect(admin).allocateFunds(
          mockToken.address,
          ethers.utils.parseEther("150"),
          user.address,
          0,
          "Exceeds limit"
        )
      ).to.be.revertedWith("Exceeds allocation limit");
    });

    it("Should respect daily allocation limits", async function () {
      // Set lower daily allocation limit
      await treasury.connect(admin).updateDailyAllocationLimit(ethers.utils.parseEther("300"));
      
      // Allocate up to the limit
      await treasury.connect(admin).allocateFunds(
        mockToken.address,
        ethers.utils.parseEther("200"),
        user.address,
        0,
        "First allocation"
      );
      
      await treasury.connect(admin).allocateFunds(
        mockToken.address,
        ethers.utils.parseEther("100"),
        user.address,
        0,
        "Second allocation"
      );
      
      // Try to allocate more than the daily limit
      await expect(
        treasury.connect(admin).allocateFunds(
          mockToken.address,
          ethers.utils.parseEther("1"),
          user.address,
          0,
          "Exceeds daily limit"
        )
      ).to.be.revertedWith("Exceeds daily limit");
    });

    it("Should only allow allocators to allocate funds", async function () {
      await expect(
        treasury.connect(user).allocateFunds(
          mockToken.address,
          ethers.utils.parseEther("100"),
          user.address,
          0,
          "Unauthorized"
        )
      ).to.be.reverted; // Access control error
      
      // Add user as allocator
      await treasury.connect(admin).addAllocator(user.address);
      
      // Now should work
      await treasury.connect(user).allocateFunds(
        mockToken.address,
        ethers.utils.parseEther("100"),
        user.address,
        0,
        "Authorized now"
      );
    });

    it("Should handle ETH allocations", async function () {
      // Send ETH to treasury
      await admin.sendTransaction({
        to: treasury.address,
        value: ethers.utils.parseEther("10")
      });
      
      // Record the ETH
      await treasury.connect(admin).receiveFunds(ZERO_ADDRESS, ethers.utils.parseEther("10"));
      
      // Check ETH balance
      expect(await treasury.getBalance(ZERO_ADDRESS)).to.equal(ethers.utils.parseEther("10"));
      
      // Get user's initial ETH balance
      const initialBalance = await ethers.provider.getBalance(user.address);
      
      // Allocate ETH
      await treasury.connect(admin).allocateFunds(
        ZERO_ADDRESS,
        ethers.utils.parseEther("5"),
        user.address,
        0,
        "ETH allocation"
      );
      
      // Check updated treasury balance
      expect(await treasury.getBalance(ZERO_ADDRESS)).to.equal(ethers.utils.parseEther("5"));
      
      // Check user received the ETH (roughly, due to gas costs)
      const finalBalance = await ethers.provider.getBalance(user.address);
      expect(finalBalance.sub(initialBalance)).to.be.closeTo(
        ethers.utils.parseEther("5"),
        ethers.utils.parseEther("0.01") // Allow small difference for gas
      );
    });
  });

  describe("Integrated Fee System", function () {
    it("Should process and distribute fees end-to-end", async function () {
      // 1. Set up token approvals
      await mockToken.connect(user).approve(feeProcessor.address, ethers.utils.parseEther("100"));
      
      // 2. User pays a fee
      await feeProcessor.connect(admin).processFee(mockToken.address, ethers.utils.parseEther("100"));
      
      // 3. Check collected fees
      expect(await feeProcessor.collectedFees(mockToken.address)).to.equal(ethers.utils.parseEther("100"));
      
      // 4. Distribute fees
      await feeProcessor.distributeFees(mockToken.address);
      
      // 5. Check Treasury received its share
      expect(await mockToken.balanceOf(treasury.address)).to.equal(ethers.utils.parseEther("70"));
      
      // 6. Treasury allocates funds
      await treasury.connect(admin).allocateFunds(
        mockToken.address,
        ethers.utils.parseEther("20"),
        user.address,
        2, // Operations
        "Operations funding"
      );
      
      // 7. Check Treasury balance updated
      expect(await treasury.getBalance(mockToken.address)).to.equal(ethers.utils.parseEther("50"));
      
      // 8. Check allocation record
      const allocation = await treasury.getAllocation(0);
      expect(allocation.amount).to.equal(ethers.utils.parseEther("20"));
      expect(allocation.purpose).to.equal(2); // Operations
    });

    it("Should integrate with FeeCalculator for fee calculations", async function () {
      // 1. Update fee calculation parameters
      await feeCalculator.connect(feeManager).setFee(
        0, // FeeType.Investment
        100, // 1%
        0, // no min
        0, // no max
        true // active
      );
      
      // 2. Calculate fee through FeeProcessor
      const investAmount = ethers.utils.parseEther("500");
      const expectedFee = investAmount.mul(100).div(10000); // 1% = 5 tokens
      
      expect(await feeProcessor.calculateInvestmentFee(investAmount)).to.equal(expectedFee);
      
      // 3. Change fee calculator
      const newCalculator = await ethers.getContractFactory("FeeCalculator").then(f => f.deploy());
      await newCalculator.deployed();
      
      // 4. Set new fee calculator
      await feeProcessor.connect(admin).setFeeCalculator(newCalculator.address);
      
      // 5. New calculator should have different default fees
      expect(await feeProcessor.calculateInvestmentFee(investAmount)).to.equal(
        investAmount.mul(30).div(10000) // 0.3% = 1.5 tokens (default)
      );
    });
  });
});
