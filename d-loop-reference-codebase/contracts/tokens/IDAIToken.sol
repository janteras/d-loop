// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IDAIToken
 * @dev Interface for the D-AI Token
 */
interface IDAIToken {
    /**
     * @dev Initializes the contract with initial roles and parameters
     * @param admin Admin address
     * @param assetDAO Asset DAO address for minting/burning
     * @param _treasury Treasury address
     * @param _mintingCap Initial minting cap
     */
    function initialize(
        address admin,
        address assetDAO,
        address _treasury,
        uint256 _mintingCap
    ) external;
    
    /**
     * @dev Mints new tokens (only callable by Asset DAO)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @dev Burns tokens from a specific address (only callable by Asset DAO)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external;
}