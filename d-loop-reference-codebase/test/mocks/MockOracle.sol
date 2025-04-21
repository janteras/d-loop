// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @dev Mock price oracle for testing
 */
contract MockOracle is Ownable {
    mapping(address => uint256) private prices;
    mapping(address => uint256) private updateTimes;

    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Set price for a token
     * @param token Token address
     * @param price Price with 8 decimals (e.g., 10000000000 for $100.00)
     */
    function setPrice(address token, uint256 price) external onlyOwner {
        prices[token] = price;
        updateTimes[token] = block.timestamp;
        emit PriceUpdated(token, price, block.timestamp);
    }

    /**
     * @dev Get price for a token
     * @param token Token address
     * @return price Price with 8 decimals
     */
    function getPrice(address token) external view returns (uint256) {
        require(prices[token] > 0, "Price not set for token");
        return prices[token];
    }

    /**
     * @dev Set update time for a token (for testing stale data)
     * @param token Token address
     * @param timestamp Update timestamp
     */
    function setUpdateTime(address token, uint256 timestamp) external onlyOwner {
        updateTimes[token] = timestamp;
    }

    /**
     * @dev Get update time for a token
     * @param token Token address
     * @return timestamp Last update timestamp
     */
    function getUpdateTime(address token) external view returns (uint256) {
        return updateTimes[token];
    }
}
