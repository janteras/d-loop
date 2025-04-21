# Asset Governance Rewards Mechanism

## Overview

The Asset Governance Rewards mechanism is designed to incentivize active and high-quality participation in the DLOOP Asset DAO governance process. By rewarding voters who contribute meaningfully to governance decisions, we aim to increase participation rates, improve decision quality, and align stakeholder incentives.

## Core Principles

1. **Merit-Based Rewards**: Rewards are distributed based on the quality and quantity of participation, not just token holdings.
2. **Sustainability**: The total reward budget is capped to ensure long-term sustainability.
3. **Proportionality**: Larger and more impactful proposals have proportionally larger reward pools.
4. **Long-Term Alignment**: Vesting periods encourage continued participation and alignment with long-term protocol interests.

## Reward Mechanism Design

### Reward Eligibility

- Voters must meet a minimum threshold of votes to qualify for rewards
- Both positive and negative votes are eligible for rewards
- Participation in multiple proposals increases reward potential

### Reward Calculation

Rewards are calculated based on:
1. Individual voter's proportion of total votes for a proposal
2. The importance/value of the proposal (determined by stake amount)
3. The quality of voter participation (consistent history, proposal outcomes)

### Constraints and Limits

- Total rewards capped at 5% of total DLOOP token supply
- Individual voter rewards capped to prevent concentration
- 90-day vesting period to encourage long-term alignment
- Slashing conditions for malicious behavior

## Property-Based Testing

We've implemented comprehensive property-based testing with Echidna to validate the core properties of the reward mechanism:

### Properties Verified

1. **Budget Compliance**: Total rewards never exceed the maximum budget allocation
   ```solidity
   function echidna_total_rewards_within_budget() public view returns (bool) {
       uint256 maxBudget = (dloopToken.totalSupply() * MAX_REWARD_BUDGET_PERCENTAGE) / 100;
       return totalRewardsDistributed <= maxBudget;
   }
   ```

2. **Individual Limits**: No individual can receive excessive rewards
   ```solidity
   function echidna_individual_rewards_within_limit() public view returns (bool) {
       address[5] memory testUsers = [
           address(0x1), address(0x2), address(0x3), address(0x4), address(0x5)
       ];
       
       for (uint i = 0; i < testUsers.length; i++) {
           if (voterRewards[testUsers[i]] > MAX_REWARD_PER_VOTER * 10**18) {
               return false;
           }
       }
       return true;
   }
   ```

3. **Minimum Participation**: Rewards are only given to voters meeting minimum participation levels
   ```solidity
   function echidna_rewards_require_minimum_votes() public view returns (bool) {
       // Verify that rewarded users have met the minimum threshold
       // Logic checks voting history for each rewarded user
       // ...
   }
   ```

4. **Vesting Enforcement**: All rewards have appropriate vesting periods
   ```solidity
   function echidna_vesting_periods_enforced() public view returns (bool) {
       // Verify that vesting periods are correctly applied
       // ...
   }
   ```

5. **Proportional Reward Pools**: Higher value proposals have larger reward pools
   ```solidity
   function echidna_reward_pools_proportional() public view returns (bool) {
       // Verify that reward pools scale with proposal importance
       // ...
   }
   ```

## Implementation Considerations

The implementation of Asset Governance Rewards will require:

1. **Storage Efficiency**: Optimized storage patterns for tracking voting history and rewards
2. **Gas Optimization**: Batch distribution mechanisms to reduce gas costs
3. **Sybil Resistance**: Mechanisms to prevent reward farming through vote splitting
4. **Integration with Existing Voting**: Seamless integration with AssetDAO voting processes
5. **Cross-Chain Support**: Compatible reward distribution across Ethereum and Hedera

## Phase 2 Implementation Plan

During Phase 2, we will implement the Asset Governance Rewards mechanism with the following key components:

1. **RewardDistributor Contract**: Manages the reward pool and distribution logic
2. **VotingHistoryRegistry**: Tracks user participation across proposals
3. **VestingVault**: Handles vesting schedules for distributed rewards
4. **Integration with AssetDAO**: Add reward calculation hooks to the voting process

## Test Coverage

The property-based tests verify the following aspects:

- Economic security (no excessive rewards)
- Correct reward calculation
- Appropriate vesting enforcement
- Protection against manipulation tactics

These tests complement traditional unit tests by exploring the full state space of possible interactions with the reward mechanism.