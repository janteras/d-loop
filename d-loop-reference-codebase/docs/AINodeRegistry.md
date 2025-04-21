# AI Node Registry

## Overview

The AINodeRegistry contract manages the registration and verification of AI nodes within the DLOOP ecosystem. It serves as the authoritative source for identifying which addresses represent AI nodes, enabling special privileges and responsibilities for these participants in the governance process.

## Key Features

- **AI Node Registration**: Process for registering new AI nodes.
- **Verification Status**: Tracks verification status of AI nodes.
- **Soulbound NFT Integration**: Uses soulbound NFTs as credential verification.
- **Activity Status**: Tracks whether AI nodes are active or deactivated.
- **Query Capabilities**: Methods to check if an address is an AI node.
- **Role-based Access**: Different roles for registration and verification.
- **Upgradability**: Contract is upgradeable using the UUPS pattern.

## Core Functions

### Registration and Management

| Function | Description |
|----------|-------------|
| `registerAINode(address aiNode, string calldata metadata)` | Registers a new AI node with metadata |
| `verifyAINode(address aiNode)` | Marks an AI node as verified |
| `deactivateAINode(address aiNode)` | Deactivates an AI node |
| `reactivateAINode(address aiNode)` | Reactivates a previously deactivated AI node |

### Query Functions

| Function | Description |
|----------|-------------|
| `isAINode(address account)` | Checks if an address is a registered AI node |
| `isVerifiedAINode(address account)` | Checks if an address is a verified AI node |
| `isActiveAINode(address account)` | Checks if an address is an active AI node |
| `getAINodeList()` | Gets the list of all registered AI nodes |
| `getVerifiedAINodeList()` | Gets the list of all verified AI nodes |
| `getActiveAINodeList()` | Gets the list of all active AI nodes |
| `getAINodeMetadata(address aiNode)` | Gets the metadata for an AI node |

### Configuration

| Function | Description |
|----------|-------------|
| `setSoulboundNFT(address newSoulboundNFT)` | Sets the address of the soulbound NFT contract |

### Access Control

| Role | Description |
|------|-------------|
| `ADMIN_ROLE` | Can update contract configurations |
| `REGISTRAR_ROLE` | Can register new AI nodes |
| `VERIFIER_ROLE` | Can verify AI nodes |
| `UPGRADER_ROLE` | Can upgrade the contract implementation |
| `DEFAULT_ADMIN_ROLE` | Can grant and revoke roles |

## Technical Details

- Each AI node is associated with metadata that can include information about its capabilities, provider, etc.
- The registry maintains separate lists for:
  - All registered AI nodes
  - Verified AI nodes
  - Active AI nodes
- The contract integrates with a SoulboundNFT contract to issue credentials to verified AI nodes.
- Node registration states:
  - Registered: Basic registration complete
  - Verified: Node's capabilities have been verified
  - Active/Inactive: Current operational status

## Integration with Other Components

- **SoulboundNFT**: Issues non-transferable credentials to verified AI nodes.
- **GovernanceRewards**: Uses the registry to identify AI nodes for special voting treatment.
- **Protocol DAO**: May use the registry to apply different voting rules for AI nodes.

## Usage Examples

### Registering a New AI Node

1. A registrar calls `registerAINode()` with the node's address and metadata.
2. The node is added to the registry as unverified.

### Verifying an AI Node

1. A verifier calls `verifyAINode()` after confirming the node's capabilities.
2. The node receives a soulbound NFT as credential and is marked as verified.
3. The node can now participate in governance with AI-specific privileges.

### Managing Node Status

1. An admin can call `deactivateAINode()` to temporarily suspend a node's participation.
2. Later, the admin can call `reactivateAINode()` to restore the node's status.

## Security Considerations

- Role-based access control restricts operations to appropriate roles.
- The contract maintains multiple status flags to provide granular control over AI node participation.
- Integration with soulbound NFTs ensures that AI node credentials cannot be transferred.
- Metadata provides transparency about each AI node's characteristics and provider.
- Deactivation capability allows for quick response to compromised or misbehaving nodes.