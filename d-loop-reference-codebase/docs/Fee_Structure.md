# D-LOOP Asset DAO Fee Structure

This document outlines the fee structure implementation for the D-LOOP Asset DAO.

## Overview

The fee structure consists of several components that work together to collect, calculate, and distribute fees from various operations within the Asset DAO.

### Key Components

1. **FeeCalculator**: Calculates fees based on predefined percentages for different operations.
2. **FeeCollector**: Collects fees and distributes them to the Treasury and RewardDistributor.
3. **Treasury**: Stores and manages the DAO's treasury funds.
4. **RewardDistributor**: Distributes governance rewards to participants.

## Fee Percentages

### Operation Fees

The Asset DAO charges different fees based on the type of operation:

- **Invest Fee**: 1% (100 basis points) of the invested amount
- **Divest Fee**: 0.5% (50 basis points) of the divested amount
- **Ragequit Fee**: 2% (200 basis points) of the ragequit amount

### Fee Distribution

Collected fees are distributed as follows:

- **70%** to the Treasury for operational expenses and investments
- **30%** to the RewardDistributor for governance rewards

## Contract Roles

The fee structure implements a role-based access control system with the following roles:

### FeeCalculator Roles

- **DEFAULT_ADMIN_ROLE**: Can manage all roles
- **FEE_ADMIN_ROLE**: Can update fee percentages
- **PROTOCOL_DAO_ROLE**: Can update fee percentages

### FeeCollector Roles

- **DEFAULT_ADMIN_ROLE**: Can manage all roles
- **FEE_ADMIN_ROLE**: Can pause/unpause the contract
- **PROTOCOL_DAO_ROLE**: Can update Treasury and RewardDistributor addresses
- **ASSET_DAO_ROLE**: Can collect fees

### Treasury Roles

- **DEFAULT_ADMIN_ROLE**: Can manage all roles
- **TREASURY_ADMIN_ROLE**: Can pause/unpause the contract
- **PROTOCOL_DAO_ROLE**: For future governance integration
- **WITHDRAWAL_ROLE**: Can withdraw funds from the Treasury

### RewardDistributor Roles

- **DEFAULT_ADMIN_ROLE**: Can manage all roles
- **REWARD_ADMIN_ROLE**: Can pause/unpause the contract
- **PROTOCOL_DAO_ROLE**: For future governance integration
- **ASSET_DAO_ROLE**: Can record governance decisions

## Fee Collection Process

1. A user performs an operation (invest, divest, or ragequit) in the Asset DAO.
2. The Asset DAO determines the amount subject to fees.
3. The Asset DAO calls the appropriate method on the FeeCollector.
4. The FeeCollector uses the FeeCalculator to determine the fee amount.
5. The FeeCollector distributes the fee between the Treasury and RewardDistributor.

### Example Fee Calculation

For an investment of 100,000 USDC:

1. Invest fee = 100,000 * 1% = 1,000 USDC
2. Treasury portion = 1,000 * 70% = 700 USDC
3. RewardDistributor portion = 1,000 * 30% = 300 USDC

## Governance Rewards

The RewardDistributor uses the collected fees to reward governance participants based on their contributions.

### Reward Distribution

- 278,000 DLOOP tokens are distributed monthly over 6 years
- Total distribution of 20,016,000 DLOOP tokens
- AI Nodes receive a 20% bonus on their rewards
- Rewards are distributed proportionally to users who made correct governance decisions

## Implementing in Asset DAO

To integrate this fee structure into an Asset DAO, follow these steps:

1. Deploy the FeeCalculator with desired fee percentages
2. Deploy the Treasury
3. Deploy the RewardDistributor
4. Deploy the FeeCollector, connecting it to the Treasury, RewardDistributor, and FeeCalculator
5. Grant the FeeCollector the necessary allowances to transfer tokens
6. Grant the ASSET_DAO_ROLE to the Asset DAO contract
7. Call the appropriate fee collection methods from the Asset DAO contract

## Security Considerations

- Funds can only be withdrawn from the Treasury by addresses with the WITHDRAWAL_ROLE
- All fee percentages are capped at 20% maximum
- All contracts can be paused in case of emergency
- Role-based access control prevents unauthorized changes

## Upgradeability

The fee structure is designed to be upgradable through governance:

- Fee percentages can be updated through the Protocol DAO
- Distribution ratios between Treasury and RewardDistributor can be adjusted
- Addresses for Treasury and RewardDistributor can be updated if needed

## Testing and Verification

Comprehensive test scripts are provided to verify the functionality:

- FeeCalculator.test.js: Tests fee calculation logic
- FeeCollector.test.js: Tests fee collection and distribution
- Treasury.test.js: Tests treasury fund management
- RewardDistributor.test.js: Tests reward distribution mechanics