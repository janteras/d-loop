// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EmergencyPauser
 * @dev Executes emergency pause/unpause on a target contract
 */
contract EmergencyPauser is Ownable {
    // Target contract address
    address public immutable targetContract;
    
    // Pause/unpause state
    bool public pauseState;
    string public reason;
    
    // Events
    event PauseStateSet(bool pauseState, string reason);
    event EmergencyActionExecuted(address indexed target, bool pauseState);
    
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
     * @dev Sets the pause state to be executed
     * @param _pauseState True to pause, false to unpause
     * @param _reason Reason for the pause/unpause
     */
    function setPauseState(bool _pauseState, string memory _reason) external onlyOwner {
        pauseState = _pauseState;
        reason = _reason;
        
        emit PauseStateSet(_pauseState, _reason);
    }
    
    /**
     * @dev Executes the emergency action
     * This function is called by the ProtocolDAO when the proposal passes
     */
    function execute() external onlyOwner {
        bytes memory callData;
        
        if (pauseState) {
            // Call pause()
            callData = abi.encodeWithSignature("pause()");
        } else {
            // Call unpause()
            callData = abi.encodeWithSignature("unpause()");
        }
        
        // Execute the call
        (bool success, ) = targetContract.call(callData);
        require(success, "Emergency action failed");
        
        emit EmergencyActionExecuted(targetContract, pauseState);
    }
}