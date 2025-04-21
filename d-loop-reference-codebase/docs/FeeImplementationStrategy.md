# Fee Implementation Strategy

## Overview

This document outlines the detailed implementation strategy for the fee structure in Phase 2 of the DLOOP smart contract system. Based on the analysis conducted in Phase 1, this plan provides a comprehensive approach to implementing fees for investment, divestment, and ragequit operations.

## Diamond Storage Extension

### Current Storage Structure

```solidity
// In LibAssetDAOStorage.sol
struct AssetDAOStorage {
    // Current storage variables
    mapping(address => uint256) balances;
    uint256 totalSupply;
    string name;
    string symbol;
    mapping(address => mapping(address => uint256)) allowances;
    mapping(address => bool) operators;
    // ... other existing variables
}
```

### Proposed Extensions

```solidity
// In LibAssetDAOStorage.sol
struct AssetDAOStorage {
    // Existing variables preserved
    mapping(address => uint256) balances;
    uint256 totalSupply;
    string name;
    string symbol;
    mapping(address => mapping(address => uint256)) allowances;
    mapping(address => bool) operators;
    // ... other existing variables
    
    // Fee structure extension
    uint256 investFee;       // Investment fee in basis points (1/10000)
    uint256 divestFee;       // Divestment fee in basis points
    uint256 ragequitFee;     // Ragequit penalty fee in basis points
    address feeCollector;    // Address of the fee collector contract
    uint256 lastFeeUpdate;   // Timestamp of last fee update
    uint256 currentEpoch;    // Current epoch for governance restrictions
    
    // Fee governance limitations
    uint256 maxFeeChangePerEpoch;  // Maximum allowed fee change per epoch
    uint256 maxRagequitFee;        // Maximum allowed ragequit fee
    uint256 minInvestDivestFee;    // Minimum allowed investment/divestment fee
}
```

### Storage Extension Approach

1. **Add New Variables at End**: All new variables will be added at the end of the existing storage structure to preserve compatibility.
2. **Initialize with Default Values**:
   - `investFee`: 50 (0.5%)
   - `divestFee`: 50 (0.5%)
   - `ragequitFee`: 200 (2.0%)
   - `maxFeeChangePerEpoch`: 5 (0.05%)
   - `maxRagequitFee`: 300 (3.0%)
   - `minInvestDivestFee`: 10 (0.1%)
3. **Preserve Existing Storage**: No existing variables will be modified or reordered to ensure data integrity.

## Fee Calculation Functions

### Investment Fee Calculation

```solidity
function calculateInvestmentFee(uint256 amount) internal view returns (uint256) {
    return (amount * investFee) / 10000;
}

function calculateInvestmentWithFee(uint256 amount) 
    external 
    view 
    returns (uint256 fee, uint256 netAmount) 
{
    fee = calculateInvestmentFee(amount);
    netAmount = amount - fee;
    return (fee, netAmount);
}
```

### Divestment Fee Calculation

```solidity
function calculateDivestmentFee(uint256 amount) internal view returns (uint256) {
    return (amount * divestFee) / 10000;
}

function calculateDivestmentWithFee(uint256 amount) 
    external 
    view 
    returns (uint256 fee, uint256 netAmount) 
{
    fee = calculateDivestmentFee(amount);
    netAmount = amount - fee;
    return (fee, netAmount);
}
```

### Ragequit Fee Calculation

```solidity
function calculateRagequitFee(uint256 amount) internal view returns (uint256) {
    return (amount * ragequitFee) / 10000;
}

function calculateRagequitWithFee(uint256 amount) 
    external 
    view 
    returns (uint256 fee, uint256 netAmount) 
{
    fee = calculateRagequitFee(amount);
    netAmount = amount - fee;
    return (fee, netAmount);
}
```

## Fee Collection Mechanism

### FeeCollector Contract

A dedicated FeeCollector contract will be implemented with the following capabilities:

1. **Multi-token Support**: Ability to receive and manage fees in various token types
2. **Accounting System**: Track fee collection by source and operation type
3. **Governance Integration**: Support fee distribution according to governance parameters
4. **Access Controls**: Role-based permissions for administrative functions

