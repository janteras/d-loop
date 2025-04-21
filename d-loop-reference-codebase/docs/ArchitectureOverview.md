# DLOOP Smart Contract Architecture

## Overview

The DLOOP smart contract system implements a sophisticated decentralized governance platform that leverages artificial intelligence and cross-chain capabilities for asset management.

## Core Components

### Asset DAO

The Asset DAO is the central component for managing tokenized assets:

- Handles investment, divestment, and ragequit operations
- Manages asset governance with proposal creation, voting, and execution
- Integrates with the fee system to collect and distribute fees
- Implements secure token transfers and asset management

### Protocol DAO

The Protocol DAO provides high-level governance for the entire DLOOP ecosystem:

- Enables protocol parameter adjustments (fees, voting periods, etc.)
- Manages system upgrades through contract deployment and migration
- Includes specialized AI-powered voting mechanisms
- Controls critical protocol operations and emergency pause functionality

### AI Node Registry

The AI Node Registry manages the registration and verification of AI nodes:

- Uses Soulbound NFTs for secure identity verification
- Implements reputation tracking for AI nodes
- Provides verification challenge mechanisms
- Ensures secure participation in governance

### Fee System

The fee system manages all fee-related operations:

- FeeCalculator determines fee amounts for different operations:
  - Investment: 10%
  - Divestment: 5%
  - Ragequit: 20%
- Distributes fees between Treasury (70%) and RewardDistributor (30%)
- Provides configurable fee parameters through ProtocolDAO

### Rewards

The rewards system incentivizes participation in governance:

- GovernanceRewards tracks and manages rewards for governance participation
- RewardDistributor handles the distribution of rewards from collected fees
- Implements secure claiming mechanisms for reward recipients

### Treasury

The Treasury manages protocol funds:

- Securely holds protocol fees and assets
- Provides controlled disbursement mechanisms
- Implements balance tracking for different token types

### Oracles

The oracle system provides essential price data:

- PriceOracle delivers asset pricing across different chains
- Implements secure update mechanisms with verification
- Provides fallback options for price data reliability

## System Architecture Diagram

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Asset DAO    │<────>│  Fee Calculator │<────>│    Treasury     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Protocol DAO   │<────>│    Reward       │<────>│   Governance    │
│  with AI Voting │      │  Distributor    │      │    Rewards      │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   AI Node       │<────>│  Soulbound NFT  │<────>│  Price Oracle   │
│   Registry      │      │    Identity     │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Contract Interactions

- **Asset DAO → Fee Calculator**: Calculates fees for asset operations
- **Fee Calculator → Treasury/RewardDistributor**: Distributes collected fees
- **Protocol DAO → System Contracts**: Updates system parameters
- **AI Node Registry → Soulbound NFT**: Verifies AI node identity
- **Protocol DAO → AI Node Registry**: Authorizes AI node registration
- **Asset DAO → Price Oracle**: Gets asset prices for operations
- **RewardDistributor → Governance Rewards**: Provides rewards for distribution

## Security Considerations

- Implemented access control for all critical functions
- Used OpenZeppelin's secure contract patterns and libraries
- Added reentrancy protection for all financial operations
- Implemented emergency pause functionality for critical situations
- Created secure upgrade mechanisms using the UUPS pattern
- Added comprehensive event logging for transparency and monitoring