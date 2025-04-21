# D-Loop Protocol: Sepolia Release Action Plan (Test-Driven)

## Overview
This action plan outlines the steps to rapidly develop and deploy a Sepolia-focused release of the D-Loop Protocol, leveraging reusable components from the `d-loop-reference-codebase.txt` and aligning with requirements in `SEPOLIA_REQUIREMENTS.md`, the whitepaper, and supplementary docs. The approach is strictly test-driven, ensuring robust, verifiable progress at every stage.

---

## 1. **Project Review & Preparation**
- **Audit** all contracts in `/contracts` for Sepolia compatibility and testnet simplifications.
- **Map** reusable modules from `d-loop-reference-codebase.txt` (see [Reference Codebase Reuse](#reference-codebase-reuse)).
- **Document** all testnet deviations in `TESTNET_README.md` per `SEPOLIA_REQUIREMENTS.md`.

## 2. **Core Requirements & Simplifications**
- **Admin Controls:**
  - Use a single deployer/admin for all roles (skip multisig).
- **Gas Optimization:**
  - Prioritize gas-efficient flows (e.g., TokenApprovalOptimizer, delegateTokens, withdrawDelegation).
- **Identity:**
  - Integrate SoulboundNFT + AINodeRegistry; skip cross-chain checks.
- **Governance:**
  - Enable simplified submit/vote/execute flows (10% quorum for testnet).
- **Rewards & Mint/Burn:**
  - Use mock oracles for DLOOP rewards. Ensure 1:1 D-AI mint/burn.

## 3. **Oracle (PriceOracle) Refactor & Chainlink Integration**
- **Goal:** Replace the current simplified PriceOracle with a Chainlink-integrated version for Sepolia.
- **Steps:**
  1. **Review** PriceOracle in `/contracts/oracles/PriceOracle.sol` and its limitations (see `PriceOracleReport.md`).
  2. **Leverage** any Chainlink oracle integration patterns from `d-loop-reference-codebase.txt` (search for ChainlinkConsumer, AggregatorV3Interface, etc.).
  3. **Implement** a new PriceOracle with Chainlink feeds for key assets (ETH/USD, DAI/USD, etc.).
  4. **Fallback:** Retain manual price update for unsupported tokens for testing.
  5. **Testing:**
     - Write unit tests for Chainlink integration (mock feeds, staleness checks).
     - Write integration tests for AssetDAO and rewards flows using the new oracle.

## 4. **Test-Driven Development Roadmap**
- **Phase 1: Test Scaffolding**
  - Extract/port test files from `janteras-dloopos/test/` (see `d-loop-reference-codebase.txt`).
  - Adapt fixtures from `test/fixtures/` for Sepolia deployment.
  - Add ABI compatibility tests for all major contracts (`test/validation/`).
- **Phase 2: Contract Refactoring**
  - Refactor contracts to match Sepolia requirements, guided by failing tests.
  - Prioritize contracts with direct Sepolia dependencies (PriceOracle, AssetDAO, ProtocolDAO, FeeCalculator, SoulboundNFT).
- **Phase 3: Integration & Scenario Testing**
  - Implement end-to-end flows: proposal, voting, execution, rewards, mint/burn.
  - Use testnet mocks for treasury, fee distributor, and oracles as needed.
- **Phase 4: Documentation & Compliance**
  - Update `TESTNET_README.md` with all simplifications and deviations.
  - Ensure all test cases are documented and reproducible.

## 5. **Reference Codebase Reuse**
- **Contracts:**
  - Fees: `FeeCalculator.sol`, `FeeProcessor.sol`, `Treasury.sol` (see `contracts/fees/` in reference codebase)
  - Governance: `AINodeGovernance.sol`, `ProtocolDAO.sol`, `GovernanceRewards.sol`
  - Identity: `SoulboundNFT.sol`, `AINodeRegistry.sol`
  - Mocks: Use/port mocks from `contracts/mocks/` for testnet oracles and treasury
- **Testing:**
  - Reuse test scripts and fixtures from `janteras-dloopos/test/`
  - Use `run-all-tests.js`, `run-minimal-test.js` scripts for CI/test automation
- **Deployment:**
  - Adapt `hardhat.config.js` and deployment scripts for Sepolia network

## 6. **Chainlink Integration Plan**
- **Reference:** Use Chainlink integration patterns (AggregatorV3Interface, etc.) from reference codebase or Chainlink docs.
- **Tasks:**
  - Implement Chainlink price feeds for major assets in PriceOracle
  - Add staleness checks and fallback mechanisms
  - Ensure AssetDAO and FeeCalculator consume new oracle interface
  - Write/port tests for all new logic

## 7. **Validation & Feedback**
- **Checklist:**
  - Proposal flow: submit/vote/execute end-to-end
  - Rewards: mock oracle correctly calculates epoch rewards
  - Mint/burn: D-AI tokens backed 1:1 with test assets
- **Continuous:**
  - Use test-driven approach for all changes; never merge untested code
  - Validate all requirements in `SEPOLIA_REQUIREMENTS.md` and document results

---

## References
- [d-loop-reference-codebase.txt](./d-loop-reference-codebase.txt)
- [SEPOLIA_REQUIREMENTS.md](./SEPOLIA_REQUIREMENTS.md)
- [d-loop-whitepaper.md](./d-loop-whitepaper.md)
- [d-loop-supplementary-features.md](./d-loop-supplementary-features.md)
- [PriceOracleReport.md](./PriceOracleReport.md)

---

**Next Steps:**
1. Confirm team alignment on this plan
2. Begin Phase 1: Test scaffolding and reference codebase extraction
3. Proceed iteratively, using tests to drive all contract and integration changes
