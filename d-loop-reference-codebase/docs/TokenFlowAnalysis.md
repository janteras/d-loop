# Token Flow Analysis

## Overview

This document provides a detailed analysis of token flows in the DLOOP smart contract system, focusing on investment, divestment, and ragequit operations. Understanding these flows is crucial for implementing the fee structure in Phase 2, as it allows us to identify optimal points for fee collection.

## Investment Flow

### Current Implementation

The investment flow involves the following steps:

1. Investor approves the AssetDAO contract to spend their tokens
2. Investor calls the `invest` function with the investment amount
3. AssetDAO transfers tokens from Investor to Treasury
4. Treasury updates its asset balance
5. AssetDAO calculates the equivalent D-AI tokens and mints them to the Investor
6. Events are emitted to record the investment

```solidity
// Simplified current implementation
function invest(uint256 amount) external {
    // Transfer investment tokens to Treasury
    IERC20(investmentToken).transferFrom(msg.sender, treasury, amount);
    
    // Calculate D-AI tokens to mint
    uint256 daiAmount = calculateDAIAmount(amount);
    
    // Mint D-AI tokens to investor
    _mint(msg.sender, daiAmount);
    
    emit Investment(msg.sender, amount, daiAmount);
}
```

### Proposed Fee Implementation

The fee implementation would modify this flow as follows:

1. Investor approves the AssetDAO contract to spend their tokens
2. Investor calls the `invest` function with the investment amount
3. AssetDAO calculates the fee and net investment amount
4. AssetDAO transfers fee amount to FeeCollector
5. AssetDAO transfers net investment amount to Treasury
6. Treasury updates its asset balance
7. AssetDAO calculates the equivalent D-AI tokens based on the net amount and mints them to the Investor
8. Events are emitted to record the investment and fee

```solidity
// Proposed implementation with fees
function invest(uint256 amount) external {
    // Calculate fee
    uint256 fee = calculateInvestmentFee(amount);
    uint256 netAmount = amount - fee;
    
    // Transfer fee to Fee Collector
    IERC20(investmentToken).transferFrom(msg.sender, feeCollector, fee);
    
    // Transfer net amount to Treasury
    IERC20(investmentToken).transferFrom(msg.sender, treasury, netAmount);
    
    // Calculate D-AI tokens to mint (based on net amount)
    uint256 daiAmount = calculateDAIAmount(netAmount);
    
    // Mint D-AI tokens to investor
    _mint(msg.sender, daiAmount);
    
    emit Investment(msg.sender, amount, fee, netAmount, daiAmount);
}
```

### Investment Flow Diagram

```
┌──────────┐     approve(amount)     ┌──────────┐
│          │─────────────────────────▶          │
│ Investor │                         │ AssetDAO │
│          │◀─────────────────────────          │
└────┬─────┘    invest(amount)       └────┬─────┘
     │                                    │
     │                                    │ calculateFee()
     │                                    │
     │                               ┌────▼─────┐
     │                               │          │
     │                               │   Fee    │
     │                               │Collector │
     │                               │          │
     │                               └──────────┘
     │
     │                               ┌──────────┐
     │                               │          │
     │                               │ Treasury │
     │                               │          │
     │                               └────┬─────┘
     │                                    │
     │                                    │
┌────▼─────┐    mint(daiAmount)      ┌────▼─────┐
│          │◀────────────────────────│          │
│ Investor │                         │ AssetDAO │
│          │                         │          │
└──────────┘                         └──────────┘
```

### Fee Insertion Point

The optimal fee insertion point is during the token transfer process to the Treasury. By calculating the fee and splitting the token transfer, we can ensure that:

1. The fee is calculated based on the gross investment amount
2. The Treasury receives the net investment amount
3. The D-AI tokens minted to the investor reflect the net investment amount
4. The fee collection is transparent and auditable through events

## Divestment Flow

### Current Implementation

The divestment flow involves the following steps:

1. Investor calls the `divest` function with the amount of D-AI tokens to burn
2. AssetDAO burns the D-AI tokens from the Investor
3. AssetDAO calculates the equivalent asset tokens
4. AssetDAO instructs Treasury to transfer asset tokens to the Investor
5. Treasury transfers the assets and updates its balance
6. Events are emitted to record the divestment

