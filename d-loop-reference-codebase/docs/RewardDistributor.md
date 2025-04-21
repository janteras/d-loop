# Reward Distributor

## Overview

The RewardDistributor contract manages the actual distribution of reward tokens to governance participants. It works in conjunction with the GovernanceRewards contract, which calculates reward amounts, to handle the token transfers and tracking of distributions.

## Key Features

- **Token Distribution**: Handles the actual transfer of reward tokens to participants.
- **Individual and Batch Distribution**: Support for distributing rewards one-by-one or in batches.
- **Distribution Tracking**: Maintains statistics on distributed rewards.
- **Flexible Token Support**: Can distribute any ERC20 token as rewards.
- **Configurable Contracts**: Can update the governance rewards contract or reward token.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Reward Distribution

| Function | Description |
|----------|-------------|
| `distributeReward(uint256 periodId, address participant)` | Distributes a reward to a single participant |
| `batchDistributeRewards(uint256 periodId, address[] calldata participants)` | Distributes rewards to multiple participants in batch |

### Configuration

| Function | Description |
|----------|-------------|
| `setGovernanceRewards(address newGovernanceRewards)` | Sets a new governance rewards contract |
| `setRewardToken(address newRewardToken)` | Sets a new reward token |

### Query Functions

| Function | Description |
|----------|-------------|
| `getRewardsDistributedForPeriod(uint256 periodId)` | Gets the total rewards distributed for a period |
| `getRewardsClaimedByParticipant(address participant)` | Gets the total rewards claimed by a participant |
| `getRewardTokenBalance()` | Gets the current reward token balance of the contract |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Can update contract configurations |
| `DISTRIBUTOR_ROLE` | Can distribute rewards |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- The contract uses OpenZeppelin's SafeERC20 library to handle token transfers securely.
- Distribution statistics are maintained for:
  - Total rewards distributed
  - Rewards distributed by period
  - Rewards claimed by participant
- Reward distribution process:
  1. Verify participant eligibility via GovernanceRewards
  2. Calculate reward amount via GovernanceRewards
  3. Transfer tokens to participant
  4. Update distribution statistics

## Integration with Other Components

- **GovernanceRewards**: Provides reward calculations and tracks participation.
- **FeeCalculator**: Determines what percentage of fees go to rewards.
- **Treasury**: May transfer collected fees to RewardDistributor.

## Usage Examples

### Distributing Rewards to a Single Participant

1. A distributor calls `distributeReward()` with a period ID and participant address.
2. The contract checks eligibility and calculates the reward via GovernanceRewards.
3. The reward tokens are transferred to the participant.

### Batch Distributing Rewards

1. A distributor calls `batchDistributeRewards()` with a period ID and array of participant addresses.
2. The contract processes each participant, skipping any that are invalid or already claimed.
3. Reward tokens are transferred to eligible participants.
4. A batch event is emitted with summary information.

### Updating the Reward Token

1. An admin calls `setRewardToken()` with the address of a new token.
2. Future reward distributions will use the new token.

## Security Considerations

- Role-based access control restricts operations to appropriate roles.
- The ReentrancyGuard prevents reentrancy attacks during reward distribution.
- Before transferring tokens, the contract verifies it has sufficient balance.
- Reward claiming status is tracked in the GovernanceRewards contract to prevent double-claims.
- Invalid participants in batch distribution are skipped rather than reverting the entire transaction.