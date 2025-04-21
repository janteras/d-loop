// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IProtocolDAO
 * @dev Interface for the ProtocolDAO contract
 * @notice Defines the interface for protocol-level governance and administration functions
 */
interface IProtocolDAO {
    /**
     * @dev Checks if a token is whitelisted
     * @param token Address of the token to check
     * @return status Whether the token is whitelisted
     */
    function isTokenWhitelisted(address token) external view returns (bool);
    
    /**
     * @dev Whitelists a token
     * @param token Address of the token
     * @param status Whitelist status to set
     */
    function whitelistToken(address token, bool status) external;
    
    /**
     * @dev Gets the proposal count
     * @return count Number of proposals created
     */
    function getProposalCount() external view returns (uint256);
}