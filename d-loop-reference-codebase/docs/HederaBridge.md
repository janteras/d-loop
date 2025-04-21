# Hedera Bridge Documentation

## Overview

The Hedera Bridge is a secure cross-chain bridge that enables token transfers and message passing between Ethereum and Hedera networks. It provides a critical infrastructure component for the DLOOP Protocol, allowing for expanded functionality across multiple blockchains while maintaining security and transparency.

## Architecture

The Hedera Bridge consists of five main components:

1. **Bridge Contracts** - Smart contracts on both Ethereum and Hedera networks
2. **Validator Network** - Set of trusted validators confirming cross-chain transactions
3. **BridgeOracle** - Oracle system validating cross-chain events
4. **Security Module** - Protection against attacks and vulnerabilities
5. **Bridge Governance** - Controls for parameter updates and validator management

### System Diagram

```
Ethereum Network                          Hedera Network
+--------------------+                    +--------------------+
|                    |                    |                    |
| ETH Bridge Contract|<------------------>| HTS Bridge Contract|
|                    |                    |                    |
+--------------------+                    +--------------------+
         ^                                          ^
         |                                          |
         v                                          v
+--------------------+                    +--------------------+
|                    |                    |                    |
| ETH  Token Adapters|                    | HTS Token Adapters |
|                    |                    |                    |
+--------------------+                    +--------------------+
         ^                                          ^
         |                                          |
         |                                          |
         |      +--------------------+              |
         |      |                    |              |
         +----->| Validator Network  |<-------------+
                |                    |
                +--------------------+
                         ^
                         |
                         v
                +--------------------+
                |                    |
                |   Bridge Oracle    |
                |                    |
                +--------------------+
```

## Implementation Details

### Bridge Contracts

The bridge contracts handle token locking, minting, burning, and releasing across chains.

**Key Features:**
- Support for multiple token types
- Configurable transfer limits
- Emergency pause functionality
- Upgradeable contract architecture
- Event emission for cross-chain tracking

**Ethereum Bridge Contract Example:**
```solidity
function lockAndMint(
    address token,
    uint256 amount,
    address recipient,
    uint256 targetChainId
) external nonReentrant whenNotPaused {
    require(isSupportedToken(token), "Token not supported");
    require(amount > 0, "Amount must be greater than zero");
    require(amount <= getMaxTransferAmount(token), "Exceeds transfer limit");
    
    // Calculate fee
    uint256 fee = calculateFee(token, amount, targetChainId);
    uint256 amountAfterFee = amount.sub(fee);
    
    // Collect fee
    if (fee > 0) {
        IERC20(token).safeTransferFrom(msg.sender, feeCollector, fee);
    }
    
    // Lock tokens in bridge
    IERC20(token).safeTransferFrom(msg.sender, address(this), amountAfterFee);
    
    // Generate unique transfer ID
    bytes32 transferId = keccak256(abi.encodePacked(
        block.timestamp,
        msg.sender,
        token,
        amount,
        recipient,
        targetChainId,
        transferNonce
    ));
    transferNonce++;
    
    // Store transfer details
    transfers[transferId] = Transfer({
        sender: msg.sender,
        token: token,
        amount: amountAfterFee,
        recipient: recipient,
        sourceChainId: getChainId(),
        targetChainId: targetChainId,
        status: TransferStatus.Pending,
        timestamp: block.timestamp
    });
    
    // Notify validators
    emit TokensLocked(
        transferId,
        msg.sender,
        token,
        amount,
        amountAfterFee,
        fee,
        recipient,
        targetChainId
    );
}
```

