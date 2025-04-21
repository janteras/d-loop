// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

/**
 * @title MockUpgradeable
 * @dev Mock implementation of an upgradeable contract
 */
contract MockUpgradeable {
    address public implementation;
    bytes public initializer;
    bool public upgraded;
    
    /**
     * @dev Mock function to simulate an upgrade
     * @param newImplementation The new implementation address
     */
    function upgradeTo(address newImplementation) external {
        implementation = newImplementation;
        upgraded = true;
        initializer = "";
    }
    
    /**
     * @dev Mock function to simulate an upgrade with initializer
     * @param newImplementation The new implementation address
     * @param data Initializer data
     */
    function upgradeToAndCall(address newImplementation, bytes calldata data) external {
        implementation = newImplementation;
        initializer = data;
        upgraded = true;
    }
}