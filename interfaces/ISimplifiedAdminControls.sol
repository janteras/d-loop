// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ISimplifiedAdminControls
 * @dev Interface for the SimplifiedAdminControls contract which provides administrative functions
 */
interface ISimplifiedAdminControls {
    /**
     * @dev Emitted when admin role is granted to an account
     */
    event AdminRoleGranted(address indexed account);
    
    /**
     * @dev Emitted when admin role is revoked from an account
     */
    event AdminRoleRevoked(address indexed account);
    
    /**
     * @dev Emitted when a parameter is updated
     */
    event ParameterUpdated(string indexed paramName, uint256 oldValue, uint256 newValue);
    
    /**
     * @dev Emitted when an address parameter is updated
     */
    event AddressParameterUpdated(string indexed paramName, address oldValue, address newValue);
    
    /**
     * @dev Emitted when a contract is paused
     */
    event ContractPaused(address indexed by);
    
    /**
     * @dev Emitted when a contract is unpaused
     */
    event ContractUnpaused(address indexed by);

    /**
     * @dev Grants admin role to an account
     * @param account Address to grant admin role to
     */
    function grantAdminRole(address account) external;
    
    /**
     * @dev Revokes admin role from an account
     * @param account Address to revoke admin role from
     */
    function revokeAdminRole(address account) external;
    
    /**
     * @dev Checks if an account has admin role
     * @param account Address to check
     * @return hasRole Whether the account has admin role
     */
    function hasAdminRole(address account) external view returns (bool hasRole);
    
    /**
     * @dev Updates a numeric parameter
     * @param paramName Name of the parameter
     * @param newValue New value for the parameter
     */
    function updateParameter(string calldata paramName, uint256 newValue) external;
    
    /**
     * @dev Updates an address parameter
     * @param paramName Name of the parameter
     * @param newValue New address value for the parameter
     */
    function updateAddressParameter(string calldata paramName, address newValue) external;
    
    /**
     * @dev Gets the value of a numeric parameter
     * @param paramName Name of the parameter
     * @return value The parameter value
     */
    function getParameter(string calldata paramName) external view returns (uint256 value);
    
    /**
     * @dev Gets the value of an address parameter
     * @param paramName Name of the parameter
     * @return value The address parameter value
     */
    function getAddressParameter(string calldata paramName) external view returns (address value);
    
    /**
     * @dev Pauses the contract
     */
    function pause() external;
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external;
    
    /**
     * @dev Checks if the contract is paused
     * @return isPaused Whether the contract is paused
     */
    function isPaused() external view returns (bool isPaused);
}
