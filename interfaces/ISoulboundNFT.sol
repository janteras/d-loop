// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

/**
 * @title ISoulboundNFT
 * @dev Interface for the SoulboundNFT contract.
 * Non-transferable NFT used for AI node identification.
 * Implements IAccessControl for role-based permissions
 */
interface ISoulboundNFT is IERC165 {
    /**
     * @dev Role constants that should be implemented by the contract
     */
    // bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    /**
     * @dev Mints a new token
     * @param _to Address to mint the token to
     * @param _identifier Unique identifier for the token
     * @return tokenId The ID of the minted token
     */
    function mint(address _to, string memory _identifier) external returns (uint256);

    /**
     * @dev Burns a token
     * @param _tokenId ID of the token to burn
     */
    function burn(uint256 _tokenId) external;
    
    /**
     * @dev Revokes a token (alternative name for burn)
     * @param _tokenId ID of the token to revoke
     */
    function revoke(uint256 _tokenId) external;
    
    /**
     * @dev Checks if a token is valid (not revoked)
     * @param _tokenId ID of the token to check
     * @return isValid Whether the token is valid
     */
    function isTokenValid(uint256 _tokenId) external view returns (bool);
    
    /**
     * @dev Gets the token details
     * @param _tokenId ID of the token
     * @return tokenOwner Owner of the token
     * @return tokenURI URI for token metadata
     * @return mintedAt Minting timestamp
     * @return revoked Whether the token is revoked
     */
    function getTokenDetails(uint256 _tokenId) external view returns (
        address tokenOwner,
        string memory tokenURI,
        uint256 mintedAt,
        bool revoked
    );
    
    /**
     * @dev Checks if an address has a valid token
     * @param _owner Address to check
     * @return hasValidToken Whether the address has a valid token
     */
    function hasValidToken(address _owner) external view returns (bool);
    
    /**
     * @dev Returns whether an account has the minter role
     * @param _account Address to check
     * @return isMinter Whether the account has the minter role
     */
    function isMinter(address _account) external view returns (bool);
    
    /**
     * @dev Returns whether an account has the admin role
     * @param _account Address to check
     * @return isAdmin Whether the account has the admin role
     */
    function isAdmin(address _account) external view returns (bool);
    
    /**
     * @dev Grants the minter role to an address
     * @param _minter Address to grant minter role to
     */
    function grantMinterRole(address _minter) external;
    
    /**
     * @dev Revokes the minter role from an address
     * @param _minter Address to revoke minter role from
     */
    function revokeMinterRole(address _minter) external;
    
    /**
     * @dev Grants the admin role to a new address
     * @param _newAdmin Address of the new admin
     */
    function grantAdminRole(address _newAdmin) external;
    
    /**
     * @dev Transfers ownership (DEFAULT_ADMIN_ROLE) to a new address
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external;
}
