// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../oracles/IPriceOracle.sol";
import "../identity/AINodeRegistry.sol";

/**
 * @title AdvancedGovernanceRewards
 * @notice Complex reward system for governance participants with price-based rewards
 * @dev Offers different reward structures based on AI node status and price changes
 */
contract AdvancedGovernanceRewards is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    
    bytes32 public constant REWARDS_ADMIN_ROLE = keccak256("REWARDS_ADMIN_ROLE");
    bytes32 public constant REWARDS_DISTRIBUTOR_ROLE = keccak256("REWARDS_DISTRIBUTOR_ROLE");
    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Reward mode for price-based rewards
    enum RewardMode {
        Standard,       // Standard reward
        PriceIncrease,  // Enhanced reward for price increase
        PriceDecrease,  // Enhanced reward for price decrease
        VolatilityHigh  // Enhanced reward for high volatility
    }
    
    // Reward claim record
    struct RewardClaim {
        address user;            // User who claimed the reward
        uint256 amount;          // Amount claimed
        uint256 timestamp;       // When claimed
        uint256 epochId;         // Epoch ID when claimed
        bool isAINode;           // Whether the user is an AI node
        uint8 verificationLevel; // Verification level if AI node
    }
    
    // Reward epoch
    struct RewardEpoch {
        uint256 startTime;       // Epoch start time
        uint256 endTime;         // Epoch end time
        uint256 baseRewardPool;  // Base reward pool for this epoch
        uint256 bonusRewardPool; // Bonus reward pool for this epoch
        uint256 totalClaimed;    // Total amount claimed in this epoch
        RewardMode rewardMode;   // Current reward mode
        uint256 priceAtStart;    // Asset price at epoch start
        uint256 currentPrice;    // Current asset price
        bool isActive;           // Whether this epoch is active
    }
    
    // Participant info
    struct Participant {
        bool hasClaimedCurrentEpoch; // Whether the participant has claimed in the current epoch
        uint256 totalClaimed;        // Total amount claimed across all epochs
        uint256 lastClaimTimestamp;  // Last claim timestamp
        uint256 lastClaimEpoch;      // Last claim epoch
    }
    
    // Price change thresholds (in basis points)
    struct PriceThresholds {
        uint256 significantIncrease; // Threshold for significant price increase (e.g., 500 = 5%)
        uint256 significantDecrease; // Threshold for significant price decrease (e.g., 500 = 5%)
        uint256 volatilityThreshold; // Threshold for high volatility (e.g., 1000 = 10%)
    }
    
    // Reward multipliers (in basis points, 10000 = 1x)
    struct RewardMultipliers {
        uint256 aiNodeBase;                // Base multiplier for AI nodes (e.g., 12000 = 1.2x)
        uint256 verificationLevelBonus;    // Bonus per verification level (e.g., 2500 = 0.25x)
        uint256 priceIncreaseMultiplier;   // Multiplier for price increase mode (e.g., 15000 = 1.5x)
        uint256 priceDecreaseMultiplier;   // Multiplier for price decrease mode (e.g., 15000 = 1.5x)
        uint256 volatilityMultiplier;      // Multiplier for high volatility mode (e.g., 20000 = 2x)
    }
    
    // Core contracts
    IERC20 public rewardToken;          // Token used for rewards (D-AI)
    IPriceOracle public priceOracle;    // Price oracle for price data
    AINodeRegistry public aiNodeRegistry; // AI Node Registry for verification
    
    // Asset being tracked for price changes
    address public trackedAsset;
    
    // Mappings
    mapping(address => Participant) public participants;
    mapping(uint256 => RewardEpoch) public rewardEpochs;
    mapping(uint256 => RewardClaim[]) public epochClaims;
    
    // Counters
    uint256 public currentEpochId;
    uint256 public totalClaimsCount;
    uint256 public totalRewardsClaimed;
    
    // Reward configuration
    uint256 public standardRewardAmount;  // Base reward amount for standard participants
    uint256 public epochDuration;         // Duration of each reward epoch
    uint256 public claimCooldown;         // Cooldown period between claims
    PriceThresholds public priceThresholds; // Price change thresholds
    RewardMultipliers public rewardMultipliers; // Reward multipliers
    
    // Events
    event RewardClaimed(address indexed user, uint256 amount, uint256 indexed epochId, bool isAINode, uint8 verificationLevel);
    event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime, uint256 baseRewardPool, uint256 bonusRewardPool);
    event EpochEnded(uint256 indexed epochId, uint256 endTime, uint256 totalClaimed, RewardMode rewardMode);
    event RewardModeChanged(uint256 indexed epochId, RewardMode oldMode, RewardMode newMode);
    event PriceUpdated(uint256 indexed epochId, uint256 oldPrice, uint256 newPrice);
    event RewardConfigUpdated(uint256 standardRewardAmount, uint256 epochDuration, uint256 claimCooldown);
    event PriceThresholdsUpdated(uint256 significantIncrease, uint256 significantDecrease, uint256 volatilityThreshold);
    event RewardMultipliersUpdated(
        uint256 aiNodeBase,
        uint256 verificationLevelBonus,
        uint256 priceIncreaseMultiplier,
        uint256 priceDecreaseMultiplier,
        uint256 volatilityMultiplier
    );
    
    /**
     * @notice Initializer function (replaces constructor in upgradeable contracts)
     * @param admin Address of the admin who will control the rewards
     * @param _rewardToken Address of the reward token
     * @param _priceOracle Address of the price oracle
     * @param _aiNodeRegistry Address of the AI Node Registry
     * @param _trackedAsset Address of the asset to track for price changes
     */
    function initialize(
        address admin,
        address _rewardToken,
        address _priceOracle,
        address _aiNodeRegistry,
        address _trackedAsset
    ) public initializer {
        require(admin != address(0), "Invalid admin address");
        require(_rewardToken != address(0), "Invalid reward token address");
        require(_priceOracle != address(0), "Invalid price oracle address");
        require(_aiNodeRegistry != address(0), "Invalid AI Node Registry address");
        require(_trackedAsset != address(0), "Invalid tracked asset address");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REWARDS_ADMIN_ROLE, admin);
        _grantRole(REWARDS_DISTRIBUTOR_ROLE, admin);
        _grantRole(PRICE_UPDATER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        rewardToken = IERC20(_rewardToken);
        priceOracle = IPriceOracle(_priceOracle);
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
        trackedAsset = _trackedAsset;
        
        // Initialize reward configuration
        standardRewardAmount = 100 * 10**18; // 100 tokens with 18 decimals
        epochDuration = 7 days; // 1 week per epoch
        claimCooldown = 1 days; // 1 day between claims
        
        // Set default price thresholds
        priceThresholds = PriceThresholds({
            significantIncrease: 500, // 5%
            significantDecrease: 500, // 5%
            volatilityThreshold: 1000 // 10%
        });
        
        // Set default reward multipliers
        rewardMultipliers = RewardMultipliers({
            aiNodeBase: 12000,              // 1.2x
            verificationLevelBonus: 2500,   // 0.25x per level
            priceIncreaseMultiplier: 15000, // 1.5x
            priceDecreaseMultiplier: 15000, // 1.5x
            volatilityMultiplier: 20000     // 2x
        });
        
        currentEpochId = 0;
        totalClaimsCount = 0;
        totalRewardsClaimed = 0;
    }
    
    /**
     * @notice Starts a new reward epoch
     * @param baseRewardPool Base reward pool for this epoch
     * @param bonusRewardPool Bonus reward pool for this epoch
     */
    function startNewEpoch(
        uint256 baseRewardPool,
        uint256 bonusRewardPool
    ) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(
            currentEpochId == 0 || rewardEpochs[currentEpochId].endTime <= block.timestamp,
            "Current epoch not ended"
        );
        
        // Check if there's enough balance
        uint256 totalRewardPool = baseRewardPool + bonusRewardPool;
        require(
            rewardToken.balanceOf(address(this)) >= totalRewardPool,
            "Insufficient reward balance"
        );
        
        // Get current asset price
        uint256 currentPrice = priceOracle.getAssetPriceUSD(trackedAsset);
        require(currentPrice > 0, "Invalid price");
        
        // Create new epoch
        currentEpochId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + epochDuration;
        
        rewardEpochs[currentEpochId] = RewardEpoch({
            startTime: startTime,
            endTime: endTime,
            baseRewardPool: baseRewardPool,
            bonusRewardPool: bonusRewardPool,
            totalClaimed: 0,
            rewardMode: RewardMode.Standard,
            priceAtStart: currentPrice,
            currentPrice: currentPrice,
            isActive: true
        });
        
        emit EpochStarted(currentEpochId, startTime, endTime, baseRewardPool, bonusRewardPool);
    }
    
    /**
     * @notice Ends the current reward epoch
     */
    function endCurrentEpoch() 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(currentEpochId > 0, "No active epoch");
        
        RewardEpoch storage epoch = rewardEpochs[currentEpochId];
        
        require(epoch.isActive, "Epoch already ended");
        require(
            block.timestamp >= epoch.endTime,
            "Epoch not yet complete"
        );
        
        // Deactivate the epoch
        epoch.isActive = false;
        
        emit EpochEnded(currentEpochId, block.timestamp, epoch.totalClaimed, epoch.rewardMode);
    }
    
    /**
     * @notice Claims rewards for the current epoch
     */
    function claimRewards() 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(currentEpochId > 0, "No active epoch");
        
        RewardEpoch storage epoch = rewardEpochs[currentEpochId];
        
        require(epoch.isActive, "Epoch not active");
        require(block.timestamp >= epoch.startTime, "Epoch not started");
        require(block.timestamp <= epoch.endTime, "Epoch ended");
        
        Participant storage participant = participants[msg.sender];
        
        require(!participant.hasClaimedCurrentEpoch, "Already claimed this epoch");
        require(
            participant.lastClaimTimestamp == 0 || 
            block.timestamp >= participant.lastClaimTimestamp + claimCooldown,
            "Claim cooldown active"
        );
        
        // Calculate reward amount
        (uint256 rewardAmount, bool isAINode, uint8 verificationLevel) = _calculateRewardAmount(msg.sender, epoch.rewardMode);
        
        // Update participant data
        participant.hasClaimedCurrentEpoch = true;
        participant.totalClaimed += rewardAmount;
        participant.lastClaimTimestamp = block.timestamp;
        participant.lastClaimEpoch = currentEpochId;
        
        // Update epoch data
        epoch.totalClaimed += rewardAmount;
        
        // Update global counters
        totalClaimsCount++;
        totalRewardsClaimed += rewardAmount;
        
        // Record the claim
        epochClaims[currentEpochId].push(RewardClaim({
            user: msg.sender,
            amount: rewardAmount,
            timestamp: block.timestamp,
            epochId: currentEpochId,
            isAINode: isAINode,
            verificationLevel: verificationLevel
        }));
        
        // Transfer rewards
        rewardToken.safeTransfer(msg.sender, rewardAmount);
        
        emit RewardClaimed(msg.sender, rewardAmount, currentEpochId, isAINode, verificationLevel);
    }
    
    /**
     * @notice Updates the price of the tracked asset and potentially changes reward mode
     */
    function updatePrice() 
        external 
        onlyRole(PRICE_UPDATER_ROLE) 
    {
        require(currentEpochId > 0, "No active epoch");
        
        RewardEpoch storage epoch = rewardEpochs[currentEpochId];
        
        require(epoch.isActive, "Epoch not active");
        
        // Get new price
        uint256 newPrice = priceOracle.getAssetPriceUSD(trackedAsset);
        require(newPrice > 0, "Invalid price");
        
        uint256 oldPrice = epoch.currentPrice;
        epoch.currentPrice = newPrice;
        
        emit PriceUpdated(currentEpochId, oldPrice, newPrice);
        
        // Check if we need to change reward mode
        RewardMode oldMode = epoch.rewardMode;
        RewardMode newMode = _determineRewardMode(epoch.priceAtStart, newPrice);
        
        if (oldMode != newMode) {
            epoch.rewardMode = newMode;
            emit RewardModeChanged(currentEpochId, oldMode, newMode);
        }
    }
    
    /**
     * @notice Updates the reward configuration
     * @param _standardRewardAmount New standard reward amount
     * @param _epochDuration New epoch duration
     * @param _claimCooldown New claim cooldown
     */
    function updateRewardConfig(
        uint256 _standardRewardAmount,
        uint256 _epochDuration,
        uint256 _claimCooldown
    ) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_standardRewardAmount > 0, "Reward amount must be positive");
        require(_epochDuration > 0, "Epoch duration must be positive");
        
        standardRewardAmount = _standardRewardAmount;
        epochDuration = _epochDuration;
        claimCooldown = _claimCooldown;
        
        emit RewardConfigUpdated(_standardRewardAmount, _epochDuration, _claimCooldown);
    }
    
    /**
     * @notice Updates the price thresholds
     * @param _significantIncrease New threshold for significant price increase
     * @param _significantDecrease New threshold for significant price decrease
     * @param _volatilityThreshold New threshold for high volatility
     */
    function updatePriceThresholds(
        uint256 _significantIncrease,
        uint256 _significantDecrease,
        uint256 _volatilityThreshold
    ) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_significantIncrease > 0, "Increase threshold must be positive");
        require(_significantDecrease > 0, "Decrease threshold must be positive");
        require(_volatilityThreshold > 0, "Volatility threshold must be positive");
        
        priceThresholds.significantIncrease = _significantIncrease;
        priceThresholds.significantDecrease = _significantDecrease;
        priceThresholds.volatilityThreshold = _volatilityThreshold;
        
        emit PriceThresholdsUpdated(_significantIncrease, _significantDecrease, _volatilityThreshold);
    }
    
    /**
     * @notice Updates the reward multipliers
     * @param _aiNodeBase New base multiplier for AI nodes
     * @param _verificationLevelBonus New bonus per verification level
     * @param _priceIncreaseMultiplier New multiplier for price increase mode
     * @param _priceDecreaseMultiplier New multiplier for price decrease mode
     * @param _volatilityMultiplier New multiplier for high volatility mode
     */
    function updateRewardMultipliers(
        uint256 _aiNodeBase,
        uint256 _verificationLevelBonus,
        uint256 _priceIncreaseMultiplier,
        uint256 _priceDecreaseMultiplier,
        uint256 _volatilityMultiplier
    ) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_aiNodeBase > 0, "AI node base must be positive");
        require(_priceIncreaseMultiplier > 0, "Price increase multiplier must be positive");
        require(_priceDecreaseMultiplier > 0, "Price decrease multiplier must be positive");
        require(_volatilityMultiplier > 0, "Volatility multiplier must be positive");
        
        rewardMultipliers.aiNodeBase = _aiNodeBase;
        rewardMultipliers.verificationLevelBonus = _verificationLevelBonus;
        rewardMultipliers.priceIncreaseMultiplier = _priceIncreaseMultiplier;
        rewardMultipliers.priceDecreaseMultiplier = _priceDecreaseMultiplier;
        rewardMultipliers.volatilityMultiplier = _volatilityMultiplier;
        
        emit RewardMultipliersUpdated(
            _aiNodeBase,
            _verificationLevelBonus,
            _priceIncreaseMultiplier,
            _priceDecreaseMultiplier,
            _volatilityMultiplier
        );
    }
    
    /**
     * @notice Updates the tracked asset
     * @param _trackedAsset New tracked asset address
     */
    function updateTrackedAsset(address _trackedAsset) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_trackedAsset != address(0), "Invalid tracked asset address");
        trackedAsset = _trackedAsset;
    }
    
    /**
     * @notice Updates the price oracle
     * @param _priceOracle New price oracle address
     */
    function updatePriceOracle(address _priceOracle) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_priceOracle != address(0), "Invalid price oracle address");
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    /**
     * @notice Updates the AI Node Registry
     * @param _aiNodeRegistry New AI Node Registry address
     */
    function updateAINodeRegistry(address _aiNodeRegistry) 
        external 
        onlyRole(REWARDS_ADMIN_ROLE) 
    {
        require(_aiNodeRegistry != address(0), "Invalid AI Node Registry address");
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(REWARDS_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(REWARDS_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets the details of a specific epoch
     * @param epochId ID of the epoch
     * @return epoch Epoch details
     * @return claimsCount Number of claims in the epoch
     */
    function getEpochDetails(uint256 epochId) 
        external 
        view 
        returns (RewardEpoch memory epoch, uint256 claimsCount) 
    {
        require(epochId > 0 && epochId <= currentEpochId, "Invalid epoch ID");
        
        epoch = rewardEpochs[epochId];
        claimsCount = epochClaims[epochId].length;
        
        return (epoch, claimsCount);
    }
    
    /**
     * @notice Gets the claims for an epoch with pagination
     * @param epochId ID of the epoch
     * @param startIndex Start index for pagination
     * @param count Number of claims to return
     * @return claims Array of claims
     */
    function getEpochClaims(
        uint256 epochId,
        uint256 startIndex,
        uint256 count
    ) 
        external 
        view 
        returns (RewardClaim[] memory claims) 
    {
        require(epochId > 0 && epochId <= currentEpochId, "Invalid epoch ID");
        
        RewardClaim[] storage epochClaimsArray = epochClaims[epochId];
        uint256 totalClaims = epochClaimsArray.length;
        
        require(startIndex < totalClaims, "Start index out of bounds");
        
        // Adjust count if necessary
        if (startIndex + count > totalClaims) {
            count = totalClaims - startIndex;
        }
        
        // Copy claims to result array
        claims = new RewardClaim[](count);
        for (uint256 i = 0; i < count; i++) {
            claims[i] = epochClaimsArray[startIndex + i];
        }
        
        return claims;
    }
    
    /**
     * @notice Gets the participant data for an address
     * @param user Address of the participant
     * @return participant Participant data
     * @return isAINode Whether the user is an AI node
     * @return verificationLevel Verification level if AI node
     */
    function getParticipantData(address user) 
        external 
        view 
        returns (
            Participant memory participant,
            bool isAINode,
            uint8 verificationLevel
        ) 
    {
        participant = participants[user];
        isAINode = aiNodeRegistry.isVerifiedAINode(user);
        verificationLevel = isAINode ? uint8(aiNodeRegistry.getNodeVerificationLevel(user)) : 0;
        
        return (participant, isAINode, verificationLevel);
    }
    
    /**
     * @notice Required by UUPS pattern
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
    
    /**
     * @notice Calculates the reward amount for a participant
     * @param user Address of the participant
     * @param mode Current reward mode
     * @return rewardAmount Amount of rewards to claim
     * @return isAINode Whether the user is an AI node
     * @return verificationLevel Verification level if AI node
     */
    function _calculateRewardAmount(
        address user,
        RewardMode mode
    ) 
        internal 
        view 
        returns (
            uint256 rewardAmount,
            bool isAINode,
            uint8 verificationLevel
        ) 
    {
        // Start with standard reward amount
        rewardAmount = standardRewardAmount;
        
        // Check if user is an AI node and get verification level
        isAINode = aiNodeRegistry.isVerifiedAINode(user);
        verificationLevel = isAINode ? uint8(aiNodeRegistry.getNodeVerificationLevel(user)) : 0;
        
        // Apply AI node multiplier if applicable
        if (isAINode) {
            // Base AI node multiplier
            rewardAmount = (rewardAmount * rewardMultipliers.aiNodeBase) / 10000;
            
            // Additional bonus based on verification level
            uint256 levelBonus = verificationLevel * rewardMultipliers.verificationLevelBonus;
            rewardAmount = (rewardAmount * (10000 + levelBonus)) / 10000;
        }
        
        // Apply reward mode multiplier
        if (mode == RewardMode.PriceIncrease) {
            rewardAmount = (rewardAmount * rewardMultipliers.priceIncreaseMultiplier) / 10000;
        } else if (mode == RewardMode.PriceDecrease) {
            rewardAmount = (rewardAmount * rewardMultipliers.priceDecreaseMultiplier) / 10000;
        } else if (mode == RewardMode.VolatilityHigh) {
            rewardAmount = (rewardAmount * rewardMultipliers.volatilityMultiplier) / 10000;
        }
        
        return (rewardAmount, isAINode, verificationLevel);
    }
    
    /**
     * @notice Determines the reward mode based on price changes
     * @param startPrice Price at the start of the epoch
     * @param currentPrice Current price
     * @return mode The appropriate reward mode
     */
    function _determineRewardMode(
        uint256 startPrice,
        uint256 currentPrice
    ) 
        internal 
        view 
        returns (RewardMode) 
    {
        // Calculate price change percentage (basis points)
        uint256 priceChangePercentage;
        
        if (currentPrice > startPrice) {
            // Price increase
            priceChangePercentage = ((currentPrice - startPrice) * 10000) / startPrice;
            
            if (priceChangePercentage >= priceThresholds.volatilityThreshold) {
                return RewardMode.VolatilityHigh;
            } else if (priceChangePercentage >= priceThresholds.significantIncrease) {
                return RewardMode.PriceIncrease;
            }
        } else if (currentPrice < startPrice) {
            // Price decrease
            priceChangePercentage = ((startPrice - currentPrice) * 10000) / startPrice;
            
            if (priceChangePercentage >= priceThresholds.volatilityThreshold) {
                return RewardMode.VolatilityHigh;
            } else if (priceChangePercentage >= priceThresholds.significantDecrease) {
                return RewardMode.PriceDecrease;
            }
        }
        
        // Default to standard mode
        return RewardMode.Standard;
    }
}