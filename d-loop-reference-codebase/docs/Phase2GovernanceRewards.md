# Asset Governance Rewards Implementation Plan

## Overview

This document outlines the detailed implementation plan for Asset Governance Rewards in the DLOOP protocol. The rewards system is designed to incentivize high-quality governance participation by distributing tokens to participants who make correct governance decisions, particularly in price-sensitive voting scenarios.

## Reward Parameters

### Distribution Parameters
- **Total Monthly Distribution**: 278,000 DLOOP tokens
- **Distribution Timeframe**: Approximately 6 years
- **Distribution Sources**: 30% from collected fees, remainder from allocation

### Reward Eligibility
- **Participation Requirement**: Vote in governance proposals
- **Correctness Requirement**: Vote aligned with actual price outcomes
- **Minimum Threshold**: Must achieve >50% correctness rate

## Core Components

### 1. RewardDistributor Contract

The RewardDistributor will track governance participation, evaluate vote correctness, and distribute rewards.

#### Key Functions:
- `recordVote(uint256 proposalId, address voter, bool support)`
- `evaluateOutcome(uint256 proposalId, int256 priceMovement)`
- `calculateRewards(address voter, uint256 epoch) → uint256`
- `distributeRewards(address[] calldata voters, uint256 epoch)`
- `claimReward(uint256 epoch)`

#### Storage Variables:
```solidity
struct RewardDistributorStorage {
    mapping(uint256 => ProposalData) proposals;           // Proposal tracking
    mapping(address => mapping(uint256 => VoteRecord)) votes;  // Voter tracking by proposal
    mapping(address => mapping(uint256 => RewardRecord)) rewards; // Rewards by voter and epoch
    mapping(uint256 => uint256) totalEpochRewards;        // Total rewards per epoch
    mapping(uint256 => bool) epochClosed;                 // Epoch distribution status
    uint256 monthlyRewardAmount;                          // Base monthly distribution
    uint256 currentEpoch;                                 // Current reward epoch
    address rewardToken;                                  // DLOOP token address
    address rateOracle;                                   // Price oracle address
}

struct ProposalData {
    bool evaluated;             // Whether proposal outcome has been evaluated
    bool outcomePositive;       // True if price went up, false if down
    uint256 votingEndTime;      // When voting ends
    uint256 outcomeEvaluationTime;  // When outcome was evaluated
    uint256 totalVotes;         // Number of votes cast
}

struct VoteRecord {
    bool hasVoted;              // Whether the address voted
    bool support;               // How they voted
    bool wasCorrect;            // Whether vote matched outcome
    uint256 weight;             // Vote weight (for weighted rewards)
}

struct RewardRecord {
    uint256 amount;             // Reward amount
    bool claimed;               // Whether reward was claimed
}
```

### 2. RateOracleIntegration Contract

Interface for accessing price data to determine correct voting outcomes.

#### Key Functions:
- `getLatestPrice(address token) → int256`
- `getPriceAtTime(address token, uint256 timestamp) → int256`
- `getPriceChange(address token, uint256 startTime, uint256 endTime) → int256`

#### Storage Variables:
```solidity
struct RateOracleStorage {
    mapping(address => address) tokenFeeds;  // Price feed by token
    address defaultFeed;                     // Default price feed
    bool useMedianPrice;                     // Whether to use median of multiple prices
}
```

## Integration Points

### Governance Contract Integration

1. **Record Votes**
   ```solidity
   function castVote(uint256 proposalId, bool support) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Record vote for rewards
       if (s.rewardDistributor != address(0)) {
           IRewardDistributor(s.rewardDistributor).recordVote(
               proposalId,
               msg.sender,
               support
           );
       }
       
       // Continue with regular voting process
       _castVote(proposalId, msg.sender, support);
   }
   ```

2. **Proposal Execution**
   ```solidity
   function executeProposal(uint256 proposalId) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Execute the proposal
       _executeProposal(proposalId);
       
       // Record initial price for outcome evaluation
       if (s.rewardDistributor != address(0) && proposal.isPriceProposal) {
           IRewardDistributor(s.rewardDistributor).recordInitialPrice(
               proposalId,
               proposal.targetToken
           );
       }
   }
   ```

