// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IAINodeRegistry
 * @dev Interface for AI node verification and management
 */
interface IAINodeRegistry {
    /**
     * @dev Checks if an address is a verified AI node
     * @param account Address to check
     * @return isVerified True if the address is a verified AI node
     */
    function isVerifiedAINode(address account) external view returns (bool);
    
    /**
     * @dev Registers a new AI node
     * @param account Address of the AI node to register
     * @param metadata Optional metadata about the AI node
     * @return success True if registration was successful
     */
    function registerAINode(address account, string calldata metadata) external returns (bool);
    
    /**
     * @dev Unregisters an AI node
     * @param account Address of the AI node to unregister
     * @return success True if unregistration was successful
     */
    function unregisterAINode(address account) external returns (bool);
    
    /**
     * @dev Gets the total number of verified AI nodes
     * @return count Number of verified AI nodes
     */
    function getVerifiedNodeCount() external view returns (uint256);
}