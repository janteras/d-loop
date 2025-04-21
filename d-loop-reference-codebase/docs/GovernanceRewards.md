# Governance Rewards

## Overview

The GovernanceRewards contract manages rewards for participation in the DLOOP governance system, with special rules for AI nodes. It tracks participation, calculates reward amounts, and facilitates the distribution of rewards based on configurable parameters.

## Key Features

- **AI Node Differentiation**: Special handling for AI nodes versus human participants.
- **Reward Periods**: Time-bounded periods for governance participation.
- **Customizable Voting Windows**: Different voting periods for AI nodes and humans.
- **Flexible Reward Allocation**: Configurable reward shares between AI nodes and humans.
- **Participation Tracking**: Comprehensive tracking of who participated in each period.
- **Reward Claiming**: Process for eligible participants to claim rewards.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Reward Period Management

| Function | Description |
|----------|-------------|
| `createRewardPeriod(uint256 startTime, uint256 endTime, uint256 totalReward, uint256 aiNodeShare, uint256 humanShare)` | Creates a new reward period |
| `recordParticipation(uint256 periodId, address participant)` | Records participation in a reward period |
| `finalizeRewardPeriod(uint256 periodId)` | Finalizes a reward period, enabling reward claims |
| `claimReward(uint256 periodId, address participant)` | Calculates the reward amount for a participant |

### Configuration

| Function | Description |
|----------|-------------|
| `setAIVotingPeriod(uint256 newPeriod)` | Sets the voting period for AI nodes |
| `setHumanVotingPeriod(uint256 newPeriod)` | Sets the voting period for humans |

### Query Functions

| Function | Description |
|----------|-------------|
| `getCurrentPeriodId()` | Gets the current reward period ID |
| `getRewardPeriodInfo(uint256 periodId)` | Gets basic information about a reward period |
| `getParticipationInfo(uint256 periodId)` | Gets participation statistics for a reward period |
| `hasParticipated(uint256 periodId, address participant)` | Checks if an address has participated in a reward period |
| `hasClaimedReward(uint256 periodId, address participant)` | Checks if an address has claimed their reward for a period |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Can update voting periods and other parameters |
| `REWARDS_MANAGER_ROLE` | Can create and finalize reward periods, record participation, and handle reward claims |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- Reward shares are specified in basis points (1 basis point = 0.01%)
- Default voting periods:
  - AI nodes: 1 day
  - Humans: 7 days
- Reward periods track:
  - Start and end times
  - Total reward amount
  - Distribution shares between AI nodes and humans
  - Participation lists by type (AI/human)
  - Claim status for each participant
- The contract uses AINodeRegistry to identify AI nodes

## Integration with Other Components

- **AINodeRegistry**: Used to verify if participants are AI nodes.
- **RewardDistributor**: Uses the reward calculations to distribute actual token rewards.
- **Protocol DAO**: Typically triggers governance voting periods that align with reward periods.

## Usage Examples

### Creating a Governance Vote with Rewards

1. A rewards manager creates a new reward period coinciding with a governance vote.
2. The reward period specifies the total reward amount and the distribution between AI nodes and humans.

### Recording Governance Participation

1. As participants vote in governance, their participation is recorded via `recordParticipation()`.
2. AI nodes must participate within their shorter voting window (default 1 day).
3. Humans have a longer voting window (default 7 days).

### Distributing Rewards

1. After the reward period ends, it is finalized via `finalizeRewardPeriod()`.
2. The RewardDistributor contract then calls `claimReward()` for each participant to determine their reward amount.
3. Rewards are distributed proportionally within each group (AI nodes and humans).

## Security Considerations

- Role-based access control restricts each operation to appropriate roles.
- Time-based constraints ensure participation happens within designated voting windows.
- Participants can only claim rewards once per period.
- Reward periods must be finalized before rewards can be claimed.
- AI node verification is handled by a separate registry contract for separation of concerns.