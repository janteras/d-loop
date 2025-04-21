# Fee Structure Implementation Plan

## Overview

This document outlines the detailed implementation plan for the DLOOP protocol fee structure. The fee system is designed to be integrated with existing contracts, particularly the AssetDAO, and will provide a sustainable revenue source for the protocol while incentivizing long-term participation.

## Fee Rates and Distribution

### Fee Rates
- **Investment Operations**: 0.5% fee
- **Divestment Operations**: 0.5% fee
- **Ragequit Operations**: 2.0% fee (higher penalty for early exits)

### Fee Distribution
- **Treasury Allocation**: 70% of collected fees
- **Rewards Allocation**: 30% of collected fees (for governance rewards)

## Core Components

### 1. FeeCalculator Contract

The FeeCalculator will be responsible for determining the appropriate fee amount for different operations.

#### Key Functions:
- `calculateInvestmentFee(uint256 amount) → uint256`
- `calculateDivestmentFee(uint256 amount) → uint256`
- `calculateRagequitFee(uint256 amount) → uint256`
- `getFeeRates() → (uint256 investRate, uint256 divestRate, uint256 ragequitRate)`
- `setFeeRates(uint256 investRate, uint256 divestRate, uint256 ragequitRate)`

#### Storage Variables:
```solidity
struct FeeCalculatorStorage {
    uint256 investmentFeeRate;    // Base points (e.g., 50 = 0.5%)
    uint256 divestmentFeeRate;    // Base points (e.g., 50 = 0.5%)
    uint256 ragequitFeeRate;      // Base points (e.g., 200 = 2.0%)
    uint256 maxFeeRateChange;     // Maximum change per adjustment (e.g., 5 = 0.05%)
    uint256 minInvestDivestFee;   // Minimum fee for invest/divest (e.g., 10 = 0.1%)
    uint256 maxRagequitFee;       // Maximum ragequit fee (e.g., 300 = 3.0%)
}
```

### 2. FeeCollector Contract

The FeeCollector will receive fees from operations and distribute them according to the allocation rules.

#### Key Functions:
- `collectFee(address token, uint256 amount) → uint256 treasuryAmount, uint256 rewardsAmount`
- `distributeFee(address token, uint256 amount)`
- `setFeeDistribution(uint256 treasuryShare, uint256 rewardsShare)`
- `getFeeDistribution() → (uint256 treasuryShare, uint256 rewardsShare)`

#### Storage Variables:
```solidity
struct FeeCollectorStorage {
    uint256 treasuryAllocation;   // Base points (e.g., 7000 = 70%)
    uint256 rewardsAllocation;    // Base points (e.g., 3000 = 30%)
    uint256 totalCollectedFees;   // Total fees collected (all tokens)
    mapping(address => uint256) tokenFeeBalances; // Balance by token
}
```

## Integration Points

### AssetDAO Contract Integration

1. **Invest Operation**
   ```solidity
   function invest(uint256 amount) external {
       // Transfer tokens from user to Treasury
       token.transferFrom(msg.sender, treasuryAddress, amount);
       
       // Calculate fee
       uint256 fee = feeCalculator.calculateInvestmentFee(amount);
       
       // Collect and distribute fee
       uint256 netAmount = amount - fee;
       if (fee > 0) {
           (uint256 treasuryFee, uint256 rewardsFee) = feeCollector.collectFee(address(token), fee);
           // Emit fee collection event
       }
       
       // Mint AssetDAO tokens for net amount
       _mint(msg.sender, netAmount);
   }
   ```

2. **Divest Operation**
   ```solidity
   function divest(uint256 amount) external {
       // Calculate fee
       uint256 fee = feeCalculator.calculateDivestmentFee(amount);
       uint256 netAmount = amount - fee;
       
       // Burn AssetDAO tokens
       _burn(msg.sender, amount);
       
       // Collect and distribute fee
       if (fee > 0) {
           (uint256 treasuryFee, uint256 rewardsFee) = feeCollector.collectFee(address(token), fee);
           // Emit fee collection event
       }
       
       // Transfer net tokens from Treasury to user
       treasury.transferToUser(msg.sender, netAmount);
   }
   ```

