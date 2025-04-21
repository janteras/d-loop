// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/core/ProtocolDAO.sol";
import "../../../contracts/core/AssetDAO.sol";
import "../../../contracts/governance/AINodeRegistry.sol";
import "../../../contracts/governance/GovernanceRewards.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/token/DAIToken.sol";
import "../../../contracts/identity/SoulboundNFT.sol";
import "../../../contracts/fees/FeeProcessor.sol";

/**
 * @title Protocol Integration Fuzz Test
 * @dev Tests interactions between multiple contracts in the D-Loop protocol
 * 
 * This test focuses on:
 * 1. End-to-end governance flows
 * 2. Asset creation and management with node participation
 * 3. Reward distribution based on governance actions
 * 4. Fee processing across multiple components
 */
contract ProtocolIntegrationTest is Test {
    // Core contracts
    ProtocolDAO public protocolDAO;
    AssetDAO public assetDAO;
    AINodeRegistry public nodeRegistry;
    GovernanceRewards public governanceRewards;
    
    // Token contracts
    DLoopToken public dloopToken;
    DAIToken public daiToken;
    SoulboundNFT public soulboundNFT;
    
    // Utility contracts
    FeeProcessor public feeProcessor;
    
    // Test accounts
    address public owner;
    address public admin;
    address public treasury;
    address public user1;
    address public user2;
    address public nodeOperator;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant QUORUM = 10; // 10%
    uint256 public constant NODE_STAKE = 10_000 ether;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        nodeOperator = makeAddr("nodeOperator");
        
        vm.startPrank(owner);
        
        // Deploy tokens
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            owner
        );
        
        daiToken = new DAIToken();
        
        // Deploy SoulboundNFT
        soulboundNFT = new SoulboundNFT(admin);
        
        // Deploy utility contracts
        feeProcessor = new FeeProcessor();
        
        // Deploy core contracts
        protocolDAO = new ProtocolDAO();
        protocolDAO.initialize(
            VOTING_PERIOD,
            EXECUTION_DELAY,
            QUORUM,
            admin,
            treasury
        );
        
        assetDAO = new AssetDAO(
            address(daiToken),
            address(dloopToken),
            address(feeProcessor),
            admin,
            treasury
        );
        
        nodeRegistry = new AINodeRegistry(
            admin,
            address(protocolDAO),
            address(soulboundNFT)
        );
        
        governanceRewards = new GovernanceRewards(
            address(dloopToken),
            admin,
            treasury
        );
        
        // Setup roles and permissions
        bytes32 minterRole = daiToken.MINTER_ROLE();
        daiToken.grantRole(minterRole, address(assetDAO));
        
        bytes32 distributorRole = governanceRewards.DISTRIBUTOR_ROLE();
        governanceRewards.grantRole(distributorRole, address(protocolDAO));
        
        bytes32 minterRoleNFT = soulboundNFT.MINTER_ROLE();
        soulboundNFT.grantRole(minterRoleNFT, address(nodeRegistry));
        
        // Configure node registry
        vm.stopPrank();
        
        vm.startPrank(admin);
        nodeRegistry.setTokenRequirement(address(dloopToken), NODE_STAKE, true);
        vm.stopPrank();
        
        // Distribute tokens
        vm.startPrank(owner);
        dloopToken.transfer(user1, 100_000 ether);
        dloopToken.transfer(user2, 150_000 ether);
        dloopToken.transfer(nodeOperator, 50_000 ether);
        dloopToken.transfer(address(governanceRewards), 200_000 ether);
        vm.stopPrank();
        
        // Approvals
        vm.prank(user1);
        dloopToken.approve(address(assetDAO), 100_000 ether);
        
        vm.prank(user2);
        dloopToken.approve(address(assetDAO), 150_000 ether);
        
        vm.prank(nodeOperator);
        dloopToken.approve(address(nodeRegistry), 50_000 ether);
    }
    
    /**
     * @dev Fuzz test for end-to-end governance flow with reward distribution
     * @param proposalDescription Length of proposal description
     * @param voteDelay Time to wait before voting
     * @param user1VoteSupport Whether user1 supports the proposal
     * @param user2VoteSupport Whether user2 supports the proposal
     */
    function testFuzz_GovernanceFlow(
        uint8 proposalDescription,
        uint32 voteDelay,
        bool user1VoteSupport,
        bool user2VoteSupport
    ) public {
        // Bound inputs
        proposalDescription = uint8(bound(proposalDescription, 5, 100));
        voteDelay = uint32(bound(voteDelay, 1 hours, VOTING_PERIOD - 1 hours));
        
        // Generate proposal description
        string memory description = generateRandomString(proposalDescription);
        
        // Create a proposal to whitelist a token
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(protocolDAO);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("whitelistToken(address,bool)", address(daiToken), true);
        
        vm.prank(user1);
        uint256 proposalId = protocolDAO.createProposal(description, targets, values, calldatas);
        
        // Warp time to allow voting
        vm.warp(block.timestamp + voteDelay);
        
        // Cast votes
        vm.prank(user1);
        protocolDAO.castVote(proposalId, user1VoteSupport);
        
        vm.prank(user2);
        protocolDAO.castVote(proposalId, user2VoteSupport);
        
        // Warp time to after voting period
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        
        // Get proposal details to determine if it passed
        (
            ,
            ,
            ,
            ,
            ,
            uint256 forVotes,
            uint256 againstVotes,
            bool executed,
            ,
            ,
            ,
            
        ) = protocolDAO.proposals(proposalId);
        
        // Execute proposal if it passed
        if (forVotes > againstVotes && !executed) {
            // Warp time to after execution delay
            vm.warp(block.timestamp + EXECUTION_DELAY + 1);
            
            vm.prank(user1);
            protocolDAO.executeProposal(proposalId);
            
            // Verify token was whitelisted if proposal was executed
            assertTrue(protocolDAO.whitelistedTokens(address(daiToken)));
            
            // Verify rewards were distributed
            uint256 user1Rewards = governanceRewards.getRewards(user1);
            uint256 user2Rewards = governanceRewards.getRewards(user2);
            
            // At least one user should have rewards
            assertTrue(user1Rewards > 0 || user2Rewards > 0);
            
            // Claim rewards
            if (user1Rewards > 0) {
                vm.prank(user1);
                governanceRewards.claimRewards();
            }
            
            if (user2Rewards > 0) {
                vm.prank(user2);
                governanceRewards.claimRewards();
            }
        }
    }
    
    /**
     * @dev Fuzz test for node registration and participation in asset governance
     * @param nodeMetadataLength Length of node metadata
     * @param registrationPeriod Period for node registration
     * @param assetTargetAmount Target amount for asset
     * @param investmentAmount Amount to invest in asset
     */
    function testFuzz_NodeAssetInteraction(
        uint8 nodeMetadataLength,
        uint256 registrationPeriod,
        uint256 assetTargetAmount,
        uint256 investmentAmount
    ) public {
        // Bound inputs
        nodeMetadataLength = uint8(bound(nodeMetadataLength, 5, 100));
        registrationPeriod = bound(registrationPeriod, 30 days, 365 days);
        assetTargetAmount = bound(assetTargetAmount, 1000 ether, 100_000 ether);
        investmentAmount = bound(investmentAmount, 100 ether, 10_000 ether);
        
        // Generate node metadata
        string memory nodeMetadata = generateRandomString(nodeMetadataLength);
        
        // Register a node
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(nodeOperator, "node")))));
        
        vm.prank(nodeOperator);
        nodeRegistry.registerNode(
            nodeAddress,
            nodeMetadata,
            registrationPeriod,
            address(dloopToken),
            NODE_STAKE
        );
        
        // Create an asset
        vm.prank(admin);
        uint256 assetId = assetDAO.createAsset(
            "Test Asset",
            "A test asset for fuzz testing",
            assetTargetAmount,
            investmentAmount / 10,
            block.timestamp + 30 days
        );
        
        // Invest in the asset
        vm.prank(user1);
        assetDAO.invest(assetId, investmentAmount);
        
        // Create a proposal for the asset
        vm.prank(user1);
        uint256 proposalId = assetDAO.createProposal(
            AssetDAO.ProposalType.Investment,
            nodeAddress,
            investmentAmount / 2,
            "Invest in node operation"
        );
        
        // Vote on the proposal
        vm.prank(user1);
        assetDAO.vote(proposalId, true);
        
        // Warp time to after voting period
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        
        // Execute proposal
        vm.prank(user1);
        assetDAO.executeProposal(proposalId);
        
        // Verify node reputation was updated
        uint256 nodeReputation = nodeRegistry.getNodeReputation(nodeAddress);
        assertGt(nodeReputation, 0, "Node reputation should increase after successful investment");
    }
    
    /**
     * @dev Fuzz test for fee processing across multiple protocol components
     * @param feePercentage Fee percentage to set
     * @param assetCount Number of assets to create
     * @param operationCount Number of operations to perform
     */
    function testFuzz_FeeProcessing(
        uint8 feePercentage,
        uint8 assetCount,
        uint8 operationCount
    ) public {
        // Bound inputs
        feePercentage = uint8(bound(feePercentage, 1, 10)); // 1-10%
        assetCount = uint8(bound(assetCount, 1, 3));
        operationCount = uint8(bound(operationCount, 1, 5));
        
        // Set fee percentage
        vm.prank(admin);
        feeProcessor.setFeePercentage(feePercentage);
        
        // Create assets
        uint256[] memory assetIds = new uint256[](assetCount);
        for (uint8 i = 0; i < assetCount; i++) {
            vm.prank(admin);
            assetIds[i] = assetDAO.createAsset(
                string(abi.encodePacked("Asset ", uint8(i + 65))),
                "Asset for fee testing",
                10_000 ether,
                1_000 ether,
                block.timestamp + 30 days
            );
        }
        
        // Initial treasury balance
        uint256 initialTreasuryBalance = dloopToken.balanceOf(treasury);
        
        // Perform operations
        for (uint8 i = 0; i < operationCount; i++) {
            // Alternate between users
            address user = i % 2 == 0 ? user1 : user2;
            
            // Alternate between assets
            uint256 assetId = assetIds[i % assetCount];
            
            // Invest in asset
            vm.prank(user);
            assetDAO.invest(assetId, 1_000 ether);
            
            // Create and vote on proposal
            vm.prank(user);
            uint256 proposalId = assetDAO.createProposal(
                AssetDAO.ProposalType.Investment,
                address(daiToken),
                500 ether,
                "Investment proposal"
            );
            
            vm.prank(user);
            assetDAO.vote(proposalId, true);
        }
        
        // Final treasury balance
        uint256 finalTreasuryBalance = dloopToken.balanceOf(treasury);
        
        // Verify fees were collected
        assertGt(finalTreasuryBalance, initialTreasuryBalance, "Treasury should receive fees");
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
