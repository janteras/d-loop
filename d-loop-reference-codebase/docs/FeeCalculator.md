# Fee Calculator

## Overview

The FeeCalculator contract defines and manages the fee structure within the DLOOP ecosystem. It calculates fees for various operations such as investments, divestments, and rage quits, and determines how these fees are distributed between the treasury and rewards system.

## Key Features

- **Operation-specific Fees**: Different fee rates for investments, divestments, and rage quits.
- **Fee Distribution**: Configurable distribution of fees between treasury and rewards.
- **Basis Point Precision**: All rates and shares are in basis points (1/100 of a percent) for precision.
- **Role-based Management**: Controlled fee adjustments via role-based access.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Fee Calculation

| Function | Description |
|----------|-------------|
| `calculateInvestmentFee(uint256 amount)` | Calculates the fee for an investment operation |
| `calculateDivestmentFee(uint256 amount)` | Calculates the fee for a divestment operation |
| `calculateRageQuitFee(uint256 amount)` | Calculates the fee for a rage quit operation |
| `calculateTreasuryShare(uint256 feeAmount)` | Calculates the treasury's share of a fee |
| `calculateRewardsShare(uint256 feeAmount)` | Calculates the rewards' share of a fee |

### Fee Management

| Function | Description |
|----------|-------------|
| `setInvestmentFeeRate(uint256 newRate)` | Sets the investment fee rate |
| `setDivestmentFeeRate(uint256 newRate)` | Sets the divestment fee rate |
| `setRageQuitFeeRate(uint256 newRate)` | Sets the rage quit fee rate |
| `setTreasuryFeeShare(uint256 newShare)` | Sets the treasury's share of fees |
| `setRewardsShare(uint256 newShare)` | Sets the rewards' share of fees |
| `setFeeShares(uint256 newTreasuryShare, uint256 newRewardsShare)` | Sets both treasury and rewards shares simultaneously |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Has general administrative permissions |
| `FEE_MANAGER_ROLE` | Can adjust fee rates and distribution shares |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- Fee rates and shares are stored in basis points (1 basis point = 0.01%)
- Default values:
  - Investment fee: 10% (1000 basis points)
  - Divestment fee: 5% (500 basis points)
  - Rage quit fee: 20% (2000 basis points)
  - Treasury share: 70% (7000 basis points)
  - Rewards share: 30% (3000 basis points)
- The `BASIS_POINTS` constant equals 10000, representing 100%
- Fee shares (treasury + rewards) must always sum to 100% (10000 basis points)

## Integration with Other Components

- **AssetDAO**: Uses the fee calculator to determine fees for investment and divestment operations.
- **Treasury**: Receives the treasury's share of collected fees.
- **RewardDistributor**: Receives the rewards' share of collected fees for distribution to governance participants.

## Usage Examples

### Calculating Investment Fees

1. When a user invests in the protocol, the AssetDAO calls `calculateInvestmentFee()` to determine the fee amount.
2. The fee is then split between treasury and rewards according to the configured shares.

### Adjusting Fee Structure

1. A fee manager can call `setRageQuitFeeRate()` to adjust the rage quit fee, for example, to discourage premature withdrawals.
2. Events are emitted to track these changes for transparency.

### Distributing Fees

1. After calculating a fee, the system can call `calculateTreasuryShare()` and `calculateRewardsShare()` to determine how to split the fee.
2. These amounts are then sent to the Treasury and RewardDistributor contracts respectively.

## Security Considerations

- Fee rate changes are restricted to addresses with the FEE_MANAGER_ROLE.
- Fee rates cannot exceed 100% (10000 basis points).
- Fee distribution shares must always sum to exactly 100% to prevent loss of funds.
- Events are emitted for all fee adjustments for transparency and auditability.