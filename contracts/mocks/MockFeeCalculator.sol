// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";
import "../../contracts/interfaces/fees/IFeeCalculator.sol";

/**
 * @title MockFeeCalculator
 * @dev Mock implementation of the FeeCalculator contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockFeeCalculator is AccessControl, BaseMock, IFeeCalculator {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    
    // Fee percentages in basis points (1/100 of 1%)
    uint256 public investFeePercentage; // 10% = 1000
    uint256 public divestFeePercentage; // 5% = 500
    uint256 public ragequitFeePercentage; // 20% = 2000
    
    // Treasury and reward distributor addresses
    address public treasury;
    address public rewardDistributor;
    
    // Constants
    uint256 public constant MAX_FEE_PERCENTAGE = 5000; // 50%
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Events
    event FeeCalculated(
        string feeType,
        uint256 amount,
        uint256 feePercentage,
        uint256 feeAmount
    );
    event FeePercentageChanged(
        string feeType,
        uint256 oldPercentage,
        uint256 newPercentage
    );
    
    /**
     * @dev Constructor
     * @param _feeAdmin Address with fee management permissions
     * @param _treasury Treasury address
     * @param _rewardDistributor Reward distributor address
     * @param _investFeePercentage Investment fee percentage (basis points)
     * @param _divestFeePercentage Divestment fee percentage (basis points)
     * @param _ragequitFeePercentage Ragequit fee percentage (basis points)
     */
    constructor(
        address _feeAdmin,
        address _treasury,
        address _rewardDistributor,
        uint256 _investFeePercentage,
        uint256 _divestFeePercentage,
        uint256 _ragequitFeePercentage
    ) BaseMock() {
        // Validate addresses
        if (_feeAdmin == address(0) || _treasury == address(0) || _rewardDistributor == address(0)) {
            revert ZeroAddress();
        }
        
        // Validate fee percentages
        if (_investFeePercentage > MAX_FEE_PERCENTAGE ||
            _divestFeePercentage > MAX_FEE_PERCENTAGE ||
            _ragequitFeePercentage > MAX_FEE_PERCENTAGE) {
            revert ExcessiveFeeSetting();
        }
        
        // Set fee percentages
        investFeePercentage = _investFeePercentage;
        divestFeePercentage = _divestFeePercentage;
        ragequitFeePercentage = _ragequitFeePercentage;
        
        // Set addresses
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
        
        // Grant roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(FEE_MANAGER_ROLE, _feeAdmin);
    }
    
    /**
     * @dev Calculate investment fee
     * @param amount Amount to calculate fee for
     * @return feeAmount Fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateInvestFee(uint256 amount) public view returns (uint256 feeAmount) {
        feeAmount = (amount * investFeePercentage) / BASIS_POINTS;
        return feeAmount;
    }
    
    /**
     * @dev Calculate divestment fee
     * @param amount Amount to calculate fee for
     * @return feeAmount Fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateDivestFee(uint256 amount) public view returns (uint256 feeAmount) {
        feeAmount = (amount * divestFeePercentage) / BASIS_POINTS;
        return feeAmount;
    }
    
    /**
     * @dev Calculate ragequit fee
     * @param amount Amount to calculate fee for
     * @return feeAmount Fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateRagequitFee(uint256 amount) public view returns (uint256 feeAmount) {
        feeAmount = (amount * ragequitFeePercentage) / BASIS_POINTS;
        return feeAmount;
    }
    
    /**
     * @dev Set investment fee percentage
     * @param percentage New percentage in basis points
     */
    function setInvestFeePercentage(uint256 percentage) external onlyRole(FEE_MANAGER_ROLE) {
        _recordFunctionCall(
            "setInvestFeePercentage",
            abi.encode(percentage)
        );
        if (percentage > MAX_FEE_PERCENTAGE) {
            revert ExcessiveFeeSetting();
        }
        
        uint256 oldPercentage = investFeePercentage;
        investFeePercentage = percentage;
        
        emit FeePercentageChanged("INVEST", oldPercentage, percentage);
    }
    
    /**
     * @dev Set divestment fee percentage
     * @param percentage New percentage in basis points
     */
    function setDivestFeePercentage(uint256 percentage) external onlyRole(FEE_MANAGER_ROLE) {
        _recordFunctionCall(
            "setDivestFeePercentage",
            abi.encode(percentage)
        );
        if (percentage > MAX_FEE_PERCENTAGE) {
            revert ExcessiveFeeSetting();
        }
        
        uint256 oldPercentage = divestFeePercentage;
        divestFeePercentage = percentage;
        
        emit FeePercentageChanged("DIVEST", oldPercentage, percentage);
    }
    
    /**
     * @dev Set ragequit fee percentage
     * @param percentage New percentage in basis points
     */
    function setRagequitFeePercentage(uint256 percentage) external onlyRole(FEE_MANAGER_ROLE) {
        _recordFunctionCall(
            "setRagequitFeePercentage",
            abi.encode(percentage)
        );
        if (percentage > MAX_FEE_PERCENTAGE) {
            revert ExcessiveFeeSetting();
        }
        
        uint256 oldPercentage = ragequitFeePercentage;
        ragequitFeePercentage = percentage;
        
        emit FeePercentageChanged("RAGEQUIT", oldPercentage, percentage);
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
        if (_treasury == address(0)) {
            revert ZeroAddress();
        }
        
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
        if (_rewardDistributor == address(0)) {
            revert ZeroAddress();
        }
        
        rewardDistributor = _rewardDistributor;
    }
    
    /**
     * @dev Calculate investment fee for a given amount
     * @param _amount Amount to calculate fee for
     * @return feeAmount The calculated fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateInvestmentFee(uint256 _amount) external view returns (uint256 feeAmount) {
        feeAmount = (_amount * investFeePercentage) / BASIS_POINTS;
        return feeAmount;
    }
    
    /**
     * @dev Calculate divestment fee for a given amount
     * @param _amount Amount to calculate fee for
     * @return feeAmount The calculated fee amount
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function calculateDivestmentFee(uint256 _amount) external view returns (uint256 feeAmount) {
        feeAmount = (_amount * divestFeePercentage) / BASIS_POINTS;
        return feeAmount;
    }
}