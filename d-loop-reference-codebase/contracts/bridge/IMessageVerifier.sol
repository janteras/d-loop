// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMessageVerifier
 * @dev Interface for verifying cross-chain messages
 */
interface IMessageVerifier {
    /**
     * @dev Verifies a message received from another chain
     * @param sourceChainId ID of the source chain
     * @param sourceAddress Address on the source chain that sent the message
     * @param targetAddress Address on the target chain to receive the message
     * @param messageId Unique ID of the message
     * @param message Message data
     * @param signature Signature from the authorized relayer
     * @return isValid Whether the message is valid
     */
    function verifyMessage(
        uint256 sourceChainId,
        address sourceAddress,
        address targetAddress,
        bytes32 messageId,
        bytes calldata message,
        bytes calldata signature
    ) external view returns (bool isValid);
    
    /**
     * @dev Checks if a message has already been processed
     * @param messageId Message ID to check
     * @return processed Whether the message has been processed
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool processed);
    
    /**
     * @dev Marks a message as processed
     * @param messageId Message ID to mark
     */
    function markMessageProcessed(bytes32 messageId) external;
    
    /**
     * @dev Adds a bridge as authorized to interact with the verifier
     * @param bridge Bridge address
     */
    function addBridge(address bridge) external;
    
    /**
     * @dev Removes a bridge's authorization
     * @param bridge Bridge address
     */
    function removeBridge(address bridge) external;
    
    /**
     * @dev Adds a relayer for a specific chain
     * @param chainId Chain ID
     * @param relayer Relayer address
     */
    function addRelayer(uint256 chainId, address relayer) external;
    
    /**
     * @dev Removes a relayer for a specific chain
     * @param chainId Chain ID
     * @param relayer Relayer address
     */
    function removeRelayer(uint256 chainId, address relayer) external;
}