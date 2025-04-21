// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title IAINodeIdentifier
 * @notice Interface for identifying AI nodes
 * @dev Used by contracts that need to verify AI node status
 */
interface IAINodeIdentifier {
    /**
     * @notice Checks if an address is an active AI node
     * @param _node Address to check
     * @return Whether the node is active
     */
    function isActiveAINode(address _node) external view returns (bool);
}