```solidity
// FeeCollector.sol
contract FeeCollector {
    // Token collection tracking
    mapping(address => uint256) public collectedFees;
    mapping(string => uint256) public feesByOperation;
    
    // Events
    event FeeCollected(
        address indexed source,
        address indexed token,
        uint256 amount,
        string operationType
    );
    
    event FeeDistributed(
        address indexed recipient,
        address indexed token,
        uint256 amount
    );
    
    // Fee collection function
    function collectFee(
        address token,
        uint256 amount,
        string memory operationType
    ) 
        external 
        onlyAuthorized 
    {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        collectedFees[token] += amount;
        feesByOperation[operationType] += amount;
        
        emit FeeCollected(msg.sender, token, amount, operationType);
    }
    
    // Distribution functions and governance controls
    // ...
}
```

### Integration Points

#### Investment Flow

```solidity
// In AssetDAO.sol
function invest(uint256 amount) external {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    
    // Calculate fee
    uint256 fee = calculateInvestmentFee(amount);
    uint256 netAmount = amount - fee;
    
    // Transfer fee to collector
    IERC20 token = IERC20(investmentToken);
    token.transferFrom(msg.sender, ds.feeCollector, fee);
    
    // Notify fee collector
    IFeeCollector(ds.feeCollector).collectFee(
        address(token),
        fee,
        "investment"
    );
    
    // Transfer net amount to treasury
    token.transferFrom(msg.sender, treasury, netAmount);
    
    // Mint D-AI tokens
    uint256 daiAmount = calculateDAIAmount(netAmount);
    _mint(msg.sender, daiAmount);
    
    emit Investment(msg.sender, amount, fee, netAmount, daiAmount);
}
```

#### Divestment Flow

```solidity
// In AssetDAO.sol
function divest(uint256 daiAmount) external {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    
    // Calculate asset amount
    uint256 assetAmount = calculateAssetAmount(daiAmount);
    
    // Calculate fee
    uint256 fee = calculateDivestmentFee(assetAmount);
    uint256 netAmount = assetAmount - fee;
    
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Request asset transfer from Treasury
    ITreasury(treasury).releaseAssets(
        msg.sender,
        netAmount,
        ds.feeCollector,
        fee
    );
    
    emit Divestment(msg.sender, daiAmount, assetAmount, fee, netAmount);
}
```

#### Ragequit Flow

```solidity
// In AssetDAO.sol
function ragequit(uint256 daiAmount) external {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    
    // Calculate asset amount
    uint256 assetAmount = calculateAssetAmount(daiAmount);
    
    // Calculate penalty fee
    uint256 penaltyFee = calculateRagequitFee(assetAmount);
    uint256 netAmount = assetAmount - penaltyFee;
    
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Request emergency asset transfer from Treasury
    ITreasury(treasury).emergencyReleaseAssets(
        msg.sender,
        netAmount,
        ds.feeCollector,
        penaltyFee
    );
    
    emit Ragequit(msg.sender, daiAmount, assetAmount, penaltyFee, netAmount);
}
```

## Governance Controls

### Fee Adjustment Functions

```solidity
// In AssetDAO.sol
function setInvestFee(uint256 newFee) 
    external 
    onlyGovernance 
{
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    
    require(
        validateFeeChange(ds.investFee, newFee),
        "Fee change exceeds allowed limit per epoch"
    );
    require(
        newFee >= ds.minInvestDivestFee,
        "Fee below minimum allowed value"
    );
    
    ds.investFee = newFee;
    ds.lastFeeUpdate = block.timestamp;
    
    emit FeeUpdated("invest", newFee);
}

function setDivestFee(uint256 newFee) 
    external 
    onlyGovernance 
{
    // Similar implementation
}

function setRagequitFee(uint256 newFee) 
    external 
    onlyGovernance 
{
    // Similar implementation with additional check for maximum
}
```

### Fee Change Validation

```solidity
function validateFeeChange(uint256 currentFee, uint256 newFee) 
    internal 
    view 
    returns (bool) 
{
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    uint256 maxChange = ds.maxFeeChangePerEpoch;
    
    // Ensure fee change is within allowed limits for current epoch
    if (newFee > currentFee) {
        return newFee - currentFee <= maxChange;
    } else {
        return currentFee - newFee <= maxChange;
    }
}
```