3. **Ragequit Operation**
   ```solidity
   function ragequit(uint256 amount) external {
       // Calculate fee (higher for ragequit)
       uint256 fee = feeCalculator.calculateRagequitFee(amount);
       uint256 netAmount = amount - fee;
       
       // Burn AssetDAO tokens
       _burn(msg.sender, amount);
       
       // Collect and distribute fee
       if (fee > 0) {
           (uint256 treasuryFee, uint256 rewardsFee) = feeCollector.collectFee(address(token), fee);
           // Emit fee collection event
       }
       
       // Transfer net tokens from Treasury to user
       treasury.transferToUser(msg.sender, netAmount);
   }
   ```

### Treasury Contract Integration

1. **Fee Receipt**
   ```solidity
   function receiveFee(address token, uint256 amount) external onlyFeeCollector {
       // Update Treasury fee balance
       treasuryFeeBalance[token] += amount;
       
       // Emit fee received event
       emit FeeReceived(token, amount);
   }
   ```

### Governance Integration

1. **Fee Rate Adjustment**
   ```solidity
   function adjustFeeRates(
       uint256 newInvestRate, 
       uint256 newDivestRate, 
       uint256 newRagequitRate
   ) external onlyGovernance {
       // Ensure changes are within limits
       FeeCalculatorStorage storage s = diamondStorage();
       require(
           abs(newInvestRate - s.investmentFeeRate) <= s.maxFeeRateChange &&
           abs(newDivestRate - s.divestmentFeeRate) <= s.maxFeeRateChange &&
           abs(newRagequitRate - s.ragequitFeeRate) <= s.maxFeeRateChange,
           "Fee rate change exceeds limit"
       );
       
       // Ensure minimum/maximum constraints
       require(
           newInvestRate >= s.minInvestDivestFee &&
           newDivestRate >= s.minInvestDivestFee &&
           newRagequitRate <= s.maxRagequitFee,
           "Fee rate violates constraints"
       );
       
       // Update fee rates
       feeCalculator.setFeeRates(newInvestRate, newDivestRate, newRagequitRate);
       
       // Emit fee rate updated event
       emit FeeRatesUpdated(newInvestRate, newDivestRate, newRagequitRate);
   }
   ```

## Implementation Steps

### Week 1: FeeCalculator and Initial Integration

#### Day 1-2: Design & Documentation
- Define FeeCalculator contract interfaces
- Document storage layout and fee calculation formulas
- Design integration points with AssetDAO

