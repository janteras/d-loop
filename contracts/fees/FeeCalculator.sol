// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IFeeSystem } from "../interfaces/fees/IFeeSystem.sol";
import "../utils/Errors.sol";
import { TokenApprovalOptimizer } from "../utils/TokenApprovalOptimizer.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FeeCalculator
 * @dev Calculates fees for various operations in the DLOOP protocol
 * @notice This contract implements the fee calculation logic for investment, 
 * divestment, and ragequit operations with enhanced security and proper authorization
 */
contract FeeCalculator is IFeeSystem, AccessControl, ReentrancyGuard {
    // State variables
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");
    bytes32 public constant PARAMETER_SETTER_ROLE = keccak256("PARAMETER_SETTER_ROLE");
    uint256 public investFeePercentage;    // 10% = 1000
    uint256 public divestFeePercentage;    // 5% = 500
    uint256 public ragequitFeePercentage;  // 0.4% = 40 (0.3% standard + 0.1% emergency)
    address public owner;
    address public feeAdmin;
    address public treasury;
    address public rewardDistributor;
    TokenApprovalOptimizer public approvalOptimizer;
    bool public useApprovalOptimization;
    uint256 public treasuryPercentage;     // 70% = 7000
    uint256 public rewardDistPercentage;   // 30% = 3000
    // All state variables grouped for clarity.
    // [TESTNET] Timelock for parameter changes is DISABLED for Sepolia
    // uint256 public constant PARAMETER_CHANGE_DELAY = 2 days;
    // mapping(bytes32 => uint256) public parameterChangeRequests; // [TESTNET] Disabled

    
    // Events
    event FeeAdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RewardDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DistributionPercentagesUpdated(uint256 treasuryPercentage, uint256 rewardDistPercentage);
    event ApprovalOptimizationToggled(bool enabled);
    event ApprovalOptimizerSet(address indexed optimizer);
    // All events grouped for clarity.
    // [TESTNET] Parameter change events are disabled for Sepolia
    // event ParameterChangeRequested(bytes32 indexed operationId, string parameterType, uint256 newValue, uint256 executionTime);
    // event ParameterChangeExecuted(bytes32 indexed operationId, string parameterType, uint256 oldValue, uint256 newValue);
    // event ParameterChangeCancelled(bytes32 indexed operationId);
    
    // Modifiers
    // [TESTNET] Only deployer is owner/admin for Sepolia
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    // [TESTNET] Only deployer is feeAdmin for Sepolia
    modifier onlyFeeAdmin() {
        if (msg.sender != feeAdmin && msg.sender != owner) revert Unauthorized();
        _;
    }
    // Modifiers grouped after events.
    
    /**
     * @dev Modifier to require a valid token transfer destination
     */
    modifier validDestination(address destination) {
        if (destination == address(0) || destination == address(this)) 
            revert InvalidDestination();
        _;
    }
    
    /**
     * @dev Constructor to initialize the FeeCalculator contract
     * @param _feeAdmin Address of the fee administrator
     * @param _treasury Address of the treasury contract
     * @param _rewardDistributor Address of the reward distributor contract
     * @param _investFeePercentage Initial investment fee percentage (in basis points)
     * @param _divestFeePercentage Initial divestment fee percentage (in basis points)
     * @param _ragequitFeePercentage Initial ragequit fee percentage (in basis points)
     */
    constructor(
        address _feeAdmin,
        address _treasury,
        address _rewardDistributor,
        uint256 _investFeePercentage,
        uint256 _divestFeePercentage,
        uint256 _ragequitFeePercentage
    ) {
        if (_feeAdmin == address(0) || 
            _treasury == address(0) || 
            _rewardDistributor == address(0)) revert ZeroAddress();
            
        if (_investFeePercentage > 10000 || 
            _divestFeePercentage > 10000 || 
            _ragequitFeePercentage > 10000) revert InvalidFeePercentage();
        
        // Legacy role setup
        owner = msg.sender;
        feeAdmin = _feeAdmin;
        
        // AccessControl role setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_ADMIN_ROLE, _feeAdmin);
        
        // If feeAdmin is not the owner, ensure owner has fee admin role too
        if (_feeAdmin != msg.sender) {
            _grantRole(FEE_ADMIN_ROLE, msg.sender);
        }
        
        // Fee collector role for treasury and reward distributor
        _grantRole(FEE_COLLECTOR_ROLE, _treasury);
        _grantRole(FEE_COLLECTOR_ROLE, _rewardDistributor);
        
        // Parameter setter role
        _grantRole(PARAMETER_SETTER_ROLE, msg.sender);
        _grantRole(PARAMETER_SETTER_ROLE, _feeAdmin);
        
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
        
        investFeePercentage = _investFeePercentage;
        divestFeePercentage = _divestFeePercentage;
        ragequitFeePercentage = _ragequitFeePercentage;
        
        // Default distribution: 70% to treasury, 30% to rewards
        treasuryPercentage = 7000;
        rewardDistPercentage = 3000;
        
        // Default to standard ERC20 approvals
        useApprovalOptimization = false;
    }
    
    /**
     * @dev Calculates the fee for investment operations
     * @param amount Amount on which to calculate the fee
     * @return feeAmount The calculated fee amount
     */
    function calculateInvestFee(uint256 amount) external view override returns (uint256) {
        return (amount * investFeePercentage) / 10000;
    }
    
    /**
     * @dev Calculates the fee for divestment operations
     * @param amount Amount on which to calculate the fee
     * @return feeAmount The calculated fee amount
     */
    function calculateDivestFee(uint256 amount) external view override returns (uint256) {
        return (amount * divestFeePercentage) / 10000;
    }
    
    /**
     * @dev Calculates the fee for ragequit operations
     * @param amount Amount on which to calculate the fee
     * @return feeAmount The calculated fee amount
     */
    function calculateRagequitFee(uint256 amount) external view override returns (uint256) {
        return (amount * ragequitFeePercentage) / 10000;
    }
    
    /**
     * @dev Sets up the approval optimizer to be used for token transfers
     * @param _optimizer Address of the TokenApprovalOptimizer contract
     */
    function setApprovalOptimizer(address _optimizer) external onlyOwner {
        if (_optimizer == address(0)) revert ZeroAddress();
        approvalOptimizer = TokenApprovalOptimizer(_optimizer);
        emit ApprovalOptimizerSet(_optimizer);
    }
    
    /**
     * @dev Toggles whether to use the approval optimizer for token transfers
     * @param _useOptimization Whether to use optimized approvals
     */
    function toggleApprovalOptimization(bool _useOptimization) external onlyFeeAdmin {
        useApprovalOptimization = _useOptimization;
        emit ApprovalOptimizationToggled(_useOptimization);
    }
    
    /**
     * @dev Processes an investment fee with enhanced security and token transfer handling
     * @param amount Amount of the investment
     * @return feeAmount The fee amount processed
     */
    function processInvestFee(uint256, address, uint256 amount) external override nonReentrant returns (uint256) {
        // Calculate the fee - use direct division for gas optimization
        uint256 feeAmount = amount * investFeePercentage / 10000;
        
        // Gas optimization: Early return for zero fees
        if (feeAmount == 0) return 0;
        
        // Get the token from the caller
        address token = msg.sender; // Token contract calls this function
        
        // Enhanced security: caller must have fee collector role or be using an approved path
        _validateFeeProcessor(token);
        
        // Calculate distribution amounts - cache calculations to avoid multiple divisions
        uint256 treasuryFee = feeAmount * treasuryPercentage / 10000;
        uint256 rewardFee = feeAmount * rewardDistPercentage / 10000;
        
        // Process token transfers
        _processTokenTransfers(token, feeAmount, treasuryFee, rewardFee);
        
        // Emit fee collection event
        emit FeeCollected("Invest", token, feeAmount, treasuryFee, rewardFee);
        
        return feeAmount;
    }
    
    /**
     * @dev Processes a divestment fee with enhanced security and token transfer handling
     * @param amount Amount of the divestment
     * @return feeAmount The fee amount processed
     */
    function processDivestFee(uint256, address, uint256 amount) external override nonReentrant returns (uint256) {
        // Calculate the fee - use direct division for gas optimization
        uint256 feeAmount = amount * divestFeePercentage / 10000;
        
        // Gas optimization: Early return for zero fees
        if (feeAmount == 0) return 0;
        
        // Get the token from the caller
        address token = msg.sender; // Token contract calls this function
        
        // Enhanced security: caller must have fee collector role or be using an approved path
        _validateFeeProcessor(token);
        
        // Calculate distribution amounts - cache calculations to avoid multiple divisions
        uint256 treasuryFee = feeAmount * treasuryPercentage / 10000;
        uint256 rewardFee = feeAmount * rewardDistPercentage / 10000;
        
        // Process token transfers
        _processTokenTransfers(token, feeAmount, treasuryFee, rewardFee);
        
        // Emit fee collection event
        emit FeeCollected("Divest", token, feeAmount, treasuryFee, rewardFee);
        
        return feeAmount;
    }
    
    /**
     * @dev Processes a ragequit fee with enhanced security and token transfer handling
     * @param amount Amount of the ragequit
     * @return feeAmount The fee amount processed
     */
    function processRagequitFee(uint256, address, uint256 amount) external override nonReentrant returns (uint256) {
        // Calculate the fee - use direct division for gas optimization
        uint256 feeAmount = amount * ragequitFeePercentage / 10000;
        
        // Gas optimization: Early return for zero fees
        if (feeAmount == 0) return 0;
        
        // Get the token from the caller
        address token = msg.sender; // Token contract calls this function
        
        // Enhanced security: caller must have fee collector role or be using an approved path
        _validateFeeProcessor(token);
        
        // Calculate distribution amounts - cache calculations to avoid multiple divisions
        uint256 treasuryFee = feeAmount * treasuryPercentage / 10000;
        uint256 rewardFee = feeAmount * rewardDistPercentage / 10000;
        
        // Process token transfers
        _processTokenTransfers(token, feeAmount, treasuryFee, rewardFee);
        
        // Emit fee collection event
        emit FeeCollected("Ragequit", token, feeAmount, treasuryFee, rewardFee);
        
        return feeAmount;
    }
    
    /**
     * @dev Requests a parameter change with timelock for security
     * @param parameterType Type of parameter being changed
     * @param newValue New value for the parameter
     */
    // [TESTNET] Timelock-based parameter changes are DISABLED for Sepolia
    // function requestParameterChange(string memory parameterType, uint256 newValue) external onlyFeeAdmin {
    //     // Disabled for testnet: parameter changes are immediate
    // }

    
    /**
     * @dev Executes a previously requested parameter change
     * @param operationId ID of the parameter change operation
     * @param parameterType Type of parameter being changed
     * @param newValue New value for the parameter
     */
    // [TESTNET] Timelock-based parameter execution is DISABLED for Sepolia
    // function executeParameterChange(bytes32 operationId, string memory parameterType, uint256 newValue) external onlyFeeAdmin {
    //     // Disabled for testnet
    // }


    

    /**
     * @dev Legacy direct update of investment fee percentage (admin can use for emergencies)
     * @param _newPercentage New investment fee percentage (in basis points)
     */
    function updateInvestFeePercentage(uint256 _newPercentage) external onlyFeeAdmin {
        if (_newPercentage > 10000) revert InvalidFeePercentage();
        
        uint256 oldPercentage = investFeePercentage;
        investFeePercentage = _newPercentage;
        
        emit FeeParameterUpdated("Invest", oldPercentage, _newPercentage);
    }
    
    /**
     * @dev Legacy direct update of divestment fee percentage (admin can use for emergencies)
     * @param _newPercentage New divestment fee percentage (in basis points)
     */
    function updateDivestFeePercentage(uint256 _newPercentage) external onlyFeeAdmin {
        if (_newPercentage > 10000) revert InvalidFeePercentage();
        
        uint256 oldPercentage = divestFeePercentage;
        divestFeePercentage = _newPercentage;
        
        emit FeeParameterUpdated("Divest", oldPercentage, _newPercentage);
    }
    
    /**
     * @dev Legacy direct update of ragequit fee percentage (admin can use for emergencies)
     * @param _newPercentage New ragequit fee percentage (in basis points)
     */
    function updateRagequitFeePercentage(uint256 _newPercentage) external onlyFeeAdmin {
        if (_newPercentage > 10000) revert InvalidFeePercentage();
        
        uint256 oldPercentage = ragequitFeePercentage;
        ragequitFeePercentage = _newPercentage;
        
        emit FeeParameterUpdated("Ragequit", oldPercentage, _newPercentage);
    }
    
    /**
     * @dev Updates the fee distribution percentages with enhanced security
     * @param _treasuryPercentage New treasury percentage (in basis points)
     * @param _rewardDistPercentage New reward distributor percentage (in basis points)
     */
    function updateDistributionPercentages(
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    ) external onlyFeeAdmin {
        if (_treasuryPercentage + _rewardDistPercentage != 10000)
            revert InvalidDistributionPercentages();
        
        treasuryPercentage = _treasuryPercentage;
        rewardDistPercentage = _rewardDistPercentage;
        
        emit DistributionPercentagesUpdated(_treasuryPercentage, _rewardDistPercentage);
    }
    
    /**
     * @dev Updates the treasury address with proper role management
     * @param _newTreasury Address of the new treasury
     */
    function updateTreasury(address _newTreasury) external onlyOwner validDestination(_newTreasury) {
        if (_newTreasury == address(0)) revert ZeroAddress();
        
        address oldTreasury = treasury;
        treasury = _newTreasury;
        
        // Update roles
        _revokeRole(FEE_COLLECTOR_ROLE, oldTreasury);
        _grantRole(FEE_COLLECTOR_ROLE, _newTreasury);
        
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    /**
     * @dev Updates the reward distributor address with proper role management
     * @param _newRewardDistributor Address of the new reward distributor
     */
    function updateRewardDistributor(address _newRewardDistributor) external onlyOwner validDestination(_newRewardDistributor) {
        if (_newRewardDistributor == address(0)) revert ZeroAddress();
        
        address oldDistributor = rewardDistributor;
        rewardDistributor = _newRewardDistributor;
        
        // Update roles
        _revokeRole(FEE_COLLECTOR_ROLE, oldDistributor);
        _grantRole(FEE_COLLECTOR_ROLE, _newRewardDistributor);
        
        emit RewardDistributorUpdated(oldDistributor, _newRewardDistributor);
    }
    
    /**
     * @dev Updates the fee admin address with proper role management
     * @param _newFeeAdmin Address of the new fee administrator
     */
    function updateFeeAdmin(address _newFeeAdmin) external onlyOwner {
        if (_newFeeAdmin == address(0)) revert ZeroAddress();
        
        address oldFeeAdmin = feeAdmin;
        feeAdmin = _newFeeAdmin;
        
        // Update roles
        if (oldFeeAdmin != owner) {
            _revokeRole(FEE_ADMIN_ROLE, oldFeeAdmin);
            _revokeRole(PARAMETER_SETTER_ROLE, oldFeeAdmin);
        }
        
        _grantRole(FEE_ADMIN_ROLE, _newFeeAdmin);
        _grantRole(PARAMETER_SETTER_ROLE, _newFeeAdmin);
        
        emit FeeAdminUpdated(oldFeeAdmin, _newFeeAdmin);
    }
    
    /**
     * @dev Transfers ownership of the contract with proper role updates
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = owner;
        owner = _newOwner;
        
        // Update roles
        _revokeRole(DEFAULT_ADMIN_ROLE, oldOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        
        // Ensure new owner has fee admin role
        _grantRole(FEE_ADMIN_ROLE, _newOwner);
        _grantRole(PARAMETER_SETTER_ROLE, _newOwner);
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @dev Gets the investment fee percentage (in basis points)
     * @return feePercentage The investment fee percentage
     */
    function getInvestFeePercentage() external view override returns (uint256) {
        return investFeePercentage;
    }
    
    /**
     * @dev Gets the divestment fee percentage (in basis points)
     * @return feePercentage The divestment fee percentage
     */
    function getDivestFeePercentage() external view override returns (uint256) {
        return divestFeePercentage;
    }
    
    /**
     * @dev Gets the ragequit fee percentage (in basis points)
     * @return feePercentage The ragequit fee percentage
     */
    function getRagequitFeePercentage() external view override returns (uint256) {
        return ragequitFeePercentage;
    }
    
    /**
     * @dev Gets the distribution percentages
     * @return _treasuryPercentage Treasury percentage (in basis points)
     * @return _rewardDistPercentage Reward distributor percentage (in basis points)
     */
    function getDistributionPercentages() external view returns (
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    ) {
        return (treasuryPercentage, rewardDistPercentage);
    }
    
    /**
     * @dev Recovers stuck fees for a specific token and sends them to treasury
     * @param token Address of the token to recover fees for
     * @return recoveredAmount The amount of fees recovered
     */
    function recoverStuckFees(address token) external onlyFeeAdmin nonReentrant returns (uint256) {
        if (token == address(0)) revert ZeroAddress();
        
        IERC20 tokenContract = IERC20(token);
        uint256 balance = tokenContract.balanceOf(address(this));
        
        if (balance == 0) revert OperationFailed();
        
        // Store the balance amount before transfer to prevent reentrancy
        uint256 amountToRecover = balance;
        
        // Transfer tokens to treasury with enhanced security
        bool success;
        if (useApprovalOptimization && address(approvalOptimizer) != address(0)) {
            // Use the approval optimizer
            tokenContract.approve(address(approvalOptimizer), amountToRecover);
            success = approvalOptimizer.transferTokens(token, treasury, amountToRecover);
        } else {
            // Use direct transfer
            success = tokenContract.transfer(treasury, amountToRecover);
        }
        
        if (!success) revert OperationFailed();
        
        // Emit fee collection event with 100% to treasury
        emit FeeCollected("Recovery", token, amountToRecover, amountToRecover, 0);
        
        return amountToRecover;
    }
    
    /**
     * @dev Grant fee collector role to an address
     * @param account Address to grant the role to
     */
    function grantFeeCollectorRole(address account) external onlyOwner {
        _grantRole(FEE_COLLECTOR_ROLE, account);
    }
    
    /**
     * @dev Revoke fee collector role from an address
     * @param account Address to revoke the role from
     */
    function revokeFeeCollectorRole(address account) external onlyOwner {
        _revokeRole(FEE_COLLECTOR_ROLE, account);
    }
    
    /**
     * @dev Internal function to validate that the fee processor is authorized
     * @param token Address of the token being processed
     */
    function _validateFeeProcessor(address token) internal view {
        // Gas optimization: Combine conditions to reduce branching
        if (!hasRole(FEE_COLLECTOR_ROLE, msg.sender) && token != msg.sender) {
            revert Unauthorized();
        }
    }
    
    /**
     * @dev Internal function to process token transfers to treasury and reward distributor
     * @param token Address of the token being transferred
     * @param totalAmount Total amount of tokens to transfer
     * @param treasuryAmount Amount to send to the treasury
     * @param rewardAmount Amount to send to the reward distributor
     */
    function _processTokenTransfers(
        address token, 
        uint256 totalAmount, 
        uint256 treasuryAmount, 
        uint256 rewardAmount
    ) internal {
        IERC20 tokenContract = IERC20(token);
        
        // Ensure this contract has received the tokens
        // Use unchecked for gas optimization since totalAmount is calculated from treasuryAmount + rewardAmount
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (contractBalance < totalAmount) revert InsufficientBalance();
        
        // Gas optimization: Skip transfers for zero amounts
        bool success = true;
        
        if (useApprovalOptimization && address(approvalOptimizer) != address(0)) {
            // Gas optimization: Only approve the exact amount needed
            // Use a single approval for the total amount instead of multiple approvals
            tokenContract.approve(address(approvalOptimizer), totalAmount);
            
            // Execute transfers for non-zero amounts
            if (treasuryAmount > 0) {
                success = success && approvalOptimizer.transferTokens(token, treasury, treasuryAmount);
            }
            
            if (rewardAmount > 0) {
                success = success && approvalOptimizer.transferTokens(token, rewardDistributor, rewardAmount);
            }
        } else {
            // Use direct transfers for non-zero amounts
            if (treasuryAmount > 0) {
                success = success && tokenContract.transfer(treasury, treasuryAmount);
            }
            
            if (rewardAmount > 0) {
                success = success && tokenContract.transfer(rewardDistributor, rewardAmount);
            }
        }
        
        // Ensure transfers succeeded
        if (!success) revert OperationFailed();
    }
}