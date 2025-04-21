# AssetDAO with Fees Integration

This document details the implementation of the AssetDAO with fee integration for the DLOOP protocol.

## Overview

The AssetDAO with Fees system implements a comprehensive fee structure for asset management operations in the DLOOP ecosystem. The system charges fees on investments, divestments, and ragequit operations, distributes these fees between the Treasury and RewardDistributor, and provides governance control over fee parameters and distribution ratios.

## Components

The AssetDAO with Fees integration consists of the following components:

### 1. AssetDAOWithFees Contract

The main contract representing an asset DAO token (D-AI) with integrated fee functionality. It handles:
- Asset management (adding, removing, and updating weights of supported assets)
- Investment operations with fee deduction
- Divestment operations with fee deduction
- Ragequit operations with higher fee penalties
- Governance control over fee system parameters

### 2. FeeCalculator Contract

Responsible for calculating fees for various operations based on configurable percentages:
- Investment fee (default: 10%)
- Divestment fee (default: 5%)
- Ragequit fee (default: 20%)

Features built-in constraints to prevent extreme fee changes:
- Minimum fee percentage: 1%
- Maximum investment/divestment fee: 20%
- Maximum ragequit fee: 30%
- Maximum fee change at once: 0.5%

### 3. FeeProcessor Contract

Handles the processing and distribution of collected fees:
- Treasury receives 70% of fees
- RewardDistributor receives 30% of fees
- Governance can adjust these distribution ratios
- Only authorized AssetDAOs can call the processFee function

### 4. Treasury Contract

Manages funds allocated to the protocol treasury:
- Stores fees collected from AssetDAO operations
- Governance can allocate funds to various purposes
- Emergency withdrawal system with time-lock delay (default: 24 hours)

### 5. RewardDistributor Contract

Distributes rewards to eligible participants:
- Participants receive rewards based on their allocated shares
- Distribution cycles (default: 30 days)
- Governance controls participant list and share allocations
- Participants must claim rewards for each distribution cycle

## Fee Flows

The fee system implements three primary fee flows:

### Investment Flow

1. User approves tokens for investment
2. User calls `invest()` with token address and amount
3. FeeCalculator calculates the investment fee (10% of amount)
4. AssetDAO transfers fee to FeeProcessor
5. FeeProcessor distributes:
   - 70% to Treasury
   - 30% to RewardDistributor
6. AssetDAO mints D-AI tokens to the user (net amount after fee)

### Divestment Flow

1. User calls `divest()` with token amount and asset address
2. FeeCalculator calculates the divestment fee (5% of amount)
3. AssetDAO burns the user's D-AI tokens
4. AssetDAO transfers fee to FeeProcessor
5. FeeProcessor distributes:
   - 70% to Treasury
   - 30% to RewardDistributor
6. AssetDAO transfers the net asset amount to the user

### Ragequit Flow

1. User calls `rageQuit()` with token amount and asset address
2. FeeCalculator calculates the ragequit fee (20% of amount)
3. AssetDAO burns the user's D-AI tokens
4. AssetDAO transfers fee to FeeProcessor
5. FeeProcessor distributes:
   - 70% to Treasury
   - 30% to RewardDistributor
6. AssetDAO transfers the net asset amount to the user

## Reward Distribution

The RewardDistributor operates on a cycle-based distribution mechanism:

1. Fees accumulate in the RewardDistributor over a distribution cycle (default: 30 days)
2. At the end of the cycle, governance calls `distributeRewards()` to mark the cycle as distributed
3. Participants call `claimRewards()` to claim their share of the rewards
4. Each participant receives rewards proportional to their allocated shares (basis points)

## Governance Controls

The fee system includes multiple governance parameters that can be adjusted:

### FeeCalculator Governance

- `updateInvestFeePercentage()`: Change investment fee percentage
- `updateDivestFeePercentage()`: Change divestment fee percentage
- `updateRagequitFeePercentage()`: Change ragequit fee percentage

### FeeProcessor Governance

- `updateDistribution()`: Change fee distribution ratios
- `updateDistributionAddresses()`: Change Treasury and RewardDistributor addresses
- `grantAssetDAORole()`: Authorize new AssetDAOs to process fees

### Treasury Governance

- `allocateFunds()`: Send funds from Treasury to specific purposes
- `updateEmergencyDelay()`: Change the time-lock delay for emergency withdrawals
- `cancelEmergencyWithdrawal()`: Cancel a pending emergency withdrawal

### RewardDistributor Governance

- `addParticipant()`: Add a new reward recipient
- `removeParticipant()`: Remove an existing recipient
- `updateParticipantShares()`: Change a participant's reward allocation
- `updateDistributionCycle()`: Change the duration of distribution cycles

## Security Measures

The fee system implements several security measures:

### Access Control

- Role-based access control for all sensitive functions
- Separate roles for administration, governance, and emergency actions
- Only authorized AssetDAOs can process fees

### Parameter Constraints

- Minimum and maximum values for fee percentages
- Maximum change limit for fee adjustments
- Distribution shares must total 100%

### Emergency Controls

- Pause/unpause functionality for AssetDAO operations
- Emergency withdrawal system with time-lock delay
- Critical functions restricted to emergency role

### Fee Processing Safeguards

- Two-step approval and transfer process for fee collection
- Mathematically safe calculations with rounding in favor of the system
- Verification of all address parameters

## Deployment Process

The deployment process follows these steps:

1. Deploy FeeCalculator with initial fee percentages
2. Deploy Treasury with emergency delay parameter
3. Deploy RewardDistributor with distribution cycle parameter
4. Deploy FeeProcessor with distribution ratios and addresses
5. Deploy AssetDAOWithFees with calculator and processor addresses
6. Grant ASSET_DAO_ROLE to AssetDAO in FeeProcessor
7. Set up initial reward participants in RewardDistributor

## Integration Points

The AssetDAO with Fees system integrates with other DLOOP components:

- **Protocol DAO**: Controls governance parameters of the fee system
- **Governance Rewards**: Receives a portion of fees via RewardDistributor
- **AI Nodes**: Can participate in fee distribution based on contribution
- **Asset Management**: Fee system affects token economics and investment returns

## Testing

The system includes comprehensive testing covering:

- Fee calculation and distribution
- Investment, divestment, and ragequit operations
- Reward distribution and claiming
- Governance parameter adjustments
- Access control and security measures
- Emergency scenarios and recovery procedures

## Conclusion

The AssetDAO with Fees integration provides a robust, flexible, and secure fee system for the DLOOP protocol. It enables fair value capture from protocol operations, incentivizes protocol participation through reward distribution, and establishes sustainable funding for protocol development and maintenance via the Treasury.

The system is designed to be adaptable to future requirements through governance controls while maintaining strong security guarantees and parameter constraints to prevent abuse.