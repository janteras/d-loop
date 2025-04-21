# Sepolia Testnet Minimal Viable Requirements

*Focus: Core functionality with testnet-friendly simplifications*

## Core Requirements

### 1. Simplified Admin Controls
- Approve AI Governance Node deployments via **single Sepolia deployer address** (skip multisig)
- *Deviation Note:* Mainnet will use 2-of-3 multisig per whitepaper

### 2. Gas-Critical Implementations
- **Token Approval Optimizer**:
  - Implement basic gas-optimized approval flows (prioritize `delegateTokens`, `withdrawDelegation`)
  - *Justification:* 15-20% gas savings potential (per test coverage analysis)

### 3. Identity Verification
- Integrate **SoulboundNFT** with `AINodeRegistry` for node identity checks
  - Skip cross-chain checks (testnet-only)
  - *Whitepaper Alignment:* Page 14 (AI Node Identification)

### 4. Governance & Economics
- **Proposal Execution**:
  - Enable submit/vote/execute flows with **simplified quorum** (e.g., 10% for testnet)
- **Rewards & Mint/Burn**:
  - Mock price oracles for DLOOP rewards
  - Verify 1:1 D-AI mint/burn against test deposits

## Testnet-Specific Simplifications

- ✅ **Oracles**:
  - Integrated real Chainlink-based price feeds using `ChainlinkPriceOracle.sol`.
  - Supports fallback/manual price setting for testnet flexibility.
  - *Testnet Note:* Admin can set fallback prices and staleness thresholds for rapid testing.
  - *Deviation Note:* Mainnet will use stricter role management and may restrict manual overrides.
- ✅ **Use mocks** for:
  - Treasury
  - Fee Distributor
- ⏳ **Defer to mainnet**:
  - Complex access control
  - Multisig requirements
  - Cross-chain checks
- 📝 **Document all deviations** in `TESTNET_README.md`

## Feedback-Driven Validation
*(Confirm during implementation)*

1. **Proposal Flow**  
   Can users submit/vote/execute proposals end-to-end?

2. **Rewards Calculation**  
   Does the mock oracle correctly calculate epoch rewards?

3. **Mint/Burn Mechanics**  
   Are D-AI tokens backed 1:1 with test assets?

---

*Last Updated: {DATE}*  
*Mainnet Compliance Reference: Whitepaper v{DATE}*