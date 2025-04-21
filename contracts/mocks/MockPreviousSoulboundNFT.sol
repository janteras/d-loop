// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockPreviousSoulboundNFT
 * @dev This is a minimal implementation solely used for testing migrations
 * @notice Only implements functions directly required for specific test cases
 */
contract MockPreviousSoulboundNFT {
    // Token structure
    struct Token {
        uint256 id;
        address owner;
        string identifier;
        uint256 createdAt;
        bool burned;
    }
    
    // Admin/owner
    address public owner;
    
    // Token storage
    mapping(uint256 => Token) private tokens;
    mapping(address => uint256[]) private ownerTokens;
    uint256 private tokenCounter;
    
    /**
     * @dev Constructor to initialize the MockPreviousSoulboundNFT contract
     */
    constructor() {
        owner = msg.sender;
        tokenCounter = 0;
    }
    
    /**
     * @dev Mock implementation of IERC165 supportsInterface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return 
            interfaceId == 0x01ffc9a7 || // IERC165 interface ID
            interfaceId == 0x11111111; // Mock ISoulboundNFT interface ID
    }
    
    /**
     * @dev Mints a new token
     * @param _to Address to mint the token to
     * @param _identifier Unique identifier for the token
     * @return tokenId The ID of the minted token
     */
    function mint(address _to, string memory _identifier) external returns (uint256) {
        require(msg.sender == owner, "Not authorized");
        require(_to != address(0), "Zero address not allowed");
        
        // Increment token counter
        tokenCounter++;
        uint256 tokenId = tokenCounter;
        
        // Create new token
        tokens[tokenId] = Token({
            id: tokenId,
            owner: _to,
            identifier: _identifier,
            createdAt: block.timestamp,
            burned: false
        });
        
        // Add token to owner's list
        ownerTokens[_to].push(tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Burns a token (legacy version of revoke)
     * @param _tokenId ID of the token to burn
     */
    function burn(uint256 _tokenId) external {
        require(msg.sender == owner, "Not authorized");
        require(_exists(_tokenId), "Token does not exist");
        require(!tokens[_tokenId].burned, "Token already burned");
        
        // Mark token as burned
        tokens[_tokenId].burned = true;
    }
    
    /**
     * @dev Revokes a token (alternative name for burn)
     * @param _tokenId ID of the token to revoke
     */
    function revoke(uint256 _tokenId) external {
        // Just delegate to burn
        this.burn(_tokenId);
    }
    
    /**
     * @dev Checks if a token is valid (not revoked)
     * @param _tokenId ID of the token to check
     * @return isValid Whether the token is valid
     */
    function isTokenValid(uint256 _tokenId) external view returns (bool) {
        if (!_exists(_tokenId)) return false;
        return !tokens[_tokenId].burned;
    }
    
    /**
     * @dev Gets the tokens owned by an address
     * @param _owner Address of the token owner
     * @return tokenIds Array of token IDs owned by the address
     */
    function getTokensByOwner(address _owner) external view returns (uint256[] memory) {
        return ownerTokens[_owner];
    }
    
    /**
     * @dev Gets the details of a token
     * @param _tokenId ID of the token
     * @return The token owner, identifier, created timestamp, and burn status
     */
    function getTokenDetails(uint256 _tokenId) external view returns (
        address, 
        string memory, 
        uint256, 
        bool
    ) {
        require(_exists(_tokenId), "Token does not exist");
        
        Token storage token = tokens[_tokenId];
        
        return (
            token.owner,
            token.identifier,
            token.createdAt,
            token.burned
        );
    }
    
    /**
     * @dev Checks if a token exists
     * @param _tokenId ID of the token
     * @return exists Whether the token exists
     */
    function _exists(uint256 _tokenId) internal view returns (bool) {
        return tokens[_tokenId].owner != address(0);
    }
    
    /**
     * @dev Checks if an address has a valid token
     * @param _owner Address to check
     * @return hasValidToken Whether the address has a valid token
     */
    function hasValidToken(address _owner) external view returns (bool) {
        uint256[] memory tokenIds = ownerTokens[_owner];
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!tokens[tokenIds[i]].burned) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Returns whether an account has the minter role
     * @param _account Address to check
     * @return isMinter Whether the account has the minter role
     */
    function isMinter(address _account) external view returns (bool) {
        // In this mock, only the owner can mint
        return _account == owner;
    }
    
    // AccessControl interface implementations (stubbed)
    function hasRole(bytes32 role, address account) external view returns (bool) {
        if (role == 0x00) { // DEFAULT_ADMIN_ROLE
            return account == owner;
        } else if (bytes32(keccak256("MINTER_ROLE")) == role) {
            return account == owner;
        }
        return false;
    }
    
    function getRoleAdmin(bytes32 role) external view returns (bytes32) {
        return 0x00; // DEFAULT_ADMIN_ROLE
    }
    
    function grantRole(bytes32 role, address account) external {
        require(msg.sender == owner, "Not authorized");
        // This is a mock, so we don't actually do anything
    }
    
    function revokeRole(bytes32 role, address account) external {
        require(msg.sender == owner, "Not authorized");
        // This is a mock, so we don't actually do anything
    }
    
    function renounceRole(bytes32 role, address callerConfirmation) external {
        require(msg.sender == callerConfirmation, "Caller confirmation failed");
        // This is a mock, so we don't actually do anything
    }
}