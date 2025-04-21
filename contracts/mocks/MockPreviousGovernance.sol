// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockPreviousGovernance
 * @dev Mock implementation of a previous version of the Governance contract
 * Used for backward compatibility testing
 */
contract MockPreviousGovernance {
    event NodeStateUpdated(address nodeAddress, uint8 state);
    event BatchNodeStateUpdated(address[] nodeAddresses, uint8[] states);
    
    /**
     * @dev Update a node's state
     * This simulates the legacy version of the function
     */
    function updateNodeState(address registry, address nodeAddress, uint8 state) external {
        // Call through to the registry with a type conversion
        (bool success,) = registry.call(
            abi.encodeWithSignature("updateNodeState(address,uint8)", nodeAddress, state)
        );
        require(success, "Call to registry failed");
        
        emit NodeStateUpdated(nodeAddress, state);
    }
    
    /**
     * @dev Update multiple nodes' states
     * This is a batch function that wasn't in original contract but added later
     */
    function batchUpdateNodeState(address registry, address[] calldata nodeAddresses, uint8[] calldata states) external {
        require(nodeAddresses.length == states.length, "Array length mismatch");
        
        for (uint256 i = 0; i < nodeAddresses.length; i++) {
            (bool success,) = registry.call(
                abi.encodeWithSignature("updateNodeState(address,uint8)", nodeAddresses[i], states[i])
            );
            require(success, "Call to registry failed");
        }
        
        emit BatchNodeStateUpdated(nodeAddresses, states);
    }
}