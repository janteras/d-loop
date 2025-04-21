// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/BaseMock.sol";

/**
 * @title MockGovernanceToken
 * @dev Mock implementation of the Governance Token for testing purposes
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockGovernanceToken is ERC20, Ownable, BaseMock {
    uint8 private _decimals;
    
    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    /**
     * @dev Constructor
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param decimals_ Number of decimals
     */
    constructor(string memory name, string memory symbol, uint8 decimals_) 
        ERC20(name, symbol) 
        Ownable(msg.sender)
        BaseMock()
    {
        _decimals = decimals_ == 0 ? 18 : decimals_;
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation
     * @return The number of decimals
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to a specific address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _recordFunctionCall(
            "mint",
            abi.encode(to, amount)
        );
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens from a specific address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) public onlyOwner {
        _recordFunctionCall(
            "burn",
            abi.encode(from, amount)
        );
        
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Delegate voting power to another address
     * @param delegatee Address to delegate to
     */
    function delegate(address delegatee) external {
        _recordFunctionCall(
            "delegate",
            abi.encode(delegatee)
        );
        
        // This is a mock function that would normally delegate voting power
    }
    
    /**
     * @dev Get the current votes for an account
     * @param account The address to get votes for
     * @return The number of current votes for the account
     */
    function getCurrentVotes(address account) external view returns (uint256) {
        // This is a mock function that would normally return votes
        // For testing purposes, we'll return the balance
        return balanceOf(account);
    }
}
