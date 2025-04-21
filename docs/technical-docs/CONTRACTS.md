# D-Loop Protocol Contract Documentation

## Core Contracts

### AssetDAO

**Location**: `/contracts/core/AssetDAO.sol`

**Purpose**: The AssetDAO contract is the central component for asset management within the D-Loop Protocol. It enables the creation, investment, and governance of assets on the platform.

**Key Functions**:
- `createAsset(string memory name, string memory description)`: Creates a new asset with the specified name and description
- `investInAsset(uint256 assetId, uint256 amount)`: Allows users to invest in an asset using D-AI tokens
- `divestFromAsset(uint256 assetId, uint256 shares)`: Allows users to divest from an asset
- `createProposal(uint256 assetId, string memory description, bytes memory data)`: Creates a governance proposal for an asset
- `vote(uint256 proposalId, bool support)`: Allows users to vote on proposals
- `executeProposal(uint256 proposalId)`: Executes a successful proposal

**Sepolia Adaptations**:
- Simplified quorum requirements for proposal execution
- Direct integration with mock price oracles for asset valuation

### ProtocolDAO

**Location**: `/contracts/core/ProtocolDAO.sol`

**Purpose**: The ProtocolDAO contract governs the entire D-Loop Protocol, enabling protocol-level decision-making and parameter adjustments.

**Key Functions**:
- `createProposal(string memory description, bytes memory data, address target)`: Creates a protocol-level governance proposal
- `castVote(uint256 proposalId, bool support)`: Allows DLOOP token holders to vote on proposals
- `executeProposal(uint256 proposalId)`: Executes a successful proposal
- `whitelistToken(address token, bool status)`: Manages whitelisted tokens in the protocol
- `updateTreasury(address newTreasury)`: Updates the treasury address

**Sepolia Adaptations**:
- Reduced voting period and execution delay for faster governance cycles
- Simplified quorum requirements (51% vs. higher threshold on mainnet)

## Token Contracts

### DAIToken (D-AI Token)

**Location**: `/contracts/token/DAIToken.sol`

**Purpose**: The D-AI Token (D-Loop Asset Index Token) is an ERC-20 token that represents the asset index within the D-Loop Protocol. It serves as the primary investment token for assets created in the AssetDAO.

**Key Functions**:
- `mint(address to, uint256 amount)`: Mints new D-AI tokens to the specified address
- `burn(uint256 amount)`: Burns D-AI tokens
- `pause()` and `unpause()`: Emergency controls for token transfers

**Sepolia Adaptations**:
- Simplified minting/burning process for testnet operations
- Direct 1:1 backing verification against test deposits

### DLoopToken

**Location**: `/contracts/token/DLoopToken.sol`

**Purpose**: The DLOOP token is the governance token of the D-Loop Protocol, enabling holders to participate in protocol governance through voting and delegation.

**Key Functions**:
- `delegateTokens(address delegatee, uint256 amount)`: Delegates voting power to another address
- `withdrawDelegation(address delegatee, uint256 amount)`: Withdraws delegated voting power
- `getDelegatedAmount(address delegator, address delegatee)`: Gets the amount delegated from one address to another
- `getTotalDelegatedByAddress(address delegator)`: Gets the total amount delegated by an address
- `getTotalDelegatedToAddress(address delegatee)`: Gets the total amount delegated to an address

**Sepolia Adaptations**:
- Gas-optimized delegation flows for testnet efficiency
- Simplified token distribution for testing purposes

### TokenOptimizer

**Location**: `/contracts/token/TokenOptimizer.sol`

**Purpose**: Provides gas-optimized token operations for the D-Loop Protocol.

**Key Functions**:
- `batchApprove(address[] memory tokens, address spender, uint256[] memory amounts)`: Batch approves multiple tokens
- `safeIncreaseAllowance(address token, address spender, uint256 amount)`: Safely increases token allowance
- `safeDecreaseAllowance(address token, address spender, uint256 amount)`: Safely decreases token allowance

**Sepolia Adaptations**:
- Prioritized optimization for delegation operations
- 15-20% gas savings as per test coverage analysis

## Fee Management Contracts

### FeeProcessor

**Location**: `/contracts/fees/FeeProcessor.sol`

**Purpose**: Processes and distributes fees collected from various protocol operations.

**Key Functions**:
- `collectInvestmentFee(address token, uint256 amount)`: Collects and distributes investment fees
- `collectDivestmentFee(address token, uint256 amount)`: Collects and distributes divestment fees
- `updateFeeDistribution(uint256 treasuryPercentage, uint256 rewardDistPercentage)`: Updates fee distribution percentages

**Sepolia Adaptations**:
- Mock implementation for simplified fee distribution
- Direct integration with testnet treasury and reward distributor

### FeeCalculator

**Location**: `/contracts/fees/FeeCalculator.sol`

**Purpose**: Calculates fees based on protocol parameters and transaction amounts.

**Key Functions**:
- `calculateInvestmentFee(uint256 amount)`: Calculates the fee for investment operations
- `calculateDivestmentFee(uint256 amount)`: Calculates the fee for divestment operations
- `updateFeePercentage(uint256 newPercentage)`: Updates the fee percentage

**Sepolia Adaptations**:
- Simplified fee calculation for testnet operations
- Reduced fee percentages for testing purposes

### Treasury

**Location**: `/contracts/fees/Treasury.sol`

**Purpose**: Manages the protocol treasury funds, including receiving, storing, and distributing funds.

**Key Functions**:
- `withdraw(address token, address recipient, uint256 amount)`: Withdraws funds from the treasury
- `approveSpender(address token, address spender, uint256 amount)`: Approves a spender for treasury tokens
- `revokeApproval(address token, address spender)`: Revokes approval for a spender

