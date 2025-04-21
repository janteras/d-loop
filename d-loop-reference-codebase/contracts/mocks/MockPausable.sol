// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockPausable
 * @dev Mock implementation of a pausable contract
 */
contract MockPausable {
    bool public paused;
    
    event PauseToggled(bool paused);
    
    /**
     * @dev Toggle pause state
     * @param _paused New pause state
     */
    function toggleEmergencyPause(bool _paused) external {
        paused = _paused;
        
        emit PauseToggled(_paused);
    }
}