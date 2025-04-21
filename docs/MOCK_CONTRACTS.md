# Mock Contract Standards

## Overview

This document outlines the standards and best practices for mock contracts in the D-Loop Protocol. Mock contracts are essential for testing and should follow a consistent pattern to ensure maintainability and reliability.

## Standards

All mock contracts in the D-Loop Protocol must adhere to the following standards:

1. **Naming Convention**: All mock contracts must be prefixed with "Mock" (e.g., `MockTreasury`, `MockPriceOracle`).

2. **Location**: All mock contracts must be located in the `/contracts/mocks/` directory. No mock contracts should be present in the `/test/mocks/` directory or any other directory.

3. **Base Mock Extension**: All mock contracts must extend the `BaseMock` contract, which provides common functionality for tracking function calls.

3. **Function Call Tracking**: All mock functions must track their calls using the `_recordFunctionCall` method provided by `BaseMock`.

4. **Constructor Initialization**: All mock contracts must call the `BaseMock` constructor in their own constructor.

5. **Import Statement**: All mock contracts must import the `BaseMock` contract using the statement: `import "./base/BaseMock.sol";`

## BaseMock Contract

The `BaseMock` contract provides the following functionality:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BaseMock
 * @dev Base contract for all mock contracts in the D-Loop Protocol
 * @notice Provides function call tracking functionality
 */
