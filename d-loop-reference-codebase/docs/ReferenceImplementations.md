# Reference Implementations

This document explains the purpose and handling of reference implementation files in the DLOOP smart contract project.

## What are Reference Implementations?

Reference implementations are contract files that serve as additional examples or alternative implementations of core functionality. These files:

- Are marked with "RefOnly" in their filename
- Provide valuable implementation details that developers can study
- Are NOT meant to be deployed to production
- Should be removed from the final production bundle

## Current Reference Implementations

### AssetDAOWithFeesRefOnly.sol

- **Location**: `/contracts/fees/AssetDAOWithFeesRefOnly.sol`
- **Purpose**: Alternative implementation of AssetDAOWithFees with a different approach to fee handling
- **Status**: For reference only, should NOT be deployed
- **Notes**: This file was previously named "AssetDAOWithFees (copy).sol" and has been renamed for clarity

## Handling Reference Files

### During Development

- Reference files can be studied for implementation ideas
- Use reference files to understand alternative approaches
- If needed, copy specific functions or patterns from reference files to production files

### Before Deployment

- **IMPORTANT**: Remove all files with "RefOnly" in their name
- These files should NOT be included in any production deployment
- Run `grep -r "RefOnly" ./contracts` to find any remaining reference files

## Canonical Implementations

For each reference implementation, there is a canonical (official) implementation that should be used in production:

| Reference File | Canonical Implementation |
|----------------|--------------------------|
| AssetDAOWithFeesRefOnly.sol | AssetDAOWithFees.sol |

Always use the canonical implementations for deployment and production use.