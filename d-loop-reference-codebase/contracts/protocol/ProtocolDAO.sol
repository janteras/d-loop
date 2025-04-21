// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../identity/IAINodeIdentifier.sol";
import "./IExecutor.sol";

/**
 * @title ProtocolDAO
 * @dev Minimalist governance system for the DLOOP Protocol
 * Features:
 * - Whitelisted executors for controlled governance actions
 * - Differentiated voting periods for AI nodes vs humans
 * - Timelock for security
 * - Binary (YES/NO) voting
 */
contract ProtocolDAO is AccessControl {
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // AI Node identifier
    IAINodeIdentifier public nodeIdentifier;
    
    // Proposal structure as per development plan
    struct Proposal {
        address submitter;     // Who submitted the proposal
        address executor;      // Target contract to execute if proposal passes
        uint128 yesVotes;      // Total YES votes
        uint128 noVotes;       // Total NO votes
        uint64 expires;        // When voting ends
        uint64 timelockEnd;    // When proposal can be executed (after expires)
        string description;    // Brief description of the proposal
        bool executed;         // Whether the proposal has been executed
    }
    
    // Whitelisted executors
    mapping(address => bool) public whitelistedExecutors;
    
    // Proposal storage
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // Voting parameters
    uint64 public aiNodeVotingPeriod = 1 days;
    uint64 public humanVotingPeriod = 7 days;
    uint64 public timelockPeriod = 24 hours;
    uint8 public aiNodeQuorumPercent = 40;
    uint8 public humanQuorumPercent = 30;
    
    // Token voting power
    mapping(address => uint256) public votingPower;
    uint256 public totalVotingPower;
    
    // Vote tracking
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public voteDirection; // true = YES, false = NO
    
    // Events
    event ExecutorUpdated(address indexed executor, bool isWhitelisted);
    event ProposalCreated(uint256 indexed proposalId, address indexed submitter, address indexed executor, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool voteDirection, uint256 votingPower);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor, bool success, string message);
    event VotingParametersUpdated(uint64 aiNodeVotingPeriod, uint64 humanVotingPeriod, uint64 timelockPeriod, uint8 aiNodeQuorumPercent, uint8 humanQuorumPercent);
    event NodeIdentifierUpdated(address indexed newIdentifier);
    
    /**
     * @dev Constructor
     * @param _nodeIdentifier Address of the AI Node Identifier contract
     */
    constructor(address _nodeIdentifier) {
        require(_nodeIdentifier != address(0), "Zero node identifier address");
        
        nodeIdentifier = IAINodeIdentifier(_nodeIdentifier);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }
    
    /**
     * @dev Update voting parameters
     * @param _aiNodeVotingPeriod Voting period for AI nodes in seconds
     * @param _humanVotingPeriod Voting period for humans in seconds
     * @param _timelockPeriod Timelock period in seconds
     * @param _aiNodeQuorumPercent Quorum percentage for AI nodes (0-100)
     * @param _humanQuorumPercent Quorum percentage for humans (0-100)
     */
    function updateVotingParameters(
        uint64 _aiNodeVotingPeriod,
        uint64 _humanVotingPeriod,
        uint64 _timelockPeriod,
        uint8 _aiNodeQuorumPercent,
        uint8 _humanQuorumPercent
    ) external onlyRole(ADMIN_ROLE) {
        require(_aiNodeVotingPeriod > 0, "Invalid AI node voting period");
        require(_humanVotingPeriod > 0, "Invalid human voting period");
        require(_timelockPeriod > 0, "Invalid timelock period");
        require(_aiNodeQuorumPercent <= 100, "Invalid AI node quorum");
        require(_humanQuorumPercent <= 100, "Invalid human quorum");
        
        aiNodeVotingPeriod = _aiNodeVotingPeriod;
        humanVotingPeriod = _humanVotingPeriod;
        timelockPeriod = _timelockPeriod;
        aiNodeQuorumPercent = _aiNodeQuorumPercent;
        humanQuorumPercent = _humanQuorumPercent;
        
        emit VotingParametersUpdated(
            _aiNodeVotingPeriod,
            _humanVotingPeriod,
            _timelockPeriod,
            _aiNodeQuorumPercent,
            _humanQuorumPercent
        );
    }
    
    /**
     * @dev Update the node identifier contract
     * @param _nodeIdentifier New node identifier contract address
     */
    function updateNodeIdentifier(address _nodeIdentifier) external onlyRole(ADMIN_ROLE) {
        require(_nodeIdentifier != address(0), "Zero node identifier address");
        nodeIdentifier = IAINodeIdentifier(_nodeIdentifier);
        
        emit NodeIdentifierUpdated(_nodeIdentifier);
    }
    
    /**
     * @dev Admin adds/removes executors
     * @param executor Address of the executor contract
     * @param isWhitelisted Whether the executor is whitelisted
     */
    function updateExecutor(address executor, bool isWhitelisted) external onlyRole(ADMIN_ROLE) {
        require(executor != address(0), "Zero executor address");
        whitelistedExecutors[executor] = isWhitelisted;
        
        emit ExecutorUpdated(executor, isWhitelisted);
    }
    
    /**
     * @dev Mock function to set voting power (in production this would be based on token balance)
     * @param voter Address of the voter
     * @param amount Amount of voting power
     */
    function mockSetVotingPower(address voter, uint256 amount) external onlyRole(ADMIN_ROLE) {
        totalVotingPower = totalVotingPower - votingPower[voter] + amount;
        votingPower[voter] = amount;
    }
    
    /**
     * @dev Submit a new proposal
     * @param executor Address of the executor contract
     * @param description Brief description of the proposal
     * @return proposalId The ID of the created proposal
     */
    function submitProposal(address executor, string calldata description) external returns (uint256) {
        require(whitelistedExecutors[executor], "Executor not whitelisted");
        require(bytes(description).length > 0, "Empty description");
        require(votingPower[msg.sender] > 0, "No voting power");
        
        // Calculate expiry based on whether submitter is an AI node
        uint64 votingPeriod = getVotingPeriod(msg.sender);
        uint64 expiry = uint64(block.timestamp) + votingPeriod;
        uint64 timelockEnd = expiry + timelockPeriod;
        
        proposals[proposalCount] = Proposal({
            submitter: msg.sender,
            executor: executor,
            yesVotes: 0,
            noVotes: 0,
            expires: expiry,
            timelockEnd: timelockEnd,
            description: description,
            executed: false
        });
        
        uint256 proposalId = proposalCount;
        proposalCount++;
        
        emit ProposalCreated(proposalId, msg.sender, executor, description);
        
        return proposalId;
    }
    
    /**
     * @dev Vote on a proposal
     * @param proposalId ID of the proposal
     * @param voteYes Whether the vote is YES (true) or NO (false)
     */
    function voteProposal(uint256 proposalId, bool voteYes) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(votingPower[msg.sender] > 0, "No voting power");
        
        Proposal storage proposal = proposals[proposalId];
        
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp < proposal.expires, "Voting period ended");
        
        // Record vote
        hasVoted[proposalId][msg.sender] = true;
        voteDirection[proposalId][msg.sender] = voteYes;
        
        // Update vote counts
        if (voteYes) {
            proposal.yesVotes += uint128(votingPower[msg.sender]);
        } else {
            proposal.noVotes += uint128(votingPower[msg.sender]);
        }
        
        emit VoteCast(proposalId, msg.sender, voteYes, votingPower[msg.sender]);
    }
    
    /**
     * @dev Execute a passed proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        require(!proposal.executed, "Proposal already executed");
        require(block.timestamp > proposal.timelockEnd, "Timelock not ended");
        
        // Check if proposal passed
        bool isPassingVotes = proposal.yesVotes > proposal.noVotes;
        bool meetsQuorum = hasMetQuorum(proposalId);
        
        require(isPassingVotes && meetsQuorum, "Proposal did not pass");
        
        // Mark as executed before external call to prevent reentrancy
        proposal.executed = true;
        
        // Execute the proposal
        (bool success, string memory message) = IExecutor(proposal.executor).execute();
        
        emit ProposalExecuted(proposalId, proposal.executor, success, message);
        
        // If execution failed, revert the entire transaction
        require(success, message);
    }
    
    /**
     * @dev Get the voting period based on whether the sender is an AI node
     * @param submitter Address of the submitter
     * @return period Voting period in seconds
     */
    function getVotingPeriod(address submitter) public view returns (uint64) {
        return nodeIdentifier.isActiveAINode(submitter) ? aiNodeVotingPeriod : humanVotingPeriod;
    }
    
    /**
     * @dev Get the quorum percentage based on the expiry time
     * @param expiry The expiry timestamp of the proposal
     * @return quorumPercent Quorum percentage (0-100)
     */
    function getQuorumPercent(uint64 expiry) public view returns (uint8) {
        // If expiry is within AI node voting period, it's an AI fast-track proposal
        return (expiry - uint64(block.timestamp)) <= aiNodeVotingPeriod ? 
               aiNodeQuorumPercent : humanQuorumPercent;
    }
    
    /**
     * @dev Check if a proposal has met the quorum requirement
     * @param proposalId ID of the proposal
     * @return hasMetQuorum Whether the proposal has met quorum
     */
    function hasMetQuorum(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        // Get the appropriate quorum percentage
        uint8 quorumPercent = getQuorumPercent(proposal.expires);
        
        // Calculate the required votes for quorum
        uint256 requiredVotes = (totalVotingPower * quorumPercent) / 100;
        
        // Check if total votes meet the quorum
        uint256 totalVotes = uint256(proposal.yesVotes) + uint256(proposal.noVotes);
        
        return totalVotes >= requiredVotes;
    }
    
    /**
     * @dev Get details about a proposal
     * @param proposalId ID of the proposal
     * @return submitter Address of the submitter
     * @return executor Address of the executor
     * @return yesVotes Total YES votes
     * @return noVotes Total NO votes
     * @return expires When voting ends
     * @return timelockEnd When proposal can be executed
     * @return description Brief description of the proposal
     * @return executed Whether the proposal has been executed
     * @return quorumPercent The quorum percentage for this proposal
     * @return meetsQuorum Whether the proposal meets quorum
     */
    function getProposalDetails(uint256 proposalId) external view returns (
        address submitter,
        address executor,
        uint128 yesVotes,
        uint128 noVotes,
        uint64 expires,
        uint64 timelockEnd,
        string memory description,
        bool executed,
        uint8 quorumPercent,
        bool meetsQuorum
    ) {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        return (
            proposal.submitter,
            proposal.executor,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.expires,
            proposal.timelockEnd,
            proposal.description,
            proposal.executed,
            getQuorumPercent(proposal.expires),
            hasMetQuorum(proposalId)
        );
    }
}