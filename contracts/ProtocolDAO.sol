// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./utils/Errors.sol";
import { ReentrancyGuard } from "./security/ReentrancyGuard.sol";

/**
 * @title ProtocolDAO
 * @dev Main DAO for the DLOOP protocol
 * @notice This contract handles protocol-level governance and administration
 */
/**
 * [TESTNET] This contract is configured for Sepolia testnet deployment.
 * - Owner/admin/treasury roles are assigned to deployer only
 * - Proposal and voting flows are simplified (e.g., 10% quorum, shorter windows)
 * - No multisig or advanced governance features enabled
 * - All mainnet-only features are disabled or marked for Sepolia
 * - All testnet-specific logic is clearly marked with [TESTNET] comments
 */
contract ProtocolDAO is ReentrancyGuard {
    // [TESTNET] Proposal and voting flows are simplified (e.g., 10% quorum, shorter windows)
    // Proposal structure
    struct Proposal {
        uint256 id;
        string description;
        address proposer;
        uint256 createdAt;
        uint256 votingEnds;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
    }

    // Protocol parameters
    uint256 public votingPeriod;      // in seconds
    uint256 public executionDelay;    // in seconds
    uint256 public quorum;            // in percentage (1-100)
    
    // Role management
    // [TESTNET] Role management: Owner/admin/treasury roles are assigned to deployer only for Sepolia
    address public owner;
    address public admin;
    address public treasury;
    
    // Whitelisted tokens
    mapping(address => bool) public whitelistedTokens;
    
    // Proposal storage
    mapping(uint256 => Proposal) public proposals;
    uint256 private proposalCounter;
    
    // Vote tracking
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event ParameterUpdated(string paramName, uint256 oldValue, uint256 newValue);
    event TokenWhitelisted(address indexed token, bool status);
    
    /**
     * @dev Modifier to restrict access to owner
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert CallerNotOwner();
        _;
    }
    
    /**
     * @dev Modifier to restrict access to admin
     */
    modifier onlyAdmin() {
        if (msg.sender != admin && msg.sender != owner) revert CallerNotAdmin();
        _;
    }
    
    /**
     * @dev Constructor to initialize the ProtocolDAO contract
     * @param _admin Address of the admin
     * @param _treasury Address of the treasury
     * @param _votingPeriod Initial voting period (in seconds)
     * @param _executionDelay Initial execution delay (in seconds)
     * @param _quorum Initial quorum percentage (1-100)
     */
    constructor(
        address _admin,
        address _treasury,
        uint256 _votingPeriod,
        uint256 _executionDelay,
        uint256 _quorum
    ) {
        if (_admin == address(0) || _treasury == address(0)) revert ZeroAddress();
        if (_quorum == 0 || _quorum > 100) revert InvalidAmount();
        
        owner = msg.sender;
        admin = _admin;
        treasury = _treasury;
        votingPeriod = _votingPeriod;
        executionDelay = _executionDelay;
        quorum = _quorum;
        proposalCounter = 0;
    }
    
    /**
     * @dev Creates a new proposal
     * @param description Description of the proposal
     * @param targets Target addresses for calls to be made during proposal execution
     * @param values ETH values for calls to be made during proposal execution
     * @param calldatas Calldata for calls to be made during proposal execution
     * @return proposalId The ID of the created proposal
     */
    function createProposal(
        string memory description,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) external returns (uint256) {
        if (targets.length == 0) revert InvalidAmount();
        if (targets.length != values.length || targets.length != calldatas.length)
            revert InvalidAmount();
        
        // Increment proposal counter
        proposalCounter++;
        uint256 proposalId = proposalCounter;
        
        // Create new proposal
        proposals[proposalId] = Proposal({
            id: proposalId,
            description: description,
            proposer: msg.sender,
            createdAt: block.timestamp,
            votingEnds: block.timestamp + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            executed: false,
            canceled: false,
            targets: targets,
            values: values,
            calldatas: calldatas
        });
        
        // Emit creation event
        emit ProposalCreated(proposalId, msg.sender, description);
        
        return proposalId;
    }
    
    /**
     * @dev Casts a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support Whether to support the proposal
     */
    function castVote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.canceled) revert ProposalNotApproved();
        if (proposal.votingEnds < block.timestamp) revert VotingEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        
        // Record vote
        hasVoted[proposalId][msg.sender] = true;
        
        // Update vote counts
        if (support) {
            proposal.forVotes += 1;
        } else {
            proposal.againstVotes += 1;
        }
        
        // Emit vote event
        emit VoteCast(proposalId, msg.sender, support);
    }
    
    /**
     * @dev Executes a proposal
     * @param proposalId The ID of the proposal
     * @notice Protected against reentrancy attacks using nonReentrant modifier
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        _validateProposalForExecution(proposal);
        proposal.executed = true;
        _executeProposalCalls(proposal);
        emit ProposalExecuted(proposalId);
    }

    function _validateProposalForExecution(Proposal storage proposal) private view {
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.canceled) revert ProposalNotApproved();
        if (proposal.votingEnds >= block.timestamp) revert VotingNotStarted();
        if (block.timestamp < proposal.votingEnds + executionDelay) revert ProposalNotApproved();
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        if (totalVotes == 0) revert ProposalNotApproved();
        uint256 forPercentage = (proposal.forVotes * 100) / totalVotes;
        if (forPercentage < quorum) revert ProposalNotApproved();
    }

    function _executeProposalCalls(Proposal storage proposal) private {
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            if (!success) revert OperationFailed();
        }
    }
    
    /**
     * @dev Cancels a proposal
     * @param proposalId The ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external onlyAdmin {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        if (proposal.canceled) revert ProposalNotApproved();
        
        // Mark as canceled
        proposal.canceled = true;
        
        // Emit cancellation event
        emit ProposalCanceled(proposalId);
    }
    
    /**
     * @dev Updates the voting period
     * @param _newVotingPeriod New voting period (in seconds)
     */
    function updateVotingPeriod(uint256 _newVotingPeriod) external onlyAdmin {
        if (_newVotingPeriod == 0) revert InvalidPeriod();
        
        uint256 oldVotingPeriod = votingPeriod;
        votingPeriod = _newVotingPeriod;
        
        emit ParameterUpdated("VotingPeriod", oldVotingPeriod, _newVotingPeriod);
    }
    
    /**
     * @dev Updates the execution delay
     * @param _newExecutionDelay New execution delay (in seconds)
     */
    function updateExecutionDelay(uint256 _newExecutionDelay) external onlyAdmin {
        uint256 oldExecutionDelay = executionDelay;
        executionDelay = _newExecutionDelay;
        
        emit ParameterUpdated("ExecutionDelay", oldExecutionDelay, _newExecutionDelay);
    }
    
    /**
     * @dev Updates the quorum percentage
     * @param _newQuorum New quorum percentage (1-100)
     */
    function updateQuorum(uint256 _newQuorum) external onlyAdmin {
        if (_newQuorum == 0 || _newQuorum > 100) revert InvalidAmount();
        
        uint256 oldQuorum = quorum;
        quorum = _newQuorum;
        
        emit ParameterUpdated("Quorum", oldQuorum, _newQuorum);
    }
    
    /**
     * @dev Adds or removes a token from the protocol's whitelist. Only whitelisted tokens
     *      can be used for investment, divestment, and ragequit operations. This provides
     *      a security layer to prevent fraudulent or manipulated tokens from being used.
     *      Whitelists a token for use in the DLOOP protocol.
     * @param token Address of the token to whitelist or blacklist
     * @param status True to whitelist the token, false to remove it from the whitelist
     * @notice Tokens must undergo governance approval before being whitelisted
     * @notice Only admin or owner addresses can modify the whitelist
     */
    function whitelistToken(address token, bool status) external onlyAdmin {
        if (token == address(0)) revert ZeroAddress();
        
        whitelistedTokens[token] = status;
        
        emit TokenWhitelisted(token, status);
    }
    
    /**
     * @dev Updates the treasury address
     * @param _newTreasury Address of the new treasury
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        treasury = _newTreasury;
    }
    
    /**
     * @dev Updates the admin address
     * @param _newAdmin Address of the new admin
     */
    function updateAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert ZeroAddress();
        admin = _newAdmin;
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        owner = _newOwner;
    }
    
    /**
     * @dev Checks if a token is whitelisted in the protocol for use in investment, 
     *      divestment, and ragequit operations. This function is called by other
     *      contracts to ensure only approved tokens are used.
     *      Verifies if a token is approved for protocol operations.
     * @param token Address of the token to check
     * @return status True if the token is whitelisted, false otherwise
     * @notice This function should be used as a security check before any token transfer
     * @notice For Sepolia testnet deployment, the default DAI token is pre-whitelisted
     */
    function isTokenWhitelisted(address token) external view returns (bool) {
        return whitelistedTokens[token];
    }
    
    /**
     * @dev Gets the proposal count
     * @return count Number of proposals created
     */
    function getProposalCount() external view returns (uint256) {
        return proposalCounter;
    }
    
    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {}
}