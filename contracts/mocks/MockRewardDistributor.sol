// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./base/BaseMock.sol";

/**
 * @title MockRewardDistributor
 * @dev Mock contract for testing reward distribution functionality
 * @notice Follows standardized mock pattern by extending BaseMock
 */
contract MockRewardDistributor is BaseMock {
    address public owner;
    mapping(address => uint256) public receivedRewards;
    
    event RewardReceived(address token, uint256 amount);
    
    constructor() BaseMock() {
        owner = msg.sender;
    }
    
    /**
     * @dev Function to receive tokens
     * @param token Address of the token being received
     * @param amount Amount of tokens being received
     */
    function receiveReward(address token, uint256 amount) external {
        _recordFunctionCall("receiveReward", abi.encode(token, amount));
        receivedRewards[token] += amount;
        emit RewardReceived(token, amount);
    }
    
    /**
     * @dev Function to handle direct token transfers
     * @param from Address tokens are coming from (unused in this mock)
     * @param amount Amount of tokens being received
     * @param data Additional data (unused in this mock)
     * @return success True if the transfer was successful
     */
    function onTokenTransfer(address from, uint256 amount, bytes calldata data) external returns (bool) {
        _recordFunctionCall("onTokenTransfer", abi.encode(from, amount, data));
        receivedRewards[msg.sender] += amount;
        emit RewardReceived(msg.sender, amount);
        return true;
    }
    
    /**
     * @dev Function to withdraw tokens (for testing)
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function withdrawToken(address token, uint256 amount) external {
        _recordFunctionCall("withdrawToken", abi.encode(token, amount));
        require(msg.sender == owner || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        receivedRewards[token] -= amount;
    }
}
