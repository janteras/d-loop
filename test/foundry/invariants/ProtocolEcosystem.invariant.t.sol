// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../../../contracts/core/ProtocolDAO.sol";
import "../../../contracts/core/AssetDAO.sol";
import "../../../contracts/governance/AINodeRegistry.sol";
import "../../../contracts/governance/GovernanceRewards.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/token/DAIToken.sol";
import "../../../contracts/identity/SoulboundNFT.sol";
import "../../../contracts/fees/FeeProcessor.sol";

/**
 * @title Protocol Ecosystem Invariant Test
 * @dev System-wide property tests for the entire D-Loop protocol ecosystem
 * 
 * This test verifies that critical invariants hold true across the entire protocol:
 * 1. Token supply conservation (tokens are neither created nor destroyed unexpectedly)
 * 2. Protocol treasury balance only increases (no unauthorized outflows)
 * 3. Node registry and asset relationships maintain consistency
 * 4. Governance power remains proportional to token holdings
 * 5. Fee distribution follows the defined percentages
 */
contract ProtocolEcosystemInvariantTest is StdInvariant, Test {
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
    address[] public users;
    address[] public nodeOperators;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant USER_COUNT = 5;
    uint256 public constant NODE_OPERATOR_COUNT = 3;
    uint256 public constant INITIAL_USER_BALANCE = 10_000 ether;
    uint256 public constant NODE_STAKE = 5_000 ether;
    
    // Tracking variables for invariants
    uint256 public initialTreasuryBalance;
    uint256 public initialTotalSupply;
    mapping(address => uint256) public initialUserBalances;
    uint256[] public assetIds;
    uint256 public nodeCount;
    uint256 public proposalCount;
    uint256 public totalFeesCollected;
    mapping(address => uint256) public userRewards;
    
    // Handler contracts
    AssetDAOHandler public assetDAOHandler;
    ProtocolDAOHandler public protocolDAOHandler;
    NodeRegistryHandler public nodeRegistryHandler;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        
        // Create user accounts
        users = new address[](USER_COUNT);
        for (uint256 i = 0; i < USER_COUNT; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
        }
        
        // Create node operator accounts
        nodeOperators = new address[](NODE_OPERATOR_COUNT);
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            nodeOperators[i] = makeAddr(string(abi.encodePacked("nodeOperator", i)));
        }
        
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
        feeProcessor.initialize(
            admin,
            treasury,
            address(0), // No reward distributor initially
            7000, // 70% to treasury
            3000  // 30% to reward distributor
        );
        
        // Deploy core contracts
        protocolDAO = new ProtocolDAO();
        protocolDAO.initialize(
            3 days, // Voting period
            1 days, // Execution delay
            10,     // Quorum (10%)
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
        
        bytes32 authorizedRole = feeProcessor.AUTHORIZED_CONTRACT_ROLE();
        feeProcessor.grantRole(authorizedRole, address(assetDAO));
        
        // Update reward distributor in fee processor
        feeProcessor.updateRewardDistributor(address(governanceRewards));
        
        // Configure node registry
        vm.stopPrank();
        
        vm.prank(admin);
        nodeRegistry.setTokenRequirement(address(dloopToken), NODE_STAKE, true);
        
        // Distribute tokens
        vm.startPrank(owner);
        
        // Distribute to users
        for (uint256 i = 0; i < USER_COUNT; i++) {
            dloopToken.transfer(users[i], INITIAL_USER_BALANCE);
            initialUserBalances[users[i]] = INITIAL_USER_BALANCE;
        }
        
        // Distribute to node operators
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            dloopToken.transfer(nodeOperators[i], NODE_STAKE * 2);
            initialUserBalances[nodeOperators[i]] = NODE_STAKE * 2;
        }
        
        // Transfer tokens to governance rewards
        dloopToken.transfer(address(governanceRewards), 100_000 ether);
        
        vm.stopPrank();
        
        // Record initial state
        initialTreasuryBalance = dloopToken.balanceOf(treasury);
        initialTotalSupply = dloopToken.totalSupply();
        
        // Approvals
        for (uint256 i = 0; i < USER_COUNT; i++) {
            vm.prank(users[i]);
            dloopToken.approve(address(assetDAO), type(uint256).max);
        }
        
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            vm.prank(nodeOperators[i]);
            dloopToken.approve(address(nodeRegistry), type(uint256).max);
        }
        
        // Deploy handler contracts
        assetDAOHandler = new AssetDAOHandler(
            assetDAO,
            dloopToken,
            daiToken,
            users
        );
        
        protocolDAOHandler = new ProtocolDAOHandler(
            protocolDAO,
            dloopToken,
            users
        );
        
        nodeRegistryHandler = new NodeRegistryHandler(
            nodeRegistry,
            dloopToken,
            nodeOperators
        );
        
        // Target contracts for invariant testing
        targetContract(address(assetDAOHandler));
        targetContract(address(protocolDAOHandler));
        targetContract(address(nodeRegistryHandler));
    }
    
    /**
     * @dev Invariant: Token supply conservation
     * The total supply of DLOOP tokens should remain constant
     */
    function invariant_TokenSupplyConservation() public {
        uint256 currentTotalSupply = dloopToken.totalSupply();
        assertEq(currentTotalSupply, initialTotalSupply, "Total token supply should remain constant");
    }
    
    /**
     * @dev Invariant: Treasury balance never decreases
     * The treasury balance should only increase or stay the same
     */
    function invariant_TreasuryBalanceNeverDecreases() public {
        uint256 currentTreasuryBalance = dloopToken.balanceOf(treasury);
        assertGe(currentTreasuryBalance, initialTreasuryBalance, "Treasury balance should never decrease");
    }
    
    /**
     * @dev Invariant: Sum of user balances and staked amounts equals initial distribution
     * The sum of all user balances, staked amounts, and protocol-held tokens should equal the initial distribution
     */
    function invariant_UserBalanceConservation() public {
        uint256 totalUserBalance = 0;
        uint256 totalStakedAmount = 0;
        
        // Sum user balances
        for (uint256 i = 0; i < USER_COUNT; i++) {
            totalUserBalance += dloopToken.balanceOf(users[i]);
        }
        
        // Sum node operator balances
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            totalUserBalance += dloopToken.balanceOf(nodeOperators[i]);
        }
        
        // Sum staked amounts in node registry
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            address[] memory nodeAddresses = nodeRegistryHandler.getNodeAddresses(nodeOperators[i]);
            for (uint256 j = 0; j < nodeAddresses.length; j++) {
                (,,,,,,, uint256 stakedAmount,,) = nodeRegistry.getNodeDetails(nodeAddresses[j]);
                totalStakedAmount += stakedAmount;
            }
        }
        
        // Sum protocol-held tokens
        uint256 protocolHeldTokens = 
            dloopToken.balanceOf(address(assetDAO)) +
            dloopToken.balanceOf(address(nodeRegistry)) +
            dloopToken.balanceOf(address(governanceRewards)) +
            dloopToken.balanceOf(treasury);
        
        // Calculate total distributed tokens
        uint256 totalDistributedTokens = 0;
        for (uint256 i = 0; i < USER_COUNT; i++) {
            totalDistributedTokens += initialUserBalances[users[i]];
        }
        
        for (uint256 i = 0; i < NODE_OPERATOR_COUNT; i++) {
            totalDistributedTokens += initialUserBalances[nodeOperators[i]];
        }
        
        // Add tokens sent to governance rewards
        totalDistributedTokens += 100_000 ether;
        
        // Verify conservation
        assertApproxEqAbs(
            totalUserBalance + totalStakedAmount + protocolHeldTokens,
            totalDistributedTokens,
            1 ether, // Allow for small rounding errors
            "Sum of user balances, staked amounts, and protocol-held tokens should equal initial distribution"
        );
    }
    
    /**
     * @dev Invariant: Node registry consistency
     * For each registered node, the owner should have a valid soulbound token
     */
    function invariant_NodeRegistryConsistency() public {
        address[] memory allNodeAddresses = nodeRegistryHandler.getAllNodeAddresses();
        
        for (uint256 i = 0; i < allNodeAddresses.length; i++) {
            address nodeAddress = allNodeAddresses[i];
            (address owner,,,, AINodeRegistry.NodeState state,,,, uint256 soulboundTokenId) = nodeRegistry.getNodeDetails(nodeAddress);
            
            // Skip inactive nodes
            if (state == AINodeRegistry.NodeState.Inactive) continue;
            
            // Verify soulbound token ownership
            assertEq(soulboundNFT.ownerOf(soulboundTokenId), owner, "Node owner should own the soulbound token");
        }
    }
    
    /**
     * @dev Invariant: Governance power proportionality
     * Voting power in ProtocolDAO should be proportional to token holdings
     */
    function invariant_GovernancePowerProportionality() public {
        uint256[] memory proposalIds = protocolDAOHandler.getProposalIds();
        
        for (uint256 i = 0; i < proposalIds.length; i++) {
            uint256 proposalId = proposalIds[i];
            
            // Get proposal details
            (,,,,,uint256 forVotes, uint256 againstVotes,,,,,) = protocolDAO.proposals(proposalId);
            
            // Get voter details
            address[] memory voters = protocolDAOHandler.getVoters(proposalId);
            uint256 totalVotingPower = 0;
            
            for (uint256 j = 0; j < voters.length; j++) {
                address voter = voters[j];
                bool support = protocolDAOHandler.getVoteSupport(proposalId, voter);
                
                // Voting power should be equal to token balance at vote time
                // For simplicity, we use current balance as an approximation
                uint256 voterBalance = dloopToken.balanceOf(voter);
                totalVotingPower += voterBalance;
                
                // This is a simplified check - in a real system, we'd need to track
                // balances at the time of voting
                if (support) {
                    assertLe(voterBalance, forVotes, "For votes should not exceed voter balance");
                } else {
                    assertLe(voterBalance, againstVotes, "Against votes should not exceed voter balance");
                }
            }
            
            // Total votes should not exceed total voting power
            assertLe(forVotes + againstVotes, totalVotingPower, "Total votes should not exceed total voting power");
        }
    }
    
    /**
     * @dev Invariant: Fee distribution follows defined percentages
     * Fees should be distributed according to the defined percentages
     */
    function invariant_FeeDistributionPercentages() public {
        // Get fee distribution parameters
        uint256 treasuryPercentage = feeProcessor.treasuryPercentage();
        uint256 rewardDistPercentage = feeProcessor.rewardDistPercentage();
        
        // Get total fees collected
        uint256 totalFees = assetDAOHandler.getTotalFeesCollected();
        
        if (totalFees == 0) return; // Skip if no fees collected
        
        // Get distributed amounts
        uint256 treasuryAmount = dloopToken.balanceOf(treasury) - initialTreasuryBalance;
        uint256 rewardDistAmount = dloopToken.balanceOf(address(governanceRewards)) - 100_000 ether;
        
        // Calculate expected distributions
        uint256 expectedTreasuryAmount = (totalFees * treasuryPercentage) / 10000;
        uint256 expectedRewardDistAmount = (totalFees * rewardDistPercentage) / 10000;
        
        // Allow for small rounding errors
        assertApproxEqAbs(
            treasuryAmount,
            expectedTreasuryAmount,
            totalFees / 10000, // 0.01% tolerance
            "Treasury amount should match expected distribution"
        );
        
        assertApproxEqAbs(
            rewardDistAmount,
            expectedRewardDistAmount,
            totalFees / 10000, // 0.01% tolerance
            "Reward distributor amount should match expected distribution"
        );
    }
}

