// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../../contracts/utils/Errors.sol";
import "../../contracts/interfaces/core/IAINodeRegistry.sol";
import { SoulboundNFT } from "../../contracts/identity/SoulboundNFT.sol";


/**
 * @title MockAINodeRegistry
 * @dev Mock implementation of AINodeRegistry for testing
 */
abstract contract MockAINodeRegistry is IAINodeRegistry {
    address public admin;
    address public contractOwner;
    SoulboundNFT public soulboundNFT;
    
    // Node structure
    struct Node {
        address owner;
        string metadata;
        uint256 registeredAt;
        uint256 activeUntil;
        NodeState state;
        uint256 reputation;
        bool exists;
        uint256 stakedAmount;
        address stakedToken;
        uint256 soulboundTokenId;
    }
    
    // Mapping of node address to node data
    mapping(address => Node) public nodes;
    
    // Events
    event NodeRegistered(address indexed nodeAddress, address indexed owner, uint256 soulboundTokenId);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);

    // Stub implementations for missing interface functions
    function extendNodePeriod(address nodeAddress, uint256 extensionPeriod) external override {}
    function getAllNodeAddresses() external view override returns (address[] memory) { address[] memory a; return a; }
    function getNodeCount() external view override returns (uint256) { return 0; }
    function getNodeDetails(address nodeAddress) external view override returns (
        address owner,
        string memory metadata,
        uint256 registeredAt,
        uint256 activeUntil,
        NodeState state,
        uint256 reputation
    ) {
        owner = address(0);
        metadata = "";
        registeredAt = 0;
        activeUntil = 0;
        state = NodeState.Inactive;
        reputation = 0;
    }
    function updateNodeState(address nodeAddress, NodeState newState) external override {}
    function updateReputation(address nodeAddress, uint256 newReputation) external override {}
    
    /**
     * @dev Constructor
     * @param _admin Address of the admin
     * @param _soulboundNFT Address of the soulbound NFT
     */
    constructor(address _admin, address _soulboundNFT) {
        if (_admin == address(0)) revert ZeroAddress();
        if (_soulboundNFT == address(0)) revert ZeroAddress();
        
        admin = _admin;
        contractOwner = msg.sender;
        soulboundNFT = SoulboundNFT(_soulboundNFT);
    }
    
    /**
     * @dev Registers a node - simplified for testing
     * This version accepts the parameters as expected by AINodeGovernance
     */
    function registerNode(address nodeAddress, address nodeOwner, string memory metadata) external {
        // For testing, we'll accept any caller
        if (nodeAddress == address(0) || nodeOwner == address(0)) revert ZeroAddress();
        if (nodes[nodeAddress].exists) revert NodeAlreadyRegistered();
        
        // Mint a soulbound NFT for the node
        uint256 tokenId = soulboundNFT.mint(nodeOwner, metadata);
        
        nodes[nodeAddress] = Node({
            owner: nodeOwner,
            metadata: metadata,
            registeredAt: block.timestamp,
            activeUntil: block.timestamp + 365 days, // 1 year for testing
            state: NodeState.Active,
            reputation: 100, // Default value for testing
            exists: true,
            stakedAmount: 0,
            stakedToken: address(0),
            soulboundTokenId: tokenId
        });
        
        emit NodeRegistered(nodeAddress, nodeOwner, tokenId);
    }
    
    /**
     * @dev Updates the admin address
     * @param _newAdmin Address of the new admin
     */
    function updateAdmin(address _newAdmin) external {
        // For testing, we'll accept any caller
        if (_newAdmin == address(0)) revert ZeroAddress();
        
        address oldAdmin = admin;
        admin = _newAdmin;
        
        emit AdminUpdated(oldAdmin, _newAdmin);
    }
    
    // Implement required interface functions
    function getNodeOwner(address nodeAddress) external view override returns (address) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        return nodes[nodeAddress].owner;
    }
    
    function isNodeActive(address nodeAddress) external view override returns (bool) {
        if (!nodes[nodeAddress].exists) return false;
        return nodes[nodeAddress].state == NodeState.Active && block.timestamp <= nodes[nodeAddress].activeUntil;
    }
    
    function getNodeState(address nodeAddress) external view returns (NodeState) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        return nodes[nodeAddress].state;
    }
    
    function getNodeReputation(address nodeAddress) external view returns (uint256) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        return nodes[nodeAddress].reputation;
    }
    
    function getNodeSoulboundTokenId(address nodeAddress) external view returns (uint256) {
        if (!nodes[nodeAddress].exists) revert NodeNotRegistered();
        return nodes[nodeAddress].soulboundTokenId;
    }
}
