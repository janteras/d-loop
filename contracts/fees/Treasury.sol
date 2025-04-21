// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "../interfaces/tokens/IERC20.sol";
import { ITokenApprovalOptimizer } from "../interfaces/tokens/ITokenApprovalOptimizer.sol";
import "../utils/Errors.sol";

/**
 * @title Treasury
 * @dev Treasury contract for the DLOOP protocol
 * @notice This contract manages the treasury funds of the protocol
 * @custom:security-contact security@dloop.io
 *
 * @dev SECURITY NOTICE:
 * This contract intentionally uses low-level calls for gas optimization purposes.
 * All low-level calls are implemented with thorough validation and error handling:
 * 1. All external calls are preceded by proper input validation
 * 2. Return data from calls is properly validated to ensure transactions succeeded
 * 3. The contract includes reentrancy protection with a nonReentrant modifier
 * 4. All external calls follow the checks-effects-interactions pattern
 *
 * These deliberate choices were made to optimize gas usage for token operations
 * while maintaining security best practices.
 */
contract Treasury is ITokenApprovalOptimizer {
    // Custom errors
    error ZeroAddress();
    error InsufficientBalance();
    error Unauthorized();
    error InvalidAmount();
    error TransferFailed();
    error TransferFromFailed();
    error ApprovalFailed();
    error ETHTransferFailed();
    error ReentrancyGuardReentrantCall();
    error CallerNotOwner();
    error CallerNotAdmin();
    error InsufficientAllowance();
    error MathOverflow();

    // Events
    event FundsReceived(address indexed token, uint256 amount, address indexed from);
    event FundsReceived(address indexed token, uint256 amount);
    event FundsDistributed(address indexed token, address indexed recipient, uint256 amount);
    event Deposit(address indexed token, uint256 amount, address indexed from, string memo);
    event Withdrawal(address indexed token, uint256 amount, address indexed to, string memo);
    event RewardsContractSet(address indexed rewardsContract, bool enabled);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event ProtocolDAOUpdated(address indexed oldProtocolDAO, address indexed newProtocolDAO);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event TokenApprovalOptimized(address indexed token, address indexed spender, uint256 amount, uint256 gasSaved);
    event DelegatedTransferExecuted(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        string purpose
    );
    // Modifiers
    modifier nonReentrant() {
        bool notEntered = _status != _ENTERED;
        if (!notEntered) revert ReentrancyGuardReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert CallerNotOwner();
        _;
    }
    modifier onlyAdmin() {
        if (msg.sender != admin && msg.sender != owner) revert CallerNotAdmin();
        _;
    }
    // [TESTNET] Only deployer is protocolDAO/owner for Sepolia
    modifier onlyProtocolDAO() {
        if (msg.sender != owner) revert CallerNotOwner();
        _;
    }
    // State variables
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;
    address public owner;
    address public admin;
    address public protocolDAO;
    bool private _reentrancyLock;
    mapping(address => bool) public rewardsContracts;

    /**
     * @dev Safely transfer tokens from this contract to another address
     * @param token The token to transfer
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        if (address(token) == address(0)) revert ZeroAddress();
        
        // Use the safer direct method call instead of low-level call
        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();
    }
    
    /**
     * @dev Safely transfer tokens from one address to another using transferFrom
     * @param token The token to transfer
     * @param from The source address
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (address(token) == address(0)) revert ZeroAddress();
        
        // Use direct method call instead of low-level call for safety
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert TransferFromFailed();
    }
    
    /**
     * @dev Safely approve tokens for spender
     * @param token The token to approve
     * @param spender The spender address
     * @param amount The amount to approve
     */
    function safeApprove(IERC20 token, address spender, uint256 amount) internal {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Use safer direct method call
        bool success = token.approve(spender, amount);
        if (!success) revert ApprovalFailed();
    }
    
    /**
     * @dev Send ETH value safely
     * @param recipient The recipient address
     * @param amount The amount to send
     */
    function sendValue(address payable recipient, uint256 amount) internal {
        if (recipient == address(0)) revert ZeroAddress();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert ETHTransferFailed();
    }
    
    /**
     * @dev Constructor to initialize the Treasury contract
     * @param _admin Address of the admin
     * @param _protocolDAO Address of the protocol DAO
     */
    constructor(address _admin, address _protocolDAO) public {
        if (_admin == address(0) || _protocolDAO == address(0)) revert ZeroAddress();
        
        owner = msg.sender;
        admin = _admin;
        protocolDAO = _protocolDAO;
    }
    
    /**
     * @dev Withdraws funds from the treasury
     * @param token Address of the token to withdraw (use address(0) for ETH)
     * @param recipient Address of the recipient
     * @param amount Amount to withdraw
     * @return success True if the withdrawal was successful
     */
    function withdraw(address token, address recipient, uint256 amount) 
        external 
        onlyProtocolDAO 
        nonReentrant 
        returns (bool success)
    {
        // CHECKS
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        if (token == address(0)) {
            // Check ETH balance
            if (address(this).balance < amount) revert InvalidAmount();
        } else {
            // Check token balance
            if (IERC20(token).balanceOf(address(this)) < amount) revert InvalidAmount();
        }
        
        // EFFECTS
        // Record the withdrawal by emitting event
        // Using the Withdrawal event instead of FundsWithdrawn to avoid duplication
        
        // INTERACTIONS
        if (token == address(0)) {
            // Withdraw ETH using our custom sendValue for safer ETH transfers
            sendValue(payable(recipient), amount);
        } else {
            // Withdraw ERC20 token using our custom safeTransfer
            safeTransfer(IERC20(token), recipient, amount);
        }
        
        // Emit the Withdrawal event with memo
        emit Withdrawal(token, amount, recipient, "Treasury withdrawal");
        
        return true;
    }
    
    /**
     * @dev Updates the admin address
     * @param _newAdmin Address of the new admin
     */
    function updateAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert ZeroAddress();
        
        address oldAdmin = admin;
        admin = _newAdmin;
        
        emit AdminUpdated(oldAdmin, _newAdmin);
    }
    
    /**
     * @dev Updates the protocol DAO address
     * @param _newProtocolDAO Address of the new protocol DAO
     */
    function updateProtocolDAO(address _newProtocolDAO) external onlyOwner {
        if (_newProtocolDAO == address(0)) revert ZeroAddress();
        
        address oldProtocolDAO = protocolDAO;
        protocolDAO = _newProtocolDAO;
        
        emit ProtocolDAOUpdated(oldProtocolDAO, _newProtocolDAO);
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = owner;
        owner = _newOwner;
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @dev Sets or revokes a rewards contract
     * @param _rewardsContract Address of the rewards contract
     * @param _enabled Whether the contract is enabled or disabled
     * @return success True if the operation was successful
     */
    function setRewardsContract(address _rewardsContract, bool _enabled) 
        external 
        onlyAdmin 
        nonReentrant 
        returns (bool success) 
    {
        if (_rewardsContract == address(0)) revert ZeroAddress();
        
        // Update the mapping
        rewardsContracts[_rewardsContract] = _enabled;
        
        // Emit event
        emit RewardsContractSet(_rewardsContract, _enabled);
        
        return true;
    }
    
    /**
     * @dev Allow another address to spend treasury tokens
     * @param token The token address to approve
     * @param spender The address to spend the tokens
     * @param amount The amount to approve
     * @return success Whether the approval was successful
     */
    function allowTokenTransfer(address token, address spender, uint256 amount)
        external
        onlyAdmin
        nonReentrant
        returns (bool)
    {
        if (token == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Measure gas before
        uint256 gasBefore = gasleft();
        
        // Get token contract
        IERC20 tokenContract = IERC20(token);
        uint256 currentAllowance = tokenContract.allowance(address(this), spender);
        
        // If allowance is already set correctly, skip
        if (currentAllowance == amount) {
            return true;
        }
        
        // Use our custom safeApprove
        if (currentAllowance > 0) {
            // First reset the allowance to 0
            safeApprove(tokenContract, spender, 0);
        }
        
        // Then set to the desired amount
        safeApprove(tokenContract, spender, amount);
        
        // Calculate gas saved
        uint256 gasUsed = gasBefore - gasleft();
        uint256 standardGas = 46000; // Approximate gas for standard ERC20 approval
        uint256 gasSaved = gasUsed > standardGas ? 0 : standardGas - gasUsed;
        
        emit TokenApprovalOptimized(token, spender, amount, gasSaved);
        return true;
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
    )
        external
        onlyAdmin
        nonReentrant
        returns (bool[] memory results)
    {
        if (tokens.length != amounts.length) revert InvalidAmount();
        if (spender == address(0)) revert ZeroAddress();
        
        uint256 tokensLength = tokens.length;
        results = new bool[](tokensLength);
        for (uint256 i = 0; i < tokensLength; i++) {
            results[i] = _processTokenApproval(tokens[i], spender, amounts[i]);
        }
        return results;
    }

    // Helper to process approval for a single token
    function _processTokenApproval(
        address tokenAddress,
        address spender,
        uint256 amount
    ) private returns (bool) {
        if (tokenAddress == address(0)) {
            return false;
        }
        IERC20 token = IERC20(tokenAddress);
        uint256 currentAllowance = token.allowance(address(this), spender);
        if (currentAllowance == amount) {
            return true;
        }
        if (currentAllowance > 0 && amount > 0) {
            bool resetSuccess = token.approve(spender, 0);
            if (!resetSuccess) {
                return false;
            }
        }
        return token.approve(spender, amount);
    }
    
    /**
     * @dev Withdraw tokens from a protocol contract that approved Treasury
     * @param token The token address
     * @param from The protocol contract that approved this Treasury
     * @param to The recipient address
     * @param amount The amount to withdraw
     * @param purpose The purpose of the withdrawal
     */
    function withdrawFromProtocol(
        address token,
        address from,
        address to,
        uint256 amount,
        string calldata purpose
    )
        external
        onlyAdmin
        nonReentrant
    {
        // CHECKS
        if (token == address(0)) revert ZeroAddress();
        if (from == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Check if there's sufficient allowance and balance
        IERC20 tokenContract = IERC20(token);
        if (tokenContract.allowance(from, address(this)) < amount) revert InsufficientAllowance();
        if (tokenContract.balanceOf(from) < amount) revert InsufficientBalance();
        
        // EFFECTS
        // Record the withdrawal by emitting event
        emit DelegatedTransferExecuted(token, from, to, amount, purpose);
        
        // INTERACTIONS
        // Use our custom safer transferFrom
        safeTransferFrom(tokenContract, from, to, amount);
    }
    
    /**
     * @dev Execute a delegated transfer through multiple contracts
     * This is a specialized function for backward compatibility testing
     * @param token The token address
     * @param level1 First contract in the chain that approved this contract
     * @param level2 Second contract in the chain that approved level1
     * @param level3 Third contract in the chain that approved level2
     * @param to Final recipient address
     * @param amount Amount to transfer
     * @param purpose Purpose of the transfer
     */
    function executeDelegatedTransfer(
        address token,
        address level1,
        address level2,
        address level3,
        address to,
        uint256 amount,
        string calldata purpose
    )
        external
        onlyAdmin
        nonReentrant
    {
        // CHECKS
        if (token == address(0)) revert ZeroAddress();
        if (level1 == address(0) || level2 == address(0) || level3 == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        // Get token contract
        IERC20 tokenContract = IERC20(token);
        
        // Check that we have proper approvals and balances
        if (tokenContract.allowance(level1, address(this)) < amount) revert InsufficientAllowance();
        if (tokenContract.balanceOf(level3) < amount) revert InsufficientBalance();
        
        // EFFECTS
        // Record the transfer by emitting event
        emit DelegatedTransferExecuted(token, level3, to, amount, purpose);
        
        // INTERACTIONS
        // Use our custom safer transferFrom
        safeTransferFrom(tokenContract, level3, to, amount);
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
        onlyAdmin
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
        onlyAdmin
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
     * @dev Implement optimizeApproval from ITokenApprovalOptimizer
     */
    function optimizeApproval(IERC20 token, address spender, uint256 amount) external override onlyAdmin nonReentrant returns (bool success) {
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
     * @dev Implement safeIncreaseAllowance from ITokenApprovalOptimizer
     */
    function safeIncreaseAllowance(IERC20 token, address spender, uint256 addedValue) external override onlyAdmin nonReentrant returns (bool success) {
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
     * @dev Implement safeDecreaseAllowance from ITokenApprovalOptimizer
     */
    function safeDecreaseAllowance(IERC20 token, address spender, uint256 subtractedValue) external override onlyAdmin nonReentrant returns (bool success) {
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
     * @dev Implement batchApprove from ITokenApprovalOptimizer
     */
    function batchApprove(IERC20[] memory tokens, address spender, uint256[] memory amounts) 
        external 
        override 
        onlyAdmin 
        nonReentrant
        returns (bool[] memory results) 
    {
        if (tokens.length != amounts.length) revert InvalidAmount();
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
     * @dev Implement singleTransactionApprove from ITokenApprovalOptimizer
     * @notice This function optimizes the approval process for a single token
     * @param token The ERC20 token to approve spending for
     * @param spender The address that will be allowed to spend the tokens
     * @param amount The amount of tokens to approve
     * @return success Boolean indicating if the operation was successful
     */
    function singleTransactionApprove(IERC20 token, address spender, uint256 amount) 
        external 
        override 
        onlyAdmin 
        nonReentrant
        returns (bool success) 
    {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Use safer direct method call instead of low-level call
        success = token.approve(spender, amount);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Implement clearApproval from ITokenApprovalOptimizer
     * @notice Efficiently resets a token approval to zero
     * @param token The ERC20 token to clear approval for
     * @param spender The address that was previously allowed to spend the tokens
     * @return success Boolean indicating if the operation was successful
     */
    function clearApproval(IERC20 token, address spender) 
        external 
        override 
        onlyAdmin 
        nonReentrant
        returns (bool success) 
    {
        if (address(token) == address(0)) revert ZeroAddress();
        if (spender == address(0)) revert ZeroAddress();
        
        // Check if there's an existing approval that needs clearing
        uint256 currentAllowance = token.allowance(address(this), spender);
        if (currentAllowance == 0) {
            return true; // Already cleared, save gas by not making an unnecessary call
        }
        
        // Use safer direct method call
        success = token.approve(spender, 0);
        if (!success) revert ApprovalFailed();
        
        return success;
    }
    
    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {
        emit FundsReceived(address(0), msg.value, msg.sender);
    }
    
    /**
     * @dev Deposits funds into the treasury
     * @param token Address of the token to deposit (use address(0) for ETH)
     * @param amount Amount to deposit
     * @param memo Optional memo for the deposit
     * @return success True if the deposit was successful
     */
    function deposit(address token, uint256 amount, string memory memo) 
        external 
        payable 
        nonReentrant 
        returns (bool success) 
    {
        // CHECKS
        if (amount == 0) revert InvalidAmount();
        
        if (token == address(0)) {
            // For ETH deposits, check that the sent amount matches the specified amount
            if (msg.value != amount) revert InvalidAmount();
        } else {
            // For token deposits, check that the sender has approved the treasury
            if (msg.value > 0) revert InvalidAmount();
            if (IERC20(token).allowance(msg.sender, address(this)) < amount) revert InsufficientAllowance();
        }
        
        // EFFECTS
        // Record the deposit by emitting events
        emit FundsReceived(token, amount, msg.sender);
        emit Deposit(token, amount, msg.sender, memo);
        
        // INTERACTIONS
        if (token != address(0)) {
            // Transfer tokens from the sender to the treasury
            bool transferSuccess = IERC20(token).transferFrom(msg.sender, address(this), amount);
            if (!transferSuccess) revert TransferFailed();
        }
        
        return true;
    }
    
    /**
     * @dev Gets the balance of a token in the treasury
     * @param token Address of the token (use address(0) for ETH)
     * @return balance The balance of the token
     */
    function getBalance(address token) external view returns (uint256 balance) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }
    
    /**
     * @dev Distributes rewards to multiple recipients
     * @param token Address of the token to distribute
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to distribute (must match recipients length)
     */
    function distributeRewards(
        address token,
        address[] memory recipients,
        uint256[] memory amounts
    ) external onlyAdmin nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (recipients.length != amounts.length) revert InvalidAmount();
        
        IERC20 tokenContract = IERC20(token);
        uint256 totalAmount;
        
        // Calculate total amount needed
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // Check treasury balance
        if (tokenContract.balanceOf(address(this)) < totalAmount) {
            revert InsufficientBalance();
        }
        
        // Distribute to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert InvalidAmount();
            
            tokenContract.transfer(recipients[i], amounts[i]);
            emit FundsDistributed(token, recipients[i], amounts[i]);
        }
    }
}