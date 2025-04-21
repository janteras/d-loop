// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../../contracts/interfaces/governance/IAINodeGovernance.sol";

/**
 * @title MockAINodeGovernance
 * @dev Mock implementation of the AINodeGovernance contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockAINodeGovernance is BaseMock, IAINodeGovernance {
    // Role constants
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Node structure
    struct Node {
        address owner;
        NodeType nodeType;
        uint256 stake;
        uint256 delegatedAmount;
        uint256 reputation;
        uint256 lastActivity;
        bool isActive;
    }

    // Proposal structure
    struct Proposal {
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

    // State variables
    address public owner;
    address public admin;
    uint256 public minNodeStake;
    uint256 public minDelegationAmount;
    uint256 public delegationCooldown;
    uint256 public inactivityThreshold;
    uint256 public proposalCount;
    
    mapping(uint256 => Proposal) public proposals;
    mapping(address => Node) public nodes;
    mapping(bytes32 => mapping(address => bool)) private _roles;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /**
     * @dev Constructor
     */
    constructor() BaseMock() {
        owner = msg.sender;
        admin = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        minNodeStake = 1000 ether;
        minDelegationAmount = 100 ether;
        delegationCooldown = 3 days;
        inactivityThreshold = 30 days;
    }

    /**
     * @dev Submit a proposal for governance
     * @param description Description of the proposal
     * @param targets Target addresses for calls to be made during proposal execution
     * @param values ETH values for calls to be made during proposal execution
     * @param calldatas Calldata for calls to be made during proposal execution
     * @return proposalId The ID of the created proposal
     */
    function submitProposal(
        string memory description,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) external returns (uint256) {
        _recordFunctionCall(
            "submitProposal",
            abi.encode(description, targets, values, calldatas)
        );
        
        require(targets.length > 0, "No targets provided");
        require(targets.length == values.length, "Targets and values length mismatch");
        require(targets.length == calldatas.length, "Targets and calldatas length mismatch");
        
        uint256 proposalId = proposalCount++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.description = description;
        proposal.proposer = msg.sender;
        proposal.createdAt = block.timestamp;
        proposal.votingEnds = block.timestamp + 3 days;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        
        emit ProposalCreated(proposalId, msg.sender, description);
        
        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support Whether to support the proposal
     */
    function castVote(uint256 proposalId, bool support) external {
        _recordFunctionCall(
            "castVote",
            abi.encode(proposalId, support)
        );
        
        require(proposalId < proposalCount, "Invalid proposal ID");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp <= proposal.votingEnds, "Voting period ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.canceled, "Proposal canceled");
        
        hasVoted[proposalId][msg.sender] = true;
        
        if (support) {
            proposal.forVotes += 1;
        } else {
            proposal.againstVotes += 1;
        }
        
        emit VoteCast(proposalId, msg.sender, support, 1);
    }

    /**
     * @dev Execute a successful proposal
     * @param proposalId The ID of the proposal
     */
    function executeProposal(uint256 proposalId) external {
        _recordFunctionCall(
            "executeProposal",
            abi.encode(proposalId)
        );
        
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.votingEnds, "Voting period not ended");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.canceled, "Proposal canceled");
        require(proposal.forVotes > proposal.againstVotes, "Proposal not approved");
        
        proposal.executed = true;
        
        // Mock execution - in a real contract, this would execute the proposal
        
        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel a proposal
     * @param proposalId The ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external {
        _recordFunctionCall(
            "cancelProposal",
            abi.encode(proposalId)
        );
        
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.canceled, "Proposal already canceled");
        require(proposal.proposer == msg.sender || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        proposal.canceled = true;
        
        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Update governance parameters
     * @param _minNodeStake Minimum stake required for node operation
     * @param _minDelegationAmount Minimum amount for delegation
     * @param _delegationCooldown Cooldown period for delegation withdrawals
     * @param _inactivityThreshold Threshold for node inactivity
     */
    function updateParameters(
        uint256 _minNodeStake,
        uint256 _minDelegationAmount,
        uint256 _delegationCooldown,
        uint256 _inactivityThreshold
    ) external {
        _recordFunctionCall(
            "updateParameters",
            abi.encode(_minNodeStake, _minDelegationAmount, _delegationCooldown, _inactivityThreshold)
        );
        
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        minNodeStake = _minNodeStake;
        minDelegationAmount = _minDelegationAmount;
        delegationCooldown = _delegationCooldown;
        inactivityThreshold = _inactivityThreshold;
        
        emit ParametersUpdated(
            _minNodeStake,
            _minDelegationAmount,
            _delegationCooldown,
            _inactivityThreshold
        );
    }

    /**
     * @dev Register a new governance node
     * @param nodeType Type of the node
     */
    function registerNode(NodeType nodeType) external {
        _recordFunctionCall(
            "registerNode",
            abi.encode(nodeType)
        );
        
        require(nodes[msg.sender].owner == address(0), "Node already registered");
        
        nodes[msg.sender] = Node({
            owner: msg.sender,
            nodeType: nodeType,
            stake: 0,
            delegatedAmount: 0,
            reputation: 100,
            lastActivity: block.timestamp,
            isActive: false
        });
        
        emit NodeRegistered(msg.sender, msg.sender, nodeType);
    }

    /**
     * @dev Increase stake for a node
     * @param amount Amount to increase
     */
    function increaseNodeStake(uint256 amount) external {
        _recordFunctionCall(
            "increaseNodeStake",
            abi.encode(amount)
        );
        
        require(nodes[msg.sender].owner != address(0), "Node not registered");
        
        nodes[msg.sender].stake += amount;
        
        if (nodes[msg.sender].stake >= minNodeStake && !nodes[msg.sender].isActive) {
            nodes[msg.sender].isActive = true;
        }
        
        emit NodeStakeIncreased(msg.sender, amount);
    }

    /**
     * @dev Decrease stake for a node
     * @param amount Amount to decrease
     */
    function decreaseNodeStake(uint256 amount) external {
        _recordFunctionCall(
            "decreaseNodeStake",
            abi.encode(amount)
        );
        
        require(nodes[msg.sender].owner != address(0), "Node not registered");
        require(nodes[msg.sender].stake >= amount, "Insufficient stake");
        
        nodes[msg.sender].stake -= amount;
        
        if (nodes[msg.sender].stake < minNodeStake && nodes[msg.sender].isActive) {
            nodes[msg.sender].isActive = false;
        }
        
        emit NodeStakeDecreased(msg.sender, amount);
    }

    /**
     * @dev Delegate tokens to a node
     * @param node Address of the node
     * @param amount Amount to delegate
     */
    function delegateToNode(address node, uint256 amount) external {
        _recordFunctionCall(
            "delegateToNode",
            abi.encode(node, amount)
        );
        
        require(nodes[node].owner != address(0), "Node not registered");
        require(amount >= minDelegationAmount, "Amount below minimum");
        
        nodes[node].delegatedAmount += amount;
        nodes[node].lastActivity = block.timestamp;
        
        emit DelegationCreated(msg.sender, node, amount);
    }

    /**
     * @dev Withdraw delegation from a node
     * @param node Address of the node
     * @param amount Amount to withdraw
     */
    function withdrawDelegation(address node, uint256 amount) external {
        _recordFunctionCall(
            "withdrawDelegation",
            abi.encode(node, amount)
        );
        
        require(nodes[node].owner != address(0), "Node not registered");
        require(nodes[node].delegatedAmount >= amount, "Insufficient delegation");
        
        nodes[node].delegatedAmount -= amount;
        
        emit DelegationWithdrawn(msg.sender, node, amount);
    }

    /**
     * @dev Get proposal details
     * @param proposalId The ID of the proposal
     * @return description Description of the proposal
     * @return proposer Address of the proposer
     * @return createdAt Timestamp when the proposal was created
     * @return votingEnds Timestamp when voting ends
     * @return forVotes Number of votes in favor
     * @return againstVotes Number of votes against
     * @return executed Whether the proposal has been executed
     * @return canceled Whether the proposal has been canceled
     */
    function getProposal(uint256 proposalId) external view returns (
        string memory description,
        address proposer,
        uint256 createdAt,
        uint256 votingEnds,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled
    ) {
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        
        return (
            proposal.description,
            proposal.proposer,
            proposal.createdAt,
            proposal.votingEnds,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.executed,
            proposal.canceled
        );
    }

    /**
     * @dev Get node details
     * @param node Address of the node
    
    
    
    
    
    
    
     */
    function getNode(address node) external view returns (
        address _ownerAddress,
        NodeType nodeType,
        uint256 stake,
        uint256 delegatedAmount,
        uint256 reputation,
        uint256 lastActivity,
        bool isActive
    ) {
        Node storage nodeData = nodes[node];
        
        return (
            nodeData.owner,
            nodeData.nodeType,
            nodeData.stake,
            nodeData.delegatedAmount,
            nodeData.reputation,
            nodeData.lastActivity,
            nodeData.isActive
        );
    }

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Grant a role to an account
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        _roles[role][account] = true;
    }

    // Test helper functions

    /**
     * @dev Set a node's reputation (test helper)
     * @param node Address of the node
     * @param reputation New reputation score
     */
    function setNodeReputation(address node, uint256 reputation) external {
        _recordFunctionCall(
            "setNodeReputation",
            abi.encode(node, reputation)
        );
        
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(nodes[node].owner != address(0), "Node not registered");
        
        nodes[node].reputation = reputation;
    }

    /**
     * @dev Force set a proposal's state (test helper)
     * @param proposalId ID of the proposal
     * @param executed Whether the proposal is executed
     * @param canceled Whether the proposal is canceled
     */
    function setProposalState(uint256 proposalId, bool executed, bool canceled) external {
        _recordFunctionCall(
            "setProposalState",
            abi.encode(proposalId, executed, canceled)
        );
        
        require(hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(proposalId < proposalCount, "Invalid proposal ID");
        
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = executed;
        proposal.canceled = canceled;
    }
}