/**
 * @title AssetDAO Handler
 * @dev Handler contract for AssetDAO invariant testing
 */
contract AssetDAOHandler {
    AssetDAO public assetDAO;
    DLoopToken public dloopToken;
    DAIToken public daiToken;
    address[] public users;
    
    uint256[] public assetIds;
    uint256 public totalFeesCollected;
    
    constructor(
        AssetDAO _assetDAO,
        DLoopToken _dloopToken,
        DAIToken _daiToken,
        address[] memory _users
    ) {
        assetDAO = _assetDAO;
        dloopToken = _dloopToken;
        daiToken = _daiToken;
        users = _users;
    }
    
    function createAsset(uint256 userSeed, uint256 targetAmount, uint256 minInvestment) public {
        // Select a user
        address user = users[userSeed % users.length];
        
        // Bound inputs
        targetAmount = bound(targetAmount, 1000 ether, 100_000 ether);
        minInvestment = bound(minInvestment, 10 ether, targetAmount / 10);
        
        // Create asset
        vm.prank(user);
        try assetDAO.createAsset(
            "Test Asset",
            "A test asset for invariant testing",
            targetAmount,
            minInvestment,
            block.timestamp + 30 days
        ) returns (uint256 assetId) {
            assetIds.push(assetId);
        } catch {
            // Ignore failures
        }
    }
    
    function invest(uint256 userSeed, uint256 assetIdSeed, uint256 amount) public {
        if (assetIds.length == 0) return;
        
        // Select a user and asset
        address user = users[userSeed % users.length];
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Bound amount
        amount = bound(amount, 1 ether, 1000 ether);
        
        // Invest
        vm.prank(user);
        try assetDAO.invest(assetId, amount) {
            // Track fees
            totalFeesCollected += amount / 100; // Approximate fee calculation
        } catch {
            // Ignore failures
        }
    }
    
    function divest(uint256 userSeed, uint256 assetIdSeed, uint256 sharePercentage) public {
        if (assetIds.length == 0) return;
        
        // Select a user and asset
        address user = users[userSeed % users.length];
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Bound share percentage
        sharePercentage = bound(sharePercentage, 1, 100);
        
        // Get user shares
        uint256 shares = assetDAO.getInvestorShares(assetId, user);
        if (shares == 0) return;
        
        uint256 sharesToDivest = (shares * sharePercentage) / 100;
        if (sharesToDivest == 0) return;
        
        // Divest
        vm.prank(user);
        try assetDAO.divest(assetId, sharesToDivest) {
            // Track fees
            totalFeesCollected += sharesToDivest / 100; // Approximate fee calculation
        } catch {
            // Ignore failures
        }
    }
    
    function createProposal(uint256 userSeed, uint256 assetIdSeed, uint256 proposalTypeSeed) public {
        if (assetIds.length == 0) return;
        
        // Select a user and asset
        address user = users[userSeed % users.length];
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Get proposal type
        uint8 proposalType = uint8(proposalTypeSeed % 4);
        
        // Get user shares
        uint256 shares = assetDAO.getInvestorShares(assetId, user);
        if (shares == 0) return;
        
        // Create proposal
        vm.prank(user);
        try assetDAO.createProposal(
            AssetDAO.ProposalType(proposalType),
            address(daiToken),
            1000 ether,
            "Test proposal"
        ) {
            // No fee tracking needed for proposals
        } catch {
            // Ignore failures
        }
    }
    
    function vote(uint256 userSeed, uint256 assetIdSeed, uint256 proposalId, bool support) public {
        if (assetIds.length == 0) return;
        
        // Select a user and asset
        address user = users[userSeed % users.length];
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Get user shares
        uint256 shares = assetDAO.getInvestorShares(assetId, user);
        if (shares == 0) return;
        
        // Vote
        vm.prank(user);
        try assetDAO.vote(proposalId, support) {
            // No fee tracking needed for votes
        } catch {
            // Ignore failures
        }
    }
    
    function getTotalFeesCollected() public view returns (uint256) {
        return totalFeesCollected;
    }
    
    function getAssetIds() public view returns (uint256[] memory) {
        return assetIds;
    }
}

