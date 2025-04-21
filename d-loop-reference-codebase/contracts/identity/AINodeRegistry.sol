// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./SoulboundNFT.sol";

/**
 * @title AINodeRegistry
 * @notice Registry for AI nodes in the D-Loop ecosystem
 * @dev Manages verification, reputation, and capabilities of AI nodes
 */
contract AINodeRegistry is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant REPUTATION_MANAGER_ROLE = keccak256("REPUTATION_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Soulbound token for identity verification
    SoulboundNFT public identityToken;
    
    // Verification levels
    uint8 public constant LEVEL_UNVERIFIED = 0;
    uint8 public constant LEVEL_BASIC = 1;
    uint8 public constant LEVEL_ADVANCED = 2;
    uint8 public constant LEVEL_EXPERT = 3;
    
    // Node types
    enum NodeType {
        General,
        Prediction,
        Classification,
        NLP,
        Computer_Vision,
        Specialized
    }
    
    // Node status
    enum NodeStatus {
        Inactive,
        Active,
        Suspended,
        Revoked
    }
    
    // Node structure
    struct AINode {
        bool isRegistered;
        uint256 tokenId;          // SoulboundNFT token ID
        string name;              // Name of the AI node
        string apiEndpoint;       // API endpoint of the node
        string metadata;          // Additional metadata (IPFS hash)
        NodeType nodeType;        // Type of AI node
        NodeStatus status;        // Current status
        uint256 totalProjects;    // Total projects completed
        uint256 reputationScore;  // Reputation score (0-1000)
        uint256 registrationTime; // When the node was registered
        string[] specializations; // Areas of specialization
    }
    
    // Mappings
    mapping(address => AINode) public nodes;
    mapping(NodeType => address[]) public nodesByType;
    mapping(uint8 => uint256) public verificationLevelCount; // Tracks nodes at each level
    
    // Count of registered nodes
    uint256 public totalNodes;
    uint256 public activeNodes;
    
    // Reputation score constants
    uint256 public maxReputationScore = 1000;
    uint256 public minReputationForVoting = 100;
    
    // Events
    event NodeRegistered(address indexed nodeAddress, string name, NodeType nodeType);
    event NodeVerified(address indexed nodeAddress, uint256 tokenId, uint8 verificationLevel);
    event NodeStatusChanged(address indexed nodeAddress, NodeStatus oldStatus, NodeStatus newStatus);
    event ReputationUpdated(address indexed nodeAddress, uint256 oldScore, uint256 newScore);
    event SpecializationsUpdated(address indexed nodeAddress, string[] specializations);
    event MetadataUpdated(address indexed nodeAddress, string metadata);
    event ApiEndpointUpdated(address indexed nodeAddress, string apiEndpoint);
    
    /**
     * @notice Initializer function (replaces constructor in upgradeable contracts)
     * @param _identityToken Address of the SoulboundNFT contract
     */
    function initialize(address _identityToken) public initializer {
        require(_identityToken != address(0), "Invalid identity token address");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRY_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        _grantRole(REPUTATION_MANAGER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        identityToken = SoulboundNFT(_identityToken);
        
        totalNodes = 0;
        activeNodes = 0;
    }
    
    /**
     * @notice Registers a new AI node
     * @param name Name of the AI node
     * @param apiEndpoint API endpoint of the node
     * @param metadata Additional metadata (IPFS hash)
     * @param nodeType Type of AI node
     * @param specializations Areas of specialization
     */
    function registerNode(
        string memory name,
        string memory apiEndpoint,
        string memory metadata,
        NodeType nodeType,
        string[] memory specializations
    ) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(!nodes[msg.sender].isRegistered, "Node already registered");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(apiEndpoint).length > 0, "API endpoint cannot be empty");
        
        // Create new node
        nodes[msg.sender] = AINode({
            isRegistered: true,
            tokenId: 0, // Will be set when verified
            name: name,
            apiEndpoint: apiEndpoint,
            metadata: metadata,
            nodeType: nodeType,
            status: NodeStatus.Inactive, // Nodes start inactive until verified
            totalProjects: 0,
            reputationScore: 0,
            registrationTime: block.timestamp,
            specializations: specializations
        });
        
        // Add to node type mapping
        nodesByType[nodeType].push(msg.sender);
        
        // Update counters
        totalNodes++;
        
        emit NodeRegistered(msg.sender, name, nodeType);
    }
    
    /**
     * @notice Verifies a node by issuing a soulbound token
     * @param nodeAddress Address of the node to verify
     * @param verificationLevel Verification level to assign
     * @param tokenURI URI for the token metadata
     * @param validityPeriod Validity period for the token (0 = use default)
     */
    function verifyNode(
        address nodeAddress,
        uint8 verificationLevel,
        string memory tokenURI,
        uint256 validityPeriod
    ) 
        external 
        onlyRole(VERIFIER_ROLE) 
        nonReentrant 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(verificationLevel >= LEVEL_BASIC && verificationLevel <= LEVEL_EXPERT, "Invalid level");
        require(nodes[nodeAddress].status != NodeStatus.Revoked, "Node revoked");
        
        AINode storage node = nodes[nodeAddress];
        
        // Check if node already has a token
        if (identityToken.isVerified(nodeAddress)) {
            // Update existing token
            uint256 tokenId = identityToken.ownerTokenId(nodeAddress);
            identityToken.updateVerificationLevel(tokenId, verificationLevel);
            identityToken.renewToken(tokenId, validityPeriod);
        } else {
            // Mint new token
            uint256 tokenId = identityToken.mint(
                nodeAddress,
                verificationLevel,
                tokenURI,
                validityPeriod
            );
            
            node.tokenId = tokenId;
        }
        
        // If node was inactive, activate it
        if (node.status == NodeStatus.Inactive) {
            node.status = NodeStatus.Active;
            activeNodes++;
            emit NodeStatusChanged(nodeAddress, NodeStatus.Inactive, NodeStatus.Active);
        }
        
        // Update verification level counts
        verificationLevelCount[verificationLevel]++;
        
        emit NodeVerified(nodeAddress, node.tokenId, verificationLevel);
    }
    
    /**
     * @notice Suspends a node
     * @param nodeAddress Address of the node to suspend
     */
    function suspendNode(address nodeAddress) 
        external 
        onlyRole(REGISTRY_ADMIN_ROLE) 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(nodes[nodeAddress].status == NodeStatus.Active, "Node not active");
        
        nodes[nodeAddress].status = NodeStatus.Suspended;
        activeNodes--;
        
        emit NodeStatusChanged(nodeAddress, NodeStatus.Active, NodeStatus.Suspended);
    }
    
    /**
     * @notice Reactivates a suspended node
     * @param nodeAddress Address of the node to reactivate
     */
    function reactivateNode(address nodeAddress) 
        external 
        onlyRole(REGISTRY_ADMIN_ROLE) 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(nodes[nodeAddress].status == NodeStatus.Suspended, "Node not suspended");
        require(identityToken.hasValidToken(nodeAddress), "Node's token expired");
        
        nodes[nodeAddress].status = NodeStatus.Active;
        activeNodes++;
        
        emit NodeStatusChanged(nodeAddress, NodeStatus.Suspended, NodeStatus.Active);
    }
    
    /**
     * @notice Permanently revokes a node's status
     * @param nodeAddress Address of the node to revoke
     */
    function revokeNode(address nodeAddress) 
        external 
        onlyRole(REGISTRY_ADMIN_ROLE) 
        nonReentrant 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(nodes[nodeAddress].status != NodeStatus.Revoked, "Node already revoked");
        
        NodeStatus oldStatus = nodes[nodeAddress].status;
        nodes[nodeAddress].status = NodeStatus.Revoked;
        
        // If node was active, reduce active count
        if (oldStatus == NodeStatus.Active) {
            activeNodes--;
        }
        
        // Revoke the token if it exists
        if (identityToken.isVerified(nodeAddress)) {
            uint256 tokenId = identityToken.ownerTokenId(nodeAddress);
            identityToken.revoke(tokenId);
        }
        
        emit NodeStatusChanged(nodeAddress, oldStatus, NodeStatus.Revoked);
    }
    
    /**
     * @notice Updates a node's reputation score
     * @param nodeAddress Address of the node
     * @param newScore New reputation score
     */
    function updateReputationScore(address nodeAddress, uint256 newScore) 
        external 
        onlyRole(REPUTATION_MANAGER_ROLE) 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(newScore <= maxReputationScore, "Score exceeds maximum");
        
        uint256 oldScore = nodes[nodeAddress].reputationScore;
        nodes[nodeAddress].reputationScore = newScore;
        
        emit ReputationUpdated(nodeAddress, oldScore, newScore);
    }
    
    /**
     * @notice Updates a node's API endpoint
     * @param apiEndpoint New API endpoint
     */
    function updateApiEndpoint(string memory apiEndpoint) 
        external 
        whenNotPaused 
    {
        require(nodes[msg.sender].isRegistered, "Node not registered");
        require(bytes(apiEndpoint).length > 0, "API endpoint cannot be empty");
        
        nodes[msg.sender].apiEndpoint = apiEndpoint;
        
        emit ApiEndpointUpdated(msg.sender, apiEndpoint);
    }
    
    /**
     * @notice Updates a node's metadata
     * @param metadata New metadata (IPFS hash)
     */
    function updateMetadata(string memory metadata) 
        external 
        whenNotPaused 
    {
        require(nodes[msg.sender].isRegistered, "Node not registered");
        
        nodes[msg.sender].metadata = metadata;
        
        emit MetadataUpdated(msg.sender, metadata);
    }
    
    /**
     * @notice Updates a node's specializations
     * @param specializations New specializations
     */
    function updateSpecializations(string[] memory specializations) 
        external 
        whenNotPaused 
    {
        require(nodes[msg.sender].isRegistered, "Node not registered");
        
        nodes[msg.sender].specializations = specializations;
        
        emit SpecializationsUpdated(msg.sender, specializations);
    }
    
    /**
     * @notice Increments a node's completed project count
     * @param nodeAddress Address of the node
     */
    function incrementProjectCount(address nodeAddress) 
        external 
        onlyRole(REPUTATION_MANAGER_ROLE) 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        require(nodes[nodeAddress].status == NodeStatus.Active, "Node not active");
        
        nodes[nodeAddress].totalProjects++;
    }
    
    /**
     * @notice Checks if an address is a verified AI node
     * @param nodeAddress Address to check
     * @return isVerified Whether the address is a verified AI node
     */
    function isVerifiedAINode(address nodeAddress) 
        external 
        view 
        returns (bool) 
    {
        return nodes[nodeAddress].isRegistered && 
               nodes[nodeAddress].status == NodeStatus.Active && 
               identityToken.hasValidToken(nodeAddress);
    }
    
    /**
     * @notice Gets a node's verification level
     * @param nodeAddress Address of the node
     * @return level Verification level (0 if not verified)
     */
    function getNodeVerificationLevel(address nodeAddress) 
        external 
        view 
        returns (uint8) 
    {
        if (!nodes[nodeAddress].isRegistered || 
            nodes[nodeAddress].status != NodeStatus.Active) {
            return LEVEL_UNVERIFIED;
        }
        
        return uint8(identityToken.getVerificationLevel(nodeAddress));
    }
    
    /**
     * @notice Checks if a node has sufficient reputation for voting
     * @param nodeAddress Address of the node
     * @return canVote Whether the node can vote
     */
    function canNodeVote(address nodeAddress) 
        external 
        view 
        returns (bool) 
    {
        return nodes[nodeAddress].isRegistered && 
               nodes[nodeAddress].status == NodeStatus.Active && 
               identityToken.hasValidToken(nodeAddress) &&
               nodes[nodeAddress].reputationScore >= minReputationForVoting;
    }
    
    /**
     * @notice Gets the voting weight for a node based on verification level and reputation
     * @param nodeAddress Address of the node
     * @return weight Voting weight (0 if cannot vote)
     */
    function getNodeVotingWeight(address nodeAddress) 
        external 
        view 
        returns (uint256) 
    {
        if (!nodes[nodeAddress].isRegistered || 
            nodes[nodeAddress].status != NodeStatus.Active ||
            !identityToken.hasValidToken(nodeAddress) ||
            nodes[nodeAddress].reputationScore < minReputationForVoting) {
            return 0;
        }
        
        uint256 verificationLevel = identityToken.getVerificationLevel(nodeAddress);
        uint256 baseWeight = verificationLevel * 1000; // Base weight from verification level
        
        // Add reputation bonus (0-100% bonus based on reputation)
        uint256 reputationBonus = (nodes[nodeAddress].reputationScore * baseWeight) / maxReputationScore;
        
        return baseWeight + reputationBonus;
    }
    
    /**
     * @notice Gets the count of nodes by verification level
     * @param level Verification level
     * @return count Number of nodes at that level
     */
    function getNodeCountByLevel(uint8 level) 
        external 
        view 
        returns (uint256) 
    {
        return verificationLevelCount[level];
    }
    
    /**
     * @notice Gets the addresses of nodes by type
     * @param nodeType Type of nodes to get
     * @return addresses Array of node addresses of that type
     */
    function getNodeAddressesByType(NodeType nodeType) 
        external 
        view 
        returns (address[] memory) 
    {
        return nodesByType[nodeType];
    }
    
    /**
     * @notice Gets detailed information about a node
     * @param nodeAddress Address of the node
     * @return name Name of the node
     * @return apiEndpoint API endpoint of the node
     * @return metadata Additional metadata
     * @return nodeType Type of the node
     * @return status Current status
     * @return totalProjects Total projects completed
     * @return reputationScore Reputation score
     * @return registrationTime When the node was registered
     * @return verificationLevel Current verification level
     * @return isActive Whether the node is active
     * @return specializations Areas of specialization
     */
    function getNodeDetails(address nodeAddress) 
        external 
        view 
        returns (
            string memory name,
            string memory apiEndpoint,
            string memory metadata,
            NodeType nodeType,
            NodeStatus status,
            uint256 totalProjects,
            uint256 reputationScore,
            uint256 registrationTime,
            uint256 verificationLevel,
            bool isActive,
            string[] memory specializations
        ) 
    {
        require(nodes[nodeAddress].isRegistered, "Node not registered");
        
        AINode storage node = nodes[nodeAddress];
        
        name = node.name;
        apiEndpoint = node.apiEndpoint;
        metadata = node.metadata;
        nodeType = node.nodeType;
        status = node.status;
        totalProjects = node.totalProjects;
        reputationScore = node.reputationScore;
        registrationTime = node.registrationTime;
        specializations = node.specializations;
        
        verificationLevel = identityToken.getVerificationLevel(nodeAddress);
        isActive = (node.status == NodeStatus.Active) && identityToken.hasValidToken(nodeAddress);
        
        return (
            name,
            apiEndpoint,
            metadata,
            nodeType,
            status,
            totalProjects,
            reputationScore,
            registrationTime,
            verificationLevel,
            isActive,
            specializations
        );
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(REGISTRY_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(REGISTRY_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Sets the minimum reputation required for voting
     * @param minReputation New minimum reputation
     */
    function setMinReputationForVoting(uint256 minReputation) 
        external 
        onlyRole(REGISTRY_ADMIN_ROLE) 
    {
        require(minReputation <= maxReputationScore, "Minimum exceeds maximum");
        
        minReputationForVoting = minReputation;
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
}