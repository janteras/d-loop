// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockPreviousNodeRegistry
 * @dev Mock implementation of a previous version of the NodeRegistry
 * Used for backward compatibility testing
 */
contract MockPreviousNodeRegistry {
    enum NodeState {
        Inactive,
        Active,
        Suspended,
        Penalized
    }
    
    mapping(address => bool) public registeredNodes;
    mapping(address => NodeState) public nodeStates;
    
    event NodeRegistered(address nodeAddress);
    event NodeStateUpdated(address nodeAddress, NodeState newState);
    
    /**
     * @dev Register a node
     */
    function registerNode(address nodeAddress, address, string memory) external {
        registeredNodes[nodeAddress] = true;
        nodeStates[nodeAddress] = NodeState.Active;
        emit NodeRegistered(nodeAddress);
    }
    
    /**
     * @dev Update a node's state
     */
    function updateNodeState(address nodeAddress, NodeState newState) external {
        require(registeredNodes[nodeAddress], "Node not registered");
        nodeStates[nodeAddress] = newState;
        emit NodeStateUpdated(nodeAddress, newState);
    }
    
    /**
     * @dev Check if a node is registered
     */
    function isNodeRegistered(address nodeAddress) external view returns (bool) {
        return registeredNodes[nodeAddress];
    }
    
    /**
     * @dev Get a node's state
     */
    function getNodeState(address nodeAddress) external view returns (NodeState) {
        return nodeStates[nodeAddress];
    }
}