### FeeCollector Integration

```solidity
function collectFee(address token, uint256 amount) external returns (uint256 treasuryAmount, uint256 rewardsAmount) {
    FeeCollectorStorage storage s = diamondStorage();
    
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
```

## Implementation Steps

### Week 5: RewardDistributor Core

#### Day 1-2: Design & Documentation
- Define reward tracking and distribution mechanism
- Document vote recording process
- Design price outcome evaluation system

#### Day 3-5: Implementation
1. Create RewardDistributor contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
   
   interface IRateOracle {
       function getLatestPrice(address token) external view returns (int256);
       function getPriceAtTime(address token, uint256 timestamp) external view returns (int256);
       function getPriceChange(address token, uint256 startTime, uint256 endTime) external view returns (int256);
   }
   
   contract RewardDistributor {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.reward.distributor.storage");
       
       event VoteRecorded(uint256 indexed proposalId, address indexed voter, bool support);
       event OutcomeEvaluated(uint256 indexed proposalId, bool outcome, int256 priceMovement);
       event RewardsCalculated(uint256 indexed epoch, address indexed voter, uint256 amount);
       event RewardsClaimed(uint256 indexed epoch, address indexed voter, uint256 amount);
       event EpochClosed(uint256 indexed epoch, uint256 totalDistributed);
       
       struct RewardDistributorStorage {
           mapping(uint256 => ProposalData) proposals;
           mapping(address => mapping(uint256 => VoteRecord)) votes;
           mapping(address => mapping(uint256 => RewardRecord)) rewards;
           mapping(uint256 => uint256) totalEpochRewards;
           mapping(uint256 => bool) epochClosed;
           uint256 monthlyRewardAmount;
           uint256 currentEpoch;
           address rewardToken;
           address rateOracle;
       }
       
       struct ProposalData {
           bool evaluated;
           bool outcomePositive;
           uint256 votingEndTime;
           uint256 outcomeEvaluationTime;
           uint256 totalVotes;
           address targetToken;
           int256 initialPrice;
           int256 finalPrice;
           uint256 epoch;
       }
       
       struct VoteRecord {
           bool hasVoted;
           bool support;
           bool wasCorrect;
           uint256 weight;
       }
       
       struct RewardRecord {
           uint256 amount;
           bool claimed;
       }
       
       function diamondStorage() internal pure returns (RewardDistributorStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(
           address _rewardToken,
           address _rateOracle,
           uint256 _monthlyRewardAmount
       ) external {
           RewardDistributorStorage storage s = diamondStorage();
           require(s.rewardToken == address(0), "Already initialized");
           
           s.rewardToken = _rewardToken;
           s.rateOracle = _rateOracle;
           s.monthlyRewardAmount = _monthlyRewardAmount;
           s.currentEpoch = 1;
       }
       
       function recordVote(
           uint256 proposalId,
           address voter,
           bool support
       ) external {
           // Access control would be implemented here
           RewardDistributorStorage storage s = diamondStorage();
           
           // Initialize proposal data if new
           if (s.proposals[proposalId].votingEndTime == 0) {
               s.proposals[proposalId].votingEndTime = block.timestamp + 7 days; // Default
               s.proposals[proposalId].epoch = s.currentEpoch;
           }
           
           // Record vote if not already voted
           if (!s.votes[voter][proposalId].hasVoted) {
               s.votes[voter][proposalId].hasVoted = true;
               s.votes[voter][proposalId].support = support;
               s.votes[voter][proposalId].weight = 1; // Basic weight for now
               s.proposals[proposalId].totalVotes += 1;
               
               emit VoteRecorded(proposalId, voter, support);
           }
       }
       
       function recordInitialPrice(uint256 proposalId, address targetToken) external {
           // Access control would be implemented here
           RewardDistributorStorage storage s = diamondStorage();
           require(!s.proposals[proposalId].evaluated, "Already evaluated");
           
           s.proposals[proposalId].targetToken = targetToken;
           s.proposals[proposalId].initialPrice = IRateOracle(s.rateOracle).getLatestPrice(targetToken);
       }
       
       function evaluateOutcome(uint256 proposalId) external {
           RewardDistributorStorage storage s = diamondStorage();
           ProposalData storage proposal = s.proposals[proposalId];
           
           require(!proposal.evaluated, "Already evaluated");
           require(block.timestamp >= proposal.votingEndTime, "Voting still active");
           require(proposal.initialPrice != 0, "Initial price not recorded");
           
           // Get current price
           int256 currentPrice = IRateOracle(s.rateOracle).getLatestPrice(proposal.targetToken);
           proposal.finalPrice = currentPrice;
           
           // Determine outcome
           int256 priceMovement = currentPrice - proposal.initialPrice;
           proposal.outcomePositive = priceMovement > 0;
           proposal.evaluated = true;
           proposal.outcomeEvaluationTime = block.timestamp;
           
           // Update all voter records for correctness
           // In a real implementation, this would be done in batches or off-chain
           // For demonstration, we're showing direct evaluation
           for (uint256 i = 0; i < proposal.totalVotes; i++) {
               // This assumes we have a way to iterate through voters
               // In practice, we'd use a different mechanism
               address voter = address(0); // Placeholder
               
               if (s.votes[voter][proposalId].hasVoted) {
                   bool voterWasCorrect = s.votes[voter][proposalId].support == proposal.outcomePositive;
                   s.votes[voter][proposalId].wasCorrect = voterWasCorrect;
               }
           }
           
           emit OutcomeEvaluated(proposalId, proposal.outcomePositive, priceMovement);
       }
       
       function calculateRewards(address voter, uint256 epoch) public view returns (uint256) {
           RewardDistributorStorage storage s = diamondStorage();
           
           uint256 totalCorrectVotes = 0;
           uint256 totalVotes = 0;
           
           // Calculate reward based on correctness
           // In a real implementation, this would be optimized
           for (uint256 i = 1; i <= 1000; i++) { // Assumption for iteration
               if (s.proposals[i].epoch == epoch && s.proposals[i].evaluated) {
                   if (s.votes[voter][i].hasVoted) {
                       totalVotes += s.votes[voter][i].weight;
                       if (s.votes[voter][i].wasCorrect) {
                           totalCorrectVotes += s.votes[voter][i].weight;
                       }
                   }
               }
           }
           
           // No votes, no rewards
           if (totalVotes == 0) {
               return 0;
           }
           
           // Require >50% correctness for rewards
           uint256 correctnessRatio = (totalCorrectVotes * 100) / totalVotes;
           if (correctnessRatio <= 50) {
               return 0;
           }
           
           // Basic reward calculation
           uint256 baseReward = s.monthlyRewardAmount / 100; // Simplified
           uint256 reward = (baseReward * totalCorrectVotes * correctnessRatio) / 10000;
           
           return reward;
       }
       
       function distributeRewards(address[] calldata voters, uint256 epoch) external {
           RewardDistributorStorage storage s = diamondStorage();
           require(!s.epochClosed[epoch], "Epoch already closed");
           require(epoch < s.currentEpoch, "Epoch still active");
           
           uint256 totalDistributed = 0;
           
           for (uint256 i = 0; i < voters.length; i++) {
               address voter = voters[i];
               
               // Skip if already calculated
               if (s.rewards[voter][epoch].amount > 0) {
                   continue;
               }
               
               uint256 reward = calculateRewards(voter, epoch);
               if (reward > 0) {
                   s.rewards[voter][epoch].amount = reward;
                   totalDistributed += reward;
                   
                   emit RewardsCalculated(epoch, voter, reward);
               }
           }
           
           s.totalEpochRewards[epoch] = totalDistributed;
           s.epochClosed[epoch] = true;
           
           emit EpochClosed(epoch, totalDistributed);
       }
       
       function claimReward(uint256 epoch) external {
           RewardDistributorStorage storage s = diamondStorage();
           require(s.epochClosed[epoch], "Epoch not closed yet");
           require(s.rewards[msg.sender][epoch].amount > 0, "No rewards to claim");
           require(!s.rewards[msg.sender][epoch].claimed, "Rewards already claimed");
           
           uint256 amount = s.rewards[msg.sender][epoch].amount;
           s.rewards[msg.sender][epoch].claimed = true;
           
           IERC20(s.rewardToken).transfer(msg.sender, amount);
           
           emit RewardsClaimed(epoch, msg.sender, amount);
       }
       
       function advanceEpoch() external {
           // Access control would be implemented here
           diamondStorage().currentEpoch += 1;
       }
       
       function getEpochRewards(uint256 epoch) external view returns (uint256) {
           return diamondStorage().totalEpochRewards[epoch];
       }
       
       function getCurrentEpoch() external view returns (uint256) {
           return diamondStorage().currentEpoch;
       }
       
       function getVoterReward(address voter, uint256 epoch) external view returns (uint256, bool) {
           RewardDistributorStorage storage s = diamondStorage();
           return (s.rewards[voter][epoch].amount, s.rewards[voter][epoch].claimed);
       }
   }
   ```

2. Develop vote tracking and outcome evaluation
3. Create unit tests for reward calculations

#### Day 6-7: Price Monitoring
1. Implement RateOracleIntegration contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   
   interface IAggregatorV3 {
       function latestRoundData() external view returns (
           uint80 roundId,
           int256 answer,
           uint256 startedAt,
           uint256 updatedAt,
           uint80 answeredInRound
       );
       function getRoundData(uint80 _roundId) external view returns (
           uint80 roundId,
           int256 answer,
           uint256 startedAt,
           uint256 updatedAt,
           uint80 answeredInRound
       );
   }
   
   contract RateOracleIntegration {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.rate.oracle.storage");
       
       struct RateOracleStorage {
           mapping(address => address) tokenFeeds;
           address defaultFeed;
           bool useMedianPrice;
       }
       
       function diamondStorage() internal pure returns (RateOracleStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(address _defaultFeed) external {
           RateOracleStorage storage s = diamondStorage();
           require(s.defaultFeed == address(0), "Already initialized");
           
           s.defaultFeed = _defaultFeed;
           s.useMedianPrice = false;
       }
       
       function setTokenFeed(address token, address feed) external {
           // Access control would be implemented here
           diamondStorage().tokenFeeds[token] = feed;
       }
       
       function setUseMedianPrice(bool useMedian) external {
           // Access control would be implemented here
           diamondStorage().useMedianPrice = useMedian;
       }
       
       function getLatestPrice(address token) external view returns (int256) {
           RateOracleStorage storage s = diamondStorage();
           address feedAddress = s.tokenFeeds[token];
           
           if (feedAddress == address(0)) {
               feedAddress = s.defaultFeed;
           }
           
           require(feedAddress != address(0), "No feed available");
           
           (
               ,
               int256 price,
               ,
               ,
               
           ) = IAggregatorV3(feedAddress).latestRoundData();
           
           return price;
       }
       
       function getPriceAtTime(address token, uint256 timestamp) external view returns (int256) {
           // This is a simplified implementation
           // In practice, would use historical data from oracle
           return getLatestPrice(token);
       }
       
       function getPriceChange(address token, uint256 startTime, uint256 endTime) external view returns (int256) {
           int256 startPrice = this.getPriceAtTime(token, startTime);
           int256 endPrice = this.getPriceAtTime(token, endTime);
           
           return endPrice - startPrice;
       }
   }
   ```

2. Create mechanisms for determining correct votes
3. Test price change evaluation in different scenarios

### Week 6: Governance Integration and Distribution

#### Day 1-2: Design & Documentation
- Define integration points with Governance
- Document reward distribution rules
- Design reward claiming process

#### Day 3-5: Implementation
1. Modify Governance to record votes with RewardDistributor
   ```solidity
   // Governance.sol modifications
   
   // Add RewardDistributor interface
   interface IRewardDistributor {
       function recordVote(uint256 proposalId, address voter, bool support) external;
       function recordInitialPrice(uint256 proposalId, address targetToken) external;
   }
   
   // Add storage variables
   struct GovernanceStorage {
       // Existing storage variables
       address rewardDistributor;
       // Add price-sensitive flag to proposals
       struct Proposal {
           // Existing properties
           bool isPriceProposal;
           address targetToken;
       }
   }
   
   // Update functions
   function createProposal(
       string calldata title,
       string calldata description,
       bytes[] calldata calldatas,
       address[] calldata targets,
       bool isPriceProposal,
       address targetToken
   ) external returns (uint256) {
       GovernanceStorage storage s = diamondStorage();
       
       // Create proposal
       uint256 proposalId = _createProposal(
           title,
           description,
           calldatas,
           targets
       );
       
       // Set price-sensitive flags
       s.proposals[proposalId].isPriceProposal = isPriceProposal;
       s.proposals[proposalId].targetToken = targetToken;
       
       return proposalId;
   }
   
   function castVote(uint256 proposalId, bool support) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Record vote for rewards
       if (s.rewardDistributor != address(0)) {
           IRewardDistributor(s.rewardDistributor).recordVote(
               proposalId,
               msg.sender,
               support
           );
       }
       
       // Continue with regular voting process
       _castVote(proposalId, msg.sender, support);
   }
   
   function executeProposal(uint256 proposalId) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Execute the proposal
       _executeProposal(proposalId);
       
       // Record initial price for outcome evaluation
       if (s.rewardDistributor != address(0) && proposal.isPriceProposal) {
           IRewardDistributor(s.rewardDistributor).recordInitialPrice(
               proposalId,
               proposal.targetToken
           );
       }
   }
   
   // Add setter for RewardDistributor
   function setRewardDistributor(address _rewardDistributor) external {
       // Access control will be handled in diamond facet
       GovernanceStorage storage s = diamondStorage();
       s.rewardDistributor = _rewardDistributor;
   }
   ```

2. Implement periodic reward distribution
3. Create reward claiming functionality

#### Day 6-7: Fee Integration
1. Connect RewardDistributor to FeeCollector
2. Test end-to-end reward flow
3. Verify distribution calculations and claiming process

## Testing Strategy

### Unit Testing
1. **RewardDistributor Tests**
   - Vote recording and tracking
   - Outcome evaluation based on price movements
   - Reward calculation with different correctness rates
   - Claiming and distribution mechanisms

2. **RateOracle Tests**
   - Price retrieval and calculation
   - Feed switching and fallback mechanism
   - Historical price evaluation

3. **Integration Tests**
   - End-to-end governance flow with reward tracking
   - Fee collection and reward distribution
   - Epoch transitions and reward periods

### Property-Based Testing
1. **Invariants**
   - Total rewards distributed in an epoch never exceed monthly allocation
   - Rewards are only distributed for closed epochs
   - Voter cannot claim reward twice

2. **Security Properties**
   - Only authorized roles can evaluate outcomes
   - Only authorized roles can distribute rewards
   - Price feeds cannot be manipulated to affect reward distribution

## Deployment Plan

### 1. Testnet Deployment
- Deploy RateOracleIntegration with test feeds
- Deploy RewardDistributor with configurable parameters
- Integrate with existing Governance and FeeCollector
- Run simulated voting and reward cycles

### 2. Mainnet Deployment
- Deploy contracts with verified price feeds
- Begin with reduced reward allocation for first month
- Gradually increase to target distribution rate

## Governance Controls

1. **Reward Parameter Adjustments**
   - Monthly reward amount adjustable by governance
   - Correctness threshold adjustable by governance
   - Epoch duration adjustable by governance

2. **Oracle Configuration**
   - Price feed addresses managed by governance
   - Outcome evaluation parameters adjustable by governance

## Conclusion

This implementation plan provides a comprehensive approach to implementing Asset Governance Rewards in the DLOOP protocol. The RewardDistributor and RateOracleIntegration contracts provide a flexible system for tracking governance participation, evaluating vote correctness, and distributing rewards based on merit. Integration with the existing Governance and fee system ensures seamless operation and incentive alignment throughout the protocol.