```solidity
// Simplified current implementation
function divest(uint256 daiAmount) external {
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Calculate asset tokens to release
    uint256 assetAmount = calculateAssetAmount(daiAmount);
    
    // Instruct Treasury to release assets
    ITreasury(treasury).releaseAssets(msg.sender, assetAmount);
    
    emit Divestment(msg.sender, daiAmount, assetAmount);
}
```

### Proposed Fee Implementation

The fee implementation would modify this flow as follows:

1. Investor calls the `divest` function with the amount of D-AI tokens to burn
2. AssetDAO burns the D-AI tokens from the Investor
3. AssetDAO calculates the equivalent asset tokens
4. AssetDAO calculates the fee and net divestment amount
5. AssetDAO instructs Treasury to transfer the fee to FeeCollector and the net amount to the Investor
6. Treasury transfers the assets and updates its balance
7. Events are emitted to record the divestment and fee

```solidity
// Proposed implementation with fees
function divest(uint256 daiAmount) external {
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Calculate asset tokens to release
    uint256 assetAmount = calculateAssetAmount(daiAmount);
    
    // Calculate fee
    uint256 fee = calculateDivestmentFee(assetAmount);
    uint256 netAmount = assetAmount - fee;
    
    // Instruct Treasury to release assets with fee
    ITreasury(treasury).releaseAssetsWithFee(
        msg.sender, 
        netAmount, 
        feeCollector,
        fee
    );
    
    emit Divestment(msg.sender, daiAmount, assetAmount, fee, netAmount);
}
```

### Divestment Flow Diagram

```
┌──────────┐    divest(daiAmount)    ┌──────────┐
│          │─────────────────────────▶          │
│ Investor │                         │ AssetDAO │
│          │                         │          │
└────▲─────┘                         └────┬─────┘
     │                                    │
     │                                    │ burn(daiAmount)
     │                                    │
     │                                    │ calculateAssetAmount()
     │                                    │
     │                                    │ calculateFee()
     │                                    │
     │                                    ▼
     │                               ┌──────────┐
     │                               │          │
     │                               │ Treasury │
     │                               │          │
     │                               └────┬─────┘
     │                                    │
     │                                    │
     │                                    │
     │                               ┌────▼─────┐
     │                               │          │
     │          fee                  │   Fee    │
     │                               │Collector │
     │                               │          │
     │                               └──────────┘
     │
     │         netAmount
     └───────────────────────────────
```

### Fee Insertion Point

The optimal fee insertion point is during the asset token release from the Treasury. By instructing the Treasury to split the transfer between the Investor and the FeeCollector, we can ensure that:

1. The fee is calculated based on the gross asset amount
2. The Investor receives the net asset amount
3. The D-AI tokens burned reflect the full divestment amount
4. The fee collection is integrated into the existing withdrawal process

## Ragequit Flow

### Current Implementation

The ragequit flow is similar to divestment but with emergency considerations:

1. Investor calls the `ragequit` function with the amount of D-AI tokens to burn
2. AssetDAO burns the D-AI tokens from the Investor
3. AssetDAO calculates the equivalent asset tokens (potentially at a less favorable rate)
4. AssetDAO instructs Treasury to perform an emergency release of assets to the Investor
5. Treasury transfers the assets and updates its balance
6. Events are emitted to record the ragequit

```solidity
// Simplified current implementation
function ragequit(uint256 daiAmount) external {
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Calculate asset tokens to release (potentially at a discount)
    uint256 assetAmount = calculateRagequitAmount(daiAmount);
    
    // Instruct Treasury to emergency release assets
    ITreasury(treasury).emergencyReleaseAssets(msg.sender, assetAmount);
    
    emit Ragequit(msg.sender, daiAmount, assetAmount);
}
```

### Proposed Fee Implementation

The fee implementation would add a higher penalty fee for ragequit:

1. Investor calls the `ragequit` function with the amount of D-AI tokens to burn
2. AssetDAO burns the D-AI tokens from the Investor
3. AssetDAO calculates the equivalent asset tokens (potentially at a less favorable rate)
4. AssetDAO calculates the penalty fee (higher than standard divestment) and net amount
5. AssetDAO instructs Treasury to transfer the fee to FeeCollector and the net amount to the Investor
6. Treasury transfers the assets and updates its balance
7. Events are emitted to record the ragequit and fee

