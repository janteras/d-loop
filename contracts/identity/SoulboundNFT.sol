// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

error OperationFailed();

import {
    ZeroAddress,
    Unauthorized,
    InvalidInput,
    ExceedsBatchLimit,
    AssetNotFound,
    TokenNonTransferable
} from "../utils/Errors.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { ISoulboundNFT } from "../interfaces/tokens/ISoulboundNFT.sol";

/**
 * @title SoulboundNFT
 * @dev Implementation of soulbound non-transferable tokens using AccessControl
 * @notice This contract provides identity verification through non-transferable tokens
 */
contract SoulboundNFT is ISoulboundNFT, AccessControl {
    // Token structure
    struct Token {
        uint256 id;
        address owner;
        string tokenURI;
        uint256 mintedAt;
        bool revoked;
    }
    
    // Role management with AccessControl
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    // Token storage
    mapping(uint256 => Token) private tokens;
    mapping(address => uint256[]) private ownerTokens;
    uint256 private tokenCounter;
    
    // Maximum batch size to prevent unbounded loops and gas limit issues
    uint256 public constant MAX_BATCH_SIZE = 50;
    
    // Delegation storage
    mapping(address => mapping(address => uint256)) private delegations;
    
    // Events
    event TokenMinted(uint256 indexed tokenId, address indexed to, string tokenURI);
    event TokenRevoked(uint256 indexed tokenId, address indexed owner);
    event TokenURIUpdated(uint256 indexed tokenId, string oldURI, string newURI);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event VoteDelegated(address indexed from, address indexed to, uint256 expiryTime);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    /**
     * @dev Modifier to restrict access to roles with minter capability
     */
    modifier onlyMinter() {
        if (!hasRole(MINTER_ROLE, msg.sender) && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        _;
    }
    
    /**
     * @dev Modifier to restrict access to admin role
     */
    modifier onlyAdminRole() {
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert Unauthorized();
        }
        _;
    }
    // ========== Constructor ========== //

    /**
     * @dev Constructor to initialize the SoulboundNFT contract with AccessControl

     */
    constructor() {
        // For Sepolia, only deployer is assigned as admin/minter
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        tokenCounter = 0;
    }
    
    // ========== External Functions ========== //

    /**
     * @dev Mints a new soulbound token
     * @param to Address to mint the token to
     * @param uri URI for token metadata
     * @return tokenId The ID of the minted token
     */
    function mint(address to, string memory uri) external onlyMinter returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        
        // Increment token counter
        tokenCounter++;
        uint256 tokenId = tokenCounter;
        
        // Create new token
        tokens[tokenId] = Token({
            id: tokenId,
            owner: to,
            tokenURI: uri,
            mintedAt: block.timestamp,
            revoked: false
        });
        
        // Add token to owner's list
        ownerTokens[to].push(tokenId);
        
        // Emit mint event
        emit TokenMinted(tokenId, to, uri);
        
        return tokenId;
    }
    
    /**
     * @dev Mints multiple soulbound tokens in a single transaction with batch size limit
     * @param recipients Array of addresses to mint tokens to
     * @param uris Array of URIs for token metadata
     * @return tokenIds Array of the minted token IDs
     */
    function batchMint(
        address[] calldata recipients,
        string[] calldata uris
    ) external onlyMinter returns (uint256[] memory) {
        if (recipients.length != uris.length) revert InvalidInput();
        if (recipients.length > MAX_BATCH_SIZE) revert ExceedsBatchLimit();
        uint256[] memory tokenIds = new uint256[](recipients.length);
        for (uint256 i = 0; i < recipients.length; i++) {
            tokenIds[i] = _mintSoulbound(recipients[i], uris[i]);
        }
        return tokenIds;
    }

    // ========== External Functions ========== //
    // (external functions already listed above)

    // ========== Internal Functions ========== //
    // ========== Internal Functions ========== //
    function _mintSoulbound(address to, string memory uri) private returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        tokenCounter++;
        tokenId = tokenCounter;
        tokens[tokenId] = Token({
            id: tokenId,
            owner: to,
            tokenURI: uri,
            mintedAt: block.timestamp,
            revoked: false
        });
        ownerTokens[to].push(tokenId);
        emit TokenMinted(tokenId, to, uri);
    }
    
    /**
     * @dev Revokes a soulbound token
     * @param tokenId ID of the token to revoke
     */
    function revoke(uint256 tokenId) external onlyAdminRole {
        if (!_exists(tokenId)) revert AssetNotFound();
        if (tokens[tokenId].revoked) revert AssetNotFound();
        
        // Mark token as revoked
        tokens[tokenId].revoked = true;
        
        // Emit revoke event
        emit TokenRevoked(tokenId, tokens[tokenId].owner);
    }
    
    /**
     * @dev Burns a soulbound token (alias for revoke)
     * @param tokenId ID of the token to burn
     */
    function burn(uint256 tokenId) external onlyAdminRole {
        if (!_exists(tokenId)) revert AssetNotFound();
        if (tokens[tokenId].revoked) revert AssetNotFound();
        
        // Mark token as revoked
        tokens[tokenId].revoked = true;
        
        // Emit revoke event
        emit TokenRevoked(tokenId, tokens[tokenId].owner);
    }
    
    /**
     * @dev Updates the token URI
     * @param tokenId ID of the token
     * @param newUri New URI for token metadata
     */
    function updateTokenURI(uint256 tokenId, string memory newUri) external onlyAdminRole {
        if (!_exists(tokenId)) revert AssetNotFound();
        if (tokens[tokenId].revoked) revert AssetNotFound();
        
        string memory oldURI = tokens[tokenId].tokenURI;
        tokens[tokenId].tokenURI = newUri;
        
        emit TokenURIUpdated(tokenId, oldURI, newUri);
    }
    
    // ========== External View Functions ========== //

    /**
     * @dev Gets the token details
     * @param tokenId ID of the token
     * @return tokenOwner Owner of the token
     * @return uri URI for token metadata
     * @return mintedAt Minting timestamp
     * @return revoked Whether the token is revoked
     */
    function getTokenDetails(uint256 tokenId) external view returns (
        address tokenOwner,
        string memory uri,
        uint256 mintedAt,
        bool revoked
    ) {
        if (!_exists(tokenId)) revert AssetNotFound();
        
        Token storage token = tokens[tokenId];
        
        return (
            token.owner,
            token.tokenURI,
            token.mintedAt,
            token.revoked
        );
    }
    
    /**
     * @dev Gets the token count
     * @return count Number of tokens minted
     */
    function getTokenCount() external view returns (uint256) {
        return tokenCounter;
    }
    
    /**
     * @dev Gets tokens owned by an address
     * @param ownerAddress Address of the token owner
     * @return tokenIds Array of token IDs owned by the address
     */
    function getTokensByOwner(address ownerAddress) external view returns (uint256[] memory) {
        return ownerTokens[ownerAddress];
    }
    
    /**
     * @dev Checks if an address owns a valid (non-revoked) token
     * @param ownerAddress Address to check
     * @return hasValidToken Whether the address owns a valid token
     */
    function hasValidToken(address ownerAddress) external view returns (bool) {
        uint256[] memory tokenIds = ownerTokens[ownerAddress];
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!tokens[tokenIds[i]].revoked) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * @dev Grants the ADMIN_ROLE to a new address
     * @param _newAdmin Address of the new admin
     */
    function grantAdminRole(address _newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newAdmin == address(0)) revert ZeroAddress();
        
        address oldAdmin = msg.sender; // Just for event emission
        _grantRole(ADMIN_ROLE, _newAdmin);
        
        emit AdminUpdated(oldAdmin, _newAdmin);
    }
    
    /**
     * @dev Grants the MINTER_ROLE to an address
     * @param minter Address to grant minter role to
     */
    function grantMinterRole(address minter) external onlyRole(ADMIN_ROLE) {
        if (minter == address(0)) revert ZeroAddress();
        _grantRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Revokes the MINTER_ROLE from an address
     * @param minter Address to revoke minter role from
     */
    function revokeMinterRole(address minter) external onlyRole(ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, minter);
    }
    
    /**
     * @dev Transfers default admin role to a new address
     * @param _newOwner Address of the new owner (DEFAULT_ADMIN_ROLE)
     */
    function transferOwnership(address _newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        _revokeRole(DEFAULT_ADMIN_ROLE, oldOwner);
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @dev Checks if a token exists
     * @param tokenId ID of the token
     * @return exists Whether the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokens[tokenId].owner != address(0);
    }
    
    /**
     * @dev See {IERC721-balanceOf}.
     * Returns the number of tokens owned by an address
     */
    function balanceOf(address owner) external view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return ownerTokens[owner].length;
    }
    
    /**
     * @dev See {IERC721-ownerOf}.
     * Returns the owner of a specific token
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = tokens[tokenId].owner;
        if (owner == address(0)) revert AssetNotFound();
        return owner;
    }
    
    /**
     * @dev See {IERC721Metadata-tokenURI}.
     * Returns the token URI for a specific token
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (!_exists(tokenId)) revert AssetNotFound();
        return tokens[tokenId].tokenURI;
    }
    
    /**
     * @dev See {IERC165-supportsInterface}.
     * Determines which interfaces are supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, IERC165) returns (bool) {
        return 
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            interfaceId == type(ISoulboundNFT).interfaceId ||
            super.supportsInterface(interfaceId);
    }
    
    /**
     * @dev See {IERC721-approve}.
     * This function is disabled for soulbound tokens but implemented for ERC721 compatibility
     */
    /**
     * @dev See {IERC721-approve}. Disabled for soulbound tokens.
     */
    function approve(address, uint256) external pure {
        revert TokenNonTransferable();
    }
    
    /**
     * @dev See {IERC721-getApproved}.
     * Always returns zero address for soulbound tokens
     */
    /**
     * @dev See {IERC721-getApproved}. Always returns zero address for soulbound tokens.
     */
    function getApproved(uint256 tokenId) external view returns (address) {
        if (!_exists(tokenId)) revert AssetNotFound();
        return address(0); // No approvals for soulbound tokens
    }
    
    /**
     * @dev See {IERC721-setApprovalForAll}.
     * This function is disabled for soulbound tokens but implemented for ERC721 compatibility
     */
    /**
     * @dev See {IERC721-setApprovalForAll}. Disabled for soulbound tokens.
     */
    function setApprovalForAll(address, bool) external pure {
        revert TokenNonTransferable();
    }
    
    /**
     * @dev See {IERC721-isApprovedForAll}.
     * Always returns false for soulbound tokens
     */
    /**
     * @dev See {IERC721-isApprovedForAll}. Always returns false for soulbound tokens.
     */
    function isApprovedForAll(address, address) external pure returns (bool) {
        return false; // No operator approvals for soulbound tokens
    }
    
    /**
     * @dev See {IERC721-transferFrom}.
     * This function is disabled for soulbound tokens but implemented for ERC721 compatibility
     */
    /**
     * @dev See {IERC721-transferFrom}. Disabled for soulbound tokens.
     */
    function transferFrom(address, address, uint256) external pure {
        revert TokenNonTransferable();
    }
    
    /**
     * @dev See {IERC721-safeTransferFrom}.
     * This function is disabled for soulbound tokens but implemented for ERC721 compatibility
     */
    /**
     * @dev See {IERC721-safeTransferFrom}. Disabled for soulbound tokens.
     */
    function safeTransferFrom(address, address, uint256) external pure {
        revert TokenNonTransferable();
    }
    
    /**
     * @dev See {IERC721-safeTransferFrom}.
     * This function is disabled for soulbound tokens but implemented for ERC721 compatibility
     */
    /**
     * @dev See {IERC721-safeTransferFrom}. Disabled for soulbound tokens.
     */
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert TokenNonTransferable();
    }
    
    /**
     * @dev Checks if a token is valid (not revoked)
     * @param tokenId ID of the token
     * @return isValid Whether the token is valid
     */
    function isTokenValid(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) return false;
        
        return !tokens[tokenId].revoked;
    }
    
    /**
     * @dev Delegates voting rights to another address with expiry
     * @param delegateAddress Address to delegate to
     * @param expiryTime Timestamp when delegation expires
     */
    function delegateVote(address delegateAddress, uint256 expiryTime) external {
        if (delegateAddress == address(0)) revert ZeroAddress();
        if (expiryTime <= block.timestamp) revert OperationFailed();
        if (!this.hasValidToken(msg.sender)) revert Unauthorized();
        
        delegations[msg.sender][delegateAddress] = expiryTime;
        
        emit VoteDelegated(msg.sender, delegateAddress, expiryTime);
    }
    
    /**
     * @dev Checks if delegation from owner to delegate is still valid
     * @param tokenOwner Address of the token owner
     * @param delegate Address of the delegate
     * @return expiryTime Timestamp when delegation expires (0 if no delegation)
     */
    function delegatedUntil(address tokenOwner, address delegate) external view returns (uint256) {
        uint256 expiry = delegations[tokenOwner][delegate];
        
        // If expired, return 0
        if (expiry <= block.timestamp) {
            return 0;
        }
        
        return expiry;
    }
    
    /**
     * @dev Returns whether an account has the minter role
     * @param account Address to check
     * @return isMinter Whether the account has the minter role
     */
    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }
    
    /**
     * @dev Returns whether an account has the admin role
     * @param account Address to check
     * @return isAdmin Whether the account has the admin role
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
    
    // supportsInterface is already defined above
}