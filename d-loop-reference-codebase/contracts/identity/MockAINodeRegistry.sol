// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../identity/IAINodeIdentifier.sol";

/**
 * @title MockAINodeRegistry
 * @dev Mock AI Node Registry for testing purposes
 */
contract MockAINodeRegistry is IAINodeIdentifier {
    mapping(address => bool) public activeNodes;
    
    /**
     * @dev Set active status for a node
     * @param nodeAddress Address of the node
     * @param active Whether the node is active
     */
    function setNodeActive(address nodeAddress, bool active) external {
        activeNodes[nodeAddress] = active;
    }
    
    /**
     * @dev Check if an address is an active AI node
     * @param nodeAddress Address to check
     * @return Whether the address is an active AI node
     */
    function isActiveAINode(address nodeAddress) external view override returns (bool) {
        return activeNodes[nodeAddress];
    }
}