// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IFeeCalculator {
    function calculateFee(uint256 amount, uint8 feeType) external view returns (uint256);
}

interface ITreasury {
    function collectFee(address token, uint256 amount, uint8 feeType) external;
}

/**
 * @title FeeCollector
 * @dev Collects fees from Asset DAO operations and forwards them to the Treasury
 */
contract FeeCollector is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ASSET_DAO_ROLE = keccak256("ASSET_DAO_ROLE");
    
    // Contract references
    address public feeCalculator;
    address public treasury;
    
    // Fee types
    uint8 public constant INVEST_FEE = 0;
    uint8 public constant DIVEST_FEE = 1;
    uint8 public constant RAGEQUIT_FEE = 2;
    
    // Events
    event FeeProcessed(address token, uint256 amount, uint256 fee, uint8 feeType);
    event FeeCalculatorUpdated(address newFeeCalculator);
    event TreasuryUpdated(address newTreasury);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param assetDAO Asset DAO address
     * @param _feeCalculator Fee calculator address
     * @param _treasury Treasury address
     */
    constructor(
        address admin,
        address assetDAO,
        address _feeCalculator,
        address _treasury
    ) {
        require(admin != address(0), "FeeCollector: admin is zero address");
        require(assetDAO != address(0), "FeeCollector: assetDAO is zero address");
        require(_feeCalculator != address(0), "FeeCollector: feeCalculator is zero address");
        require(_treasury != address(0), "FeeCollector: treasury is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ASSET_DAO_ROLE, assetDAO);
        
        feeCalculator = _feeCalculator;
        treasury = _treasury;
    }
    
    /**
     * @dev Process a fee for an invest operation
     * @param token Token address
     * @param amount Total amount being invested
     * @return feeAmount The fee amount collected
     */
    function processInvestFee(
        address token,
        uint256 amount
    ) external whenNotPaused onlyRole(ASSET_DAO_ROLE) nonReentrant returns (uint256 feeAmount) {
        return _processFee(token, amount, INVEST_FEE);
    }
    
    /**
     * @dev Process a fee for a divest operation
     * @param token Token address
     * @param amount Total amount being divested
     * @return feeAmount The fee amount collected
     */
    function processDivestFee(
        address token,
        uint256 amount
    ) external whenNotPaused onlyRole(ASSET_DAO_ROLE) nonReentrant returns (uint256 feeAmount) {
        return _processFee(token, amount, DIVEST_FEE);
    }
    
    /**
     * @dev Process a fee for a ragequit operation
     * @param token Token address
     * @param amount Total amount being rage quit
     * @return feeAmount The fee amount collected
     */
    function processRagequitFee(
        address token,
        uint256 amount
    ) external whenNotPaused onlyRole(ASSET_DAO_ROLE) nonReentrant returns (uint256 feeAmount) {
        return _processFee(token, amount, RAGEQUIT_FEE);
    }
    
    /**
     * @dev Internal function to process a fee
     * @param token Token address
     * @param amount Total amount
     * @param feeType Fee type (0: invest, 1: divest, 2: ragequit)
     * @return feeAmount The fee amount collected
     */
    function _processFee(
        address token,
        uint256 amount,
        uint8 feeType
    ) internal returns (uint256 feeAmount) {
        require(token != address(0), "FeeCollector: token is zero address");
        require(amount > 0, "FeeCollector: amount is zero");
        
        // Calculate fee amount
        feeAmount = IFeeCalculator(feeCalculator).calculateFee(amount, feeType);
        
        if (feeAmount > 0) {
            // Transfer tokens to this contract
            IERC20(token).safeTransferFrom(msg.sender, address(this), feeAmount);
            
            // Approve treasury to collect the fee
            IERC20(token).safeApprove(treasury, feeAmount);
            
            // Forward to treasury
            ITreasury(treasury).collectFee(token, feeAmount, feeType);
            
            emit FeeProcessed(token, amount, feeAmount, feeType);
        }
        
        return feeAmount;
    }
    
    /**
     * @dev Update fee calculator address
     * @param newFeeCalculator New fee calculator address
     */
    function updateFeeCalculator(address newFeeCalculator) external onlyRole(ADMIN_ROLE) {
        require(newFeeCalculator != address(0), "FeeCollector: new fee calculator is zero address");
        
        feeCalculator = newFeeCalculator;
        
        emit FeeCalculatorUpdated(newFeeCalculator);
    }
    
    /**
     * @dev Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        require(newTreasury != address(0), "FeeCollector: new treasury is zero address");
        
        treasury = newTreasury;
        
        emit TreasuryUpdated(newTreasury);
    }
    
    /**
     * @dev Add Asset DAO role to a new address
     * @param newAssetDAO New Asset DAO address
     */
    function addAssetDAORole(address newAssetDAO) external onlyRole(ADMIN_ROLE) {
        require(newAssetDAO != address(0), "FeeCollector: new Asset DAO is zero address");
        
        _grantRole(ASSET_DAO_ROLE, newAssetDAO);
    }
    
    /**
     * @dev Revoke Asset DAO role from an address
     * @param oldAssetDAO Old Asset DAO address
     */
    function revokeAssetDAORole(address oldAssetDAO) external onlyRole(ADMIN_ROLE) {
        _revokeRole(ASSET_DAO_ROLE, oldAssetDAO);
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Calculate fee for a given amount and fee type (view function)
     * @param amount Amount to calculate fee on
     * @param feeType Fee type (0: invest, 1: divest, 2: ragequit)
     * @return feeAmount The calculated fee amount
     */
    function calculateFee(
        uint256 amount,
        uint8 feeType
    ) external view returns (uint256 feeAmount) {
        return IFeeCalculator(feeCalculator).calculateFee(amount, feeType);
    }
}