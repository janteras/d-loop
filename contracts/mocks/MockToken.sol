// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./base/BaseMock.sol";

/**
 * @title MockToken
 * @dev A simple mock ERC20 token for testing purposes
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockToken is ERC20, Ownable, BaseMock {
    uint8 private _decimals;

    /**
     * @dev Constructor
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param decimals_ Number of decimals
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_
    ) ERC20(name, symbol) Ownable(msg.sender) BaseMock() {
        _decimals = decimals_;
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens to a specific address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _recordFunctionCall(
            "mint",
            abi.encode(to, amount)
        );
        _mint(to, amount);
    }

    /**
     * @dev Mint tokens to yourself
     * @param amount Amount of tokens to mint
     */
    function mintSelf(uint256 amount) external {
        _recordFunctionCall(
            "mintSelf",
            abi.encode(amount)
        );
        _mint(msg.sender, amount);
    }

    /**
     * @dev Burn tokens from a specific address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _recordFunctionCall(
            "burn",
            abi.encode(from, amount)
        );
        _burn(from, amount);
    }
}