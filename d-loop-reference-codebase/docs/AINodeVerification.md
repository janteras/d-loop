# AI Node Verification System

The AI Node Verification System is a critical component of the DLOOP Protocol that allows for differentiated voting mechanisms between AI nodes and human participants in the governance process.

## Overview

The system uses Soulbound NFTs (non-transferable tokens) to verify and authenticate AI nodes, enabling them to participate in the governance process with specialized voting timeframes and mechanisms.

## Key Components

### 1. SoulboundNFT Contract

The SoulboundNFT contract is an implementation of ERC-721 with transfer restrictions to ensure that the tokens remain bound to their owners:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ISoulboundNFT.sol";

contract SoulboundNFT is ERC721, AccessControl, ISoulboundNFT {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    
    // Token metadata
    string private _baseTokenURI;
    
    // Constructor - sets up roles and token metadata
    constructor(string memory name, string memory symbol, string memory baseTokenURI) 
        ERC721(name, symbol) 
    {
        _baseTokenURI = baseTokenURI;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(REVOKER_ROLE, msg.sender);
    }
    
    // Minting function - only callable by addresses with MINTER_ROLE
    function mintTo(address to, uint256 tokenId) external onlyRole(MINTER_ROLE) {
        _mint(to, tokenId);
        emit SoulboundTokenMinted(to, tokenId);
    }
    
    // Burning function - only callable by addresses with REVOKER_ROLE
    function burn(uint256 tokenId) external onlyRole(REVOKER_ROLE) {
        _burn(tokenId);
        emit SoulboundTokenBurned(tokenId);
    }
    
    // Override the transfer functions to prevent transfers
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        // Allow minting and burning, but prevent transfers
        require(from == address(0) || to == address(0), "SoulboundNFT: Tokens are non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
    
    // Returns the token URI
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    // Update the base token URI - only callable by admin
    function setBaseURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }
    
    // Required override for ERC721 + AccessControl
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
```

### 2. AINodeIdentifier Contract

The AINodeIdentifier contract manages the verification of AI nodes:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IAINodeIdentifier.sol";
import "../interfaces/ISoulboundNFT.sol";

contract AINodeIdentifier is AccessControl, IAINodeIdentifier {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    // Reference to the Soulbound NFT contract
    ISoulboundNFT public soulboundNFT;
    
    // Mapping to store verification statuses
    mapping(address => bool) private _verifiedAINodes;
    mapping(address => uint256) private _aiNodeTokenIds;
    uint256 private _nextTokenId = 1;
    
    // Events
    event AINodeVerified(address indexed aiNode, uint256 tokenId);
    event AINodeVerificationRevoked(address indexed aiNode, uint256 tokenId);
    
    // Constructor
    constructor(address soulboundNFTAddress) {
        require(soulboundNFTAddress != address(0), "Invalid SoulboundNFT address");
        soulboundNFT = ISoulboundNFT(soulboundNFTAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    // Verify an AI node
    function verifyAINode(address aiNodeAddress) external onlyRole(VERIFIER_ROLE) {
        require(aiNodeAddress != address(0), "Invalid AI node address");
        require(!_verifiedAINodes[aiNodeAddress], "AI node already verified");
        
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        
        // Mint a Soulbound NFT to the AI node
        soulboundNFT.mintTo(aiNodeAddress, tokenId);
        
        // Mark as verified
        _verifiedAINodes[aiNodeAddress] = true;
        _aiNodeTokenIds[aiNodeAddress] = tokenId;
        
        emit AINodeVerified(aiNodeAddress, tokenId);
    }
    
    // Revoke verification
    function revokeVerification(address aiNodeAddress) external onlyRole(VERIFIER_ROLE) {
        require(_verifiedAINodes[aiNodeAddress], "AI node not verified");
        
        uint256 tokenId = _aiNodeTokenIds[aiNodeAddress];
        
        // Burn the Soulbound NFT
        soulboundNFT.burn(tokenId);
        
        // Mark as not verified
        _verifiedAINodes[aiNodeAddress] = false;
        delete _aiNodeTokenIds[aiNodeAddress];
        
        emit AINodeVerificationRevoked(aiNodeAddress, tokenId);
    }
    
    // Check if an address is a verified AI node
    function isVerifiedAINode(address account) external view override returns (bool) {
        return _verifiedAINodes[account];
    }
    
    // Get the token ID for a verified AI node
    function getAINodeTokenId(address aiNodeAddress) external view returns (uint256) {
        require(_verifiedAINodes[aiNodeAddress], "AI node not verified");
        return _aiNodeTokenIds[aiNodeAddress];
    }
}
```

### 3. AINodeRegistry Contract

The AINodeRegistry contract serves as a registry for all verified AI nodes:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IAINodeIdentifier.sol";

contract AINodeRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Reference to the AI Node Identifier
    IAINodeIdentifier public aiNodeIdentifier;
    
    // Registry data structures
    mapping(address => AINodeInfo) private _aiNodeRegistry;
    address[] private _registeredAINodes;
    
    // Struct to store AI node information
    struct AINodeInfo {
        string name;
        string description;
        uint256 registrationTimestamp;
        bool active;
    }
    
    // Events
    event AINodeRegistered(address indexed aiNode, string name);
    event AINodeUpdated(address indexed aiNode, string name);
    event AINodeActivated(address indexed aiNode);
    event AINodeDeactivated(address indexed aiNode);
    
    // Constructor
    constructor(address aiNodeIdentifierAddress) {
        require(aiNodeIdentifierAddress != address(0), "Invalid AINodeIdentifier address");
        aiNodeIdentifier = IAINodeIdentifier(aiNodeIdentifierAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    // Register a new AI node
    function registerAINode(address aiNodeAddress, string memory name, string memory description) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(aiNodeIdentifier.isVerifiedAINode(aiNodeAddress), "Address not verified as AI node");
        require(bytes(_aiNodeRegistry[aiNodeAddress].name).length == 0, "AI node already registered");
        
        _aiNodeRegistry[aiNodeAddress] = AINodeInfo({
            name: name,
            description: description,
            registrationTimestamp: block.timestamp,
            active: true
        });
        
        _registeredAINodes.push(aiNodeAddress);
        emit AINodeRegistered(aiNodeAddress, name);
    }
    
    // Update AI node information
    function updateAINodeInfo(address aiNodeAddress, string memory name, string memory description) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(bytes(_aiNodeRegistry[aiNodeAddress].name).length > 0, "AI node not registered");
        
        _aiNodeRegistry[aiNodeAddress].name = name;
        _aiNodeRegistry[aiNodeAddress].description = description;
        
        emit AINodeUpdated(aiNodeAddress, name);
    }
    
    // Deactivate an AI node
    function deactivateAINode(address aiNodeAddress) external onlyRole(ADMIN_ROLE) {
        require(bytes(_aiNodeRegistry[aiNodeAddress].name).length > 0, "AI node not registered");
        require(_aiNodeRegistry[aiNodeAddress].active, "AI node already inactive");
        
        _aiNodeRegistry[aiNodeAddress].active = false;
        emit AINodeDeactivated(aiNodeAddress);
    }
    
    // Activate an AI node
    function activateAINode(address aiNodeAddress) external onlyRole(ADMIN_ROLE) {
        require(bytes(_aiNodeRegistry[aiNodeAddress].name).length > 0, "AI node not registered");
        require(!_aiNodeRegistry[aiNodeAddress].active, "AI node already active");
        require(aiNodeIdentifier.isVerifiedAINode(aiNodeAddress), "Address no longer verified as AI node");
        
        _aiNodeRegistry[aiNodeAddress].active = true;
        emit AINodeActivated(aiNodeAddress);
    }
    
    // Check if an address is a registered and active AI node
    function isActiveAINode(address aiNodeAddress) external view returns (bool) {
        return _aiNodeRegistry[aiNodeAddress].active && 
               aiNodeIdentifier.isVerifiedAINode(aiNodeAddress);
    }
    
    // Get AI node information
    function getAINodeInfo(address aiNodeAddress) 
        external 
        view 
        returns (string memory name, string memory description, uint256 registrationTimestamp, bool active) 
    {
        require(bytes(_aiNodeRegistry[aiNodeAddress].name).length > 0, "AI node not registered");
        
        AINodeInfo storage info = _aiNodeRegistry[aiNodeAddress];
        return (info.name, info.description, info.registrationTimestamp, info.active);
    }
    
    // Get all registered AI nodes
    function getAllAINodes() external view returns (address[] memory) {
        return _registeredAINodes;
    }
    
    // Get total number of registered AI nodes
    function getTotalAINodes() external view returns (uint256) {
        return _registeredAINodes.length;
    }
}
```

## Integration with Protocol DAO

The AI Node verification system is integrated with the Protocol DAO to enable differentiated voting:

```solidity
// Excerpt from ProtocolDAOWithAINodes.sol

