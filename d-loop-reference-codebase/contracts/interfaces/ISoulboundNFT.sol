// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ISoulboundNFT
 * @dev Interface for the SoulboundNFT contract
 */
interface ISoulboundNFT is IERC721 {
    /**
     * @dev Add a minter
     * @param minter Address of the minter
     */
    function addMinter(address minter) external;
    
    /**
     * @dev Add a burner
     * @param burner Address of the burner
     */
    function addBurner(address burner) external;
    
    /**
     * @dev Mint a new token
     * @param to Address to mint the token to
     * @param uri URI of the token
     * @return tokenId ID of the minted token
     */
    function mint(address to, string memory uri) external returns (uint256);
    
    /**
     * @dev Burn a token
     * @param tokenId ID of the token to burn
     */
    function burn(uint256 tokenId) external;
    
    /**
     * @dev Get token URI
     * @param tokenId ID of the token
     * @return URI of the token
     */
    function tokenURI(uint256 tokenId) external view returns (string memory);
}