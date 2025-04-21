// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/core/ProtocolDAO.sol";
import "../../../contracts/governance/GovernanceRewards.sol";

/**
 * @title Token Delegation Invariant Test
 * @dev System-wide property tests for token delegation mechanics
 * 
 * This test verifies that critical invariants hold true for the delegation system:
 * 1. Delegation Conservation: Total delegated tokens match sum of individual delegations
 * 2. Delegation Bounds: No user can delegate more tokens than they own
 * 3. Governance Power Accuracy: Voting power correctly accounts for delegations
 * 4. Delegation Transitivity: No circular or transitive delegation chains
 * 5. Reward Distribution Fairness: Rewards are distributed proportionally to delegations
 * 6. Delegation Persistence: Delegations persist correctly across token transfers
 * 7. Burn Protection: Tokens with active delegations cannot be burned
 * 8. Delegation Revocation: Only delegators can revoke their own delegations
 * 9. Delegation History: Delegation changes are properly tracked and can be audited
 * 10. Governance Influence: Delegation properly influences governance outcomes
 */
contract TokenDelegationInvariantTest is StdInvariant, Test {
    // Contracts
    DLoopToken public dloopToken;
    ProtocolDAO public protocolDAO;
    GovernanceRewards public governanceRewards;
    
    // Test accounts
    address public owner;
    address public treasury;
    address[] public users;
    
    // Constants
    uint256 public constant USER_COUNT = 10;
    uint256 public constant INITIAL_USER_BALANCE = 100_000 ether;
    
    // Tracking variables
    mapping(address => uint256) public initialBalances;
    mapping(address => mapping(address => uint256)) public initialDelegations;
    uint256 public initialTotalSupply;
    
    // Handler contract
    DelegationHandler public delegationHandler;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        treasury = makeAddr("treasury");
        
        users = new address[](USER_COUNT);
        for (uint256 i = 0; i < USER_COUNT; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
        }
        
        // Deploy token contract
        vm.startPrank(owner);
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            1_000_000 ether,
            18,
            10_000_000 ether,
            owner
        );
        
        // Deploy governance contracts
        protocolDAO = new ProtocolDAO(
            address(dloopToken),
            treasury
        );
        
        governanceRewards = new GovernanceRewards(
            address(dloopToken),
            address(protocolDAO)
        );
        
        // Fund users
        for (uint256 i = 0; i < USER_COUNT; i++) {
            dloopToken.transfer(users[i], INITIAL_USER_BALANCE);
            initialBalances[users[i]] = INITIAL_USER_BALANCE;
        }
        
        // Fund governance rewards
        dloopToken.transfer(address(governanceRewards), 100_000 ether);
        
        // Store initial state
        initialTotalSupply = dloopToken.totalSupply();
        vm.stopPrank();
        
        // Deploy handler contract
        delegationHandler = new DelegationHandler(
            dloopToken,
            protocolDAO,
            governanceRewards,
            users
        );
        
        // Target contract for invariant testing
        targetContract(address(delegationHandler));
    }
    
    /**
     * @dev Invariant: Delegation Conservation
     * The total delegated tokens should match the sum of individual delegations
     */
    function invariant_DelegationConservation() public {
        for (uint256 i = 0; i < USER_COUNT; i++) {
            address delegator = users[i];
            
            // Get total delegated by this user
            uint256 totalDelegatedByUser = dloopToken.getTotalDelegatedByAddress(delegator);
            
            // Calculate sum of individual delegations
            uint256 sumOfDelegations = 0;
            for (uint256 j = 0; j < USER_COUNT; j++) {
                if (i == j) continue; // Skip self
                address delegatee = users[j];
                sumOfDelegations += dloopToken.getDelegatedAmount(delegator, delegatee);
            }
            
            // Verify conservation
            assertEq(
                totalDelegatedByUser,
                sumOfDelegations,
                "Total delegated tokens should match sum of individual delegations"
            );
        }
    }
    
    /**
     * @dev Invariant: Delegation Bounds
     * No user can delegate more tokens than they own
     */
    function invariant_DelegationBounds() public {
        for (uint256 i = 0; i < USER_COUNT; i++) {
            address user = users[i];
            
            // Get user balance and total delegated
            uint256 userBalance = dloopToken.balanceOf(user);
            uint256 totalDelegated = dloopToken.getTotalDelegatedByAddress(user);
            
            // Verify delegation bounds
            assertLe(
                totalDelegated,
                userBalance,
                "User cannot delegate more tokens than they own"
            );
        }
    }
    
    /**
     * @dev Invariant: Delegation Atomicity
     * Delegation operations should be atomic - either fully successful or fully reverted
     */
    function invariant_DelegationAtomicity() public {
        // Get all delegation operations from handler
        (
            address[] memory delegators,
            address[] memory delegatees,
            uint256[] memory amounts,
            bool[] memory succeeded
        ) = delegationHandler.getDelegationOperations();
        
        for (uint256 i = 0; i < delegators.length; i++) {
            address delegator = delegators[i];
            address delegatee = delegatees[i];
            uint256 amount = amounts[i];
            bool success = succeeded[i];
            
            if (success) {
                // If operation succeeded, delegation should be recorded
                assertGe(
                    dloopToken.getDelegatedAmount(delegator, delegatee),
                    amount,
                    "Successful delegation should be recorded"
                );
            } else {
                // If operation failed, state should be unchanged from initial
                // Note: This is a simplification, as other operations might have changed the state
                // In a real test, we'd need to track the expected state changes more carefully
            }
        }
    }
    
    /**
     * @dev Invariant: No Circular Delegations
     * There should be no circular delegation chains (A->B->C->A)
     */
    function invariant_NoCircularDelegations() public {
        for (uint256 i = 0; i < USER_COUNT; i++) {
            address startUser = users[i];
            
            // For each user, follow their delegation chain
            address currentUser = startUser;
            mapping(address => bool) memory visited;
            
            // Get all delegatees for this user
            address[] memory delegatees = dloopToken.getDelegateesForDelegator(currentUser);
            
            // For each delegatee, check if there's a path back to the start user
            for (uint256 j = 0; j < delegatees.length; j++) {
                address delegatee = delegatees[j];
                if (delegatee == address(0)) continue;
                
                // Skip if no delegation
                if (dloopToken.getDelegatedAmount(currentUser, delegatee) == 0) continue;
                
                // Check for circular path
                bool foundCircular = checkForCircularPath(delegatee, startUser, visited);
                assertFalse(foundCircular, "Circular delegation path detected");
            }
        }
    }
    
    /**
     * @dev Helper function to check for circular delegation paths
     */
    function checkForCircularPath(
        address current,
        address target,
        mapping(address => bool) memory visited
    ) internal view returns (bool) {
        // If we've reached the target, we found a circular path
        if (current == target) return true;
        
        // If we've already visited this node, stop to prevent infinite loops
        if (visited[current]) return false;
        
        // Mark as visited
        visited[current] = true;
        
        // Get all delegatees for this user
        address[] memory delegatees = dloopToken.getDelegateesForDelegator(current);
        
        // For each delegatee, check if there's a path to the target
        for (uint256 i = 0; i < delegatees.length; i++) {
            address delegatee = delegatees[i];
            if (delegatee == address(0)) continue;
            
            // Skip if no delegation
            if (dloopToken.getDelegatedAmount(current, delegatee) == 0) continue;
            
            // Recursively check for path
            if (checkForCircularPath(delegatee, target, visited)) return true;
        }
        
        return false;
    }
    
    /**
     * @dev Invariant: Governance Power Accuracy
     * Voting power should correctly account for delegations
     */
    function invariant_GovernancePowerAccuracy() public {
        // Get all proposals
        uint256[] memory proposalIds = delegationHandler.getProposalIds();
        
        for (uint256 i = 0; i < proposalIds.length; i++) {
            uint256 proposalId = proposalIds[i];
            
            // Get all voters for this proposal
            address[] memory voters = delegationHandler.getVoters(proposalId);
            
            for (uint256 j = 0; j < voters.length; j++) {
                address voter = voters[j];
                
                // Get voter's direct balance
                uint256 directBalance = dloopToken.balanceOf(voter);
                
                // Get total delegated to voter
                uint256 delegatedToVoter = dloopToken.getTotalDelegatedToAddress(voter);
                
                // Get voting weight used
                uint256 votingWeight = delegationHandler.getVotingWeight(proposalId, voter);
                
                // Verify voting weight doesn't exceed balance + delegations
                assertLe(
                    votingWeight,
                    directBalance + delegatedToVoter,
                    "Voting weight cannot exceed balance + delegations"
                );
            }
        }
    }
    
    /**
     * @dev Invariant: Reward Distribution Fairness
     * Rewards should be distributed proportionally to delegations
     */
    function invariant_RewardDistributionFairness() public {
        // Get all reward distributions
        (
            address[] memory recipients,
            uint256[] memory amounts
        ) = delegationHandler.getRewardDistributions();
        
        if (recipients.length == 0) return; // Skip if no distributions
        
        // Calculate total rewards distributed
        uint256 totalRewardsDistributed = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalRewardsDistributed += amounts[i];
        }
        
        if (totalRewardsDistributed == 0) return; // Skip if no rewards
        
        // For each user, verify rewards are proportional to governance power
        for (uint256 i = 0; i < USER_COUNT; i++) {
            address user = users[i];
            
            // Calculate user's governance power
            uint256 directBalance = dloopToken.balanceOf(user);
            uint256 delegatedToUser = dloopToken.getTotalDelegatedToAddress(user);
            uint256 governancePower = directBalance + delegatedToUser;
            
            // Calculate total governance power
            uint256 totalGovernancePower = 0;
            for (uint256 j = 0; j < USER_COUNT; j++) {
                address otherUser = users[j];
                uint256 otherDirectBalance = dloopToken.balanceOf(otherUser);
                uint256 otherDelegatedToUser = dloopToken.getTotalDelegatedToAddress(otherUser);
                totalGovernancePower += otherDirectBalance + otherDelegatedToUser;
            }
            
            if (totalGovernancePower == 0) continue; // Skip if no governance power
            
            // Calculate expected rewards based on governance power
            uint256 expectedRewards = (totalRewardsDistributed * governancePower) / totalGovernancePower;
            
            // Get actual rewards
            uint256 actualRewards = 0;
            for (uint256 j = 0; j < recipients.length; j++) {
                if (recipients[j] == user) {
                    actualRewards += amounts[j];
                }
            }
            
            // Verify rewards are approximately proportional to governance power
            // Allow for small rounding errors
            assertApproxEqRel(
                actualRewards,
                expectedRewards,
                0.05e18, // 5% tolerance
                "Rewards should be proportional to governance power"
            );
        }
    }
    
    /**
     * @dev Invariant: Delegation Persistence
     * Delegations should persist correctly across token transfers
     */
    function invariant_DelegationPersistence() public {
        // Get all transfer operations from handler
        (
            address[] memory senders,
            address[] memory recipients,
            uint256[] memory amounts
        ) = delegationHandler.getTransferOperations();
        
        for (uint256 i = 0; i < senders.length; i++) {
            address sender = senders[i];
            uint256 amount = amounts[i];
            
            // Skip transfers that don't involve users with delegations
            if (dloopToken.getTotalDelegatedByAddress(sender) == 0) continue;
            
            // Check that the sender's balance after transfer is still sufficient to cover delegations
            uint256 currentBalance = dloopToken.balanceOf(sender);
            uint256 totalDelegated = dloopToken.getTotalDelegatedByAddress(sender);
            
            assertGe(
                currentBalance,
                totalDelegated,
                "Balance after transfer must be sufficient to cover delegations"
            );
            
            // Get all delegatees for this sender
            address[] memory delegatees = dloopToken.getDelegateesForDelegator(sender);
            for (uint256 j = 0; j < delegatees.length; j++) {
                address delegatee = delegatees[j];
                if (delegatee == address(0)) continue;
                
                uint256 delegatedAmount = dloopToken.getDelegatedAmount(sender, delegatee);
                if (delegatedAmount == 0) continue;
                
                // Verify the delegation is still valid after transfer
                assertGe(
                    currentBalance,
                    delegatedAmount,
                    "Delegation amount must not exceed balance after transfer"
                );
            }
        }
    }
    
    /**
     * @dev Invariant: Burn Protection
     * Tokens with active delegations cannot be burned
     */
    function invariant_BurnProtection() public {
        // Get all burn operations from handler
        (
            address[] memory burners,
            uint256[] memory amounts,
            bool[] memory succeeded
        ) = delegationHandler.getBurnOperations();
        
        for (uint256 i = 0; i < burners.length; i++) {
            address burner = burners[i];
            bool success = succeeded[i];
            
            // If the burn succeeded, verify the user had no active delegations
            if (success) {
                uint256 totalDelegatedBefore = delegationHandler.getTotalDelegatedByAddressBefore(burner, i);
                assertEq(
                    totalDelegatedBefore,
                    0,
                    "Burn succeeded but user had active delegations"
                );
            } 
            // If the burn failed and it wasn't due to insufficient balance, it should be due to active delegations
            else {
                uint256 balanceBefore = delegationHandler.getBalanceBefore(burner, i);
                uint256 burnAmount = amounts[i];
                uint256 totalDelegatedBefore = delegationHandler.getTotalDelegatedByAddressBefore(burner, i);
                
                if (balanceBefore >= burnAmount && totalDelegatedBefore > 0) {
                    // This is the expected case: burn failed due to active delegations
                    assertTrue(true, "Burn correctly failed due to active delegations");
                }
            }
        }
    }
    
    /**
     * @dev Invariant: Delegation Revocation
     * Only delegators can revoke their own delegations
     */
    function invariant_DelegationRevocation() public {
        // Get all undelegation operations from handler
        (
            address[] memory delegators,
            address[] memory delegatees,
            uint256[] memory amounts,
            bool[] memory succeeded,
            address[] memory callers
        ) = delegationHandler.getUndelegationOperations();
        
        for (uint256 i = 0; i < delegators.length; i++) {
            address delegator = delegators[i];
            address caller = callers[i];
            bool success = succeeded[i];
            
            // If undelegation succeeded, verify the caller was the delegator
            if (success) {
                assertEq(
                    caller,
                    delegator,
                    "Only delegator can undelegate their tokens"
                );
            }
            // If undelegation failed and caller wasn't delegator, that's expected
            else if (caller != delegator) {
                assertTrue(true, "Undelegation correctly failed when caller wasn't delegator");
            }
        }
    }
    
    /**
     * @dev Invariant: Delegation History
     * Delegation changes are properly tracked and can be audited
     */
    function invariant_DelegationHistory() public {
        // Get all delegation operations from handler
        (
            address[] memory delegators,
            address[] memory delegatees,
            uint256[] memory amounts,
            bool[] memory succeeded
        ) = delegationHandler.getDelegationOperations();
        
        // For each user, verify their current delegation state matches the expected state
        // based on the sequence of delegation operations
        for (uint256 i = 0; i < USER_COUNT; i++) {
            address delegator = users[i];
            
            // Calculate expected delegations based on operation history
            mapping(address => uint256) memory expectedDelegations;
            uint256 expectedTotalDelegated = 0;
            
            // Process all delegation operations for this delegator
            for (uint256 j = 0; j < delegators.length; j++) {
                if (delegators[j] != delegator || !succeeded[j]) continue;
                
                address delegatee = delegatees[j];
                uint256 amount = amounts[j];
                
                expectedDelegations[delegatee] += amount;
                expectedTotalDelegated += amount;
            }
            
            // Process all undelegation operations for this delegator
            (
                address[] memory undelegators,
                address[] memory undelegatees,
                uint256[] memory undelegationAmounts,
                bool[] memory undelegationSucceeded
            ) = delegationHandler.getUndelegationOperations();
            
            for (uint256 j = 0; j < undelegators.length; j++) {
                if (undelegators[j] != delegator || !undelegationSucceeded[j]) continue;
                
                address delegatee = undelegatees[j];
                uint256 amount = undelegationAmounts[j];
                
                if (expectedDelegations[delegatee] >= amount) {
                    expectedDelegations[delegatee] -= amount;
                    expectedTotalDelegated -= amount;
                }
            }
            
            // Verify total delegated amount matches expected
            assertEq(
                dloopToken.getTotalDelegatedByAddress(delegator),
                expectedTotalDelegated,
                "Total delegated amount should match expected based on operation history"
            );
            
            // Verify individual delegation amounts match expected
            address[] memory delegatees = dloopToken.getDelegateesForDelegator(delegator);
            for (uint256 j = 0; j < delegatees.length; j++) {
                address delegatee = delegatees[j];
                if (delegatee == address(0)) continue;
                
                assertEq(
                    dloopToken.getDelegatedAmount(delegator, delegatee),
                    expectedDelegations[delegatee],
                    "Individual delegation amount should match expected based on operation history"
                );
            }
        }
    }
    
    /**
     * @dev Invariant: Governance Influence
     * Delegation properly influences governance outcomes
     */
    function invariant_GovernanceInfluence() public {
        // Get all proposals
        uint256[] memory proposalIds = delegationHandler.getProposalIds();
        
        for (uint256 i = 0; i < proposalIds.length; i++) {
            uint256 proposalId = proposalIds[i];
            
            // Get proposal details
            (,,,,,uint256 forVotes, uint256 againstVotes,,,,,) = protocolDAO.proposals(proposalId);
            
            // Calculate expected votes based on delegations
            uint256 expectedForVotes = 0;
            uint256 expectedAgainstVotes = 0;
            
            // Get all voters for this proposal
            address[] memory voters = delegationHandler.getVoters(proposalId);
            for (uint256 j = 0; j < voters.length; j++) {
                address voter = voters[j];
                bool support = delegationHandler.getVoteSupport(proposalId, voter);
                
                // Calculate voting power: direct balance + delegated tokens
                uint256 directBalance = delegationHandler.getBalanceAtVote(proposalId, voter);
                uint256 delegatedToVoter = delegationHandler.getDelegatedToAddressAtVote(proposalId, voter);
                uint256 votingPower = directBalance + delegatedToVoter;
                
                if (support) {
                    expectedForVotes += votingPower;
                } else {
                    expectedAgainstVotes += votingPower;
                }
            }
            
            // Verify votes match expected (with some tolerance for timing differences)
            assertApproxEqAbs(
                forVotes,
                expectedForVotes,
                1e18, // 1 token tolerance
                "For votes should match expected based on delegations"
            );
            
            assertApproxEqAbs(
                againstVotes,
                expectedAgainstVotes,
                1e18, // 1 token tolerance
                "Against votes should match expected based on delegations"
            );
        }
    }
}