/**
 * @title ProtocolDAO Handler
 * @dev Handler contract for ProtocolDAO invariant testing
 */
contract ProtocolDAOHandler {
    ProtocolDAO public protocolDAO;
    DLoopToken public dloopToken;
    address[] public users;
    
    uint256[] public proposalIds;
    mapping(uint256 => address[]) public proposalVoters;
    mapping(uint256 => mapping(address => bool)) public voteSupport;
    
    constructor(
        ProtocolDAO _protocolDAO,
        DLoopToken _dloopToken,
        address[] memory _users
    ) {
        protocolDAO = _protocolDAO;
        dloopToken = _dloopToken;
        users = _users;
    }
    
    function createProposal(uint256 userSeed, uint256 descriptionSeed) public {
        // Select a user
        address user = users[userSeed % users.length];
        
        // Create proposal data
        string memory description = string(abi.encodePacked("Proposal ", descriptionSeed));
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(protocolDAO);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("whitelistToken(address,bool)", address(dloopToken), true);
        
        // Create proposal
        vm.prank(user);
        try protocolDAO.createProposal(description, targets, values, calldatas) returns (uint256 proposalId) {
            proposalIds.push(proposalId);
        } catch {
            // Ignore failures
        }
    }
    
    function castVote(uint256 userSeed, uint256 proposalIdSeed, bool support) public {
        if (proposalIds.length == 0) return;
        
        // Select a user and proposal
        address user = users[userSeed % users.length];
        uint256 proposalId = proposalIds[proposalIdSeed % proposalIds.length];
        
        // Cast vote
        vm.prank(user);
        try protocolDAO.castVote(proposalId, support) {
            // Record voter and support
            proposalVoters[proposalId].push(user);
            voteSupport[proposalId][user] = support;
        } catch {
            // Ignore failures
        }
    }
    
    function executeProposal(uint256 proposalIdSeed) public {
        if (proposalIds.length == 0) return;
        
        // Select a proposal
        uint256 proposalId = proposalIds[proposalIdSeed % proposalIds.length];
        
        // Get proposal details
        (,,,uint256 votingEnds,,,,bool executed,,,) = protocolDAO.proposals(proposalId);
        
        // Skip if already executed or voting not ended
        if (executed || block.timestamp <= votingEnds) return;
        
        // Execute proposal
        vm.warp(block.timestamp + 1 days); // Warp time to after execution delay
        
        vm.prank(users[0]);
        try protocolDAO.executeProposal(proposalId) {
            // No additional tracking needed
        } catch {
            // Ignore failures
        }
    }
    
    function getProposalIds() public view returns (uint256[] memory) {
        return proposalIds;
    }
    
    function getVoters(uint256 proposalId) public view returns (address[] memory) {
        return proposalVoters[proposalId];
    }
    
    function getVoteSupport(uint256 proposalId, address voter) public view returns (bool) {
        return voteSupport[proposalId][voter];
    }
}

