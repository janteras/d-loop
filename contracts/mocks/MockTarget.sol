// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";

/**
 * @title MockTarget
 * @dev Simple contract used as a target for proposal execution testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockTarget is BaseMock {
    uint256 public parameter;
    address public targetAddress;
    string public name;
    bool public flag;
    
    event ParameterUpdated(uint256 oldValue, uint256 newValue);
    event TargetAddressUpdated(address oldAddress, address newAddress);
    event NameUpdated(string oldName, string newName);
    event FlagToggled(bool oldValue, bool newValue);
    
    /**
     * @dev Set a numeric parameter
     *  The new parameter value
     */
    constructor() BaseMock() {}
    
    function setParameter(uint256 _value) external {
        _recordFunctionCall(
            "setParameter",
            abi.encode(_value)
        );
        uint256 oldValue = parameter;
        parameter = _value;
        emit ParameterUpdated(oldValue, _value);
    }
    
    /**
     * @dev Set an address parameter
     * @param _address The new address value
     */
    function setTargetAddress(address _address) external {
        _recordFunctionCall(
            "setTargetAddress",
            abi.encode(_address)
        );
        address oldAddress = targetAddress;
        targetAddress = _address;
        emit TargetAddressUpdated(oldAddress, _address);
    }
    
    /**
     * @dev Set a string parameter
     * @param _name The new name value
     */
    function setName(string calldata _name) external {
        _recordFunctionCall(
            "setName",
            abi.encode(_name)
        );
        string memory oldName = name;
        name = _name;
        emit NameUpdated(oldName, _name);
    }
    
    /**
     * @dev Toggle a boolean flag
     */
    function toggleFlag() external {
        _recordFunctionCall(
            "toggleFlag",
            abi.encode()
        );
        bool oldValue = flag;
        flag = !flag;
        emit FlagToggled(oldValue, flag);
    }
    
    /**
     * @dev Set multiple parameters in one call
     * @param _parameter Numeric parameter
     * @param _targetAddress Address parameter
     * @param _name String parameter
     * @param _flag Boolean parameter
     */
    function setAll(
        uint256 _parameter,
        address _targetAddress,
        string calldata _name,
        bool _flag
    ) external {
        _recordFunctionCall(
            "setAll",
            abi.encode(_parameter, _targetAddress, _name, _flag)
        );
        parameter = _parameter;
        targetAddress = _targetAddress;
        name = _name;
        flag = _flag;
    }
    
    /**
     * @dev Function that will revert - used to test failed proposal execution
     */
    function willRevert() external {
        _recordFunctionCall(
            "willRevert",
            abi.encode()
        );
        revert("Intentional revert");
    }
}