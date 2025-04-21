# D-Loop Protocol: Sepolia Testnet Deviations & Simplifications

## Overview
This document outlines all deviations, simplifications, and mock implementations used in the Sepolia testnet deployment of the D-Loop Protocol. All changes are made in accordance with [SEPOLIA_REQUIREMENTS.md](./SEPOLIA_REQUIREMENTS.md) and the standards in [`docs/testing/`](./docs/testing/).

---

## 1. Testnet Deviations from Mainnet

### Admin Controls
- **Single deployer/admin** for all roles. Multisig and complex access control are skipped.
- All contract role assignments are handled by the deployer address.

### Oracles
- **ChainlinkPriceOracle.sol** is used for supported assets with testnet Chainlink feeds.
- **PriceOracle.sol** and **MockPriceOracle.sol** are used for unsupported assets and for testing fallback logic.
- Manual price setting is enabled for testnet to facilitate rapid testing and integration.

### Treasury & Fee Distribution
- **Treasury.sol** and **FeeProcessor.sol** are deployed in simplified mode.
- **MockTreasury** and **MockFeeDistributor** are used in some tests and integration flows.

### Identity & Governance
- **AINodeRegistry** integrates with **SoulboundNFT** for node identity.
- **Cross-chain checks** and Hedera integration are **skipped** for testnet.
- **Governance**: Proposal execution, voting, and rewards flows use simplified quorum and time windows (e.g., 10% quorum, shorter voting periods).

### Rewards & Mint/Burn
- **Mock oracles** are used for DLOOP rewards calculation in tests.
- D-AI tokens are minted/burned 1:1 with test assets for simplicity.

### Timelocks & Parameter Changes
- Timelocks on parameter changes are disabled or set to minimal values for rapid iteration.
- All parameter changes are admin-only and can be executed immediately.

---

## 2. Contracts Using Mocks or Testnet-Specific Logic

| Contract                | Purpose / Notes                                     |
|------------------------|-----------------------------------------------------|
| MockPriceOracle.sol     | Used for fallback and oracle tests                  |
| MockTreasury.sol        | Used for treasury logic tests                       |
| MockFeeDistributor.sol  | Used for fee distribution tests                     |
| PriceOracle.sol         | Used for manual price setting and fallback testing  |
| ChainlinkPriceOracle.sol| Main oracle for Chainlink-supported assets          |
| AssetDAO.sol            | Uses simplified mint/burn and proposal logic; all testnet-specific logic is now clearly marked with [TESTNET] comments in the contract code |
| ProtocolDAO.sol         | Uses simplified proposal, voting, and admin logic; all testnet-specific logic is now clearly marked with [TESTNET] comments in the contract code |
| GovernanceRewards.sol   | Rewards logic uses mocks and simplified parameters  |
| AINodeRegistry.sol      | Skips cross-chain and Hedera checks                 |
| SoulboundNFT.sol        | Used for identity, with simplified minting          |

---

## 3. Testing & Mock Standards
All tests and mock contracts adhere to the standards outlined in [`docs/testing/`](./docs/testing/):
- **Test Structure:**
  - Unit tests in `test/unit/`
  - Integration tests in `test/integration/`
  - Security, performance, and validation tests in their respective folders
- **Mock Usage:**
  - Mocks are used for oracles, treasury, and fee distribution in all testnet deployments and tests
  - All mocks implement the same interface as their production counterparts
- **Fixtures:**
  - Test fixtures are located in `test/fixtures/` and provide reusable deployment and setup logic
- **ABI Compatibility:**
  - ABI compatibility tests are located in `test/validation/`
  - All contract interfaces are validated against expected formats
- **Ethers v6 Compliance:**
  - All tests use ethers v6 conventions (e.g., `.target` instead of `.address`)
- **Test-Driven Approach:**
  - All contract changes are driven by failing tests and covered with unit/integration tests

---

## 4. Security & Mainnet Migration Notes
- All critical security features (multisig, cross-chain, timelocks) will be **enabled for mainnet only**.
- Testnet deployment is for rapid iteration and integration testing; not for production use.
- All deviations are documented here and in deployment/test scripts.

---

_Last updated: 2025-04-17_
