// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/bridge/HederaBridge.sol";
import "../../contracts/libraries/Errors.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RateLimitingInvariants
 * @dev Property-based tests for HederaBridge rate limiting
 */
contract RateLimitingInvariants {
    // Contracts being tested
    HederaBridge public bridge;
    IERC20 public token;
    
    // Test users
    address public user1;
    address public user2;
    address public user3;
    
    // Governance and admin
    address public governance;
    
    // Rate limiting parameters
    uint256 public constant MAX_TRANSFER_AMOUNT = 1000 ether;
    uint256 public constant DAILY_TRANSFER_LIMIT = 5000 ether;
    uint256 public constant LARGE_TRANSFER_THRESHOLD = 500 ether;
    uint256 public constant DEFAULT_COOLDOWN_PERIOD = 3600; // 1 hour
    
    // User-specific limits
    uint256 public constant USER_MAX_TRANSFER = 200 ether;
    uint256 public constant USER_DAILY_LIMIT = 500 ether;
    uint256 public constant USER_WEEKLY_LIMIT = 2000 ether;
    uint256 public constant USER_COOLDOWN_PERIOD = 1800; // 30 minutes
    
    // Target chain
    uint256 public constant TARGET_CHAIN_ID = 295; // Hedera
    
    // Transfer tracking
    mapping(address => uint256) public userDailyTransfers;
    mapping(address => uint256) public userTotalTransfers;
    mapping(address => uint256) public lastLargeTransferTime;
    
    // Setup constructor with appropriate parameters
    constructor(address _bridge, address _token) {
        bridge = HederaBridge(_bridge);
        token = IERC20(_token);
        
        // Set up test accounts
        governance = address(0x1);
        user1 = address(0x2);
        user2 = address(0x3);
        user3 = address(0x4);
        
        // Configure bridge limits
        bridge.setMaxTransferAmount(MAX_TRANSFER_AMOUNT);
        bridge.setDailyTransferLimit(DAILY_TRANSFER_LIMIT);
        bridge.setLargeTransferThreshold(LARGE_TRANSFER_THRESHOLD);
        bridge.setDefaultCooldownPeriod(DEFAULT_COOLDOWN_PERIOD);
        
        // Configure user limits
        bridge.configureUserLimits(
            user1,
            USER_MAX_TRANSFER,
            USER_DAILY_LIMIT,
            USER_WEEKLY_LIMIT,
            USER_COOLDOWN_PERIOD
        );
    }
    
    /**
     * @dev Test function to check user daily limits are enforced
     * @param userIndex Fuzzed user index (0-2)
     * @param amount Fuzzed transfer amount
     */
    function testUserDailyLimitsEnforced(uint8 userIndex, uint256 amount) public {
        // Select user based on index
        address user = userIndex == 0 ? user1 : (userIndex == 1 ? user2 : user3);
        
        // Bound amount to something reasonable but potentially over limit
        amount = bound(amount, 1, USER_DAILY_LIMIT * 2);
        
        // Track transfers
        uint256 previousDailyTotal = userDailyTransfers[user];
        uint256 newDailyTotal = previousDailyTotal + amount;
        
        // Try transfer
        try bridge.lockAndTransfer(address(token), amount, user, TARGET_CHAIN_ID) {
            // If successful, the new total must be within limits
            userDailyTransfers[user] = newDailyTotal;
            userTotalTransfers[user] += amount;
            
            // For user1 with specific limits
            if (user == user1) {
                assert(amount <= USER_MAX_TRANSFER);
                assert(newDailyTotal <= USER_DAILY_LIMIT);
            } 
            // For other users with global limits
            else {
                assert(amount <= MAX_TRANSFER_AMOUNT);
                assert(newDailyTotal <= DAILY_TRANSFER_LIMIT);
            }
            
            // Record time of large transfers
            if (amount >= LARGE_TRANSFER_THRESHOLD) {
                lastLargeTransferTime[user] = block.timestamp;
            }
        } catch {
            // If failed, verify if it should have failed
            if (user == user1) {
                // Should fail if amount > USER_MAX_TRANSFER or newDailyTotal > USER_DAILY_LIMIT
                assert(amount > USER_MAX_TRANSFER || newDailyTotal > USER_DAILY_LIMIT);
            } else {
                // Should fail if amount > MAX_TRANSFER_AMOUNT or newDailyTotal > DAILY_TRANSFER_LIMIT
                assert(amount > MAX_TRANSFER_AMOUNT || newDailyTotal > DAILY_TRANSFER_LIMIT);
            }
        }
    }
    
    /**
     * @dev Property: Large transfer cooldowns are enforced
     * @param userIndex Fuzzed user index (0-2)
     * @param amount Fuzzed transfer amount (large)
     * @param timeDelta Fuzzed time increment
     */
    function echidna_large_transfer_cooldown_invariant(uint8 userIndex, uint256 amount, uint256 timeDelta) public view returns (bool) {
        // Select user based on index
        address user = userIndex == 0 ? user1 : (userIndex == 1 ? user2 : user3);
        
        // Bound to ensure it's a large transfer
        amount = bound(amount, LARGE_TRANSFER_THRESHOLD, MAX_TRANSFER_AMOUNT);
        
        // Bound time increment to something reasonable
        timeDelta = bound(timeDelta, 0, DEFAULT_COOLDOWN_PERIOD * 2);
        
        // Skip if no previous large transfer
        if (lastLargeTransferTime[user] == 0) {
            return true;
        }
        
        // Calculate time since last large transfer
        uint256 timeSinceLastLargeTransfer = block.timestamp - lastLargeTransferTime[user];
        
        // Get the applicable cooldown period for this user
        uint256 applicableCooldown = user == user1 ? USER_COOLDOWN_PERIOD : DEFAULT_COOLDOWN_PERIOD;
        
        // If we're within the cooldown period, the bridge should reject the transfer
        if (timeSinceLastLargeTransfer < applicableCooldown) {
            try bridge.lockAndTransfer(address(token), amount, user, TARGET_CHAIN_ID) {
                // If successful during cooldown, that's a violation
                return false;
            } catch {
                // Expected to fail during cooldown
                return true;
            }
        }
        
        // After cooldown period, transfers should be allowed
        return true;
    }
    
    /**
     * @dev Property: Global daily limits are enforced
     */
    function echidna_global_daily_limit_invariant() public view returns (bool) {
        // Calculate total transfers today across all users
        uint256 totalDailyTransfers = userDailyTransfers[user1] + userDailyTransfers[user2] + userDailyTransfers[user3];
        
        // Global limit should never be exceeded
        return totalDailyTransfers <= DAILY_TRANSFER_LIMIT;
    }
    
    /**
     * @dev Property: User specific limits are not exceeded
     */
    function echidna_user_limits_invariant() public view returns (bool) {
        // User1 has specific limits
        return userDailyTransfers[user1] <= USER_DAILY_LIMIT;
    }
    
    /**
     * @dev Helper function to bound values to a range
     */
    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        return min + (value % (max - min + 1));
    }
}