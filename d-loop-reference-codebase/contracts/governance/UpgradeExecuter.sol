// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UpgradeExecuter
 * @dev Executes upgrades to proxy contracts via ProtocolDAO
 */
contract UpgradeExecuter is Ownable {
    // Target proxy address
    address public immutable proxyAddress;
    
    // New implementation address
    address public implementationAddress;
    
    // Optional initialization data
    bytes public initializationData;
    
    // Events
    event ImplementationSet(address indexed implementation, bytes initData);
    event UpgradeExecuted(address indexed proxy, address indexed implementation);
    
    /**
     * @dev Constructor
     * @param _proxyAddress Address of the proxy contract
     * @param _owner Address of the owner (typically ProtocolDAO)
     */
    constructor(address _proxyAddress, address _owner) {
        require(_proxyAddress != address(0), "Invalid proxy address");
        proxyAddress = _proxyAddress;
        _transferOwnership(_owner);
    }
    
    /**
     * @dev Sets the implementation to upgrade to
     * @param _implementationAddress Address of the new implementation
     * @param _initializationData Optional initialization data (empty for no initialization)
     */
    function setImplementation(
        address _implementationAddress, 
        bytes memory _initializationData
    ) external onlyOwner {
        require(_implementationAddress != address(0), "Invalid implementation address");
        
        implementationAddress = _implementationAddress;
        initializationData = _initializationData;
        
        emit ImplementationSet(_implementationAddress, _initializationData);
    }
    
    /**
     * @dev Executes the upgrade
     * This function is called by the ProtocolDAO when the proposal passes
     */
    function execute() external onlyOwner {
        require(implementationAddress != address(0), "Implementation not set");
        
        if (initializationData.length > 0) {
            // Upgrade with initialization
            ERC1967Upgrade.upgradeToAndCall(
                proxyAddress,
                implementationAddress,
                initializationData
            );
        } else {
            // Upgrade without initialization
            ERC1967Upgrade.upgradeTo(proxyAddress, implementationAddress);
        }
        
        emit UpgradeExecuted(proxyAddress, implementationAddress);
        
        // Clear implementation data after execution
        implementationAddress = address(0);
        delete initializationData;
    }
}