# Governance Rewards Oracle Integration Guide

This document provides a technical guide for integrating the Oracle system with the Governance Rewards mechanism in the DLOOP protocol.

## System Components

The integration consists of the following components:

1. **IPriceOracle**: Interface defining the standard API for price data
2. **PriceOracle**: Implementation of the price oracle interface
3. **OracleAdapter**: Bridge between existing and new oracle interfaces
4. **OraclePriceEvaluator**: Connects oracles with governance evaluation
5. **ProposalTracker**: Tracks governance proposals and votes
6. **GovernanceRewards**: Distributes rewards based on decision correctness

## Integration Workflow

```
┌───────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌───────────────┐
│               │     │                 │     │               │     │               │
│  Governance   │────▶│ ProposalTracker │────▶│ OraclePriceEvaluator │────▶│ PriceOracle   │
│               │     │                 │     │               │     │               │
└───────────────┘     └─────────────────┘     └───────────────┘     └───────────────┘
                             │                       │
                             │                       │
                             ▼                       ▼
                      ┌───────────────┐     ┌───────────────┐
                      │               │     │               │
                      │ GovernanceRewards │◀────│  OracleAdapter │
                      │               │     │               │
                      └───────────────┘     └───────────────┘
```

### Step-by-Step Flow

1. **Governance Proposal Creation**:
   - A new investment or divestment proposal is created in the governance system
   - ProposalTracker records the proposal and associated asset

2. **Initial Price Recording**:
   - OraclePriceEvaluator is notified of the new proposal
   - OraclePriceEvaluator queries PriceOracle for the current asset price
   - The starting price and timestamp are stored for future evaluation

3. **Governance Voting**:
   - Participants vote on the proposal
   - ProposalTracker records votes and notifies GovernanceRewards
   - GovernanceRewards stores decisions for later evaluation

4. **Proposal Execution**:
   - After the voting period, the proposal is executed
   - The system waits for the evaluation delay period

5. **Price Evaluation**:
   - After the delay period, OraclePriceEvaluator queries PriceOracle for the current price
   - OraclePriceEvaluator compares current and initial prices to determine if price increased

6. **Decision Evaluation**:
   - OraclePriceEvaluator notifies ProposalTracker of the price movement
   - ProposalTracker marks the proposal as evaluated
   - GovernanceRewards evaluates all decisions related to the proposal

7. **Reward Distribution**:
   - Users can claim rewards for correct decisions after the epoch closes
   - GovernanceRewards calculates rewards based on correctness and participation

## Code Examples

### 1. Setting Up the Oracle System

```javascript
// Deploy price oracle
const PriceOracle = await ethers.getContractFactory("PriceOracle");
const priceOracle = await PriceOracle.deploy(admin.address, updateInterval);

// Add supported assets
await priceOracle.addAsset(assetAddress);
await priceOracle.grantPriceFeederRole(feederAddress);

// Deploy oracle evaluator
const OraclePriceEvaluator = await ethers.getContractFactory("OraclePriceEvaluator");
const evaluator = await OraclePriceEvaluator.deploy(
  admin.address,
  proposalTracker.address,
  priceOracle.address
);

// Update proposal tracker's oracle
await proposalTracker.updateOracle(evaluator.address);

// Grant evaluator access to governance rewards
await governanceRewards.grantOracleRole(evaluator.address);
```

### 2. Recording a Proposal and Initial Price

```javascript
// Create a proposal in governance
const proposalId = ethers.utils.id("proposal-1");
await governance.createProposal(proposalId, description, targets, values, calldatas);

// Record in proposal tracker
await proposalTracker.createProposal(proposalId, assetToken.address, true); // true = invest

// Record initial price
await evaluator.recordProposalStart(proposalId, assetToken.address);
```

### 3. Evaluating a Proposal Based on Price Movement

```javascript
// After delay period has passed
await evaluator.evaluateProposal(proposalId);

// Check evaluation results
const proposalData = await evaluator.proposalPriceData(proposalId);
console.log(`Initial price: ${ethers.utils.formatEther(proposalData.startPrice)}`);
console.log(`End price: ${ethers.utils.formatEther(proposalData.endPrice)}`);
console.log(`Was evaluated: ${proposalData.evaluated}`);

// Check decision correctness in governance rewards
const decisionId = "0x..."; // Decision ID from governance voting
const decision = await governanceRewards.decisions(decisionId);
console.log(`Decision was correct: ${decision.wasCorrect}`);
```

