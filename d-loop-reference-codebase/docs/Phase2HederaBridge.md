# Hedera Bridge Implementation Plan

## Overview

This document outlines the detailed implementation plan for the DLOOP protocol's cross-chain bridge between Ethereum and Hedera networks. The initial implementation will focus on creating a unidirectional bridge (Ethereum → Hedera) with strong security measures, validator-based consensus, and threshold signatures.

## Bridge Parameters

### Security Parameters
- **Validator Threshold**: 2/3 of validators must approve transfers
- **Timelock Period**: 24-hour delay for large transfers (>$100,000)
- **Transfer Limits**: $250,000 daily maximum

### Fee Parameters
- **Bridge Fee**: 0.1% for cross-chain transfers
- **Fee Distribution**: 80% to Treasury, 20% to validators
- **Validator Reward**: Proportional to participation in threshold signing

## Core Components

### 1. HederaBridge Contract (Ethereum)

The Ethereum-side contract that locks tokens and initiates cross-chain transfers.

#### Key Functions:
- `bridgeTokens(address token, uint256 amount, string calldata hederaRecipient)`
- `validateTransfer(bytes32 transferId, bytes[] calldata signatures)`
- `unlockTokens(bytes32 transferId, address recipient, bytes[] calldata signatures)`
- `registerValidator(address validator)`
- `removeValidator(address validator)`

#### Storage Variables:
```solidity
struct HederaBridgeStorage {
    mapping(bytes32 => Transfer) transfers;            // Transfer records
    mapping(address => bool) validators;               // Approved validators
    address[] validatorList;                           // List of validators for iteration
    mapping(address => bool) supportedTokens;          // Tokens supported for bridging
    uint256 validatorThreshold;                        // Min validators for approval
    uint256 timelockThreshold;                         // Amount requiring timelock
    uint256 dailyLimit;                                // Maximum daily transfer
    uint256 bridgeFeeBps;                              // Bridge fee in basis points
    mapping(address => uint256) dailyTransferred;      // Daily transfer amount by token
    mapping(address => uint256) lastResetTime;         // Last daily limit reset time
    address treasury;                                  // Protocol treasury
}

struct Transfer {
    address token;               // Token being transferred
    uint256 amount;              // Amount being transferred
    address sender;              // Ethereum sender
    string hederaRecipient;      // Hedera recipient account
    uint256 timestamp;           // Transfer initiation time
    bool isCompleted;            // Whether transfer is completed
    uint256 validations;         // Number of validations received
    mapping(address => bool) hasValidated;  // Which validators have validated
}
```

### 2. HederaAdapter Contract (Hedera)

The Hedera-side contract that receives cross-chain messages and releases tokens.

#### Key Functions:
- `receiveTransfer(bytes32 transferId, address hederaToken, uint256 amount, address recipient, bytes[] calldata signatures)`
- `validateValidator(address validator, bytes calldata signature)`
- `emergencyPause()`
- `emergencyUnpause()`

#### Storage Variables:
```solidity
struct HederaAdapterStorage {
    mapping(bytes32 => bool) processedTransfers;    // Prevent replay attacks
    mapping(address => bool) validators;            // Approved validators
    address[] validatorList;                        // List of validators
    uint256 validatorThreshold;                     // Min validators for approval
    mapping(address => address) tokenMappings;      // Ethereum to Hedera token mappings
    bool isPaused;                                  // Emergency pause switch
}
```

### 3. ThresholdSignature Module

A module for implementing threshold signatures for secure cross-chain validation.

#### Key Functions:
- `generatePartialSignature(bytes32 message, uint256 privateKeyShare)`
- `aggregateSignatures(bytes[] calldata partialSignatures, address[] calldata validators)`
- `validateThresholdSignature(bytes32 message, bytes calldata signature, address[] calldata validators)`

## Integration Points

### Treasury Contract Integration

