// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ISoulboundNFT } from "../interfaces/tokens/ISoulboundNFT.sol";
import { SoulboundNFT } from "../identity/SoulboundNFT.sol";
import "../utils/Errors.sol";

import { IERC165 } from "@openzeppelin/contracts/interfaces/IERC165.sol";

/**
 * @title SoulboundNFTAdapter
 * @dev Adapter to make SoulboundNFT compatible with ISoulboundNFT interface
 * @notice This contract allows systems expecting the ISoulboundNFT interface to work with the SoulboundNFT implementation
 */
contract SoulboundNFTAdapter is ISoulboundNFT {
    // State variables
    SoulboundNFT public nft;
    // All state variables grouped for clarity.
    
    /**
     * @dev Constructor to initialize the SoulboundNFTAdapter contract
     * @param _nft Address of the SoulboundNFT implementation
     */
    constructor(address _nft) {
        if (_nft == address(0)) revert ZeroAddress();
        nft = SoulboundNFT(_nft);
    }
    
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return 
            interfaceId == type(IERC165).interfaceId || 
            interfaceId == type(ISoulboundNFT).interfaceId;
    }
    
    /**
     * @dev Mints a new token
     * @param _to Address to mint the token to
     * @param _identifier Unique identifier for the token
     * @return tokenId The ID of the minted token
     */
    function mint(address _to, string memory _identifier) external override returns (uint256) {
        return nft.mint(_to, _identifier);
    }
    
    /**
     * @dev Burns a token (maps to revoke in SoulboundNFT)
     * @param _tokenId ID of the token to burn
     */
    function burn(uint256 _tokenId) external override {
        nft.revoke(_tokenId);
    }
    
    /**
     * @dev Revokes a token
     * @param _tokenId ID of the token to revoke
     */
    function revoke(uint256 _tokenId) external override {
        nft.revoke(_tokenId);
    }
    
    /**
     * @dev Checks if a token is valid (not revoked)
     * @param _tokenId ID of the token to check
     * @return isValid Whether the token is valid
     */
    function isTokenValid(uint256 _tokenId) external view override returns (bool) {
        return nft.isTokenValid(_tokenId);
    }
    
    /**
     * @dev Gets the token details
     * @param _tokenId ID of the token
     * @return tokenOwner Owner of the token
     * @return tokenURI URI for token metadata
     * @return mintedAt Minting timestamp
     * @return revoked Whether the token is revoked
     */
    function getTokenDetails(uint256 _tokenId) external view override returns (
        address tokenOwner,
        string memory tokenURI,
        uint256 mintedAt,
        bool revoked
    ) {
        return nft.getTokenDetails(_tokenId);
    }
    
    /**
     * @dev Checks if an address has a valid token
     * @param _owner Address to check
     * @return hasValidToken Whether the address has a valid token
     */
    function hasValidToken(address _owner) external view override returns (bool) {
        return nft.hasValidToken(_owner);
    }
    
    /**
     * @dev Returns whether an account has the minter role
     * @param _account Address to check
     * @return isMinter Whether the account has the minter role
     */
    function isMinter(address _account) external view override returns (bool) {
        return nft.isMinter(_account);
    }
    
    /**
     * @dev Returns whether an account has the admin role
     * @param _account Address to check
     * @return isAdmin Whether the account has the admin role
     */
    function isAdmin(address _account) external view override returns (bool) {
        return nft.isAdmin(_account);
    }
    
    /**
     * @dev Grants the minter role to an address
     * @param _minter Address to grant minter role to
     */
    function grantMinterRole(address _minter) external override {
        nft.grantMinterRole(_minter);
    }
    
    /**
     * @dev Revokes the minter role from an address
     * @param _minter Address to revoke minter role from
     */
    function revokeMinterRole(address _minter) external override {
        nft.revokeMinterRole(_minter);
    }
    
    /**
     * @dev Grants the admin role to a new address
     * @param _newAdmin Address of the new admin
     */
    function grantAdminRole(address _newAdmin) external override {
        nft.grantAdminRole(_newAdmin);
    }
    
    /**
     * @dev Transfers ownership (DEFAULT_ADMIN_ROLE) to a new address
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external override {
        nft.transferOwnership(_newOwner);
    }
}