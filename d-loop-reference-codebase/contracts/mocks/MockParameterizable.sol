// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockParameterizable
 * @dev Mock implementation of a contract with adjustable parameters
 */
contract MockParameterizable {
    uint256 public param1;
    uint256 public param2;
    uint256 public param3;
    
    event ParametersUpdated(uint256 param1, uint256 param2, uint256 param3);
    
    /**
     * @dev Set parameters
     * @param _param1 First parameter
     * @param _param2 Second parameter
     * @param _param3 Third parameter
     */
    function setParameters(uint256 _param1, uint256 _param2, uint256 _param3) external {
        param1 = _param1;
        param2 = _param2;
        param3 = _param3;
        
        emit ParametersUpdated(_param1, _param2, _param3);
    }
}