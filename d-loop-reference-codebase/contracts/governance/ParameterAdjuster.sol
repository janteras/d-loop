// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ParameterAdjuster
 * @dev Executes parameter adjustments to various contracts via ProtocolDAO
 */
contract ParameterAdjuster is Ownable {
    // Target contract address
    address public immutable targetContract;
    
    // Function signature and parameters
    bytes public callData;
    string public functionSignature;
    string public parameterDescription;
    
    // Events
    event CallDataSet(bytes callData, string functionSignature, string parameterDescription);
    event AdjustmentExecuted(address indexed target, bytes callData);
    
    /**
     * @dev Constructor
     * @param _targetContract Address of the target contract
     * @param _owner Address of the owner (typically ProtocolDAO)
     */
    constructor(address _targetContract, address _owner) {
        require(_targetContract != address(0), "Invalid target address");
        targetContract = _targetContract;
        _transferOwnership(_owner);
    }
    
    /**
     * @dev Sets the call data for parameter adjustment
     * @param _callData Encoded function call data
     * @param _functionSignature Human-readable function signature (for documentation)
     * @param _parameterDescription Description of the parameter change
     */
    function setCallData(
        bytes memory _callData,
        string memory _functionSignature,
        string memory _parameterDescription
    ) external onlyOwner {
        require(_callData.length >= 4, "Invalid call data");
        
        callData = _callData;
        functionSignature = _functionSignature;
        parameterDescription = _parameterDescription;
        
        emit CallDataSet(_callData, _functionSignature, _parameterDescription);
    }
    
    /**
     * @dev Executes the parameter adjustment
     * This function is called by the ProtocolDAO when the proposal passes
     */
    function execute() external onlyOwner {
        require(callData.length >= 4, "Call data not set");
        
        // Execute the call
        (bool success, ) = targetContract.call(callData);
        require(success, "Parameter adjustment failed");
        
        emit AdjustmentExecuted(targetContract, callData);
        
        // Clear call data after execution
        delete callData;
        delete functionSignature;
        delete parameterDescription;
    }
}