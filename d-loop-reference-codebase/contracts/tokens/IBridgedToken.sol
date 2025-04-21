// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IBridgedToken
 * @dev Interface for bridged token contracts
 */
interface IBridgedToken {
    /**
     * @dev Gets the original token address on its native chain
     * @return _originalToken Original token address
     * @return _originalChainId Original chain ID
     */
    function getOriginalToken() external view returns (address _originalToken, uint256 _originalChainId);
    
    /**
     * @dev Mints new tokens (only callable by the bridge)
     * @param to Recipient address
     * @param amount Amount to mint
     * @return success Whether the operation succeeded
     */
    function mint(address to, uint256 amount) external returns (bool success);
    
    /**
     * @dev Burns tokens (only callable by the bridge)
     * @param from Address to burn from
     * @param amount Amount to burn
     * @return success Whether the operation succeeded
     */
    function burnFrom(address from, uint256 amount) external returns (bool success);
}