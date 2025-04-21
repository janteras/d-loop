# Soulbound NFT

## Overview

The SoulboundNFT contract implements a non-transferable token that functions as a credential for verified AI nodes in the DLOOP ecosystem. Unlike standard NFTs, these tokens cannot be transferred by their owners and are permanently bound to the recipient's address, ensuring that AI node credentials remain with the intended entity.

## Key Features

- **Non-transferability**: Tokens cannot be transferred by their owners.
- **Revocability**: Tokens can be revoked by authorized addresses.
- **Metadata Support**: Each token can have associated metadata.
- **Minting Control**: Only authorized addresses can mint tokens.
- **Role-based Access**: Different roles for minting, revoking, and administration.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Token Management

| Function | Description |
|----------|-------------|
| `mint(address to, string calldata tokenURI)` | Mints a new token to the specified address |
| `revoke(uint256 tokenId)` | Revokes a token, burning it |
| `tokenURI(uint256 tokenId)` | Returns the token's URI containing its metadata |

### Query Functions

| Function | Description |
|----------|-------------|
| `balanceOf(address owner)` | Returns the number of tokens owned by an address |
| `ownerOf(uint256 tokenId)` | Returns the owner of a token |
| `hasValidCredential(address account)` | Checks if an address has at least one valid token |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Has general administrative permissions |
| `MINTER_ROLE` | Can mint new tokens |
| `REVOKER_ROLE` | Can revoke tokens |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- The contract extends ERC721Upgradeable for basic NFT functionality.
- Transfer functions are overridden to prevent token transfers by token owners.
- Authorized addresses with the MINTER_ROLE can mint tokens.
- Authorized addresses with the REVOKER_ROLE can revoke tokens.
- Each token has a unique tokenURI that points to its metadata.
- The contract maintains a counter to assign unique IDs to new tokens.

## Integration with Other Components

- **AINodeRegistry**: Uses the SoulboundNFT as a credential system for verified AI nodes.
- **GovernanceRewards**: May check for valid credentials when determining AI node status.
- **Protocol DAO**: May use credential verification for governance participation.

## Usage Examples

### Issuing a Credential to an AI Node

1. When an AI node is verified, AINodeRegistry calls the `mint()` function.
2. The AI node receives a token that serves as proof of verification.
3. The token's metadata can include information about the AI node's verification details.

### Checking Credential Validity

1. Other contracts can call `hasValidCredential()` to check if an address has a valid credential.
2. This verification ensures that only properly credentialed AI nodes participate in governance.

### Revoking a Credential

1. If an AI node's behavior warrants credential removal, a revoker calls `revoke()`.
2. The token is burned, removing the credential.
3. The AI node loses any privileges associated with having a valid credential.

## Security Considerations

- Role-based access control restricts minting and revoking operations to authorized addresses.
- Transfer prevention ensures credentials cannot be sold or transferred to unauthorized entities.
- Revocation capability allows for removal of credentials from compromised or misbehaving AI nodes.
- The contract uses OpenZeppelin's secure implementation patterns.
- Metadata URIs should be carefully managed to prevent metadata tampering.