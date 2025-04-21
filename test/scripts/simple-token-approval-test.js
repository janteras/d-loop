/**
 * @title Simple Token Approval Optimizer Test
 * @dev Basic test of the TokenApprovalOptimizer without complex mocks
 */
// Use hardhat's ethers
const hre = require("hardhat");
const ethers = hre.ethers;

// Set up the test environment
const { expect } = require("chai");

describe("TokenApprovalOptimizer Basic Test", function() {
    let owner, user1, user2;
    let optimizer, mockToken;
    
    before(async function() {
        [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy the mock ERC20 token
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
        await mockToken.mint(owner.address, ethers.parseUnits("1000000", 18));
        
        // Deploy the TokenApprovalOptimizer
        const TokenApprovalOptimizer = await ethers.getContractFactory("contracts/utils/TokenApprovalOptimizer.sol:TokenApprovalOptimizer");
        optimizer = await TokenApprovalOptimizer.deploy();
        
        // Transfer some tokens to test accounts
        await mockToken.transfer(user1.address, ethers.parseUnits("10000", 18));
    });
    
    describe("Basic Approval Functions", function() {
        it("should successfully optimize approvals", async function() {
            // Connect as user1 to test approvals
            const userToken = mockToken.connect(user1);
            const userOptimizer = optimizer.connect(user1);
            
            // Approve the optimizer to use tokens (needed for test)
            await userToken.approve(optimizer.address, ethers.parseUnits("5000", 18));
            
            // Use the optimizer to approve spending to user2
            await userOptimizer.optimizeApproval(
                mockToken.address,
                user2.address,
                ethers.parseUnits("1000", 18)
            );
            
            // Check the allowance
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(ethers.parseUnits("1000", 18));
        });
        
        it("should avoid redundant approvals", async function() {
            // Connect as user1
            const userOptimizer = optimizer.connect(user1);
            
            // Execute the same approval again
            await userOptimizer.optimizeApproval(
                mockToken.address,
                user2.address,
                ethers.parseUnits("1000", 18)
            );
            
            // Allowance should still be the same
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(ethers.parseUnits("1000", 18));
        });
        
        it("should safely increase allowance", async function() {
            // Connect as user1
            const userOptimizer = optimizer.connect(user1);
            
            // Increase the allowance
            await userOptimizer.safeIncreaseAllowance(
                mockToken.address,
                user2.address,
                ethers.parseUnits("500", 18)
            );
            
            // Check the increased allowance
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(ethers.parseUnits("1500", 18));
        });
        
        it("should safely decrease allowance", async function() {
            // Connect as user1
            const userOptimizer = optimizer.connect(user1);
            
            // Decrease the allowance
            await userOptimizer.safeDecreaseAllowance(
                mockToken.address,
                user2.address,
                ethers.parseUnits("300", 18)
            );
            
            // Check the decreased allowance
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(ethers.parseUnits("1200", 18));
        });
    });
    
    describe("Advanced Approval Features", function() {
        it("should support batch approvals", async function() {
            // Deploy additional tokens for the batch test
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const token2 = await MockERC20.deploy("Test Token 2", "TEST2", 18);
            const token3 = await MockERC20.deploy("Test Token 3", "TEST3", 18);
            
            // Mint and transfer tokens
            await token2.mint(owner.address, ethers.parseUnits("1000000", 18));
            await token3.mint(owner.address, ethers.parseUnits("1000000", 18));
            await token2.transfer(user1.address, ethers.parseUnits("10000", 18));
            await token3.transfer(user1.address, ethers.parseUnits("10000", 18));
            
            // Approve the optimizer for all tokens
            await mockToken.connect(user1).approve(optimizer.address, ethers.parseUnits("5000", 18));
            await token2.connect(user1).approve(optimizer.address, ethers.parseUnits("5000", 18));
            await token3.connect(user1).approve(optimizer.address, ethers.parseUnits("5000", 18));
            
            // Set up the batch approval
            const tokens = [mockToken.address, token2.address, token3.address];
            const amounts = [
                ethers.parseUnits("100", 18),
                ethers.parseUnits("200", 18),
                ethers.parseUnits("300", 18)
            ];
            
            // Execute batch approval
            const userOptimizer = optimizer.connect(user1);
            const tx = await userOptimizer.batchApprove(tokens, user2.address, amounts);
            await tx.wait();
            
            // Verify the approvals
            const allowance1 = await mockToken.allowance(user1.address, user2.address);
            const allowance2 = await token2.allowance(user1.address, user2.address);
            const allowance3 = await token3.allowance(user1.address, user2.address);
            
            expect(allowance1).to.equal(ethers.parseUnits("100", 18));
            expect(allowance2).to.equal(ethers.parseUnits("200", 18));
            expect(allowance3).to.equal(ethers.parseUnits("300", 18));
        });
        
        it("should support single transaction approvals", async function() {
            const userOptimizer = optimizer.connect(user1);
            await userOptimizer.singleTransactionApprove(
                mockToken.address,
                user2.address,
                ethers.parseUnits("750", 18)
            );
            
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(ethers.parseUnits("750", 18));
        });
        
        it("should support clearing approvals", async function() {
            const userOptimizer = optimizer.connect(user1);
            await userOptimizer.clearApproval(mockToken.address, user2.address);
            
            const allowance = await mockToken.allowance(user1.address, user2.address);
            expect(allowance).to.equal(0);
        });
    });
});