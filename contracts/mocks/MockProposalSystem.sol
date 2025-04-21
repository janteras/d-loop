// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../utils/Errors.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./base/BaseMock.sol";

/**
 * @title MockProposalSystem
 * @dev Mock implementation of a governance proposal system for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockProposalSystem is AccessControl, BaseMock {
    // Proposal types
    enum ProposalType {
        ParameterChange,
        TokenAllocation,
        AINodeRegistration
    }
    
    // Proposal state
    enum ProposalState {
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Executed
    }
    
    // Proposal structure
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address proposer;
        string description;
        address target;
        bytes callData;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 forVotes;
        uint256 againstVotes;
        ProposalState state;
        bool executed;
    }
    
    // Voting details
    struct Vote {
        bool support;
        uint256 power;
        string justification;
    }
    
    // Governance token
    IERC20 public governanceToken;
    
    // Roles
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Governance parameters
    uint256 public quorum;            // Percentage (1-100) required to pass
    uint256 public votingPeriod;      // In seconds
    uint256 public executionDelay;    // In seconds

    // Proposal storage
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // Voting records
    mapping(uint256 => mapping(address => Vote)) public votes;
    mapping(address => uint256) public lockedVotingTokens;
    
    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType proposalType,
        string description
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 power,
        string justification
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event ExecutionDelayUpdated(uint256 oldDelay, uint256 newDelay);
    
    /**
     * @dev Constructor initializes the mock proposal system
     * @param _governanceToken Address of the token used for governance
     * @param _quorum Initial quorum percentage (1-100)
     * @param _votingPeriod Initial voting period in seconds
     * @param _executionDelay Initial execution delay in seconds
     */
    constructor(
        address _governanceToken,
        uint256 _quorum,
        uint256 _votingPeriod,
        uint256 _executionDelay
    ) BaseMock() {
        if (_governanceToken == address(0)) revert ZeroAddress();
        if (!(_quorum > 0 && _quorum <= 100)) revert InvalidQuorumRange();
        if (_votingPeriod == 0) revert InvalidVotingPeriod();
        
        governanceToken = IERC20(_governanceToken);
        quorum = _quorum;
        votingPeriod = _votingPeriod;
        executionDelay = _executionDelay;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new proposal
     * @param proposalType Type of the proposal
     * @param description Human-readable description
     * @param target Address that the proposal will call
     * @param callData Function call data
     * @return proposalId ID of the created proposal
     */
    function createProposal(
        ProposalType proposalType,
        string memory description,
        address target,
        bytes memory callData
    ) external returns (uint256) {
        _recordFunctionCall(
            "createProposal",
            abi.encode(proposalType, description, target, callData)
        );
        if (target == address(0)) revert ZeroAddress();
        
        uint256 proposalId = proposalCount + 1;
        proposalCount = proposalId;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposalType: proposalType,
            proposer: msg.sender,
            description: description,
            target: target,
            callData: callData,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            state: ProposalState.Active,
            executed: false
        });
        
        emit ProposalCreated(proposalId, msg.sender, proposalType, description);
        
        return proposalId;
    }
    
    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The proposal ID
     * @param support Whether to support the proposal
     * @param votingPower Amount of voting power to use
     * @param justification Reason for the vote
     */
    function castVote(
        uint256 proposalId,
        bool support,
        uint256 votingPower,
        string memory justification
    ) external {
        _recordFunctionCall(
            "castVote",
            abi.encode(proposalId, support, votingPower, justification)
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id != proposalId) revert ProposalNotFound();
        if (proposal.state != ProposalState.Active) revert ProposalNotActive();
        if (block.timestamp >= proposal.votingEndsAt) revert VotingPeriodEnded();
        if (votes[proposalId][msg.sender].power != 0) revert AlreadyVoted();
        
        // Check if user has enough tokens
        if (governanceToken.balanceOf(msg.sender) < votingPower) revert InsufficientVotingPower();
        
        // Lock tokens for voting
        governanceToken.transferFrom(msg.sender, address(this), votingPower);
        lockedVotingTokens[msg.sender] += votingPower;
        
        // Record vote
        votes[proposalId][msg.sender] = Vote({
            support: support,
            power: votingPower,
            justification: justification
        });
        
        // Update proposal vote counts
        if (support) {
            proposal.forVotes += votingPower;
        } else {
            proposal.againstVotes += votingPower;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingPower, justification);
    }
    
    /**
     * @dev Execute a successful proposal
     * @param proposalId The proposal ID to execute
     */
    function executeProposal(uint256 proposalId) external {
        _recordFunctionCall(
            "executeProposal",
            abi.encode(proposalId)
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id != proposalId) revert ProposalNotFound();
        if (proposal.state != ProposalState.Active) revert ProposalNotActive();
        require(block.timestamp >= proposal.votingEndsAt, "Voting still active");
        require(!proposal.executed, "Already executed");
        
        // Check if proposal succeeded
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        require(totalVotes > 0, "No votes cast");
        
        uint256 forPercentage = (proposal.forVotes * 100) / totalVotes;
        require(forPercentage >= quorum, "Quorum not reached");
        
        // Execute call
        proposal.executed = true;
        proposal.state = ProposalState.Executed;
        
        (bool success,) = proposal.target.call(proposal.callData);
        require(success, "Proposal execution failed");
        
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @dev Cancel a proposal (admin only)
     * @param proposalId The proposal ID to cancel
     */
    function cancelProposal(uint256 proposalId) external onlyRole(GOVERNANCE_ROLE) {
        _recordFunctionCall(
            "cancelProposal",
            abi.encode(proposalId)
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id != proposalId) revert ProposalNotFound();
        if (proposal.state != ProposalState.Active) revert ProposalNotActive();
        require(!proposal.executed, "Already executed");
        
        proposal.state = ProposalState.Canceled;
        
        emit ProposalCanceled(proposalId);
    }
    
    /**
     * @dev Unlock and retrieve voting tokens after voting period
     * @param proposalId The proposal ID
     */
    function retrieveVotingTokens(uint256 proposalId) external {
        _recordFunctionCall(
            "retrieveVotingTokens",
            abi.encode(proposalId)
        );
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id != proposalId) revert ProposalNotFound();
        require(block.timestamp >= proposal.votingEndsAt, "Voting still active");
        
        Vote memory userVote = votes[proposalId][msg.sender];
        require(userVote.power > 0, "No votes to retrieve");
        
        // Unlock tokens
        uint256 amount = userVote.power;
        votes[proposalId][msg.sender].power = 0;
        lockedVotingTokens[msg.sender] -= amount;
        
        // Return tokens
        governanceToken.transfer(msg.sender, amount);
    }
    
    /**
     * @dev Update the quorum percentage (admin only)
     * @param newQuorum New quorum value (1-100)
     */
    function updateQuorum(uint256 newQuorum) external onlyRole(GOVERNANCE_ROLE) {
        _recordFunctionCall(
            "updateQuorum",
            abi.encode(newQuorum)
        );
        require(newQuorum > 0 && newQuorum <= 100, "Invalid quorum range");
        
        uint256 oldQuorum = quorum;
        quorum = newQuorum;
        
        emit QuorumUpdated(oldQuorum, newQuorum);
    }
    
    /**
     * @dev Update the voting period (admin only)
     * @param newVotingPeriod New voting period in seconds
     */
    function updateVotingPeriod(uint256 newVotingPeriod) external onlyRole(GOVERNANCE_ROLE) {
        _recordFunctionCall(
            "updateVotingPeriod",
            abi.encode(newVotingPeriod)
        );
        require(newVotingPeriod > 0, "Invalid voting period");
        
        uint256 oldPeriod = votingPeriod;
        votingPeriod = newVotingPeriod;
        
        emit VotingPeriodUpdated(oldPeriod, newVotingPeriod);
    }
    
    /**
     * @dev Update the execution delay (admin only)
     * @param newExecutionDelay New execution delay in seconds
     */
    function updateExecutionDelay(uint256 newExecutionDelay) external onlyRole(GOVERNANCE_ROLE) {
        _recordFunctionCall(
            "updateExecutionDelay",
            abi.encode(newExecutionDelay)
        );
        uint256 oldDelay = executionDelay;
        executionDelay = newExecutionDelay;
        
        emit ExecutionDelayUpdated(oldDelay, newExecutionDelay);
    }
    
    /**
     * @dev Get proposal details
     * @param proposalId ID of the proposal
     * @return Full proposal details
     */
    // NOTE: This function is view and does not modify state. Do not add _recordFunctionCall here.
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].id == proposalId, "Proposal doesn't exist");
        return proposals[proposalId];
    }
    
    /**
     * @dev Get vote details
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     * @return vote Vote details
     */
    // NOTE: This function is view and does not modify state. Do not add _recordFunctionCall here.
    function getVoteDetails(uint256 proposalId, address voter) external view returns (Vote memory) {
        return votes[proposalId][voter];
    }
    
    /**
     * @dev Get current state of a proposal
     * @param proposalId ID of the proposal
     * @return state Current state of the proposal
     */
    // NOTE: This function is view and does not modify state. Do not add _recordFunctionCall here.
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.id != proposalId) revert ProposalNotFound();
        
        if (proposal.state == ProposalState.Canceled) {
            return ProposalState.Canceled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (proposal.votingEndsAt > block.timestamp) {
            return ProposalState.Active;
        }
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        if (totalVotes == 0) {
            return ProposalState.Defeated;
        }
        
        uint256 forPercentage = (proposal.forVotes * 100) / totalVotes;
        if (forPercentage >= quorum) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }
}