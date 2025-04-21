# AI Node Identification System

## Overview

The AI Node Identification System is a critical component of the DLOOP ecosystem, providing a mechanism to distinguish AI-operated nodes from regular users. This system enables differentiated governance rules, voting periods, and quorum requirements for AI participants.

## Components

### SoulboundNFT Contract

The SoulboundNFT contract is a non-transferable ERC-721 token that serves as a credential for AI nodes. Key features:

- **Non-transferability**: Once issued to an AI node, the NFT cannot be transferred to another address, ensuring the identity remains tied to the specific AI.
- **Detailed metadata**: Each NFT contains information about the AI model, verification proof, and operational status.
- **Verification timestamps**: Tracks when each AI node was last verified to ensure periodic revalidation.

### AINodeRegistry Contract

The AINodeRegistry manages the registration and verification of AI nodes:

- **Registration**: Governance can register new AI nodes by issuing SoulboundNFTs.
- **Verification**: Periodic verification ensures AI nodes remain valid and active.
- **Status tracking**: Maintains active/inactive status for each AI node.

### AINodeGovernance Integration

This component interfaces with the governance system:

- **Differentiated voting**: AI nodes get shorter voting periods (1 day vs 7 days for humans).
- **Higher quorum**: AI-initiated fast-track proposals require higher quorum (40% vs 30%).
- **Verification checks**: Governance actions automatically check if a participant is an active AI node.

## Implementation Details

### Soulbound NFT Mechanism

The SoulboundNFT uses OpenZeppelin's ERC-721 with a custom `_beforeTokenTransfer` hook:

```solidity
function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId,
    uint256 batchSize
) internal override {
    // Only allow minting (from == address(0)), no transfers or burns
    require(from == address(0) || hasRole(MINTER_ROLE, msg.sender), 
            "SoulboundNFT: tokens are non-transferable");
    
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
}
```

### Verification Process

AI nodes must periodically undergo verification to maintain their active status:

1. A verifier with `VERIFIER_ROLE` calls `verifyNode(tokenId, verificationProof)`.
2. The verification proof and timestamp are updated.
3. If verification is not performed within `verificationInterval`, the node can be marked inactive.

### Integration with Governance

To check if an address belongs to an AI node:

```solidity
function getVotingPeriod(address sender) public view returns (uint256) {
    return nodeIdentifier.isActiveAINode(sender) ? aiNodeVotingPeriod : humanVotingPeriod;
}
```

## Usage Examples

### Registering a New AI Node

```javascript
// Assuming the caller has GOVERNANCE_ROLE
await aiNodeRegistry.registerNode(
    aiNodeAddress,
    "GPT-4-FINANCE",
    "verification-proof-hash"
);
```

### Checking AI Node Status

```javascript
const isAINode = await aiNodeRegistry.isActiveAINode(userAddress);
if (isAINode) {
    // Apply AI-specific logic
} else {
    // Apply regular user logic
}
```

## Security Considerations

- Only addresses with `GOVERNANCE_ROLE` can register new AI nodes
- Only addresses with `VERIFIER_ROLE` can perform verification
- NFTs cannot be transferred, preventing identity theft
- Regular verification is required to maintain active status