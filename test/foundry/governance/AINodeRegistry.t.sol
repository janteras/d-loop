// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/governance/AINodeRegistry.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/identity/SoulboundNFT.sol";

/**
 * @title AINodeRegistry Fuzz Test
 * @dev Property-based tests for the AINodeRegistry contract
 * 
 * This test focuses on:
 * 1. Node registration with various parameters
 * 2. Staking mechanisms with different token amounts
 * 3. Node state transitions and reputation updates
 * 4. Token requirement configurations
 */
contract AINodeRegistryTest is Test {
    // Contracts
    AINodeRegistry public nodeRegistry;
    DLoopToken public dloopToken;
    SoulboundNFT public soulboundNFT;
    
    // Test accounts
    address public owner;
    address public admin;
    address public governance;
    address public nodeOperator1;
    address public nodeOperator2;
    address public nodeOperator3;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant STAKE_AMOUNT = 10_000 ether;
    uint256 public constant REGISTRATION_PERIOD = 365 days;
    
    // Events to test
    event NodeRegistered(address indexed nodeAddress, address indexed owner, uint256 soulboundTokenId);
    event NodeDeactivated(address indexed nodeAddress, address indexed owner);
    event NodeReputationUpdated(address indexed nodeAddress, uint256 oldReputation, uint256 newReputation);
    event NodeStakeChanged(address indexed nodeAddress, address token, uint256 amount, bool isStake);
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        governance = makeAddr("governance");
        nodeOperator1 = makeAddr("nodeOperator1");
        nodeOperator2 = makeAddr("nodeOperator2");
        nodeOperator3 = makeAddr("nodeOperator3");
        
        // Deploy token with owner as owner
        vm.startPrank(owner);
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            owner
        );
        
        // Deploy SoulboundNFT
        soulboundNFT = new SoulboundNFT(admin);
        
        // Deploy AINodeRegistry
        nodeRegistry = new AINodeRegistry(
            admin,
            governance,
            address(soulboundNFT)
        );
        vm.stopPrank();
        
        // Setup token requirements
        vm.startPrank(admin);
        nodeRegistry.setTokenRequirement(address(dloopToken), STAKE_AMOUNT, true);
        
        // Grant minter role to node registry for SoulboundNFT
        bytes32 minterRole = soulboundNFT.MINTER_ROLE();
        soulboundNFT.grantRole(minterRole, address(nodeRegistry));
        vm.stopPrank();
        
        // Distribute tokens to node operators
        vm.startPrank(owner);
        dloopToken.transfer(nodeOperator1, STAKE_AMOUNT * 2);
        dloopToken.transfer(nodeOperator2, STAKE_AMOUNT * 2);
        dloopToken.transfer(nodeOperator3, STAKE_AMOUNT * 2);
        vm.stopPrank();
        
        // Approve token spending for node operators
        vm.prank(nodeOperator1);
        dloopToken.approve(address(nodeRegistry), STAKE_AMOUNT * 2);
        
        vm.prank(nodeOperator2);
        dloopToken.approve(address(nodeRegistry), STAKE_AMOUNT * 2);
        
        vm.prank(nodeOperator3);
        dloopToken.approve(address(nodeRegistry), STAKE_AMOUNT * 2);
    }
    
    /**
     * @dev Fuzz test for node registration with various metadata
     * @param metadataLength Length of the node metadata
     * @param registrationPeriod Period for which the node is registered
     */
    function testFuzz_NodeRegistration(
        uint8 metadataLength,
        uint256 registrationPeriod
    ) public {
        // Bound inputs to realistic values
        metadataLength = uint8(bound(metadataLength, 5, 100));
        registrationPeriod = bound(registrationPeriod, 30 days, 730 days);
        
        // Generate random metadata
        string memory metadata = generateRandomString(metadataLength);
        
        // Register node as nodeOperator1
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(nodeOperator1, "node")))));
        
        vm.prank(nodeOperator1);
        vm.expectEmit(true, true, false, false);
        emit NodeRegistered(nodeAddress, nodeOperator1, 1); // First token ID should be 1
        nodeRegistry.registerNode(
            nodeAddress,
            metadata,
            registrationPeriod,
            address(dloopToken),
            STAKE_AMOUNT
        );
        
        // Verify node data
        (
            address owner,
            string memory storedMetadata,
            uint256 registeredAt,
            uint256 activeUntil,
            AINodeRegistry.NodeState state,
            uint256 reputation,
            bool exists,
            uint256 stakedAmount,
            address stakedToken,
            uint256 soulboundTokenId
        ) = nodeRegistry.getNodeDetails(nodeAddress);
        
        assertEq(owner, nodeOperator1);
        assertEq(storedMetadata, metadata);
        assertEq(activeUntil, registeredAt + registrationPeriod);
        assertEq(uint8(state), uint8(AINodeRegistry.NodeState.Active));
        assertEq(reputation, 0);
        assertTrue(exists);
        assertEq(stakedAmount, STAKE_AMOUNT);
        assertEq(stakedToken, address(dloopToken));
        assertEq(soulboundTokenId, 1);
        
        // Verify SoulboundNFT ownership
        assertEq(soulboundNFT.ownerOf(soulboundTokenId), nodeOperator1);
    }
    
    /**
     * @dev Fuzz test for staking mechanisms with different token amounts
     * @param additionalStakeAmount Additional amount to stake
     * @param unstakeAmount Amount to unstake
     */
    function testFuzz_StakingMechanisms(
        uint256 additionalStakeAmount,
        uint256 unstakeAmount
    ) public {
        // Bound inputs to realistic values
        additionalStakeAmount = bound(additionalStakeAmount, 1 ether, STAKE_AMOUNT);
        unstakeAmount = bound(unstakeAmount, 1 ether, STAKE_AMOUNT / 2);
        
        // Setup: Register a node first
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(nodeOperator1, "node")))));
        string memory metadata = "Test Node";
        
        vm.prank(nodeOperator1);
        nodeRegistry.registerNode(
            nodeAddress,
            metadata,
            REGISTRATION_PERIOD,
            address(dloopToken),
            STAKE_AMOUNT
        );
        
        // Increase stake
        vm.prank(nodeOperator1);
        vm.expectEmit(true, true, true, true);
        emit NodeStakeChanged(nodeAddress, address(dloopToken), additionalStakeAmount, true);
        nodeRegistry.increaseNodeStake(additionalStakeAmount);
        
        // Verify stake was increased
        (,,,,,,, uint256 stakedAmount,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(stakedAmount, STAKE_AMOUNT + additionalStakeAmount);
        
        // Decrease stake
        vm.prank(nodeOperator1);
        vm.expectEmit(true, true, true, true);
        emit NodeStakeChanged(nodeAddress, address(dloopToken), unstakeAmount, false);
        nodeRegistry.decreaseNodeStake(unstakeAmount);
        
        // Verify stake was decreased
        (,,,,,,, uint256 newStakedAmount,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(newStakedAmount, STAKE_AMOUNT + additionalStakeAmount - unstakeAmount);
    }
    
    /**
     * @dev Fuzz test for node state transitions
     * @param newState New state to set for the node
     * @param reputationChange Change in reputation to apply
     */
    function testFuzz_NodeStateTransitions(
        uint8 newState,
        uint256 reputationChange
    ) public {
        // Bound inputs to realistic values
        newState = uint8(bound(newState, 0, 3)); // 0-3 for NodeState enum
        reputationChange = bound(reputationChange, 1, 1000);
        
        // Setup: Register a node first
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(nodeOperator2, "node")))));
        string memory metadata = "Test Node";
        
        vm.prank(nodeOperator2);
        nodeRegistry.registerNode(
            nodeAddress,
            metadata,
            REGISTRATION_PERIOD,
            address(dloopToken),
            STAKE_AMOUNT
        );
        
        // Update node state
        vm.prank(admin);
        nodeRegistry.updateNodeState(nodeAddress, AINodeRegistry.NodeState(newState));
        
        // Verify state was updated
        (,,,, AINodeRegistry.NodeState state,,,,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(uint8(state), newState);
        
        // Update node reputation
        vm.prank(governance);
        vm.expectEmit(true, false, false, false);
        emit NodeReputationUpdated(nodeAddress, 0, reputationChange);
        nodeRegistry.updateNodeReputation(nodeAddress, reputationChange);
        
        // Verify reputation was updated
        (,,,,, uint256 reputation,,,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(reputation, reputationChange);
    }
    
    /**
     * @dev Fuzz test for token requirement configurations
     * @param tokenCount Number of tokens to configure
     * @param requirementAmount Amount required for each token
     */
    function testFuzz_TokenRequirements(
        uint8 tokenCount,
        uint256 requirementAmount
    ) public {
        // Bound inputs to realistic values
        tokenCount = uint8(bound(tokenCount, 1, 5));
        requirementAmount = bound(requirementAmount, 100 ether, 50_000 ether);
        
        // Generate random token addresses
        address[] memory tokens = new address[](tokenCount);
        for (uint8 i = 0; i < tokenCount; i++) {
            tokens[i] = address(uint160(uint256(keccak256(abi.encodePacked("token", i)))));
        }
        
        // Set token requirements
        vm.startPrank(admin);
        for (uint8 i = 0; i < tokenCount; i++) {
            nodeRegistry.setTokenRequirement(tokens[i], requirementAmount, true);
        }
        vm.stopPrank();
        
        // Verify token requirements
        for (uint8 i = 0; i < tokenCount; i++) {
            (address token, uint256 amount, bool isActive) = nodeRegistry.getTokenRequirement(tokens[i]);
            assertEq(token, tokens[i]);
            assertEq(amount, requirementAmount);
            assertTrue(isActive);
        }
        
        // Deactivate half the token requirements
        vm.startPrank(admin);
        for (uint8 i = 0; i < tokenCount / 2; i++) {
            nodeRegistry.setTokenRequirement(tokens[i], requirementAmount, false);
        }
        vm.stopPrank();
        
        // Verify deactivated token requirements
        for (uint8 i = 0; i < tokenCount / 2; i++) {
            (address token, uint256 amount, bool isActive) = nodeRegistry.getTokenRequirement(tokens[i]);
            assertEq(token, tokens[i]);
            assertEq(amount, requirementAmount);
            assertFalse(isActive);
        }
        
        // Verify remaining token requirements are still active
        for (uint8 i = tokenCount / 2; i < tokenCount; i++) {
            (address token, uint256 amount, bool isActive) = nodeRegistry.getTokenRequirement(tokens[i]);
            assertEq(token, tokens[i]);
            assertEq(amount, requirementAmount);
            assertTrue(isActive);
        }
    }
    
    /**
     * @dev Fuzz test for node deactivation and reactivation
     */
    function testFuzz_NodeDeactivation() public {
        // Setup: Register a node first
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(nodeOperator3, "node")))));
        string memory metadata = "Test Node";
        
        vm.prank(nodeOperator3);
        nodeRegistry.registerNode(
            nodeAddress,
            metadata,
            REGISTRATION_PERIOD,
            address(dloopToken),
            STAKE_AMOUNT
        );
        
        // Deactivate node
        vm.prank(nodeOperator3);
        vm.expectEmit(true, true, false, false);
        emit NodeDeactivated(nodeAddress, nodeOperator3);
        nodeRegistry.deregisterNode();
        
        // Verify node state
        (,,,, AINodeRegistry.NodeState state,,,,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(uint8(state), uint8(AINodeRegistry.NodeState.Inactive));
        
        // Reactivate node (admin can change state back to active)
        vm.prank(admin);
        nodeRegistry.updateNodeState(nodeAddress, AINodeRegistry.NodeState.Active);
        
        // Verify node state
        (,,,, AINodeRegistry.NodeState newState,,,,,) = nodeRegistry.getNodeDetails(nodeAddress);
        assertEq(uint8(newState), uint8(AINodeRegistry.NodeState.Active));
    }
    
    /**
     * @dev Helper function to generate a random string of specified length
     * @param length Length of the string to generate
     * @return result Random string
     */
    function generateRandomString(uint8 length) internal pure returns (string memory) {
        bytes memory chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        bytes memory result = new bytes(length);
        
        for (uint8 i = 0; i < length; i++) {
            uint8 randomIndex = uint8(uint256(keccak256(abi.encodePacked(i, length))) % chars.length);
            result[i] = chars[randomIndex];
        }
        
        return string(result);
    }
}
