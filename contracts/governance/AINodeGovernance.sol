// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../interfaces/core/IAINodeRegistry.sol";
import "../interfaces/tokens/IERC20.sol";
import "../utils/Errors.sol";

/**
 * @title AINodeGovernance
 * @dev Manages governance operations for AI nodes in the d-loop protocol.
 * This is a simplified version to avoid OpenZeppelin dependency issues.
 */
contract AINodeGovernance {

    // Custom errors
    
    error ReentrantCall();
    error MissingRole(bytes32 role, address account);
    
    error ActiveDelegationsExist(uint256 amount);
    error AmountMustBeGreaterThanZero();
    error NoActiveDelegation(address delegator, address node);
    error NodeNotActive();
    error BelowMinimumStake();
    error BelowMinimumDelegation();
    
    

    // Owner and admin
    // [TESTNET] Only deployer is owner/admin for Sepolia
    address public owner;
    address public admin;
    // [TESTNET] For Sepolia, only deployer is assigned as both owner and admin.
    
    // Role constants
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Node types
    enum NodeType { GovernanceNode, InvestmentNode }

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

    // Delegation structure
    struct Delegation {
        address delegator;
        address node;
        uint256 amount;
        uint256 startTime;
        bool isActive;
    }

    // State variables
    IERC20 public dloopToken;
    IAINodeRegistry public aiNodeRegistry;
    uint256 public minNodeStake;         // Minimum DLOOP tokens to stake for node operation
    uint256 public minDelegationAmount;  // Minimum amount to delegate
    uint256 public delegationCooldown;   // Time before delegated tokens can be withdrawn
    uint256 public inactivityThreshold;  // Time threshold to consider a node inactive
    mapping(address => Node) public nodes;
    mapping(address => mapping(address => Delegation)) public delegations;
    mapping(address => address[]) public delegatedNodes;   // Delegator -> list of nodes delegated to
    mapping(address => address[]) public nodeDelegators;   // Node -> list of delegators
    mapping(bytes32 => mapping(address => bool)) private _roles;
    // All state variables grouped for clarity.
    
    // Events
    // Events
    event NodeRegistered(address indexed owner, NodeType nodeType, uint256 stake);
    event NodeDeregistered(address indexed owner);
    event NodeStakeIncreased(address indexed owner, uint256 additionalStake);
    event NodeStakeDecreased(address indexed owner, uint256 withdrawnStake);
    event DelegationCreated(address indexed delegator, address indexed node, uint256 amount);
    event DelegationIncreased(address indexed delegator, address indexed node, uint256 additionalAmount);
    event DelegationDecreased(address indexed delegator, address indexed node, uint256 withdrawnAmount);
    event DelegationWithdrawn(address indexed delegator, address indexed node, uint256 amount);
    event NodeReputationUpdated(address indexed node, uint256 newReputation);
    event NodeActivityRecorded(address indexed node, uint256 timestamp);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);

    // Modifiers
    bool private _notEntered = true;
    modifier nonReentrant() {
        if (!_notEntered) revert ReentrantCall();
        _notEntered = false;
        _;
        _notEntered = true;
    }
    modifier onlyRole(bytes32 role) {
        if (!hasRole(role, msg.sender)) revert MissingRole(role, msg.sender);
        _;
    }
    // Modifiers grouped after events.

    /**
     * @dev Initializes the AINodeGovernance contract.
     * @param _dloopToken Address of the DLOOP token
     * @param _aiNodeRegistry Address of the AI node registry
     */
    constructor(address _dloopToken, address _aiNodeRegistry) {
        if (_dloopToken == address(0)) revert ZeroAddress();
        
        owner = msg.sender;
        admin = msg.sender;
        dloopToken = IERC20(_dloopToken);
        
        if (_aiNodeRegistry != address(0)) {
            aiNodeRegistry = IAINodeRegistry(_aiNodeRegistry);
        }
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(GOVERNANCE_ROLE, msg.sender);
        
        // Default settings
        minNodeStake = 10000 * 10**18;         // 10,000 DLOOP tokens
        minDelegationAmount = 100 * 10**18;    // 100 DLOOP tokens
        delegationCooldown = 7 days;
        inactivityThreshold = 30 days;
    }

    /**
     * @dev Sets the AI node registry
     * @param _aiNodeRegistry Address of the AI node registry
     */
    function setAINodeRegistry(address _aiNodeRegistry) external onlyRole(ADMIN_ROLE) {
        if (_aiNodeRegistry == address(0)) revert ZeroAddress();
        aiNodeRegistry = IAINodeRegistry(_aiNodeRegistry);
    }

    /**
     * @dev Updates governance parameters
     * @param _minNodeStake Minimum stake required for node operation
     * @param _minDelegationAmount Minimum amount that can be delegated
     * @param _delegationCooldown Cooldown period for delegation withdrawals
     * @param _inactivityThreshold Time after which a node is considered inactive
     */
    function updateParameters(
        uint256 _minNodeStake,
        uint256 _minDelegationAmount,
        uint256 _delegationCooldown,
        uint256 _inactivityThreshold
    )
        external
        onlyRole(ADMIN_ROLE)
    {
        minNodeStake = _minNodeStake;
        minDelegationAmount = _minDelegationAmount;
        delegationCooldown = _delegationCooldown;
        inactivityThreshold = _inactivityThreshold;
    }

    /**
     * @dev Registers a new AI node
     * @param _nodeType Type of node (GovernanceNode or InvestmentNode)
     * @param _stake Amount of DLOOP tokens to stake
     */
    function registerNode(NodeType _nodeType, uint256 _stake) external nonReentrant {
        if (nodes[msg.sender].isActive) revert NodeAlreadyRegistered();
        if (_stake < minNodeStake) revert InsufficientStake();
        
        // Transfer tokens from node owner to this contract
        dloopToken.transferFrom(msg.sender, address(this), _stake);
        
        // Create node record
        nodes[msg.sender] = Node({
            owner: msg.sender,
            nodeType: _nodeType,
            stake: _stake,
            delegatedAmount: 0,
            reputation: 0,
            lastActivity: block.timestamp,
            isActive: true
        });
        
        // Register in the AI node registry if available
        if (address(aiNodeRegistry) != address(0)) {
            aiNodeRegistry.registerNode(msg.sender, msg.sender, "");
        }
        
        emit NodeRegistered(msg.sender, _nodeType, _stake);
    }

    /**
     * @dev Deregisters an AI node
     */
    function deregisterNode() external nonReentrant {
        Node storage node = nodes[msg.sender];
        if (!node.isActive) revert NodeNotActive();
        
        // Check if all delegations have been withdrawn
        if (node.delegatedAmount > 0) revert ActiveDelegationsExist(node.delegatedAmount);
        
        // Mark node as inactive
        node.isActive = false;
        
        // Return staked tokens
        dloopToken.transfer(msg.sender, node.stake);
        node.stake = 0;
        
        // Deregister from the AI node registry if available
        if (address(aiNodeRegistry) != address(0)) {
            aiNodeRegistry.updateNodeState(msg.sender, IAINodeRegistry.NodeState.Inactive);
        }
        
        emit NodeDeregistered(msg.sender);
    }

    /**
     * @dev Increases a node's stake
     * @param _additionalStake Amount of additional DLOOP tokens to stake
     */
    function increaseNodeStake(uint256 _additionalStake) external nonReentrant {
        Node storage node = nodes[msg.sender];
        if (!node.isActive) revert NodeNotActive();
        if (_additionalStake == 0) revert AmountMustBeGreaterThanZero();
        
        // Transfer additional tokens
        dloopToken.transferFrom(msg.sender, address(this), _additionalStake);
        
        // Update stake
        node.stake = node.stake + _additionalStake;
        
        emit NodeStakeIncreased(msg.sender, _additionalStake);
    }

    /**
     * @dev Decreases a node's stake
     * @param _withdrawAmount Amount of DLOOP tokens to withdraw from stake
     */
    function decreaseNodeStake(uint256 _withdrawAmount) external nonReentrant {
        Node storage node = nodes[msg.sender];
        if (!node.isActive) revert NodeNotActive();
        if (_withdrawAmount == 0) revert AmountMustBeGreaterThanZero();
        if (_withdrawAmount > node.stake) revert InsufficientBalance();
        
        uint256 remainingStake = node.stake - _withdrawAmount;
        if (remainingStake < minNodeStake) revert BelowMinimumStake();
        
        // Update stake
        node.stake = remainingStake;
        
        // Transfer tokens back to owner
        dloopToken.transfer(msg.sender, _withdrawAmount);
        
        emit NodeStakeDecreased(msg.sender, _withdrawAmount);
    }

    /**
     * @dev Checks if an account has a role
     * @param role The role to check
     * @param account The account to check
     * @return Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Grants a role to an account
     * @param role The role to grant
     * @param account The account to grant the role to
     */
    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes a role from an account
     * @param role The role to revoke
     * @param account The account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
    }

    /**
     * @dev Internal function to setup a role
     * @param role The role to setup
     * @param account The account to grant the role to
     */
    function _setupRole(bytes32 role, address account) internal {
        _grantRole(role, account);
    }

    /**
     * @dev Internal function to grant a role
     * @param role The role to grant
     * @param account The account to grant the role to
     */
    function _grantRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /**
     * @dev Internal function to revoke a role
     * @param role The role to revoke
     * @param account The account to revoke the role from
     */
    function _revokeRole(bytes32 role, address account) internal {
        if (hasRole(role, account)) {
            _roles[role][account] = false;
        }
    }

    /**
     * @dev Creates a delegation to an AI node
     * @param _node Address of the node to delegate to
     * @param _amount Amount of DLOOP tokens to delegate
     */
    function delegateToNode(address _node, uint256 _amount) external nonReentrant {
        if (!nodes[_node].isActive) revert NodeNotActive();
        if (_amount < minDelegationAmount) revert BelowMinimumDelegation();
        
        Delegation storage delegation = delegations[msg.sender][_node];
        
        // Transfer tokens from delegator to this contract
        dloopToken.transferFrom(msg.sender, address(this), _amount);
        
        if (!delegation.isActive) {
            // Create new delegation
            delegation.delegator = msg.sender;
            delegation.node = _node;
            delegation.amount = _amount;
            delegation.startTime = block.timestamp;
            delegation.isActive = true;
            
            // Add to delegator's list
            delegatedNodes[msg.sender].push(_node);
            
            // Add to node's delegators list
            nodeDelegators[_node].push(msg.sender);
            
            emit DelegationCreated(msg.sender, _node, _amount);
        } else {
            // Increase existing delegation
            delegation.amount = delegation.amount + _amount;
            delegation.startTime = block.timestamp; // Reset cooldown
            
            emit DelegationIncreased(msg.sender, _node, _amount);
        }
        
        // Update node's delegated amount
        nodes[_node].delegatedAmount = nodes[_node].delegatedAmount + _amount;
    }

    /**
     * @dev Withdraws a delegation from an AI node
     * @param _node Address of the node to withdraw delegation from
     * @param _amount Amount of DLOOP tokens to withdraw
     */
    function withdrawDelegation(address _node, uint256 _amount) external nonReentrant {
        Delegation storage delegation = delegations[msg.sender][_node];
        if (!delegation.isActive) revert NoActiveDelegation(msg.sender, _node);
        if (_amount == 0 || _amount > delegation.amount) revert InvalidAmount();
        
        // Check cooldown period
        if (block.timestamp < delegation.startTime + delegationCooldown) {
            revert CooldownPeriodNotMet();
        }
        
        // Update delegation
        delegation.amount = delegation.amount - _amount;
        
        // Update node's delegated amount
        nodes[_node].delegatedAmount = nodes[_node].delegatedAmount - _amount;
        
        // If fully withdrawn, mark as inactive
        if (delegation.amount == 0) {
            delegation.isActive = false;
            
            // Remove from lists
            _removeFromDelegatedNodes(msg.sender, _node);
            _removeFromNodeDelegators(_node, msg.sender);
            
            emit DelegationWithdrawn(msg.sender, _node, _amount);
        } else {
            emit DelegationDecreased(msg.sender, _node, _amount);
        }
        
        // Transfer tokens back to delegator
        dloopToken.transfer(msg.sender, _amount);
    }

    /**
     * @dev Records node activity
     * @param _node Address of the node
     */
    function recordNodeActivity(address _node) external {
        if (!(
            hasRole(GOVERNANCE_ROLE, msg.sender) ||
            hasRole(ADMIN_ROLE, msg.sender) ||
            _node == msg.sender
        )) {
            revert Unauthorized();
        }
        
        if (!nodes[_node].isActive) revert NodeNotActive();
        
        nodes[_node].lastActivity = block.timestamp;
        
        emit NodeActivityRecorded(_node, block.timestamp);
    }

    /**
     * @dev Updates a node's reputation
     * @param _node Address of the node
     * @param _newReputation New reputation score
     */
    function updateNodeReputation(address _node, uint256 _newReputation) external onlyRole(GOVERNANCE_ROLE) {
        if (!nodes[_node].isActive) revert NodeNotActive();
        
        nodes[_node].reputation = _newReputation;
        
        emit NodeReputationUpdated(_node, _newReputation);
    }

    /**
     * @dev Checks if a node is active
     * @param _node Address of the node
     * @return Whether the node is active
     */
    function isNodeActive(address _node) external view returns (bool) {
        Node storage node = nodes[_node];
        if (!node.isActive) return false;
        
        // Check if node has been inactive for too long
        if (block.timestamp > node.lastActivity + inactivityThreshold) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Gets a node's details
     * @param _node Address of the node
     * @return nodeOwner The node owner
     * @return nodeType The node type
     * @return stake The node stake
     * @return delegatedAmount The amount delegated to the node
     * @return reputation The node reputation
     * @return lastActivity Timestamp of the last activity
     * @return isActive Whether the node is active
     */
    function getNodeDetails(address _node)
        external
        view
        returns (
            address nodeOwner,
            NodeType nodeType,
            uint256 stake,
            uint256 delegatedAmount,
            uint256 reputation,
            uint256 lastActivity,
            bool isActive
        )
    {
        Node storage node = nodes[_node];
        return (
            node.owner,
            node.nodeType,
            node.stake,
            node.delegatedAmount,
            node.reputation,
            node.lastActivity,
            node.isActive
        );
    }

    /**
     * @dev Gets a delegation's details
     * @param _delegator Address of the delegator
     * @param _node Address of the node
     * @return amount The delegation amount
     * @return startTime The delegation start time
     * @return isActive Whether the delegation is active
     */
    function getDelegationDetails(address _delegator, address _node)
        external
        view
        returns (
            uint256 amount,
            uint256 startTime,
            bool isActive
        )
    {
        Delegation storage delegation = delegations[_delegator][_node];
        return (
            delegation.amount,
            delegation.startTime,
            delegation.isActive
        );
    }

    /**
     * @dev Gets the nodes a delegator has delegated to
     * @param _delegator Address of the delegator
     * @return List of node addresses
     */
    function getDelegatedNodes(address _delegator) external view returns (address[] memory) {
        return delegatedNodes[_delegator];
    }

    /**
     * @dev Gets the delegators of a node
     * @param _node Address of the node
     * @return List of delegator addresses
     */
    function getNodeDelegators(address _node) external view returns (address[] memory) {
        return nodeDelegators[_node];
    }

    /**
     * @dev Gets the total voting power of a node
     * @param _node Address of the node
     * @return The total voting power (stake + delegated amount)
     */
    function getNodeVotingPower(address _node) external view returns (uint256) {
        Node storage node = nodes[_node];
        return node.stake + node.delegatedAmount;
    }

    /**
     * @dev Removes a node from a delegator's list
     * @param _delegator Address of the delegator
     * @param _node Address of the node
     */
    function _removeFromDelegatedNodes(address _delegator, address _node) internal {
        address[] storage delegatedNodesList = delegatedNodes[_delegator];
        for (uint256 i = 0; i < delegatedNodesList.length; i++) {
            if (delegatedNodesList[i] == _node) {
                // Swap with the last element and pop
                delegatedNodesList[i] = delegatedNodesList[delegatedNodesList.length - 1];
                delegatedNodesList.pop();
                break;
            }
        }
    }

    /**
     * @dev Removes a delegator from a node's list
     * @param _node Address of the node
     * @param _delegator Address of the delegator
     */
    function _removeFromNodeDelegators(address _node, address _delegator) internal {
        address[] storage delegators = nodeDelegators[_node];
        for (uint256 i = 0; i < delegators.length; i++) {
            if (delegators[i] == _delegator) {
                // Swap with the last element and pop
                delegators[i] = delegators[delegators.length - 1];
                delegators.pop();
                break;
            }
        }
    }
}