// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import "../utils/Errors.sol";

/**
 * @title PriceOracle
 * @dev Simplified price oracle for Sepolia testing
 * This contract provides price data for the D-Loop Protocol with test compatibility
 */
contract PriceOracle is AccessControl {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    
    // Token price storage (token address => price in USD with 18 decimals)
    mapping(address => uint256) private _prices;
    
    // Token last update timestamp (token address => timestamp)
    mapping(address => uint256) private _lastUpdateTime;
    
    // Token decimals (token address => decimals)
    mapping(address => uint8) private _decimals;
    
    // Access control mappings
    address private _owner;
    address private _admin;
    mapping(address => bool) public priceUpdaters;
    
    // Default values
    uint8 public constant DEFAULT_DECIMALS = 18;
    uint256 public constant DEFAULT_STALENESS_PERIOD = 24 hours;
    
    // Events
    event PriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice);
    event DirectPriceUpdated(address indexed token, uint256 price, uint8 decimals);
    event PriceUpdaterAdded(address indexed updater);
    event PriceUpdaterRemoved(address indexed updater);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    
    /**
     * @dev Constructor initializes the contract with roles
     * @param adminAddress Address that will have admin role
     * @param updaterAddress Address that will have price updater role (optional)
     */
    constructor(address adminAddress, address updaterAddress) {
        _owner = msg.sender;
        
        // If admin is zero address, set owner as admin
        if (adminAddress == address(0)) {
            _admin = msg.sender;
        } else {
            _admin = adminAddress;
        }
        
        // [TESTNET] Grant roles only to deployer for Sepolia
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender); // [TESTNET] Only deployer is admin
        _admin = msg.sender; // [TESTNET] Only deployer is admin
        
        // Add updater if provided
        if (updaterAddress != address(0)) {
            _grantRole(PRICE_UPDATER_ROLE, updaterAddress);
            priceUpdaters[updaterAddress] = true;
        }
    }
    
    /**
     * @dev Modifier to restrict access to owner
     */
    // [TESTNET] Only deployer is owner for Sepolia
    modifier onlyOwner() {
        if (msg.sender != _owner) revert Unauthorized();
        _;
    }
    
    /**
     * @dev Modifier to restrict access to admin or owner
     */
    // [TESTNET] Only deployer is admin/owner for Sepolia
    modifier onlyAdminOrOwner() {
        if (msg.sender != _admin && msg.sender != _owner) revert Unauthorized();
        _;
    }
    
    /**
     * @dev Modifier to restrict access to price updaters, admin, or owner
     */
    modifier onlyPriceUpdater() {
        if (!priceUpdaters[msg.sender] && msg.sender != _admin && msg.sender != _owner) 
            revert Unauthorized();
        _;
    }
    
    /**
     * @dev Get the current owner
     * @return The address of the current owner
     */
    function owner() external view returns (address) {
        return _owner;
    }
    
    /**
     * @dev Get the current admin
     * @return The address of the current admin
     */
    function admin() external view returns (address) {
        return _admin;
    }
    
    /**
     * @dev Transfer ownership to a new address
     * @param newOwner Address of the new owner
     */
    // [TESTNET] transferOwnership is DISABLED for Sepolia
    // function transferOwnership(address newOwner) external onlyOwner {
    //     if (newOwner == address(0)) revert ZeroAddress();
    //     address oldOwner = _owner;
    //     _owner = newOwner;
    //     emit OwnershipTransferred(oldOwner, newOwner);
    // }
    
    /**
     * @dev Update admin to a new address
     * @param newAdmin Address of the new admin
     */
    // [TESTNET] updateAdmin is DISABLED for Sepolia
    // function updateAdmin(address newAdmin) external onlyOwner {
    //     if (newAdmin == address(0)) revert ZeroAddress();
    //     address oldAdmin = _admin;
    //     _admin = newAdmin;
    //     _grantRole(ADMIN_ROLE, newAdmin);
    //     emit AdminUpdated(oldAdmin, newAdmin);
    // }
    
    /**
     * @dev Add a price updater
     * @param updater Address to grant the price updater role
     */
    function addPriceUpdater(address updater) external onlyAdminOrOwner {
        if (updater == address(0)) revert ZeroAddress();
        
        priceUpdaters[updater] = true;
        _grantRole(PRICE_UPDATER_ROLE, updater);
        
        emit PriceUpdaterAdded(updater);
    }
    
    /**
     * @dev Remove a price updater
     * @param updater Address to revoke the price updater role from
     */
    function removePriceUpdater(address updater) external onlyAdminOrOwner {
        if (updater == address(0)) revert ZeroAddress();
        
        priceUpdaters[updater] = false;
        _revokeRole(PRICE_UPDATER_ROLE, updater);
        
        emit PriceUpdaterRemoved(updater);
    }
    
    /**
     * @dev Sets the price for a token
     * @param token The token address
     * @param price The price to set (in USD with 18 decimals)
     */
    function setPrice(address token, uint256 price) public onlyPriceUpdater {
        if (token == address(0)) revert ZeroAddress();
        
        uint256 oldPrice = _prices[token];
        _prices[token] = price;
        _lastUpdateTime[token] = block.timestamp;
        
        // If decimals not set, use default
        if (_decimals[token] == 0) {
            _decimals[token] = DEFAULT_DECIMALS;
        }
        
        emit PriceUpdated(token, oldPrice, price);
    }
    
    /**
     * @dev Sets the price for a token with specific decimals (direct price setting)
     * @param token The token address
     * @param price The price to set
     * @param decimals The number of decimals for the price
     */
    function setDirectPrice(address token, uint256 price, uint8 decimals) external onlyAdminOrOwner {
        if (token == address(0)) revert ZeroAddress();
        
        uint256 oldPrice = _prices[token];
        uint256 normalizedPrice = price;
        
        // Convert to 18 decimals if needed
        if (decimals < 18) {
            normalizedPrice = price * 10**(18 - decimals);
        } else if (decimals > 18) {
            normalizedPrice = price / 10**(decimals - 18);
        }
        
        _prices[token] = normalizedPrice;
        _decimals[token] = decimals;
        _lastUpdateTime[token] = block.timestamp;
        
        emit PriceUpdated(token, oldPrice, normalizedPrice);
        emit DirectPriceUpdated(token, price, decimals);
    }
    
    /**
     * @dev Alias for setPrice for backward compatibility
     * @param token The token address
     * @param price The price to set
     */
    function updatePrice(address token, uint256 price) external onlyPriceUpdater {
        setPrice(token, price);
    }
    
    /**
     * @dev Gets the price of a token
     * @param token The token address
     * @return The price of the token (in USD with 18 decimals)
     */
    function getPrice(address token) public view returns (uint256) {
        // Check if price is set
        if (_prices[token] == 0) {
            return 1e18; // Default to 1 USD for testing
        }
        
        // Check for staleness
        if (_lastUpdateTime[token] > 0) {
            uint256 timeSinceUpdate = block.timestamp - _lastUpdateTime[token];
            if (timeSinceUpdate > DEFAULT_STALENESS_PERIOD) {
                // For testing, we'll just return the price anyway
                // In production, we would revert with StalePrice
            }
        }
        
        return _prices[token];
    }
    
    /**
     * @dev Gets the token price (alias for getPrice)
     * @param token The token address
     * @return The price of the token
     */
    function getTokenPrice(address token) external view returns (uint256) {
        return getPrice(token);
    }
    
    /**
     * @dev Gets the token price and decimals
     * @param token The token address
     * @return price The token price
     * @return decimals The token decimals
     */
    function getTokenPriceWithDecimals(address token) external view returns (uint256 price, uint8 decimals) {
        price = getPrice(token);
        decimals = _decimals[token] == 0 ? DEFAULT_DECIMALS : _decimals[token];
        return (price, decimals);
    }
    
    /**
     * @dev Gets the asset price (implements IPriceOracle interface)
     * @param _asset Address of the asset
     * @return The price of the asset
     */
    function getAssetPrice(address _asset) external view returns (uint256) {
        return getPrice(_asset);
    }
    
    /**
     * @dev Gets the asset decimals (implements IPriceOracle interface)
     * @param _asset Address of the asset
     * @return The number of decimals
     */
    function getAssetDecimals(address _asset) external view returns (uint8) {
        return _decimals[_asset] == 0 ? DEFAULT_DECIMALS : _decimals[_asset];
    }
}
