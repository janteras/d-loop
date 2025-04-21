# DLOOP Upgrade Strategy

## Overview

This document outlines the comprehensive upgrade strategy for the DLOOP smart contract system. Building on the Diamond Storage pattern analysis and testing conducted in Phase 1, this strategy provides a detailed approach to safely implementing upgrades in Phase 2 and beyond.

## Upgrade Safety Principles

The DLOOP system implements the Diamond pattern (EIP-2535), which provides a robust framework for upgradeable contracts. To ensure upgrade safety, the following core principles will be followed:

1. **Storage Preservation**: All upgrades must maintain compatibility with existing storage layouts
2. **Function Selector Uniqueness**: New functions must not collide with existing selectors
3. **Access Control**: Upgrades must be governed by proper authorization mechanisms
4. **Timelock Protection**: Upgrade execution should include appropriate timelocks
5. **Backward Compatibility**: Existing functionality must be preserved or gracefully deprecated

## Upgrade Mechanisms

### Diamond Cut Operation

The Diamond pattern uses the `diamondCut` function to add, replace, or remove facets:

```solidity
struct FacetCut {
    address facetAddress;
    uint8 action; // 0 = add, 1 = replace, 2 = remove
    bytes4[] functionSelectors;
}

function diamondCut(
    FacetCut[] calldata _diamondCut,
    address _init,
    bytes calldata _calldata
) external;
```

The DLOOP upgrade process will use the following approach:

1. **Add Facet**: Deploy new facet contract with new functionality
2. **Replace Facet**: Deploy new facet contract with improved versions of existing functions
3. **Remove Facet**: Remove deprecated functionality that is no longer needed

### Upgrade Governance

All upgrades will be governed through the ProtocolDAO with the following process:

1. **Proposal Submission**: An upgrade proposal containing the diamond cut operation is submitted
2. **Review Period**: The community reviews the proposed changes (7 days for human proposals, 1 day for AI proposals)
3. **Voting**: Token holders vote on the proposal
4. **Execution Timelock**: After approval, a 24-hour timelock period before execution
5. **Execution**: The upgrade is executed via a specialized UpgradeExecuter contract

## Upgrade Executor Contract

