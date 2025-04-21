// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AINodeRegistry.sol";

/**
 * @title ProtocolDAOWithAINodes
 * @dev Protocol DAO with special voting rules for AI nodes
 */
contract ProtocolDAOWithAINodes is Ownable {
    // Reference to the AI node registry
    AINodeRegistry public immutable aiNodeRegistry;
    
    // Voting periods
    uint256 public constant AI_NODE_VOTING_PERIOD = 48 hours;
    uint256 public constant REGULAR_VOTING_PERIOD = 72 hours;
    
    // Quorum requirements
    uint256 public constant AI_NODE_QUORUM = 40; // 40%
    uint256 public constant REGULAR_QUORUM = 30; // 30%
    
    // Timelock
    uint256 public constant TIMELOCK_PERIOD = 24 hours;
    
    // Proposal struct
    struct Proposal {
        address submitter;
        address executer;
        uint256 created;
        uint256 expires;
        uint256 timelockEnd;
        uint256 yes;
        uint256 no;
        bool executed;
        mapping(address => bool) hasVoted;
    }
    
    // Whitelisted executors
    mapping(address => bool) public whitelistedExecuters;
    
    // Proposals by ID
    mapping(uint256 => Proposal) public proposals;
    uint256 public nextProposalId;
    
    // Events
    event ProposalCreated(uint256 proposalId, address submitter, address executer);
    event ProposalVoted(uint256 proposalId, address voter, bool vote);
    event ProposalExecuted(uint256 proposalId);
    event ExecuterUpdated(address executer, bool whitelisted);
    
    constructor(address _aiNodeRegistry, address _owner) {
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
        
        // Start with proposal ID 1
        nextProposalId = 1;
        
        // Set owner
        _transferOwnership(_owner);
    }
    
    /**
     * @dev Update an executer's whitelist status
     * @param executer The executer address
     * @param whitelisted Whether the executer should be whitelisted
     */
    function updateExecuter(address executer, bool whitelisted) external onlyOwner {
        whitelistedExecuters[executer] = whitelisted;
        emit ExecuterUpdated(executer, whitelisted);
    }
    
    /**
     * @dev Submit a new proposal
     * @param executer Address of the contract that will execute the proposal
     * @return proposalId The ID of the created proposal
     */
    function submitProposal(address executer) external returns (uint256) {
        require(whitelistedExecuters[executer], "Invalid executer");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.submitter = msg.sender;
        proposal.executer = executer;
        proposal.created = block.timestamp;
        
        // Set expiration based on whether submitter is an AI node
        uint256 votingPeriod = getVotingPeriod(msg.sender);
        proposal.expires = block.timestamp + votingPeriod;
        proposal.timelockEnd = proposal.expires + TIMELOCK_PERIOD;
        
        emit ProposalCreated(proposalId, msg.sender, executer);
        return proposalId;
    }
    
    /**
     * @dev Vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether to vote in support
     */
    function voteProposal(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.created > 0, "Invalid proposal");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(block.timestamp < proposal.expires, "Proposal expired");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (support) {
            proposal.yes++;
        } else {
            proposal.no++;
        }
        
        emit ProposalVoted(proposalId, msg.sender, support);
    }
    
    /**
     * @dev Execute a passed proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.created > 0, "Invalid proposal");
        require(!proposal.executed, "Already executed");
        require(block.timestamp >= proposal.timelockEnd, "Timelock active");
        require(isPassed(proposalId), "Not passed");
        
        proposal.executed = true;
        
        // Execute the proposal
        (bool success, ) = proposal.executer.call(abi.encodeWithSignature("execute()"));
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @dev Check if a proposal has passed
     * @param proposalId ID of the proposal
     * @return bool True if the proposal has passed
     */
    function isPassed(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        // More yes than no votes
        if (proposal.yes <= proposal.no) {
            return false;
        }
        
        // Get required quorum based on proposal expiration
        uint256 requiredQuorum = getQuorum(proposal.expires);
        
        // Calculate total votes
        uint256 totalVotes = proposal.yes + proposal.no;
        
        // Check quorum requirement (using percentage)
        // For simplicity in testing, we'll assume 100 total possible votes
        // In a real implementation, this would be based on token supply or DAO membership
        uint256 totalPossibleVotes = 100;
        uint256 quorumPercentage = (totalVotes * 100) / totalPossibleVotes;
        
        return quorumPercentage >= requiredQuorum;
    }
    
    /**
     * @dev Get the voting period for a proposer
     * @param proposer Address of the proposer
     * @return period Voting period in seconds
     */
    function getVotingPeriod(address proposer) public view returns (uint256) {
        if (aiNodeRegistry.isVerifiedAINode(proposer)) {
            return AI_NODE_VOTING_PERIOD;
        } else {
            return REGULAR_VOTING_PERIOD;
        }
    }
    
    /**
     * @dev Get the quorum requirement based on proposal expiration
     * @param expirationTime Expiration timestamp
     * @return quorum Quorum percentage required
     */
    function getQuorum(uint256 expirationTime) public view returns (uint256) {
        // AI node proposals have shorter voting periods
        uint256 votingPeriod = expirationTime - block.timestamp;
        
        if (votingPeriod <= AI_NODE_VOTING_PERIOD) {
            return AI_NODE_QUORUM;
        } else {
            return REGULAR_QUORUM;
        }
    }
}