// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/DiamondStorage.sol";

/**
 * @title DiamondStorageTest
 * @dev Test contract for using DiamondStorage
 */
contract DiamondStorageTest {
    // Test function to add a fee event
    function addFeeEvent(
        address user,
        DiamondStorage.FeeOperationType operationType,
        uint256 amount,
        uint256 feeAmount
    ) external {
        DiamondStorage.FeeStorage storage fs = DiamondStorage.feeStorage();
        
        DiamondStorage.FeeEvent memory newEvent = DiamondStorage.FeeEvent({
            user: user,
            operationType: operationType,
            amount: amount,
            feeAmount: feeAmount,
            timestamp: block.timestamp
        });
        
        fs.feeHistory.push(newEvent);
    }
    
    // Test function to get fee history length
    function getFeeHistoryLength() external view returns (uint256) {
        DiamondStorage.FeeStorage storage fs = DiamondStorage.feeStorage();
        return fs.feeHistory.length;
    }
}