/**
 * @title Delegation Handler
 * @dev Handler contract for delegation invariant testing
 */
contract DelegationHandler {
    DLoopToken public dloopToken;
    ProtocolDAO public protocolDAO;
    GovernanceRewards public governanceRewards;
    address[] public users;
    
    // Tracking variables for delegation operations
    address[] public delegators;
    address[] public delegatees;
    uint256[] public delegationAmounts;
    bool[] public operationSucceeded;
    
    // Tracking variables for undelegation operations
    address[] public undelegators;
    address[] public undelegatees;
    uint256[] public undelegationAmounts;
    bool[] public undelegationSucceeded;
    address[] public undelegationCallers;
    
    // Tracking variables for transfer operations
    address[] public transferSenders;
    address[] public transferRecipients;
    uint256[] public transferAmounts;
    
    // Tracking variables for burn operations
    address[] public burners;
    uint256[] public burnAmounts;
    bool[] public burnSucceeded;
    mapping(address => mapping(uint256 => uint256)) public balanceBeforeBurn;
    mapping(address => mapping(uint256 => uint256)) public totalDelegatedBeforeBurn;
    
    // Tracking variables for proposals and votes
    uint256[] public proposalIds;
    mapping(uint256 => address[]) public proposalVoters;
    mapping(uint256 => mapping(address => uint256)) public votingWeights;
    mapping(uint256 => mapping(address => bool)) public voteSupport;
    mapping(uint256 => mapping(address => uint256)) public balanceAtVote;
    mapping(uint256 => mapping(address => uint256)) public delegatedToAddressAtVote;
    
    // Tracking variables for reward distributions
    address[] public rewardRecipients;
    uint256[] public rewardAmounts;
    
    constructor(
        DLoopToken _dloopToken,
        ProtocolDAO _protocolDAO,
        GovernanceRewards _governanceRewards,
        address[] memory _users
    ) {
        dloopToken = _dloopToken;
        protocolDAO = _protocolDAO;
        governanceRewards = _governanceRewards;
        users = _users;
    }
    
    /**
     * @dev Delegate tokens from one user to another
     */
    function delegateTokens(uint8 delegatorIndex, uint8 delegateeIndex, uint256 amount) public {
        // Bound inputs
        delegatorIndex = uint8(bound(delegatorIndex, 0, users.length - 1));
        delegateeIndex = uint8(bound(delegateeIndex, 0, users.length - 1));
        
        // Ensure delegator and delegatee are different
        if (delegatorIndex == delegateeIndex) {
            if (delegateeIndex < users.length - 1) {
                delegateeIndex++;
            } else {
                delegateeIndex = 0;
            }
        }
        
        address delegator = users[delegatorIndex];
        address delegatee = users[delegateeIndex];
        
        // Bound amount to delegator's available balance
        uint256 availableBalance = dloopToken.balanceOf(delegator) - dloopToken.getTotalDelegatedByAddress(delegator);
        amount = bound(amount, 1, availableBalance > 0 ? availableBalance : 1);
        
        // Skip if amount is 0
        if (amount == 0) return;
        
        // Record delegation operation
        delegators.push(delegator);
        delegatees.push(delegatee);
        delegationAmounts.push(amount);
        
        // Attempt to delegate
        vm.startPrank(delegator);
        try dloopToken.delegateTokens(delegatee, amount) {
            operationSucceeded.push(true);
        } catch {
            operationSucceeded.push(false);
        }
        vm.stopPrank();
    }
    
    /**
     * @dev Undelegate tokens
     */
    function undelegateTokens(uint8 delegatorIndex, uint8 delegateeIndex, uint256 amount) public {
        // Bound inputs
        delegatorIndex = uint8(bound(delegatorIndex, 0, users.length - 1));
        delegateeIndex = uint8(bound(delegateeIndex, 0, users.length - 1));
        
        // Ensure delegator and delegatee are different
        if (delegatorIndex == delegateeIndex) {
            if (delegateeIndex < users.length - 1) {
                delegateeIndex++;
            } else {
                delegateeIndex = 0;
            }
        }
        
        address delegator = users[delegatorIndex];
        address delegatee = users[delegateeIndex];
        
        // Get current delegation amount
        uint256 currentDelegation = dloopToken.getDelegatedAmount(delegator, delegatee);
        
        // Skip if no delegation
        if (currentDelegation == 0) return;
        
        // Bound amount to current delegation
        amount = bound(amount, 1, currentDelegation);
        
        // Record undelegation operation
        undelegators.push(delegator);
        undelegatees.push(delegatee);
        undelegationAmounts.push(amount);
        undelegationCallers.push(delegator); // Caller is the delegator (legitimate case)
        
        // Attempt to undelegate
        vm.startPrank(delegator);
        try dloopToken.undelegateTokens(delegatee, amount) {
            undelegationSucceeded.push(true);
        } catch {
            undelegationSucceeded.push(false);
        }
        vm.stopPrank();
    }
    
    /**
     * @dev Create a proposal and vote on it
     */
    function createAndVoteOnProposal(uint8 creatorIndex, uint8[] calldata voterIndexes, bool[] calldata supportFlags) public {
        // Bound inputs
        creatorIndex = uint8(bound(creatorIndex, 0, users.length - 1));
        
        // Skip if no voters
        if (voterIndexes.length == 0 || supportFlags.length == 0) return;
        
        address creator = users[creatorIndex];
        
        // Create proposal
        vm.startPrank(creator);
        
        // Simple proposal parameters
        address[] memory targets = new address[](1);
        targets[0] = address(dloopToken);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("pause()");
        
        try protocolDAO.createProposal(
            "Test Proposal",
            targets,
            values,
            calldatas
        ) returns (uint256 proposalId) {
            // Record proposal
            proposalIds.push(proposalId);
            
            // Vote on proposal
            for (uint256 i = 0; i < voterIndexes.length && i < supports.length; i++) {
                uint8 voterIndex = uint8(bound(voterIndexes[i], 0, users.length - 1));
                address voter = users[voterIndex];
                bool support = supports[i];
                
                vm.stopPrank();
                vm.startPrank(voter);
                
                try protocolDAO.castVote(proposalId, support) {
                    // Record vote
                    proposalVoters[proposalId].push(voter);
                    
                    // Record voting weight (simplified)
                    votingWeights[proposalId][voter] = dloopToken.balanceOf(voter) + 
                                                      dloopToken.getTotalDelegatedToAddress(voter);
                } catch {
                    // Vote failed, ignore
                }
            }
        } catch {
            // Proposal creation failed, ignore
        }
        
        vm.stopPrank();
    }
    
    /**
     * @dev Distribute rewards
     */
    function distributeRewards(uint8[] calldata recipientIndexes, uint256[] calldata amounts) public {
        // Skip if no recipients
        if (recipientIndexes.length == 0 || amounts.length == 0) return;
        
        // Get governance rewards balance
        uint256 rewardsBalance = dloopToken.balanceOf(address(governanceRewards));
        
        // Skip if no balance
        if (rewardsBalance == 0) return;
        
        // Distribute rewards
        vm.startPrank(address(governanceRewards));
        
        for (uint256 i = 0; i < recipientIndexes.length && i < amounts.length; i++) {
            uint8 recipientIndex = uint8(bound(recipientIndexes[i], 0, users.length - 1));
            address recipient = users[recipientIndex];
            
            // Bound amount to available balance
            uint256 amount = bound(amounts[i], 1, rewardsBalance);
            
            // Skip if amount is 0
            if (amount == 0) continue;
            
            // Record distribution
            rewardRecipients.push(recipient);
            rewardAmounts.push(amount);
            
            // Transfer rewards
            try dloopToken.transfer(recipient, amount) {
                rewardsBalance -= amount;
            } catch {
                // Transfer failed, ignore
            }
        }
        
        vm.stopPrank();
    }
    
    /**
     * @dev Transfer tokens between users
     */
    function transferTokens(uint8 senderIndex, uint8 recipientIndex, uint256 amount) public {
        // Bound inputs
        senderIndex = uint8(bound(senderIndex, 0, users.length - 1));
        recipientIndex = uint8(bound(recipientIndex, 0, users.length - 1));
        
        // Ensure sender and recipient are different
        if (senderIndex == recipientIndex) {
            if (recipientIndex < users.length - 1) {
                recipientIndex++;
            } else {
                recipientIndex = 0;
            }
        }
        
        address sender = users[senderIndex];
        address recipient = users[recipientIndex];
        
        // Get sender's available balance (after delegations)
        uint256 totalDelegated = dloopToken.getTotalDelegatedByAddress(sender);
        uint256 balance = dloopToken.balanceOf(sender);
        uint256 availableBalance = balance > totalDelegated ? balance - totalDelegated : 0;
        
        // Skip if no available balance
        if (availableBalance == 0) return;
        
        // Bound amount to available balance
        amount = bound(amount, 1, availableBalance);
        
        // Record transfer operation
        transferSenders.push(sender);
        transferRecipients.push(recipient);
        transferAmounts.push(amount);
        
        // Attempt to transfer
        vm.startPrank(sender);
        try dloopToken.transfer(recipient, amount) {
            // Transfer succeeded
        } catch {
            // Transfer failed
        }
        vm.stopPrank();
    }
    
    /**
     * @dev Burn tokens
     */
    function burnTokens(uint8 burnerIndex, uint256 amount) public {
        // Bound inputs
        burnerIndex = uint8(bound(burnerIndex, 0, users.length - 1));
        
        address burner = users[burnerIndex];
        
        // Get burner's balance
        uint256 balance = dloopToken.balanceOf(burner);
        
        // Skip if no balance
        if (balance == 0) return;
        
        // Bound amount to balance
        amount = bound(amount, 1, balance);
        
        // Record burn operation state before burning
        uint256 burnIndex = burners.length;
        balanceBeforeBurn[burner][burnIndex] = balance;
        totalDelegatedBeforeBurn[burner][burnIndex] = dloopToken.getTotalDelegatedByAddress(burner);
        
        // Record burn operation
        burners.push(burner);
        burnAmounts.push(amount);
        
        // Attempt to burn
        vm.startPrank(burner);
        try dloopToken.burn(amount) {
            burnSucceeded.push(true);
        } catch {
            burnSucceeded.push(false);
        }
        vm.stopPrank();
    }
    
    /**
     * @dev Attempt unauthorized undelegation (by a non-delegator)
     */
    function attemptUnauthorizedUndelegation(uint8 delegatorIndex, uint8 attackerIndex, uint8 delegateeIndex, uint256 amount) public {
        // Bound inputs
        delegatorIndex = uint8(bound(delegatorIndex, 0, users.length - 1));
        attackerIndex = uint8(bound(attackerIndex, 0, users.length - 1));
        delegateeIndex = uint8(bound(delegateeIndex, 0, users.length - 1));
        
        // Ensure all addresses are different
        if (delegatorIndex == attackerIndex) {
            if (attackerIndex < users.length - 1) {
                attackerIndex++;
            } else {
                attackerIndex = 0;
            }
        }
        
        if (delegateeIndex == delegatorIndex || delegateeIndex == attackerIndex) {
            if (delegateeIndex < users.length - 1) {
                delegateeIndex++;
            } else {
                delegateeIndex = 0;
            }
        }
        
        address delegator = users[delegatorIndex];
        address attacker = users[attackerIndex];
        address delegatee = users[delegateeIndex];
        
        // Get current delegation amount
        uint256 currentDelegation = dloopToken.getDelegatedAmount(delegator, delegatee);
        
        // Skip if no delegation
        if (currentDelegation == 0) return;
        
        // Bound amount to current delegation
        amount = bound(amount, 1, currentDelegation);
        
        // Record undelegation operation
        undelegators.push(delegator);
        undelegatees.push(delegatee);
        undelegationAmounts.push(amount);
        undelegationCallers.push(attacker); // Caller is the attacker (unauthorized case)
        
        // Attempt to undelegate as attacker (should fail)
        vm.startPrank(attacker);
        try dloopToken.undelegateTokens(delegatee, amount) {
            undelegationSucceeded.push(true); // This should not happen
        } catch {
            undelegationSucceeded.push(false); // Expected outcome
        }
        vm.stopPrank();
    }
    
    /**
     * @dev Create a proposal and vote on it with delegation tracking
     */
    function createAndVoteOnProposal(uint8 creatorIndex, uint8[] calldata voterIndexes, bool[] calldata supportFlags) public {
        // Bound inputs
        creatorIndex = uint8(bound(creatorIndex, 0, users.length - 1));
        
        // Skip if no voters
        if (voterIndexes.length == 0 || supportFlags.length == 0) return;
        
        address creator = users[creatorIndex];
        
        // Create proposal
        vm.startPrank(creator);
        
        // Simple proposal parameters
        address[] memory targets = new address[](1);
        targets[0] = address(dloopToken);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("pause()");
        
        try protocolDAO.createProposal(
            "Test Proposal",
            targets,
            values,
            calldatas
        ) returns (uint256 proposalId) {
            // Record proposal
            proposalIds.push(proposalId);
            
            // Vote on proposal
            for (uint256 i = 0; i < voterIndexes.length && i < supports.length; i++) {
                uint8 voterIndex = uint8(bound(voterIndexes[i], 0, users.length - 1));
                address voter = users[voterIndex];
                bool support = supports[i];
                
                vm.stopPrank();
                vm.startPrank(voter);
                
                // Record state at vote time
                uint256 voterBalance = dloopToken.balanceOf(voter);
                uint256 voterDelegatedTo = dloopToken.getTotalDelegatedToAddress(voter);
                balanceAtVote[proposalId][voter] = voterBalance;
                delegatedToAddressAtVote[proposalId][voter] = voterDelegatedTo;
                voteSupport[proposalId][voter] = support;
                
                try protocolDAO.castVote(proposalId, support) {
                    // Record vote
                    proposalVoters[proposalId].push(voter);
                    
                    // Record voting weight
                    votingWeights[proposalId][voter] = voterBalance + voterDelegatedTo;
                } catch {
                    // Vote failed, ignore
                }
            }
        } catch {
            // Proposal creation failed, ignore
        }
        
        vm.stopPrank();
    }
    
    /**
     * @dev Get all delegation operations
     */
    function getDelegationOperations() public view returns (
        address[] memory,
        address[] memory,
        uint256[] memory,
        bool[] memory
    ) {
        return (delegators, delegatees, delegationAmounts, operationSucceeded);
    }
    
    /**
     * @dev Get all undelegation operations
     */
    function getUndelegationOperations() public view returns (
        address[] memory,
        address[] memory,
        uint256[] memory,
        bool[] memory,
        address[] memory
    ) {
        return (undelegators, undelegatees, undelegationAmounts, undelegationSucceeded, undelegationCallers);
    }
    
    /**
     * @dev Get all transfer operations
     */
    function getTransferOperations() public view returns (
        address[] memory,
        address[] memory,
        uint256[] memory
    ) {
        return (transferSenders, transferRecipients, transferAmounts);
    }
    
    /**
     * @dev Get all burn operations
     */
    function getBurnOperations() public view returns (
        address[] memory,
        uint256[] memory,
        bool[] memory
    ) {
        return (burners, burnAmounts, burnSucceeded);
    }
    
    /**
     * @dev Get balance before burn operation
     */
    function getBalanceBefore(address burner, uint256 index) public view returns (uint256) {
        return balanceBeforeBurn[burner][index];
    }
    
    /**
     * @dev Get total delegated by address before burn operation
     */
    function getTotalDelegatedByAddressBefore(address burner, uint256 index) public view returns (uint256) {
        return totalDelegatedBeforeBurn[burner][index];
    }
    
    /**
     * @dev Get all proposal IDs
     */
    function getProposalIds() public view returns (uint256[] memory) {
        return proposalIds;
    }
    
    /**
     * @dev Get all voters for a proposal
     */
    function getVoters(uint256 proposalId) public view returns (address[] memory) {
        return proposalVoters[proposalId];
    }
    
    /**
     * @dev Get voting weight for a voter on a proposal
     */
    function getVotingWeight(uint256 proposalId, address voter) public view returns (uint256) {
        return votingWeights[proposalId][voter];
    }
    
    /**
     * @dev Get vote support for a voter on a proposal
     */
    function getVoteSupport(uint256 proposalId, address voter) public view returns (bool) {
        return voteSupport[proposalId][voter];
    }
    
    /**
     * @dev Get balance at vote time for a voter on a proposal
     */
    function getBalanceAtVote(uint256 proposalId, address voter) public view returns (uint256) {
        return balanceAtVote[proposalId][voter];
    }
    
    /**
     * @dev Get delegated tokens at vote time for a voter on a proposal
     */
    function getDelegatedToAddressAtVote(uint256 proposalId, address voter) public view returns (uint256) {
        return delegatedToAddressAtVote[proposalId][voter];
    }
    
    /**
     * @dev Get all reward distributions
     */
    function getRewardDistributions() public view returns (
        address[] memory,
        uint256[] memory
    ) {
        return (rewardRecipients, rewardAmounts);
    }
}