#### Day 3-5: Implementation
1. Create FeeCalculator contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   
   contract FeeCalculator {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.fee.calculator.storage");
       
       struct FeeCalculatorStorage {
           uint256 investmentFeeRate;    // Base points (e.g., 50 = 0.5%)
           uint256 divestmentFeeRate;    // Base points (e.g., 50 = 0.5%)
           uint256 ragequitFeeRate;      // Base points (e.g., 200 = 2.0%)
           uint256 maxFeeRateChange;     // Maximum change per adjustment (e.g., 5 = 0.05%)
           uint256 minInvestDivestFee;   // Minimum fee for invest/divest (e.g., 10 = 0.1%)
           uint256 maxRagequitFee;       // Maximum ragequit fee (e.g., 300 = 3.0%)
       }
       
       function diamondStorage() internal pure returns (FeeCalculatorStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(
           uint256 _investRate,
           uint256 _divestRate,
           uint256 _ragequitRate
       ) external {
           FeeCalculatorStorage storage s = diamondStorage();
           require(s.investmentFeeRate == 0, "Already initialized");
           
           s.investmentFeeRate = _investRate;
           s.divestmentFeeRate = _divestRate;
           s.ragequitFeeRate = _ragequitRate;
           s.maxFeeRateChange = 5; // 0.05%
           s.minInvestDivestFee = 10; // 0.1%
           s.maxRagequitFee = 300; // 3.0%
       }
       
       function calculateInvestmentFee(uint256 amount) external view returns (uint256) {
           FeeCalculatorStorage storage s = diamondStorage();
           return (amount * s.investmentFeeRate) / 10000;
       }
       
       function calculateDivestmentFee(uint256 amount) external view returns (uint256) {
           FeeCalculatorStorage storage s = diamondStorage();
           return (amount * s.divestmentFeeRate) / 10000;
       }
       
       function calculateRagequitFee(uint256 amount) external view returns (uint256) {
           FeeCalculatorStorage storage s = diamondStorage();
           return (amount * s.ragequitFeeRate) / 10000;
       }
       
       function getFeeRates() external view returns (
           uint256 investRate,
           uint256 divestRate,
           uint256 ragequitRate
       ) {
           FeeCalculatorStorage storage s = diamondStorage();
           return (
               s.investmentFeeRate,
               s.divestmentFeeRate,
               s.ragequitFeeRate
           );
       }
       
       function setFeeRates(
           uint256 investRate,
           uint256 divestRate,
           uint256 ragequitRate
       ) external {
           // Access control will be handled by Governance
           FeeCalculatorStorage storage s = diamondStorage();
           
           require(
               abs(investRate, s.investmentFeeRate) <= s.maxFeeRateChange &&
               abs(divestRate, s.divestmentFeeRate) <= s.maxFeeRateChange &&
               abs(ragequitRate, s.ragequitFeeRate) <= s.maxFeeRateChange,
               "Fee rate change exceeds limit"
           );
           
           require(
               investRate >= s.minInvestDivestFee &&
               divestRate >= s.minInvestDivestFee &&
               ragequitRate <= s.maxRagequitFee,
               "Fee rate violates constraints"
           );
           
           s.investmentFeeRate = investRate;
           s.divestmentFeeRate = divestRate;
           s.ragequitFeeRate = ragequitRate;
       }
       
       function abs(uint256 a, uint256 b) internal pure returns (uint256) {
           return a > b ? a - b : b - a;
       }
   }
   ```

2. Develop unit tests for fee calculations

#### Day 6-7: AssetDAO Integration (Phase 1)
1. Modify AssetDAO to integrate with FeeCalculator
2. Update invest operations to calculate and redirect fees
3. Test integration with mock fee calculator

### Week 2: FeeCollector and Complete Integration

#### Day 1-2: Design & Documentation
- Define FeeCollector contract interfaces
- Document fee distribution rules and statistics tracking
- Design connection points with Treasury

#### Day 3-5: Implementation
1. Create FeeCollector contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
   
   contract FeeCollector {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.fee.collector.storage");
       
       struct FeeCollectorStorage {
           uint256 treasuryAllocation;   // Base points (e.g., 7000 = 70%)
           uint256 rewardsAllocation;    // Base points (e.g., 3000 = 30%)
           uint256 totalCollectedFees;   // Total fees collected (all tokens)
           mapping(address => uint256) tokenFeeBalances; // Balance by token
           address treasury;
           address rewardDistributor;
       }
       
       function diamondStorage() internal pure returns (FeeCollectorStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(
           address _treasury,
           address _rewardDistributor,
           uint256 _treasuryShare,
           uint256 _rewardsShare
       ) external {
           FeeCollectorStorage storage s = diamondStorage();
           require(s.treasuryAllocation == 0, "Already initialized");
           require(_treasury != address(0), "Invalid treasury address");
           
           s.treasury = _treasury;
           s.rewardDistributor = _rewardDistributor;
           s.treasuryAllocation = _treasuryShare;
           s.rewardsAllocation = _rewardsShare;
       }
       
       function collectFee(address token, uint256 amount) external returns (uint256 treasuryAmount, uint256 rewardsAmount) {
           FeeCollectorStorage storage s = diamondStorage();
           require(token != address(0), "Invalid token");
           require(amount > 0, "Zero fee amount");
           
           // Update total collected fees
           s.totalCollectedFees += amount;
           s.tokenFeeBalances[token] += amount;
           
           // Calculate distribution
           treasuryAmount = (amount * s.treasuryAllocation) / 10000;
           rewardsAmount = (amount * s.rewardsAllocation) / 10000;
           
           // Distribute fees
           if (treasuryAmount > 0 && s.treasury != address(0)) {
               IERC20(token).transfer(s.treasury, treasuryAmount);
           }
           
           if (rewardsAmount > 0 && s.rewardDistributor != address(0)) {
               IERC20(token).transfer(s.rewardDistributor, rewardsAmount);
           }
           
           return (treasuryAmount, rewardsAmount);
       }
       
       function setFeeDistribution(uint256 treasuryShare, uint256 rewardsShare) external {
           // Access control will be handled by Governance
           FeeCollectorStorage storage s = diamondStorage();
           require(treasuryShare + rewardsShare == 10000, "Shares must total 100%");
           
           s.treasuryAllocation = treasuryShare;
           s.rewardsAllocation = rewardsShare;
       }
       
       function getFeeDistribution() external view returns (
           uint256 treasuryShare,
           uint256 rewardsShare
       ) {
           FeeCollectorStorage storage s = diamondStorage();
           return (s.treasuryAllocation, s.rewardsAllocation);
       }
       
       function updateRecipients(address newTreasury, address newRewardDistributor) external {
           // Access control will be handled by Governance
           FeeCollectorStorage storage s = diamondStorage();
           
           if (newTreasury != address(0)) {
               s.treasury = newTreasury;
           }
           
           if (newRewardDistributor != address(0)) {
               s.rewardDistributor = newRewardDistributor;
           }
       }
       
       function getTotalCollectedFees() external view returns (uint256) {
           return diamondStorage().totalCollectedFees;
       }
       
       function getTokenFeeBalance(address token) external view returns (uint256) {
           return diamondStorage().tokenFeeBalances[token];
       }
   }
   ```

2. Develop unit tests for fee collection and distribution

#### Day 6-7: Complete Integration
1. Finalize AssetDAO integration for all operation types
   ```solidity
   // AssetDAO.sol modifications
   
   // Add FeeCalculator and FeeCollector interfaces
   interface IFeeCalculator {
       function calculateInvestmentFee(uint256 amount) external view returns (uint256);
       function calculateDivestmentFee(uint256 amount) external view returns (uint256);
       function calculateRagequitFee(uint256 amount) external view returns (uint256);
   }
   
   interface IFeeCollector {
       function collectFee(address token, uint256 amount) external returns (uint256 treasuryAmount, uint256 rewardsAmount);
   }
   
   // Add storage variables
   struct AssetDAOStorage {
       // Existing storage variables
       address feeCalculator;
       address feeCollector;
   }
   
   // Update functions
   function invest(uint256 amount) external {
       AssetDAOStorage storage s = diamondStorage();
       
       // Transfer tokens from user to Treasury
       IERC20(s.token).transferFrom(msg.sender, s.treasury, amount);
       
       // Calculate fee
       uint256 fee = 0;
       if (s.feeCalculator != address(0)) {
           fee = IFeeCalculator(s.feeCalculator).calculateInvestmentFee(amount);
       }
       
       // Collect and distribute fee
       uint256 netAmount = amount - fee;
       if (fee > 0 && s.feeCollector != address(0)) {
           (uint256 treasuryFee, uint256 rewardsFee) = IFeeCollector(s.feeCollector).collectFee(s.token, fee);
           emit FeeCollected(s.token, fee, treasuryFee, rewardsFee);
       }
       
       // Mint AssetDAO tokens for net amount
       _mint(msg.sender, netAmount);
   }
   
   function divest(uint256 amount) external {
       AssetDAOStorage storage s = diamondStorage();
       
       // Calculate fee
       uint256 fee = 0;
       if (s.feeCalculator != address(0)) {
           fee = IFeeCalculator(s.feeCalculator).calculateDivestmentFee(amount);
       }
       uint256 netAmount = amount - fee;
       
       // Burn AssetDAO tokens
       _burn(msg.sender, amount);
       
       // Collect and distribute fee
       if (fee > 0 && s.feeCollector != address(0)) {
           (uint256 treasuryFee, uint256 rewardsFee) = IFeeCollector(s.feeCollector).collectFee(s.token, fee);
           emit FeeCollected(s.token, fee, treasuryFee, rewardsFee);
       }
       
       // Transfer net tokens from Treasury to user
       ITreasury(s.treasury).transferToUser(msg.sender, netAmount);
   }
   
   function ragequit(uint256 amount) external {
       AssetDAOStorage storage s = diamondStorage();
       
       // Calculate fee (higher for ragequit)
       uint256 fee = 0;
       if (s.feeCalculator != address(0)) {
           fee = IFeeCalculator(s.feeCalculator).calculateRagequitFee(amount);
       }
       uint256 netAmount = amount - fee;
       
       // Burn AssetDAO tokens
       _burn(msg.sender, amount);
       
       // Collect and distribute fee
       if (fee > 0 && s.feeCollector != address(0)) {
           (uint256 treasuryFee, uint256 rewardsFee) = IFeeCollector(s.feeCollector).collectFee(s.token, fee);
           emit FeeCollected(s.token, fee, treasuryFee, rewardsFee);
       }
       
       // Transfer net tokens from Treasury to user
       ITreasury(s.treasury).transferToUser(msg.sender, netAmount);
   }
   
   // Add getter/setter for fee components
   function setFeeComponents(address _feeCalculator, address _feeCollector) external {
       // Access control will be handled by Governance
       AssetDAOStorage storage s = diamondStorage();
       s.feeCalculator = _feeCalculator;
       s.feeCollector = _feeCollector;
   }
   ```

2. Connect FeeCollector to Treasury
3. Implement comprehensive testing of fee flows

## Testing Strategy

### Unit Testing
1. **FeeCalculator Tests**
   - Verify correct fee calculations for all operation types
   - Test fee rate boundaries and constraints
   - Test rate change limitations

2. **FeeCollector Tests**
   - Verify correct fee distribution between Treasury and Rewards
   - Test allocation boundaries and adjustments
   - Test token-specific balances

3. **Integration Tests**
   - End-to-end invest/divest/ragequit flows with fee collection
   - Fee parameter adjustments through governance
   - Edge cases and failure modes

### Property-Based Testing
1. **Invariants**
   - Fee calculations always produce expected results within bounds
   - Fee distributions always maintain correct percentages
   - Total fees collected match sum of distributed fees

2. **Security Properties**
   - Only authorized roles can change fee parameters
   - Fee changes are correctly bounded by constraints
   - Fee collection preserves token balances

## Deployment Plan

### 1. Testnet Deployment
- Deploy FeeCalculator with initial rates (0.5%, 0.5%, 2.0%)
- Deploy FeeCollector with initial allocation (70%/30%)
- Integrate with existing AssetDAO, Treasury, and Governance
- Execute test scenarios for each operation type

### 2. Mainnet Deployment
- Deploy contracts with identical parameters to testnet
- Start with reduced fee rates for first 30 days (0.25%, 0.25%, 1.0%)
- Gradually increase to target rates through governance votes

## Governance Controls

1. **Fee Rate Adjustments**
   - Maximum change per adjustment: ±0.05%
   - Minimum cooldown between adjustments: 30 days
   - Requires standard governance approval

2. **Fee Distribution Adjustments**
   - Maximum change per adjustment: ±5%
   - Minimum Treasury allocation: 50%
   - Requires enhanced governance approval (higher quorum)

## Conclusion

This implementation plan provides a comprehensive roadmap for introducing fee structure to the DLOOP protocol. The design prioritizes flexibility through governance control, while maintaining safety bounds to protect users from sudden changes. The integration with existing contracts focuses on minimizing disruption while providing clear benefits through fee collection and distribution.