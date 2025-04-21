/**
 * @title Fee Contracts Token Approval Test
 * @dev Tests the token approval pattern integration in fee-related contracts
 */
const ethers = require('../../utils/ethers-v6-compat');

// Import test helpers
const { computeRoleHash } = require("./helpers/ethers-v6-helpers");

describe("Fee Contracts Token Approval Tests", function() {
    let owner, user1, user2, treasury, rewardDistributor, feeAdmin;
    let feeProcessor, treasuryContract, governanceRewards;
    let mockToken;
    
    const ADMIN_ROLE = computeRoleHash("ADMIN_ROLE");
    const AUTHORIZED_CONTRACT_ROLE = computeRoleHash("AUTHORIZED_CONTRACT_ROLE");
    const DISTRIBUTOR_ROLE = computeRoleHash("DISTRIBUTOR_ROLE");
    
    /**
     * Convert token units to wei
     */
    function toWei(amount) {
        return ethers.parseUnits(amount, 18);
    }
    
    /**
     * Deploy a mock token for testing
     */
    async function deployMockToken() {
        const MockToken = await ethers.getContractFactory("MockERC20");
        const token = await MockToken.deploy("Mock Token", "MOCK", 18);
        await token.mint(owner.address, toWei("1000000"));
        return token;
    }
    
    beforeEach(async function() {
        [owner, user1, user2, treasuryAddress, rewardDistributor, feeAdmin] = await ethers.getSigners();
        
        // Deploy mock token
        mockToken = await deployMockToken();
        
        // Deploy mock fee calculator
        const FeeCalculator = await ethers.getContractFactory("MockFeeCalculator");
        const feeCalculator = await FeeCalculator.deploy();
        
        // Deploy treasury
        const Treasury = await ethers.getContractFactory("contracts/fees/Treasury.sol:Treasury");
        treasuryContract = await Treasury.deploy(feeAdmin.address, owner.address);
        
        // Deploy fee processor
        const FeeProcessor = await ethers.getContractFactory("contracts/fees/FeeProcessor.sol:FeeProcessor");
        feeProcessor = await FeeProcessor.deploy(
            treasuryContract.address,
            rewardDistributor.address,
            feeCalculator.address,
            feeAdmin.address,
            7000, // 70% treasury
            3000  // 30% reward distributor
        );
        
        // Deploy governance rewards
        const GovernanceRewards = await ethers.getContractFactory("contracts/governance/GovernanceRewards.sol:GovernanceRewards");
        governanceRewards = await GovernanceRewards.deploy(mockToken.address, owner.address);
        
        // Grant AUTHORIZED_CONTRACT_ROLE to owner for testing
        await feeProcessor.grantRole(AUTHORIZED_CONTRACT_ROLE, owner.address);
        
        // Send some tokens to contracts for tests
        await mockToken.transfer(feeProcessor.address, toWei("10000"));
        await mockToken.transfer(treasuryContract.address, toWei("10000"));
        await mockToken.transfer(governanceRewards.address, toWei("10000"));
    });
    
    describe("FeeProcessor Token Approval", function() {
        it("should optimize token approvals and save gas", async function() {
            // Initial approval
            const tx1 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei("1000"));
            const receipt1 = await tx1.wait();
            
            // Check if the approval was successful
            const allowance1 = await mockToken.allowance(feeProcessor.address, user1.address);
            expect(allowance1).to.equal(toWei("1000"));
            
            // Look for the TokenApprovalOptimized event
            const events1 = receipt1.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events1.length).to.equal(1);
            
            // Second identical approval should be optimized
            const tx2 = await feeProcessor.allowTokenTransfer(mockToken.address, user1.address, toWei("1000"));
            const receipt2 = await tx2.wait();
            
            // Check if the approval still works
            const allowance2 = await mockToken.allowance(feeProcessor.address, user1.address);
            expect(allowance2).to.equal(toWei("1000"));
            
            // Check the gas savings
            const events2 = receipt2.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events2.length).to.equal(1);
            
            // Gas savings should be reported
            const gasSaved = events2[0].args.gasSaved;
            expect(gasSaved).to.be.gt(0);
        });
        
        it("should support batch approvals", async function() {
            // Deploy additional mock tokens
            const mockToken2 = await deployMockToken();
            const mockToken3 = await deployMockToken();
            
            // Batch approval
            const tokens = [mockToken.address, mockToken2.address, mockToken3.address];
            const amounts = [toWei("100"), toWei("200"), toWei("300")];
            
            const tx = await feeProcessor.batchAllowTokenTransfers(tokens, user2.address, amounts);
            await tx.wait();
            
            // Verify approvals
            const allowance1 = await mockToken.allowance(feeProcessor.address, user2.address);
            const allowance2 = await mockToken2.allowance(feeProcessor.address, user2.address);
            const allowance3 = await mockToken3.allowance(feeProcessor.address, user2.address);
            
            expect(allowance1).to.equal(toWei("100"));
            expect(allowance2).to.equal(toWei("200"));
            expect(allowance3).to.equal(toWei("300"));
        });
    });
    
    describe("Treasury Token Approval", function() {
        it("should optimize token approvals and save gas", async function() {
            // Initial approval
            const tx1 = await treasuryContract.allowTokenTransfer(mockToken.address, user1.address, toWei("500"));
            const receipt1 = await tx1.wait();
            
            // Check if the approval was successful
            const allowance1 = await mockToken.allowance(treasuryContract.address, user1.address);
            expect(allowance1).to.equal(toWei("500"));
            
            // Look for the TokenApprovalOptimized event
            const events1 = receipt1.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events1.length).to.equal(1);
            
            // Second identical approval should be optimized
            const tx2 = await treasuryContract.allowTokenTransfer(mockToken.address, user1.address, toWei("500"));
            const receipt2 = await tx2.wait();
            
            // Check the gas savings
            const events2 = receipt2.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events2.length).to.equal(1);
            
            // Gas savings should be reported
            const gasSaved = events2[0].args.gasSaved;
            expect(gasSaved).to.be.gt(0);
        });
        
        it("should support increaseTokenAllowance and decreaseTokenAllowance", async function() {
            // Initial approval
            await treasuryContract.allowTokenTransfer(mockToken.address, user1.address, toWei("1000"));
            
            // Increase allowance
            await treasuryContract.increaseTokenAllowance(mockToken.address, user1.address, toWei("500"));
            const increasedAllowance = await mockToken.allowance(treasuryContract.address, user1.address);
            expect(increasedAllowance).to.equal(toWei("1500"));
            
            // Decrease allowance
            await treasuryContract.decreaseTokenAllowance(mockToken.address, user1.address, toWei("300"));
            const decreasedAllowance = await mockToken.allowance(treasuryContract.address, user1.address);
            expect(decreasedAllowance).to.equal(toWei("1200"));
        });
    });
    
    describe("GovernanceRewards Token Approval", function() {
        it("should optimize token approvals and save gas", async function() {
            // Initial approval
            const tx1 = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, toWei("2000"));
            const receipt1 = await tx1.wait();
            
            // Check if the approval was successful
            const allowance1 = await mockToken.allowance(governanceRewards.address, user1.address);
            expect(allowance1).to.equal(toWei("2000"));
            
            // Look for the TokenApprovalOptimized event
            const events1 = receipt1.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events1.length).to.equal(1);
            
            // Same approval again should skip the actual approval call
            const tx2 = await governanceRewards.allowTokenTransfer(mockToken.address, user1.address, toWei("2000"));
            const receipt2 = await tx2.wait();
            
            // Check the gas savings
            const events2 = receipt2.logs.filter(log => 
                log.fragment && log.fragment.name === "TokenApprovalOptimized"
            );
            expect(events2.length).to.equal(1);
            
            // Gas savings should be reported
            const gasSaved = events2[0].args.gasSaved;
            expect(gasSaved).to.be.gt(0);
        });
        
        it("should respect role-based access control", async function() {
            // User2 does not have ADMIN_ROLE, should fail
            await expect(
                governanceRewards.connect(user2).allowTokenTransfer(mockToken.address, user1.address, toWei("1000"))
            ).to.be.revertedWith("AccessControl: caller is missing role");
            
            // Grant role to user2
            await governanceRewards.grantRole(ADMIN_ROLE, user2.address);
            
            // Now it should work
            await governanceRewards.connect(user2).allowTokenTransfer(mockToken.address, user1.address, toWei("1000"));
            const allowance = await mockToken.allowance(governanceRewards.address, user1.address);
            expect(allowance).to.equal(toWei("1000"));
        });
    });
    
    describe("Integration with core functionality", function() {
        it("should maintain fee flow functionality with optimized approvals", async function() {
            // Send tokens to owner for testing fee flow
            await mockToken.transfer(owner.address, toWei("1000"));
            
            // Approve FeeProcessor to spend owner's tokens
            await mockToken.approve(feeProcessor.address, toWei("1000"));
            
            // Calculate expected fees
            const investAmount = toWei("100");
            const expectedFee = toWei("10"); // 10% of 100 tokens
            const expectedTreasuryFee = toWei("7"); // 70% of 10 tokens
            const expectedRewardFee = toWei("3"); // 30% of 10 tokens
            
            // Collect invest fee
            await feeProcessor.collectInvestFee(mockToken.address, investAmount);
            
            // Treasury should have received its share
            const treasuryBalance = await mockToken.balanceOf(treasuryContract.address);
            expect(treasuryBalance).to.be.gte(expectedTreasuryFee);
            
            // RewardDistributor should have received its share
            const rewardDistributorBalance = await mockToken.balanceOf(rewardDistributor.address);
            expect(rewardDistributorBalance).to.be.gte(expectedRewardFee);
        });
    });
});

// Mock contracts for testing
const MockERC20 = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev A simple ERC20 token for testing
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
    
    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
`;

// We're using the MockFeeCalculator from contracts/mocks/MockFeeCalculator.sol