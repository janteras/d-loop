// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../utils/Errors.sol";
import "./MockFeeCalculator.sol";
import "./MockTreasury.sol";
import "./base/BaseMock.sol";
import "../../contracts/interfaces/fees/IFeeProcessor.sol";

/**
 * @title MockFeeProcessor
 * @dev Mock implementation of the FeeProcessor contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
abstract contract MockFeeProcessor is AccessControl, BaseMock, IFeeProcessor {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUTHORIZED_CONTRACT_ROLE = keccak256("AUTHORIZED_CONTRACT_ROLE");
    
    // Fee distribution percentages in basis points (1/100 of 1%)
    uint256 public treasuryPercentage; // 70% = 7000
    uint256 public rewardsPercentage; // 30% = 3000
    
    // Contract addresses
    address public treasury;
    address public rewardDistributor;
    address public feeCalculator;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Events
    event FeeCollected(
        address indexed token,
        uint256 amount,
        uint256 treasuryAmount,
        uint256 rewardsAmount,
        string feeType
    );
    
    /**
     * @dev Constructor
     * @param _treasury Treasury address
     * @param _rewardDistributor Reward distributor address
     * @param _feeCalculator Fee calculator address
     * @param _admin Admin address
     * @param _treasuryPercentage Treasury percentage (basis points)
     * @param _rewardsPercentage Rewards percentage (basis points)
     */
    constructor(
        address _treasury,
        address _rewardDistributor,
        address _feeCalculator,
        address _admin,
        uint256 _treasuryPercentage,
        uint256 _rewardsPercentage
    ) BaseMock() {
        // Validate addresses
        if (_treasury == address(0) ||
            _rewardDistributor == address(0) ||
            _feeCalculator == address(0) ||
            _admin == address(0)) {
            revert ZeroAddress();
        }
        
        // Validate percentages
        if (_treasuryPercentage + _rewardsPercentage != BASIS_POINTS) {
            revert InvalidDistributionPercentages();
        }
        
        // Set addresses
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
        feeCalculator = _feeCalculator;
        
        // Set percentages
        treasuryPercentage = _treasuryPercentage;
        rewardsPercentage = _rewardsPercentage;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, _admin);
    }
    
    /**
     * @dev Collect investment fee
     * @param token Token address
     * @param amount Amount to collect fee from
     * @return feeAmount Fee amount collected
     */
    function collectInvestFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256 feeAmount) {
        _recordFunctionCall(
            "collectInvestFee",
            abi.encode(token, amount)
        );
        // Calculate fee
        feeAmount = MockFeeCalculator(feeCalculator).calculateInvestFee(amount);
        
        // Process fee
        _processFee(token, feeAmount, "INVEST");
        
        return feeAmount;
    }
    
    /**
     * @dev Collect divestment fee
     * @param token Token address
     * @param amount Amount to collect fee from
     * @return feeAmount Fee amount collected
     */
    function collectDivestFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256 feeAmount) {
        _recordFunctionCall(
            "collectDivestFee",
            abi.encode(token, amount)
        );
        // Calculate fee
        feeAmount = MockFeeCalculator(feeCalculator).calculateDivestFee(amount);
        
        // Process fee
        _processFee(token, feeAmount, "DIVEST");
        
        return feeAmount;
    }
    
    /**
     * @dev Collect ragequit fee
     * @param token Token address
     * @param amount Amount to collect fee from
     * @return feeAmount Fee amount collected
     */
    function collectRagequitFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256 feeAmount) {
        _recordFunctionCall(
            "collectRagequitFee",
            abi.encode(token, amount)
        );
        // Calculate fee
        feeAmount = MockFeeCalculator(feeCalculator).calculateRagequitFee(amount);
        
        // Process fee
        _processFee(token, feeAmount, "RAGEQUIT");
        
        return feeAmount;
    }
    
    /**
     * @dev Process fee distribution
     * @param token Token address
     * @param amount Fee amount
     * @param feeType Fee type (INVEST, DIVEST, RAGEQUIT)
     */
    function _processFee(address token, uint256 amount, string memory feeType) internal {
        if (amount == 0) return;
        
        // Calculate treasury and rewards amounts
        uint256 treasuryAmount = (amount * treasuryPercentage) / BASIS_POINTS;
        uint256 rewardsAmount = amount - treasuryAmount;
        
        // Transfer fees
        if (treasuryAmount > 0) {
            bool success = IERC20(token).transferFrom(msg.sender, treasury, treasuryAmount);
            if (!success) revert TokenTransferFailed();
        }
        
        if (rewardsAmount > 0) {
            bool success = IERC20(token).transferFrom(msg.sender, rewardDistributor, rewardsAmount);
            if (!success) revert TokenTransferFailed();
        }
        
        // Emit event
        emit FeeCollected(token, amount, treasuryAmount, rewardsAmount, feeType);
    }
    
    /**
     * @dev Set treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setTreasury",
            abi.encode(_treasury)
        );
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }
    
    /**
     * @dev Set reward distributor address
     * @param _rewardDistributor New reward distributor address
     */
    function setRewardDistributor(address _rewardDistributor) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setRewardDistributor",
            abi.encode(_rewardDistributor)
        );
        if (_rewardDistributor == address(0)) revert ZeroAddress();
        rewardDistributor = _rewardDistributor;
    }
    
    /**
     * @dev Set fee calculator address
     * @param _feeCalculator New fee calculator address
     */
    function setFeeCalculator(address _feeCalculator) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setFeeCalculator",
            abi.encode(_feeCalculator)
        );
        if (_feeCalculator == address(0)) revert ZeroAddress();
        feeCalculator = _feeCalculator;
    }
    
    /**
     * @dev Set fee distribution percentages
     * @param _treasuryPercentage New treasury percentage (basis points)
     * @param _rewardsPercentage New rewards percentage (basis points)
     */
    function setDistributionPercentages(
        uint256 _treasuryPercentage,
        uint256 _rewardsPercentage
    ) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setDistributionPercentages",
            abi.encode(_treasuryPercentage, _rewardsPercentage)
        );
        if (_treasuryPercentage + _rewardsPercentage != BASIS_POINTS) {
            revert InvalidDistributionPercentages();
        }
        
        treasuryPercentage = _treasuryPercentage;
        rewardsPercentage = _rewardsPercentage;
    }
    
    /**
     * @dev Process fees for a given amount
     * @param amount Amount to process fees for
     * @return feeAmount The calculated fee amount
     */
    function processFees(uint256 amount) external returns (uint256 feeAmount) {
        _recordFunctionCall(
            "processFees",
            abi.encode(amount)
        );
        
        // Mock implementation - return 10% as fee
        feeAmount = amount / 10;
        
        emit FeeCollected(
            address(0), // No specific token in this case
            amount,
            (feeAmount * treasuryPercentage) / BASIS_POINTS,
            (feeAmount * rewardsPercentage) / BASIS_POINTS,
            "Standard"
        );
        
        return feeAmount;
    }
    
    /**
     * @dev Get the current fee rate
     * @return The fee rate in basis points
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getFeeRate() external view returns (uint256) {
        // Mock implementation - return 10% (1000 basis points)
        return 1000;
    }
    
    /**
     * @dev Calculate fees for a given amount
     * @param amount Amount to calculate fees for
     * @return feeAmount The calculated fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateFees(uint256 amount) external view returns (uint256 feeAmount) {
        // Mock implementation - return 10% as fee
        return amount / 10;
    }
}