# DLOOP Contract Architecture Analysis

## System Overview

The DLOOP smart contract system implements a dual-DAO governance structure:

1. **AssetDAO**: Controls asset management (investments/divestments)
2. **ProtocolDAO**: Controls protocol governance (upgrades, parameters)

These DAOs are separate systems connected by a common governance token (DLOOP).

## Token System

### DLOOP Token

- **Standard**: ERC-20 (Ethereum) / HTS (Hedera)
- **Purpose**: Governance token used for voting in both DAOs
- **Rewards**: Merit-based distribution for successful governance decisions
- **Cross-Chain**: Functions identically on both Ethereum and Hedera

### D-AI Token

- **Standard**: ERC-20 (Ethereum) / HTS (Hedera)
- **Purpose**: Asset index token representing proportional ownership
- **Minting**: Only through approved investment proposals
- **Burning**: Only through approved divestment proposals
- **Pricing**: Calculated based on underlying asset values

## AssetDAO Architecture

### Core Components

- **Proposal System**: For invest/divest decisions
- **Voting Mechanism**: Token-weighted, time-bound
- **Treasury**: Holds and manages underlying assets
- **D-AI Tokens**: Represents ownership of the asset pool

### Proposal Creation & Execution Flow

1. **Initiation**:
   - User with PROPOSER role calls `createProposal`
   - Provides description and encoded action data

2. **Data Encoding**:
   - Investment: `(0, tokenAddress, amount)`
   - Divestment: `(1, tokenAddress, amount)`

3. **Storage**:
   - Assigns unique proposal ID
   - Stores in Diamond Storage pattern
   - Emits `ProposalCreated` event
   - Sets `ACTIVE` status

4. **Voting Period** (typically 7 days):
   - DLOOP holders call `vote` with proposal ID and vote (YES/NO)
   - Vote weight equals DLOOP balance
   - Prevents double voting

5. **Execution**:
   - After voting period + execution delay (1 day)
   - Anyone can call `executeProposal` (proposer has priority period)
   - Checks: voting ended, YES > NO, quorum met
   - For investments: Transfers tokens from treasury, mints D-AI
   - For divestments: Burns D-AI, transfers proportional assets
   - Changes status to `EXECUTED`

### Fee Structure (Phase 2)

- **Invest Fee**: Applied when adding assets to pool
- **Divest Fee**: Applied when removing assets from pool
- **Ragequit Fee**: Higher fee for emergency withdrawals
- **Adjustment Limit**: ±0.05% per epoch maximum change

## ProtocolDAO Architecture

### Core Components

- **Proposal System**: For protocol governance
- **Executer Contracts**: Specialized implementation contracts
- **Dual Voting Tracks**: Different rules for AI vs. human submitters

### Proposal Creation & Execution Flow

1. **Initiation**:
   - User/AI calls `submitProposal`
   - Specifies whitelisted executer contract

2. **Executer Specification**:
   - `UpgradeExecuter`: For upgrading proxy contracts
   - `ParameterAdjuster`: For modifying system parameters
   - `EmergencyPauser`: For emergency protocol halting

3. **Storage**:
   - Assigns unique proposal ID
   - Stores with executer address
   - Sets expiration and timelock based on submitter type

4. **Voting Period**:
   - AI proposals: 1-day voting, 40% quorum
   - Human proposals: 7-day voting, 30% quorum
   - DLOOP holders call `vote`

5. **Execution**:
   - After voting + timelock (24 hours)
   - Anyone can call `executeProposal`
   - Checks: not executed, timelock passed, YES > NO, quorum met
   - Calls `execute()` on specified executer contract

### Executer Contracts

- **UpgradeExecuter**: Upgrades proxy contracts
- **ParameterAdjuster**: Updates system parameters
- **EmergencyPauser**: Handles emergency situations

## Technical Implementation

### Diamond Storage Pattern