```solidity
function receiveBridgeFee(address token, uint256 amount) external {
    TreasuryStorage storage s = diamondStorage();
    
    // Verify caller is the bridge
    require(msg.sender == s.bridge, "Only bridge can call");
    
    // Update bridge fee balance
    s.bridgeFeeBalance[token] += amount;
    
    // Emit event
    emit BridgeFeeReceived(token, amount);
}
```

### FeeCalculator Integration

```solidity
function calculateBridgeFee(uint256 amount) external view returns (uint256) {
    FeeCalculatorStorage storage s = diamondStorage();
    return (amount * s.bridgeFeeBps) / 10000;
}
```

## Implementation Steps

### Week 7: HederaBridge Contract

#### Day 1-2: Design & Documentation
- Define bridge architecture and token locking mechanism
- Document validator system and threshold signatures
- Design security features (timelocks, limits)

#### Day 3-5: Implementation
1. Create HederaBridge contract
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   import "./DiamondStorage.sol";
   import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
   import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
   
   contract HederaBridge is ReentrancyGuard {
       bytes32 constant STORAGE_POSITION = keccak256("dloop.hedera.bridge.storage");
       
       event TransferInitiated(
           bytes32 indexed transferId,
           address indexed token,
           uint256 amount,
           address indexed sender,
           string hederaRecipient,
           uint256 fee
       );
       event TransferValidated(bytes32 indexed transferId, address indexed validator);
       event TransferCompleted(bytes32 indexed transferId);
       event ValidatorRegistered(address indexed validator);
       event ValidatorRemoved(address indexed validator);
       event TokenSupported(address indexed token, bool isSupported);
       event BridgeParametersUpdated(
           uint256 validatorThreshold,
           uint256 timelockThreshold,
           uint256 dailyLimit,
           uint256 bridgeFeeBps
       );
       
       struct HederaBridgeStorage {
           mapping(bytes32 => Transfer) transfers;
           mapping(address => bool) validators;
           address[] validatorList;
           mapping(address => bool) supportedTokens;
           uint256 validatorThreshold;
           uint256 timelockThreshold;
           uint256 dailyLimit;
           uint256 bridgeFeeBps;
           mapping(address => uint256) dailyTransferred;
           mapping(address => uint256) lastResetTime;
           address treasury;
           address feeCalculator;
       }
       
       struct Transfer {
           address token;
           uint256 amount;
           address sender;
           string hederaRecipient;
           uint256 timestamp;
           bool isCompleted;
           uint256 validations;
           mapping(address => bool) hasValidated;
       }
       
       function diamondStorage() internal pure returns (HederaBridgeStorage storage ds) {
           bytes32 position = STORAGE_POSITION;
           assembly {
               ds.slot := position
           }
       }
       
       function initialize(
           address[] calldata _validators,
           address _treasury,
           address _feeCalculator
       ) external {
           HederaBridgeStorage storage s = diamondStorage();
           require(s.validatorList.length == 0, "Already initialized");
           
           for (uint256 i = 0; i < _validators.length; i++) {
               s.validators[_validators[i]] = true;
               s.validatorList.push(_validators[i]);
           }
           
           s.treasury = _treasury;
           s.feeCalculator = _feeCalculator;
           s.validatorThreshold = (_validators.length * 2) / 3 + 1; // 2/3 + 1
           s.timelockThreshold = 100000 * 10**18; // $100,000 equivalent
           s.dailyLimit = 250000 * 10**18; // $250,000 equivalent
           s.bridgeFeeBps = 10; // 0.1%
       }
       
       function bridgeTokens(
           address token,
           uint256 amount,
           string calldata hederaRecipient
       ) external nonReentrant returns (bytes32) {
           HederaBridgeStorage storage s = diamondStorage();
           
           require(s.supportedTokens[token], "Token not supported");
           require(amount > 0, "Amount must be positive");
           
           // Check and update daily limit
           _updateDailyLimit(token, amount);
           
           // Calculate and deduct fee
           uint256 fee = _calculateBridgeFee(amount);
           uint256 netAmount = amount - fee;
           
           // Generate transfer ID
           bytes32 transferId = keccak256(
               abi.encodePacked(
                   token,
                   amount,
                   msg.sender,
                   hederaRecipient,
                   block.timestamp
               )
           );
           
           // Create transfer record
           Transfer storage transfer = s.transfers[transferId];
           transfer.token = token;
           transfer.amount = netAmount;
           transfer.sender = msg.sender;
           transfer.hederaRecipient = hederaRecipient;
           transfer.timestamp = block.timestamp;
           
           // Transfer tokens to the bridge
           IERC20(token).transferFrom(msg.sender, address(this), amount);
           
           // Send fee to treasury
           if (fee > 0) {
               IERC20(token).transfer(s.treasury, fee);
           }
           
           // Check if timelock is needed
           if (amount >= s.timelockThreshold) {
               // Transfer will require timelock
               // In a full implementation, this would emit an additional event
           }
           
           emit TransferInitiated(
               transferId,
               token,
               netAmount,
               msg.sender,
               hederaRecipient,
               fee
           );
           
           return transferId;
       }
       
       function validateTransfer(
           bytes32 transferId,
           bytes[] calldata signatures
       ) external {
           HederaBridgeStorage storage s = diamondStorage();
           Transfer storage transfer = s.transfers[transferId];
           
           require(transfer.timestamp > 0, "Transfer does not exist");
           require(!transfer.isCompleted, "Transfer already completed");
           
           // In a full implementation, this would validate threshold signatures
           // For demonstration, we're using a simplified validation
           
           require(s.validators[msg.sender], "Not a validator");
           require(!transfer.hasValidated[msg.sender], "Already validated");
           
           transfer.hasValidated[msg.sender] = true;
           transfer.validations++;
           
           emit TransferValidated(transferId, msg.sender);
           
           // Check if we've reached threshold
           if (transfer.validations >= s.validatorThreshold) {
               _completeTransfer(transferId);
           }
       }
       
       function unlockTokens(
           bytes32 transferId,
           address recipient,
           bytes[] calldata signatures
       ) external {
           HederaBridgeStorage storage s = diamondStorage();
           Transfer storage transfer = s.transfers[transferId];
           
           require(transfer.timestamp > 0, "Transfer does not exist");
           require(!transfer.isCompleted, "Transfer already completed");
           
           // This function would be used for emergency returns if the Hedera side fails
           // In a full implementation, this would validate threshold signatures from validators
           
           // Verify enough validators have signed
           require(signatures.length >= s.validatorThreshold, "Not enough signatures");
           
           // Verify signatures
           // This is a simplified version; actual implementation would use threshold signatures
           bool isValid = _validateUnlockSignatures(transferId, recipient, signatures);
           require(isValid, "Invalid signatures");
           
           // Return tokens to recipient
           IERC20(transfer.token).transfer(recipient, transfer.amount);
           
           // Mark as completed
           transfer.isCompleted = true;
           
           emit TransferCompleted(transferId);
       }
       
       function registerValidator(address validator) external {
           // Access control would be implemented here
           HederaBridgeStorage storage s = diamondStorage();
           require(!s.validators[validator], "Already a validator");
           
           s.validators[validator] = true;
           s.validatorList.push(validator);
           s.validatorThreshold = (s.validatorList.length * 2) / 3 + 1; // Recalculate threshold
           
           emit ValidatorRegistered(validator);
       }
       
       function removeValidator(address validator) external {
           // Access control would be implemented here
           HederaBridgeStorage storage s = diamondStorage();
           require(s.validators[validator], "Not a validator");
           
           s.validators[validator] = false;
           
           // Remove from list
           for (uint256 i = 0; i < s.validatorList.length; i++) {
               if (s.validatorList[i] == validator) {
                   s.validatorList[i] = s.validatorList[s.validatorList.length - 1];
                   s.validatorList.pop();
                   break;
               }
           }
           
           s.validatorThreshold = (s.validatorList.length * 2) / 3 + 1; // Recalculate threshold
           
           emit ValidatorRemoved(validator);
       }
       
       function setSupportedToken(address token, bool isSupported) external {
           // Access control would be implemented here
           diamondStorage().supportedTokens[token] = isSupported;
           emit TokenSupported(token, isSupported);
       }
       
       function updateBridgeParameters(
           uint256 validatorThreshold,
           uint256 timelockThreshold,
           uint256 dailyLimit,
           uint256 bridgeFeeBps
       ) external {
           // Access control would be implemented here
           HederaBridgeStorage storage s = diamondStorage();
           
           // Parameter validation would be more extensive in practice
           require(bridgeFeeBps <= 100, "Fee too high"); // Max 1%
           
           s.validatorThreshold = validatorThreshold;
           s.timelockThreshold = timelockThreshold;
           s.dailyLimit = dailyLimit;
           s.bridgeFeeBps = bridgeFeeBps;
           
           emit BridgeParametersUpdated(
               validatorThreshold,
               timelockThreshold,
               dailyLimit,
               bridgeFeeBps
           );
       }
       
       function isValidator(address account) external view returns (bool) {
           return diamondStorage().validators[account];
       }
       
       function getValidatorCount() external view returns (uint256) {
           return diamondStorage().validatorList.length;
       }
       
       function getTransferDetails(bytes32 transferId) external view returns (
           address token,
           uint256 amount,
           address sender,
           string memory hederaRecipient,
           uint256 timestamp,
           bool isCompleted,
           uint256 validations
       ) {
           HederaBridgeStorage storage s = diamondStorage();
           Transfer storage transfer = s.transfers[transferId];
           
           return (
               transfer.token,
               transfer.amount,
               transfer.sender,
               transfer.hederaRecipient,
               transfer.timestamp,
               transfer.isCompleted,
               transfer.validations
           );
       }
       
       function _completeTransfer(bytes32 transferId) internal {
           Transfer storage transfer = diamondStorage().transfers[transferId];
           transfer.isCompleted = true;
           
           emit TransferCompleted(transferId);
       }
       
       function _calculateBridgeFee(uint256 amount) internal view returns (uint256) {
           HederaBridgeStorage storage s = diamondStorage();
           
           if (s.feeCalculator != address(0)) {
               // Use external fee calculator if available
               (bool success, bytes memory result) = s.feeCalculator.staticcall(
                   abi.encodeWithSignature("calculateBridgeFee(uint256)", amount)
               );
               
               if (success && result.length >= 32) {
                   return abi.decode(result, (uint256));
               }
           }
           
           // Fallback to internal calculation
           return (amount * s.bridgeFeeBps) / 10000;
       }
       
       function _updateDailyLimit(address token, uint256 amount) internal {
           HederaBridgeStorage storage s = diamondStorage();
           
           // Reset daily limit if more than a day has passed
           if (block.timestamp >= s.lastResetTime[token] + 1 days) {
               s.dailyTransferred[token] = 0;
               s.lastResetTime[token] = block.timestamp;
           }
           
           // Update and check limit
           s.dailyTransferred[token] += amount;
           require(s.dailyTransferred[token] <= s.dailyLimit, "Daily limit exceeded");
       }
       
       function _validateUnlockSignatures(
           bytes32 transferId,
           address recipient,
           bytes[] calldata signatures
       ) internal view returns (bool) {
           // This is a simplified validation
           // In practice, this would use threshold signatures
           
           HederaBridgeStorage storage s = diamondStorage();
           uint256 validSignatures = 0;
           
           for (uint256 i = 0; i < signatures.length; i++) {
               address signer = _recoverSigner(transferId, recipient, signatures[i]);
               if (s.validators[signer]) {
                   validSignatures++;
               }
           }
           
           return validSignatures >= s.validatorThreshold;
       }
       
       function _recoverSigner(
           bytes32 transferId,
           address recipient,
           bytes calldata signature
       ) internal pure returns (address) {
           // This is a placeholder for signature recovery
           // In practice, this would use ecrecover or similar
           
           bytes32 messageHash = keccak256(abi.encodePacked(transferId, recipient));
           bytes32 ethSignedMessageHash = keccak256(
               abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
           );
           
           // Simplified signature recovery for demo
           return address(0); // Placeholder
       }
   }
   ```

2. Develop validator approval system
3. Create unit tests for bridge operations

#### Day 6-7: Fee Integration and Security
1. Connect bridge to fee system
2. Implement security features and circuit breakers
3. Test token locking and transfer creation

### Week 8: Hedera Adapter and Validator System

#### Day 1-3: Design & Documentation
- Define Hedera-side adapter interface
- Document cross-chain message format
- Design validator incentive system

#### Day 4-6: Implementation
1. Design HederaAdapter contract (conceptual)
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.20;
   
   contract HederaAdapter {
       // Storage layout
       mapping(bytes32 => bool) public processedTransfers;
       mapping(address => bool) public validators;
       address[] public validatorList;
       uint256 public validatorThreshold;
       mapping(address => address) public tokenMappings;
       bool public isPaused;
       
       // Events
       event TransferReceived(
           bytes32 indexed transferId,
           address indexed token,
           uint256 amount,
           address indexed recipient
       );
       event ValidatorUpdated(address indexed validator, bool isValid);
       event TokenMappingUpdated(address indexed ethereumToken, address indexed hederaToken);
       event EmergencyPause(bool isPaused);
       
       constructor(address[] memory _validators) {
           for (uint256 i = 0; i < _validators.length; i++) {
               validators[_validators[i]] = true;
               validatorList.push(_validators[i]);
           }
           validatorThreshold = (_validators.length * 2) / 3 + 1;
       }
       
       function receiveTransfer(
           bytes32 transferId,
           address ethereumToken,
           uint256 amount,
           address recipient,
           bytes[] calldata signatures
       ) external {
           require(!isPaused, "Bridge is paused");
           require(!processedTransfers[transferId], "Already processed");
           
           // Verify signatures
           require(
               validateSignatures(transferId, ethereumToken, amount, recipient, signatures),
               "Invalid signatures"
           );
           
           // Mark as processed to prevent replay
           processedTransfers[transferId] = true;
           
           // Get corresponding Hedera token
           address hederaToken = tokenMappings[ethereumToken];
           require(hederaToken != address(0), "Token not mapped");
           
           // The actual token minting/transfer would happen here
           // As we can't directly deploy to Hedera in this example, this is conceptual
           
           emit TransferReceived(transferId, hederaToken, amount, recipient);
       }
       
       function validateSignatures(
           bytes32 transferId,
           address token,
           uint256 amount,
           address recipient,
           bytes[] calldata signatures
       ) public view returns (bool) {
           // Verify we have enough valid signatures
           require(signatures.length >= validatorThreshold, "Not enough signatures");
           
           bytes32 messageHash = keccak256(
               abi.encodePacked(transferId, token, amount, recipient)
           );
           
           uint256 validCount = 0;
           address[] memory usedSigners = new address[](signatures.length);
           
           for (uint256 i = 0; i < signatures.length; i++) {
               address signer = recoverSigner(messageHash, signatures[i]);
               
               // Check if valid validator
               if (validators[signer]) {
                   // Check for duplicate signers
                   bool duplicate = false;
                   for (uint256 j = 0; j < validCount; j++) {
                       if (usedSigners[j] == signer) {
                           duplicate = true;
                           break;
                       }
                   }
                   
                   if (!duplicate) {
                       usedSigners[validCount] = signer;
                       validCount++;
                   }
               }
           }
           
           return validCount >= validatorThreshold;
       }
       
       function recoverSigner(
           bytes32 messageHash,
           bytes memory signature
       ) public pure returns (address) {
           // This is a placeholder for signature recovery
           // In practice, this would use ecrecover or similar
           
           bytes32 ethSignedMessageHash = keccak256(
               abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
           );
           
           // Simplified signature recovery for demo
           return address(0); // Placeholder
       }
       
       function updateValidator(address validator, bool isValid) public {
           // Access control would be implemented here
           
           if (validators[validator] != isValid) {
               validators[validator] = isValid;
               
               if (isValid) {
                   validatorList.push(validator);
               } else {
                   for (uint256 i = 0; i < validatorList.length; i++) {
                       if (validatorList[i] == validator) {
                           validatorList[i] = validatorList[validatorList.length - 1];
                           validatorList.pop();
                           break;
                       }
                   }
               }
               
               // Update threshold
               validatorThreshold = (validatorList.length * 2) / 3 + 1;
               
               emit ValidatorUpdated(validator, isValid);
           }
       }
       
       function updateTokenMapping(address ethereumToken, address hederaToken) public {
           // Access control would be implemented here
           tokenMappings[ethereumToken] = hederaToken;
           emit TokenMappingUpdated(ethereumToken, hederaToken);
       }
       
       function emergencyPause() public {
           // Access control would be implemented here
           isPaused = true;
           emit EmergencyPause(true);
       }
       
       function emergencyUnpause() public {
           // Access control would be implemented here
           isPaused = false;
           emit EmergencyPause(false);
       }
   }
   ```

