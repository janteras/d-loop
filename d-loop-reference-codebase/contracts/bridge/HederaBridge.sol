// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IBridge.sol";
import "./IMessageVerifier.sol";
import "./HederaTokenManager.sol";
import "./IBridgedToken.sol";
import "../libraries/Errors.sol";

/**
 * @title HederaBridge
 * @dev Bridge implementation for Hedera network with enhanced security features
 */
contract HederaBridge is IBridge, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Token manager
    HederaTokenManager public tokenManager;
    
    // Message verifier
    IMessageVerifier public messageVerifier;
    
    // Current chain ID
    uint256 public immutable chainId;
    
    // Transfer status
    enum TransferStatus { None, Pending, Completed, Failed }
    
    // Message status
    enum MessageStatus { None, Pending, Delivered, Failed }
    
    // Transfer details
    struct Transfer {
        address sender;
        address recipient;
        address asset;
        uint256 amount;
        uint256 sourceChainId;
        uint256 targetChainId;
        TransferStatus status;
    }
    
    // Message details
    struct Message {
        address sender;
        address recipient;
        bytes data;
        uint256 sourceChainId;
        uint256 targetChainId;
        MessageStatus status;
    }
    
    // Rate limiting
    struct TransferLimit {
        uint256 maxAmount;         // Maximum amount per transfer
        uint256 dailyLimit;        // Daily transfer limit
        uint256 dailyUsed;         // Amount used in current period
        uint256 periodReset;       // When the current period resets
    }
    
    // Enhanced rate limiting for users
    struct UserTransferLimit {
        uint256 maxPerTransfer;    // Maximum amount per transfer for this user
        uint256 dailyLimit;        // Daily transfer limit for this user
        uint256 weeklyLimit;       // Weekly transfer limit for this user
        uint256 dailyUsed;         // Amount used today by this user
        uint256 weeklyUsed;        // Amount used this week by this user
        uint256 dailyReset;        // When the daily counter resets
        uint256 weeklyReset;       // When the weekly counter resets
        uint256 cooldownPeriod;    // Time between large transfers (seconds)
        uint256 lastLargeTransfer; // Timestamp of last large transfer
        bool isLimited;            // Whether this user has custom limits
    }
    
    // Mappings
    mapping(bytes32 => Transfer) public transfers;
    mapping(bytes32 => Message) public messages;
    mapping(uint256 => bool) public supportedChains;
    mapping(address => TransferLimit) public transferLimits;
    mapping(address => mapping(uint256 => uint256)) public userDailyTransfers; // user => day => amount
    mapping(address => UserTransferLimit) public userLimits; // Enhanced user limits
    
    // Security settings
    uint256 public maxTransferAmount;      // Maximum amount per transfer
    uint256 public dailyTransferLimit;     // Maximum total transfers per day
    uint256 public dailyTransferUsed;      // Amount used today
    uint256 public dailyTransferReset;     // When the daily transfer counter resets
    uint256 public largeTransferThreshold; // Threshold for what's considered a large transfer
    uint256 public defaultCooldownPeriod;  // Default cooldown between large transfers
    
    // Fee configuration
    uint256 public bridgeFeePercent = 0;   // Default 0%
    address public feeCollector;
    
    // Events
    event TransferInitiated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId
    );
    
    event TransferCompleted(
        bytes32 indexed transferId,
        address indexed recipient,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId
    );
    
    event TransferFailed(
        bytes32 indexed transferId,
        string reason
    );
    
    event MessageSent(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint256 sourceChainId,
        uint256 targetChainId
    );
    
    event MessageReceived(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint256 sourceChainId,
        uint256 targetChainId
    );
    
    event MessageFailed(
        bytes32 indexed messageId,
        string reason
    );
    
    event ChainSupported(uint256 indexed chainId);
    event ChainRemoved(uint256 indexed chainId);
    event FeeUpdated(uint256 newFeePercent);
    event FeeCollectorUpdated(address indexed newFeeCollector);
    event MaxTransferAmountUpdated(uint256 newMaxAmount);
    event DailyTransferLimitUpdated(uint256 newDailyLimit);
    event AssetLimitUpdated(address indexed asset, uint256 maxAmount, uint256 dailyLimit);
    event UserLimitConfigured(address indexed user, uint256 maxPerTransfer, uint256 dailyLimit, uint256 weeklyLimit);
    event LargeTransferThresholdUpdated(uint256 newThreshold);
    event CooldownPeriodUpdated(uint256 newCooldownPeriod);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param _messageVerifier Message verifier address
     * @param _tokenManager Token manager address
     * @param _feeCollector Fee collector address
     * @param _chainId Current chain ID
     */
    constructor(
        address admin,
        address _messageVerifier,
        address _tokenManager,
        address _feeCollector,
        uint256 _chainId
    ) {
        if (admin == address(0)) revert Errors.ZeroAddress();
        if (_messageVerifier == address(0)) revert Errors.ZeroAddress();
        if (_tokenManager == address(0)) revert Errors.ZeroAddress();
        if (_feeCollector == address(0)) revert Errors.ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        
        messageVerifier = IMessageVerifier(_messageVerifier);
        tokenManager = HederaTokenManager(_tokenManager);
        feeCollector = _feeCollector;
        chainId = _chainId;
        
        // Set default limits
        maxTransferAmount = type(uint256).max;  // No limit by default
        dailyTransferLimit = type(uint256).max; // No limit by default
        dailyTransferReset = block.timestamp + 1 days;
        largeTransferThreshold = 1e23;          // 100,000 tokens (with 18 decimals)
        defaultCooldownPeriod = 1 hours;        // 1 hour cooldown for large transfers
    }
    
    /**
     * @dev Locks an asset on the source chain and initiates a transfer to the target chain
     * @param asset Asset address on the source chain
     * @param amount Amount to transfer
     * @param recipient Recipient address on the target chain
     * @param targetChainId ID of the target chain
     * @return transferId Unique ID for this transfer
     */
    function lockAndTransfer(
        address asset,
        uint256 amount,
        address recipient,
        uint256 targetChainId
    ) external override whenNotPaused nonReentrant returns (bytes32 transferId) {
        if (asset == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (recipient == address(0)) revert Errors.ZeroAddress();
        if (!supportedChains[targetChainId]) revert Errors.BridgeUnsupportedChain();
        
        // Check transfer limits
        if (amount > maxTransferAmount) revert Errors.BridgeExceedsMaxTransferAmount();
        
        // Check and update daily transfer limits
        _checkAndUpdateDailyLimit(amount);
        
        // Check asset-specific limits if configured
        _checkAssetLimits(asset, amount, msg.sender);
        
        // Calculate fees if applicable
        uint256 fee = 0;
        uint256 transferAmount = amount;
        
        if (bridgeFeePercent > 0) {
            fee = (amount * bridgeFeePercent) / 10000; // basis points
            transferAmount = amount - fee;
        }
        
        // Generate transfer ID
        transferId = keccak256(abi.encodePacked(
            asset,
            msg.sender,
            recipient,
            amount,
            chainId,
            targetChainId,
            block.timestamp,
            blockhash(block.number - 1)
        ));
        
        // Check if it's a wrapped token
        bool isWrapped = tokenManager.isWrappedToken(asset);
        
        if (isWrapped) {
            // Burn wrapped tokens
            tokenManager.burnWrappedToken(asset, msg.sender, transferAmount);
            
            // Take fee if applicable
            if (fee > 0) {
                IERC20(asset).safeTransferFrom(msg.sender, feeCollector, fee);
            }
        } else {
            // Lock tokens
            IERC20(asset).safeTransferFrom(msg.sender, address(this), transferAmount);
            
            // Take fee if applicable
            if (fee > 0) {
                IERC20(asset).safeTransferFrom(msg.sender, feeCollector, fee);
            }
        }
        
        // Store transfer details
        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            asset: asset,
            amount: transferAmount,
            sourceChainId: chainId,
            targetChainId: targetChainId,
            status: TransferStatus.Pending
        });
        
        emit TransferInitiated(
            transferId,
            msg.sender,
            recipient,
            asset,
            transferAmount,
            chainId,
            targetChainId
        );
        
        return transferId;
    }
    
    /**
     * @dev Releases an asset on the target chain to complete a transfer
     * @param transferId Transfer ID from the source chain
     * @param proof Proof data validating the transfer
     * @return success Whether the release succeeded
     */
    function releaseAsset(
        bytes32 transferId,
        bytes calldata proof
    ) external override whenNotPaused nonReentrant returns (bool success) {
        if (transfers[transferId].status != TransferStatus.None) revert Errors.BridgeMessageProcessed();
        
        // Extract transfer data from proof
        (
            address sender,
            address recipient,
            address asset,
            uint256 amount,
            uint256 sourceChainId,
            uint256 targetChainId,
            bytes memory signature
        ) = abi.decode(proof, (address, address, address, uint256, uint256, uint256, bytes));
        
        // Verify transfer is for this chain
        if (targetChainId != chainId) revert Errors.BridgeInvalidChainId();
        if (!supportedChains[sourceChainId]) revert Errors.BridgeUnsupportedChain();
        
        // Verify amount is within limits
        if (amount > maxTransferAmount) revert Errors.BridgeExceedsMaxTransferAmount();
        
        // Verify proof (signature)
        bool isValid = _verifyTransfer(
            transferId,
            sender,
            recipient,
            asset,
            amount,
            sourceChainId,
            targetChainId,
            signature
        );
        
        if (!isValid) revert Errors.BridgeInvalidProof();
        
        // Store transfer details
        transfers[transferId] = Transfer({
            sender: sender,
            recipient: recipient,
            asset: asset,
            amount: amount,
            sourceChainId: sourceChainId,
            targetChainId: chainId,
            status: TransferStatus.Completed
        });
        
        // Check if the original token exists on this chain
        address targetAsset = asset;
        
        if (!_assetExistsLocally(asset, sourceChainId)) {
            // Get or create wrapped token
            targetAsset = _getOrCreateWrappedToken(asset, sourceChainId);
            if (targetAsset == address(0)) revert Errors.TokenCreateFailed();
            
            // Mint wrapped tokens
            bool mintSuccess = tokenManager.mintWrappedToken(targetAsset, recipient, amount);
            if (!mintSuccess) revert Errors.TokenMintFailed();
        } else {
            // Transfer tokens
            IERC20(targetAsset).safeTransfer(recipient, amount);
        }
        
        emit TransferCompleted(
            transferId,
            recipient,
            targetAsset,
            amount,
            sourceChainId,
            chainId
        );
        
        return true;
    }
    
    /**
     * @dev Records a message sent to the target chain
     * @param targetChainId ID of the target chain
     * @param targetAddress Address on the target chain to receive the message
     * @param message Message data
     * @return messageId Unique ID for this message
     */
    function sendMessage(
        uint256 targetChainId,
        address targetAddress,
        bytes calldata message
    ) external override whenNotPaused returns (bytes32 messageId) {
        if (targetAddress == address(0)) revert Errors.ZeroAddress();
        if (message.length == 0) revert Errors.InvalidParameter();
        if (message.length > 8192) revert Errors.BridgeInvalidMessageSize();
        if (!supportedChains[targetChainId]) revert Errors.BridgeUnsupportedChain();
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            msg.sender,
            targetAddress,
            message,
            chainId,
            targetChainId,
            block.timestamp,
            blockhash(block.number - 1)
        ));
        
        // Store message details
        messages[messageId] = Message({
            sender: msg.sender,
            recipient: targetAddress,
            data: message,
            sourceChainId: chainId,
            targetChainId: targetChainId,
            status: MessageStatus.Pending
        });
        
        emit MessageSent(
            messageId,
            msg.sender,
            targetAddress,
            chainId,
            targetChainId
        );
        
        return messageId;
    }
    
    /**
     * @dev Processes a message received from the source chain
     * @param sourceChainId ID of the source chain
     * @param sourceAddress Address on the source chain that sent the message
     * @param message Message data
     * @param proof Proof data validating the message
     * @return success Whether the message was processed successfully
     */
    function receiveMessage(
        uint256 sourceChainId,
        address sourceAddress,
        bytes calldata message,
        bytes calldata proof
    ) external override whenNotPaused onlyRole(RELAYER_ROLE) returns (bool success) {
        if (sourceAddress == address(0)) revert Errors.ZeroAddress();
        if (message.length == 0) revert Errors.InvalidParameter();
        if (message.length > 8192) revert Errors.BridgeInvalidMessageSize();
        if (!supportedChains[sourceChainId]) revert Errors.BridgeUnsupportedChain();
        
        // Extract message ID and target address from proof
        (bytes32 messageId, address targetAddress, bytes memory signature) = 
            abi.decode(proof, (bytes32, address, bytes));
        
        // Prevent replay attacks
        if (messageVerifier.isMessageProcessed(messageId)) revert Errors.MessageAlreadyProcessed();
        
        // Verify message
        bool isValid = messageVerifier.verifyMessage(
            sourceChainId,
            sourceAddress,
            targetAddress,
            messageId,
            message,
            signature
        );
        
        if (!isValid) revert Errors.MessageInvalidProof();
        
        // Mark message as processed
        messageVerifier.markMessageProcessed(messageId);
        
        // Store message details
        messages[messageId] = Message({
            sender: sourceAddress,
            recipient: targetAddress,
            data: message,
            sourceChainId: sourceChainId,
            targetChainId: chainId,
            status: MessageStatus.Delivered
        });
        
        // Forward message to recipient (could be a contract)
        if (_isContract(targetAddress)) {
            try IMessageReceiver(targetAddress).onMessageReceived(
                sourceChainId, 
                sourceAddress, 
                message
            ) {
                // Success, do nothing
            } catch {
                // Failed to deliver, but we still mark it as processed
                messages[messageId].status = MessageStatus.Failed;
                emit MessageFailed(messageId, "Failed to deliver to contract");
                return false;
            }
        }
        
        emit MessageReceived(
            messageId,
            sourceAddress,
            targetAddress,
            sourceChainId,
            chainId
        );
        
        return true;
    }
    
    /**
     * @dev Gets the address of the wrapped version of an asset on this chain
     * @param nativeAsset Original asset address on its native chain
     * @param nativeChainId ID of the asset's native chain
     * @return wrappedAsset Address of the wrapped asset on this chain
     */
    function getWrappedAsset(
        address nativeAsset, 
        uint256 nativeChainId
    ) external view override returns (address wrappedAsset) {
        return tokenManager.getWrappedToken(nativeAsset, nativeChainId);
    }
    
    /**
     * @dev Gets the chain ID of the current chain
     * @return chainId The current chain ID
     */
    function getChainId() external view override returns (uint256) {
        return chainId;
    }
    
    /**
     * @dev Checks if a bridge exists to a target chain
     * @param targetChainId ID of the target chain
     * @return exists Whether a bridge exists
     */
    function bridgeExists(uint256 targetChainId) external view override returns (bool exists) {
        return supportedChains[targetChainId];
    }
    
    /**
     * @dev Gets the status of a transfer
     * @param transferId Transfer ID
     * @return status 0: Not found, 1: Pending, 2: Completed, 3: Failed
     */
    function getTransferStatus(bytes32 transferId) external view override returns (uint8 status) {
        return uint8(transfers[transferId].status);
    }
    
    /**
     * @dev Gets the status of a message
     * @param messageId Message ID
     * @return status 0: Not found, 1: Pending, 2: Delivered, 3: Failed
     */
    function getMessageStatus(bytes32 messageId) external view override returns (uint8 status) {
        return uint8(messages[messageId].status);
    }
    
    /**
     * @dev Gets a user's transfer limits and current usage
     * @param user User address
     * @return maxPerTransfer Maximum amount per transfer
     * @return dailyLimit Daily transfer limit
     * @return weeklyLimit Weekly transfer limit
     * @return dailyUsed Amount used today
     * @return weeklyUsed Amount used this week
     * @return isLimited Whether this user has custom limits
     */
    function getUserTransferLimits(address user) external view returns (
        uint256 maxPerTransfer,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 dailyUsed,
        uint256 weeklyUsed,
        bool isLimited
    ) {
        UserTransferLimit storage limit = userLimits[user];
        
        if (!limit.isLimited) {
            return (maxTransferAmount, dailyTransferLimit, type(uint256).max, 0, 0, false);
        }
        
        return (
            limit.maxPerTransfer,
            limit.dailyLimit,
            limit.weeklyLimit,
            limit.dailyUsed,
            limit.weeklyUsed,
            limit.isLimited
        );
    }
    
    /**
     * @dev Gets a user's daily transfer amount for a specific day
     * @param user User address
     * @param day Day (timestamp / 1 days)
     * @return amount Amount transferred on that day
     */
    function getUserDailyTransferAmount(address user, uint256 day) external view returns (uint256 amount) {
        return userDailyTransfers[user][day];
    }
    
    /**
     * @dev Gets a user's today transfer amount
     * @param user User address
     * @return amount Amount transferred today
     */
    function getUserTodayTransferAmount(address user) external view returns (uint256 amount) {
        uint256 today = block.timestamp / 1 days;
        return userDailyTransfers[user][today];
    }
    
    /**
     * @dev Add support for a chain
     * @param _chainId Chain ID to support
     */
    function addSupportedChain(uint256 _chainId) external onlyRole(ADMIN_ROLE) {
        if (_chainId == chainId) revert Errors.BridgeInvalidChainId();
        if (supportedChains[_chainId]) revert Errors.InvalidState();
        
        supportedChains[_chainId] = true;
        
        emit ChainSupported(_chainId);
    }
    
    /**
     * @dev Remove support for a chain
     * @param _chainId Chain ID to remove
     */
    function removeSupportedChain(uint256 _chainId) external onlyRole(ADMIN_ROLE) {
        if (!supportedChains[_chainId]) revert Errors.BridgeUnsupportedChain();
        
        supportedChains[_chainId] = false;
        
        emit ChainRemoved(_chainId);
    }
    
    /**
     * @dev Update fee percentage (in basis points, e.g., 100 = 1%)
     * @param _feePercent New fee percentage
     */
    function updateFee(uint256 _feePercent) external onlyRole(ADMIN_ROLE) {
        if (_feePercent > 1000) revert Errors.FeeExceedsLimit();
        
        bridgeFeePercent = _feePercent;
        
        emit FeeUpdated(_feePercent);
    }
    
    /**
     * @dev Update fee collector address
     * @param _feeCollector New fee collector address
     */
    function updateFeeCollector(address _feeCollector) external onlyRole(ADMIN_ROLE) {
        if (_feeCollector == address(0)) revert Errors.ZeroAddress();
        
        feeCollector = _feeCollector;
        
        emit FeeCollectorUpdated(_feeCollector);
    }
    
    /**
     * @dev Set the maximum amount per transfer
     * @param _maxAmount Maximum amount per transfer
     */
    function setMaxTransferAmount(uint256 _maxAmount) external onlyRole(GOVERNANCE_ROLE) {
        if (_maxAmount == 0) revert Errors.InvalidParameter();
        
        maxTransferAmount = _maxAmount;
        
        emit MaxTransferAmountUpdated(_maxAmount);
    }
    
    /**
     * @dev Set the daily transfer limit
     * @param _dailyLimit Daily transfer limit
     */
    function setDailyTransferLimit(uint256 _dailyLimit) external onlyRole(GOVERNANCE_ROLE) {
        if (_dailyLimit == 0) revert Errors.InvalidParameter();
        
        dailyTransferLimit = _dailyLimit;
        
        emit DailyTransferLimitUpdated(_dailyLimit);
    }
    
    /**
     * @dev Set limits for a specific asset
     * @param asset Asset address
     * @param maxAmount Maximum amount per transfer
     * @param dailyLimit Daily transfer limit
     */
    function setAssetLimits(
        address asset,
        uint256 maxAmount,
        uint256 dailyLimit
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (asset == address(0)) revert Errors.ZeroAddress();
        if (maxAmount == 0) revert Errors.InvalidParameter();
        if (dailyLimit == 0) revert Errors.InvalidParameter();
        
        transferLimits[asset] = TransferLimit({
            maxAmount: maxAmount,
            dailyLimit: dailyLimit,
            dailyUsed: 0,
            periodReset: block.timestamp + 1 days
        });
        
        emit AssetLimitUpdated(asset, maxAmount, dailyLimit);
    }
    
    /**
     * @dev Update token manager address
     * @param _tokenManager New token manager address
     */
    function updateTokenManager(address _tokenManager) external onlyRole(ADMIN_ROLE) {
        if (_tokenManager == address(0)) revert Errors.ZeroAddress();
        
        tokenManager = HederaTokenManager(_tokenManager);
    }
    
    /**
     * @dev Configure user-specific transfer limits
     * @param user User address
     * @param maxPerTransfer Maximum amount per transfer for this user
     * @param dailyLimit Daily transfer limit for this user
     * @param weeklyLimit Weekly transfer limit for this user
     * @param cooldownPeriod Cooldown period between large transfers (seconds)
     */
    function configureUserLimits(
        address user,
        uint256 maxPerTransfer,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 cooldownPeriod
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (user == address(0)) revert Errors.ZeroAddress();
        if (maxPerTransfer == 0 || dailyLimit == 0 || weeklyLimit == 0) revert Errors.InvalidParameter();
        if (dailyLimit > weeklyLimit) revert Errors.InvalidParameter();
        
        userLimits[user] = UserTransferLimit({
            maxPerTransfer: maxPerTransfer,
            dailyLimit: dailyLimit,
            weeklyLimit: weeklyLimit,
            dailyUsed: 0,
            weeklyUsed: 0,
            dailyReset: block.timestamp + 1 days,
            weeklyReset: block.timestamp + 7 days,
            cooldownPeriod: cooldownPeriod,
            lastLargeTransfer: 0,
            isLimited: true
        });
        
        emit UserLimitConfigured(user, maxPerTransfer, dailyLimit, weeklyLimit);
    }
    
    /**
     * @dev Remove user-specific transfer limits
     * @param user User address
     */
    function removeUserLimits(address user) external onlyRole(GOVERNANCE_ROLE) {
        if (user == address(0)) revert Errors.ZeroAddress();
        if (!userLimits[user].isLimited) revert Errors.InvalidState();
        
        delete userLimits[user];
        
        emit UserLimitConfigured(user, 0, 0, 0);
    }
    
    /**
     * @dev Set the large transfer threshold
     * @param _threshold Large transfer threshold
     */
    function setLargeTransferThreshold(uint256 _threshold) external onlyRole(GOVERNANCE_ROLE) {
        if (_threshold == 0) revert Errors.InvalidParameter();
        
        largeTransferThreshold = _threshold;
        
        emit LargeTransferThresholdUpdated(_threshold);
    }
    
    /**
     * @dev Set the default cooldown period for large transfers
     * @param _cooldownPeriod Default cooldown period (seconds)
     */
    function setDefaultCooldownPeriod(uint256 _cooldownPeriod) external onlyRole(GOVERNANCE_ROLE) {
        defaultCooldownPeriod = _cooldownPeriod;
        
        emit CooldownPeriodUpdated(_cooldownPeriod);
    }
    
    /**
     * @dev Update message verifier address
     * @param _messageVerifier New message verifier address
     */
    function updateMessageVerifier(address _messageVerifier) external onlyRole(ADMIN_ROLE) {
        if (_messageVerifier == address(0)) revert Errors.ZeroAddress();
        
        messageVerifier = IMessageVerifier(_messageVerifier);
    }
    
    /**
     * @dev Add a relayer
     * @param relayer Relayer address
     */
    function addRelayer(address relayer) external onlyRole(ADMIN_ROLE) {
        if (relayer == address(0)) revert Errors.ZeroAddress();
        
        _grantRole(RELAYER_ROLE, relayer);
    }
    
    /**
     * @dev Remove a relayer
     * @param relayer Relayer address
     */
    function removeRelayer(address relayer) external onlyRole(ADMIN_ROLE) {
        _revokeRole(RELAYER_ROLE, relayer);
    }
    
    /**
     * @dev Pause the bridge
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the bridge
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Internal function to check and update the daily transfer limit
     * @param amount Amount to transfer
     */
    function _checkAndUpdateDailyLimit(uint256 amount) internal {
        // Reset daily counter if period has passed
        if (block.timestamp >= dailyTransferReset) {
            dailyTransferUsed = 0;
            dailyTransferReset = block.timestamp + 1 days;
        }
        
        // Check daily limit
        if (dailyTransferUsed + amount > dailyTransferLimit) revert Errors.BridgeExceedsDailyLimit();
        
        // Update daily usage
        dailyTransferUsed += amount;
    }
    
    /**
     * @dev Internal function to check asset-specific limits
     * @param asset Asset address
     * @param amount Amount to transfer
     * @param user User address
     */
    function _checkAssetLimits(
        address asset,
        uint256 amount,
        address user
    ) internal {
        // First check asset-specific limits
        TransferLimit storage limit = transferLimits[asset];
        
        // Check asset limits if configured
        if (limit.maxAmount > 0) {
            // Check per-transfer limit
            if (amount > limit.maxAmount) revert Errors.BridgeExceedsAssetLimit();
            
            // Reset period if needed
            if (block.timestamp >= limit.periodReset) {
                limit.dailyUsed = 0;
                limit.periodReset = block.timestamp + 1 days;
            }
            
            // Check daily limit
            if (limit.dailyUsed + amount > limit.dailyLimit) revert Errors.BridgeExceedsDailyLimit();
            
            // Update daily usage
            limit.dailyUsed += amount;
        }
        
        // Track per-user daily transfers for basic tracking
        uint256 today = block.timestamp / 1 days;
        userDailyTransfers[user][today] += amount;
        
        // Now check user-specific limits if configured
        UserTransferLimit storage userLimit = userLimits[user];
        if (userLimit.isLimited) {
            // Check per-transfer limit for user
            if (amount > userLimit.maxPerTransfer) revert Errors.BridgeExceedsUserTransferLimit();
            
            // Reset daily counter if needed
            if (block.timestamp >= userLimit.dailyReset) {
                userLimit.dailyUsed = 0;
                userLimit.dailyReset = block.timestamp + 1 days;
            }
            
            // Reset weekly counter if needed
            if (block.timestamp >= userLimit.weeklyReset) {
                userLimit.weeklyUsed = 0;
                userLimit.weeklyReset = block.timestamp + 7 days;
            }
            
            // Check daily and weekly limits
            if (userLimit.dailyUsed + amount > userLimit.dailyLimit) revert Errors.BridgeExceedsUserDailyLimit();
            if (userLimit.weeklyUsed + amount > userLimit.weeklyLimit) revert Errors.BridgeExceedsUserWeeklyLimit();
            
            // Check cooldown period for large transfers
            if (largeTransferThreshold > 0 && amount >= largeTransferThreshold) {
                uint256 cooldown = userLimit.cooldownPeriod > 0 ? userLimit.cooldownPeriod : defaultCooldownPeriod;
                if (cooldown > 0 && userLimit.lastLargeTransfer > 0) {
                    if (block.timestamp - userLimit.lastLargeTransfer < cooldown) {
                        revert Errors.BridgeCooldownPeriodNotMet();
                    }
                }
                
                // Update last large transfer timestamp
                userLimit.lastLargeTransfer = block.timestamp;
            }
            
            // Update usage
            userLimit.dailyUsed += amount;
            userLimit.weeklyUsed += amount;
        }
    }
    
    /**
     * @dev Internal function to verify a transfer
     * @param transferId Transfer ID
     * @param sender Sender address
     * @param recipient Recipient address
     * @param asset Asset address
     * @param amount Amount
     * @param sourceChainId Source chain ID
     * @param targetChainId Target chain ID
     * @param signature Signature from relayer
     * @return isValid Whether the transfer is valid
     */
    function _verifyTransfer(
        bytes32 transferId,
        address sender,
        address recipient,
        address asset,
        uint256 amount,
        uint256 sourceChainId,
        uint256 targetChainId,
        bytes memory signature
    ) internal view returns (bool isValid) {
        // Create message hash for signature verification
        bytes32 messageHash = keccak256(abi.encodePacked(
            transferId,
            sender,
            recipient,
            asset,
            amount,
            sourceChainId,
            targetChainId
        ));
        
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        address signer = _recoverSigner(ethSignedMessageHash, signature);
        
        return hasRole(RELAYER_ROLE, signer);
    }
    
    /**
     * @dev Internal function to recover signer from signature
     * @param messageHash Message hash
     * @param signature Signature
     * @return signer Recovered signer address
     */
    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address signer) {
        if (signature.length != 65) revert Errors.BridgeInvalidSignature();
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        if (v != 27 && v != 28) revert Errors.BridgeInvalidSignature();
        
        return ecrecover(messageHash, v, r, s);
    }
    
    /**
     * @dev Internal function to check if an asset exists locally
     * @param asset Asset address
     * @param sourceChainId Source chain ID
     * @return exists Whether the asset exists locally
     */
    function _assetExistsLocally(address asset, uint256 sourceChainId) internal view returns (bool exists) {
        // If this is the asset's native chain, it exists
        if (sourceChainId == chainId) {
            return true;
        }
        
        // Check if we have a wrapped version
        return tokenManager.wrappedTokenExists(asset, sourceChainId);
    }
    
    /**
     * @dev Internal function to get or create a wrapped token
     * @param originalAsset Original asset address
     * @param originalChainId Original chain ID
     * @return wrappedAsset Address of the wrapped asset
     */
    function _getOrCreateWrappedToken(
        address originalAsset,
        uint256 originalChainId
    ) internal returns (address wrappedAsset) {
        // Check if wrapped token already exists
        address existing = tokenManager.getWrappedToken(originalAsset, originalChainId);
        if (existing != address(0)) {
            return existing;
        }
        
        // TODO: In production, get metadata from originalAsset on originalChainId
        // For this implementation, we use placeholder values
        string memory name = "Wrapped Token";
        string memory symbol = "WRAP";
        uint8 decimals = 18;
        uint256 maxSupply = 1e26; // 100 million with 18 decimals
        
        // Create wrapped token
        return tokenManager.createWrappedToken(
            originalAsset,
            originalChainId,
            name,
            symbol,
            decimals,
            maxSupply
        );
    }
    
    /**
     * @dev Internal function to check if an address is a contract
     * @param addr Address to check
     * @return isContract Whether the address is a contract
     */
    function _isContract(address addr) internal view returns (bool isContract) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}