- **Purpose**: Ensures upgrade safety and storage isolation
- **Implementation**: Namespaced storage slots via keccak256
- **Benefits**: Prevents storage collisions, preserves data during upgrades
- **Isolation**: AssetDAO and ProtocolDAO have completely separate storage

### Access Control

- **Role-Based**: Uses OpenZeppelin AccessControl
- **Key Roles**:
  - ADMIN: Protocol maintenance
  - PROPOSER: Can create proposals
  - EXECUTOR: Special execution privileges

### Oracle System

- **Price Feeds**: For asset valuation
- **Circuit Breaker**: Prevents price manipulation
- **Multi-Oracle**: Fallbacks for reliability
- **Freshness Checks**: Prevents stale data usage

### Upgrade Safety

- **Proxy Pattern**: For upgradeability
- **Initializer Pattern**: Prevents re-initialization
- **Function Selector Validation**: Prevents selector collisions
- **Storage Layout Integrity**: Preserves data during upgrades

## Fee Implementation Strategy

### Key Integration Points

1. **AssetDAO Storage**: Add fee parameters to Diamond Storage
2. **Investment Flow**: 
   - Calculate fee during `executeProposal`
   - Apply fee before D-AI minting
3. **Divestment Flow**:
   - Calculate fee during `executeProposal`
   - Apply fee before token transfer
4. **Governance Control**:
   - Add functions to adjust fee parameters
   - Implement safety limits and gradual adjustment caps

### Recommended Fee Structure

1. **Invest Fee**: 
   - Default: 0.1%
   - Maximum: 10%
   - Used when adding assets to pool

2. **Divest Fee**: 
   - Default: 0.1%
   - Maximum: 10%
   - Used for standard governance-approved withdrawals

3. **Ragequit Fee**: 
   - Default: 5%
   - Maximum: 30%
   - Used for emergency withdrawals

### Implementation Considerations

1. **Access Control**: Only governance can modify fees
2. **Rate Limiting**: Maximum change of 0.05% per 30 days
3. **Fee Calculation**: Fixed-point math with 18 decimals (1e18 = 100%)
4. **Fee Recipient**: Configurable via governance
5. **Transparency**: Events for fee changes and collection

## Security Considerations

### Priority Risks

1. **Oracle Manipulation**: Circuit breakers and multi-source validation
2. **Stale Data**: Freshness checks and expiration policies
3. **Storage Collisions**: Diamond Storage pattern namespacing
4. **Access Control Bypass**: Role-based permissions with hierarchies
5. **Governance Attacks**: Quorum requirements and timelocks

### Mitigations

1. **Timelocks**: Prevent rushed executions
2. **Circuit Breakers**: Auto-pause on anomalies
3. **Multi-Oracle Feeds**: Price reliability through multiple sources
4. **Role Separation**: Function-specific permissions
5. **Emergency Pause**: Protocol-wide halt in critical situations

## Phase 2 Implementation Features

### DLOOP Asset Governance Rewards

- **Purpose**: Incentivize good voting decisions
- **Conditions**:
  - Invest YES + Price Increase = Reward
  - Invest NO + Price Decrease = Reward
  - Divest YES + Price Decrease = Reward
  - Divest NO + Price Increase = Reward
- **Distribution**:
  - 20,016,000 DLOOP (20.016% of total supply)
  - 2160 days distribution (~6 years)
  - 278,000 DLOOP every 30 days

### AI Voting in ProtocolDAO

- **AI Nodes**: 1-day voting period, 40% quorum
- **Human Submissions**: 7-day voting period, 30% quorum
- **Verification**: AI node registry validation

### Hedera Testnet Integration

- **Cross-Chain**: Identical functionality on Ethereum and Hedera
- **Token Mapping**: ERC-20 to HTS token mapping
- **Unified Governance**: Coordinated proposals across chains

## Next Steps

1. **Complete Phase 1 Analysis**: Finalize contract understanding
2. **Develop Test Suite**: Implement comprehensive tests
3. **Document Fee Strategy**: Finalize fee implementation approach
4. **Create Phase 2 Plan**: Develop detailed implementation plan for fee structure
