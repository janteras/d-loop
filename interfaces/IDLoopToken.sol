// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IDLoopToken
 * @dev Interface for the DLoopToken contract which is the main utility token of the D-Loop Protocol
 */
interface IDLoopToken {
    /**
     * @dev Emitted when tokens are delegated
     */
    event TokensDelegated(address indexed delegator, address indexed delegatee, uint256 amount);
    
    /**
     * @dev Emitted when delegation is withdrawn
     */
    event DelegationWithdrawn(address indexed delegator, address indexed delegatee, uint256 amount);
    
    /**
     * @dev Emitted when tokens are minted
     */
    event TokensMinted(address indexed to, uint256 amount);
    
    /**
     * @dev Emitted when tokens are burned
     */
    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @dev Delegates tokens to another address
     * @param delegatee Address to delegate tokens to
     * @param amount Amount of tokens to delegate
     */
    function delegateTokens(address delegatee, uint256 amount) external;
    
    /**
     * @dev Withdraws delegation from an address
     * @param delegatee Address to withdraw delegation from
     * @param amount Amount of tokens to withdraw
     */
    function withdrawDelegation(address delegatee, uint256 amount) external;
    
    /**
     * @dev Mints new tokens
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
    
    /**
     * @dev Gets the amount of tokens delegated from one address to another
     * @param delegator Address that delegated tokens
     * @param delegatee Address that received delegation
     * @return amount The amount of delegated tokens
     */
    function getDelegatedAmount(address delegator, address delegatee) external view returns (uint256 amount);
    
    /**
     * @dev Gets the total amount of tokens delegated by an address
     * @param delegator Address that delegated tokens
     * @return amount The total amount of delegated tokens
     */
    function getTotalDelegatedAmount(address delegator) external view returns (uint256 amount);
    
    /**
     * @dev Gets the total amount of tokens delegated to an address
     * @param delegatee Address that received delegation
     * @return amount The total amount of tokens delegated to the address
     */
    function getTotalDelegatedToAmount(address delegatee) external view returns (uint256 amount);
    
    /**
     * @dev Gets the addresses that have delegated tokens to an address
     * @param delegatee Address to check
     * @return delegators The addresses that have delegated tokens to the address
     */
    function getDelegators(address delegatee) external view returns (address[] memory delegators);
    
    /**
     * @dev Gets the addresses that an address has delegated tokens to
     * @param delegator Address to check
     * @return delegatees The addresses that the address has delegated tokens to
     */
    function getDelegatees(address delegator) external view returns (address[] memory delegatees);
}
