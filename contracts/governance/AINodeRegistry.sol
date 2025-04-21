// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../utils/Errors.sol";
import { IERC20 } from "../interfaces/tokens/IERC20.sol";
import { ITokenApprovalOptimizer } from "../interfaces/tokens/ITokenApprovalOptimizer.sol";
import { ISoulboundNFT } from "../interfaces/tokens/ISoulboundNFT.sol";

/**
 * @title AINodeRegistry
 * @dev Registry for AI nodes in the DLOOP protocol
 * @notice This contract manages the registration and status of AI nodes
 */
contract AINodeRegistry {
    // Events for node management
    event NodeRegistered(address indexed nodeAddress, address indexed owner, uint256 soulboundTokenId);
    event NodeDeactivated(address indexed nodeAddress, address indexed owner);
    // NodeStatusChanged event is declared below
    event NodeReputationUpdated(address indexed nodeAddress, uint256 oldReputation, uint256 newReputation);
    event NodeStakeChanged(address indexed nodeAddress, address token, uint256 amount, bool isStake);
    event NodeMetadataUpdated(address indexed nodeAddress, string oldMetadata, string newMetadata);
    // Node states
    enum NodeState {
        Inactive,
        Active,
        Suspended,
        Penalized
    }
    
    // Node structure
    struct Node {
        address owner;
        string metadata;
        uint256 registeredAt;
        uint256 activeUntil;
        NodeState state;
        uint256 reputation;
        bool exists;
        uint256 stakedAmount; // Amount of tokens staked
        address stakedToken;  // Token used for staking
        uint256 soulboundTokenId; // ID of the soulbound NFT associated with this node
    }
    
    // Token requirement structure
    struct TokenRequirement {
        address token;
        uint256 amount;
        bool isActive;
    }
    
    // Role management
    // [TESTNET] Only deployer is owner/admin for Sepolia
    address public owner;
    address public admin;
    address public governanceContract;
    // [TESTNET] For Sepolia, only deployer is assigned as both owner and admin.
    
    // SoulboundNFT contract
    ISoulboundNFT public soulboundNFT;
    
    // Node storage
    mapping(address => Node) private nodes;
    address[] private nodeAddresses;
    
    // Token requirements
    mapping(uint256 => TokenRequirement) private tokenRequirements;
    
    // Track total staked tokens
    mapping(address => uint256) private totalStakedTokens;
    
    // Constants
    uint256 private constant DEFAULT_REGISTRATION_PERIOD = 30 days;
    uint256 private constant DEFAULT_REPUTATION = 100;
    
    // Events
    event NodeRegistered(address indexed nodeAddress, address indexed nodeOwner, string metadata);
    event NodeStatusChanged(address indexed nodeAddress, NodeState oldState, NodeState newState);
    event NodeExtended(address indexed nodeAddress, uint256 oldActiveUntil, uint256 newActiveUntil);
    event ReputationUpdated(address indexed nodeAddress, uint256 oldReputation, uint256 newReputation);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event GovernanceContractUpdated(address indexed oldContract, address indexed newContract);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event TokenRequirementSet(uint256 indexed requirementId, address token, uint256 amount);
    event TokensStaked(address indexed nodeAddress, address indexed token, uint256 amount);
    event TokensReleased(address indexed nodeAddress, address indexed token, uint256 amount);
    event NodeDeregistered(address indexed nodeAddress, bool withRefund);
    event TokensRecovered(address indexed token, address indexed recipient, uint256 amount);
    event SoulboundNFTSet(address indexed oldSoulboundNFT, address indexed newSoulboundNFT);
    event SoulboundNFTMinted(address indexed nodeAddress, address indexed nodeOwner, uint256 tokenId);
    event SoulboundNFTRevoked(address indexed nodeAddress, uint256 tokenId);
    
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
     * @dev Modifier to restrict access to governance contract
     */
    modifier onlyGovernance() {
        if (msg.sender != governanceContract && msg.sender != admin && msg.sender != owner)
            revert Unauthorized();
        _;
    }
    
    /**
     * @dev Modifier to ensure the caller is the owner of the node
     */
    modifier onlyNodeOwner(address nodeAddress) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        if (nodes[nodeAddress].owner != msg.sender) revert NotNodeOwner();
        _;
    }
    
    /**
     * @dev Constructor to initialize the AINodeRegistry contract
     * @param _admin Address of the admin
     * @param _governanceContract Address of the governance contract
     * @param _soulboundNFT Address of the SoulboundNFT contract
     */
    constructor(address _admin, address _governanceContract, address _soulboundNFT) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_soulboundNFT == address(0)) revert ZeroAddress();
        
        owner = msg.sender;
        admin = _admin;
        governanceContract = _governanceContract; // Can be address(0) initially
        soulboundNFT = ISoulboundNFT(_soulboundNFT);
        
        // Request minter role from the SoulboundNFT contract
        // This only works if this contract deployer already has the admin role on the SoulboundNFT
        try ISoulboundNFT(_soulboundNFT).grantMinterRole(address(this)) {
            // Successfully granted minter role
        } catch {
            // Failed to obtain minter role - this is not a critical failure
            // The admin must grant this contract the MINTER_ROLE manually
        }
    }
    
    /**
     * @dev Registers a new AI node
     * @param nodeAddress Address of the node
     * @param nodeOwner Address of the node owner
     * @param metadata Metadata URI for the node
     */
    function registerNode(
        address nodeAddress,
        address nodeOwner,
        string memory metadata
    ) external onlyAdmin {
        if (nodeAddress == address(0) || nodeOwner == address(0)) revert ZeroAddress();
        if (nodes[nodeAddress].exists) revert NodeAlreadyRegistered();
        
        // Mint a soulbound NFT for the node
        uint256 tokenId = soulboundNFT.mint(nodeOwner, metadata);
        
        nodes[nodeAddress] = Node({
            owner: nodeOwner,
            metadata: metadata,
            registeredAt: block.timestamp,
            activeUntil: block.timestamp + DEFAULT_REGISTRATION_PERIOD,
            state: NodeState.Active,
            reputation: DEFAULT_REPUTATION,
            exists: true,
            stakedAmount: 0,
            stakedToken: address(0),
            soulboundTokenId: tokenId
        });
        
        nodeAddresses.push(nodeAddress);
        
        emit NodeRegistered(nodeAddress, nodeOwner, metadata);
        emit SoulboundNFTMinted(nodeAddress, nodeOwner, tokenId);
    }
    
    /**
     * @dev Sets a token requirement for node registration or staking
     * @param requirementId ID for the requirement
     * @param token Address of the required token
     * @param amount Amount of tokens required
     */
    function setTokenRequirement(
        uint256 requirementId,
        address token,
        uint256 amount
    ) external onlyAdmin {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        tokenRequirements[requirementId] = TokenRequirement({
            token: token,
            amount: amount,
            isActive: true
        });
        
        emit TokenRequirementSet(requirementId, token, amount);
    }
    
    /**
     * @dev Registers a new AI node with token staking
     * @param nodeAddress Address of the node
     * @param metadata Metadata URI for the node
     * @param requirementId ID of the token requirement to use
     */
    function registerNodeWithStaking(
        address nodeAddress,
        string memory metadata,
        uint256 requirementId
    ) external {
        if (nodeAddress == address(0)) revert ZeroAddress();
        if (nodes[nodeAddress].exists) revert NodeAlreadyRegistered();
        
        // Get token requirement
        TokenRequirement memory requirement = tokenRequirements[requirementId];
        if (!requirement.isActive) revert InvalidRequirement();
        if (requirement.token == address(0)) revert InvalidToken();
        
        // Transfer tokens from sender to this contract
        IERC20 token = IERC20(requirement.token);
        bool success = token.transferFrom(msg.sender, address(this), requirement.amount);
        if (!success) revert TransferFailed();
        
        // Track staked tokens
        totalStakedTokens[requirement.token] += requirement.amount;
        
        // Mint a soulbound NFT for the node
        uint256 tokenId = soulboundNFT.mint(msg.sender, metadata);
        
        // Register node with staking info
        nodes[nodeAddress] = Node({
            owner: msg.sender,
            metadata: metadata,
            registeredAt: block.timestamp,
            activeUntil: block.timestamp + DEFAULT_REGISTRATION_PERIOD,
            state: NodeState.Active,
            reputation: DEFAULT_REPUTATION,
            exists: true,
            stakedAmount: requirement.amount,
            stakedToken: requirement.token,
            soulboundTokenId: tokenId
        });
        
        nodeAddresses.push(nodeAddress);
        
        emit NodeRegistered(nodeAddress, msg.sender, metadata);
        emit TokensStaked(nodeAddress, requirement.token, requirement.amount);
        emit SoulboundNFTMinted(nodeAddress, msg.sender, tokenId);
    }
    
    /**
     * @dev Registers a node with optimized token approval using TokenApprovalOptimizer
     * @param nodeAddress Address of the node
     * @param metadata Metadata URI for the node
     * @param requirementId ID of the token requirement to use
     * @param optimizer Address of the TokenApprovalOptimizer contract
     */
    function registerNodeWithOptimizedApproval(
        address nodeAddress,
        string memory metadata,
        uint256 requirementId,
        address optimizer
    ) external returns (uint256) {
        if (nodeAddress == address(0)) revert ZeroAddress();
        if (nodes[nodeAddress].exists) revert NodeAlreadyRegistered();
        if (optimizer == address(0)) revert ZeroAddress();

        TokenRequirement memory requirement = tokenRequirements[requirementId];
        address stakeToken = requirement.token;
        uint256 stakeAmount = requirement.amount;
        address nodeOwner = msg.sender;

        uint256 tokenId = _mintSoulboundAndRegisterNode(nodeAddress, nodeOwner, metadata, stakeToken, stakeAmount);
        _optimizeAndTransferStake(nodeOwner, stakeToken, stakeAmount, optimizer);
        return tokenId;
    }

    /**
     * @dev Mints a soulbound NFT and registers a node
     * @param nodeAddress Address of the node
     * @param nodeOwner Address of the node owner
     * @param metadata Metadata URI for the node
     * @param stakeToken Address of the staked token
     * @param stakeAmount Amount of tokens staked
     */
    function _mintSoulboundAndRegisterNode(
        address nodeAddress,
        address nodeOwner,
        string memory metadata,
        address stakeToken,
        uint256 stakeAmount
    ) private returns (uint256 tokenId) {
        tokenId = soulboundNFT.mint(nodeOwner, metadata);
        nodes[nodeAddress] = Node({
            owner: nodeOwner,
            metadata: metadata,
            registeredAt: block.timestamp,
            activeUntil: block.timestamp + DEFAULT_REGISTRATION_PERIOD,
            state: NodeState.Active,
            reputation: DEFAULT_REPUTATION,
            exists: true,
            stakedAmount: stakeAmount,
            stakedToken: stakeToken,
            soulboundTokenId: tokenId
        });
        nodeAddresses.push(nodeAddress);
        emit NodeRegistered(nodeAddress, nodeOwner, tokenId);
        return tokenId;
    }

    /**
     * @dev Optimizes token approval and transfers stake
     * @param nodeOwner Address of the node owner
     * @param stakeToken Address of the staked token
     * @param stakeAmount Amount of tokens staked
     * @param optimizer Address of the TokenApprovalOptimizer contract
     */
    function _optimizeAndTransferStake(
        address nodeOwner,
        address stakeToken,
        uint256 stakeAmount,
        address optimizer
    ) private {
        ITokenApprovalOptimizer(optimizer).optimizeApproval(
            IERC20(stakeToken),
            address(this),
            stakeAmount
        );
        bool transferSuccess = IERC20(stakeToken).transferFrom(
            nodeOwner,
            address(this),
            stakeAmount
        );
        if (!transferSuccess) revert TransferFailed();
    }
    /**
     * @dev Register node with safe approval that is cleared after use
     * @param nodeAddress Address of the node
     * @param metadata Metadata URI for the node
     * @param requirementId ID of the token requirement to use
     */
    function registerNodeWithSafeApproval(
        address nodeAddress,
        string memory metadata,
        uint256 requirementId
    ) external {
        if (nodeAddress == address(0)) revert ZeroAddress();
        if (nodes[nodeAddress].exists) revert NodeAlreadyRegistered();
        
        // Get token requirement
        TokenRequirement memory requirement = tokenRequirements[requirementId];
        if (!requirement.isActive) revert InvalidRequirement();
        if (requirement.token == address(0)) revert InvalidToken();
        
        // Transfer tokens from sender to this contract
        IERC20 token = IERC20(requirement.token);
        bool success = token.transferFrom(msg.sender, address(this), requirement.amount);
        if (!success) revert TransferFailed();
        
        // Clear approval for security after use
        token.approve(msg.sender, 0);
        
        // Track staked tokens
        totalStakedTokens[requirement.token] += requirement.amount;
        
        // Mint a soulbound NFT for the node
        uint256 tokenId = soulboundNFT.mint(msg.sender, metadata);
        
        // Register node with staking info
        nodes[nodeAddress] = Node({
            owner: msg.sender,
            metadata: metadata,
            registeredAt: block.timestamp,
            activeUntil: block.timestamp + DEFAULT_REGISTRATION_PERIOD,
            state: NodeState.Active,
            reputation: DEFAULT_REPUTATION,
            exists: true,
            stakedAmount: requirement.amount,
            stakedToken: requirement.token,
            soulboundTokenId: tokenId
        });
        
        nodeAddresses.push(nodeAddress);
        
        emit NodeRegistered(nodeAddress, msg.sender, metadata);
        emit TokensStaked(nodeAddress, requirement.token, requirement.amount);
        emit SoulboundNFTMinted(nodeAddress, msg.sender, tokenId);
    }
    
    /**
     * @dev Deregister a node and refund staked tokens
     */
    /**
     * @dev Deactivates a node and refunds the stake
     * @notice This function allows a node owner to deactivate their node and receive their stake back
     * @return success Whether the deactivation was successful
     */
    function deregisterNodeWithRefund() external returns (bool success) {
        address nodeAddress = msg.sender;
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        if (nodes[nodeAddress].owner != msg.sender) revert NotNodeOwner();
        
        // Get node information before deactivation
        Node storage node = nodes[nodeAddress];
        address nodeOwner = node.owner;
        address stakedToken = node.stakedToken;
        uint256 stakedAmount = node.stakedAmount;
        uint256 soulboundTokenId = node.soulboundTokenId;
        
        // Update node state
        node.state = NodeState.Inactive;
        node.activeUntil = block.timestamp;
        
        // Refund stake if any
        if (stakedAmount > 0 && stakedToken != address(0)) {
            IERC20(stakedToken).transfer(nodeOwner, stakedAmount);
            node.stakedAmount = 0;
        }
        
        // Revoke the soulbound token
        if (soulboundTokenId > 0) {
            soulboundNFT.revoke(soulboundTokenId);
        }
        
        // Emit the NodeDeactivated event
        emit NodeDeactivated(nodeAddress, nodeOwner);
        
        return true;
    }
    
    /**
     * @dev Legacy deregistration function (kept for backward compatibility)
     */
    function deregisterNode() external returns (bool) {
        address nodeAddress = msg.sender;
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        // Skip if no tokens staked
        Node storage node = nodes[nodeAddress];
        if (node.stakedAmount > 0 && node.stakedToken != address(0)) {
            // Transfer tokens back to owner
            IERC20 token = IERC20(node.stakedToken);
            uint256 amountToReturn = node.stakedAmount;
            
            // Update total staked tokens
            totalStakedTokens[node.stakedToken] -= amountToReturn;
            
            // Clear staking info
            node.stakedAmount = 0;
            
            // Transfer tokens back to owner
            bool transferSuccess = token.transfer(msg.sender, amountToReturn);
            if (!transferSuccess) revert TransferFailed();
            
            emit TokensReleased(nodeAddress, node.stakedToken, amountToReturn);
        }
        
        // Burn soulbound NFT if one exists
        if (node.soulboundTokenId > 0) {
            soulboundNFT.burn(node.soulboundTokenId);
            emit SoulboundNFTRevoked(nodeAddress, node.soulboundTokenId);
            node.soulboundTokenId = 0;
        }
        
        // Deactivate node
        node.state = NodeState.Inactive;
        
        emit NodeDeregistered(nodeAddress, true);
    }
    
    /**
     * @dev Increase the staked amount for a node
     * @param additionalAmount Amount of additional tokens to stake
     */
    function increaseNodeStake(uint256 additionalAmount) external onlyNodeOwner(msg.sender) {
        if (additionalAmount == 0) revert InvalidAmount();
        
        Node storage node = nodes[msg.sender];
        if (node.stakedToken == address(0)) revert NoStakedToken();
        
        // Transfer additional tokens
        IERC20 token = IERC20(node.stakedToken);
        bool success = token.transferFrom(msg.sender, address(this), additionalAmount);
        if (!success) revert TransferFailed();
        
        // Update staking info
        node.stakedAmount += additionalAmount;
        totalStakedTokens[node.stakedToken] += additionalAmount;
        
        emit TokensStaked(msg.sender, node.stakedToken, additionalAmount);
    }
    
    /**
     * @dev Decrease the staked amount for a node
     * @param decreaseAmount Amount of tokens to unstake
     */
    function decreaseNodeStake(uint256 decreaseAmount) external onlyNodeOwner(msg.sender) {
        if (decreaseAmount == 0) revert InvalidAmount();
        
        Node storage node = nodes[msg.sender];
        if (node.stakedToken == address(0)) revert NoStakedToken();
        if (node.stakedAmount < decreaseAmount) revert InsufficientStake();
        
        // Find relevant token requirement
        uint256 minRequired = 0;
        for (uint256 i = 1; i <= 10; i++) { // Check first 10 requirements
            TokenRequirement memory req = tokenRequirements[i];
            if (req.isActive && req.token == node.stakedToken) {
                minRequired = req.amount;
                break;
            }
        }
        
        // Ensure minimum stake maintained
        if (node.stakedAmount - decreaseAmount < minRequired) 
            revert InsufficientRemainingStake();
        
        // Update staking info
        node.stakedAmount -= decreaseAmount;
        totalStakedTokens[node.stakedToken] -= decreaseAmount;
        
        // Transfer tokens back to owner
        IERC20 token = IERC20(node.stakedToken);
        bool success = token.transfer(msg.sender, decreaseAmount);
        if (!success) revert TransferFailed();
        
        emit TokensReleased(msg.sender, node.stakedToken, decreaseAmount);
    }
    
    /**
     * @dev Allows admin to recover ERC20 tokens sent to this contract by mistake
     * @param tokenAddress Address of the token to recover
     * @param amount Amount to recover
     * @param recipient Address to send recovered tokens to
     */
    function recoverERC20(
        address tokenAddress,
        uint256 amount,
        address recipient
    ) external onlyAdmin {
        if (tokenAddress == address(0)) revert ZeroAddress();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Ensure we're not recovering staked tokens
        uint256 availableAmount = IERC20(tokenAddress).balanceOf(address(this)) - totalStakedTokens[tokenAddress];
        if (amount > availableAmount) revert InsufficientUnstakedTokens();
        
        // Transfer tokens to recipient
        IERC20 token = IERC20(tokenAddress);
        bool success = token.transfer(recipient, amount);
        if (!success) revert TransferFailed();
        
        emit TokensRecovered(tokenAddress, recipient, amount);
    }
    
    /**
     * @dev Gets information about a token requirement
     * @param requirementId ID of the requirement
     * @return token Address of the required token
     * @return amount Amount of tokens required
     * @return isActive Whether the requirement is active
     */
    function getTokenRequirement(uint256 requirementId) external view returns (
        address token,
        uint256 amount,
        bool isActive
    ) {
        TokenRequirement memory requirement = tokenRequirements[requirementId];
        return (requirement.token, requirement.amount, requirement.isActive);
    }
    
    /**
     * @dev Updates the state of a node
     * @param nodeAddress Address of the node
     * @param newState New state of the node
     */
    function updateNodeState(address nodeAddress, NodeState newState) external onlyGovernance {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        NodeState oldState = nodes[nodeAddress].state;
        nodes[nodeAddress].state = newState;
        
        emit NodeStatusChanged(nodeAddress, oldState, newState);
    }
    
    /**
     * @dev Extends the active period of a node
     * @param nodeAddress Address of the node
     * @param extensionPeriod Period to extend (in seconds)
     */
    function extendNodePeriod(address nodeAddress, uint256 extensionPeriod) external onlyAdmin {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        if (extensionPeriod == 0) revert InvalidPeriod();
        
        uint256 oldActiveUntil = nodes[nodeAddress].activeUntil;
        uint256 newActiveUntil = oldActiveUntil + extensionPeriod;
        
        nodes[nodeAddress].activeUntil = newActiveUntil;
        
        emit NodeExtended(nodeAddress, oldActiveUntil, newActiveUntil);
    }
    
    /**
     * @dev Updates the reputation of a node
     * @param nodeAddress Address of the node
     * @param newReputation New reputation score
     */
    function updateReputation(address nodeAddress, uint256 newReputation) external onlyGovernance {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        uint256 oldReputation = nodes[nodeAddress].reputation;
        nodes[nodeAddress].reputation = newReputation;
        
        emit ReputationUpdated(nodeAddress, oldReputation, newReputation);
    }
    
    /**
     * @dev Gets the details of a node
     * @param nodeAddress Address of the node
     * @return nodeOwner Owner of the node
     * @return metadata Metadata URI of the node
     * @return registeredAt Registration timestamp
     * @return activeUntil Active until timestamp
     * @return state State of the node
     * @return reputation Reputation score
     * @return soulboundTokenId ID of the soulbound NFT for this node
     */
    function getNodeDetails(address nodeAddress) external view returns (
        address nodeOwner,
        string memory metadata,
        uint256 registeredAt,
        uint256 activeUntil,
        NodeState state,
        uint256 reputation,
        uint256 soulboundTokenId
    ) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        Node storage node = nodes[nodeAddress];
        
        return (
            node.owner,
            node.metadata,
            node.registeredAt,
            node.activeUntil,
            node.state,
            node.reputation,
            node.soulboundTokenId
        );
    }
    
    /**
     * @dev Gets the staking details for a node
     * @param nodeAddress Address of the node
     * @return stakedToken Address of the staked token
     * @return stakedAmount Amount of tokens staked
     */
    function getNodeStakeDetails(address nodeAddress) external view returns (
        address stakedToken,
        uint256 stakedAmount
    ) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        Node storage node = nodes[nodeAddress];
        return (node.stakedToken, node.stakedAmount);
    }
    
    /**
     * @dev Gets all registered node addresses
     * @return addresses Array of node addresses
     */
    /**
     * @dev Gets all registered node addresses
     * @return addresses Array of all registered node addresses
     */
    function getAllNodeAddresses() external view returns (address[] memory) {
        return nodeAddresses;
    }
    
    /**
     * @dev Gets information about a specific node
     * @param nodeAddress Address of the node
     * @return nodeOwner Address of the node owner
     * @return metadata Metadata URI for the node
     * @return registeredAt Timestamp when the node was registered
     * @return activeUntil Timestamp until which the node is active
     * @return state Current state of the node
     * @return reputation Current reputation score of the node
     * @return soulboundTokenId ID of the soulbound token associated with the node
     */
    function getNodeInfo(address nodeAddress) external view returns (
        address nodeOwner,
        string memory metadata,
        uint256 registeredAt,
        uint256 activeUntil,
        NodeState state,
        uint256 reputation,
        uint256 soulboundTokenId
    ) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        Node storage node = nodes[nodeAddress];
        return (
            node.owner,
            node.metadata,
            node.registeredAt,
            node.activeUntil,
            node.state,
            node.reputation,
            node.soulboundTokenId
        );
    }
    
    /**
     * @dev Updates the state of a node
     * @param nodeAddress Address of the node
     * @param newState New state of the node
     * @return success Whether the update was successful
     */
    function updateNodeStateWithReturn(address nodeAddress, NodeState newState) external onlyAdmin returns (bool success) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        Node storage node = nodes[nodeAddress];
        NodeState oldState = node.state;
        
        // Update the state
        node.state = newState;
        
        // Emit the NodeStateUpdated event
        emit NodeStatusChanged(nodeAddress, oldState, newState);
        
        return true;
    }
    
    /**
     * @dev Updates the reputation of a node
     * @param nodeAddress Address of the node
     * @param newReputation New reputation score for the node
     * @return success Whether the update was successful
     */
    function updateReputationWithReturn(address nodeAddress, uint256 newReputation) external onlyAdmin returns (bool success) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        Node storage node = nodes[nodeAddress];
        uint256 oldReputation = node.reputation;
        
        // Update the reputation
        node.reputation = newReputation;
        
        // Emit the NodeReputationUpdated event
        emit NodeReputationUpdated(nodeAddress, oldReputation, newReputation);
        
        return true;
    }
    
    /**
     * @dev Deactivates a node
     * @param nodeAddress Address of the node to deactivate
     * @return success Whether the deactivation was successful
     */
    function deactivateNode(address nodeAddress) external returns (bool success) {
        Node storage node = nodes[nodeAddress];
        
        if (!node.exists) revert NodeNotRegistered();
        
        // Check if caller is the node owner or an admin or the owner
        if (msg.sender != node.owner && msg.sender != admin && msg.sender != owner) {
            revert Unauthorized();
        }
        
        // Store old state for event emission
        NodeState oldState = node.state;
        
        // Update the state to Inactive
        node.state = NodeState.Inactive;
        
        // Emit the NodeDeactivated event
        emit NodeDeactivated(nodeAddress, node.owner);
        
        // Also emit the NodeStatusChanged event for consistency
        emit NodeStatusChanged(nodeAddress, oldState, NodeState.Inactive);
        
        return true;
    }
    
    /**
     * @dev Gets the count of registered nodes
     * @return count Number of registered nodes
     */
    function getNodeCount() external view returns (uint256) {
        return nodeAddresses.length;
    }
    
    /**
     * @dev Checks if a node is active
     * @param nodeAddress Address of the node
     * @return isActive Whether the node is active
     */
    function isNodeActive(address nodeAddress) external view returns (bool) {
        if (!nodes[nodeAddress].exists) return false;
        
        Node storage node = nodes[nodeAddress];
        
        return node.state == NodeState.Active && block.timestamp <= node.activeUntil;
    }
    
    /**
     * @dev Updates the admin address
     * @param _newAdmin Address of the new admin
     */
    function updateAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert ZeroAddress();
        
        address oldAdmin = admin;
        admin = _newAdmin;
        
        emit AdminUpdated(oldAdmin, _newAdmin);
    }
    
    /**
     * @dev Updates the governance contract address
     * @param _newContract Address of the new governance contract
     */
    function updateGovernanceContract(address _newContract) external onlyOwner {
        address oldContract = governanceContract;
        governanceContract = _newContract;
        
        emit GovernanceContractUpdated(oldContract, _newContract);
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = owner;
        owner = _newOwner;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @dev Updates the SoulboundNFT contract address and ensures the registry has minting permissions
     * @param _newSoulboundNFT Address of the new SoulboundNFT contract
     */
    function updateSoulboundNFT(address _newSoulboundNFT) external onlyOwner {
        if (_newSoulboundNFT == address(0)) revert ZeroAddress();
        
        address oldSoulboundNFT = address(soulboundNFT);
        soulboundNFT = ISoulboundNFT(_newSoulboundNFT);
        
        // Request minter role from the new SoulboundNFT contract
        // This only works if this contract owner already has the admin role on the SoulboundNFT
        try ISoulboundNFT(_newSoulboundNFT).grantMinterRole(address(this)) {
            // Successfully granted minter role
        } catch {
            // Failed to obtain minter role - this is not a critical failure
            // The admin must grant this contract the MINTER_ROLE manually
        }
        
        emit SoulboundNFTSet(oldSoulboundNFT, _newSoulboundNFT);
    }
    
    /**
     * @dev Gets the node owner
     * @param nodeAddress Address of the node
     * @return nodeOwner Address of the node owner
     */
    function getNodeOwner(address nodeAddress) external view returns (address) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        return nodes[nodeAddress].owner;
    }
    
    /**
     * @dev Gets the node's soulbound token ID
     * @param nodeAddress Address of the node
     * @return tokenId The soulbound NFT token ID for this node
     */
    function getNodeSoulboundTokenId(address nodeAddress) external view returns (uint256) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        
        return nodes[nodeAddress].soulboundTokenId;
    }
    
    /**
     * @dev Gets the SoulboundNFT contract address
     * @return The address of the SoulboundNFT contract
     */
    function getSoulboundNFTAddress() external view returns (address) {
        return address(soulboundNFT);
    }
}