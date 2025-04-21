# Ethers v6 Compatibility, Migration, and Shim Guide

## Overview

The D-Loop Protocol uses ethers.js v6 for all contract interactions and testing. To maintain backward compatibility with ethers v5 APIs, a compatibility layer (shim) is provided. This guide explains how to use the compatibility shim, how to migrate to native ethers v6 APIs, and how to maintain consistency across the codebase.

---

## Directory Structure & Shim Inventory

The ethers-v6 compatibility layer is organized as follows:

```
test/
├── utils/
│   ├── ethers-v6-compat.js  # Main compatibility layer (canonical shim)
│   └── ethers-helpers.js    # Additional helper functions
├── ...
```

**Shim Files Inventory:**

| Shim File                       | Location                                  | Purpose                                 |
|---------------------------------|-------------------------------------------|-----------------------------------------|
| ethers-v6-shim.js               | Root directory                            | Entry point, re-exports canonical shim   |
| ethers-v6-shim.enhanced.v2.js   | /test/                                    | Canonical implementation (used by all)   |
```
All other shim variants have been removed for clarity and maintainability.
```

---

## Usage Guidelines & Import Patterns

**Always use relative paths to import the ethers-v6-compat.js file:**

```js
// In test/unit files (2 levels deep)
const ethers = require('../../utils/ethers-v6-compat');
// In test/integration files (1 level deep)
const ethers = require('../utils/ethers-v6-compat');
// In test/utils files (same directory)
const ethers = require('./ethers-v6-compat');
```

**Standardize Imports:**
- Use the canonical shim for all test files.
- Avoid importing from legacy or variant shims.

---

## API Compatibility Reference (v5 → v6 Mapping)

### Utility Functions
| Compatibility Layer API         | Native Ethers v6 API     |
|---------------------------------|--------------------------|
| ethers.utils.parseUnits()       | ethers.parseUnits()      |
| ethers.utils.formatUnits()      | ethers.formatUnits()     |
| ethers.utils.parseEther()       | ethers.parseEther()      |
| ethers.utils.formatEther()      | ethers.formatEther()     |
| ethers.utils.keccak256()        | ethers.keccak256()       |
| ethers.utils.toUtf8Bytes()      | ethers.toUtf8Bytes()     |
| ethers.utils.getAddress()       | ethers.getAddress()      |
| ethers.utils.isAddress()        | ethers.isAddress()       |

### Constants
| Compatibility Layer API         | Native Ethers v6 API     |
|---------------------------------|--------------------------|
| ethers.constants.AddressZero    | ethers.ZeroAddress       |
| ethers.constants.HashZero       | ethers.ZeroHash          |
| ethers.constants.Zero           | 0n (BigInt literal)      |
| ethers.constants.One            | 1n (BigInt literal)      |
| ethers.constants.Two            | 2n (BigInt literal)      |
| ethers.constants.MaxUint256     | ethers.MaxUint256        |

### BigNumber
| Compatibility Layer API         | Native Ethers v6 API     |
|---------------------------------|--------------------------|
| ethers.BigNumber.from(value)    | BigInt(value)            |
| bn.toNumber()                   | Number(bigint)           |
| bn.toString()                   | bigint.toString()        |

---

## Migration Guide

### Why Migrate to Native APIs?
- **Performance:** Native APIs are more efficient than compatibility layer wrappers
- **Maintainability:** Reduces dependency on custom compatibility code
- **Future-proofing:** Ensures compatibility with future ethers.js updates
- **Community alignment:** Aligns with broader ecosystem practices

### Migration Strategy
1. **Automated Migration:**
   - Use the provided migration script: `node scripts/migrate-to-native-ethers-v6.js`
2. **Gradual Migration:**
   - Start with utility functions, then constants, then BigNumber, then contract interactions
3. **Testing:**
   - Always run the relevant test suite after migrating a file

### Common Migration Challenges
- **BigInt vs. BigNumber:** Use `n` suffix for BigInt, update math and type checks
- **Contract Interactions:** Factory methods and contract instances may differ in v6

---

## Shim Usage Report & Standardization

### Current State
- Project uses ethers.js v6.0.0+
- All shims except the canonical one have been removed
- All test files import from the central shim

### Issues Previously Identified
- Inconsistent import paths (now resolved)
- Feature fragmentation (now resolved)
- Maintenance challenges (now resolved)

### Recommendations Implemented
- **Consolidate Shim Files:** Single, comprehensive shim in `/test/`
- **Standardize Import Paths:** All tests use the canonical shim
- **Document API Compatibility:** This guide provides the mapping and usage

---

## Maintaining the Compatibility Layer

- Add new ethers v5 APIs to the shim as needed
- Run the test suite after changes
- Document new APIs in this guide

---

## Testing & Linting

- ESLint and pre-commit hooks enforce correct import paths
- All tests must pass after any shim or migration changes

---

## References & Further Reading
- [Ethers.js v6 Documentation](https://docs.ethers.org/v6/)
- [D-Loop Protocol Testing Guide](./README.md)
- [D-Loop Protocol Migration Scripts](../scripts/)

---

**This guide replaces the previous ETHERS_V6_COMPAT_GUIDE.md, ETHERS_V6_NATIVE_MIGRATION_GUIDE.md, and ETHERS_V6_SHIM_USAGE_REPORT.md.**
