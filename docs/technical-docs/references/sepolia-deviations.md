**Mainnet Design (Whitepaper):**
- Comprehensive gas optimizations across all contracts
- Advanced storage patterns for gas efficiency
- Optimized for mainnet gas conditions

**Sepolia Implementation:**
- Focused optimization on token operations (delegateTokens, withdrawDelegation)
- Basic gas optimizations for critical paths
- 15-20% gas savings on key operations

**Justification:**
- Prioritizes optimizations with highest impact
- Balances optimization efforts with development speed
- Validates gas-saving approaches in testnet environment

## Documentation of Deviations

All Sepolia-specific deviations are documented in:

1. Code comments within the affected contracts
2. This reference document
3. The `TESTNET_README.md` file

Each deviation includes:
- Description of the change
- Justification for the simplification
- Reference to the corresponding mainnet design
- Plans for mainnet implementation

## Sepolia Deviations Summary

| Protocol Area | Sepolia Deviation | Mainnet/Whitepaper Intent | Justification |
| --- | --- | --- | --- |
| Admin | Simplified admin controls | Multi-signature requirements | Reduced complexity for testnet |
| Governance | Limited voting periods | Flexible voting periods | Simplified testing of governance |
| Oracles | ChainlinkPriceOracle with manual fallback, PriceOracle as backup | Production oracles and cross-chain verification | Rapid/manual price setting and simplified role management for testnet |
| Fees/Treasury | Basic treasury management | Advanced treasury management | Simplified testing of treasury |
| Identity | Simplified identity verification | Advanced identity verification | Reduced complexity for testnet |
| Gas | Basic gas optimizations | Comprehensive gas optimizations | Simplified testing of gas efficiency |

## Sepolia Deviations Details

### Admin

#### Sepolia Implementation
The Sepolia implementation uses simplified admin controls, reducing the complexity of the admin interface for testnet purposes.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, utilizes multi-signature requirements for admin controls, providing an additional layer of security and decentralization.

#### Rationale for Deviation
The Sepolia deviation simplifies the admin controls to reduce complexity and facilitate testing. However, the mainnet design will implement multi-signature requirements to ensure the security and decentralization of the protocol.

### Governance

#### Sepolia Implementation
The Sepolia implementation limits voting periods to simplify the testing of governance.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, allows for flexible voting periods, enabling the protocol to adapt to changing circumstances.

#### Rationale for Deviation
The Sepolia deviation limits voting periods to simplify testing, but the mainnet design will implement flexible voting periods to ensure the protocol's adaptability.

### Oracles

#### Sepolia Implementation
The Sepolia implementation uses ChainlinkPriceOracle as the primary oracle, with robust staleness checks and fallback/manual price logic (admin-settable on Sepolia). PriceOracle is used as a fully manual, testnet-oriented backup with roles restricted to deployer/admin.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, utilizes production oracles and cross-chain verification, providing a more robust and secure oracle system. Mainnet will enforce stricter role separation, multi-oracle aggregation, and no manual fallback except for emergencies.

#### Rationale for Deviation
The Sepolia deviation uses ChainlinkPriceOracle and PriceOracle to allow for rapid/manual price setting and simplified role management for testnet purposes. However, the mainnet design will implement production oracles and cross-chain verification to ensure the security and accuracy of the oracle system.

### Fees/Treasury

#### Sepolia Implementation
The Sepolia implementation uses basic treasury management to simplify the testing of treasury.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, utilizes advanced treasury management, providing a more robust and secure treasury system.

#### Rationale for Deviation
The Sepolia deviation simplifies treasury management to reduce complexity and facilitate testing. However, the mainnet design will implement advanced treasury management to ensure the security and efficiency of the treasury system.

### Identity

#### Sepolia Implementation
The Sepolia implementation uses simplified identity verification to reduce complexity and facilitate testing.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, utilizes advanced identity verification, providing a more robust and secure identity verification system.

#### Rationale for Deviation
The Sepolia deviation simplifies identity verification to reduce complexity and facilitate testing. However, the mainnet design will implement advanced identity verification to ensure the security and accuracy of the identity verification system.

### Gas

#### Sepolia Implementation
The Sepolia implementation uses basic gas optimizations to simplify the testing of gas efficiency.

#### Mainnet/Whitepaper Design
The mainnet design, as described in the whitepaper, utilizes comprehensive gas optimizations, providing a more efficient and cost-effective gas system.

#### Rationale for Deviation
The Sepolia deviation simplifies gas optimizations to reduce complexity and facilitate testing. However, the mainnet design will implement comprehensive gas optimizations to ensure the efficiency and cost-effectiveness of the gas system.

## Migration Path

The following steps outline the migration path for each deviation:

1. **Admin**
	* Replace simplified admin controls with multi-signature requirements
	* Update contract(s) to reflect mainnet design
2. **Governance**
	* Implement flexible voting periods
	* Update contract(s) to reflect mainnet design
3. **Oracles**
	* Replace mock oracles with production oracles and cross-chain verification
	* Update contract(s) to reflect mainnet design
4. **Fees/Treasury**
	* Implement advanced treasury management
	* Update contract(s) to reflect mainnet design
5. **Identity**
	* Implement advanced identity verification
	* Update contract(s) to reflect mainnet design
6. **Gas**
	* Implement comprehensive gas optimizations
	* Update contract(s) to reflect mainnet design

## Validation Strategy

The Sepolia implementation includes a feedback-driven validation strategy to ensure that despite simplifications, the core protocol functionality works as expected:

1. **Proposal Flow Validation**  
   Complete end-to-end testing of proposal submission, voting, and execution

2. **Rewards Calculation Validation**  
   Verification that mock oracles correctly calculate epoch rewards

3. **Mint/Burn Mechanics Validation**  
   Confirmation that D-AI tokens maintain 1:1 backing with test assets

Each simplification is designed to be modular, allowing for incremental upgrades toward the mainnet implementation while preserving the core protocol functionality.
