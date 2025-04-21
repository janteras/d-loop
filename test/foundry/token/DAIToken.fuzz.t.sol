// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/token/DAIToken.sol";

/**
 * @title D-AI Token Fuzz Tests
 * @dev Property-based tests for the D-AI token to discover edge cases
 * @notice These tests validate token behavior under a wide range of inputs
 */
contract DAITokenFuzzTest is Test {
    DAIToken public daiToken;
    address public owner;
    address public minter;
    address public pauser;
    address public user1;
    address public user2;
    
    // Events to check
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    // Setup for each test
    function setUp() public {
        owner = address(this);
        minter = address(0x1);
        pauser = address(0x2);
        user1 = address(0x3);
        user2 = address(0x4);
        
        // Deploy the token
        daiToken = new DAIToken();
        
        // Setup roles
        daiToken.grantRole(daiToken.MINTER_ROLE(), minter);
        daiToken.grantRole(daiToken.PAUSER_ROLE(), pauser);
        
        // Mint initial tokens to owner
        vm.prank(minter);
        daiToken.mint(owner, 1_000_000 * 10**18);
        
        // Transfer some tokens to users
        daiToken.transfer(user1, 10_000 * 10**18);
        daiToken.transfer(user2, 10_000 * 10**18);
    }
    
    /**
     * @dev Fuzz test for transfer function
     * @param amount Amount to transfer (bounded to avoid overflow)
     */
    function testFuzz_Transfer(uint256 amount) public {
        // Bound the amount to avoid overflow and unrealistic values
        amount = bound(amount, 0, daiToken.balanceOf(user1));
        
        uint256 user1BalanceBefore = daiToken.balanceOf(user1);
        uint256 user2BalanceBefore = daiToken.balanceOf(user2);
        
        // Execute transfer
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Transfer(user1, user2, amount);
        daiToken.transfer(user2, amount);
        
        // Verify balances
        assertEq(daiToken.balanceOf(user1), user1BalanceBefore - amount);
        assertEq(daiToken.balanceOf(user2), user2BalanceBefore + amount);
    }
    
    /**
     * @dev Fuzz test for approve and transferFrom functions
     * @param approvalAmount Amount to approve
     * @param transferAmount Amount to transfer (bounded by approval)
     */
    function testFuzz_ApproveAndTransferFrom(uint256 approvalAmount, uint256 transferAmount) public {
        // Bound the amounts to avoid overflow and unrealistic values
        approvalAmount = bound(approvalAmount, 0, daiToken.balanceOf(user1));
        transferAmount = bound(transferAmount, 0, approvalAmount);
        
        uint256 user1BalanceBefore = daiToken.balanceOf(user1);
        uint256 user2BalanceBefore = daiToken.balanceOf(user2);
        
        // Execute approve
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit Approval(user1, user2, approvalAmount);
        daiToken.approve(user2, approvalAmount);
        
        // Verify allowance
        assertEq(daiToken.allowance(user1, user2), approvalAmount);
        
        // Execute transferFrom
        vm.prank(user2);
        vm.expectEmit(true, true, false, true);
        emit Transfer(user1, user2, transferAmount);
        daiToken.transferFrom(user1, user2, transferAmount);
        
        // Verify balances and allowance
        assertEq(daiToken.balanceOf(user1), user1BalanceBefore - transferAmount);
        assertEq(daiToken.balanceOf(user2), user2BalanceBefore + transferAmount);
        assertEq(daiToken.allowance(user1, user2), approvalAmount - transferAmount);
    }
    
    /**
     * @dev Fuzz test for mint function
     * @param amount Amount to mint
     */
    function testFuzz_Mint(uint256 amount) public {
        // Bound the amount to avoid overflow and unrealistic values
        amount = bound(amount, 1, 1_000_000_000 * 10**18);
        
        uint256 totalSupplyBefore = daiToken.totalSupply();
        uint256 user1BalanceBefore = daiToken.balanceOf(user1);
        
        // Execute mint
        vm.prank(minter);
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), user1, amount);
        daiToken.mint(user1, amount);
        
        // Verify balances and total supply
        assertEq(daiToken.balanceOf(user1), user1BalanceBefore + amount);
        assertEq(daiToken.totalSupply(), totalSupplyBefore + amount);
    }
    
    /**
     * @dev Fuzz test for pause and unpause functions
     * @param amount Amount to transfer (should fail when paused)
     */
    function testFuzz_PauseAndUnpause(uint256 amount) public {
        // Bound the amount to avoid overflow and unrealistic values
        amount = bound(amount, 1, daiToken.balanceOf(user1));
        
        // Pause the token
        vm.prank(pauser);
        daiToken.pause();
        
        // Verify token is paused
        assertTrue(daiToken.paused());
        
        // Transfer should fail when paused
        vm.prank(user1);
        vm.expectRevert("ERC20Pausable: token transfer while paused");
        daiToken.transfer(user2, amount);
        
        // Unpause the token
        vm.prank(pauser);
        daiToken.unpause();
        
        // Verify token is unpaused
        assertFalse(daiToken.paused());
        
        // Transfer should succeed when unpaused
        vm.prank(user1);
        daiToken.transfer(user2, amount);
    }
    
    /**
     * @dev Fuzz test for multiple transfers to verify no state corruption
     * @param amounts Array of amounts to transfer
     */
    function testFuzz_MultipleTransfers(uint256[] calldata amounts) public {
        // Limit the number of transfers to avoid excessive gas usage
        uint256 numTransfers = bound(amounts.length, 1, 10);
        
        uint256 totalTransferred = 0;
        uint256 user1BalanceBefore = daiToken.balanceOf(user1);
        uint256 user2BalanceBefore = daiToken.balanceOf(user2);
        
        // Execute multiple transfers
        for (uint256 i = 0; i < numTransfers; i++) {
            // Bound each amount to avoid overflow
            uint256 amount = bound(amounts[i % amounts.length], 0, daiToken.balanceOf(user1) - totalTransferred);
            
            vm.prank(user1);
            daiToken.transfer(user2, amount);
            
            totalTransferred += amount;
        }
        
        // Verify final balances
        assertEq(daiToken.balanceOf(user1), user1BalanceBefore - totalTransferred);
        assertEq(daiToken.balanceOf(user2), user2BalanceBefore + totalTransferred);
    }
    
    /**
     * @dev Fuzz test for role-based access control
     * @param randomAddress Random address to test for unauthorized access
     */
    function testFuzz_AccessControl(address randomAddress) public {
        // Exclude known role addresses
        vm.assume(randomAddress != owner);
        vm.assume(randomAddress != minter);
        vm.assume(randomAddress != pauser);
        
        // Random address should not have minter role
        assertFalse(daiToken.hasRole(daiToken.MINTER_ROLE(), randomAddress));
        
        // Attempt to mint should fail
        vm.prank(randomAddress);
        vm.expectRevert();
        daiToken.mint(randomAddress, 1000 * 10**18);
        
        // Random address should not have pauser role
        assertFalse(daiToken.hasRole(daiToken.PAUSER_ROLE(), randomAddress));
        
        // Attempt to pause should fail
        vm.prank(randomAddress);
        vm.expectRevert();
        daiToken.pause();
    }
}