```solidity
// Proposed implementation with fees
function ragequit(uint256 daiAmount) external {
    // Burn D-AI tokens
    _burn(msg.sender, daiAmount);
    
    // Calculate asset tokens to release (potentially at a discount)
    uint256 assetAmount = calculateRagequitAmount(daiAmount);
    
    // Calculate penalty fee (higher than standard divestment)
    uint256 penaltyFee = calculateRagequitFee(assetAmount);
    uint256 netAmount = assetAmount - penaltyFee;
    
    // Instruct Treasury to emergency release assets with fee
    ITreasury(treasury).emergencyReleaseAssetsWithFee(
        msg.sender, 
        netAmount, 
        feeCollector,
        penaltyFee
    );
    
    emit Ragequit(msg.sender, daiAmount, assetAmount, penaltyFee, netAmount);
}
```

### Ragequit Flow Diagram

```
┌──────────┐   ragequit(daiAmount)   ┌──────────┐
│          │─────────────────────────▶          │
│ Investor │                         │ AssetDAO │
│          │                         │          │
└────▲─────┘                         └────┬─────┘
     │                                    │
     │                                    │ burn(daiAmount)
     │                                    │
     │                                    │ calculateRagequitAmount()
     │                                    │
     │                                    │ calculatePenaltyFee()
     │                                    │
     │                                    ▼
     │                               ┌──────────┐
     │                               │          │
     │                               │ Treasury │
     │                               │          │
     │                               └────┬─────┘
     │                                    │
     │                                    │
     │                                    │
     │                               ┌────▼─────┐
     │                               │          │
     │       penaltyFee (higher)     │   Fee    │
     │                               │Collector │
     │                               │          │
     │                               └──────────┘
     │
     │         netAmount (reduced)
     └───────────────────────────────
```

### Fee Insertion Point

The fee insertion point is the same as for divestment, but with a higher fee rate. The higher penalty fee serves both as a disincentive for premature exits and as compensation for the potential disruption to the asset pool.

## Treasury Integration

### Current Treasury Interface

```solidity
interface ITreasury {
    function releaseAssets(address recipient, uint256 amount) external;
    function emergencyReleaseAssets(address recipient, uint256 amount) external;
}
```

### Proposed Extended Interface

```solidity
interface ITreasury {
    function releaseAssets(
        address recipient, 
        uint256 amount
    ) external;
    
    function releaseAssetsWithFee(
        address recipient, 
        uint256 netAmount,
        address feeCollector,
        uint256 feeAmount
    ) external;
    
    function emergencyReleaseAssets(
        address recipient, 
        uint256 amount
    ) external;
    
    function emergencyReleaseAssetsWithFee(
        address recipient, 
        uint256 netAmount,
        address feeCollector,
        uint256 feeAmount
    ) external;
}
```

### Treasury Implementation

```solidity
// In Treasury.sol
function releaseAssetsWithFee(
    address recipient,
    uint256 netAmount,
    address feeCollector,
    uint256 feeAmount
) external onlyAssetDAO {
    TreasuryStorage storage ts = LibTreasuryStorage.getStorage();
    
    // Verify that the recipient is not the zero address
    require(recipient != address(0), "Treasury: zero address");
    require(feeCollector != address(0), "Treasury: zero fee collector");
    
    // Verify sufficient assets
    uint256 totalAmount = netAmount + feeAmount;
    require(ts.assets[investmentToken] >= totalAmount, "Treasury: insufficient assets");
    
    // Update asset balance
    ts.assets[investmentToken] -= totalAmount;
    
    // Transfer net amount to recipient
    IERC20(investmentToken).transfer(recipient, netAmount);
    
    // Transfer fee to fee collector
    IERC20(investmentToken).transfer(feeCollector, feeAmount);
    
    emit AssetsReleasedWithFee(recipient, netAmount, feeCollector, feeAmount);
}
```

## Fee Calculation

### Investment Fee

```solidity
function calculateInvestmentFee(uint256 amount) internal view returns (uint256) {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    return (amount * ds.investFee) / 10000;
}

// Example for 0.5% fee on 1000 tokens:
// (1000 * 50) / 10000 = 5 tokens
```

### Divestment Fee

