# AI Node Identification Implementation Plan

## Overview

This document outlines the detailed implementation plan for AI Node identification in the DLOOP protocol. AI Nodes are special participants in governance with differentiated voting parameters. The implementation focuses on secure identification, robust verification, and seamless integration with the existing governance system.

## Key Parameters

### Governance Parameters for AI Nodes
- **Voting Period**: 48 hours (vs. 7 days for regular proposals)
- **Quorum Requirement**: 40% (vs. 30% for regular proposals)
- **Challenge Response Time**: 2 hours maximum

## Core Components

### 1. AINodeIdentityNFT Contract

A soulbound (non-transferrable) NFT that serves as on-chain identity for verified AI nodes.

#### Key Functions:
- `requestVerification(string calldata credentials, string calldata publicIdentifier)`
- `approveVerification(address nodeAddress, uint256 requestId)`
- `revokeVerification(address nodeAddress, uint256 tokenId)`
- `isActiveAINode(address nodeAddress) → bool`
- `initiateChallenge(address nodeAddress, string calldata challengeData)`
- `respondToChallenge(uint256 challengeId, string calldata response)`

#### Storage Variables:
```solidity
struct AINodeIdentityStorage {
    mapping(uint256 => VerificationRequest) verificationRequests;
    mapping(address => uint256) tokenIds;
    mapping(uint256 => Challenge) challenges;
    mapping(address => uint256) reputation;
    uint256 minReputationRequired;
    uint256 requestIdCounter;
    uint256 challengeIdCounter;
    address[] approvers;  // Multi-sig approvers
    uint256 approvalsRequired;
}

struct VerificationRequest {
    address requester;
    string publicIdentifier;
    uint256 timestamp;
    mapping(address => bool) approvals;
    uint256 approvalCount;
    bool isApproved;
}

struct Challenge {
    address targetNode;
    string challengeData;
    uint256 timestamp;
    uint256 responseDeadline;
    bool isResponded;
    bool isSuccessful;
}
```

### 2. AINodeRegistry Contract

A registry for tracking verified AI nodes and their governance parameters.

#### Key Functions:
- `registerNode(address nodeAddress, uint256 tokenId)`
- `unregisterNode(address nodeAddress)`
- `updateNodeStatus(address nodeAddress, bool isActive)`
- `isRegisteredNode(address nodeAddress) → bool`
- `getNodeCount() → uint256`
- `getVotingPeriod(bool isAINodeProposal) → uint256`
- `getQuorumRequirement(bool isAINodeProposal) → uint256`

#### Storage Variables:
```solidity
struct AINodeRegistryStorage {
    mapping(address => bool) registeredNodes;
    address[] nodeAddresses;
    uint256 aiNodeVotingPeriodHours;
    uint256 regularVotingPeriodHours;
    uint256 aiNodeQuorumBps;        // Basis points (e.g., 4000 = 40%)
    uint256 regularQuorumBps;       // Basis points (e.g., 3000 = 30%)
    address identityContract;
}
```

## Integration Points

### Governance Contract Integration

1. **Proposal Creation**
   ```solidity
   function createProposal(
       string calldata title,
       string calldata description,
       bytes[] calldata calldatas,
       address[] calldata targets,
       bool isAINodeProposal
   ) external returns (uint256 proposalId) {
       GovernanceStorage storage s = diamondStorage();
       
       // Check if AI Node proposal and validate caller is an AI Node
       if (isAINodeProposal) {
           require(
               IAINodeRegistry(s.aiNodeRegistry).isRegisteredNode(msg.sender),
               "Not an AI Node"
           );
       }
       
       // Calculate voting period based on proposal type
       uint256 votingPeriod = IAINodeRegistry(s.aiNodeRegistry)
           .getVotingPeriod(isAINodeProposal);
       
       // Calculate quorum requirement based on proposal type
       uint256 quorumRequired = IAINodeRegistry(s.aiNodeRegistry)
           .getQuorumRequirement(isAINodeProposal);
       
       // Create proposal with adjusted parameters
       proposalId = _createProposal(
           title,
           description,
           calldatas,
           targets,
           votingPeriod,
           quorumRequired,
           isAINodeProposal
       );
       
       return proposalId;
   }
   ```

