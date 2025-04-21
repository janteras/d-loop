# D-LOOP Governance Rewards System

This document outlines the governance rewards system for the D-LOOP protocol.

## Overview

The governance rewards system incentivizes participation in the D-LOOP protocol governance by distributing DLOOP tokens to users who make correct governance decisions, with special incentives for verified AI nodes.

### Key Components

1. **RewardDistributor**: Tracks governance decisions and distributes rewards.
2. **AINodeIdentifier**: Verifies AI nodes eligible for bonus rewards.
3. **SoulboundNFT**: Non-transferable token used to identify verified AI nodes.

## Reward Distribution

### Total Supply and Distribution Schedule

- **Total Rewards**: 20,016,000 DLOOP tokens
- **Monthly Distribution**: 278,000 DLOOP tokens
- **Distribution Period**: 6 years (72 months)

### Decision Tracking

The system tracks:

- Which users participate in governance decisions
- Whether their decisions were correct (aligned with eventual outcomes)
- Total correct decisions in each distribution period (month)

### Reward Calculation

Rewards are distributed proportionally based on:

1. Number of correct decisions made by each user
2. Total correct decisions made by all users
3. AI node status (20% bonus for verified AI nodes)

For each user, the reward is calculated as:

```
userReward = monthlyReward * (userCorrectDecisions / totalCorrectDecisions) * aiNodeMultiplier
```

Where:
- `aiNodeMultiplier` is 1.2 for verified AI nodes and 1.0 for regular users

## AI Node Verification

AI nodes are special participants in the governance system that receive additional rewards.

### Verification Process

1. AI nodes are nominated by the committee
2. Committee members approve AI node nominations
3. Approved AI nodes receive a Soulbound NFT as verification
4. The Soulbound NFT cannot be transferred, ensuring verification integrity

### AI Node Benefits

- 20% bonus on governance rewards
- Potential for specialized roles in future governance decisions

## Implementation Details

### RewardDistributor

The RewardDistributor contract:

- Tracks correct decisions for each user
- Manages the list of active users in each period
- Distributes rewards at the end of each period
- Resets tracking data for the next period

### AINodeIdentifier

The AINodeIdentifier contract:

- Manages the committee of verifiers
- Processes AI node nominations and approvals
- Issues Soulbound NFTs to verified AI nodes
- Provides verification status to other contracts

### SoulboundNFT

The SoulboundNFT contract:

- Implements the ERC-721 standard
- Prevents transfers through the `_beforeTokenTransfer` hook
- Can only be minted by authorized minters (AINodeIdentifier)

## Integration with Fee Structure

The governance rewards system integrates with the fee structure:

1. 30% of all fees collected are sent to the RewardDistributor
2. These funds supplement the scheduled DLOOP token rewards
3. This creates a sustainable reward mechanism beyond the initial distribution

## Role-Based Access Control

The rewards system implements role-based access control:

- **DEFAULT_ADMIN_ROLE**: Can manage all roles
- **REWARD_ADMIN_ROLE**: Can pause/unpause the contract
- **PROTOCOL_DAO_ROLE**: For future governance integration
- **ASSET_DAO_ROLE**: Can record governance decisions

## Using the Rewards System

To integrate with the governance rewards system:

1. Deploy SoulboundNFT
2. Deploy AINodeIdentifier linked to SoulboundNFT
3. Deploy RewardDistributor linked to AINodeIdentifier and DLOOP token
4. Grant ASSET_DAO_ROLE to contracts that need to record decisions
5. Record governance decisions through the recordDecision function
6. Call distributeMonthlyRewards at the end of each month

### Recording Decisions

Decisions are recorded by calling:

```solidity
function recordDecision(address user, uint256 proposalId, bool isCorrect)
```

Where:
- `user` is the address that made the decision
- `proposalId` is the unique identifier for the proposal
- `isCorrect` indicates whether the decision was correct

## Security Considerations

- Only addresses with ASSET_DAO_ROLE can record decisions
- Each decision can only be processed once
- The contract can be paused in emergencies
- Reward distribution requires that the month has ended
- Rewards are only distributed if there were correct decisions

## Future Enhancements

The rewards system is designed to support future enhancements:

- Integration with additional governance mechanisms
- Support for different types of governance decisions
- Variable reward weights based on decision importance
- Adjustable AI node bonus based on performance

## Testing and Verification

The RewardDistributor.test.js script verifies:

- Correct recording of governance decisions
- Proper reward calculation and distribution
- AI node bonus application
- Role-based access control enforcement