```solidity
function calculateDivestmentFee(uint256 amount) internal view returns (uint256) {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    return (amount * ds.divestFee) / 10000;
}

// Example for 0.5% fee on 1000 tokens:
// (1000 * 50) / 10000 = 5 tokens
```

### Ragequit Fee

```solidity
function calculateRagequitFee(uint256 amount) internal view returns (uint256) {
    AssetDAOStorage storage ds = LibAssetDAOStorage.getStorage();
    return (amount * ds.ragequitFee) / 10000;
}

// Example for 2.0% fee on 1000 tokens:
// (1000 * 200) / 10000 = 20 tokens
```

## Fee Simulation

### Investment Fee Simulation

| Investment Amount | Fee Rate | Fee Amount | Net Amount |
|------------------|---------|-----------|------------|
| 1,000 USDC       | 0.5%    | 5 USDC    | 995 USDC   |
| 10,000 USDC      | 0.5%    | 50 USDC   | 9,950 USDC |
| 100,000 USDC     | 0.5%    | 500 USDC  | 99,500 USDC |

### Divestment Fee Simulation

| Divestment Amount | Fee Rate | Fee Amount | Net Amount |
|------------------|---------|-----------|------------|
| 1,000 USDC       | 0.5%    | 5 USDC    | 995 USDC   |
| 10,000 USDC      | 0.5%    | 50 USDC   | 9,950 USDC |
| 100,000 USDC     | 0.5%    | 500 USDC  | 99,500 USDC |

### Ragequit Fee Simulation

| Ragequit Amount  | Fee Rate | Fee Amount | Net Amount |
|------------------|---------|-----------|------------|
| 1,000 USDC       | 2.0%    | 20 USDC   | 980 USDC   |
| 10,000 USDC      | 2.0%    | 200 USDC  | 9,800 USDC |
| 100,000 USDC     | 2.0%    | 2,000 USDC | 98,000 USDC |

## Gas Considerations

Fee calculations and additional token transfers will increase gas costs. Based on our analysis:

1. **Investment with Fee**: Approximately 15,000 additional gas compared to the current implementation
2. **Divestment with Fee**: Approximately 20,000 additional gas due to the split transfer
3. **Ragequit with Fee**: Similar to divestment, approximately 20,000 additional gas

These additional costs are reasonable considering the functionality added and the typical transaction values involved.

## Event Emission

To ensure transparency and auditability, the following events should be emitted:

```solidity
// In AssetDAO.sol
event Investment(
    address indexed investor,
    uint256 investmentAmount,
    uint256 feeAmount,
    uint256 netAmount,
    uint256 daiAmount
);

event Divestment(
    address indexed investor,
    uint256 daiAmount,
    uint256 assetAmount,
    uint256 feeAmount,
    uint256 netAmount
);

event Ragequit(
    address indexed investor,
    uint256 daiAmount,
    uint256 assetAmount,
    uint256 feeAmount,
    uint256 netAmount
);

// In Treasury.sol
event AssetsReleasedWithFee(
    address indexed recipient,
    uint256 netAmount,
    address indexed feeCollector,
    uint256 feeAmount
);

// In FeeCollector.sol
event FeeCollected(
    address indexed source,
    address indexed token,
    uint256 amount,
    string operationType
);
```

## Conclusion

Based on our analysis of token flows in the DLOOP system, we have identified the optimal fee insertion points:

1. **Investment**: Split the token transfer from Investor, sending the fee to FeeCollector and the net amount to Treasury
2. **Divestment**: Modify the asset release process to split the transfer between Investor and FeeCollector
3. **Ragequit**: Similar to divestment but with a higher fee rate

These implementations will integrate seamlessly with the existing token flows while adding the necessary fee functionality. The approach maintains the integrity of the system while providing a clear and auditable fee collection mechanism.

## Recommendations

1. Extend the Treasury interface to support fee-inclusive asset releases
2. Add fee calculation functions to the AssetDAO contract
3. Update the investment, divestment, and ragequit functions to include fee calculations
4. Implement a dedicated FeeCollector contract with proper accounting
5. Add comprehensive events for fee-related operations
6. Optimize gas usage by batching storage reads and minimizing storage writes

By following these recommendations, we can successfully implement the fee structure in Phase 2 while maintaining the system's performance and usability.