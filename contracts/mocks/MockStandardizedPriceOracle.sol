// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../utils/Errors.sol";

/**
 * @title MockStandardizedPriceOracle
 * @dev Standardized mock implementation of the price oracle for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockStandardizedPriceOracle is BaseMock {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");

    // Token address => USD price (scaled by 1e18)
    mapping(address => uint256) private tokenPrices;
    
    // Token address => last update timestamp
    mapping(address => uint256) private lastUpdateTime;

    // Events
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event OracleAdminChanged(address indexed newAdmin);
    event PriceUpdaterAdded(address indexed updater);
    event PriceUpdaterRemoved(address indexed updater);

    /**
     * @dev Constructor sets up roles and initializes the mock
     */
    constructor() BaseMock() {
        _grantRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
    }

    /**
     * @dev Update price for a token
     * @param token Token address
     * @param price Price in USD, scaled by 1e18
     */
    function updatePrice(
        address token,
        uint256 price
    ) external onlyRole(PRICE_UPDATER_ROLE) {
        _recordFunctionCall(
            "updatePrice",
            abi.encode(token, price)
        );
        
        tokenPrices[token] = price;
        lastUpdateTime[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }

    /**
     * @dev Get the price of a token
     * @param token Token address
     * @return price Price in USD, scaled by 1e18
     * @return timestamp Last update timestamp
     */
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp) {
        require(tokenPrices[token] > 0, "Price not set");
        return (tokenPrices[token], lastUpdateTime[token]);
    }

    /**
     * @dev Check if a price exists for a token
     * @param token Token address
     * @return exists Whether a price exists
     */
    function priceExists(address token) external view returns (bool) {
        return tokenPrices[token] > 0;
    }

    /**
     * @dev Add a price updater
     * @param updater Address of the updater
     */
    function addPriceUpdater(address updater) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "addPriceUpdater",
            abi.encode(updater)
        );
        
        _grantRole(PRICE_UPDATER_ROLE, updater);
        emit PriceUpdaterAdded(updater);
    }

    /**
     * @dev Remove a price updater
     * @param updater Address of the updater
     */
    function removePriceUpdater(address updater) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "removePriceUpdater",
            abi.encode(updater)
        );
        
        _revokeRole(PRICE_UPDATER_ROLE, updater);
        emit PriceUpdaterRemoved(updater);
    }

    /**
     * @dev Change the admin
     * @param newAdmin Address of the new admin
     */
    function changeAdmin(address newAdmin) external onlyRole(ORACLE_ADMIN_ROLE) {
        _recordFunctionCall(
            "changeAdmin",
            abi.encode(newAdmin)
        );
        
        _revokeRole(ORACLE_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ADMIN_ROLE, newAdmin);
        emit OracleAdminChanged(newAdmin);
    }

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view override(AccessControl) returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Grant a role to an account
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        _roles[role][account] = true;
    }

    /**
     * @dev Revoke a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function _revokeRole(bytes32 role, address account) internal override returns (bool) {
        _roles[role][account] = false;
    }



    // Role management mapping (internal)
    mapping(bytes32 => mapping(address => bool)) private _roles;
}
