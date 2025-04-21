// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridgedToken.sol";

/**
 * @title BridgedToken
 * @dev ERC20 token that represents a token from another chain
 */
contract BridgedToken is ERC20, ERC20Burnable, AccessControl, IBridgedToken {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Original token information
    address public originalToken;
    uint256 public originalChainId;
    
    /**
     * @dev Constructor
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals_ Token decimals
     * @param bridge Bridge address
     * @param _originalToken Original token address
     * @param _originalChainId Original chain ID
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        address bridge,
        address _originalToken,
        uint256 _originalChainId
    ) ERC20(name, symbol) {
        require(bridge != address(0), "BridgedToken: bridge is zero address");
        require(_originalToken != address(0), "BridgedToken: original token is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BRIDGE_ROLE, bridge);
        
        originalToken = _originalToken;
        originalChainId = _originalChainId;
        
        // Set decimals
        _setupDecimals(decimals_);
    }
    
    /**
     * @dev Gets the original token address on its native chain
     * @return _originalToken Original token address
     * @return _originalChainId Original chain ID
     */
    function getOriginalToken() external view override returns (address _originalToken, uint256 _originalChainId) {
        return (originalToken, originalChainId);
    }
    
    /**
     * @dev Mints new tokens (only callable by the bridge)
     * @param to Recipient address
     * @param amount Amount to mint
     * @return success Whether the operation succeeded
     */
    function mint(address to, uint256 amount) external override onlyRole(BRIDGE_ROLE) returns (bool success) {
        _mint(to, amount);
        return true;
    }
    
    /**
     * @dev Burns tokens (only callable by the bridge)
     * @param from Address to burn from
     * @param amount Amount to burn
     * @return success Whether the operation succeeded
     */
    function burnFrom(address from, uint256 amount) external override onlyRole(BRIDGE_ROLE) returns (bool success) {
        _burn(from, amount);
        return true;
    }
    
    /**
     * @dev Sets up the number of decimals for the token
     * @param decimals_ Number of decimals
     */
    function _setupDecimals(uint8 decimals_) internal {
        _decimals = decimals_;
    }
}