**Hedera Bridge Contract Example:**
```solidity
function mintWrappedToken(
    bytes32 transferId,
    address originalToken,
    uint256 amount,
    address recipient,
    uint256 sourceChainId
) external onlyValidator whenNotPaused {
    require(!processedTransfers[transferId], "Transfer already processed");
    require(validatorConsensusReached(transferId), "Validator consensus not reached");
    
    // Get wrapped token address
    address wrappedToken = tokenMappings[sourceChainId][originalToken];
    require(wrappedToken != address(0), "No wrapped token mapping");
    
    // Mint wrapped tokens to recipient
    IWrappedToken(wrappedToken).mint(recipient, amount);
    
    // Mark transfer as processed
    processedTransfers[transferId] = true;
    
    emit WrappedTokenMinted(
        transferId,
        originalToken,
        wrappedToken,
        amount,
        recipient,
        sourceChainId
    );
}

function burnAndRelease(
    address wrappedToken,
    uint256 amount,
    address recipient,
    uint256 targetChainId
) external nonReentrant whenNotPaused {
    require(isWrappedToken(wrappedToken), "Not a wrapped token");
    require(amount > 0, "Amount must be greater than zero");
    require(amount <= getMaxTransferAmount(wrappedToken), "Exceeds transfer limit");
    
    // Calculate fee
    uint256 fee = calculateFee(wrappedToken, amount, targetChainId);
    uint256 amountAfterFee = amount.sub(fee);
    
    // Get original token information
    (address originalToken, uint256 sourceChainId) = getOriginalTokenInfo(wrappedToken);
    
    // Burn wrapped tokens
    IWrappedToken(wrappedToken).burnFrom(msg.sender, amount);
    
    // Collect fee if applicable
    if (fee > 0) {
        IWrappedToken(wrappedToken).mint(feeCollector, fee);
        IWrappedToken(wrappedToken).burn(fee);
    }
    
    // Generate unique transfer ID
    bytes32 transferId = keccak256(abi.encodePacked(
        block.timestamp,
        msg.sender,
        wrappedToken,
        amount,
        recipient,
        targetChainId,
        transferNonce
    ));
    transferNonce++;
    
    // Store transfer details
    transfers[transferId] = Transfer({
        sender: msg.sender,
        token: wrappedToken,
        amount: amountAfterFee,
        recipient: recipient,
        sourceChainId: getChainId(),
        targetChainId: targetChainId,
        status: TransferStatus.Pending,
        timestamp: block.timestamp
    });
    
    // Notify validators
    emit TokensBurned(
        transferId,
        msg.sender,
        wrappedToken,
        originalToken,
        amount,
        amountAfterFee,
        fee,
        recipient,
        targetChainId
    );
}
```

### Validator Network

The validator network verifies cross-chain transactions and provides consensus for bridge operations.

**Key Features:**
- Multi-signature threshold for transfer approval
- Slashing conditions for malicious validators
- Staking requirements for validators
- Performance monitoring and reporting
- Rotation mechanism for validator set updates

**Validator Contract Example:**
```solidity
function validateTransfer(
    bytes32 transferId,
    bool approval,
    bytes memory signature
) external onlyRegisteredValidator {
    require(!hasValidated[transferId][msg.sender], "Already validated");
    
    // Verify validator signature
    bytes32 messageHash = keccak256(abi.encodePacked(
        transferId,
        approval
    ));
    require(
        verifySignature(msg.sender, messageHash, signature),
        "Invalid signature"
    );
    
    // Record validation
    validations[transferId][msg.sender] = approval;
    hasValidated[transferId][msg.sender] = true;
    validationCounts[transferId]++;
    
    if (approval) {
        approvalCounts[transferId]++;
    }
    
    emit TransferValidated(transferId, msg.sender, approval);
    
    // Check if we have enough validations for consensus
    if (validationCounts[transferId] >= requiredValidations) {
        finalizeValidation(transferId);
    }
}

function finalizeValidation(bytes32 transferId) internal {
    Transfer storage transfer = transfers[transferId];
    require(transfer.status == TransferStatus.Pending, "Not pending");
    
    // Check approval threshold
    bool approved = approvalCounts[transferId] >= requiredApprovals;
    
    // Update transfer status
    transfer.status = approved ? 
        TransferStatus.Approved : 
        TransferStatus.Rejected;
    
    // Execute transfer if approved
    if (approved) {
        if (transfer.targetChainId == getChainId()) {
            // Handle incoming transfer
            executeIncomingTransfer(transferId);
        } else {
            // Notify target chain
            emitOutgoingTransfer(transferId);
        }
    }
    
    emit TransferFinalized(transferId, approved, approvalCounts[transferId]);
}
```

### BridgeOracle Integration

The BridgeOracle component monitors events on both chains and facilitates cross-chain communication.

**Key Features:**
- Event monitoring on both chains
- Transaction proof verification
- Replay attack prevention
- Data validity checks
- Bridge status reporting

