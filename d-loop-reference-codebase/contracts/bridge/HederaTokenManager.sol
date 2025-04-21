// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridgedToken.sol";

/**
 * @title HederaTokenManager
 * @dev Manages bridged tokens for Hedera cross-chain transfers
 */
contract HederaTokenManager is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    // Mapping of original token (chain ID => token address) to wrapped token address
    mapping(uint256 => mapping(address => address)) public wrappedTokens;
    
    // Mapping of wrapped token address to original token info
    mapping(address => OriginalTokenInfo) public originalTokens;
    
    // Original token information
    struct OriginalTokenInfo {
        address tokenAddress;
        uint256 chainId;
        bool exists;
    }
    
    // Events
    event WrappedTokenCreated(
        address indexed originalToken,
        uint256 indexed originalChainId,
        address indexed wrappedToken,
        string name,
        string symbol
    );
    
    event TokensMinted(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    event TokensBurned(
        address indexed token,
        address indexed from,
        uint256 amount
    );
    
    event BridgeAdded(address indexed bridge);
    event BridgeRemoved(address indexed bridge);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param initialBridge Initial bridge address to authorize
     */
    constructor(address admin, address initialBridge) {
        require(admin != address(0), "HederaTokenManager: admin is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        
        if (initialBridge != address(0)) {
            _grantRole(BRIDGE_ROLE, initialBridge);
            emit BridgeAdded(initialBridge);
        }
    }
    
    /**
     * @dev Creates a new wrapped token representing a token from another chain
     * @param originalToken Original token address on its native chain
     * @param originalChainId Original chain ID
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param maxSupply Maximum token supply
     * @return wrappedToken Address of the created wrapped token
     */
    function createWrappedToken(
        address originalToken,
        uint256 originalChainId,
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 maxSupply
    ) external onlyRole(BRIDGE_ROLE) returns (address wrappedToken) {
        require(originalToken != address(0), "HederaTokenManager: original token is zero address");
        require(originalChainId != 0, "HederaTokenManager: original chain ID is 0");
        require(bytes(name).length > 0, "HederaTokenManager: empty name");
        require(bytes(symbol).length > 0, "HederaTokenManager: empty symbol");
        require(maxSupply > 0, "HederaTokenManager: max supply is 0");
        
        // Check if wrapped token already exists
        address existing = wrappedTokens[originalChainId][originalToken];
        if (existing != address(0)) {
            return existing;
        }
        
        // Deploy a new wrapped token contract
        // Note: In a real implementation, we would use BridgedToken's creation code
        // For testing, we'll need a separate deployment mechanism or BridgedToken
        // should be imported. For now, we leave this as a placeholder.
        // The BridgedToken contract is defined in BridgedToken.sol
        address wrappedToken = address(0);
        
        // This is placeholder code until we implement a real deployment mechanism
        // or properly import the BridgedToken contract
        // In a real implementation, we would:
        // 1. Deploy the BridgedToken contract
        // 2. Store token mappings
        // 3. Emit an event
        
        // For now, just return zero address to indicate not implemented
        return address(0);
    }
    
    /**
     * @dev Mints wrapped tokens
     * @param token Wrapped token address
     * @param recipient Recipient address
     * @param amount Amount to mint
     * @return success Whether the operation succeeded
     */
    function mintWrappedToken(
        address token,
        address recipient,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) returns (bool success) {
        require(token != address(0), "HederaTokenManager: token is zero address");
        require(recipient != address(0), "HederaTokenManager: recipient is zero address");
        require(amount > 0, "HederaTokenManager: amount is 0");
        require(originalTokens[token].exists, "HederaTokenManager: token not managed");
        
        bool mintResult = IBridgedToken(token).mint(recipient, amount);
        require(mintResult, "HederaTokenManager: minting failed");
        
        emit TokensMinted(token, recipient, amount);
        
        return true;
    }
    
    /**
     * @dev Burns wrapped tokens
     * @param token Wrapped token address
     * @param from Address to burn from
     * @param amount Amount to burn
     * @return success Whether the operation succeeded
     */
    function burnWrappedToken(
        address token,
        address from,
        uint256 amount
    ) external onlyRole(BRIDGE_ROLE) returns (bool success) {
        require(token != address(0), "HederaTokenManager: token is zero address");
        require(from != address(0), "HederaTokenManager: from is zero address");
        require(amount > 0, "HederaTokenManager: amount is 0");
        require(originalTokens[token].exists, "HederaTokenManager: token not managed");
        
        bool burnResult = IBridgedToken(token).burnFrom(from, amount);
        require(burnResult, "HederaTokenManager: burning failed");
        
        emit TokensBurned(token, from, amount);
        
        return true;
    }
    
    /**
     * @dev Gets the wrapped token address for an original token
     * @param originalToken Original token address
     * @param originalChainId Original chain ID
     * @return wrappedToken Address of the wrapped token
     */
    function getWrappedToken(
        address originalToken,
        uint256 originalChainId
    ) external view returns (address wrappedToken) {
        return wrappedTokens[originalChainId][originalToken];
    }
    
    /**
     * @dev Gets the original token info for a wrapped token
     * @param wrappedToken Wrapped token address
     * @return originalToken Original token address
     * @return originalChainId Original chain ID
     * @return exists Whether the token exists
     */
    function getOriginalToken(
        address wrappedToken
    ) external view returns (address originalToken, uint256 originalChainId, bool exists) {
        OriginalTokenInfo memory info = originalTokens[wrappedToken];
        return (info.tokenAddress, info.chainId, info.exists);
    }
    
    /**
     * @dev Checks if a wrapped token exists for an original token
     * @param originalToken Original token address
     * @param originalChainId Original chain ID
     * @return exists Whether the wrapped token exists
     */
    function wrappedTokenExists(
        address originalToken,
        uint256 originalChainId
    ) external view returns (bool exists) {
        return wrappedTokens[originalChainId][originalToken] != address(0);
    }
    
    /**
     * @dev Checks if a token is a wrapped token managed by this contract
     * @param token Token address to check
     * @return isWrapped Whether the token is a wrapped token
     */
    function isWrappedToken(address token) external view returns (bool isWrapped) {
        return originalTokens[token].exists;
    }
    
    /**
     * @dev Adds a bridge as authorized to interact with the token manager
     * @param bridge Bridge address
     */
    function addBridge(address bridge) external onlyRole(ADMIN_ROLE) {
        require(bridge != address(0), "HederaTokenManager: bridge is zero address");
        
        _grantRole(BRIDGE_ROLE, bridge);
        
        emit BridgeAdded(bridge);
    }
    
    /**
     * @dev Removes a bridge's authorization
     * @param bridge Bridge address
     */
    function removeBridge(address bridge) external onlyRole(ADMIN_ROLE) {
        _revokeRole(BRIDGE_ROLE, bridge);
        
        emit BridgeRemoved(bridge);
    }
}