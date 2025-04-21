// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/token/DLoopToken.sol";

/**
 * @title DLoopToken Stateful Fuzzing Test
 * @dev Stateful property-based tests for the DLoopToken contract
 * 
 * This test focuses on complex attack vectors:
 * 1. Delegation manipulation attacks
 * 2. Delegation-burn race conditions
 * 3. Double delegation attacks
 * 4. Delegation accounting invariants
 * 5. Delegation front-running scenarios
 */
contract DLoopTokenStatefulTest is Test {
    // Contracts
    DLoopToken public token;
    
    // Test accounts
    address public owner;
    address public minter;
    address public pauser;
    address[] public users;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant MAX_SUPPLY = 10_000_000 ether;
    uint8 public constant DECIMALS = 18;
    uint256 public constant NUM_USERS = 10;
    
    // Tracking state for invariant checks
    mapping(address => uint256) public userBalances;
    mapping(address => mapping(address => uint256)) public userDelegations;
    mapping(address => uint256) public totalDelegatedByUser;
    mapping(address => uint256) public totalDelegatedToUser;
    uint256 public totalSupply;
    
    // Actions for stateful fuzzing
    enum Action {
        Mint,
        Burn,
        Transfer,
        Delegate,
        Undelegate,
        PauseUnpause,
        GrantRevokeMinter,
        GrantRevokePauser,
        BurnWithActiveDelegations
    }
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        minter = makeAddr("minter");
        pauser = makeAddr("pauser");
        
        // Create test users
        users = new address[](NUM_USERS);
        for (uint256 i = 0; i < NUM_USERS; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
        }
        
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
        
        // Setup roles
        token.grantRole(token.MINTER_ROLE(), minter);
        token.grantRole(token.PAUSER_ROLE(), pauser);
        vm.stopPrank();
        
        // Initial distribution
        vm.startPrank(owner);
        for (uint256 i = 0; i < NUM_USERS; i++) {
            token.transfer(users[i], INITIAL_SUPPLY / (NUM_USERS * 2));
            userBalances[users[i]] = INITIAL_SUPPLY / (NUM_USERS * 2);
        }
        vm.stopPrank();
        
        // Track initial state
        totalSupply = token.totalSupply();
        userBalances[owner] = token.balanceOf(owner);
    }
    
    /**
     * @dev Stateful fuzz test that performs random actions on the token
     * @param actions Array of actions to perform
     * @param actorIndexes Array of actor indexes for each action
     * @param targetIndexes Array of target indexes for each action
     * @param amounts Array of amounts for each action
     */
    function testFuzz_StatefulDelegationAttacks(
        uint8[] calldata actions,
        uint8[] calldata actorIndexes,
        uint8[] calldata targetIndexes,
        uint256[] calldata amounts
    ) public {
        // Require at least one action
        vm.assume(actions.length > 0);
        vm.assume(actions.length == actorIndexes.length);
        vm.assume(actions.length == targetIndexes.length);
        vm.assume(actions.length == amounts.length);
        
        // Perform each action
        for (uint256 i = 0; i < actions.length; i++) {
            // Bound indexes and amounts
            uint8 actionType = uint8(bound(actions[i], 0, uint8(type(Action).max)));
            uint8 actorIndex = uint8(bound(actorIndexes[i], 0, NUM_USERS - 1));
            uint8 targetIndex = uint8(bound(targetIndexes[i], 0, NUM_USERS - 1));
            
            // Ensure actor and target are different
            if (actorIndex == targetIndex) {
                if (targetIndex < NUM_USERS - 1) {
                    targetIndex++;
                } else {
                    targetIndex = 0;
                }
            }
            
            // Get actor and target addresses
            address actor = users[actorIndex];
            address target = users[targetIndex];
            
            // Bound amount based on action type
            uint256 amount;
            if (actionType == uint8(Action.Mint)) {
                // Bound mint amount to avoid exceeding max supply
                amount = bound(amounts[i], 1, MAX_SUPPLY - totalSupply);
            } else if (actionType == uint8(Action.Burn) || actionType == uint8(Action.Transfer) || actionType == uint8(Action.Delegate)) {
                // Bound to actor's balance
                amount = bound(amounts[i], 1, token.balanceOf(actor));
            } else if (actionType == uint8(Action.Undelegate)) {
                // Bound to delegation amount
                amount = bound(amounts[i], 1, token.getDelegatedAmount(actor, target));
            } else {
                amount = amounts[i];
            }
            
            // Skip if amount is 0 (could happen due to bounds)
            if (amount == 0) continue;
            
            // Perform the action
            performAction(Action(actionType), actor, target, amount);
            
            // Check invariants after each action
            checkInvariants();
        }
    }
    
    /**
     * @dev Performs a specific action on the token
     * @param action Action to perform
     * @param actor Address performing the action
     * @param target Target address for the action
     * @param amount Amount for the action
     */
    function performAction(Action action, address actor, address target, uint256 amount) internal {
        // Start prank as actor
        vm.startPrank(actor);
        
        // try/catch removed: not supported for internal calls in Solidity

            if (action == Action.Mint) {
                // Only minter can mint
                if (token.hasRole(token.MINTER_ROLE(), actor)) {
                    token.mint(target, amount);
                    totalSupply += amount;
                    userBalances[target] += amount;
                }
            } else if (action == Action.Burn) {
                // Can only burn own tokens
                if (token.balanceOf(actor) >= amount && 
                    token.getTotalDelegatedByAddress(actor) == 0) {
                    token.burn(amount);
                    totalSupply -= amount;
                    userBalances[actor] -= amount;
                }
            } else if (action == Action.Transfer) {
                // Can transfer if have enough balance after delegations
                uint256 availableBalance = token.balanceOf(actor) - token.getTotalDelegatedByAddress(actor);
                if (availableBalance >= amount) {
                    token.transfer(target, amount);
                    userBalances[actor] -= amount;
                    userBalances[target] += amount;
                }
            } else if (action == Action.Delegate) {
                // Can delegate if have enough balance
                uint256 availableBalance = token.balanceOf(actor) - token.getTotalDelegatedByAddress(actor);
                if (availableBalance >= amount) {
                    token.delegateTokens(target, amount);
                    userDelegations[actor][target] += amount;
                    totalDelegatedByUser[actor] += amount;
                    totalDelegatedToUser[target] += amount;
                }
            } else if (action == Action.Undelegate) {
                // Can undelegate if have delegated enough
                if (token.getDelegatedAmount(actor, target) >= amount) {
                    token.undelegateTokens(target, amount);
                    userDelegations[actor][target] -= amount;
                    totalDelegatedByUser[actor] -= amount;
                    totalDelegatedToUser[target] -= amount;
                }
            } else if (action == Action.PauseUnpause) {
                // Only pauser can pause/unpause
                if (token.hasRole(token.PAUSER_ROLE(), actor)) {
                    if (token.paused()) {
                        token.unpause();
                    } else {
                        token.pause();
                    }
                }
            } else if (action == Action.GrantRevokeMinter) {
                // Only admin can grant/revoke roles
                if (token.hasRole(token.DEFAULT_ADMIN_ROLE(), actor)) {
                    if (token.hasRole(token.MINTER_ROLE(), target)) {
                        token.revokeRole(token.MINTER_ROLE(), target);
                    } else {
                        token.grantRole(token.MINTER_ROLE(), target);
                    }
                }
            } else if (action == Action.GrantRevokePauser) {
                // Only admin can grant/revoke roles
                if (token.hasRole(token.DEFAULT_ADMIN_ROLE(), actor)) {
                    if (token.hasRole(token.PAUSER_ROLE(), target)) {
                        token.revokeRole(token.PAUSER_ROLE(), target);
                    } else {
                        token.grantRole(token.PAUSER_ROLE(), target);
                    }
                }
            } else if (action == Action.BurnWithActiveDelegations) {
                // Try to burn with active delegations (should fail)
                if (token.getTotalDelegatedByAddress(actor) > 0) {
                    vm.expectRevert();
                    token.burn(amount);
                }
            }
        } catch {
            // Ignore errors - we're testing for invariant violations
        }
        
        vm.stopPrank();
    }
    
    /**
     * @dev Check invariants that must always hold
     */
    function checkInvariants() internal {
        // 1. Total supply must not exceed max supply
        assertLe(token.totalSupply(), MAX_SUPPLY, "Total supply exceeds max supply");
        
        // 2. Sum of all balances must equal total supply
        uint256 sumOfBalances = 0;
        for (uint256 i = 0; i < NUM_USERS; i++) {
            sumOfBalances += token.balanceOf(users[i]);
        }
        sumOfBalances += token.balanceOf(owner);
        sumOfBalances += token.balanceOf(minter);
        sumOfBalances += token.balanceOf(pauser);
        assertEq(sumOfBalances, token.totalSupply(), "Sum of balances != total supply");
        
        // 3. For each user, delegated amount must not exceed balance
        for (uint256 i = 0; i < NUM_USERS; i++) {
            address user = users[i];
            assertLe(token.getTotalDelegatedByAddress(user), token.balanceOf(user), 
                "User delegated more than their balance");
        }
        
        // 4. For each delegation pair, delegated amount must match contract state
        for (uint256 i = 0; i < NUM_USERS; i++) {
            for (uint256 j = 0; j < NUM_USERS; j++) {
                if (i != j) {
                    address delegator = users[i];
                    address delegatee = users[j];
                    assertEq(token.getDelegatedAmount(delegator, delegatee), 
                        userDelegations[delegator][delegatee], 
                        "Delegation amount mismatch");
                }
            }
        }
        
        // 5. Total delegated by address must match sum of individual delegations
        for (uint256 i = 0; i < NUM_USERS; i++) {
            address delegator = users[i];
            uint256 sumDelegated = 0;
            for (uint256 j = 0; j < NUM_USERS; j++) {
                if (i != j) {
                    address delegatee = users[j];
                    sumDelegated += token.getDelegatedAmount(delegator, delegatee);
                }
            }
            assertEq(token.getTotalDelegatedByAddress(delegator), sumDelegated, 
                "Total delegated by address mismatch");
        }
        
        // 6. Total delegated to address must match sum of individual delegations
        for (uint256 i = 0; i < NUM_USERS; i++) {
            address delegatee = users[i];
            uint256 sumDelegated = 0;
            for (uint256 j = 0; j < NUM_USERS; j++) {
                if (i != j) {
                    address delegator = users[j];
                    sumDelegated += token.getDelegatedAmount(delegator, delegatee);
                }
            }
            assertEq(token.getTotalDelegatedToAddress(delegatee), sumDelegated, 
                "Total delegated to address mismatch");
        }
    }
    
    /**
     * @dev Test specific attack vector: delegation front-running
     * This tests if an attacker can manipulate delegations during a transaction
     */
    function testFuzz_DelegationFrontRunning(
        uint8 victimIndex,
        uint8 attackerIndex,
        uint256 delegationAmount,
        uint256 transferAmount
    ) public {
        // Bound inputs
        victimIndex = uint8(bound(victimIndex, 0, NUM_USERS - 1));
        attackerIndex = uint8(bound(attackerIndex, 0, NUM_USERS - 1));
        
        // Ensure victim and attacker are different
        if (victimIndex == attackerIndex) {
            if (attackerIndex < NUM_USERS - 1) {
                attackerIndex++;
            } else {
                attackerIndex = 0;
            }
        }
        
        address victim = users[victimIndex];
        address attacker = users[attackerIndex];
        
        // Bound amounts
        delegationAmount = bound(delegationAmount, 1, token.balanceOf(victim) / 2);
        transferAmount = bound(transferAmount, 1, token.balanceOf(victim) / 2);
        
        // Skip if amounts are 0
        vm.assume(delegationAmount > 0);
        vm.assume(transferAmount > 0);
        
        // Victim delegates tokens to attacker
        vm.prank(victim);
        token.delegateTokens(attacker, delegationAmount);
        
        // Record state before attack
        uint256 victimBalanceBefore = token.balanceOf(victim);
        uint256 attackerBalanceBefore = token.balanceOf(attacker);
        uint256 delegatedAmount = token.getDelegatedAmount(victim, attacker);
        
        // Attacker tries to manipulate delegation during a transfer
        vm.startPrank(attacker);
        
        // 1. Try to transfer victim's tokens (should fail)
        vm.expectRevert();
        token.transferFrom(victim, attacker, transferAmount);
        
        // 2. Try to undelegate tokens on behalf of victim (should fail)
        vm.expectRevert();
        token.undelegateTokens(victim, delegationAmount);
        
        // 3. Try to burn victim's tokens (should fail)
        vm.expectRevert();
        token.burnFrom(victim, delegationAmount);
        
        vm.stopPrank();
        
        // Verify state hasn't changed
        assertEq(token.balanceOf(victim), victimBalanceBefore, "Victim balance changed");
        assertEq(token.balanceOf(attacker), attackerBalanceBefore, "Attacker balance changed");
        assertEq(token.getDelegatedAmount(victim, attacker), delegatedAmount, "Delegation amount changed");
    }
    
    /**
     * @dev Test specific attack vector: double delegation attack
     * This tests if an attacker can delegate the same tokens multiple times
     */
    function testFuzz_DoubleDelegationAttack(
        uint8 attackerIndex,
        uint8[] calldata victimIndexes,
        uint256 delegationAmount
    ) public {
        // Bound inputs
        attackerIndex = uint8(bound(attackerIndex, 0, NUM_USERS - 1));
        address attacker = users[attackerIndex];
        
        // Bound delegation amount
        delegationAmount = bound(delegationAmount, 1, token.balanceOf(attacker));
        
        // Skip if amount is 0
        vm.assume(delegationAmount > 0);
        
        // Filter victim indexes to ensure they're different from attacker
        uint8[] memory filteredVictimIndexes = new uint8[](victimIndexes.length);
        uint256 validVictims = 0;
        
        for (uint256 i = 0; i < victimIndexes.length; i++) {
            uint8 victimIndex = uint8(bound(victimIndexes[i], 0, NUM_USERS - 1));
            if (victimIndex != attackerIndex) {
                filteredVictimIndexes[validVictims] = victimIndex;
                validVictims++;
            }
        }
        
        // Skip if no valid victims
        vm.assume(validVictims > 0);
        
        // Attacker delegates to first victim
        vm.startPrank(attacker);
        token.delegateTokens(users[filteredVictimIndexes[0]], delegationAmount);
        
        // Record attacker's balance and total delegated
        uint256 attackerBalance = token.balanceOf(attacker);
        uint256 totalDelegated = token.getTotalDelegatedByAddress(attacker);
        
        // Try to delegate to additional victims (should fail if it would exceed balance)
        for (uint256 i = 1; i < validVictims; i++) {
            address victim = users[filteredVictimIndexes[i]];
            
            // If total delegated would exceed balance, expect revert
            if (totalDelegated + delegationAmount > attackerBalance) {
                vm.expectRevert();
            }
            
            try token.delegateTokens(victim, delegationAmount) {
                // If successful, update total delegated
                totalDelegated += delegationAmount;
            } catch {
                // Expected to fail if would exceed balance
            }
        }
        
        vm.stopPrank();
        
        // Verify total delegated doesn't exceed balance
        assertLe(token.getTotalDelegatedByAddress(attacker), token.balanceOf(attacker), 
            "Total delegated exceeds balance");
    }
}
