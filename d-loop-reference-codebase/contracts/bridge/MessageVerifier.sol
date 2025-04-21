// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IMessageVerifier.sol";

/**
 * @title MessageVerifier
 * @dev Implementation of the message verification system for cross-chain messages
 */
contract MessageVerifier is IMessageVerifier, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    // Mapping of processed messages to prevent replay attacks
    mapping(bytes32 => bool) public processedMessages;
    
    // Mapping of authorized relayers for each chain
    mapping(uint256 => mapping(address => bool)) public authorizedRelayers;
    
    // Events
    event MessageProcessed(bytes32 indexed messageId);
    event BridgeAdded(address indexed bridge);
    event BridgeRemoved(address indexed bridge);
    event RelayerAdded(uint256 indexed chainId, address indexed relayer);
    event RelayerRemoved(uint256 indexed chainId, address indexed relayer);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param initialBridge Initial bridge address to authorize
     */
    constructor(address admin, address initialBridge) {
        require(admin != address(0), "MessageVerifier: admin is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        if (initialBridge != address(0)) {
            _grantRole(BRIDGE_ROLE, initialBridge);
            emit BridgeAdded(initialBridge);
        }
    }
    
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
    ) external view override returns (bool isValid) {
        // Create message hash for verification
        bytes32 messageHash = keccak256(abi.encodePacked(
            sourceChainId,
            sourceAddress,
            targetAddress,
            messageId,
            message
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        // Recover signer
        address signer = _recoverSigner(ethSignedMessageHash, signature);
        
        // Check if signer is authorized for the source chain
        return authorizedRelayers[sourceChainId][signer];
    }
    
    /**
     * @dev Checks if a message has already been processed
     * @param messageId Message ID to check
     * @return processed Whether the message has been processed
     */
    function isMessageProcessed(bytes32 messageId) external view override returns (bool processed) {
        return processedMessages[messageId];
    }
    
    /**
     * @dev Marks a message as processed
     * @param messageId Message ID to mark
     */
    function markMessageProcessed(bytes32 messageId) external override onlyRole(BRIDGE_ROLE) {
        require(!processedMessages[messageId], "MessageVerifier: message already processed");
        
        processedMessages[messageId] = true;
        
        emit MessageProcessed(messageId);
    }
    
    /**
     * @dev Adds a bridge as authorized to interact with the verifier
     * @param bridge Bridge address
     */
    function addBridge(address bridge) external override onlyRole(ADMIN_ROLE) {
        require(bridge != address(0), "MessageVerifier: bridge is zero address");
        
        _grantRole(BRIDGE_ROLE, bridge);
        
        emit BridgeAdded(bridge);
    }
    
    /**
     * @dev Removes a bridge's authorization
     * @param bridge Bridge address
     */
    function removeBridge(address bridge) external override onlyRole(ADMIN_ROLE) {
        _revokeRole(BRIDGE_ROLE, bridge);
        
        emit BridgeRemoved(bridge);
    }
    
    /**
     * @dev Adds a relayer for a specific chain
     * @param chainId Chain ID
     * @param relayer Relayer address
     */
    function addRelayer(uint256 chainId, address relayer) external override onlyRole(ADMIN_ROLE) {
        require(relayer != address(0), "MessageVerifier: relayer is zero address");
        require(chainId > 0, "MessageVerifier: invalid chain ID");
        
        authorizedRelayers[chainId][relayer] = true;
        
        emit RelayerAdded(chainId, relayer);
    }
    
    /**
     * @dev Removes a relayer for a specific chain
     * @param chainId Chain ID
     * @param relayer Relayer address
     */
    function removeRelayer(uint256 chainId, address relayer) external override onlyRole(ADMIN_ROLE) {
        authorizedRelayers[chainId][relayer] = false;
        
        emit RelayerRemoved(chainId, relayer);
    }
    
    /**
     * @dev Internal function to recover signer from signature
     * @param messageHash Message hash
     * @param signature Signature
     * @return signer Recovered signer address
     */
    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address signer) {
        require(signature.length == 65, "MessageVerifier: invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "MessageVerifier: invalid signature 'v' value");
        
        return ecrecover(messageHash, v, r, s);
    }
}