// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/BaseMock.sol";

/**
 * @title MockDAIToken
 * @dev Mock DAI token for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockDAIToken is ERC20, Ownable, BaseMock {
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    uint8 private _decimals;
    
    /**
     * @dev Constructor that gives the msg.sender all initial tokens
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply to mint to deployer
     * @param decimalsValue Token decimal places (default 18)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 decimalsValue
    ) ERC20(name, symbol) Ownable(msg.sender) BaseMock() {
        _decimals = decimalsValue;
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @dev Returns the number of decimals of the token
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to an address
     * @param to Address to mint to
     * @param amount Amount to mint
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
     * @dev Burn tokens from an address
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) public onlyOwner {
        _recordFunctionCall(
            "burn",
            abi.encode(from, amount)
        );
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
}