contract BaseMock is AccessControl {
    // Function call tracking
    struct FunctionCall {
        string functionName;
        bytes arguments;
        uint256 timestamp;
    }
    
    FunctionCall[] private _functionCalls;
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Records a function call for testing purposes
     * @param functionName Name of the function being called
     * @param arguments Encoded arguments of the function call
     */
    function _recordFunctionCall(
        string memory functionName,
        bytes memory arguments
    ) internal {
        _functionCalls.push(
            FunctionCall({
                functionName: functionName,
                arguments: arguments,
                timestamp: block.timestamp
            })
        );
    }
    
    /**
     * @dev Gets the number of function calls recorded
     * @return count Number of function calls
     */
    function getFunctionCallCount() external view returns (uint256) {
        return _functionCalls.length;
    }
    
    /**
     * @dev Gets a specific function call by index
     * @param index Index of the function call
     * @return functionName Name of the function
     * @return arguments Encoded arguments
     * @return timestamp Timestamp of the call
     */
    function getFunctionCall(uint256 index) external view returns (
        string memory functionName,
        bytes memory arguments,
        uint256 timestamp
    ) {
        require(index < _functionCalls.length, "Index out of bounds");
        FunctionCall storage call = _functionCalls[index];
        return (call.functionName, call.arguments, call.timestamp);
    }
    
    /**
     * @dev Checks if a function was called with specific arguments
     * @param functionName Name of the function to check
     * @param arguments Encoded arguments to match
     * @return wasCalled True if the function was called with the specified arguments
     */
    function wasFunctionCalledWithArgs(
        string memory functionName,
        bytes memory arguments
    ) external view returns (bool) {
        for (uint256 i = 0; i < _functionCalls.length; i++) {
            FunctionCall storage call = _functionCalls[i];
            if (
                keccak256(bytes(call.functionName)) == keccak256(bytes(functionName)) &&
                keccak256(call.arguments) == keccak256(arguments)
            ) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Checks if a function was called
     * @param functionName Name of the function to check
     * @return wasCalled True if the function was called
     */
    function wasFunctionCalled(string memory functionName) external view returns (bool) {
        for (uint256 i = 0; i < _functionCalls.length; i++) {
            if (keccak256(bytes(_functionCalls[i].functionName)) == keccak256(bytes(functionName))) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Clears all recorded function calls
     */
    function clearFunctionCalls() external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete _functionCalls;
    }
}
```

## Example Mock Contract

Here's an example of a properly standardized mock contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";

/**
 * @title MockPriceOracle
 * @dev Mock implementation of a price oracle for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockPriceOracle is BaseMock {
    mapping(address => uint256) private tokenPrices;
    
    constructor() BaseMock() {}
    
    function updatePrice(address token, uint256 price) external {
        _recordFunctionCall(
            "updatePrice",
            abi.encode(token, price)
        );
        
        tokenPrices[token] = price;
    }
    
    function getPrice(address token) external view returns (uint256) {
        _recordFunctionCall(
            "getPrice",
            abi.encode(token)
        );
        
        return tokenPrices[token];
    }
}
```

## Mock Contract Implementation Status

The following table shows all mock contracts in the D-Loop Protocol and their implementation status:

| Mock Contract | Interface | Status | Description |
|---------------|-----------|--------|-------------|
| MockAINodeGovernance | IAINodeGovernance | ✅ Complete | Mock implementation of AINodeGovernance |
| MockAssetDAO | IAssetDAO | ✅ Complete | Mock implementation of AssetDAO |
| MockERC20 | IERC20 | ✅ Complete | Mock implementation of ERC20 token |
| MockFeeCalculator | IFeeCalculator | ✅ Complete | Mock implementation of FeeCalculator |
| MockFeeProcessor | IFeeProcessor | ✅ Complete | Mock implementation of FeeProcessor |
| MockGovernanceRewards | IGovernanceRewards | ✅ Complete | Mock implementation of GovernanceRewards |
| MockPriceOracle | IPriceOracle | ✅ Complete | Mock implementation of PriceOracle |
| MockProtocolDAO | IProtocolDAO | ✅ Complete | Mock implementation of ProtocolDAO |
| MockSimplifiedAdminControls | ISimplifiedAdminControls | ✅ Complete | Mock implementation of SimplifiedAdminControls |
| MockTokenApprovalOptimizer | ITokenApprovalOptimizer | ✅ Complete | Mock implementation of TokenApprovalOptimizer |
| MockTreasury | ITreasury | ✅ Complete | Mock implementation of Treasury |
| MockAggregatorV3 | N/A | ⚠️ No Interface | Mock implementation of AggregatorV3 price feed |
| MockAllowanceChecker | N/A | ⚠️ No Interface | Mock implementation for checking token allowances |
| MockAssetDAOTest | N/A | ⚠️ No Interface | Extended mock for AssetDAO testing |
| MockDAIToken | N/A | ⚠️ No Interface | Mock implementation of DAI token |
| MockGovernanceToken | N/A | ⚠️ No Interface | Mock implementation of governance token |
| MockProposalSystem | N/A | ⚠️ No Interface | Mock implementation of proposal system |
| MockReentrancyAttacker | N/A | ⚠️ No Interface | Mock contract for testing reentrancy protection |

## Validation

The D-Loop Protocol includes a validation script to ensure all mock contracts follow these standards. You can run the validation script using:

```bash
node scripts/validate-mock-implementations.js
```

The script checks each mock contract against the following rules:

1. Contract name is prefixed with "Mock"
2. Contract extends BaseMock
3. Contract imports BaseMock
4. Contract records function calls using _recordFunctionCall
5. Contract has a constructor that calls BaseMock constructor

## Integration with CI Pipeline

The mock validation script is integrated into the CI pipeline to ensure all mock contracts adhere to the standards. This helps maintain code quality and consistency throughout the development process.

## Best Practices

1. **Mimic Real Behavior**: Mock contracts should mimic the behavior of the real contracts they're replacing, but with simplified logic.

2. **Event Emission**: Include event emissions in mock contracts to simulate the behavior of real contracts.

3. **Error Handling**: Implement the same error handling as the real contracts to ensure tests accurately reflect production behavior.

4. **State Tracking**: Use state variables to track changes made by function calls, allowing tests to verify the expected state changes.

5. **Configurable Behavior**: Add functions to configure the behavior of mock contracts during tests, such as setting return values or triggering specific errors.

## Conclusion

Following these standards ensures that mock contracts in the D-Loop Protocol are consistent, maintainable, and effective for testing. The standardized approach simplifies test development and improves the reliability of the test suite.
