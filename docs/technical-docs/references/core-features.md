# D-Loop Protocol Core Features

This document summarizes the core features of the D-Loop Protocol, referencing both the whitepaper and the latest smart contract implementation. It highlights Sepolia testnet adaptations and mainnet roadmap items where relevant.

## Token System

### D-AI Token (D-Loop Asset Index Token)
- **Purpose:** Asset index token representing a basket of assets managed by AssetDAO.
- **Whitepaper:** Stable, asset-backed, ERC-20 with governance extensions and 1:1 backing.
- **Implementation:** `/contracts/token/DAIToken.sol` (ERC20Burnable, ERC20Pausable, AccessControl; role-based minting/burning).
- **Sepolia:** Simplified mint/burn for testnet, direct 1:1 backing verification.

### DLOOP Token
- **Purpose:** Governance token for voting, delegation, and protocol participation.
- **Whitepaper:** Delegation (liquid democracy), proposal voting, rewards.
- **Implementation:** `/contracts/token/DLoopToken.sol` (delegation via `delegateTokens`, `withdrawDelegation`, full tracking).

## Governance System

### Protocol Governance
- **Purpose:** Decentralized decision-making for protocol parameters, upgrades, and asset management.
- **Whitepaper:** Multi-tiered, proposal lifecycle, time-locked execution.
- **Implementation:** `/contracts/core/ProtocolDAO.sol` (proposal creation, voting, execution, quorum, voting period, whitelisting, treasury updates).
- **Sepolia:** Reduced voting period, execution delay, and quorum for faster testnet cycles.

### Asset Governance
- **Purpose:** Creation, investment, divestment, and governance of assets.
- **Implementation:** `/contracts/core/AssetDAO.sol` (asset creation, investment/divestment, proposal voting, execution).
- **Sepolia:** Simplified quorum, mock oracles for asset valuation.

## Oracle System

### Price Oracles
- **Purpose:** Provide reliable, up-to-date asset prices for investments, rewards, and mint/burn flows.
- **Whitepaper:** Modular, decentralized, Chainlink as primary, fallback/manual, extensible adapters.
- **Implementation:**
  - `/contracts/oracles/ChainlinkPriceOracle.sol` (Chainlink integration, fallback/manual, staleness checks, role-based management)
  - `/contracts/oracles/PriceOracle.sol` (legacy/manual/testnet backup)
  - `/contracts/interfaces/oracle/IPriceOracle.sol` (standard interface)
- **Sepolia:** Chainlink + fallback/manual; mainnet will expand to multi-oracle aggregation and stricter roles.

## Fee & Treasury System

### Fee Calculation & Processing
- **Purpose:** Calculate and distribute fees for investments/divestments, route protocol funds.
- **Implementation:**
  - `/contracts/fees/FeeCalculator.sol` (fee logic)
  - `/contracts/fees/FeeProcessor.sol` (distribution)
  - `/contracts/fees/Treasury.sol` (fund custody, approval optimizer, batch operations)
- **Sepolia:** Simplified flows, mocks for treasury.
- **Mainnet:** Dynamic routing, advanced splits, security audits.

## AI Node Management & Identity

### Node Governance & Registry
- **Purpose:** Manage AI node identities, participation, and rewards.
- **Implementation:**
  - `/contracts/governance/AINodeGovernance.sol` (governance logic)
  - `/contracts/governance/AINodeRegistry.sol` (registration)
  - `/contracts/identity/SoulboundNFT.sol` (identity verification)
- **Sepolia:** SoulboundNFT used for node identity; cross-chain checks deferred.

## Security & Upgradability

- **AccessControl:** Used throughout for role-based permissions (OpenZeppelin).
- **ReentrancyGuard:** Critical functions protected.
- **Custom Errors:** For gas efficiency and clarity.
- **Upgradability:** No proxy/diamond yet; mainnet roadmap includes upgrade patterns.
- **Sepolia:** Single deployer admin; mainnet will use multisig, time-locks.

## Governance Enhancements

- **Delegation:** DLOOP token supports delegation and withdrawal for liquid democracy.
- **Proposal Lifecycle:** ProtocolDAO and AssetDAO support proposal creation, voting, execution, and whitelisting.
- **Rewards:** GovernanceRewards contract (not shown above) distributes rewards based on participation and proposal outcomes.
- **Sepolia:** Faster cycles, lower thresholds for rapid iteration.

## Roadmap & Mainnet Extensions

- Multi-oracle adapters, cross-chain compatibility, advanced fee/reward routing, modular upgrade patterns, and comprehensive audits are planned for mainnet.

### Asset Governance

Asset governance enables decisions specific to individual assets within the protocol.

**Whitepaper Reference:**
- Asset-specific governance
- Creator and investor voting rights
- Specialized proposal types for asset management

**Implementation:**
- Implemented in `/contracts/core/AssetDAO.sol`
- Includes asset creation, investment, and governance
- Manages asset-specific proposals and voting

## AI Node System

### Node Registration and Governance

The AI Node system enables registration and governance of AI nodes within the protocol.

**Whitepaper Reference:**
- AI Node identification and verification (Page 14)
- Node registration and metadata management
- Node governance through specialized proposals

**Implementation:**
- Node registry in `/contracts/governance/AINodeRegistry.sol`
- Node governance in `/contracts/governance/AINodeGovernance.sol`
- Integration with SoulboundNFT for identity verification

## Fee Management

### Fee Collection and Distribution

The fee management system collects and distributes fees from protocol operations.

**Whitepaper Reference:**
- Fee collection on investment and divestment
- Distribution between treasury and reward systems
- Configurable fee percentages

**Implementation:**
- Fee processing in `/contracts/fees/FeeProcessor.sol`
- Fee calculation in `/contracts/fees/FeeCalculator.sol`
- Treasury management in `/contracts/fees/Treasury.sol`

## Oracle Integration

### Price Discovery

The price oracle system provides price data for assets within the protocol.

**Whitepaper Reference:**
- External price feeds for accurate valuation
- Oracle aggregation for reliability
- Price update mechanisms

**Implementation:**
- Price oracle in `/contracts/oracles/PriceOracle.sol`
- Integration with external price feeds
- Price update and management functions