**Bridge Oracle Example:**
```solidity
function submitProof(
    bytes32 transferId,
    bytes memory proof,
    uint256 sourceChainId
) external onlyValidator {
    require(!processedProofs[transferId], "Proof already processed");
    
    // Verify proof validity
    require(
        verifyTransactionProof(transferId, proof, sourceChainId),
        "Invalid proof"
    );
    
    // Record proof submission
    proofSubmissions[transferId][msg.sender] = true;
    proofSubmissionCounts[transferId]++;
    
    emit ProofSubmitted(transferId, msg.sender, sourceChainId);
    
    // Check if we have enough proof submissions
    if (proofSubmissionCounts[transferId] >= requiredProofs) {
        bridgeContract.processVerifiedTransfer(transferId, sourceChainId);
        processedProofs[transferId] = true;
    }
}

function verifyTransactionProof(
    bytes32 transferId,
    bytes memory proof,
    uint256 sourceChainId
) internal returns (bool) {
    // Chain-specific verification
    if (sourceChainId == ETHEREUM_CHAIN_ID) {
        return verifyEthereumProof(transferId, proof);
    } else if (sourceChainId == HEDERA_CHAIN_ID) {
        return verifyHederaProof(transferId, proof);
    }
    
    return false;
}
```

### Security Module

The Security Module protects the bridge against various attack vectors.

**Key Features:**
- Transaction rate limiting
- Value transfer caps
- Anomaly detection
- Fraud prevention mechanisms
- Automatic circuit breakers

**Security Module Example:**
```solidity
function checkTransferSecurity(
    address token,
    uint256 amount,
    address recipient,
    uint256 targetChainId
) external returns (bool) {
    // Check for transfer limits
    if (amount > getMaxTransferAmount(token)) {
        return false;
    }
    
    // Check for rate limiting
    uint256 recentTransfers = getRecentTransferCount(token);
    if (recentTransfers >= maxTransfersPerPeriod) {
        return false;
    }
    
    // Check for suspicious activity patterns
    if (isSuspiciousRecipient(recipient) || 
        isSuspiciousPattern(msg.sender, recipient, amount)) {
        flagForReview(token, amount, msg.sender, recipient);
        return false;
    }
    
    // Check for bridge liquidity
    if (targetChainId == HEDERA_CHAIN_ID) {
        if (!hasEfficientLiquidity(token, amount, HEDERA_CHAIN_ID)) {
            return false;
        }
    }
    
    // Record this transfer attempt
    recordTransferAttempt(token, amount, msg.sender, recipient);
    return true;
}

function checkBridgeHealth() internal view returns (bool) {
    // Check validator set health
    if (activeValidatorCount() < minimumValidatorThreshold) {
        return false;
    }
    
    // Check oracle health
    if (!oracleSystem.isHealthy()) {
        return false;
    }
    
    // Check for recent security incidents
    if (getIncidentCount(block.timestamp - 1 days) > 0) {
        return false;
    }
    
    return true;
}
```

## Token Adapter System

The bridge includes a token adapter system for handling different token standards.

**Supported Token Types:**
1. **ERC-20** - Standard Ethereum fungible tokens
2. **ERC-721** - Ethereum NFTs
3. **ERC-1155** - Ethereum multi-tokens
4. **HTS** - Hedera Token Service tokens

**Adapter Contract Example:**
```solidity
function wrapToken(
    address originalToken,
    string memory name,
    string memory symbol,
    uint8 decimals,
    uint256 sourceChainId
) external onlyOwner {
    require(tokenMappings[sourceChainId][originalToken] == address(0), "Mapping exists");
    
    // Deploy new wrapped token
    address wrappedToken;
    
    if (isERC20(originalToken, sourceChainId)) {
        wrappedToken = deployWrappedERC20(name, symbol, decimals);
    } else if (isERC721(originalToken, sourceChainId)) {
        wrappedToken = deployWrappedERC721(name, symbol);
    } else if (isERC1155(originalToken, sourceChainId)) {
        wrappedToken = deployWrappedERC1155();
    } else if (isHTS(originalToken, sourceChainId)) {
        wrappedToken = deployWrappedHTS(name, symbol, decimals);
    } else {
        revert("Unsupported token type");
    }
    
    // Store mapping
    tokenMappings[sourceChainId][originalToken] = wrappedToken;
    originalTokens[wrappedToken] = OriginalToken({
        tokenAddress: originalToken,
        chainId: sourceChainId
    });
    
    emit TokenMappingCreated(originalToken, wrappedToken, sourceChainId);
}
```