### 4. Claiming Rewards

```javascript
// After epoch closes
const epoch = await governanceRewards.currentEpoch() - 1;
const claimableAmount = await governanceRewards.getClaimableRewards(userAddress, epoch);
console.log(`Claimable rewards: ${ethers.utils.formatEther(claimableAmount)}`);

// Claim rewards
if (claimableAmount > 0) {
  await governanceRewards.claimRewards(epoch);
}
```

## Integration Test Example

Here's an example of an integration test verifying the correct operation of the entire system:

```javascript
it("should correctly evaluate and reward governance decisions", async function () {
  // 1. Create proposal
  const proposalId = ethers.utils.id("integration-test");
  await proposalTracker.createProposal(proposalId, testToken.address, true); // Investment proposal
  
  // 2. Record initial price
  await oraclePriceEvaluator.recordProposalStart(proposalId, testToken.address);
  
  // 3. Record votes
  const user1DecisionId = await proposalTracker.recordVote(proposalId, user1.address, true);  // Yes vote
  const user2DecisionId = await proposalTracker.recordVote(proposalId, user2.address, false); // No vote
  
  // 4. Wait for evaluation delay
  await ethers.provider.send("evm_increaseTime", [evaluationDelay + 1]);
  await ethers.provider.send("evm_mine");
  
  // 5. Update price (price increased)
  const newPrice = ethers.utils.parseEther("120"); // Initial was 100
  await priceOracle.connect(feeder).updatePrice(testToken.address, newPrice);
  
  // 6. Evaluate proposal
  await oraclePriceEvaluator.evaluateProposal(proposalId);
  
  // 7. Advance to next epoch
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]); // 30 days
  await ethers.provider.send("evm_mine");
  await governanceRewards.updateCurrentEpoch(); // This would be automatic in production
  
  // 8. Check reward eligibility
  const user1Reward = await governanceRewards.getClaimableRewards(user1.address, 1);
  const user2Reward = await governanceRewards.getClaimableRewards(user2.address, 1);
  
  // 9. Verify rewards
  expect(user1Reward).to.be.gt(0); // User1 (Yes on investment + price increase) = correct
  expect(user2Reward).to.equal(0);  // User2 (No on investment + price increase) = incorrect
  
  // 10. Claim rewards
  await governanceRewards.connect(user1).claimRewards(1);
  
  // 11. Verify DLOOP token balance increased
  expect(await dloopToken.balanceOf(user1.address)).to.equal(user1Reward);
});
```

## Deployment Checklist

Before deploying the integrated system, ensure the following:

1. **Price Oracle Configuration**:
   - All target assets are supported
   - Price feeders are configured with appropriate permissions
   - Update intervals and stale thresholds are properly set

2. **Evaluator Parameters**:
   - Evaluation delay is set appropriately (usually 7 days)
   - Price snapshot interval matches market dynamics

3. **Access Control**:
   - All contracts have correct role assignments
   - Oracle roles are granted to the evaluator
   - Admin roles are assigned to trusted addresses

4. **Integration Testing**:
   - Full proposal lifecycle has been tested
   - Edge cases (price stability, oracle failures) are handled
   - Gas optimization checks are complete

## Security Considerations

1. **Oracle Manipulation Protection**:
   - Use multiple price sources where possible
   - Implement circuit breakers for extreme price movements
   - Set reasonable update frequency limits

2. **Timing Attack Prevention**:
   - Use fixed evaluation delays to prevent gaming
   - Randomize evaluation timing slightly if possible
   - Monitor for suspicious voting patterns

3. **Access Control**:
   - Strictly limit price feed update permissions
   - Use multi-signature for admin functions
   - Implement time-locks for parameter changes

## Monitoring Recommendations

Once deployed, monitor the following:

1. **Price Data Quality**:
   - Freshness of price data
   - Deviation from other market sources
   - Update frequency and consistency

2. **Governance Activity**:
   - Proposal creation and voting patterns
   - Decision correctness rates
   - Reward distribution fairness

3. **System Performance**:
   - Gas costs for evaluation operations
   - Storage growth over time
   - Contract interaction bottlenecks

## Conclusion

The Oracle integration with Governance Rewards creates a powerful incentive mechanism that rewards participants for making correct decisions in price-sensitive governance scenarios. By following this integration guide, you can ensure that all components work together seamlessly to provide a fair, transparent, and effective reward system.