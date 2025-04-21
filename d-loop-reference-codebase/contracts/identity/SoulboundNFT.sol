// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title SoulboundNFT
 * @notice Non-transferable NFT used for AI node identity verification
 * @dev Extends ERC721 with soulbound properties (no transfers)
 */
contract SoulboundNFT is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    
    // NFT metadata
    string public baseURI;
    
    // Verification properties
    mapping(address => bool) public isVerified;
    mapping(address => uint256) public ownerTokenId;
    mapping(uint256 => uint256) public tokenVerificationLevel;
    mapping(uint256 => uint256) public tokenIssuedTimestamp;
    mapping(uint256 => uint256) public tokenExpirationTimestamp;
    
    // Validity period for tokens (default: 1 year)
    uint256 public defaultValidityPeriod = 365 days;
    
    // Events
    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 verificationLevel);
    event TokenRevoked(address indexed from, uint256 indexed tokenId);
    event TokenRenewed(uint256 indexed tokenId, uint256 newExpirationTimestamp);
    event VerificationLevelUpdated(uint256 indexed tokenId, uint256 oldLevel, uint256 newLevel);
    event BaseURIUpdated(string oldURI, string newURI);
    event DefaultValidityPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    
    /**
     * @notice Constructor
     * @param admin Address to grant admin role
     * @param initialBaseURI Initial base URI for token metadata
     */
    constructor(address admin, string memory initialBaseURI) 
        ERC721("D-Loop AI Node Credential", "D-CRED") 
    {
        require(admin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(REVOKER_ROLE, admin);
        
        baseURI = initialBaseURI;
    }
    
    /**
     * @notice Mints a new soulbound token
     * @param to Address to mint token to
     * @param verificationLevel Level of verification (higher = more trusted)
     * @param uri Token metadata URI
     * @param validityPeriod Token validity period in seconds (0 = use default)
     * @return tokenId ID of the minted token
     */
    function mint(
        address to,
        uint256 verificationLevel,
        string memory uri,
        uint256 validityPeriod
    ) 
        external 
        onlyRole(MINTER_ROLE) 
        returns (uint256) 
    {
        require(to != address(0), "Invalid recipient address");
        require(!isVerified[to], "Address already has a token");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        // Set verification properties
        isVerified[to] = true;
        ownerTokenId[to] = tokenId;
        tokenVerificationLevel[tokenId] = verificationLevel;
        tokenIssuedTimestamp[tokenId] = block.timestamp;
        
        // Set expiration
        uint256 expirationPeriod = validityPeriod > 0 ? validityPeriod : defaultValidityPeriod;
        tokenExpirationTimestamp[tokenId] = block.timestamp + expirationPeriod;
        
        emit TokenMinted(to, tokenId, verificationLevel);
        
        return tokenId;
    }
    
    /**
     * @notice Revokes (burns) a token
     * @param tokenId ID of the token to revoke
     */
    function revoke(uint256 tokenId) 
        external 
        onlyRole(REVOKER_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        address owner = ownerOf(tokenId);
        
        // Update verification status
        isVerified[owner] = false;
        delete ownerTokenId[owner];
        
        // Burn the token
        _burn(tokenId);
        
        emit TokenRevoked(owner, tokenId);
    }
    
    /**
     * @notice Renews a token's validity period
     * @param tokenId ID of the token to renew
     * @param validityPeriod New validity period in seconds (0 = use default)
     */
    function renewToken(uint256 tokenId, uint256 validityPeriod) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        uint256 expirationPeriod = validityPeriod > 0 ? validityPeriod : defaultValidityPeriod;
        tokenExpirationTimestamp[tokenId] = block.timestamp + expirationPeriod;
        
        emit TokenRenewed(tokenId, tokenExpirationTimestamp[tokenId]);
    }
    
    /**
     * @notice Updates a token's verification level
     * @param tokenId ID of the token to update
     * @param newVerificationLevel New verification level
     */
    function updateVerificationLevel(uint256 tokenId, uint256 newVerificationLevel) 
        external 
        onlyRole(MINTER_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        uint256 oldLevel = tokenVerificationLevel[tokenId];
        tokenVerificationLevel[tokenId] = newVerificationLevel;
        
        emit VerificationLevelUpdated(tokenId, oldLevel, newVerificationLevel);
    }
    
    /**
     * @notice Sets the base URI for token metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string memory newBaseURI) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        string memory oldURI = baseURI;
        baseURI = newBaseURI;
        
        emit BaseURIUpdated(oldURI, newBaseURI);
    }
    
    /**
     * @notice Sets the default validity period
     * @param newPeriod New validity period in seconds
     */
    function setDefaultValidityPeriod(uint256 newPeriod) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newPeriod > 0, "Period must be positive");
        
        uint256 oldPeriod = defaultValidityPeriod;
        defaultValidityPeriod = newPeriod;
        
        emit DefaultValidityPeriodUpdated(oldPeriod, newPeriod);
    }
    
    /**
     * @notice Checks if a token is currently valid
     * @param tokenId ID of the token to check
     * @return valid Whether the token is valid
     */
    function isValidToken(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        return _exists(tokenId) && block.timestamp <= tokenExpirationTimestamp[tokenId];
    }
    
    /**
     * @notice Checks if an address has a valid token
     * @param owner Address to check
     * @return valid Whether the address has a valid token
     */
    function hasValidToken(address owner) 
        external 
        view 
        returns (bool) 
    {
        return isVerified[owner] && 
               block.timestamp <= tokenExpirationTimestamp[ownerTokenId[owner]];
    }
    
    /**
     * @notice Gets the verification level of an address
     * @param owner Address to check
     * @return level Verification level (0 if not verified)
     */
    function getVerificationLevel(address owner) 
        external 
        view 
        returns (uint256) 
    {
        if (!isVerified[owner]) {
            return 0;
        }
        
        uint256 tokenId = ownerTokenId[owner];
        
        // Check if token is expired
        if (block.timestamp > tokenExpirationTimestamp[tokenId]) {
            return 0;
        }
        
        return tokenVerificationLevel[tokenId];
    }
    
    /**
     * @notice Gets detailed token information
     * @param tokenId ID of the token to query
     * @return owner Address of the token owner
     * @return verificationLevel Verification level
     * @return issuedTimestamp Timestamp when the token was issued
     * @return expirationTimestamp Expiration timestamp
     * @return isValid Whether the token is currently valid
     */
    function getTokenDetails(uint256 tokenId) 
        external 
        view 
        returns (
            address owner,
            uint256 verificationLevel,
            uint256 issuedTimestamp,
            uint256 expirationTimestamp,
            bool isValid
        ) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        owner = ownerOf(tokenId);
        verificationLevel = tokenVerificationLevel[tokenId];
        issuedTimestamp = tokenIssuedTimestamp[tokenId];
        expirationTimestamp = tokenExpirationTimestamp[tokenId];
        isValid = block.timestamp <= expirationTimestamp;
        
        return (owner, verificationLevel, issuedTimestamp, expirationTimestamp, isValid);
    }
    
    /**
     * @notice Returns the base URI for token metadata
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
    
    // Overrides to make tokens soulbound (non-transferable)
    
    /**
     * @dev Disables token transfers (override ERC721 _transfer)
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) 
        internal 
        override 
    {
        // Allow minting (from = address(0)) and burning (to = address(0))
        // Disallow transfers between addresses
        require(
            from == address(0) || to == address(0),
            "Soulbound tokens cannot be transferred"
        );
        
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    /**
     * @dev Burn override (ERC721URIStorage)
     */
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }
    
    /**
     * @dev TokenURI override (ERC721URIStorage)
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    /**
     * @dev SupportsInterface override
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}