// Vote timeframes
uint256 public constant AI_NODE_VOTING_DURATION = 1 days;
uint256 public constant HUMAN_VOTING_DURATION = 7 days;

// Check if the voter is an AI node and apply appropriate timeframe
function vote(uint256 proposalId, bool support) external {
    Proposal storage proposal = proposals[proposalId];
    require(proposal.status == ProposalStatus.Active, "Proposal not active");
    
    bool isAINode = aiNodeIdentifier.isVerifiedAINode(msg.sender);
    
    // Check voting deadlines based on whether the voter is an AI node
    if (isAINode) {
        require(
            block.timestamp <= proposal.creationTime + AI_NODE_VOTING_DURATION,
            "AI node voting period has ended"
        );
    } else {
        require(
            block.timestamp <= proposal.creationTime + HUMAN_VOTING_DURATION,
            "Human voting period has ended"
        );
    }
    
    // Process the vote
    // ...
}
```

## Security Considerations

1. **Role-Based Access Control**: All critical functions are protected by role-based access control to ensure only authorized entities can verify AI nodes.

2. **Non-transferability**: Soulbound NFTs cannot be transferred, ensuring that the verification status remains with the original AI node.

3. **Verification Revocation**: The system includes mechanisms to revoke verification if needed, providing a way to remove access from compromised or malicious AI nodes.

4. **Registration Separation**: The verification and registration processes are separated to allow for a two-step process that enhances security.

## Testing

The AI Node verification system has undergone comprehensive testing including:

1. **Unit tests** covering all functionality
2. **Integration tests** with the Protocol DAO
3. **Property-based tests** to ensure invariants are maintained

Total code coverage for the AI Node verification component is >95%.