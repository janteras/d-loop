// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/interfaces/IERC721.sol";

/**
 * @title ISoulboundNFT
 * @dev Interface for the SoulboundNFT contract
 */
interface ISoulboundNFT is IERC721 {
    /**
     * @dev Mints a new soulbound token to the specified address
     * @param to The address to mint the token to
     */
    function mint(address to) external;

    /**
     * @dev Burns a soulbound token
     * @param tokenId The ID of the token to burn
     */
    function burn(uint256 tokenId) external;

    /**
     * @dev Checks if an address has a valid soulbound token
     * @param owner The address to check
     * @return bool True if the address has a valid token
     */
    function hasValidToken(address owner) external view returns (bool);

    /**
     * @dev Gets the token ID owned by an address
     * @param owner The address to check
     * @return uint256 The token ID owned by the address
     */
    function getTokenId(address owner) external view returns (uint256);

    /**
     * @dev Event emitted when a new soulbound token is minted
     */
    event SoulboundTokenMinted(address indexed to, uint256 indexed tokenId);

    /**
     * @dev Event emitted when a soulbound token is burned
     */
    event SoulboundTokenBurned(uint256 indexed tokenId);
}
