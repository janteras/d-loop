// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/fees/IFeeSystem.sol";
import "../interfaces/tokens/IERC20.sol";
import "../interfaces/tokens/ITokenApprovalOptimizer.sol";
import "../utils/Errors.sol";

/**
 * @title FeeProcessor
 * @dev Processes fees collected from various operations in the DLOOP protocol
 * @notice This contract handles the collection and distribution of fees to Treasury and RewardDistributor
 */
contract FeeProcessor is AccessControl, ITokenApprovalOptimizer {
    // Role constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUTHORIZED_CONTRACT_ROLE = keccak256("AUTHORIZED_CONTRACT_ROLE");
    // Distribution percentages in basis points (100 = 1%, 10000 = 100%)
    uint256 public treasuryPercentage;     // 70% = 7000
    uint256 public rewardDistPercentage;   // 30% = 3000
    
    // Contract addresses
    address public owner;
    address public feeAdmin;
    address public treasury;
    address public rewardDistributor;
    
    // Fee calculator contract reference
    address public feeCalculator;
    
    // [TESTNET] Pausable state is disabled for Sepolia
    // bool public paused; // [TESTNET] Disabled

    // Events as defined in IFeeSystem
    event FeeCollected(
        string feeType,
        address indexed token,
        uint256 totalFee,
        uint256 treasuryFee,
        uint256 rewardFee
    );
    
    event DistributionParametersUpdated(
        uint256 oldTreasuryPercentage,
        uint256 oldRewardPercentage,
        uint256 newTreasuryPercentage,
        uint256 newRewardPercentage
    );
    
    // Token approval events
    event TokenApprovalOptimized(address indexed token, address indexed spender, uint256 amount, uint256 gasSaved);
    event TokenTransferExecuted(address indexed token, address indexed from, address indexed to, uint256 amount);
    
    /**
     * @dev Modifier to restrict access to owner
     */
    // [TESTNET] Only deployer is owner for Sepolia
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /**
     * @dev Modifier to restrict access to fee admin
     */
    // [TESTNET] Only deployer is feeAdmin for Sepolia
    modifier onlyFeeAdmin() {
        if (msg.sender != feeAdmin && msg.sender != owner) revert Unauthorized();
        _;
    }

    /**
     * @dev Modifier to check if the contract is not paused
     */

    /**
     * @dev Constructor to initialize the FeeProcessor contract
     * @param _treasury Address of the treasury contract
     * @param _rewardDistributor Address of the reward distributor contract
     * @param _feeCalculator Address of the fee calculator contract
     * @param _feeAdmin Address of the fee administrator
     * @param _treasuryPercentage Initial treasury percentage (in basis points)
     * @param _rewardDistPercentage Initial reward distributor percentage (in basis points)
     */
    constructor(
        address _treasury,
        address _rewardDistributor,
        address _feeCalculator,
        address _feeAdmin,
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    ) public {
        if (_treasury == address(0) ||
            _rewardDistributor == address(0) ||
            _feeCalculator == address(0) ||
            _feeAdmin == address(0)) revert ZeroAddress();
        
        if (_treasuryPercentage + _rewardDistPercentage != 10000) 
            revert InvalidDistributionPercentages();
        
        owner = msg.sender;
        feeAdmin = _feeAdmin;
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
        feeCalculator = _feeCalculator;
        
        treasuryPercentage = _treasuryPercentage;
        rewardDistPercentage = _rewardDistPercentage;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, _feeAdmin);
    }

    /**
     * @dev Collects investment fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectInvestFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256) {
        // Calculate the investment fee using the fee calculator
        IFeeSystem calculator = IFeeSystem(feeCalculator);
        uint256 totalFee = calculator.calculateInvestFee(amount);
        
        if (totalFee == 0) return 0;
        
        // Calculate distribution amounts
        uint256 treasuryFee = (totalFee * treasuryPercentage) / 10000;
        uint256 rewardFee = (totalFee * rewardDistPercentage) / 10000;
        
        // Perform the token transfers
        bool transferSuccess = _transferTokens(token, msg.sender, treasury, treasuryFee);
        if (!transferSuccess) revert TransferFailed();
        
        transferSuccess = _transferTokens(token, msg.sender, rewardDistributor, rewardFee);
        if (!transferSuccess) revert TransferFailed();
        
        // Emit fee collection event
        emit FeeCollected("Invest", token, totalFee, treasuryFee, rewardFee);
        
        return totalFee;
    }

    /**
     * @dev Collects divestment fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectDivestFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256) {
        // Calculate the divestment fee using the fee calculator
        IFeeSystem calculator = IFeeSystem(feeCalculator);
        uint256 totalFee = calculator.calculateDivestFee(amount);
        
        if (totalFee == 0) return 0;
        
        // Calculate distribution amounts
        uint256 treasuryFee = (totalFee * treasuryPercentage) / 10000;
        uint256 rewardFee = (totalFee * rewardDistPercentage) / 10000;
        
        // Perform the token transfers
        bool transferSuccess = _transferTokens(token, msg.sender, treasury, treasuryFee);
        if (!transferSuccess) revert TransferFailed();
        
        transferSuccess = _transferTokens(token, msg.sender, rewardDistributor, rewardFee);
        if (!transferSuccess) revert TransferFailed();
        
        // Emit fee collection event
        emit FeeCollected("Divest", token, totalFee, treasuryFee, rewardFee);
        
        return totalFee;
    }

    /**
     * @dev Collects ragequit fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectRagequitFee(address token, uint256 amount) external onlyRole(AUTHORIZED_CONTRACT_ROLE) returns (uint256) {
        // Calculate the ragequit fee using the fee calculator
        IFeeSystem calculator = IFeeSystem(feeCalculator);
        uint256 totalFee = calculator.calculateRagequitFee(amount);
        
        if (totalFee == 0) return 0;
        
        // Calculate distribution amounts
        uint256 treasuryFee = (totalFee * treasuryPercentage) / 10000;
        uint256 rewardFee = (totalFee * rewardDistPercentage) / 10000;
        
        // Perform the token transfers
        bool transferSuccess = _transferTokens(token, msg.sender, treasury, treasuryFee);
        if (!transferSuccess) revert TransferFailed();
        
        transferSuccess = _transferTokens(token, msg.sender, rewardDistributor, rewardFee);
        if (!transferSuccess) revert TransferFailed();
        
        // Emit fee collection event
        emit FeeCollected("Ragequit", token, totalFee, treasuryFee, rewardFee);
        
        return totalFee;
    }

    /**
     * @dev Internal function to handle token transfers
     * @param token Address of the token to transfer
     * @param from Address sending the tokens
     * @param to Address receiving the tokens
     * @param amount Amount of tokens to transfer
     * @return success Whether the transfer was successful
     */
    function _transferTokens(address token, address from, address to, uint256 amount) internal returns (bool) {
        try IERC20(token).transferFrom(from, to, amount) {
            return true;
        } catch (bytes memory) {
            return false;
        }
    }

    /**
     * @dev Updates the distribution percentages
     * @param _treasuryPercentage New treasury percentage (in basis points)
     * @param _rewardDistPercentage New reward distributor percentage (in basis points)
     */
    function updateDistributionPercentages(
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    ) external onlyFeeAdmin {
        if (_treasuryPercentage + _rewardDistPercentage != 10000)
            revert InvalidDistributionPercentages();
        
        uint256 oldTreasuryPercentage = treasuryPercentage;
        uint256 oldRewardDistPercentage = rewardDistPercentage;
        
        treasuryPercentage = _treasuryPercentage;
        rewardDistPercentage = _rewardDistPercentage;
        
        emit DistributionParametersUpdated(
            oldTreasuryPercentage,
            oldRewardDistPercentage,
            _treasuryPercentage,
            _rewardDistPercentage
        );
    }

    /**
     * @dev Updates the treasury address
     * @param _newTreasury Address of the new treasury
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        treasury = _newTreasury;
    }

    /**
     * @dev Updates the reward distributor address
     * @param _newRewardDistributor Address of the new reward distributor
     */
    function updateRewardDistributor(address _newRewardDistributor) external onlyOwner {
        if (_newRewardDistributor == address(0)) revert ZeroAddress();
        rewardDistributor = _newRewardDistributor;
    }

    /**
     * @dev Updates the fee calculator address
     * @param _newFeeCalculator Address of the new fee calculator
     */
    function updateFeeCalculator(address _newFeeCalculator) external onlyOwner {
        if (_newFeeCalculator == address(0)) revert ZeroAddress();
        feeCalculator = _newFeeCalculator;
    }

    /**
     * @dev Updates the fee admin address
     * @param _newFeeAdmin Address of the new fee administrator
     */
    function updateFeeAdmin(address _newFeeAdmin) external onlyOwner {
        if (_newFeeAdmin == address(0)) revert ZeroAddress();
        feeAdmin = _newFeeAdmin;
    }

    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        owner = _newOwner;
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
    }

    /**
     * @dev Gets the current distribution percentages
     * @return _treasuryPercentage The current treasury percentage (in basis points)
     * @return _rewardDistPercentage The current reward distributor percentage (in basis points)
     */
    function getDistributionPercentages() external view returns (
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    ) {
        return (treasuryPercentage, rewardDistPercentage);
    }

    /**
     * @dev Allow another address to spend tokens owned by this contract
     * @param token The token address to approve
     * @param spender The address to spend the tokens
     * @param amount The amount to approve
     * @return success Whether the approval was successful
     */
    function allowTokenTransfer(address token, address spender, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        returns (bool success)
    {
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Measure gas before
        uint256 gasBefore = gasleft();
        
        // Implement optimized approval directly
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        
        // If allowance is already set correctly, skip
        if (currentAllowance == amount) {
            return true;
        }
        
        // Reset to 0 first if needed to prevent front-running
        if (currentAllowance > 0 && amount > 0) {
            success = tokenContract.approve(spender, 0);
            if (!success) revert ApprovalFailed();
        }
        
        // Set to desired amount
        success = tokenContract.approve(spender, amount);
        
        // Calculate gas saved
        uint256 gasUsed = gasBefore - gasleft();
        uint256 standardGas = 46000; // Approximate gas for standard ERC20 approval
        uint256 gasSaved = gasUsed > standardGas ? 0 : standardGas - gasUsed;
        
        emit TokenApprovalOptimized(token, spender, amount, gasSaved);
        return success;
    }

    /**
     * @dev Allow multiple token transfers in one transaction
     * @param tokens Array of token addresses
     * @param spender The address to spend the tokens
     * @param amounts Array of amounts to approve
     * @return results Array of success flags
     */
    function batchAllowTokenTransfers(
        address[] calldata tokens,
        address spender,
        uint256[] calldata amounts
    ) external onlyRole(ADMIN_ROLE) returns (bool[] memory results) {
        if (tokens.length != amounts.length) revert InvalidArrayLength();
        if (spender == address(0)) revert ZeroAddress();
        
        // Convert addresses to IERC20 interfaces
        IERC20[] memory tokenContracts = new IERC20[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0)) revert ZeroAddress();
            tokenContracts[i] = IERC20(tokens[i]);
        }
        
        // Implement batch approval directly
        results = new bool[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            // Optimize each approval
            IERC20 token = tokenContracts[i];
            uint256 currentAllowance = token.allowance(address(this), spender);
            uint256 amount = amounts[i];
            
            // Skip if allowance is already correct
            if (currentAllowance == amount) {
                results[i] = true;
                continue;
            }
            
            // Reset to 0 first if needed
            if (currentAllowance > 0 && amount > 0) {
                bool resetSuccess = token.approve(spender, 0);
                if (!resetSuccess) {
                    results[i] = false;
                    continue;
                }
            }
            
            // Set to desired amount
            results[i] = token.approve(spender, amount);
        }
        
        return results;
    }

    /**
     * @dev Transfer tokens on behalf of another contract that approved FeeProcessor
     * @param token The token address
     * @param from The contract that approved this FeeProcessor
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function transferTokens(
        address token,
        address from,
        address to,
        uint256 amount
    )
        external
        onlyRole(ADMIN_ROLE)
        returns (bool)
    {
        if (token == address(0)) revert ZeroAddress();
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Check if we have approval
        uint256 allowance = IERC20(token).allowance(from, address(this));
        if (allowance < amount) revert InsufficientAllowance();
        
        // Transfer the tokens
        bool success = IERC20(token).transferFrom(from, to, amount);
        if (!success) revert TokenTransferFailed();
        
        emit TokenTransferExecuted(token, from, to, amount);
        
        return true;
    }

    /**
     * @dev Increase allowance of tokens with safeIncreaseAllowance pattern
     * @param token The token address
     * @param spender The spender address
     * @param addedValue The value to add to allowance
     * @return success Whether the increase was successful
     */
    function increaseTokenAllowance(
        address token,
        address spender,
        uint256 addedValue
    )
        external
        onlyRole(ADMIN_ROLE)
        returns (bool)
    {
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Implement safe increase allowance directly
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) revert MathOverflow();
        
        bool success = tokenContract.approve(spender, newAllowance);
        if (!success) revert ApprovalFailed();
        
        return success;
    }

    /**
     * @dev Decrease allowance of tokens with safeDecreaseAllowance pattern
     * @param token The token address
     * @param spender The spender address
     * @param subtractedValue The value to subtract from allowance
     * @return success Whether the decrease was successful
     */
    function decreaseTokenAllowance(
        address token,
        address spender,
        uint256 subtractedValue
    )
        external
        onlyRole(ADMIN_ROLE)
        returns (bool)
    {
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Implement safe decrease allowance directly
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        
        if (subtractedValue > currentAllowance) {
            revert InsufficientAllowance();
        }
        
        uint256 newAllowance = currentAllowance - subtractedValue;
        bool success = tokenContract.approve(spender, newAllowance);
        if (!success) revert ApprovalFailed();
        
        return success;
    }

    /**
     * @dev Grant role to a user
     * @param role The role to grant
     * @param account The account to grant the role to
     */
    function grantRole(bytes32 role, address account) public override(AccessControl) onlyRole(DEFAULT_ADMIN_ROLE) {
        super.grantRole(role, account);
    }

    /**
     * @dev Revoke role from a user
     * @param role The role to revoke
     * @param account The account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override(AccessControl) onlyRole(DEFAULT_ADMIN_ROLE) {
        super.revokeRole(role, account);
    }

    /**
     * @dev Implementation of optimizeApproval from ITokenApprovalOptimizer
     */
    function optimizeApproval(IERC20 token, address spender, uint256 amount) external override onlyRole(ADMIN_ROLE) returns (bool success) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        
        // If allowance is already set correctly, skip
        if (currentAllowance == amount) {
            return true;
        }
        
        // Reset to 0 first if needed to prevent front-running
        if (currentAllowance > 0 && amount > 0) {
            success = token.approve(spender, 0);
            if (!success) revert ApprovalFailed();
        }
        
        // Set to desired amount
        return token.approve(spender, amount);
    }

    /**
     * @dev Implementation of safeIncreaseAllowance from ITokenApprovalOptimizer
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 addedValue) external override onlyRole(ADMIN_ROLE) returns (bool success) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) revert MathOverflow();
        
        success = token.approve(spender, newAllowance);
        if (!success) revert ApprovalFailed();
        
        return success;
    }

    /**
     * @dev Implementation of safeDecreaseAllowance from ITokenApprovalOptimizer
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 subtractedValue) external override onlyRole(ADMIN_ROLE) returns (bool success) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 currentAllowance = token.allowance(address(this), spender);
        
        if (subtractedValue > currentAllowance) {
            revert InsufficientAllowance();
        }
        
        success = token.approve(spender, currentAllowance - subtractedValue);
        if (!success) revert ApprovalFailed();
        
        return success;
    }

    /**
     * @dev Implementation of batchApprove from ITokenApprovalOptimizer
     */
    function batchApprove(IERC20[] memory tokens, address spender, uint256[] memory amounts) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
        returns (bool[] memory results) 
    {
        if (tokens.length != amounts.length) revert InvalidArrayLength();
        if (spender == address(0)) revert ZeroAddress();
        
        results = new bool[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (address(tokens[i]) == address(0)) revert ZeroAddress();
            
            // Optimize each approval
            uint256 currentAllowance = tokens[i].allowance(address(this), spender);
            uint256 amount = amounts[i];
            
            // Skip if allowance is already correct
            if (currentAllowance == amount) {
                results[i] = true;
                continue;
            }
            
            // Reset to 0 first if needed
            if (currentAllowance > 0 && amount > 0) {
                bool resetSuccess = tokens[i].approve(spender, 0);
                if (!resetSuccess) {
                    results[i] = false;
                    continue;
                }
            }
            
            // Set to desired amount
            results[i] = tokens[i].approve(spender, amount);
        }
        
        return results;
    }

    /**
     * @dev Implementation of singleTransactionApprove from ITokenApprovalOptimizer
     */
    function singleTransactionApprove(IERC20 token, address spender, uint256 amount) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
        returns (bool success) 
    {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Approve the exact amount
        success = token.approve(spender, amount);
        if (!success) revert ApprovalFailed();
        
        return success;
    }

    /**
     * @dev Implementation of clearApproval from ITokenApprovalOptimizer
     */
    function clearApproval(IERC20 token, address spender) 
        external 
        override 
        onlyRole(ADMIN_ROLE) 
        returns (bool success) 
    {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Set allowance to 0
        success = token.approve(spender, 0);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
}
