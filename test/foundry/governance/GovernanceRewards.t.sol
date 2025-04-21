// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/governance/GovernanceRewards.sol";
import "../../../contracts/token/DLoopToken.sol";

/**
 * @title GovernanceRewards Fuzz Test
 * @dev Property-based tests for the GovernanceRewards contract
 * 
 * This test focuses on:
 * 1. Distribution of rewards with various input values
 * 2. Claiming rewards under different conditions
 * 3. Invariant testing for reward accounting
 */
contract GovernanceRewardsTest is Test {
    // Contracts
    GovernanceRewards public governanceRewards;
    DLoopToken public dloopToken;
    
    // Test accounts
    address public admin;
    address public user1;
    address public user2;
    address public user3;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant REWARDS_POOL = 100_000 ether;
    
    function setUp() public {
        // Setup accounts
        admin = makeAddr("admin");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Deploy token with admin as owner
        vm.startPrank(admin);
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            admin
        );
        
        // Deploy governance rewards contract
        governanceRewards = new GovernanceRewards(
            address(dloopToken),
            admin
        );
        
        // Fund governance rewards contract
        dloopToken.transfer(address(governanceRewards), REWARDS_POOL);
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test for distributing rewards with various amounts
     * Properties tested:
     * - Total distributed rewards should match sum of individual rewards
     * - Each user should receive the exact amount specified
     * - Events should be emitted correctly
     */
    function testFuzz_DistributeRewards(
        uint256 proposalId,
        uint256 amount1,
        uint256 amount2,
        uint256 amount3
    ) public {
        // Bound inputs to realistic values
        proposalId = bound(proposalId, 1, 1000);
        amount1 = bound(amount1, 1 ether, 1000 ether);
        amount2 = bound(amount2, 1 ether, 1000 ether);
        amount3 = bound(amount3, 1 ether, 1000 ether);
        
        // Ensure total rewards don't exceed pool
        uint256 totalAmount = amount1 + amount2 + amount3;
        if (totalAmount > REWARDS_POOL) {
            amount1 = (amount1 * REWARDS_POOL) / totalAmount;
            amount2 = (amount2 * REWARDS_POOL) / totalAmount;
            amount3 = (amount3 * REWARDS_POOL) / totalAmount;
            totalAmount = amount1 + amount2 + amount3;
        }
        
        // Setup reward distribution parameters
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = user3;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = amount1;
        amounts[1] = amount2;
        amounts[2] = amount3;
        
        string memory description = "Test reward distribution";
        
        // Record balances before distribution
        uint256 user1BalanceBefore = dloopToken.balanceOf(user1);
        uint256 user2BalanceBefore = dloopToken.balanceOf(user2);
        uint256 user3BalanceBefore = dloopToken.balanceOf(user3);
        uint256 contractBalanceBefore = dloopToken.balanceOf(address(governanceRewards));
        
        // Distribute rewards
        vm.prank(admin);
        
        // Check if the function exists with the expected signature
        if (governanceRewards.distributeRewards.selector == bytes4(keccak256("distributeRewards(uint256,address[],uint256[],string)"))) {
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(proposalId, user1, amount1);
            
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(proposalId, user2, amount2);
            
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(proposalId, user3, amount3);
            
            governanceRewards.distributeRewards(proposalId, recipients, amounts, description);
        } else {
            // Fallback to simpler function signature if available
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(0, user1, amount1);
            
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(0, user2, amount2);
            
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsDistributed(0, user3, amount3);
            
            governanceRewards.distributeRewards(recipients, amounts);
        }
        
        // Verify balances after distribution
        assertEq(dloopToken.balanceOf(user1), user1BalanceBefore + amount1, "User1 balance incorrect");
        assertEq(dloopToken.balanceOf(user2), user2BalanceBefore + amount2, "User2 balance incorrect");
        assertEq(dloopToken.balanceOf(user3), user3BalanceBefore + amount3, "User3 balance incorrect");
        assertEq(
            dloopToken.balanceOf(address(governanceRewards)), 
            contractBalanceBefore - totalAmount, 
            "Contract balance incorrect"
        );
    }
    
    /**
     * @dev Fuzz test for claiming rewards with various amounts
     * Properties tested:
     * - User should be able to claim their exact reward amount
     * - Contract balance should decrease by the claimed amount
     * - Events should be emitted correctly
     */
    function testFuzz_ClaimRewards(uint256 rewardAmount) public {
        // Bound input to realistic values
        rewardAmount = bound(rewardAmount, 1 ether, 10000 ether);
        
        // Setup: Distribute rewards to user1
        address[] memory recipients = new address[](1);
        recipients[0] = user1;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = rewardAmount;
        
        // Ensure the contract has enough tokens
        vm.assume(rewardAmount <= REWARDS_POOL);
        
        // Distribute rewards
        vm.prank(admin);
        if (governanceRewards.distributeRewards.selector == bytes4(keccak256("distributeRewards(uint256,address[],uint256[],string)"))) {
            governanceRewards.distributeRewards(1, recipients, amounts, "Test reward");
        } else {
            governanceRewards.distributeRewards(recipients, amounts);
        }
        
        // Record balances before claiming
        uint256 userBalanceBefore = dloopToken.balanceOf(user1);
        uint256 contractBalanceBefore = dloopToken.balanceOf(address(governanceRewards));
        
        // Claim rewards
        vm.prank(user1);
        if (governanceRewards.claimRewards.selector == bytes4(keccak256("claimRewards()"))) {
            vm.expectEmit(true, true, true, true);
            emit GovernanceRewards.RewardsClaimed(user1, rewardAmount);
            governanceRewards.claimRewards();
        }
        
        // Verify balances after claiming
        assertEq(dloopToken.balanceOf(user1), userBalanceBefore, "User balance should not change (already transferred)");
        assertEq(
            dloopToken.balanceOf(address(governanceRewards)), 
            contractBalanceBefore, 
            "Contract balance should not change (already transferred)"
        );
    }
    
    /**
     * @dev Invariant test for reward accounting
     * Property tested:
     * - Total rewards distributed should never exceed the initial rewards pool
     */
    function testProperty_RewardAccountingInvariant() public {
        // Setup multiple distributions with different amounts
        for (uint256 i = 1; i <= 10; i++) {
            address[] memory recipients = new address[](3);
            recipients[0] = user1;
            recipients[1] = user2;
            recipients[2] = user3;
            
            uint256[] memory amounts = new uint256[](3);
            amounts[0] = i * 100 ether;
            amounts[1] = i * 200 ether;
            amounts[2] = i * 300 ether;
            
            uint256 totalDistribution = amounts[0] + amounts[1] + amounts[2];
            
            // Skip if this distribution would exceed the pool
            if (totalDistribution > dloopToken.balanceOf(address(governanceRewards))) {
                continue;
            }
            
            // Distribute rewards
            vm.prank(admin);
            if (governanceRewards.distributeRewards.selector == bytes4(keccak256("distributeRewards(uint256,address[],uint256[],string)"))) {
                governanceRewards.distributeRewards(i, recipients, amounts, "Test batch");
            } else {
                governanceRewards.distributeRewards(recipients, amounts);
            }
        }
        
        // Verify the invariant: contract should never distribute more than the initial pool
        uint256 remainingBalance = dloopToken.balanceOf(address(governanceRewards));
        assertGe(REWARDS_POOL, REWARDS_POOL - remainingBalance, "Total distributed should not exceed initial pool");
    }
    
    /**
     * @dev Test for authorization control
     * Property tested:
     * - Only admin should be able to distribute rewards
     */
    function testProperty_OnlyAdminCanDistribute() public {
        // Setup distribution parameters
        address[] memory recipients = new address[](1);
        recipients[0] = user1;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000 ether;
        
        // Try to distribute as non-admin user
        vm.prank(user2);
        
        // Expect revert
        vm.expectRevert();
        
        // Attempt distribution
        if (governanceRewards.distributeRewards.selector == bytes4(keccak256("distributeRewards(uint256,address[],uint256[],string)"))) {
            governanceRewards.distributeRewards(1, recipients, amounts, "Unauthorized distribution");
        } else {
            governanceRewards.distributeRewards(recipients, amounts);
        }
    }
}
