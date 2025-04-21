// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../identity/AINodeRegistry.sol";

/**
 * @title FeeCalculator
 * @notice Calculates fees for various operations in the D-Loop ecosystem
 * @dev Supports tiered fee structures and AI node discounts
 */
contract FeeCalculator is AccessControl, Pausable {
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");
    
    // AI Node Registry for verification checks
    AINodeRegistry public aiNodeRegistry;
    
    // Fee types
    enum FeeType {
        Invest,
        Divest,
        Ragequit,
        Transfer,
        Custom
    }
    
    // Fee tier thresholds (token amounts)
    struct FeeTier {
        uint256 minAmount;       // Minimum amount for this tier
        uint256 maxAmount;       // Maximum amount for this tier (0 = no max)
        uint256 feePercentage;   // Fee percentage in basis points (10000 = 100%)
        uint256 flatFee;         // Optional flat fee amount
    }
    
    // Fee configuration for each fee type
    struct FeeConfig {
        bool enabled;                  // Whether this fee type is enabled
        bool useTiers;                 // Whether to use tiered fee structure
        uint256 defaultFeePercentage; // Default fee percentage in basis points
        uint256 defaultFlatFee;       // Default flat fee amount
        mapping(uint256 => FeeTier) tiers; // Tier => FeeTier
        uint8 tierCount;              // Number of tiers
    }
    
    // Fee discounts for AI nodes
    struct AINodeDiscount {
        bool enabled;                   // Whether AI node discounts are enabled
        mapping(uint8 => uint256) discountsByLevel; // Verification level => discount percentage (bp)
    }
    
    // Asset-specific fee overrides
    struct AssetFeeOverride {
        bool hasOverride;              // Whether this asset has fee overrides
        mapping(uint8 => uint256) feePercentageByType; // FeeType => percentage
    }
    
    // Fee configurations
    mapping(uint8 => FeeConfig) public feeConfigs;
    
    // Asset-specific fee overrides
    mapping(address => AssetFeeOverride) public assetFeeOverrides;
    
    // AI node discounts
    AINodeDiscount public aiNodeDiscount;
    
    // Events
    event FeeCalculated(
        address indexed asset,
        address indexed user,
        uint8 feeType,
        uint256 amount,
        uint256 feeAmount,
        uint256 appliedFeePercentage,
        bool discountApplied,
        uint256 discountPercentage
    );
    event FeeConfigUpdated(uint8 feeType, uint256 defaultFeePercentage, uint256 defaultFlatFee);
    event FeeTierAdded(uint8 feeType, uint256 tierIndex, uint256 minAmount, uint256 maxAmount, uint256 feePercentage);
    event AssetFeeOverrideSet(address indexed asset, uint8 feeType, uint256 feePercentage);
    event AINodeDiscountUpdated(uint8 level, uint256 discountPercentage);
    event AINodeDiscountStatusChanged(bool enabled);
    
    /**
     * @notice Constructor
     * @param admin Address to grant admin role
     * @param _aiNodeRegistry Address of the AI Node Registry
     */
    constructor(address admin, address _aiNodeRegistry) {
        require(admin != address(0), "Invalid admin address");
        require(_aiNodeRegistry != address(0), "Invalid registry address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FEE_ADMIN_ROLE, admin);
        
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
        
        // Initialize default fee configurations
        
        // Invest fee: 10% by default
        feeConfigs[uint8(FeeType.Invest)].enabled = true;
        feeConfigs[uint8(FeeType.Invest)].useTiers = false;
        feeConfigs[uint8(FeeType.Invest)].defaultFeePercentage = 1000; // 10%
        feeConfigs[uint8(FeeType.Invest)].defaultFlatFee = 0;
        
        // Divest fee: 5% by default
        feeConfigs[uint8(FeeType.Divest)].enabled = true;
        feeConfigs[uint8(FeeType.Divest)].useTiers = false;
        feeConfigs[uint8(FeeType.Divest)].defaultFeePercentage = 500; // 5%
        feeConfigs[uint8(FeeType.Divest)].defaultFlatFee = 0;
        
        // Ragequit fee: 20% by default
        feeConfigs[uint8(FeeType.Ragequit)].enabled = true;
        feeConfigs[uint8(FeeType.Ragequit)].useTiers = false;
        feeConfigs[uint8(FeeType.Ragequit)].defaultFeePercentage = 2000; // 20%
        feeConfigs[uint8(FeeType.Ragequit)].defaultFlatFee = 0;
        
        // Transfer fee: 2% by default
        feeConfigs[uint8(FeeType.Transfer)].enabled = true;
        feeConfigs[uint8(FeeType.Transfer)].useTiers = false;
        feeConfigs[uint8(FeeType.Transfer)].defaultFeePercentage = 200; // 2%
        feeConfigs[uint8(FeeType.Transfer)].defaultFlatFee = 0;
        
        // AI node discounts configuration
        aiNodeDiscount.enabled = true;
        aiNodeDiscount.discountsByLevel[AINodeRegistry.LEVEL_BASIC] = 1000;    // 10% discount
        aiNodeDiscount.discountsByLevel[AINodeRegistry.LEVEL_ADVANCED] = 2500; // 25% discount
        aiNodeDiscount.discountsByLevel[AINodeRegistry.LEVEL_EXPERT] = 5000;   // 50% discount
    }
    
    /**
     * @notice Calculates the investment fee
     * @param asset Address of the asset
     * @param amount Amount to invest
     * @param user Address of the user
     * @return fee Amount of fee to pay
     */
    function calculateInvestFee(
        address asset,
        uint256 amount,
        address user
    ) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        return _calculateFee(FeeType.Invest, asset, amount, user);
    }
    
    /**
     * @notice Calculates the divestment fee
     * @param asset Address of the asset
     * @param amount Amount to divest
     * @param user Address of the user
     * @return fee Amount of fee to pay
     */
    function calculateDivestFee(
        address asset,
        uint256 amount,
        address user
    ) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        return _calculateFee(FeeType.Divest, asset, amount, user);
    }
    
    /**
     * @notice Calculates the ragequit fee
     * @param asset Address of the asset
     * @param amount Amount to ragequit with
     * @param user Address of the user
     * @return fee Amount of fee to pay
     */
    function calculateRagequitFee(
        address asset,
        uint256 amount,
        address user
    ) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        return _calculateFee(FeeType.Ragequit, asset, amount, user);
    }
    
    /**
     * @notice Calculates the transfer fee
     * @param asset Address of the asset
     * @param amount Amount to transfer
     * @param user Address of the user
     * @return fee Amount of fee to pay
     */
    function calculateTransferFee(
        address asset,
        uint256 amount,
        address user
    ) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        return _calculateFee(FeeType.Transfer, asset, amount, user);
    }
    
    /**
     * @notice Calculates a custom fee
     * @param asset Address of the asset
     * @param amount Amount to base fee on
     * @param user Address of the user
     * @param customFeeBps Custom fee percentage in basis points
     * @return fee Amount of fee to pay
     */
    function calculateCustomFee(
        address asset,
        uint256 amount,
        address user,
        uint256 customFeeBps
    ) 
        external 
        view 
        whenNotPaused 
        returns (uint256) 
    {
        // For custom fees, use the provided percentage but still apply discounts
        uint256 feePercentage = customFeeBps;
        uint256 discountPercentage = 0;
        bool discountApplied = false;
        
        // Apply AI node discount if applicable
        if (aiNodeDiscount.enabled) {
            uint8 level = uint8(aiNodeRegistry.getNodeVerificationLevel(user));
            if (level > 0) {
                discountPercentage = aiNodeDiscount.discountsByLevel[level];
                if (discountPercentage > 0) {
                    discountApplied = true;
                    feePercentage = feePercentage * (10000 - discountPercentage) / 10000;
                }
            }
        }
        
        uint256 fee = (amount * feePercentage) / 10000;
        
        emit FeeCalculated(
            asset,
            user,
            uint8(FeeType.Custom),
            amount,
            fee,
            feePercentage,
            discountApplied,
            discountPercentage
        );
        
        return fee;
    }
    
    /**
     * @notice Updates the basic fee configuration for a fee type
     * @param feeType Fee type to update
     * @param enabled Whether the fee is enabled
     * @param useTiers Whether to use tiered fees
     * @param defaultFeePercentage Default fee percentage (basis points)
     * @param defaultFlatFee Default flat fee amount
     */
    function updateFeeConfig(
        FeeType feeType,
        bool enabled,
        bool useTiers,
        uint256 defaultFeePercentage,
        uint256 defaultFlatFee
    ) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        require(defaultFeePercentage <= 5000, "Fee percentage too high");
        
        FeeConfig storage config = feeConfigs[uint8(feeType)];
        config.enabled = enabled;
        config.useTiers = useTiers;
        config.defaultFeePercentage = defaultFeePercentage;
        config.defaultFlatFee = defaultFlatFee;
        
        emit FeeConfigUpdated(uint8(feeType), defaultFeePercentage, defaultFlatFee);
    }
    
    /**
     * @notice Adds a fee tier for a fee type
     * @param feeType Fee type to add tier for
     * @param minAmount Minimum amount for this tier
     * @param maxAmount Maximum amount for this tier (0 = no max)
     * @param feePercentage Fee percentage for this tier (basis points)
     * @param flatFee Flat fee for this tier
     */
    function addFeeTier(
        FeeType feeType,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 feePercentage,
        uint256 flatFee
    ) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        require(feePercentage <= 5000, "Fee percentage too high");
        require(minAmount > 0, "Min amount must be positive");
        require(maxAmount == 0 || maxAmount > minAmount, "Invalid max amount");
        
        FeeConfig storage config = feeConfigs[uint8(feeType)];
        config.useTiers = true;
        
        uint8 tierIndex = config.tierCount;
        config.tiers[tierIndex] = FeeTier({
            minAmount: minAmount,
            maxAmount: maxAmount,
            feePercentage: feePercentage,
            flatFee: flatFee
        });
        
        config.tierCount++;
        
        emit FeeTierAdded(uint8(feeType), tierIndex, minAmount, maxAmount, feePercentage);
    }
    
    /**
     * @notice Sets a fee override for a specific asset
     * @param asset Address of the asset
     * @param feeType Fee type to override
     * @param feePercentage Fee percentage (basis points)
     */
    function setAssetFeeOverride(
        address asset,
        FeeType feeType,
        uint256 feePercentage
    ) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(feePercentage <= 5000, "Fee percentage too high");
        
        AssetFeeOverride storage override = assetFeeOverrides[asset];
        override.hasOverride = true;
        override.feePercentageByType[uint8(feeType)] = feePercentage;
        
        emit AssetFeeOverrideSet(asset, uint8(feeType), feePercentage);
    }
    
    /**
     * @notice Updates the AI node discount for a verification level
     * @param level Verification level
     * @param discountPercentage Discount percentage (basis points)
     */
    function updateAINodeDiscount(
        uint8 level,
        uint256 discountPercentage
    ) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        require(level > 0 && level <= AINodeRegistry.LEVEL_EXPERT, "Invalid level");
        require(discountPercentage <= 10000, "Discount too high");
        
        aiNodeDiscount.discountsByLevel[level] = discountPercentage;
        
        emit AINodeDiscountUpdated(level, discountPercentage);
    }
    
    /**
     * @notice Enables or disables AI node discounts
     * @param enabled Whether discounts are enabled
     */
    function setAINodeDiscountStatus(bool enabled) 
        external 
        onlyRole(FEE_ADMIN_ROLE) 
    {
        aiNodeDiscount.enabled = enabled;
        
        emit AINodeDiscountStatusChanged(enabled);
    }
    
    /**
     * @notice Updates the AI node registry address
     * @param _aiNodeRegistry New AI node registry address
     */
    function updateAINodeRegistry(address _aiNodeRegistry) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_aiNodeRegistry != address(0), "Invalid registry address");
        
        aiNodeRegistry = AINodeRegistry(_aiNodeRegistry);
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(FEE_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(FEE_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets the current fee percentage for a fee type
     * @param feeType Fee type to query
     * @return percentage Fee percentage (basis points)
     */
    function getFeePercentage(FeeType feeType) 
        external 
        view 
        returns (uint256) 
    {
        FeeConfig storage config = feeConfigs[uint8(feeType)];
        require(config.enabled, "Fee type not enabled");
        
        return config.defaultFeePercentage;
    }
    
    /**
     * @notice Gets the details of a fee tier
     * @param feeType Fee type to query
     * @param tierIndex Tier index
     * @return minAmount Minimum amount for the tier
     * @return maxAmount Maximum amount for the tier
     * @return feePercentage Fee percentage for the tier
     * @return flatFee Flat fee for the tier
     */
    function getFeeTier(
        FeeType feeType,
        uint8 tierIndex
    ) 
        external 
        view 
        returns (
            uint256 minAmount,
            uint256 maxAmount,
            uint256 feePercentage,
            uint256 flatFee
        ) 
    {
        FeeConfig storage config = feeConfigs[uint8(feeType)];
        require(tierIndex < config.tierCount, "Invalid tier index");
        
        FeeTier storage tier = config.tiers[tierIndex];
        
        return (
            tier.minAmount,
            tier.maxAmount,
            tier.feePercentage,
            tier.flatFee
        );
    }
    
    /**
     * @notice Gets the number of tiers for a fee type
     * @param feeType Fee type to query
     * @return count Number of tiers
     */
    function getFeeTierCount(FeeType feeType) 
        external 
        view 
        returns (uint8) 
    {
        return feeConfigs[uint8(feeType)].tierCount;
    }
    
    /**
     * @notice Gets the AI node discount for a verification level
     * @param level Verification level
     * @return discountPercentage Discount percentage (basis points)
     */
    function getAINodeDiscount(uint8 level) 
        external 
        view 
        returns (uint256) 
    {
        require(level > 0 && level <= AINodeRegistry.LEVEL_EXPERT, "Invalid level");
        
        return aiNodeDiscount.discountsByLevel[level];
    }
    
    /**
     * @notice Core fee calculation function
     * @param feeType Type of fee to calculate
     * @param asset Address of the asset
     * @param amount Amount to base fee on
     * @param user Address of the user
     * @return fee Amount of fee to pay
     */
    function _calculateFee(
        FeeType feeType,
        address asset,
        uint256 amount,
        address user
    ) 
        internal 
        view 
        returns (uint256) 
    {
        require(amount > 0, "Amount must be positive");
        
        FeeConfig storage config = feeConfigs[uint8(feeType)];
        require(config.enabled, "Fee type not enabled");
        
        uint256 feePercentage;
        uint256 flatFee = 0;
        
        // Check if there's an asset-specific override
        if (assetFeeOverrides[asset].hasOverride) {
            uint256 overridePercentage = assetFeeOverrides[asset].feePercentageByType[uint8(feeType)];
            if (overridePercentage > 0) {
                feePercentage = overridePercentage;
            } else {
                // If no specific override for this fee type, use the default
                feePercentage = config.defaultFeePercentage;
            }
        } else {
            // No override, use the configured fee calculation
            if (config.useTiers) {
                (feePercentage, flatFee) = _getTierFee(uint8(feeType), amount);
            } else {
                feePercentage = config.defaultFeePercentage;
                flatFee = config.defaultFlatFee;
            }
        }
        
        // Apply AI node discount if applicable
        uint256 discountPercentage = 0;
        bool discountApplied = false;
        
        if (aiNodeDiscount.enabled) {
            uint8 level = uint8(aiNodeRegistry.getNodeVerificationLevel(user));
            if (level > 0) {
                discountPercentage = aiNodeDiscount.discountsByLevel[level];
                if (discountPercentage > 0) {
                    discountApplied = true;
                    feePercentage = feePercentage * (10000 - discountPercentage) / 10000;
                }
            }
        }
        
        // Calculate fee
        uint256 percentageFee = (amount * feePercentage) / 10000;
        uint256 totalFee = percentageFee + flatFee;
        
        // Ensure fee doesn't exceed amount
        if (totalFee > amount) {
            totalFee = amount;
        }
        
        emit FeeCalculated(
            asset,
            user,
            uint8(feeType),
            amount,
            totalFee,
            feePercentage,
            discountApplied,
            discountPercentage
        );
        
        return totalFee;
    }
    
    /**
     * @notice Gets the appropriate tier fee for an amount
     * @param feeType Fee type
     * @param amount Amount to check against tiers
     * @return feePercentage Fee percentage for the matching tier
     * @return flatFee Flat fee for the matching tier
     */
    function _getTierFee(
        uint8 feeType,
        uint256 amount
    ) 
        internal 
        view 
        returns (uint256 feePercentage, uint256 flatFee) 
    {
        FeeConfig storage config = feeConfigs[feeType];
        
        // Default to the base fee if no tier matches
        feePercentage = config.defaultFeePercentage;
        flatFee = config.defaultFlatFee;
        
        // Find the matching tier
        for (uint8 i = 0; i < config.tierCount; i++) {
            FeeTier storage tier = config.tiers[i];
            
            if (amount >= tier.minAmount && 
                (tier.maxAmount == 0 || amount <= tier.maxAmount)) {
                feePercentage = tier.feePercentage;
                flatFee = tier.flatFee;
                break;
            }
        }
        
        return (feePercentage, flatFee);
    }
}