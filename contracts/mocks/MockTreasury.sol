// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";
import "../interfaces/fees/ITreasury.sol";

/**
 * @title MockTreasury
 * @dev Mock implementation of the Treasury contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockTreasury is AccessControl, BaseMock, ITreasury {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant FEE_PROCESSOR_ROLE = keccak256("FEE_PROCESSOR_ROLE");
    
    // Treasury manager address
    address public treasuryManager;
    
    // Strategy manager address
    address public strategyManager;
    
    // Events
    event TokensReceived(address indexed token, uint256 amount, address from);
    event TokensWithdrawn(address indexed token, uint256 amount, address to);
    
    /**
     * @dev Constructor
     * @param _treasuryManager Address of the treasury manager
     * @param _strategyManager Address of the strategy manager
     */
    constructor(address _treasuryManager, address _strategyManager) BaseMock() {
        if (_treasuryManager == address(0) || _strategyManager == address(0)) {
            revert ZeroAddress();
        }
        
        treasuryManager = _treasuryManager;
        strategyManager = _strategyManager;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(FEE_PROCESSOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Receive tokens from fee processor
     * @param token Address of the token
     * @param amount Amount of tokens
     */
    function receiveTokens(address token, uint256 amount) external onlyRole(FEE_PROCESSOR_ROLE) {
        _recordFunctionCall(
            "receiveTokens",
            abi.encode(token, amount)
        );
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        bool success = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TokenTransferFailed();
        
        emit TokensReceived(token, amount, msg.sender);
    }
    
    /**
     * @dev Withdraw tokens from treasury
     * @param token Address of the token
     * @param amount Amount of tokens
     * @param to Address to send tokens to
     */
    function withdrawTokens(address token, uint256 amount, address to) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "withdrawTokens",
            abi.encode(token, amount, to)
        );
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        
        bool success = IERC20(token).transfer(to, amount);
        if (!success) revert TokenTransferFailed();
        
        emit TokensWithdrawn(token, amount, to);
    }
    
    /**
     * @dev Set treasury manager
     * @param _treasuryManager New treasury manager
     */
    function setTreasuryManager(address _treasuryManager) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setTreasuryManager",
            abi.encode(_treasuryManager)
        );
        if (_treasuryManager == address(0)) revert ZeroAddress();
        treasuryManager = _treasuryManager;
    }
    
    /**
     * @dev Set strategy manager
     * @param _strategyManager New strategy manager
     */
    function setStrategyManager(address _strategyManager) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "setStrategyManager",
            abi.encode(_strategyManager)
        );
        if (_strategyManager == address(0)) revert ZeroAddress();
        strategyManager = _strategyManager;
    }
    
    /**
     * @dev Receive funds into the treasury
     * @param token Token address
     * @param amount Amount of tokens
     */
    function receiveFunds(address token, uint256 amount) external returns (bool) {
        _recordFunctionCall(
            "receiveFunds",
            abi.encode(token, amount)
        );
        
        emit TokensReceived(token, amount, msg.sender);
        return true;
    }
    
    /**
     * @dev Distribute funds from the treasury
     * @param token Token address
     * @param recipient Recipient address
     * @param amount Amount of tokens
     */
    function distributeFunds(address token, address recipient, uint256 amount) external returns (bool) {
        _recordFunctionCall(
            "distributeFunds",
            abi.encode(token, recipient, amount)
        );
        
        emit TokensWithdrawn(token, amount, recipient);
        return true;
    }
    
    /**
     * @dev Batch transfer tokens to multiple recipients
     * @param recipients Array of recipient addresses
     * @param tokens Array of token addresses
     * @param amounts Array of token amounts
     */
    function batchTransfer(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external override returns (bool[] memory results) {
        _recordFunctionCall(
            "batchTransfer",
            abi.encode(recipients, tokens, amounts)
        );
        
        require(recipients.length == tokens.length && recipients.length == amounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            emit TokensWithdrawn(tokens[i], amounts[i], recipients[i]);
        }
        
        results = new bool[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            results[i] = true;
        }
        return results;
    }
    
    /**
     * @dev Optimize token approval
     * @param token Token address
     * @param spender Spender address
     * @param amount Amount to approve
     */
    function optimizeApproval(address token, address spender, uint256 amount) external returns (bool) {
        _recordFunctionCall(
            "optimizeApproval",
            abi.encode(token, spender, amount)
        );
        
        return true;
    }
    
    /**
     * @dev Get token balance in treasury
     * @param token Token address
     * @return Balance of the token
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getBalance(address token) external view returns (uint256) {
        // Mock implementation - return 1000 tokens
        return 1000 * 10**18;
    }
    
    /**
     * @dev Check if token is approved for spender
     * @param token Token address
     * @param spender Spender address
     * @return Whether the token is approved
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function isApproved(address token, address spender) external view returns (bool) {
        // Mock implementation - always return true
        return true;
    }
    
    /**
     * @dev Get treasury configuration
    
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getTreasuryConfig() external view override returns (
        address admin,
        address protocolDAO
    ) {
        // Return mock configuration
        return (
            address(this),
            address(0)
        );
    }
    
    // Role management constants
    
    
    // Treasury configuration struct
    struct TreasuryConfig {
        address treasuryManager;
        address strategyManager;
        uint256 withdrawalLimit;
        uint256 cooldownPeriod;
    }
}