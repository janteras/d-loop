// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./IExecutor.sol";
import "../fees/FeeCalculator.sol";
import "../libraries/Errors.sol";

/**
 * @title FeeRecipientUpdater
 * @notice Executor contract for updating fee recipients through governance
 * @dev Implements IExecutor for use with ProtocolDAO
 */
contract FeeRecipientUpdater is IExecutor {
    // Fee calculator contract
    FeeCalculator public feeCalculator;
    
    // Protocol DAO
    address public dao;
    
    // Recipient configuration
    address public newTreasury;
    address public newRewardDistributor;
    
    // Status
    bool public pendingUpdate;
    
    // Events
    event RecipientConfigSet(
        address newTreasury,
        address newRewardDistributor
    );
    
    event FeeRecipientsUpdated(
        address newTreasury,
        address newRewardDistributor
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
     * @notice Sets the fee recipient configuration to be executed by the DAO
     * @param _newTreasury New treasury address
     * @param _newRewardDistributor New reward distributor address
     */
    function setRecipientConfig(
        address _newTreasury,
        address _newRewardDistributor
    ) 
        external 
    {
        if (msg.sender != dao) {
            revert Errors.AccessDenied();
        }
        
        if (_newTreasury == address(0) || _newRewardDistributor == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        newTreasury = _newTreasury;
        newRewardDistributor = _newRewardDistributor;
        
        pendingUpdate = true;
        
        emit RecipientConfigSet(
            newTreasury,
            newRewardDistributor
        );
    }
    
    /**
     * @notice Executes the recipient update
     * @dev Called by the ProtocolDAO after proposal approval
     */
    function execute() external override {
        if (msg.sender != dao) {
            revert Errors.AccessDenied();
        }
        
        if (!pendingUpdate) {
            revert Errors.NoPendingOperation();
        }
        
        feeCalculator.updateFeeRecipients(
            newTreasury,
            newRewardDistributor
        );
        
        pendingUpdate = false;
        
        emit FeeRecipientsUpdated(
            newTreasury,
            newRewardDistributor
        );
    }
    
    /**
     * @notice Gets the description of the pending operation
     * @return Description string
     */
    function getDescription() external view override returns (string memory) {
        if (!pendingUpdate) {
            return "No pending fee recipient update";
        }
        
        return string(abi.encodePacked(
            "Update fee recipients: Treasury=",
            _addressToString(newTreasury),
            ", RewardDistributor=",
            _addressToString(newRewardDistributor)
        ));
    }
    
    /**
     * @notice Helper function to convert address to string
     * @param _addr Address to convert
     * @return String representation
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes memory addressBytes = abi.encodePacked(_addr);
        bytes memory stringBytes = new bytes(42);
        
        stringBytes[0] = '0';
        stringBytes[1] = 'x';
        
        for (uint256 i = 0; i < 20; i++) {
            uint8 leftNibble = uint8(addressBytes[i]) >> 4;
            uint8 rightNibble = uint8(addressBytes[i]) & 0xf;
            
            stringBytes[2 + i * 2] = _getNibbleChar(leftNibble);
            stringBytes[2 + i * 2 + 1] = _getNibbleChar(rightNibble);
        }
        
        return string(stringBytes);
    }
    
    /**
     * @notice Helper function to convert a nibble to its hex char
     * @param _nibble Nibble to convert
     * @return Hex character
     */
    function _getNibbleChar(uint8 _nibble) internal pure returns (bytes1) {
        if (_nibble < 10) {
            return bytes1(uint8(48 + _nibble));
        } else {
            return bytes1(uint8(87 + _nibble)); // 87 = 97 - 10, where 97 is 'a'
        }
    }
}