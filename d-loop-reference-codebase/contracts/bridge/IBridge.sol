// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBridge
 * @dev Interface for cross-chain bridge implementations
 */
interface IBridge {
    /**
     * @dev Locks an asset on the source chain and initiates a transfer to the target chain
     * @param asset Asset address on the source chain
     * @param amount Amount to transfer
     * @param recipient Recipient address on the target chain
     * @param targetChainId ID of the target chain
     * @return transferId Unique ID for this transfer
     */
    function lockAndTransfer(
        address asset,
        uint256 amount,
        address recipient,
        uint256 targetChainId
    ) external returns (bytes32 transferId);
    
    /**
     * @dev Releases an asset on the target chain to complete a transfer
     * @param transferId Transfer ID from the source chain
     * @param proof Proof data validating the transfer
     * @return success Whether the release succeeded
     */
    function releaseAsset(
        bytes32 transferId,
        bytes calldata proof
    ) external returns (bool success);
    
    /**
     * @dev Records a message sent to the target chain
     * @param targetChainId ID of the target chain
     * @param targetAddress Address on the target chain to receive the message
     * @param message Message data
     * @return messageId Unique ID for this message
     */
    function sendMessage(
        uint256 targetChainId,
        address targetAddress,
        bytes calldata message
    ) external returns (bytes32 messageId);
    
    /**
     * @dev Processes a message received from the source chain
     * @param sourceChainId ID of the source chain
     * @param sourceAddress Address on the source chain that sent the message
     * @param message Message data
     * @param proof Proof data validating the message
     * @return success Whether the message was processed successfully
     */
    function receiveMessage(
        uint256 sourceChainId,
        address sourceAddress,
        bytes calldata message,
        bytes calldata proof
    ) external returns (bool success);
    
    /**
     * @dev Gets the address of the wrapped version of an asset on this chain
     * @param nativeAsset Original asset address on its native chain
     * @param nativeChainId ID of the asset's native chain
     * @return wrappedAsset Address of the wrapped asset on this chain
     */
    function getWrappedAsset(
        address nativeAsset, 
        uint256 nativeChainId
    ) external view returns (address wrappedAsset);
    
    /**
     * @dev Gets the chain ID of the current chain
     * @return chainId The current chain ID
     */
    function getChainId() external view returns (uint256 chainId);
    
    /**
     * @dev Checks if a bridge exists to a target chain
     * @param targetChainId ID of the target chain
     * @return exists Whether a bridge exists
     */
    function bridgeExists(uint256 targetChainId) external view returns (bool exists);
    
    /**
     * @dev Gets the status of a transfer
     * @param transferId Transfer ID
     * @return status 0: Not found, 1: Pending, 2: Completed, 3: Failed
     */
    function getTransferStatus(bytes32 transferId) external view returns (uint8 status);
    
    /**
     * @dev Gets the status of a message
     * @param messageId Message ID
     * @return status 0: Not found, 1: Pending, 2: Delivered, 3: Failed
     */
    function getMessageStatus(bytes32 messageId) external view returns (uint8 status);
}

/**
 * @title IMessageReceiver
 * @dev Interface for contract that can receive messages from other chains
 */
interface IMessageReceiver {
    /**
     * @dev Called when a message is received from another chain
     * @param sourceChainId ID of the source chain
     * @param sourceAddress Address on the source chain that sent the message
     * @param message Message data
     * @return success Whether the message was processed successfully
     */
    function onMessageReceived(
        uint256 sourceChainId,
        address sourceAddress,
        bytes calldata message
    ) external returns (bool success);
}