// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IExecutor.sol";
import "../fees/FeeCalculator.sol";
import "../libraries/Errors.sol";

/**
 * @title FeeParameterAdjuster
 * @notice Executor contract for adjusting fee parameters through governance
 * @dev Implements IExecutor for use with ProtocolDAO
 */
contract FeeParameterAdjuster is IExecutor {
    // Fee calculator contract
    FeeCalculator public feeCalculator;
    
    // Protocol DAO
    address public dao;
    
    // Parameter configuration
    uint256 public investFeePercent;
    uint256 public divestFeePercent;
    uint256 public ragequitFeePercent;
    
    // Status
    bool public pendingAdjustment;
    
    // Events
    event ParameterConfigSet(
        uint256 investFeePercent,
        uint256 divestFeePercent,
        uint256 ragequitFeePercent
    );
    
    event FeeParametersAdjusted(
        uint256 investFeePercent,
        uint256 divestFeePercent,
        uint256 ragequitFeePercent
    );
    
    /**
     * @notice Constructor
     * @param _feeCalculator Address of the fee calculator contract
     * @param _dao Address of the ProtocolDAO contract
     */
    constructor(address _feeCalculator, address _dao) {
        if (_feeCalculator == address(0) || _dao == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        feeCalculator = FeeCalculator(_feeCalculator);
        dao = _dao;
    }
    
    /**
     * @notice Sets the fee parameter configuration to be executed by the DAO
     * @param _investFeePercent New investment fee percentage (in basis points)
     * @param _divestFeePercent New divestment fee percentage (in basis points)
     * @param _ragequitFeePercent New ragequit fee percentage (in basis points)
     */
    function setFeeParameterConfig(
        uint256 _investFeePercent,
        uint256 _divestFeePercent,
        uint256 _ragequitFeePercent
    ) 
        external 
    {
        if (msg.sender != dao) {
            revert Errors.AccessDenied();
        }
        
        // Check parameters are valid (below 30%)
        if (_investFeePercent > 3000 || _divestFeePercent > 3000 || _ragequitFeePercent > 3000) {
            revert Errors.InvalidParameters();
        }
        
        investFeePercent = _investFeePercent;
        divestFeePercent = _divestFeePercent;
        ragequitFeePercent = _ragequitFeePercent;
        
        pendingAdjustment = true;
        
        emit ParameterConfigSet(
            investFeePercent,
            divestFeePercent,
            ragequitFeePercent
        );
    }
    
    /**
     * @notice Executes the parameter adjustment
     * @dev Called by the ProtocolDAO after proposal approval
     */
    function execute() external override {
        if (msg.sender != dao) {
            revert Errors.AccessDenied();
        }
        
        if (!pendingAdjustment) {
            revert Errors.NoPendingOperation();
        }
        
        feeCalculator.updateFeePercentages(
            investFeePercent,
            divestFeePercent,
            ragequitFeePercent
        );
        
        pendingAdjustment = false;
        
        emit FeeParametersAdjusted(
            investFeePercent,
            divestFeePercent,
            ragequitFeePercent
        );
    }
    
    /**
     * @notice Gets the description of the pending operation
     * @return Description string
     */
    function getDescription() external view override returns (string memory) {
        if (!pendingAdjustment) {
            return "No pending fee parameter adjustment";
        }
        
        return string(abi.encodePacked(
            "Adjust fee parameters: Invest=",
            _uintToString(investFeePercent / 100), ".",
            _uintToString(investFeePercent % 100), "%, Divest=",
            _uintToString(divestFeePercent / 100), ".",
            _uintToString(divestFeePercent % 100), "%, Ragequit=",
            _uintToString(ragequitFeePercent / 100), ".",
            _uintToString(ragequitFeePercent % 100), "%"
        ));
    }
    
    /**
     * @notice Helper function to convert uint to string
     * @param _value Value to convert
     * @return String representation
     */
    function _uintToString(uint256 _value) internal pure returns (string memory) {
        if (_value == 0) {
            return "0";
        }
        
        uint256 temp = _value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        
        while (_value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(_value % 10)));
            _value /= 10;
        }
        
        return string(buffer);
    }
}