To enhance security, upgrades will be executed through a specialized UpgradeExecuter contract:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract UpgradeExecuter {
    address public immutable protocolDAO;
    address public immutable diamondProxy;
    
    constructor(address _protocolDAO, address _diamondProxy) {
        protocolDAO = _protocolDAO;
        diamondProxy = _diamondProxy;
    }
    
    modifier onlyProtocolDAO() {
        require(msg.sender == protocolDAO, "Only ProtocolDAO can execute");
        _;
    }
    
    function execute(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external onlyProtocolDAO {
        IDiamondCut(diamondProxy).diamondCut(_diamondCut, _init, _calldata);
    }
}

interface IDiamondCut {
    struct FacetCut {
        address facetAddress;
        uint8 action;
        bytes4[] functionSelectors;
    }
    
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external;
}
```

This contract ensures that:
1. Only the ProtocolDAO can trigger upgrades
2. The upgrade parameters are pre-approved by governance
3. The execution follows the approved specification

## Storage Extension Strategy

When extending storage structures, the following approach will be used:

1. **Append-Only Extensions**: New variables are added at the end of existing structures
2. **No Reordering**: Existing variables maintain their positions in the storage layout
3. **Namespace Preservation**: Continue using the same namespace string for storage position calculation
4. **Test Thoroughly**: Verify storage integrity after extension

Example of safe storage extension:

```solidity
// Original Storage Structure
struct AssetDAOStorage {
    mapping(address => uint256) balances;
    uint256 totalSupply;
    string name;
    string symbol;
    mapping(address => mapping(address => uint256)) allowances;
}

// Extended Storage Structure (Safe)
struct AssetDAOStorage {
    mapping(address => uint256) balances;
    uint256 totalSupply;
    string name;
    string symbol;
    mapping(address => mapping(address => uint256)) allowances;
    
    // New variables added at the end
    uint256 investFee;
    uint256 divestFee;
    uint256 ragequitFee;
}
```

## Function Selector Management

To prevent function selector collisions:

1. **Pre-Deployment Check**: Before deploying new facets, verify no selector collisions with existing functions
2. **Function Name Conventions**: Use clear naming conventions to minimize accidental collisions
3. **Explicit Interface Definitions**: Define interfaces for all facets to document available functions
4. **Selector Registry**: Maintain a registry of all function selectors in the system

Example selector collision test:

```javascript
it("should not have function selector collisions", async function() {
    const selectors = {};
    const facets = await diamond.facets();
    
    for (const facet of facets) {
        for (const selector of facet.selectors) {
            expect(selectors[selector]).to.be.undefined;
            selectors[selector] = facet.facetAddress;
        }
    }
});
```

## Upgrade Testing Strategy

All upgrades will undergo rigorous testing:

### Pre-Upgrade Tests

1. **Storage Safety Test**: Verify that the upgrade maintains existing storage
2. **Function Selector Test**: Check for potential function selector collisions
3. **Interface Compatibility Test**: Verify backward compatibility of interfaces
4. **Access Control Test**: Validate that access controls are properly enforced
5. **Gas Analysis**: Measure the gas impact of the upgrade

### Upgrade Simulation Tests

1. **Diamond Cut Simulation**: Test the diamond cut operation on a test network
2. **State Transition Test**: Verify state before and after the upgrade
3. **Revert Scenario Test**: Validate behavior when upgrades fail
4. **Timelock Enforcement Test**: Verify timelock mechanisms work as expected

### Post-Upgrade Tests

1. **Functionality Verification**: Verify all functions work as expected after upgrade
2. **State Validation**: Confirm storage state integrity
3. **Event Emission Test**: Verify events are emitted correctly
4. **Integration Test**: Test interactions with other contracts

## Upgrade Types and Procedures

### 1. Feature Addition

Adding new features without modifying existing functionality:

1. Deploy new facet with the new functions
2. Prepare diamond cut with "Add" action
3. Submit proposal to ProtocolDAO
4. Execute upgrade after approval and timelock

### 2. Feature Modification

Replacing existing functions with improved versions:

1. Deploy new facet with the updated functions
2. Prepare diamond cut with "Replace" action
3. Submit proposal to ProtocolDAO
4. Execute upgrade after approval and timelock

### 3. Feature Removal

Removing deprecated functionality:

1. Prepare diamond cut with "Remove" action
2. Submit proposal to ProtocolDAO
3. Execute upgrade after approval and timelock

### 4. Emergency Upgrades

For critical security fixes:

1. Use emergency governance channel with shorter timeframes
2. Deploy fix with minimum scope to address vulnerability
3. Perform full audit and test cycle
4. Execute through emergency upgrade procedure

## Initialization on Upgrades

When an upgrade requires initialization:

1. **Init Function**: Deploy an initialization contract with the required setup logic
2. **One-Time Execution**: Ensure initialization can only be called once per upgrade
3. **State Verification**: Verify state after initialization

```solidity
// Example initialization contract
contract InitializedUpgrade {
    function initialize(address diamond) external {
        // Perform one-time initialization
        IAssetDAO(diamond).initializeNewFeature(parameters);
    }
}
```

## Upgrade Risk Mitigation

To mitigate risks during upgrades:

1. **Circuit Breakers**: Implement pause mechanisms that can be triggered in case of issues
2. **Gradual Rollout**: For complex upgrades, consider phased rollout strategies
3. **Fallback Mechanisms**: Design systems to fail gracefully if upgrades encounter issues
4. **Monitoring**: Implement on-chain monitoring to detect anomalies after upgrades
5. **Revert Plans**: Prepare plans to revert upgrades if unexpected issues arise

## Fee Implementation Upgrade Plan

The specific plan for implementing fees in Phase 2:

1. **Storage Extension**:
   - Deploy new facet with fee-related functions
   - Extend AssetDAOStorage with fee variables (investFee, divestFee, ragequitFee)

2. **Function Implementation**:
   - Implement fee calculation functions
   - Modify investment/divestment/ragequit functions to include fees
   - Add fee management functions (setFees, getFees)

3. **Governance Integration**:
   - Implement fee adjustment governance mechanisms
   - Add epoch-based fee change limitations
   - Introduce fee collector management

4. **Upgrade Execution**:
   - Submit upgrade proposal to ProtocolDAO
   - Pass vote with required quorum (30% for human proposal, 40% for AI)
   - Wait for 24-hour timelock
   - Execute upgrade via UpgradeExecuter

## Hedera Integration Upgrade Plan

The specific plan for implementing Hedera support in Phase 2:

1. **Cross-Platform Abstraction**:
   - Create platform-agnostic interfaces
   - Implement Hedera-specific adapters

2. **Token Service Integration**:
   - Add support for Hedera Token Service
   - Implement cross-platform token transfer mechanisms

3. **Dual Deployment Strategy**:
   - Deploy contracts on both Ethereum Sepolia and Hedera Testnet
   - Implement bridge mechanisms for cross-platform communication

4. **Upgrade Execution**:
   - Follow standard upgrade procedure with thorough testing on both platforms

## Documentation and Auditing

For all upgrades:

1. **Pre-Upgrade Documentation**:
   - Detailed specification of changes
   - Technical impact analysis
   - Testing approach

2. **Independent Audit**:
   - Third-party audit of all code changes
   - Verification of storage compatibility
   - Security assessment

3. **Post-Upgrade Verification**:
   - Confirmation that the upgrade was executed correctly
   - Validation that all functions work as expected
   - Monitoring report for any anomalies

## Conclusion

This upgrade strategy provides a comprehensive approach to safely implementing upgrades to the DLOOP smart contract system. By following these guidelines, we can ensure that all upgrades maintain the integrity of the system while allowing for the addition of new features and improvements.

The Phase 2 implementation will focus on adding fee structures, and Hedera integration, following the principles and procedures outlined in this document to ensure a smooth and secure upgrade process.