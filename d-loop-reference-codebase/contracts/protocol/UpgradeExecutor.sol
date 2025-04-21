// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title UpgradeExecutor
 * @dev Contract responsible for executing upgrades of protocol contracts
 * Part of the Protocol DAO system
 */
contract UpgradeExecutor is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Delay before an upgrade can be executed
    uint256 public upgradeDelay;
    
    // Mapping of pending upgrades
    mapping(address => PendingUpgrade) public pendingUpgrades;
    
    // Upgrade struct
    struct PendingUpgrade {
        address implementation;
        uint256 timestamp;
    }
    
    // Events
    event UpgradeScheduled(address indexed proxy, address indexed implementation, uint256 timestamp);
    event UpgradeExecuted(address indexed proxy, address indexed implementation);
    event UpgradeCancelled(address indexed proxy);
    event UpgradeDelayUpdated(uint256 newDelay);
    
    /**
     * @dev Constructor disabled
     */
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the contract
     * @param admin Admin address
     * @param initialDelay Initial upgrade delay in seconds
     */
    function initialize(address admin, uint256 initialDelay) external initializer {
        require(admin != address(0), "UpgradeExecutor: admin is zero address");
        
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        upgradeDelay = initialDelay;
    }
    
    /**
     * @dev Schedules an upgrade for a proxy contract
     * @param proxy Proxy contract address
     * @param implementation New implementation address
     */
    function scheduleUpgrade(address proxy, address implementation) external onlyRole(UPGRADER_ROLE) {
        require(proxy != address(0), "UpgradeExecutor: proxy is zero address");
        require(implementation != address(0), "UpgradeExecutor: implementation is zero address");
        
        pendingUpgrades[proxy] = PendingUpgrade({
            implementation: implementation,
            timestamp: block.timestamp
        });
        
        emit UpgradeScheduled(proxy, implementation, block.timestamp);
    }
    
    /**
     * @dev Executes a scheduled upgrade
     * @param proxy Proxy contract address
     */
    function executeUpgrade(address proxy) external onlyRole(UPGRADER_ROLE) {
        require(proxy != address(0), "UpgradeExecutor: proxy is zero address");
        require(pendingUpgrades[proxy].implementation != address(0), "UpgradeExecutor: no pending upgrade");
        require(block.timestamp >= pendingUpgrades[proxy].timestamp + upgradeDelay, "UpgradeExecutor: delay not elapsed");
        
        address implementation = pendingUpgrades[proxy].implementation;
        
        // Clear the pending upgrade
        delete pendingUpgrades[proxy];
        
        // Execute the upgrade through the UUPSUpgradeable interface
        UUPSUpgradeable(proxy).upgradeTo(implementation);
        
        emit UpgradeExecuted(proxy, implementation);
    }
    
    /**
     * @dev Cancels a scheduled upgrade
     * @param proxy Proxy contract address
     */
    function cancelUpgrade(address proxy) external onlyRole(UPGRADER_ROLE) {
        require(proxy != address(0), "UpgradeExecutor: proxy is zero address");
        require(pendingUpgrades[proxy].implementation != address(0), "UpgradeExecutor: no pending upgrade");
        
        delete pendingUpgrades[proxy];
        
        emit UpgradeCancelled(proxy);
    }
    
    /**
     * @dev Updates the upgrade delay
     * @param newDelay New delay in seconds
     */
    function setUpgradeDelay(uint256 newDelay) external onlyRole(ADMIN_ROLE) {
        upgradeDelay = newDelay;
        
        emit UpgradeDelayUpdated(newDelay);
    }
    
    /**
     * @dev Function that authorizes an upgrade
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}