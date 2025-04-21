// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IUpgradeExecutor
 * @dev Interface for the upgrade executor contract
 */
interface IUpgradeExecutor {
    /**
     * @dev Emitted when an upgrade is prepared
     */
    event UpgradePrepared(address indexed proxyAddress, address indexed implementationAddress);
    
    /**
     * @dev Emitted when an upgrade is cancelled
     */
    event UpgradeCancelled(address indexed implementationAddress);
    
    /**
     * @dev Emitted when governance is transferred
     */
    event GovernanceTransferred(address indexed oldGovernance, address indexed newGovernance);
    
    /**
     * @dev Sets up an upgrade to be executed
     * @param proxyAddress The address of the proxy to upgrade
     * @param implementationAddress The address of the new implementation
     * @param initializerData The initializer data to call (if any)
     */
    function prepareUpgrade(
        address proxyAddress, 
        address implementationAddress, 
        bytes memory initializerData
    ) external;
    
    /**
     * @dev Executes the prepared upgrade
     * @return success Whether the upgrade was successful
     * @return message A message describing the result of the upgrade
     */
    function execute() external returns (bool success, string memory message);
    
    /**
     * @dev Cancels a prepared upgrade
     */
    function cancelUpgrade() external;
    
    /**
     * @dev Transfers governance to a new address
     * @param newGovernance The address of the new governance contract
     */
    function transferGovernance(address newGovernance) external;
}