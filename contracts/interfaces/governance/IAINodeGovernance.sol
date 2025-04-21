// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAINodeGovernance
 * @dev Interface for AI Node Governance operations in the D-Loop protocol
 * @notice This interface defines the standard functions for AI node governance
 */
interface IAINodeGovernance {
    // Node types
    enum NodeType { GovernanceNode, InvestmentNode }

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event ParametersUpdated(
        uint256 minNodeStake,
        uint256 minDelegationAmount,
        uint256 delegationCooldown,
        uint256 inactivityThreshold
    );
    event NodeRegistered(address indexed node, address indexed owner, NodeType nodeType);
    event NodeStakeIncreased(address indexed node, uint256 amount);
    event NodeStakeDecreased(address indexed node, uint256 amount);
    event DelegationCreated(address indexed delegator, address indexed node, uint256 amount);
    event DelegationWithdrawn(address indexed delegator, address indexed node, uint256 amount);

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
    ) external returns (uint256);

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support Whether to support the proposal
     */
    function castVote(uint256 proposalId, bool support) external;

    /**
     * @dev Execute a successful proposal
     * @param proposalId The ID of the proposal
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @dev Cancel a proposal
     * @param proposalId The ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external;

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
    ) external;

    /**
     * @dev Register a new governance node
     * @param nodeType Type of the node
     */
    function registerNode(NodeType nodeType) external;

    /**
     * @dev Increase stake for a node
     * @param amount Amount to increase
     */
    function increaseNodeStake(uint256 amount) external;

    /**
     * @dev Decrease stake for a node
     * @param amount Amount to decrease
     */
    function decreaseNodeStake(uint256 amount) external;

    /**
     * @dev Delegate tokens to a node
     * @param node Address of the node
     * @param amount Amount to delegate
     */
    function delegateToNode(address node, uint256 amount) external;

    /**
     * @dev Withdraw delegation from a node
     * @param node Address of the node
     * @param amount Amount to withdraw
     */
    function withdrawDelegation(address node, uint256 amount) external;

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
    );

    /**
     * @dev Get node details
     * @param node Address of the node
     * @return owner Address of the node owner
     * @return nodeType Type of the node
     * @return stake Amount staked
     * @return delegatedAmount Amount delegated to the node
     * @return reputation Reputation score
     * @return lastActivity Timestamp of last activity
     * @return isActive Whether the node is active
     */
    function getNode(address node) external view returns (
        address owner,
        NodeType nodeType,
        uint256 stake,
        uint256 delegatedAmount,
        uint256 reputation,
        uint256 lastActivity,
        bool isActive
    );
}