### Epoch Management

```solidity
function advanceEpoch() 
    external 
    onlyGovernance 
{
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    
    // Epoch duration check (7 days minimum)
    require(
        block.timestamp >= ds.lastEpochAdvance + 7 days,
        "Minimum epoch duration not reached"
    );
    
    ds.currentEpoch++;
    ds.lastEpochAdvance = block.timestamp;
    
    emit EpochAdvanced(ds.currentEpoch);
}
```

## Implementation Sequence

1. **Storage Extensions**
   - Add fee storage variables to Diamond Storage
   - Initialize with default values

2. **FeeCollector Contract**
   - Implement and deploy FeeCollector contract
   - Set up proper access controls

3. **Calculation Functions**
   - Implement fee calculation functions
   - Add governance-controlled fee adjustment functions

4. **Token Flow Integration**
   - Modify investment/divestment/ragequit functions
   - Integrate fee collection into token transfers

5. **Governance Integration**
   - Add fee-related governance proposals
   - Implement epoch management

6. **Testing**
   - Test all fee calculations and flows
   - Verify governance controls and limitations

## Testing Strategy

### Unit Tests

1. **Fee Calculation Tests**
   - Test all fee calculation functions with various input amounts
   - Verify correct basis point calculations
   - Test boundary conditions (very small and very large amounts)

2. **Storage Extension Tests**
   - Verify existing storage values are preserved
   - Test storing and retrieving fee-related values
   - Verify proper initialization of new variables

3. **Access Control Tests**
   - Verify only governance can update fees
   - Test unauthorized access attempts
   - Verify proper access to fee collection functions

### Integration Tests

1. **Investment Flow Tests**
   - Test end-to-end investment with fee collection
   - Verify correct token transfers to all parties
   - Verify correct D-AI token minting

2. **Divestment Flow Tests**
   - Test end-to-end divestment with fee collection
   - Verify correct asset release from Treasury
   - Verify correct D-AI token burning

3. **Ragequit Flow Tests**
   - Test emergency exit with penalty fee
   - Verify higher fee collection during ragequit
   - Verify correct asset release and token burning

### Governance Tests

1. **Fee Adjustment Tests**
   - Test fee adjustments through governance
   - Verify epoch-based limitations
   - Test minimum/maximum fee constraints

2. **Epoch Management Tests**
   - Test epoch advancement
   - Verify minimum epoch duration enforcement
   - Test fee adjustments across epoch boundaries

## Deployment Plan

1. **Deploy FeeCollector Contract**
   - Deploy to testnet first for validation
   - Configure proper roles and permissions
   - Verify all collection functions

2. **Prepare Diamond Cut**
   - Create facet with fee-related functions
   - Prepare diamond cut transaction
   - Simulate upgrade to verify correctness

3. **Execute Upgrade**
   - Submit diamond cut proposal through governance
   - Execute approved diamond cut
   - Verify storage integrity after upgrade

4. **Initialize Fee Parameters**
   - Set initial fee values
   - Configure fee collector address
   - Set governance limitations

5. **Final Validation**
   - Execute test transactions for all operations
   - Verify fee collection and token flows
   - Conduct final security review

## Risk Mitigation

1. **Storage Collisions**
   - Use unique namespaces for all new storage
   - Thoroughly test storage access before deployment
   - Implement storage layout tests

2. **Calculation Errors**
   - Use SafeMath or Solidity 0.8+ overflow protection
   - Implement multiple validation steps
   - Test with a wide range of input values

3. **Access Control Vulnerabilities**
   - Implement strict role-based access
   - Use modifiers for all sensitive functions
   - Conduct thorough security audits

4. **Fee Collection Failures**
   - Implement fallback mechanisms
   - Add detailed event logging
   - Design circuit breakers for emergency situations

## Conclusion

This implementation strategy provides a comprehensive plan for adding fee functionality to the DLOOP system. By following this structured approach, we can ensure a safe and efficient implementation that maintains the integrity of the existing system while adding the required fee capabilities.