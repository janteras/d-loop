# AssetDAO Governance Rewards

This document provides technical details about the AssetDAO governance rewards system in the D-Loop Protocol.

## Overview

The D-Loop Protocol implements a unique governance rewards system where participants in AssetDAO governance are rewarded based on the outcomes of their investment and divestment decisions. This merit-based approach incentivizes quality participation in the governance process.

## Architecture

### Components

1. **AssetDAO Contract**: Manages proposals for investment and divestment decisions related to AI assets.
2. **GovernanceRewards Contract**: Calculates and distributes rewards based on proposal outcomes.
3. **DLOOP Token**: Used as the reward token for governance participation.
4. **Price Oracle**: Provides asset price data for determining proposal outcomes.

### Relationship Diagram

```
┌─────────────┐      ┌───────────────────┐      ┌───────────────┐
│   AssetDAO  │─────▶│ GovernanceRewards │─────▶│  DLOOP Token  │
└─────────────┘      └───────────────────┘      └───────────────┘
       │                       ▲
       │                       │
       ▼                       │
┌─────────────┐      ┌───────────────┐
│ Price Oracle │─────▶│ Proposal Data │
└─────────────┘      └───────────────┘
```

## AssetDAO vs. ProtocolDAO

It's important to understand the distinction between AssetDAO and ProtocolDAO in the D-Loop architecture:

- **AssetDAO**: Governs investment and divestment decisions for AI assets. Governance rewards are issued for AssetDAO proposals.
- **ProtocolDAO**: Governs protocol parameters, upgrades, and other administrative functions. No governance rewards are issued for ProtocolDAO governance.

## Reward Distribution Mechanism

### Reward Calculation

Rewards are calculated based on several factors:

1. **Base Reward**: The standard reward amount for participation
2. **Voting Participation Bonus**: Additional reward for high voting turnout
3. **Proposal Quality Multiplier**: Multiplier for proposals with strong consensus
4. **AI Node Multiplier**: Multiplier for AI node participation
5. **Reward Cap**: Maximum reward per distribution

The formula for calculating rewards is:

```
reward = baseReward
if (participationRate > 20%) {
    reward += baseReward * participationBonus / 10000
}
if (yesVotes > noVotes && yesVotesRatio > 75%) {
    reward = reward * qualityMultiplier / 10000
}
reward = min(reward, rewardCap)
```

### Reward Conditions

Rewards are distributed based on the quality and outcome of governance decisions:

1. **Investment Proposals**:
   - **Yes Vote + Price Increase**: Rewarded for generating profit
   - **No Vote + Price Decrease**: Rewarded for avoiding loss

2. **Divestment Proposals**:
   - **Yes Vote + Price Decrease**: Rewarded for avoiding further loss
   - **No Vote + Price Increase**: Rewarded for preserving profit

### Cooldown Period

To prevent reward farming, a cooldown period is enforced between reward distributions to the same proposer. This ensures that governance participants focus on quality proposals rather than quantity.

## Contract Interfaces

### AssetDAO

```solidity
function createProposal(
    ProposalType proposalType,
    address assetAddress,
    uint256 amount,
    string memory description
) external returns (uint256);

function vote(uint256 proposalId, bool support) external;

function executeProposal(uint256 proposalId) external;
```

### GovernanceRewards

```solidity
function distributeRewards(
    address proposer,
    uint256 yesVotes,
    uint256 noVotes,
    uint256 totalSupply
) external returns (uint256);

function updateRewardConfig(
    uint256 baseReward,
    uint256 votingParticipationBonus,
    uint256 proposalQualityMultiplier,
    uint256 aiNodeMultiplier,
    uint256 rewardCap
) external;

function setRewardCooldown(uint256 cooldown) external;
```

## Testing Strategy

The governance rewards system is tested through a combination of:

1. **Unit Tests**: Testing individual functions in isolation
2. **Integration Tests**: Testing the full flow from proposal creation to reward distribution
3. **Edge Case Tests**: Testing boundary conditions and unusual scenarios
4. **Parameterization Tests**: Testing the impact of parameter changes on reward outcomes
5. **Gas Optimization Tests**: Profiling gas usage and identifying optimization opportunities

For detailed testing information, refer to the [Testing Guide](/docs/testing/TESTING_GUIDE.md#assetdao-governance-rewards-testing).

## Best Practices

1. **Proposal Creation**:
   - Provide clear, detailed descriptions for proposals
   - Include relevant data to support investment/divestment decisions
   - Consider the timing of proposals in relation to market conditions

2. **Voting**:
   - Research proposals thoroughly before voting
   - Consider long-term impact rather than short-term gains
   - Participate in discussions to improve proposal quality

3. **Reward Distribution**:
   - Monitor reward parameters to ensure they incentivize desired behaviors
   - Adjust parameters based on governance participation metrics
   - Regularly audit reward distributions to ensure fairness

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Low participation rates | Increase voting participation bonus |
| Reward farming | Adjust cooldown period or reward cap |
| Skewed voting (all yes/no) | Review quality multiplier parameters |
| High gas costs | Optimize reward calculation logic |
| Inaccurate price data | Improve oracle implementation or add fallback mechanisms |

## Future Enhancements

1. **Quadratic Voting**: Implementing quadratic voting to prevent whale dominance
2. **Reputation System**: Adding a reputation score based on governance history
3. **Delegation**: Allowing token holders to delegate voting power
4. **Prediction Markets**: Integrating prediction markets for proposal outcomes
5. **Multi-tier Rewards**: Implementing different reward tiers based on proposal complexity

## References

- [D-Loop Whitepaper](/d-loop-whitepaper.md)
- [AssetDAO Contract Documentation](/docs/contracts/AssetDAO.md)
- [GovernanceRewards Contract Documentation](/docs/contracts/GovernanceRewards.md)
- [Testing Guide](/docs/testing/TESTING_GUIDE.md)
