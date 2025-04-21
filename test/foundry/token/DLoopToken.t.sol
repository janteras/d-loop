// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/token/DLoopToken.sol";

/**
 * @title DLoopToken Fuzz Test
 * @dev Property-based tests for the DLoopToken contract
 * 
 * This test focuses on:
 * 1. Token delegation functionality
 * 2. Supply management and limits
 * 3. Role-based access control
 * 4. Edge cases in token operations
 */
contract DLoopTokenTest is Test {
    // Contracts
    DLoopToken public token;
    
    // Test accounts
    address public owner;
    address public minter;
    address public pauser;
    address public user1;
    address public user2;
    address public user3;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant MAX_SUPPLY = 10_000_000 ether;
    uint8 public constant DECIMALS = 18;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        minter = makeAddr("minter");
        pauser = makeAddr("pauser");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Deploy token
        vm.startPrank(owner);
        token = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            DECIMALS,
            MAX_SUPPLY,
            owner
        );
        
        // Grant roles
        bytes32 minterRole = token.MINTER_ROLE();
        bytes32 pauserRole = token.PAUSER_ROLE();
        token.grantRole(minterRole, minter);
        token.grantRole(pauserRole, pauser);
        
        // Distribute tokens
        token.transfer(user1, 100_000 ether);
        token.transfer(user2, 200_000 ether);
        token.transfer(user3, 300_000 ether);
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test for token delegation
     * @param delegator Address index for delegator
     * @param delegatee Address index for delegatee
     * @param amount Amount to delegate
     */
    function testFuzz_TokenDelegation(uint8 delegator, uint8 delegatee, uint256 amount) public {
        // Bound inputs
        delegator = uint8(bound(delegator, 0, 2)); // 0-2 for user1-3
        delegatee = uint8(bound(delegatee, 0, 2)); // 0-2 for user1-3
        
        // Select delegator and delegatee
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address from = users[delegator];
        address to = users[delegatee];
        
        // Skip if delegator and delegatee are the same
        if (from == to) return;
        
        // Get delegator balance
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        
        // Bound amount to delegator balance
        amount = bound(amount, 1, balance);
        
        // Record initial state
        uint256 initialDelegated = token.getDelegatedAmount(from, to);
        uint256 initialTotalDelegatedBy = token.getTotalDelegatedByAddress(from);
        uint256 initialTotalDelegatedTo = token.getTotalDelegatedToAddress(to);
        
        // Delegate tokens
        vm.prank(from);
        token.delegateTokens(to, amount);
        
        // Verify delegation
        assertEq(token.getDelegatedAmount(from, to), initialDelegated + amount, "Delegated amount should increase");
        assertEq(token.getTotalDelegatedByAddress(from), initialTotalDelegatedBy + amount, "Total delegated by address should increase");
        assertEq(token.getTotalDelegatedToAddress(to), initialTotalDelegatedTo + amount, "Total delegated to address should increase");
        
        // Verify delegator and delegatee lists
        address[] memory delegators = token.getDelegatorsForAddress(to);
        bool foundDelegator = false;
        for (uint i = 0; i < delegators.length; i++) {
            if (delegators[i] == from) {
                foundDelegator = true;
                break;
            }
        }
        assertTrue(foundDelegator, "Delegator should be in delegatee's delegator list");
        
        address[] memory delegatees = token.getDelegateesForAddress(from);
        bool foundDelegatee = false;
        for (uint i = 0; i < delegatees.length; i++) {
            if (delegatees[i] == to) {
                foundDelegatee = true;
                break;
            }
        }
        assertTrue(foundDelegatee, "Delegatee should be in delegator's delegatee list");
    }
    
    /**
     * @dev Fuzz test for undelegating tokens
     * @param delegator Address index for delegator
     * @param delegatee Address index for delegatee
     * @param delegateAmount Amount to delegate
     * @param undelegateAmount Amount to undelegate
     */
    function testFuzz_TokenUndelegation(
        uint8 delegator,
        uint8 delegatee,
        uint256 delegateAmount,
        uint256 undelegateAmount
    ) public {
        // Bound inputs
        delegator = uint8(bound(delegator, 0, 2)); // 0-2 for user1-3
        delegatee = uint8(bound(delegatee, 0, 2)); // 0-2 for user1-3
        
        // Select delegator and delegatee
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address from = users[delegator];
        address to = users[delegatee];
        
        // Skip if delegator and delegatee are the same
        if (from == to) return;
        
        // Get delegator balance
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        
        // Bound delegate amount to delegator balance
        delegateAmount = bound(delegateAmount, 1, balance);
        
        // Delegate tokens first
        vm.prank(from);
        token.delegateTokens(to, delegateAmount);
        
        // Bound undelegate amount to delegated amount
        undelegateAmount = bound(undelegateAmount, 1, delegateAmount);
        
        // Record state before undelegation
        uint256 delegatedBefore = token.getDelegatedAmount(from, to);
        uint256 totalDelegatedByBefore = token.getTotalDelegatedByAddress(from);
        uint256 totalDelegatedToBefore = token.getTotalDelegatedToAddress(to);
        
        // Undelegate tokens
        vm.prank(from);
        token.undelegateTokens(to, undelegateAmount);
        
        // Verify undelegation
        assertEq(token.getDelegatedAmount(from, to), delegatedBefore - undelegateAmount, "Delegated amount should decrease");
        assertEq(token.getTotalDelegatedByAddress(from), totalDelegatedByBefore - undelegateAmount, "Total delegated by address should decrease");
        assertEq(token.getTotalDelegatedToAddress(to), totalDelegatedToBefore - undelegateAmount, "Total delegated to address should decrease");
        
        // If fully undelegated, verify delegator and delegatee lists
        if (undelegateAmount == delegateAmount) {
            address[] memory delegators = token.getDelegatorsForAddress(to);
            bool foundDelegator = false;
            for (uint i = 0; i < delegators.length; i++) {
                if (delegators[i] == from) {
                    foundDelegator = true;
                    break;
                }
            }
            assertFalse(foundDelegator, "Delegator should not be in delegatee's delegator list after full undelegation");
            
            address[] memory delegatees = token.getDelegateesForAddress(from);
            bool foundDelegatee = false;
            for (uint i = 0; i < delegatees.length; i++) {
                if (delegatees[i] == to) {
                    foundDelegatee = true;
                    break;
                }
            }
            assertFalse(foundDelegatee, "Delegatee should not be in delegator's delegatee list after full undelegation");
        }
    }
    
    /**
     * @dev Fuzz test for multiple delegations
     * @param delegator Address index for delegator
     * @param delegationCount Number of delegations to make
     * @param amountPercentages Percentages of balance to delegate
     */
    function testFuzz_MultipleDelegations(
        uint8 delegator,
        uint8 delegationCount,
        uint8[] calldata amountPercentages
    ) public {
        // Bound inputs
        delegator = uint8(bound(delegator, 0, 2)); // 0-2 for user1-3
        delegationCount = uint8(bound(delegationCount, 1, 5)); // 1-5 delegations
        
        // Select delegator
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address from = users[delegator];
        
        // Get delegator balance
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        
        // Skip if not enough input percentages
        if (amountPercentages.length < delegationCount) return;
        
        // Create delegatees
        address[] memory delegatees = new address[](delegationCount);
        for (uint8 i = 0; i < delegationCount; i++) {
            delegatees[i] = makeAddr(string(abi.encodePacked("delegatee", i)));
        }
        
        // Track total delegated
        uint256 totalDelegated = 0;
        
        // Perform delegations
        for (uint8 i = 0; i < delegationCount; i++) {
            // Bound percentage to 1-20%
            uint8 percentage = uint8(bound(amountPercentages[i], 1, 20));
            
            // Calculate amount (percentage of balance)
            uint256 amount = (balance * percentage) / 100;
            
            // Skip if amount is 0 or would exceed balance when combined with previous delegations
            if (amount == 0 || totalDelegated + amount > balance) continue;
            
            // Delegate tokens
            vm.prank(from);
            token.delegateTokens(delegatees[i], amount);
            
            // Update total delegated
            totalDelegated += amount;
            
            // Verify delegation
            assertEq(token.getDelegatedAmount(from, delegatees[i]), amount, "Delegated amount should match");
        }
        
        // Verify total delegated
        assertEq(token.getTotalDelegatedByAddress(from), totalDelegated, "Total delegated should match sum of individual delegations");
        
        // Verify delegatee list
        address[] memory storedDelegatees = token.getDelegateesForAddress(from);
        assertLe(storedDelegatees.length, delegationCount, "Delegatee list should not exceed delegation count");
    }
    
    /**
     * @dev Fuzz test for minting tokens
     * @param recipient Recipient address index
     * @param amount Amount to mint
     */
    function testFuzz_MintTokens(uint8 recipient, uint256 amount) public {
        // Bound inputs
        recipient = uint8(bound(recipient, 0, 2)); // 0-2 for user1-3
        
        // Select recipient
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address to = users[recipient];
        
        // Get current supply
        uint256 currentSupply = token.totalSupply();
        
        // Bound amount to remain within max supply
        amount = bound(amount, 1, MAX_SUPPLY - currentSupply);
        
        // Record initial balance
        uint256 initialBalance = token.balanceOf(to);
        
        // Mint tokens
        vm.prank(minter);
        token.mint(to, amount);
        
        // Verify minting
        assertEq(token.balanceOf(to), initialBalance + amount, "Recipient balance should increase");
        assertEq(token.totalSupply(), currentSupply + amount, "Total supply should increase");
    }
    
    /**
     * @dev Fuzz test for burning tokens
     * @param burner Burner address index
     * @param amount Amount to burn
     */
    function testFuzz_BurnTokens(uint8 burner, uint256 amount) public {
        // Bound inputs
        burner = uint8(bound(burner, 0, 2)); // 0-2 for user1-3
        
        // Select burner
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address from = users[burner];
        
        // Get burner balance
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        
        // Ensure no delegations
        if (token.getTotalDelegatedByAddress(from) > 0) {
            // Undelegating all tokens first
            address[] memory delegatees = token.getDelegateesForAddress(from);
            for (uint i = 0; i < delegatees.length; i++) {
                uint256 delegatedAmount = token.getDelegatedAmount(from, delegatees[i]);
                vm.prank(from);
                token.undelegateTokens(delegatees[i], delegatedAmount);
            }
        }
        
        // Bound amount to burner balance
        amount = bound(amount, 1, balance);
        
        // Record initial state
        uint256 initialBalance = token.balanceOf(from);
        uint256 initialSupply = token.totalSupply();
        
        // Burn tokens
        vm.prank(from);
        token.burn(amount);
        
        // Verify burning
        assertEq(token.balanceOf(from), initialBalance - amount, "Burner balance should decrease");
        assertEq(token.totalSupply(), initialSupply - amount, "Total supply should decrease");
    }
    
    /**
     * @dev Fuzz test for transfer with delegations
     * @param sender Sender address index
     * @param recipient Recipient address index
     * @param delegateAmount Amount to delegate
     * @param transferAmount Amount to transfer
     */
    function testFuzz_TransferWithDelegations(
        uint8 sender,
        uint8 recipient,
        uint256 delegateAmount,
        uint256 transferAmount
    ) public {
        // Bound inputs
        sender = uint8(bound(sender, 0, 2)); // 0-2 for user1-3
        recipient = uint8(bound(recipient, 0, 2)); // 0-2 for user1-3
        
        // Select sender and recipient
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        address from = users[sender];
        address to = users[recipient];
        
        // Skip if sender and recipient are the same
        if (from == to) return;
        
        // Get sender balance
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;
        
        // Create a delegatee
        address delegatee = makeAddr("delegatee");
        
        // Bound delegate amount to sender balance
        delegateAmount = bound(delegateAmount, 1, balance / 2); // Delegate up to half of balance
        
        // Delegate tokens
        vm.prank(from);
        token.delegateTokens(delegatee, delegateAmount);
        
        // Available balance for transfer
        uint256 availableBalance = balance - delegateAmount;
        
        // Bound transfer amount to available balance
        transferAmount = bound(transferAmount, 1, availableBalance);
        
        // Record initial state
        uint256 initialSenderBalance = token.balanceOf(from);
        uint256 initialRecipientBalance = token.balanceOf(to);
        
        // Transfer tokens
        vm.prank(from);
        token.transfer(to, transferAmount);
        
        // Verify transfer
        assertEq(token.balanceOf(from), initialSenderBalance - transferAmount, "Sender balance should decrease");
        assertEq(token.balanceOf(to), initialRecipientBalance + transferAmount, "Recipient balance should increase");
        
        // Verify delegations remain unchanged
        assertEq(token.getDelegatedAmount(from, delegatee), delegateAmount, "Delegated amount should remain unchanged");
        assertEq(token.getTotalDelegatedByAddress(from), delegateAmount, "Total delegated should remain unchanged");
    }
    
    /**
     * @dev Fuzz test for max supply enforcement
     * @param amount Amount to mint beyond max supply
     */
    function testFuzz_MaxSupplyEnforcement(uint256 amount) public {
        // Bound amount to be non-zero
        amount = bound(amount, 1, 1_000_000 ether);
        
        // Calculate amount that would exceed max supply
        uint256 currentSupply = token.totalSupply();
        uint256 remainingSupply = MAX_SUPPLY - currentSupply;
        
        // Try to mint more than remaining supply
        vm.prank(minter);
        vm.expectRevert();
        token.mint(user1, remainingSupply + amount);
        
        // Verify max supply is enforced
        assertLe(token.totalSupply(), MAX_SUPPLY, "Total supply should not exceed max supply");
        
        // Mint exactly the remaining supply
        if (remainingSupply > 0) {
            vm.prank(minter);
            token.mint(user1, remainingSupply);
            
            // Verify total supply equals max supply
            assertEq(token.totalSupply(), MAX_SUPPLY, "Total supply should equal max supply");
            
            // Try to mint one more token
            vm.prank(minter);
            vm.expectRevert();
            token.mint(user1, 1);
        }
    }
    
    /**
     * @dev Fuzz test for role-based access control
     * @param nonMinter Non-minter address seed
     * @param nonPauser Non-pauser address seed
     * @param amount Amount to mint or burn
     */
    function testFuzz_RoleBasedAccessControl(uint256 nonMinter, uint256 nonPauser, uint256 amount) public {
        // Bound amount
        amount = bound(amount, 1, 1000 ether);
        
        // Generate non-privileged addresses
        address nonMinterAddr = makeAddr(string(abi.encodePacked("nonMinter", nonMinter)));
        address nonPauserAddr = makeAddr(string(abi.encodePacked("nonPauser", nonPauser)));
        
        // Try to mint as non-minter
        vm.prank(nonMinterAddr);
        vm.expectRevert();
        token.mint(user1, amount);
        
        // Try to pause as non-pauser
        vm.prank(nonPauserAddr);
        vm.expectRevert();
        token.pause();
        
        // Verify authorized roles can perform actions
        vm.prank(minter);
        token.mint(user1, amount);
        
        vm.prank(pauser);
        token.pause();
        
        // Verify token is paused
        assertTrue(token.paused(), "Token should be paused");
        
        // Try to transfer while paused
        vm.prank(user1);
        vm.expectRevert();
        token.transfer(user2, amount);
        
        // Unpause
        vm.prank(pauser);
        token.unpause();
        
        // Verify token is unpaused
        assertFalse(token.paused(), "Token should be unpaused");
        
        // Verify transfer works after unpausing
        vm.prank(user1);
        token.transfer(user2, amount);
    }
}
