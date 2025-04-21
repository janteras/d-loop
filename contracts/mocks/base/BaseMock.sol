// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BaseMock
 * @dev Base contract for all mock implementations in the DLOOP protocol
 * @notice Provides standard functionality for tracking mock usage and behavior
 */
abstract contract BaseMock is AccessControl {
    // Standard mock state tracking
    bool public initialized;
    address public lastCaller;
    uint256 public callCount;
    
    // Function call tracking
    mapping(string => uint256) public functionCallCount;
    mapping(string => bytes) public lastCallData;
    mapping(string => address) public lastCallerByFunction;
    
    // Events
    event MockInitialized(address indexed caller);
    event MockFunctionCalled(
        string indexed functionName,
        address indexed caller,
        bytes data
    );
    event MockStateReset();
    
    /**
     * @dev Constructor grants DEFAULT_ADMIN_ROLE to deployer
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Initialize the mock contract
     */
    function initialize() external virtual {
        require(!initialized, "BaseMock: already initialized");
        initialized = true;
        emit MockInitialized(msg.sender);
    }
    
    /**
     * @dev Reset mock state for testing
     */
    function reset() external onlyRole(DEFAULT_ADMIN_ROLE) {
        initialized = false;
        lastCaller = address(0);
        callCount = 0;
        emit MockStateReset();
    }
    
    /**
     * @dev Record a function call with data
     * @param functionName Name of the function called
     * @param data Call data
     */
    function _recordFunctionCall(string memory functionName, bytes memory data) internal virtual {
        functionCallCount[functionName]++;
        lastCallData[functionName] = data;
        lastCallerByFunction[functionName] = msg.sender;
        lastCaller = msg.sender;
        callCount++;
        
        emit MockFunctionCalled(functionName, msg.sender, data);
    }
    
    /**
     * @dev Get call history for a function
     * @param functionName Name of the function
     * @return count Number of calls
     * @return lastCaller_ Last caller address
     * @return lastData Last call data
     */
    function getFunctionCallHistory(string memory functionName) 
        external 
        view 
        returns (
            uint256 count,
            address lastCaller_,
            bytes memory lastData
        )
    {
        return (
            functionCallCount[functionName],
            lastCallerByFunction[functionName],
            lastCallData[functionName]
        );
    }
    
    /**
     * @dev Check if a function was called
     * @param functionName Name of the function
     * @return wasCalled True if the function was called
     */
    function wasFunctionCalled(string memory functionName) 
        external 
        view 
        returns (bool) 
    {
        return functionCallCount[functionName] > 0;
    }
    
    /**
     * @dev Get the number of times a function was called
     * @param functionName Name of the function
     * @return count Number of calls
     */
    function getFunctionCallCount(string memory functionName)
        external
        view
        returns (uint256)
    {
        return functionCallCount[functionName];
    }
}
