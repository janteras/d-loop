// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../identity/AINodeRegistry.sol";
import "../oracles/IPriceOracle.sol";

/**
 * @title ProtocolDAO
 * @notice Enhanced DAO for protocol governance with special AI voting capabilities
 * @dev Upgradeable contract with different voting periods for AI vs human participants
 */
contract ProtocolDAO is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Governance token for voting
    IERC20 public governanceToken;
    
    // AI Node Registry for verifying AI participants
    AINodeRegistry public aiNodeRegistry;
    
    // Oracle for token price data
    IPriceOracle public priceOracle;
    
    // Asset DAO address
    address public assetDAO;
    
    // Governance rewards address
    address public governanceRewards;
    
    // Voting periods
    uint256 public aiNodeVotingPeriod;      // Shorter duration for AI nodes (e.g., 1 day)
    uint256 public humanVotingPeriod;       // Longer duration for humans (e.g., 7 days)
    
    // Quorum settings
    uint256 public quorumPercentage = 2000; // 20% in basis points
    uint256 public aiQuorumPercentage = 5100; // 51% in basis points for AI-only votes
    
    // Vote types
    enum VoteType {
        Against,
        For,
        Abstain
    }
    
    // Proposal states
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }
    
    // Proposal information
    struct Proposal {
        uint256 id;
        address proposer;
        uint256 startBlock;
        uint256 startTime;
        uint256 endTime;
        bool isAIProposal;       // If true, only AI nodes can vote, shorter period
        string description;
        
        // Targets and calldata for execution
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string[] signatures;
        
        // Voting state
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
        
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        
        bool executed;
        bool canceled;
        
        uint256 snapshotId;      // Token balance snapshot ID
        
        bytes32 descriptionHash;
    }
    
    // Execution queue
    struct QueuedExecution {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string[] signatures;
        uint256 eta;
        bool executed;
        bytes32 proposalId;
    }
    
    // Mappings
    mapping(uint256 => Proposal) public proposals;
    mapping(bytes32 => QueuedExecution) public executionQueue;
    mapping(address => uint256) public votingPowerMultiplier;   // For reputation-weighted voting
    mapping(address => uint256) public proposalCount;           // Proposals created by each address
    
    // Proposal tracking
    uint256 public proposalCounter;
    uint256 public activeProposalCount;
    uint256 public successfulProposalCount;
    
    // Minimum voting power required to submit a proposal
    uint256 public proposalThreshold = 1000 * 10**18; // 1,000 tokens
    
    // Timelock settings
    uint256 public timelock = 2 days;
    uint256 public gracePeriod = 14 days;
    
    // Events
    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        string description,
        uint256 startTime,
        uint256 endTime,
        bool isAIProposal
    );
    event VoteCast(
        address indexed voter,
        uint256 proposalId,
        VoteType support,
        uint256 weight,
        string reason
    );
    event ProposalExecuted(uint256 proposalId);
    event ProposalCanceled(uint256 proposalId);
    event ProposalQueued(uint256 proposalId, uint256 eta);
    event ExecutionScheduled(bytes32 queueId, uint256 eta);
    event ExecutionExecuted(bytes32 queueId);
    event AssetDAOUpdated(address oldAddress, address newAddress);
    event GovernanceRewardsUpdated(address oldAddress, address newAddress);
    event VotingPeriodUpdated(uint256 aiPeriod, uint256 humanPeriod);
    event QuorumUpdated(uint256 quorum, uint256 aiQuorum);
    event VotingPowerMultiplierSet(address account, uint256 multiplier);
    
    /**
     * @notice Initializer function (replaces constructor in upgradeable contracts)
     * @param _governanceToken Address of the governance token
     * @param _aiNodeRegistry Address of the AI Node Registry
     * @param _priceOracle Address of the price oracle
     * @param _aiNodeVotingPeriod Voting period duration for AI nodes in seconds
     * @param _humanVotingPeriod Voting period duration for humans in seconds
     */
    function initialize(
        address _governanceToken,
        address _aiNodeRegistry,
        address _priceOracle,
        uint256 _aiNodeVotingPeriod,
        uint256 _humanVotingPeriod
    ) public initializer {
        require(_governanceToken != address(0), "Invalid governance token address");
        require(_aiNodeRegistry != address(0), "Invalid AI Node Registry address");
        require(_priceOracle != address(0), "Invalid price oracle address");
        require(_aiNodeVotingPeriod > 0, "AI voting period must be positive");
        require(_humanVotingPeriod > 0, "Human voting period must be positive");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(GOVERNOR_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        governanceToken = IERC20(_governanceToken);
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
        priceOracle = IPriceOracle(_priceOracle);
        
        aiNodeVotingPeriod = _aiNodeVotingPeriod;
        humanVotingPeriod = _humanVotingPeriod;
        
        proposalCounter = 0;
    }
    
    /**
     * @notice Creates a new proposal
     * @param targets Target addresses for proposal execution
     * @param values ETH values to send with each call
     * @param signatures Function signatures to call
     * @param calldatas Calldata for each function call
     * @param description Description of the proposal
     * @param isAIProposal Whether this is an AI-only proposal
     * @return proposalId The ID of the created proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description,
        bool isAIProposal
    ) public whenNotPaused returns (uint256) {
        require(targets.length > 0, "Empty proposal");
        require(
            targets.length == values.length &&
            targets.length == signatures.length &&
            targets.length == calldatas.length,
            "Proposal function information mismatch"
        );
        
        // For AI proposals, proposer must be a verified AI node
        if (isAIProposal) {
            require(aiNodeRegistry.isVerifiedAINode(msg.sender), "Not a verified AI node");
        } else {
            // For regular proposals, check token balance threshold
            uint256 proposerBalance = governanceToken.balanceOf(msg.sender);
            require(proposerBalance >= proposalThreshold, "Proposer below threshold");
        }
        
        // Increment proposal counter
        proposalCounter++;
        
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + (isAIProposal ? aiNodeVotingPeriod : humanVotingPeriod);
        
        // Create proposal
        Proposal storage proposal = proposals[proposalCounter];
        proposal.id = proposalCounter;
        proposal.proposer = msg.sender;
        proposal.startBlock = block.number;
        proposal.startTime = startTime;
        proposal.endTime = endTime;
        proposal.isAIProposal = isAIProposal;
        proposal.description = description;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.signatures = signatures;
        proposal.forVotes = 0;
        proposal.againstVotes = 0;
        proposal.abstainVotes = 0;
        proposal.executed = false;
        proposal.canceled = false;
        proposal.descriptionHash = keccak256(bytes(description));
        
        // Take snapshot of token balances
        // For simplicity, we're assuming the DLoopToken supports the snapshot feature
        // proposal.snapshotId = DLoopToken(address(governanceToken)).snapshot();
        
        activeProposalCount++;
        proposalCount[msg.sender]++;
        
        emit ProposalCreated(
            proposalCounter,
            msg.sender,
            targets,
            values,
            signatures,
            calldatas,
            description,
            startTime,
            endTime,
            isAIProposal
        );
        
        return proposalCounter;
    }
    
    /**
     * @notice Casts a vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Vote type (against, for, abstain)
     * @param reason Reason for the vote
     */
    function castVote(
        uint256 proposalId,
        VoteType support,
        string memory reason
    ) external whenNotPaused nonReentrant {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        ProposalState status = getProposalState(proposalId);
        
        require(status == ProposalState.Active, "Proposal not active");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        // For AI proposals, only verified AI nodes can vote
        if (proposal.isAIProposal) {
            require(aiNodeRegistry.isVerifiedAINode(msg.sender), "Not a verified AI node");
        }
        
        // Mark as voted
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = support;
        
        // Calculate voting weight
        uint256 weight = _getVotingWeight(msg.sender);
        
        // Apply voting power multiplier for reputation
        uint256 multiplier = votingPowerMultiplier[msg.sender];
        if (multiplier > 0) {
            weight = (weight * multiplier) / 10000; // Multiplier in basis points
        }
        
        // Register vote
        if (support == VoteType.Against) {
            proposal.againstVotes += weight;
        } else if (support == VoteType.For) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }
        
        emit VoteCast(msg.sender, proposalId, support, weight, reason);
    }
    
    /**
     * @notice Executes a successful proposal
     * @param proposalId ID of the proposal to execute
     */
    function execute(uint256 proposalId) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(EXECUTOR_ROLE) 
    {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        ProposalState status = getProposalState(proposalId);
        require(status == ProposalState.Succeeded, "Proposal not successful");
        
        Proposal storage proposal = proposals[proposalId];
        
        // Queue execution
        bytes32 queueId = _queueExecution(
            proposal.targets,
            proposal.values,
            proposal.calldatas,
            proposal.signatures,
            proposal.descriptionHash
        );
        
        // Update proposal state
        proposal.executed = true;
        
        // Update counters
        activeProposalCount--;
        successfulProposalCount++;
        
        emit ProposalExecuted(proposalId);
        emit ProposalQueued(proposalId, block.timestamp + timelock);
    }
    
    /**
     * @notice Cancels a proposal
     * @param proposalId ID of the proposal to cancel
     */
    function cancel(uint256 proposalId) 
        external 
        whenNotPaused 
    {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        // Only proposer or admin can cancel
        require(
            proposal.proposer == msg.sender || hasRole(GOVERNOR_ROLE, msg.sender),
            "Not authorized to cancel"
        );
        
        ProposalState status = getProposalState(proposalId);
        require(
            status != ProposalState.Executed &&
            status != ProposalState.Canceled,
            "Cannot cancel completed proposal"
        );
        
        proposal.canceled = true;
        
        // Update counter
        if (status == ProposalState.Active) {
            activeProposalCount--;
        }
        
        emit ProposalCanceled(proposalId);
    }
    
    /**
     * @notice Executes queued transactions
     * @param queueId ID of the queued execution
     */
    function executeQueuedProposal(bytes32 queueId) 
        external 
        whenNotPaused 
        nonReentrant 
        onlyRole(EXECUTOR_ROLE) 
    {
        QueuedExecution storage queued = executionQueue[queueId];
        
        require(queued.targets.length > 0, "Execution does not exist");
        require(!queued.executed, "Already executed");
        require(block.timestamp >= queued.eta, "Timelock not passed");
        require(block.timestamp <= queued.eta + gracePeriod, "Execution expired");
        
        queued.executed = true;
        
        // Execute each transaction
        for (uint256 i = 0; i < queued.targets.length; i++) {
            _executeTransaction(
                queued.targets[i],
                queued.values[i],
                queued.signatures[i],
                queued.calldatas[i]
            );
        }
        
        emit ExecutionExecuted(queueId);
    }
    
    /**
     * @notice Gets the state of a proposal
     * @param proposalId ID of the proposal
     * @return Current state of the proposal
     */
    function getProposalState(uint256 proposalId) public view returns (ProposalState) {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.canceled) {
            return ProposalState.Canceled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.timestamp <= proposal.startTime) {
            return ProposalState.Pending;
        }
        
        if (block.timestamp <= proposal.endTime) {
            return ProposalState.Active;
        }
        
        if (_quorumReached(proposalId) && _voteSucceeded(proposalId)) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }
    
    /**
     * @notice Sets the Asset DAO address
     * @param _assetDAO New Asset DAO address
     */
    function setAssetDAO(address _assetDAO) 
        external 
        onlyRole(GOVERNOR_ROLE) 
    {
        require(_assetDAO != address(0), "Invalid address");
        
        address oldAddress = assetDAO;
        assetDAO = _assetDAO;
        
        emit AssetDAOUpdated(oldAddress, _assetDAO);
    }
    
    /**
     * @notice Sets the Governance Rewards address
     * @param _governanceRewards New Governance Rewards address
     */
    function setGovernanceRewards(address _governanceRewards) 
        external 
        onlyRole(GOVERNOR_ROLE) 
    {
        require(_governanceRewards != address(0), "Invalid address");
        
        address oldAddress = governanceRewards;
        governanceRewards = _governanceRewards;
        
        emit GovernanceRewardsUpdated(oldAddress, _governanceRewards);
    }
    
    /**
     * @notice Updates voting period durations
     * @param _aiNodeVotingPeriod New AI node voting period
     * @param _humanVotingPeriod New human voting period
     */
    function updateVotingPeriods(
        uint256 _aiNodeVotingPeriod,
        uint256 _humanVotingPeriod
    ) 
        external 
        onlyRole(GOVERNOR_ROLE) 
    {
        require(_aiNodeVotingPeriod > 0, "AI voting period must be positive");
        require(_humanVotingPeriod > 0, "Human voting period must be positive");
        
        aiNodeVotingPeriod = _aiNodeVotingPeriod;
        humanVotingPeriod = _humanVotingPeriod;
        
        emit VotingPeriodUpdated(_aiNodeVotingPeriod, _humanVotingPeriod);
    }
    
    /**
     * @notice Updates quorum percentages
     * @param _quorumPercentage New quorum percentage (basis points)
     * @param _aiQuorumPercentage New AI-only quorum percentage (basis points)
     */
    function updateQuorumPercentages(
        uint256 _quorumPercentage,
        uint256 _aiQuorumPercentage
    ) 
        external 
        onlyRole(GOVERNOR_ROLE) 
    {
        require(_quorumPercentage > 0 && _quorumPercentage <= 10000, "Invalid quorum percentage");
        require(_aiQuorumPercentage > 0 && _aiQuorumPercentage <= 10000, "Invalid AI quorum percentage");
        
        quorumPercentage = _quorumPercentage;
        aiQuorumPercentage = _aiQuorumPercentage;
        
        emit QuorumUpdated(_quorumPercentage, _aiQuorumPercentage);
    }
    
    /**
     * @notice Sets voting power multiplier for an account
     * @param account Address of the account
     * @param multiplier Multiplier in basis points (10000 = 1x)
     */
    function setVotingPowerMultiplier(address account, uint256 multiplier) 
        external 
        onlyRole(GOVERNOR_ROLE) 
    {
        require(account != address(0), "Invalid address");
        require(multiplier > 0, "Multiplier must be positive");
        
        votingPowerMultiplier[account] = multiplier;
        
        emit VotingPowerMultiplierSet(account, multiplier);
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(GOVERNOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(GOVERNOR_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets proposal details
     * @param proposalId ID of the proposal
     * @return targets Target addresses for calls
     * @return values ETH values for calls
     * @return signatures Function signatures
     * @return calldatas Calldata for each call
     * @return startTime Proposal start time
     * @return endTime Proposal end time
     * @return forVotes Votes in favor
     * @return againstVotes Votes against
     * @return abstainVotes Abstentions
     * @return isAIProposal Whether it's an AI-only proposal
     * @return executed Whether the proposal has been executed
     * @return canceled Whether the proposal has been canceled
     */
    function getProposalDetails(uint256 proposalId) 
        external 
        view 
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas,
            uint256 startTime,
            uint256 endTime,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            bool isAIProposal,
            bool executed,
            bool canceled
        ) 
    {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        return (
            proposal.targets,
            proposal.values,
            proposal.signatures,
            proposal.calldatas,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.isAIProposal,
            proposal.executed,
            proposal.canceled
        );
    }
    
    /**
     * @notice Checks if an account has voted on a proposal
     * @param proposalId ID of the proposal
     * @param account Address of the account
     * @return hasVoted Whether the account has voted
     * @return support How the account voted
     */
    function getVoteInfo(uint256 proposalId, address account) 
        external 
        view 
        returns (bool hasVoted, VoteType support) 
    {
        require(_isValidProposalId(proposalId), "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        return (proposal.hasVoted[account], proposal.votes[account]);
    }
    
    /**
     * @notice Required by UUPS pattern
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
    
    /**
     * @notice Gets the voting weight for an account
     * @param account Address of the account
     * @return The voting weight
     */
    function _getVotingWeight(address account) internal view returns (uint256) {
        return governanceToken.balanceOf(account);
        
        // For more complex implementations, this could check the snapshot balance
        // at the time of proposal creation
    }
    
    /**
     * @notice Checks if a proposal has reached quorum
     * @param proposalId ID of the proposal
     * @return Whether quorum has been reached
     */
    function _quorumReached(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        uint256 totalWeight = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalSupply = governanceToken.totalSupply();
        
        uint256 requiredQuorum = proposal.isAIProposal
            ? (totalSupply * aiQuorumPercentage) / 10000
            : (totalSupply * quorumPercentage) / 10000;
        
        return totalWeight >= requiredQuorum;
    }
    
    /**
     * @notice Checks if a proposal has succeeded
     * @param proposalId ID of the proposal
     * @return Whether the vote succeeded
     */
    function _voteSucceeded(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        
        return proposal.forVotes > proposal.againstVotes;
    }
    
    /**
     * @notice Queues execution with timelock
     * @param targets Target addresses
     * @param values ETH values
     * @param calldatas Function calldatas
     * @param signatures Function signatures
     * @param descriptionHash Hash of proposal description
     * @return queueId ID of the queued execution
     */
    function _queueExecution(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string[] memory signatures,
        bytes32 descriptionHash
    ) internal returns (bytes32) {
        bytes32 queueId = keccak256(abi.encode(targets, values, calldatas, descriptionHash));
        uint256 eta = block.timestamp + timelock;
        
        executionQueue[queueId] = QueuedExecution({
            targets: targets,
            values: values,
            calldatas: calldatas,
            signatures: signatures,
            eta: eta,
            executed: false,
            proposalId: descriptionHash
        });
        
        emit ExecutionScheduled(queueId, eta);
        
        return queueId;
    }
    
    /**
     * @notice Executes a transaction
     * @param target Target address
     * @param value ETH value
     * @param signature Function signature
     * @param data Function calldata
     * @return success Whether the execution succeeded
     */
    function _executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data
    ) internal returns (bool) {
        bytes memory callData;
        
        if (bytes(signature).length > 0) {
            // Call with function signature
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        } else {
            // Call with just calldata
            callData = data;
        }
        
        (bool success, ) = target.call{value: value}(callData);
        require(success, "Transaction execution failed");
        
        return success;
    }
    
    /**
     * @notice Validates a proposal ID
     * @param proposalId ID to validate
     * @return Whether the ID is valid
     */
    function _isValidProposalId(uint256 proposalId) internal view returns (bool) {
        return proposalId > 0 && proposalId <= proposalCounter;
    }
}