// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

/**
 * @title MockImplementation
 * @dev Mock contract used for testing contract upgrades
 */
contract MockImplementation is Initializable {
    uint256 public value;
    address public owner;
    
    /**
     * @dev Initializes the contract
     */
    function initialize() external initializer {
        owner = msg.sender;
    }
    
    /**
     * @dev Sets the value
     * @param _value New value
     */
    function setValue(uint256 _value) external {
        value = _value;
    }
    
    /**
     * @dev Gets the value
     * @return _value Current value
     */
    function getValue() external view returns (uint256 _value) {
        return value;
    }
    
    /**
     * @dev Upgrade-specific function to test successful upgrades
     * @return version Contract version
     */
    function getVersion() external pure returns (string memory version) {
        return "v2.0.0";
    }
}