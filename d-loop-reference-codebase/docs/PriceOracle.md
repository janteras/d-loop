# Price Oracle

## Overview

The PriceOracle contract manages price feeds for various tokens in the DLOOP ecosystem. It provides reliable price data with built-in safeguards against extreme price deviations and stale data, ensuring that the protocol operates with accurate and up-to-date token valuations.

## Key Features

- **Multi-token Support**: Manages price feeds for multiple tokens.
- **Price Deviation Protection**: Guards against extreme price fluctuations.
- **Staleness Detection**: Identifies and flags outdated price data.
- **Activation Control**: Ability to activate and deactivate price feeds.
- **Role-based Access**: Different roles for administration and price updates.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Price Feed Management

| Function | Description |
|----------|-------------|
| `addPriceFeed(address token, uint256 initialPrice)` | Adds a new price feed for a token |
| `updatePrice(address token, uint256 newPrice)` | Updates the price of a token |
| `deactivatePriceFeed(address token)` | Deactivates a price feed |
| `reactivatePriceFeed(address token, uint256 initialPrice)` | Reactivates a price feed with a new initial price |

### Configuration

| Function | Description |
|----------|-------------|
| `setMaxPriceDeviationPercent(uint256 newDeviation)` | Sets the maximum allowed price deviation percentage |
| `setStalePriceThreshold(uint256 newThreshold)` | Sets the stale price threshold in seconds |

### Query Functions

| Function | Description |
|----------|-------------|
| `getPrice(address token)` | Gets the price of a token (reverts if price is stale or feed inactive) |
| `getPriceData(address token)` | Gets detailed price data including staleness status |
| `getAllTrackedTokens()` | Gets all tracked token addresses |
| `getActiveTokens()` | Gets all active token addresses |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Can add, deactivate, and reactivate price feeds, and modify thresholds |
| `PRICE_FEEDER_ROLE` | Can update prices for existing feeds |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- Prices are stored with 8 decimal places (e.g., 100000000 = $1.00)
- Price data includes the price, timestamp, and active status.
- Default thresholds:
  - Maximum price deviation: 10%
  - Stale price threshold: 1 hour
- The contract tracks all tokens that have ever had a price feed and maintains a list of currently active feeds.

## Integration with Other Components

- **AssetDAO**: Uses price data to calculate token values during investments and divestments.
- **GovernanceRewards**: May use token prices to calculate reward values.
- **Treasury**: Uses price data for accounting and reporting.

## Usage Examples

### Adding a New Price Feed

1. An admin calls `addPriceFeed()` with a token address and initial price.
2. The price feed is marked as active and the current timestamp is recorded.

### Updating Prices

1. A price feeder calls `updatePrice()` with a new price.
2. If the price deviation exceeds the maximum allowed percentage, the transaction reverts.
3. Otherwise, the price and timestamp are updated.

### Checking Price Staleness

1. A contract calls `getPriceData()` to get detailed price information including staleness.
2. If the time since the last update exceeds the stale price threshold, the price is marked as stale.

## Security Considerations

- Price updates are restricted to addresses with the PRICE_FEEDER_ROLE.
- The maximum price deviation percentage prevents extreme price manipulations.
- Stale price detection helps avoid using outdated price data.
- Detailed price data including timestamps enables contracts to implement their own staleness checks if needed.
- Price feeds can be deactivated if compromised or no longer needed.