**Sepolia Adaptations**:
- Mock implementation for testnet operations
- Simplified withdrawal process for testing purposes

## Governance Contracts

### AINodeGovernance

**Location**: `/contracts/governance/AINodeGovernance.sol`

**Purpose**: Governs the AI nodes within the D-Loop Protocol, enabling node-level decision-making.

**Key Functions**:
- `proposeNodeAction(address node, bytes memory data)`: Proposes an action for an AI node
- `voteOnNodeProposal(uint256 proposalId, bool support)`: Votes on a node proposal
- `executeNodeProposal(uint256 proposalId)`: Executes a successful node proposal

**Sepolia Adaptations**:
- Simplified approval process via single Sepolia deployer address
- Skip multisig requirements as per testnet simplifications

### AINodeRegistry

**Location**: `/contracts/governance/AINodeRegistry.sol`

**Purpose**: Registers and manages AI nodes within the D-Loop Protocol.

**Key Functions**:
- `registerNode(address nodeAddress, string memory metadata)`: Registers a new AI node
- `updateNodeMetadata(address nodeAddress, string memory metadata)`: Updates node metadata
- `deactivateNode(address nodeAddress)`: Deactivates an AI node
- `reactivateNode(address nodeAddress)`: Reactivates a deactivated AI node

**Sepolia Adaptations**:
- Integration with SoulboundNFT for node identity checks
- Skip cross-chain checks for testnet simplification

### GovernanceRewards

**Location**: `/contracts/governance/GovernanceRewards.sol`

**Purpose**: Distributes rewards to governance participants based on their contributions.

**Key Functions**:
- `distributeRewards(address[] memory recipients, uint256[] memory amounts)`: Distributes rewards to multiple recipients
- `claimReward(address recipient)`: Allows a recipient to claim their reward
- `updateRewardRate(uint256 newRate)`: Updates the reward rate

**Sepolia Adaptations**:
- Mock price oracles for DLOOP rewards calculation
- Simplified reward distribution for testnet operations

### SimplifiedAdminControls

**Location**: `/contracts/governance/SimplifiedAdminControls.sol`

**Purpose**: Provides simplified administrative controls for the Sepolia testnet deployment.

**Key Functions**:
- `approveNodeDeployment(address node)`: Approves an AI node deployment
- `revokeNodeApproval(address node)`: Revokes approval for an AI node
- `updateAdminAddress(address newAdmin)`: Updates the admin address

**Sepolia Adaptations**:
- Testnet-specific contract for simplified administration
- Single deployer address instead of multisig as per testnet requirements

## Oracle Contracts

### ChainlinkPriceOracle

**Location**: `/contracts/oracles/ChainlinkPriceOracle.sol`

**Purpose**: Primary price oracle integrating Chainlink feeds with robust staleness checks, fallback/manual price support, and role-based management.

**Key Functions:**
- `setFeed(address token, address aggregator, uint256 maxStaleness, uint256 heartbeat, uint8 reliabilityScore)`: Register Chainlink feeds for tokens
- `setFallbackPrice(address token, uint256 price, uint8 decimals)`: Set fallback/manual prices
- `getAssetPrice(address token)`: Retrieve normalized price (Chainlink or fallback)
- `getAssetDecimals(address token)`: Retrieve decimals for price

**Sepolia Adaptations**:
- Admin can set fallback prices and staleness thresholds for rapid iteration
- Simplified role management for testnet

**Mainnet Roadmap**:
- Stricter role separation, multisig, time-locks, adapters for multi-oracle aggregation, and automated reliability scoring

### PriceOracle

**Location**: `/contracts/oracles/PriceOracle.sol`

**Purpose**: Legacy/manual price oracle, supporting direct price setting by admins or updaters. Used as a backup or for testnet scenarios. Supports staleness checks and configurable decimals.

**Key Functions:**
- `setPrice(address token, uint256 price)`: Sets the price for a token
- `setDirectPrice(address token, uint256 price, uint8 decimals)`: Sets the price and decimals for a token
- `getAssetPrice(address _asset)`: Gets the price for an asset
- `getAssetDecimals(address _asset)`: Gets the decimals for an asset

**Sepolia Adaptations:**
- Mock implementation with simplified access and default prices for rapid test cycles

### PriceOracleAdapter

**Location**: `/contracts/adapters/PriceOracleAdapter.sol`

**Purpose**: Adapter contract for integrating additional oracle sources or future third-party oracle providers (e.g., API3, UMA, LayerZero). Designed for modular expansion and robust price aggregation.

**Key Functions:**
- (To be documented as adapters are deployed/used)

**Integration Summary:**
- ChainlinkPriceOracle is the primary source for asset pricing, with PriceOracle as a backup/manual override for testnet and legacy support. PriceOracleAdapter enables future-proofing and multi-oracle aggregation, aligning with the whitepaper’s vision for decentralized, reliable price feeds.

## Security Contracts

### ReentrancyGuard

**Location**: `/contracts/security/ReentrancyGuard.sol`

**Purpose**: Prevents reentrancy attacks on critical functions.

**Key Functions**:
- `nonReentrant` modifier: Prevents reentrancy on protected functions

**Sepolia Adaptations**:
- Standard implementation with no testnet-specific changes

## Utility Contracts

### Errors

**Location**: `/contracts/utils/Errors.sol`

**Purpose**: Centralizes custom error definitions for gas-efficient error handling.

**Key Features**:
- Custom error definitions for all protocol errors
- Gas-efficient error handling compared to string error messages

**Sepolia Adaptations**:
- Standard implementation with no testnet-specific changes