/**
 * @title NodeRegistry Handler
 * @dev Handler contract for AINodeRegistry invariant testing
 */
contract NodeRegistryHandler {
    AINodeRegistry public nodeRegistry;
    DLoopToken public dloopToken;
    address[] public nodeOperators;
    
    mapping(address => address[]) public operatorNodes;
    address[] public allNodeAddresses;
    
    constructor(
        AINodeRegistry _nodeRegistry,
        DLoopToken _dloopToken,
        address[] memory _nodeOperators
    ) {
        nodeRegistry = _nodeRegistry;
        dloopToken = _dloopToken;
        nodeOperators = _nodeOperators;
    }
    
    function registerNode(uint256 operatorSeed, uint256 metadataSeed, uint256 registrationPeriod) public {
        // Select a node operator
        address operator = nodeOperators[operatorSeed % nodeOperators.length];
        
        // Generate node address
        address nodeAddress = address(uint160(uint256(keccak256(abi.encodePacked(operator, metadataSeed)))));
        
        // Check if node already exists
        try nodeRegistry.getNodeDetails(nodeAddress) returns (address, string memory, uint256, uint256, AINodeRegistry.NodeState, uint256, bool, uint256, address, uint256) {
            // Node already exists, skip
            return;
        } catch {
            // Node doesn't exist, continue
        }
        
        // Bound registration period
        registrationPeriod = bound(registrationPeriod, 30 days, 365 days);
        
        // Generate metadata
        string memory metadata = string(abi.encodePacked("Node ", metadataSeed));
        
        // Register node
        vm.prank(operator);
        try nodeRegistry.registerNode(
            nodeAddress,
            metadata,
            registrationPeriod,
            address(dloopToken),
            5000 ether
        ) {
            // Record node
            operatorNodes[operator].push(nodeAddress);
            allNodeAddresses.push(nodeAddress);
        } catch {
            // Ignore failures
        }
    }
    
    function updateNodeState(uint256 operatorSeed, uint256 nodeSeed, uint256 stateSeed) public {
        address operator = nodeOperators[operatorSeed % nodeOperators.length];
        
        if (operatorNodes[operator].length == 0) return;
        
        // Select a node
        address nodeAddress = operatorNodes[operator][nodeSeed % operatorNodes[operator].length];
        
        // Select a state (0-3)
        uint8 state = uint8(stateSeed % 4);
        
        // Update state
        vm.prank(operator);
        try nodeRegistry.updateNodeState(nodeAddress, AINodeRegistry.NodeState(state)) {
            // No additional tracking needed
        } catch {
            // Ignore failures
        }
    }
    
    function increaseNodeStake(uint256 operatorSeed, uint256 nodeSeed, uint256 amount) public {
        address operator = nodeOperators[operatorSeed % nodeOperators.length];
        
        if (operatorNodes[operator].length == 0) return;
        
        // Select a node
        address nodeAddress = operatorNodes[operator][nodeSeed % operatorNodes[operator].length];
        
        // Bound amount
        amount = bound(amount, 1 ether, 1000 ether);
        
        // Increase stake
        vm.prank(operator);
        try nodeRegistry.increaseNodeStake(amount) {
            // No additional tracking needed
        } catch {
            // Ignore failures
        }
    }
    
    function decreaseNodeStake(uint256 operatorSeed, uint256 nodeSeed, uint256 amount) public {
        address operator = nodeOperators[operatorSeed % nodeOperators.length];
        
        if (operatorNodes[operator].length == 0) return;
        
        // Select a node
        address nodeAddress = operatorNodes[operator][nodeSeed % operatorNodes[operator].length];
        
        // Get current stake
        (,,,,,,, uint256 stakedAmount,,) = nodeRegistry.getNodeDetails(nodeAddress);
        
        // Bound amount
        amount = bound(amount, 1 ether, stakedAmount / 2);
        
        // Decrease stake
        vm.prank(operator);
        try nodeRegistry.decreaseNodeStake(amount) {
            // No additional tracking needed
        } catch {
            // Ignore failures
        }
    }
    
    function getNodeAddresses(address operator) public view returns (address[] memory) {
        return operatorNodes[operator];
    }
    
    function getAllNodeAddresses() public view returns (address[] memory) {
        return allNodeAddresses;
    }
}