2. Implement validator reward distribution
3. Create tests for cross-chain message verification

#### Day 7: Final Integration
1. Connect all components for end-to-end testing
2. Verify security properties
3. Prepare deployment documentation

## Testing Strategy

### Unit Testing
1. **HederaBridge Tests**
   - Token locking and transfer initiation
   - Validator management and threshold calculations
   - Fee calculation and collection
   - Security features (timelock, daily limits)

2. **Signature Verification Tests**
   - Individual signature validation
   - Threshold signature aggregation
   - Replay attack prevention

3. **Adapter Integration Tests**
   - Cross-chain message format
   - Token mapping validation
   - Error handling and recovery

### Property-Based Testing
1. **Invariants**
   - Total supply of tokens across chains remains constant
   - Valid transfers can always be completed
   - Fees are correctly calculated and distributed

2. **Security Properties**
   - Only valid threshold signatures can release tokens
   - Timelock cannot be bypassed for large transfers
   - Daily limits cannot be exceeded

## Deployment Plan

### 1. Testnet Deployment
- Deploy HederaBridge to Ethereum testnet (Sepolia)
- Set up validator infrastructure
- Create test token mappings
- Conduct cross-chain transfer testing

### 2. Mainnet Deployment
- Deploy with limited token support
- Start with conservative limits and thresholds
- Gradually expand supported tokens and increase limits

## Governance Controls

1. **Validator Management**
   - Validator addition and removal through governance
   - Threshold adjustment through governance
   - Incentive parameter adjustment through governance

2. **Bridge Parameters**
   - Fee rates adjustable by governance
   - Daily limits adjustable by governance
   - Timelock thresholds adjustable by governance

3. **Circuit Breakers**
   - Emergency pause capability with multi-sig
   - Token support management through governance

## Validator System

### Validator Requirements
- Must run secure, always-on infrastructure
- Must maintain private key security
- Must participate in threshold signature generation
- Must monitor bridge activity and report issues

### Validator Selection
- Initial validators selected from trusted ecosystem partners
- Future validators added through governance votes
- Performance metrics tracked for validator evaluation

### Validator Incentives
- 20% of bridge fees distributed to validators
- Rewards proportional to signature participation
- Slashing for malicious behavior or downtime

## Conclusion

This implementation plan provides a secure and flexible approach to implementing cross-chain bridging between Ethereum and Hedera for the DLOOP protocol. The architecture prioritizes security through threshold signatures, validator consensus, and circuit breakers, while providing flexibility through governance controls and upgradeable contracts. The phased deployment approach ensures careful testing and risk management throughout the implementation process.