2. **Voting Process**
   ```solidity
   function castVote(uint256 proposalId, bool support) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Check if AI Node proposal and record node participation for rewards
       if (proposal.isAINodeProposal && 
           IAINodeRegistry(s.aiNodeRegistry).isRegisteredNode(msg.sender)) {
           
           // Record AI Node vote for rewards calculation
           IRewardDistributor(s.rewardDistributor).recordVote(
               proposalId,
               msg.sender,
               support
           );
       }
       
       // Continue with regular voting process
       _castVote(proposalId, msg.sender, support);
   }
   ```

## Implementation Steps

### Week 3: AINodeIdentityNFT Contract

#### Day 1-2: Design & Documentation
- Define soulbound NFT interface and verification flow
- Document multi-signature approval process
- Design reputation tracking system

#### Day 3-5: Implementation
1. Create AINodeIdentityNFT contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
   
   contract AINodeIdentityNFT is ERC721 {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.ai.node.identity.storage");
       
       event VerificationRequested(uint256 indexed requestId, address indexed requester, string publicIdentifier);
       event VerificationApproved(uint256 indexed requestId, address indexed nodeAddress, uint256 tokenId);
       event VerificationRevoked(address indexed nodeAddress, uint256 indexed tokenId);
       event ChallengeInitiated(uint256 indexed challengeId, address indexed targetNode, uint256 responseDeadline);
       event ChallengeResponded(uint256 indexed challengeId, address indexed nodeAddress, bool successful);
       
       struct AINodeIdentityStorage {
           mapping(uint256 => VerificationRequest) verificationRequests;
           mapping(address => uint256) tokenIds;
           mapping(uint256 => Challenge) challenges;
           mapping(address => uint256) reputation;
           uint256 minReputationRequired;
           uint256 requestIdCounter;
           uint256 challengeIdCounter;
           address[] approvers;  // Multi-sig approvers
           uint256 approvalsRequired;
       }
       
       struct VerificationRequest {
           address requester;
           string publicIdentifier;
           uint256 timestamp;
           mapping(address => bool) approvals;
           uint256 approvalCount;
           bool isApproved;
       }
       
       struct Challenge {
           address targetNode;
           string challengeData;
           uint256 timestamp;
           uint256 responseDeadline;
           bool isResponded;
           bool isSuccessful;
       }
       
       constructor() ERC721("DLOOP AI Node Identity", "DNODE") {}
       
       function diamondStorage() internal pure returns (AINodeIdentityStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(address[] calldata _approvers, uint256 _approvalsRequired) external {
           AINodeIdentityStorage storage s = diamondStorage();
           require(s.approvers.length == 0, "Already initialized");
           require(_approvers.length >= 3, "Need at least 3 approvers");
           require(_approvalsRequired <= _approvers.length, "Invalid approvals required");
           
           s.approvers = _approvers;
           s.approvalsRequired = _approvalsRequired;
           s.minReputationRequired = 100; // Initial minimum reputation
       }
       
       function requestVerification(string calldata credentials, string calldata publicIdentifier) external returns (uint256) {
           AINodeIdentityStorage storage s = diamondStorage();
           require(s.tokenIds[msg.sender] == 0, "Already verified or requested");
           
           uint256 requestId = ++s.requestIdCounter;
           VerificationRequest storage request = s.verificationRequests[requestId];
           request.requester = msg.sender;
           request.publicIdentifier = publicIdentifier;
           request.timestamp = block.timestamp;
           
           emit VerificationRequested(requestId, msg.sender, publicIdentifier);
           
           return requestId;
       }
       
       function approveVerification(address nodeAddress, uint256 requestId) external {
           AINodeIdentityStorage storage s = diamondStorage();
           VerificationRequest storage request = s.verificationRequests[requestId];
           
           require(isApprover(msg.sender), "Not an approver");
           require(request.requester == nodeAddress, "Invalid node address");
           require(!request.isApproved, "Already approved");
           require(!request.approvals[msg.sender], "Already approved by this approver");
           
           request.approvals[msg.sender] = true;
           request.approvalCount++;
           
           if (request.approvalCount >= s.approvalsRequired) {
               request.isApproved = true;
               
               // Mint the soulbound NFT
               uint256 tokenId = requestId; // Use requestId as tokenId for simplicity
               _mint(nodeAddress, tokenId);
               s.tokenIds[nodeAddress] = tokenId;
               s.reputation[nodeAddress] = 100; // Initial reputation
               
               emit VerificationApproved(requestId, nodeAddress, tokenId);
           }
       }
       
       function revokeVerification(address nodeAddress, uint256 tokenId) external {
           AINodeIdentityStorage storage s = diamondStorage();
           require(isApprover(msg.sender), "Not an approver");
           require(s.tokenIds[nodeAddress] == tokenId, "Token not owned");
           
           // Burn the NFT
           _burn(tokenId);
           delete s.tokenIds[nodeAddress];
           delete s.reputation[nodeAddress];
           
           emit VerificationRevoked(nodeAddress, tokenId);
       }
       
       function isActiveAINode(address nodeAddress) external view returns (bool) {
           AINodeIdentityStorage storage s = diamondStorage();
           return s.tokenIds[nodeAddress] != 0 && s.reputation[nodeAddress] >= s.minReputationRequired;
       }
       
       function initiateChallenge(address nodeAddress, string calldata challengeData) external returns (uint256) {
           AINodeIdentityStorage storage s = diamondStorage();
           require(isApprover(msg.sender), "Not an approver");
           require(s.tokenIds[nodeAddress] != 0, "Not an AI node");
           
           uint256 challengeId = ++s.challengeIdCounter;
           Challenge storage challenge = s.challenges[challengeId];
           challenge.targetNode = nodeAddress;
           challenge.challengeData = challengeData;
           challenge.timestamp = block.timestamp;
           challenge.responseDeadline = block.timestamp + 2 hours;
           
           emit ChallengeInitiated(challengeId, nodeAddress, challenge.responseDeadline);
           
           return challengeId;
       }
       
       function respondToChallenge(uint256 challengeId, string calldata response) external {
           AINodeIdentityStorage storage s = diamondStorage();
           Challenge storage challenge = s.challenges[challengeId];
           
           require(challenge.targetNode == msg.sender, "Not challenge target");
           require(!challenge.isResponded, "Already responded");
           require(block.timestamp <= challenge.responseDeadline, "Response deadline passed");
           
           // In a real implementation, this would include complex validation
           // For demonstration, we'll evaluate response length as proxy for quality
           bool isSuccessful = bytes(response).length >= 10;
           
           challenge.isResponded = true;
           challenge.isSuccessful = isSuccessful;
           
           // Update reputation based on response
           if (isSuccessful) {
               s.reputation[msg.sender] += 10;
           } else {
               if (s.reputation[msg.sender] > 10) {
                   s.reputation[msg.sender] -= 10;
               } else {
                   s.reputation[msg.sender] = 0;
               }
           }
           
           emit ChallengeResponded(challengeId, msg.sender, isSuccessful);
       }
       
       function isApprover(address account) public view returns (bool) {
           AINodeIdentityStorage storage s = diamondStorage();
           for (uint256 i = 0; i < s.approvers.length; i++) {
               if (s.approvers[i] == account) {
                   return true;
               }
           }
           return false;
       }
       
       function getNodeReputation(address nodeAddress) external view returns (uint256) {
           return diamondStorage().reputation[nodeAddress];
       }
       
       function setMinReputationRequired(uint256 newMinimum) external {
           require(isApprover(msg.sender), "Not an approver");
           diamondStorage().minReputationRequired = newMinimum;
       }
       
       // Override transfer functions to make it soulbound (non-transferable)
       function _beforeTokenTransfer(
           address from,
           address to,
           uint256 tokenId,
           uint256 batchSize
       ) internal override {
           require(from == address(0) || to == address(0), "Token is soulbound");
           super._beforeTokenTransfer(from, to, tokenId, batchSize);
       }
   }
   ```

2. Develop verification request and approval system
3. Create unit tests for all verification scenarios

#### Day 6-7: Verification System
1. Implement challenge system for ongoing verification
2. Create reputation tracking mechanisms
3. Test NFT ownership and transfer restrictions

### Week 4: AINodeRegistry and Governance Integration

#### Day 1-2: Design & Documentation
- Define AINodeRegistry interface and governance parameters
- Document integration with Governance contract
- Design voting parameter adjustment mechanism

#### Day 3-5: Implementation
1. Create AINodeRegistry contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   
   interface IAINodeIdentity {
       function isActiveAINode(address nodeAddress) external view returns (bool);
   }
   
   contract AINodeRegistry {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.ai.node.registry.storage");
       
       event NodeRegistered(address indexed nodeAddress, uint256 indexed tokenId);
       event NodeUnregistered(address indexed nodeAddress);
       event NodeStatusUpdated(address indexed nodeAddress, bool isActive);
       event GovernanceParametersUpdated(
           uint256 aiNodeVotingPeriodHours,
           uint256 regularVotingPeriodHours,
           uint256 aiNodeQuorumBps,
           uint256 regularQuorumBps
       );
       
       struct AINodeRegistryStorage {
           mapping(address => bool) registeredNodes;
           address[] nodeAddresses;
           uint256 aiNodeVotingPeriodHours;
           uint256 regularVotingPeriodHours;
           uint256 aiNodeQuorumBps;        // Basis points (e.g., 4000 = 40%)
           uint256 regularQuorumBps;       // Basis points (e.g., 3000 = 30%)
           address identityContract;
       }
       
       function diamondStorage() internal pure returns (AINodeRegistryStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(
           address _identityContract,
           uint256 _aiNodeVotingPeriodHours,
           uint256 _regularVotingPeriodHours,
           uint256 _aiNodeQuorumBps,
           uint256 _regularQuorumBps
       ) external {
           AINodeRegistryStorage storage s = diamondStorage();
           require(s.identityContract == address(0), "Already initialized");
           
           s.identityContract = _identityContract;
           s.aiNodeVotingPeriodHours = _aiNodeVotingPeriodHours;
           s.regularVotingPeriodHours = _regularVotingPeriodHours;
           s.aiNodeQuorumBps = _aiNodeQuorumBps;
           s.regularQuorumBps = _regularQuorumBps;
       }
       
       function registerNode(address nodeAddress, uint256 tokenId) external {
           AINodeRegistryStorage storage s = diamondStorage();
           
           // Verify this is called by the governance contract
           // In practice, this would use access control
           
           require(!s.registeredNodes[nodeAddress], "Already registered");
           require(
               IAINodeIdentity(s.identityContract).isActiveAINode(nodeAddress),
               "Not an active AI node"
           );
           
           s.registeredNodes[nodeAddress] = true;
           s.nodeAddresses.push(nodeAddress);
           
           emit NodeRegistered(nodeAddress, tokenId);
       }
       
       function unregisterNode(address nodeAddress) external {
           AINodeRegistryStorage storage s = diamondStorage();
           
           // Verify this is called by the governance contract
           // In practice, this would use access control
           
           require(s.registeredNodes[nodeAddress], "Not registered");
           
           s.registeredNodes[nodeAddress] = false;
           
           // Remove from array (simplified, would be optimized in production)
           for (uint256 i = 0; i < s.nodeAddresses.length; i++) {
               if (s.nodeAddresses[i] == nodeAddress) {
                   s.nodeAddresses[i] = s.nodeAddresses[s.nodeAddresses.length - 1];
                   s.nodeAddresses.pop();
                   break;
               }
           }
           
           emit NodeUnregistered(nodeAddress);
       }
       
       function updateNodeStatus(address nodeAddress, bool isActive) external {
           AINodeRegistryStorage storage s = diamondStorage();
           
           // This function syncs with the identity contract
           // Can be called by anyone, but will only update based on identity status
           
           bool isActiveInIdentity = IAINodeIdentity(s.identityContract).isActiveAINode(nodeAddress);
           
           if (isActiveInIdentity != isActive) {
               if (isActiveInIdentity) {
                   // Node should be active but isn't registered
                   if (!s.registeredNodes[nodeAddress]) {
                       s.registeredNodes[nodeAddress] = true;
                       s.nodeAddresses.push(nodeAddress);
                       emit NodeRegistered(nodeAddress, 0);
                   }
               } else {
                   // Node shouldn't be active but is registered
                   if (s.registeredNodes[nodeAddress]) {
                       s.registeredNodes[nodeAddress] = false;
                       
                       // Remove from array (simplified, would be optimized in production)
                       for (uint256 i = 0; i < s.nodeAddresses.length; i++) {
                           if (s.nodeAddresses[i] == nodeAddress) {
                               s.nodeAddresses[i] = s.nodeAddresses[s.nodeAddresses.length - 1];
                               s.nodeAddresses.pop();
                               break;
                           }
                       }
                       
                       emit NodeUnregistered(nodeAddress);
                   }
               }
               
               emit NodeStatusUpdated(nodeAddress, isActiveInIdentity);
           }
       }
       
       function isRegisteredNode(address nodeAddress) external view returns (bool) {
           AINodeRegistryStorage storage s = diamondStorage();
           return s.registeredNodes[nodeAddress] && 
                  IAINodeIdentity(s.identityContract).isActiveAINode(nodeAddress);
       }
       
       function getNodeCount() external view returns (uint256) {
           return diamondStorage().nodeAddresses.length;
       }
       
       function getVotingPeriod(bool isAINodeProposal) external view returns (uint256) {
           AINodeRegistryStorage storage s = diamondStorage();
           return isAINodeProposal ? s.aiNodeVotingPeriodHours : s.regularVotingPeriodHours;
       }
       
       function getQuorumRequirement(bool isAINodeProposal) external view returns (uint256) {
           AINodeRegistryStorage storage s = diamondStorage();
           return isAINodeProposal ? s.aiNodeQuorumBps : s.regularQuorumBps;
       }
       
       function setGovernanceParameters(
           uint256 _aiNodeVotingPeriodHours,
           uint256 _regularVotingPeriodHours,
           uint256 _aiNodeQuorumBps,
           uint256 _regularQuorumBps
       ) external {
           // Verify this is called by the governance contract
           // In practice, this would use access control
           
           AINodeRegistryStorage storage s = diamondStorage();
           
           require(_aiNodeVotingPeriodHours > 0, "Invalid voting period");
           require(_regularVotingPeriodHours > 0, "Invalid voting period");
           require(_aiNodeQuorumBps > 0 && _aiNodeQuorumBps <= 10000, "Invalid quorum");
           require(_regularQuorumBps > 0 && _regularQuorumBps <= 10000, "Invalid quorum");
           
           s.aiNodeVotingPeriodHours = _aiNodeVotingPeriodHours;
           s.regularVotingPeriodHours = _regularVotingPeriodHours;
           s.aiNodeQuorumBps = _aiNodeQuorumBps;
           s.regularQuorumBps = _regularQuorumBps;
           
           emit GovernanceParametersUpdated(
               _aiNodeVotingPeriodHours,
               _regularVotingPeriodHours,
               _aiNodeQuorumBps,
               _regularQuorumBps
           );
       }
   }
   ```

2. Develop governance parameter calculation functions
3. Create unit tests for different node types

#### Day 6-7: Governance Integration
1. Modify Governance contract to use AINodeRegistry
   ```solidity
   // Governance.sol modifications
   
   // Add AI Node Registry interface
   interface IAINodeRegistry {
       function isRegisteredNode(address nodeAddress) external view returns (bool);
       function getVotingPeriod(bool isAINodeProposal) external view returns (uint256);
       function getQuorumRequirement(bool isAINodeProposal) external view returns (uint256);
   }
   
   // Add storage variables
   struct GovernanceStorage {
       // Existing storage variables
       address aiNodeRegistry;
       // Add proposal type
       struct Proposal {
           // Existing properties
           bool isAINodeProposal;
       }
   }
   
   // Update functions
   function createProposal(
       string calldata title,
       string calldata description,
       bytes[] calldata calldatas,
       address[] calldata targets,
       bool isAINodeProposal
   ) external returns (uint256) {
       GovernanceStorage storage s = diamondStorage();
       
       // Check if AI Node proposal and validate caller is an AI Node
       if (isAINodeProposal) {
           require(
               IAINodeRegistry(s.aiNodeRegistry).isRegisteredNode(msg.sender),
               "Not an AI Node"
           );
       }
       
       // Calculate voting period based on proposal type
       uint256 votingPeriod = IAINodeRegistry(s.aiNodeRegistry)
           .getVotingPeriod(isAINodeProposal);
       
       // Calculate quorum requirement based on proposal type
       uint256 quorumRequired = IAINodeRegistry(s.aiNodeRegistry)
           .getQuorumRequirement(isAINodeProposal);
       
       // Create proposal with adjusted parameters
       uint256 proposalId = _createProposal(
           title,
           description,
           calldatas,
           targets,
           votingPeriod,
           quorumRequired
       );
       
       // Mark as AI Node proposal
       s.proposals[proposalId].isAINodeProposal = isAINodeProposal;
       
       return proposalId;
   }
   
   function castVote(uint256 proposalId, bool support) external {
       GovernanceStorage storage s = diamondStorage();
       Proposal storage proposal = s.proposals[proposalId];
       
       // Check if AI Node proposal and record node participation for rewards
       if (proposal.isAINodeProposal && 
           IAINodeRegistry(s.aiNodeRegistry).isRegisteredNode(msg.sender)) {
           
           // Record AI Node vote for rewards calculation
           if (s.rewardDistributor != address(0)) {
               IRewardDistributor(s.rewardDistributor).recordVote(
                   proposalId,
                   msg.sender,
                   support
               );
           }
       }
       
       // Continue with regular voting process
       _castVote(proposalId, msg.sender, support);
   }
   
   // Add setter for AI Node Registry
   function setAINodeRegistry(address _aiNodeRegistry) external {
       // Access control will be handled in diamond facet
       GovernanceStorage storage s = diamondStorage();
       s.aiNodeRegistry = _aiNodeRegistry;
   }
   ```

2. Implement differentiated voting periods and quorum
3. Test complete AI node governance flow

## Testing Strategy

### Unit Testing
1. **AINodeIdentityNFT Tests**
   - Verification request and approval flow
   - Soulbound property (non-transferability)
   - Challenge system and reputation tracking
   - Access control for approvers

2. **AINodeRegistry Tests**
   - Node registration and unregistration
   - Governance parameter calculations
   - Status synchronization with identity contract

3. **Integration Tests**
   - End-to-end verification and governance flow
   - Proposal creation with different parameters
   - Voting with different node types

### Property-Based Testing
1. **Invariants**
   - Only verified AI nodes can create AI node proposals
   - Node reputation always stays within valid range
   - Soulbound NFTs cannot be transferred between accounts

2. **Security Properties**
   - Multi-sig verification ensures no single point of failure
   - Challenge system allows revoking compromised nodes
   - Governance parameters always respect minimum values

## Deployment Plan

### 1. Testnet Deployment
- Deploy AINodeIdentityNFT with trusted approvers
- Deploy AINodeRegistry with initial parameters (48h/7d voting, 40%/30% quorum)
- Integrate with existing Governance contract
- Verify selected test nodes for initial testing

### 2. Mainnet Deployment
- Deploy with identical parameters to testnet
- Establish formal verification process for AI nodes
- Begin with limited AI node proposals to validate system

## Governance Controls

1. **Parameter Adjustments**
   - Voting periods and quorum requirements adjustable by governance
   - Approval threshold and approver list adjustable by governance
   - Minimum reputation required adjustable by governance

2. **Node Verification**
   - Initial verification through multi-sig approvers
   - Ongoing verification through challenge system
   - Reputation tracking for ongoing quality assurance

## Conclusion

This implementation plan provides a comprehensive approach to implementing AI Node identification in the DLOOP protocol. The soulbound NFT-based identity system, coupled with the registry for governance integration, provides a secure and flexible solution for differentiating AI nodes in the governance process while maintaining the integrity of the system.