## Fee Structure

The bridge implements a transparent fee structure for cross-chain operations.

**Fee Components:**
1. **Base Fee** - Fixed fee per transaction
2. **Gas Fee** - Variable fee based on gas costs on target chain
3. **Value Fee** - Percentage-based fee for higher value transfers
4. **Express Fee** - Optional fee for faster processing

**Fee Calculation Example:**
```solidity
function calculateFee(
    address token,
    uint256 amount,
    uint256 targetChainId
) public view returns (uint256) {
    // Get base fee for this token
    uint256 baseFee = getBaseFee(token, targetChainId);
    
    // Calculate value-based fee
    uint256 valuePercentage = getValueFeePercentage(token, amount);
    uint256 valueFee = amount.mul(valuePercentage).div(10000);
    
    // Get current gas cost estimate for target chain
    uint256 gasFee = getEstimatedGasFee(targetChainId);
    
    // Sum all fee components
    uint256 totalFee = baseFee.add(valueFee).add(gasFee);
    
    // Cap fee at maximum percentage
    uint256 maxFee = amount.mul(maxFeePercentage).div(10000);
    if (totalFee > maxFee) {
        totalFee = maxFee;
    }
    
    return totalFee;
}
```

## Governance Integration

The bridge is governed through the ProtocolDAO governance system.

**Governable Parameters:**
1. **Validator Set** - Adding/removing validators
2. **Fee Structure** - Adjusting fee components
3. **Transfer Limits** - Setting maximum transfer amounts
4. **Security Parameters** - Updating security thresholds
5. **Token Support** - Adding/removing supported tokens

**Governance Example:**
```solidity
function proposeValidatorAddition(address newValidator)
    external onlyGovernance {
    require(!isValidator[newValidator], "Already a validator");
    
    // Create proposal in governance contract
    bytes memory callData = abi.encodeWithSelector(
        this.addValidator.selector,
        newValidator
    );
    
    uint256 proposalId = governance.propose(
        address(this),
        0,
        callData,
        "Add new bridge validator"
    );
    
    emit ValidatorAdditionProposed(proposalId, newValidator);
}

function addValidator(address newValidator) 
    external onlyGovernance {
    require(!isValidator[newValidator], "Already a validator");
    
    // Add to validator set
    validators.push(newValidator);
    isValidator[newValidator] = true;
    validatorCount++;
    
    emit ValidatorAdded(newValidator);
}
```

## Security Considerations

The bridge includes several security measures:

1. **Multi-signature Validation** - Requiring multiple validators for approvals
2. **Time Locks** - Delays for large transfers to allow emergency intervention
3. **Value Limits** - Maximum transfer amounts to limit potential losses
4. **Pause Mechanism** - Emergency pause for suspicious activity
5. **Fraud Detection** - Monitoring for unusual transaction patterns

## Hedera-specific Features

The bridge includes special features for Hedera integration:

1. **HTS Compatibility** - Full support for Hedera Token Service
2. **Consensus Service Integration** - Using HCS for cross-chain messaging
3. **Smart Contract Service** - Leveraging Hedera's smart contract capabilities
4. **Key Management** - Specialized key management for Hedera security
5. **Fee Optimization** - Minimizing Hedera network fees

## Testing Framework

The bridge includes comprehensive testing:

1. **Unit Tests** - Individual component validation
2. **Integration Tests** - Cross-component functionality
3. **Security Tests** - Vulnerability and attack vector testing
4. **Cross-chain Tests** - End-to-end transfer validation
5. **Performance Tests** - Load testing and optimization

## Future Enhancements

Planned improvements to the bridge include:

1. **Additional Chain Support** - Expanding to more blockchains
2. **Layer 2 Integration** - Supporting Ethereum L2 solutions
3. **Advanced Security Features** - Implementing additional protections
4. **Liquidity Optimization** - Improving capital efficiency
5. **User Experience Improvements** - Simplifying the bridging process