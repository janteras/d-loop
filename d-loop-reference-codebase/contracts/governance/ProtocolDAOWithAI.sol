// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../identity/IAINodeIdentifier.sol";
import "./IExecutor.sol";

/**
 * @title ProtocolDAOWithAI
 * @notice DAO for protocol governance decisions with AI node integration
 * @dev Implements a minimalist design with AI-optimized governance
 */
contract ProtocolDAOWithAI is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // AI Node Interface
    IAINodeIdentifier public aiNodeIdentifier;
    
    // Whitelisted executors (e.g., UpgradeExecutor, ParameterAdjuster)
    mapping(address => bool) public whitelistedExecutors;
    
    // Proposal struct
    struct Proposal {
        address submitter;
        address executor;
        uint128 yesVotes;
        uint128 noVotes;
        uint64 expirationTime;
        uint64 timelockEnd;
        bool executed;
        string description;
        mapping(address => bool) hasVoted;
    }
    
    // Proposal storage
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // Configuration
    uint64 public aiVotingPeriod;        // Default: 1 day for AI nodes
    uint64 public humanVotingPeriod;     // Default: 7 days for humans
    uint64 public timelockPeriod;        // Default: 24 hours
    uint256 public aiQuorumPercentage;   // Default: 40% (scaled by 1e18)
    uint256 public humanQuorumPercentage; // Default: 30% (scaled by 1e18)
    
    // Total voting power
    uint256 public totalVotingPower;
    mapping(address => uint256) public votingPower;
    
    // Events
    event ProposalCreated(uint256 indexed proposalId, address submitter, address executor, string description);
    event VoteCast(uint256 indexed proposalId, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId, address executor);
    event ExecutorUpdated(address executor, bool isWhitelisted);
    event VotingPeriodUpdated(uint64 aiPeriod, uint64 humanPeriod);
    event QuorumUpdated(uint256 aiQuorum, uint256 humanQuorum);
    event TimelockUpdated(uint64 timelockPeriod);
    event VotingPowerUpdated(address account, uint256 previousPower, uint256 newPower);
    
    /**
     * @notice Initialize the ProtocolDAO contract
     * @param _aiNodeIdentifier Address of the AINodeIdentifier contract
     */
    function initialize(address _aiNodeIdentifier) public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        aiNodeIdentifier = IAINodeIdentifier(_aiNodeIdentifier);
        
        // Set default configuration
        aiVotingPeriod = 1 days;
        humanVotingPeriod = 7 days;
        timelockPeriod = 24 hours;
        aiQuorumPercentage = 40 * 1e16; // 40%
        humanQuorumPercentage = 30 * 1e16; // 30%
    }
    
    /**
     * @notice Update executor whitelist
     * @param executor Address of the executor contract
     * @param isWhitelisted Whether the executor is whitelisted
     */
    function updateExecutor(address executor, bool isWhitelisted) external onlyRole(ADMIN_ROLE) {
        whitelistedExecutors[executor] = isWhitelisted;
        emit ExecutorUpdated(executor, isWhitelisted);
    }
    
    /**
     * @notice Submit a new proposal
     * @param executor Address of the whitelisted executor contract
     * @param description Description of the proposal
     * @return proposalId ID of the created proposal
     */
    function submitProposal(address executor, string calldata description) external returns (uint256) {
        require(whitelistedExecutors[executor], "Invalid executor");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.submitter = msg.sender;
        proposal.executor = executor;
        proposal.description = description;
        
        // Set expiration based on whether submitter is an AI node
        bool isAI = aiNodeIdentifier.isAINode(msg.sender);
        proposal.expirationTime = uint64(block.timestamp + (isAI ? aiVotingPeriod : humanVotingPeriod));
        proposal.timelockEnd = uint64(proposal.expirationTime + timelockPeriod);
        
        emit ProposalCreated(proposalId, msg.sender, executor, description);
        
        return proposalId;
    }
    
    /**
     * @notice Vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether to support the proposal
     */
    function voteProposal(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp < proposal.expirationTime, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(votingPower[msg.sender] > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        
        uint256 weight = votingPower[msg.sender];
        
        if (support) {
            proposal.yesVotes += uint128(weight);
        } else {
            proposal.noVotes += uint128(weight);
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @notice Execute a passed proposal after timelock
     * @param proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        
        require(!proposal.executed, "Already executed");
        require(block.timestamp > proposal.timelockEnd, "Timelock active");
        
        uint256 quorum = getQuorum(proposal.expirationTime, proposal.submitter);
        uint256 totalVotes = uint256(proposal.yesVotes) + uint256(proposal.noVotes);
        
        require(totalVotes >= quorum, "Quorum not reached");
        require(proposal.yesVotes > proposal.noVotes, "Proposal rejected");
        
        proposal.executed = true;
        
        // Execute the proposal through the executor contract
        (bool success,) = proposal.executor.call(abi.encodeWithSignature("execute()"));
        require(success, "Execution failed");
        
        emit ProposalExecuted(proposalId, proposal.executor);
    }
    
    /**
     * @notice Get the required quorum for a proposal
     * @param expirationTime Expiration time of the proposal
     * @param submitter Submitter address of the proposal
     * @return Required quorum in voting power
     */
    function getQuorum(uint64 expirationTime, address submitter) public view returns (uint256) {
        bool isAI = aiNodeIdentifier.isAINode(submitter);
        uint256 quorumPercentage = isAI ? aiQuorumPercentage : humanQuorumPercentage;
        
        return (totalVotingPower * quorumPercentage) / 1e18;
    }
    
    /**
     * @notice Update voting power for an account
     * @param account Address of the account
     * @param newVotingPower New voting power value
     */
    function updateVotingPower(address account, uint256 newVotingPower) external onlyRole(GOVERNANCE_ROLE) {
        uint256 previousPower = votingPower[account];
        
        if (previousPower > 0) {
            totalVotingPower -= previousPower;
        }
        
        if (newVotingPower > 0) {
            totalVotingPower += newVotingPower;
        }
        
        votingPower[account] = newVotingPower;
        
        emit VotingPowerUpdated(account, previousPower, newVotingPower);
    }
    
    /**
     * @notice Update voting periods
     * @param _aiVotingPeriod New voting period for AI nodes in seconds
     * @param _humanVotingPeriod New voting period for humans in seconds
     */
    function updateVotingPeriods(uint64 _aiVotingPeriod, uint64 _humanVotingPeriod) external onlyRole(ADMIN_ROLE) {
        require(_aiVotingPeriod > 0 && _humanVotingPeriod > 0, "Invalid voting period");
        
        aiVotingPeriod = _aiVotingPeriod;
        humanVotingPeriod = _humanVotingPeriod;
        
        emit VotingPeriodUpdated(_aiVotingPeriod, _humanVotingPeriod);
    }
    
    /**
     * @notice Update quorum percentages
     * @param _aiQuorumPercentage New quorum percentage for AI proposals (scaled by 1e18)
     * @param _humanQuorumPercentage New quorum percentage for human proposals (scaled by 1e18)
     */
    function updateQuorumPercentages(uint256 _aiQuorumPercentage, uint256 _humanQuorumPercentage) external onlyRole(ADMIN_ROLE) {
        require(_aiQuorumPercentage <= 1e18 && _humanQuorumPercentage <= 1e18, "Invalid percentage");
        
        aiQuorumPercentage = _aiQuorumPercentage;
        humanQuorumPercentage = _humanQuorumPercentage;
        
        emit QuorumUpdated(_aiQuorumPercentage, _humanQuorumPercentage);
    }
    
    /**
     * @notice Update timelock period
     * @param _timelockPeriod New timelock period in seconds
     */
    function updateTimelockPeriod(uint64 _timelockPeriod) external onlyRole(ADMIN_ROLE) {
        timelockPeriod = _timelockPeriod;
        
        emit TimelockUpdated(_timelockPeriod);
    }
    
    /**
     * @notice Pause the DAO (emergency only)
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the DAO
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Update the AI Node Identifier contract
     * @param _aiNodeIdentifier New address of the AI Node Identifier contract
     */
    function updateAINodeIdentifier(address _aiNodeIdentifier) external onlyRole(ADMIN_ROLE) {
        require(_aiNodeIdentifier != address(0), "Invalid address");
        aiNodeIdentifier = IAINodeIdentifier(_aiNodeIdentifier);
    }
    
    /**
     * @notice Get proposal details
     * @param proposalId ID of the proposal
     * @return submitter Submitter of the proposal
     * @return executor Executor contract address
     * @return yesVotes Number of YES votes
     * @return noVotes Number of NO votes
     * @return expirationTime Expiration time of the voting period
     * @return timelockEnd End time of the timelock period
     * @return executed Whether the proposal has been executed
     * @return description Description of the proposal
     */
    function getProposalDetails(uint256 proposalId) external view returns (
        address submitter,
        address executor,
        uint128 yesVotes,
        uint128 noVotes,
        uint64 expirationTime,
        uint64 timelockEnd,
        bool executed,
        string memory description
    ) {
        Proposal storage proposal = proposals[proposalId];
        
        return (
            proposal.submitter,
            proposal.executor,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.expirationTime,
            proposal.timelockEnd,
            proposal.executed,
            proposal.description
        );
    }
    
    /**
     * @notice Check if an address has voted on a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     * @return Whether the address has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
}