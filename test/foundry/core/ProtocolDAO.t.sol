// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/core/ProtocolDAO.sol";
import "../../../contracts/token/DLoopToken.sol";

/**
 * @title ProtocolDAO Fuzz Test
 * @dev Property-based tests for the ProtocolDAO contract
 * 
 * This test focuses on:
 * 1. Proposal creation with various parameters
 * 2. Voting mechanisms under different conditions
 * 3. Proposal execution with different calldata
 * 4. Parameter updates and token whitelisting
 */
contract ProtocolDAOTest is Test {
    // Contracts
    ProtocolDAO public protocolDAO;
    DLoopToken public dloopToken;
    
    // Test accounts
    address public owner;
    address public admin;
    address public treasury;
    address public user1;
    address public user2;
    address public user3;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant EXECUTION_DELAY = 1 days;
    uint256 public constant QUORUM = 10; // 10%
    
    // Events to test
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
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
        
        // Deploy ProtocolDAO
        protocolDAO = new ProtocolDAO();
        protocolDAO.initialize(
            VOTING_PERIOD,
            EXECUTION_DELAY,
            QUORUM,
            admin,
            treasury
        );
        vm.stopPrank();
        
        // Distribute tokens to users for voting
        vm.startPrank(owner);
        dloopToken.transfer(user1, 100_000 ether);
        dloopToken.transfer(user2, 150_000 ether);
        dloopToken.transfer(user3, 200_000 ether);
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test for proposal creation with various parameters
     * @param descriptionLength Length of the proposal description
     * @param targetCount Number of contract targets in the proposal
     * @param valueAmount ETH value to send with each call
     */
    function testFuzz_CreateProposal(
        uint8 descriptionLength,
        uint8 targetCount,
        uint256 valueAmount
    ) public {
        // Bound inputs to realistic values
        descriptionLength = uint8(bound(descriptionLength, 5, 100));
        targetCount = uint8(bound(targetCount, 1, 5));
        valueAmount = bound(valueAmount, 0, 1 ether);
        
        // Generate a random description
        string memory description = generateRandomString(descriptionLength);
        
        // Create arrays for proposal data
        address[] memory targets = new address[](targetCount);
        uint256[] memory values = new uint256[](targetCount);
        bytes[] memory calldatas = new bytes[](targetCount);
        
        // Fill arrays with test data
        for (uint8 i = 0; i < targetCount; i++) {
            targets[i] = address(uint160(uint256(keccak256(abi.encodePacked("target", i)))));
            values[i] = valueAmount;
            calldatas[i] = abi.encodeWithSignature("transfer(address,uint256)", user1, 1000);
        }
        
        // Create proposal as owner
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit ProposalCreated(1, owner, description);
        uint256 proposalId = protocolDAO.createProposal(description, targets, values, calldatas);
        
        // Verify proposal data
        (
            uint256 id,
            string memory storedDescription,
            address proposer,
            uint256 createdAt,
            uint256 votingEnds,
            ,
            ,
            bool executed,
            bool canceled,
            ,
            ,
            
        ) = protocolDAO.proposals(proposalId);
        
        assertEq(id, proposalId);
        assertEq(storedDescription, description);
        assertEq(proposer, owner);
        assertEq(votingEnds, createdAt + VOTING_PERIOD);
        assertEq(executed, false);
        assertEq(canceled, false);
    }
    
    /**
     * @dev Fuzz test for voting on proposals with different vote distributions
     * @param forVoterCount Number of voters voting in favor
     * @param againstVoterCount Number of voters voting against
     */
    function testFuzz_VotingMechanics(
        uint8 forVoterCount,
        uint8 againstVoterCount
    ) public {
        // Bound inputs to realistic values
        forVoterCount = uint8(bound(forVoterCount, 0, 10));
        againstVoterCount = uint8(bound(againstVoterCount, 0, 10));
        
        // Create a simple proposal
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(dloopToken);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", user1, 1000);
        
        vm.prank(owner);
        uint256 proposalId = protocolDAO.createProposal("Test Proposal", targets, values, calldatas);
        
        // Generate random voters
        address[] memory forVoters = new address[](forVoterCount);
        address[] memory againstVoters = new address[](againstVoterCount);
        
        for (uint8 i = 0; i < forVoterCount; i++) {
            forVoters[i] = address(uint160(uint256(keccak256(abi.encodePacked("forVoter", i)))));
            vm.prank(owner);
            dloopToken.transfer(forVoters[i], 10_000 ether);
        }
        
        for (uint8 i = 0; i < againstVoterCount; i++) {
            againstVoters[i] = address(uint160(uint256(keccak256(abi.encodePacked("againstVoter", i)))));
            vm.prank(owner);
            dloopToken.transfer(againstVoters[i], 10_000 ether);
        }
        
        // Cast votes
        for (uint8 i = 0; i < forVoterCount; i++) {
            vm.prank(forVoters[i]);
            vm.expectEmit(true, true, false, true);
            emit VoteCast(proposalId, forVoters[i], true);
            protocolDAO.castVote(proposalId, true);
        }
        
        for (uint8 i = 0; i < againstVoterCount; i++) {
            vm.prank(againstVoters[i]);
            vm.expectEmit(true, true, false, true);
            emit VoteCast(proposalId, againstVoters[i], false);
            protocolDAO.castVote(proposalId, false);
        }
        
        // Verify vote counts
        (
            ,
            ,
            ,
            ,
            ,
            uint256 forVotes,
            uint256 againstVotes,
            ,
            ,
            ,
            ,
            
        ) = protocolDAO.proposals(proposalId);
        
        assertEq(forVotes, forVoterCount * 10_000 ether);
        assertEq(againstVotes, againstVoterCount * 10_000 ether);
    }
    
    /**
     * @dev Fuzz test for proposal execution with different time conditions
     * @param timeSkip Amount of time to skip forward
     */
    function testFuzz_ProposalExecution(uint256 timeSkip) public {
        // Bound time skip to realistic values
        timeSkip = bound(timeSkip, VOTING_PERIOD + 1, VOTING_PERIOD + EXECUTION_DELAY + 7 days);
        
        // Create a simple proposal
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(dloopToken);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", user1, 1000);
        
        vm.prank(owner);
        uint256 proposalId = protocolDAO.createProposal("Test Proposal", targets, values, calldatas);
        
        // Vote to meet quorum
        vm.prank(user3);
        protocolDAO.castVote(proposalId, true);
        
        // Skip time to after voting period and execution delay
        vm.warp(block.timestamp + timeSkip);
        
        // Execute proposal
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit ProposalExecuted(proposalId);
        protocolDAO.executeProposal(proposalId);
        
        // Verify proposal was executed
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            bool executed,
            ,
            ,
            ,
            
        ) = protocolDAO.proposals(proposalId);
        
        assertTrue(executed);
    }
    
    /**
     * @dev Fuzz test for parameter updates
     * @param newVotingPeriod New voting period value
     * @param newExecutionDelay New execution delay value
     * @param newQuorum New quorum value
     */
    function testFuzz_UpdateParameters(
        uint256 newVotingPeriod,
        uint256 newExecutionDelay,
        uint256 newQuorum
    ) public {
        // Bound inputs to realistic values
        newVotingPeriod = bound(newVotingPeriod, 1 days, 30 days);
        newExecutionDelay = bound(newExecutionDelay, 6 hours, 7 days);
        newQuorum = bound(newQuorum, 1, 51); // 1% to 51%
        
        // Update parameters as admin
        vm.startPrank(admin);
        protocolDAO.setVotingPeriod(newVotingPeriod);
        protocolDAO.setExecutionDelay(newExecutionDelay);
        protocolDAO.setQuorum(newQuorum);
        vm.stopPrank();
        
        // Verify parameters were updated
        assertEq(protocolDAO.votingPeriod(), newVotingPeriod);
        assertEq(protocolDAO.executionDelay(), newExecutionDelay);
        assertEq(protocolDAO.quorum(), newQuorum);
    }
    
    /**
     * @dev Fuzz test for token whitelisting
     * @param tokenCount Number of tokens to whitelist
     */
    function testFuzz_WhitelistTokens(uint8 tokenCount) public {
        // Bound input to realistic values
        tokenCount = uint8(bound(tokenCount, 1, 20));
        
        // Generate random token addresses
        address[] memory tokens = new address[](tokenCount);
        for (uint8 i = 0; i < tokenCount; i++) {
            tokens[i] = address(uint160(uint256(keccak256(abi.encodePacked("token", i)))));
        }
        
        // Whitelist tokens as admin
        vm.startPrank(admin);
        for (uint8 i = 0; i < tokenCount; i++) {
            protocolDAO.whitelistToken(tokens[i], true);
        }
        vm.stopPrank();
        
        // Verify tokens were whitelisted
        for (uint8 i = 0; i < tokenCount; i++) {
            assertTrue(protocolDAO.whitelistedTokens(tokens[i]));
        }
        
        // Unwhitelist half the tokens
        vm.startPrank(admin);
        for (uint8 i = 0; i < tokenCount / 2; i++) {
            protocolDAO.whitelistToken(tokens[i], false);
        }
        vm.stopPrank();
        
        // Verify tokens were unwhitelisted
        for (uint8 i = 0; i < tokenCount / 2; i++) {
            assertFalse(protocolDAO.whitelistedTokens(tokens[i]));
        }
        
        // Verify remaining tokens are still whitelisted
        for (uint8 i = tokenCount / 2; i < tokenCount; i++) {
            assertTrue(protocolDAO.whitelistedTokens(tokens[i]));
        }
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
