// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "../tokens/DAIToken.sol";
import "../fees/FeeCalculator.sol";
import "../oracles/IPriceOracle.sol";
import "./AssetDAO.sol";

/**
 * @title RagequitHandler
 * @dev Handles ragequit (exit) operations for the Asset DAO
 * Allows users to exit the DAO with their proportional share of assets
 */
contract RagequitHandler is ReentrancyGuard, Pausable, AccessControl, Initializable {
    using SafeERC20 for IERC20;
    using SafeERC20 for DAIToken;
    
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ASSET_DAO_ROLE = keccak256("ASSET_DAO_ROLE");
    
    // Associated contracts
    AssetDAO public assetDAO;
    DAIToken public daiToken;
    FeeCalculator public feeCalculator;
    IPriceOracle public priceOracle;
    
    // Ragequit settings
    uint256 public ragequitCooldown; // Time required between ragequits (in seconds)
    uint256 public maxRagequitAmount; // Maximum percentage of total supply that can be ragequit at once (in basis points)
    
    // Tracking
    mapping(address => uint256) public lastRagequitTime; // Last ragequit timestamp per user
    uint256 public totalRagequitAmount; // Total amount ragequit in current period
    uint256 public ragequitResetTime; // Timestamp when totalRagequitAmount resets
    
    // Events
    event Ragequit(address indexed user, uint256 daiAmount, uint256 feeAmount);
    event RagequitSettingsUpdated(uint256 newCooldown, uint256 newMaxAmount);
    
    /**
     * @dev Constructor is disabled in favor of initialize for upgradeable contracts
     */
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the contract with initial roles and parameters
     * @param admin Admin address
     * @param _assetDAO Asset DAO address
     * @param _daiToken D-AI token address
     * @param _feeCalculator Fee calculator address
     * @param _priceOracle Price oracle address
     * @param _ragequitCooldown Initial ragequit cooldown in seconds
     * @param _maxRagequitAmount Initial maximum ragequit amount (in basis points)
     */
    function initialize(
        address admin,
        address _assetDAO,
        address _daiToken,
        address _feeCalculator,
        address _priceOracle,
        uint256 _ragequitCooldown,
        uint256 _maxRagequitAmount
    ) external initializer {
        require(admin != address(0), "RagequitHandler: admin is zero address");
        require(_assetDAO != address(0), "RagequitHandler: asset DAO is zero address");
        require(_daiToken != address(0), "RagequitHandler: D-AI token is zero address");
        require(_feeCalculator != address(0), "RagequitHandler: fee calculator is zero address");
        require(_priceOracle != address(0), "RagequitHandler: price oracle is zero address");
        require(_maxRagequitAmount <= 10000, "RagequitHandler: max amount exceeds 100%");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        _grantRole(ASSET_DAO_ROLE, _assetDAO);
        
        assetDAO = AssetDAO(_assetDAO);
        daiToken = DAIToken(_daiToken);
        feeCalculator = FeeCalculator(_feeCalculator);
        priceOracle = IPriceOracle(_priceOracle);
        
        ragequitCooldown = _ragequitCooldown;
        maxRagequitAmount = _maxRagequitAmount;
        
        totalRagequitAmount = 0;
        ragequitResetTime = block.timestamp + 1 days;
    }
    
    /**
     * @dev Executes a ragequit (exit) operation
     * @param daiAmount Amount of D-AI tokens to burn
     * @param minValues Minimum acceptable values for each asset
     * @return success Whether the ragequit was successful
     */
    function ragequit(
        uint256 daiAmount,
        uint256[] calldata minValues
    ) external whenNotPaused nonReentrant returns (bool success) {
        require(daiAmount > 0, "RagequitHandler: amount must be greater than 0");
        require(
            block.timestamp > lastRagequitTime[msg.sender] + ragequitCooldown,
            "RagequitHandler: cooldown period not passed"
        );
        
        // Check if we need to reset the total ragequit amount
        if (block.timestamp >= ragequitResetTime) {
            totalRagequitAmount = 0;
            ragequitResetTime = block.timestamp + 1 days;
        }
        
        // Check maximum ragequit amount
        uint256 totalSupply = daiToken.totalSupply();
        require(
            totalRagequitAmount + daiAmount <= (totalSupply * maxRagequitAmount) / 10000,
            "RagequitHandler: exceeds maximum ragequit amount"
        );
        
        // Get all supported assets
        address[] memory assets = assetDAO.getAllAssets();
        require(minValues.length == assets.length, "RagequitHandler: minValues length mismatch");
        
        // Calculate pro-rata share for each asset
        uint256 totalFeeAmount = 0;
        uint256[] memory assetAmounts = new uint256[](assets.length);
        uint256[] memory feeAmounts = new uint256[](assets.length);
        
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            uint256 assetBalance = assetDAO.getAssetBalance(asset);
            
            // Calculate pro-rata share
            uint256 shareAmount = (assetBalance * daiAmount) / totalSupply;
            
            // Calculate fee
            uint256 feeAmount = feeCalculator.calculateRagequitFee(shareAmount);
            uint256 netAmount = shareAmount - feeAmount;
            
            // Ensure minimum value is met
            require(netAmount >= minValues[i], "RagequitHandler: below minimum value");
            
            assetAmounts[i] = netAmount;
            feeAmounts[i] = feeAmount;
            totalFeeAmount += feeAmount;
        }
        
        // Burn D-AI tokens
        daiToken.burnFrom(msg.sender, daiAmount);
        
        // Transfer assets to the user
        for (uint256 i = 0; i < assets.length; i++) {
            address asset = assets[i];
            
            if (assetAmounts[i] > 0) {
                // Transfer asset to user
                IERC20(asset).safeTransferFrom(
                    address(assetDAO),
                    msg.sender,
                    assetAmounts[i]
                );
                
                // Transfer fee to fee recipient
                if (feeAmounts[i] > 0) {
                    IERC20(asset).safeTransferFrom(
                        address(assetDAO),
                        feeCalculator.getFeeRecipient(),
                        feeAmounts[i]
                    );
                }
            }
        }
        
        // Update tracking
        lastRagequitTime[msg.sender] = block.timestamp;
        totalRagequitAmount += daiAmount;
        
        emit Ragequit(msg.sender, daiAmount, totalFeeAmount);
        
        return true;
    }
    
    /**
     * @dev Updates the ragequit settings
     * @param newCooldown New ragequit cooldown in seconds
     * @param newMaxAmount New maximum ragequit amount (in basis points)
     */
    function updateRagequitSettings(
        uint256 newCooldown,
        uint256 newMaxAmount
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(newMaxAmount <= 10000, "RagequitHandler: max amount exceeds 100%");
        
        ragequitCooldown = newCooldown;
        maxRagequitAmount = newMaxAmount;
        
        emit RagequitSettingsUpdated(newCooldown, newMaxAmount);
    }
    
    /**
     * @dev Updates the Asset DAO address
     * @param newAssetDAO New Asset DAO address
     */
    function updateAssetDAO(address newAssetDAO) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAssetDAO != address(0), "RagequitHandler: new asset DAO is zero address");
        
        _revokeRole(ASSET_DAO_ROLE, address(assetDAO));
        _grantRole(ASSET_DAO_ROLE, newAssetDAO);
        
        assetDAO = AssetDAO(newAssetDAO);
    }
    
    /**
     * @dev Pauses the handler
     */
    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the handler
     */
    function unpause() external onlyRole(GOVERNANCE_ROLE) {
        _unpause();
    }
}