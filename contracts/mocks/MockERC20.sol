// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/BaseMock.sol";


/**
 * @title MockERC20
 * @dev Mock implementation of the ERC20 token standard for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockERC20 is ERC20, Ownable, BaseMock {
    uint8 private _decimals;

    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
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
     * @dev Override decimals function to allow custom decimal places
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    // Default decimals value setup
    function initializeWithDefaultDecimals() public {
        _recordFunctionCall(
            "initializeWithDefaultDecimals",
            abi.encode()
        );
        _decimals = 18;
    }
    
    /**
     * @dev Mint new tokens
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _recordFunctionCall(
            "mint",
            abi.encode(to, amount)
        );
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        _recordFunctionCall(
            "burn",
            abi.encode(from, amount)
        );
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Override totalSupply to record function calls
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function totalSupply() public view override(ERC20) returns (uint256) {
        return super.totalSupply();
    }
    
    /**
     * @dev Override balanceOf to record function calls
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function balanceOf(address account) public view override(ERC20) returns (uint256) {
        return super.balanceOf(account);
    }
    
    /**
     * @dev Override transfer to record function calls
     */
    function transfer(address recipient, uint256 amount) public override(ERC20) returns (bool) {
        _recordFunctionCall("transfer", abi.encode(recipient, amount));
        return super.transfer(recipient, amount);
    }
    
    /**
     * @dev Override allowance to record function calls
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function allowance(address owner, address spender) public view override(ERC20) returns (uint256) {
        return super.allowance(owner, spender);
    }
    
    /**
     * @dev Override approve to record function calls
     */
    function approve(address spender, uint256 amount) public override(ERC20) returns (bool) {
        _recordFunctionCall("approve", abi.encode(spender, amount));
        return super.approve(spender, amount);
    }
    
    /**
     * @dev Override transferFrom to record function calls
     */
    function transferFrom(address sender, address recipient, uint256 amount) public override(ERC20) returns (bool) {
        _recordFunctionCall("transferFrom", abi.encode(sender, recipient, amount));
        return super.transferFrom(sender, recipient, amount);
    }
}