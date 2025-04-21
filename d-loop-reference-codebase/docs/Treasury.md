# Treasury

## Overview

The Treasury contract manages protocol fees and funds, handling collection, allocation, and spending of assets. It provides a structured way to track and utilize protocol revenue while maintaining transparency and control over fund usage.

## Key Features

- **Fee Collection**: Structured collection and tracking of fees from various sources.
- **Fund Allocation**: Purpose-specific allocation of funds.
- **Spending Control**: Controlled spending with purpose tracking.
- **Multi-token Support**: Handles any ERC20 token.
- **Statistical Tracking**: Maintains comprehensive statistics on fees collected and spent.
- **Role-based Access**: Different roles for fee collection, fund allocation, and spending.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Fee Management

| Function | Description |
|----------|-------------|
| `collectFees(address token, uint256 amount, address source)` | Collects fees in the specified token from a source |
| `allocateFunds(address token, string memory purpose, uint256 amount)` | Allocates funds for a specific purpose |
| `spendFunds(address token, address recipient, uint256 allocationIndex, uint256 amount)` | Spends funds from an allocation |
| `deactivateAllocation(address token, uint256 allocationIndex)` | Deactivates an allocation |

### Query Functions

| Function | Description |
|----------|-------------|
| `getBalance(address token)` | Gets the total balance of a token in the treasury |
| `getAllocationDetails(address token, uint256 allocationIndex)` | Gets details of an allocation |
| `getAllocationCount(address token)` | Gets the number of allocations for a token |
| `getActiveAllocations(address token)` | Gets all active allocation indexes for a token |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Has general administrative permissions |
| `TREASURER_ROLE` | Can allocate funds and deactivate allocations |
| `COLLECTOR_ROLE` | Can collect fees |
| `SPENDER_ROLE` | Can spend funds from allocations |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- The contract uses OpenZeppelin's SafeERC20 library to handle token transfers securely.
- Allocations are tracked in a mapping from token address to an array of allocation structures.
- Each allocation includes a purpose description, amount, and active status.
- Statistics are maintained for total fees collected and fees collected by source.

## Integration with Other Components

- **FeeCalculator**: Determines the treasury's share of fees.
- **AssetDAO**: Sends investment and divestment fees to the treasury.
- **Protocol DAO**: Can allocate treasury funds for protocol improvements or incentives.

## Usage Examples

### Collecting Fees

1. When a fee is collected (e.g., from an investment), the respective contract calls `collectFees()`.
2. The token is transferred to the treasury and statistics are updated.

### Allocating Funds for Protocol Development

1. A treasurer calls `allocateFunds()` to allocate tokens for a development grant.
2. The allocation is recorded with the purpose and amount.

### Spending Allocated Funds

1. A spender calls `spendFunds()` to send tokens from a specific allocation to a recipient.
2. The allocation amount is reduced, and if fully spent, the allocation is deactivated.

## Security Considerations

- Role-based access control restricts each operation to appropriate roles.
- The ReentrancyGuard prevents reentrancy attacks during fee collection and fund spending.
- Token amounts are validated before operations to prevent errors.
- The contract uses SafeERC20 to handle token transfers securely.
- Allocations can be deactivated when no longer needed, providing cleanup.