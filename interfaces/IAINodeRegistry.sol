// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAINodeRegistry
 * @dev Interface for AI node registry
 * @notice This interface defines the standard functions for AI node management
 */
interface IAINodeRegistry {
    // Node states
    enum NodeState {
        Inactive,
        Active,
        Suspended,
        Penalized
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
    ) external;
    
    /**
     * @dev Updates the state of a node
     * @param nodeAddress Address of the node
     * @param newState New state of the node
     */
    function updateNodeState(address nodeAddress, NodeState newState) external;
    
    /**
     * @dev Extends the active period of a node
     * @param nodeAddress Address of the node
     * @param extensionPeriod Period to extend (in seconds)
     */
    function extendNodePeriod(address nodeAddress, uint256 extensionPeriod) external;
    
    /**
     * @dev Updates the reputation of a node
     * @param nodeAddress Address of the node
     * @param newReputation New reputation score
     */
    function updateReputation(address nodeAddress, uint256 newReputation) external;
    
    /**
     * @dev Gets the details of a node
     * @param nodeAddress Address of the node
     * @return owner Owner of the node
     * @return metadata Metadata URI of the node
     * @return registeredAt Registration timestamp
     * @return activeUntil Active until timestamp
     * @return state State of the node
     * @return reputation Reputation score
     */
    function getNodeDetails(address nodeAddress) external view returns (
        address owner,
        string memory metadata,
        uint256 registeredAt,
        uint256 activeUntil,
        NodeState state,
        uint256 reputation
    );
    
    /**
     * @dev Gets all registered node addresses
     * @return addresses Array of node addresses
     */
    function getAllNodeAddresses() external view returns (address[] memory);
    
    /**
     * @dev Gets the count of registered nodes
     * @return count Number of registered nodes
     */
    function getNodeCount() external view returns (uint256);
    
    /**
     * @dev Checks if a node is active
     * @param nodeAddress Address of the node
     * @return isActive Whether the node is active
     */
    function isNodeActive(address nodeAddress) external view returns (bool);
    
    /**
     * @dev Gets the node owner
     * @param nodeAddress Address of the node
     * @return nodeOwner Address of the node owner
     */
    function getNodeOwner(address nodeAddress) external view returns (address);
}