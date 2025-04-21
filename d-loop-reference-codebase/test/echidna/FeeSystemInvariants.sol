// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../../contracts/fees/FeeCalculator.sol";
import "../../contracts/fees/FeeProcessor.sol";
import "../../contracts/fees/Treasury.sol";
import "../../contracts/fees/RewardDistributor.sol";
import "../../contracts/mocks/MockToken.sol";

contract FeeSystemInvariantsTest {
    // Constants for testing
    uint256 constant INVEST_FEE_PERCENT = 0.1e18; // 10%
    uint256 constant DIVEST_FEE_PERCENT = 0.05e18; // 5%
    uint256 constant RAGEQUIT_FEE_PERCENT = 0.2e18; // 20%
    uint256 constant TREASURY_PERCENTAGE = 0.7e18; // 70%
    uint256 constant REWARD_PERCENTAGE = 0.3e18; // 30%
    
    // State variables
    FeeCalculator public feeCalculator;
    FeeProcessor public feeProcessor;
    Treasury public treasury;
    RewardDistributor public rewardDistributor;
    MockToken public token;
    
    // Tracking variables for invariant testing
    uint256 public totalFeesCollected;
    uint256 public totalToTreasury;
    uint256 public totalToRewards;
    
    constructor() {
        // Deploy mock token
        token = new MockToken("TEST", "TEST", 18);
        
        // Deploy fee components
        feeCalculator = new FeeCalculator(
            INVEST_FEE_PERCENT,
            DIVEST_FEE_PERCENT,
            RAGEQUIT_FEE_PERCENT
        );
        
        treasury = new Treasury();
        rewardDistributor = new RewardDistributor();
        
        feeProcessor = new FeeProcessor(
            address(treasury),
            address(rewardDistributor),
            TREASURY_PERCENTAGE,
            REWARD_PERCENTAGE
        );
        
        // Setup permissions
        treasury.setFeeProcessor(address(feeProcessor));
        rewardDistributor.setFeeProcessor(address(feeProcessor));
        
        // Mint tokens for testing
        token.mint(address(this), 1000000 ether);
    }
    
    // Helper function to process a fee
    function processFee(uint256 amount, uint8 feeType) internal {
        uint256 fee;
        
        // Calculate fee based on type
        if (feeType % 3 == 0) {
            fee = feeCalculator.calculateInvestFee(amount);
        } else if (feeType % 3 == 1) {
            fee = feeCalculator.calculateDivestFee(amount);
        } else {
            fee = feeCalculator.calculateRagequitFee(amount);
        }
        
        // Approve and process fee
        token.approve(address(feeProcessor), fee);
        feeProcessor.processFee(address(token), address(this), fee);
        
        // Update tracking variables
        totalFeesCollected += fee;
        totalToTreasury += (fee * TREASURY_PERCENTAGE) / 1e18;
        totalToRewards += (fee * REWARD_PERCENTAGE) / 1e18;
    }
    
    /*
     * Echidna property-based test functions
     * Each function should return true if the invariant holds
     */
    
    // Invariant: Fee calculation should never exceed input amount
    function echidna_fee_never_exceeds_amount(uint256 amount) public view returns (bool) {
        // Bound the input to prevent overflow
        amount = bound(amount, 0, type(uint128).max);
        
        uint256 investFee = feeCalculator.calculateInvestFee(amount);
        uint256 divestFee = feeCalculator.calculateDivestFee(amount);
        uint256 ragequitFee = feeCalculator.calculateRagequitFee(amount);
        
        return investFee <= amount && divestFee <= amount && ragequitFee <= amount;
    }
    
    // Invariant: Ragequit fee should be highest, invest fee medium, divest fee lowest
    function echidna_fee_hierarchy_maintained(uint256 amount) public view returns (bool) {
        // Bound the input to prevent overflow
        amount = bound(amount, 1 ether, 1000 ether);
        
        uint256 investFee = feeCalculator.calculateInvestFee(amount);
        uint256 divestFee = feeCalculator.calculateDivestFee(amount);
        uint256 ragequitFee = feeCalculator.calculateRagequitFee(amount);
        
        return ragequitFee >= investFee && investFee >= divestFee;
    }
    
    // Invariant: Fee distribution percentages should always sum to 100%
    function echidna_distribution_percentages_sum_to_one() public view returns (bool) {
        return TREASURY_PERCENTAGE + REWARD_PERCENTAGE == 1e18;
    }
    
    // Invariant: Treasury + Reward balances should equal total fees collected
    function echidna_balances_match_fees() public view returns (bool) {
        uint256 treasuryBalance = token.balanceOf(address(treasury));
        uint256 rewardBalance = token.balanceOf(address(rewardDistributor));
        
        // Allow for dust (1 wei difference) due to division rounding
        uint256 totalBalance = treasuryBalance + rewardBalance;
        uint256 difference = totalBalance > totalFeesCollected ? 
            totalBalance - totalFeesCollected : 
            totalFeesCollected - totalBalance;
            
        return difference <= 1;
    }
    
    // Invariant: Treasury balance should match tracked treasury amount
    function echidna_treasury_balance_match() public view returns (bool) {
        uint256 treasuryBalance = token.balanceOf(address(treasury));
        
        // Allow for dust (1 wei difference) due to division rounding
        uint256 difference = treasuryBalance > totalToTreasury ? 
            treasuryBalance - totalToTreasury : 
            totalToTreasury - treasuryBalance;
            
        return difference <= 1;
    }
    
    // Invariant: Reward balance should match tracked reward amount
    function echidna_reward_balance_match() public view returns (bool) {
        uint256 rewardBalance = token.balanceOf(address(rewardDistributor));
        
        // Allow for dust (1 wei difference) due to division rounding
        uint256 difference = rewardBalance > totalToRewards ? 
            rewardBalance - totalToRewards : 
            totalToRewards - rewardBalance;
            
        return difference <= 1;
    }
    
    // Fuzzing function for Echidna to call
    function fuzz_process_fee(uint256 amount, uint8 feeType) public {
        // Bound the input to prevent overflow
        amount = bound(amount, 0.0001 ether, 100000 ether);
        
        processFee(amount, feeType);
    }
    
    // Helper function to bound values
    function bound(uint256 value, uint256 min, uint256 max) internal pure returns (uint256) {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
    
    // Invariant: Fee percentages never exceed 100%
    function echidna_fee_percentages_valid() public view returns (bool) {
        return feeCalculator.investFeePercent() <= 1e18 && 
               feeCalculator.divestFeePercent() <= 1e18 && 
               feeCalculator.ragequitFeePercent() <= 1e18;
    }
    
    // Invariant: Zero input results in zero fee
    function echidna_zero_input_zero_fee() public view returns (bool) {
        return feeCalculator.calculateInvestFee(0) == 0 && 
               feeCalculator.calculateDivestFee(0) == 0 && 
               feeCalculator.calculateRagequitFee(0) == 0;
    }
    
    // Test admin functions
    function test_update_fee_percentages(uint256 invest, uint256 divest, uint256 ragequit) public {
        // Bound percentages to realistic values
        invest = bound(invest, 0, 0.5e18);  // Max 50%
        divest = bound(divest, 0, 0.3e18);  // Max 30%
        ragequit = bound(ragequit, 0, 0.6e18);  // Max 60%
        
        // Update fee percentages
        feeCalculator.updateFeePercentages(invest, divest, ragequit);
        
        // Verify updates
        assert(feeCalculator.investFeePercent() == invest);
        assert(feeCalculator.divestFeePercent() == divest);
        assert(feeCalculator.ragequitFeePercent() == ragequit);
    }
    
    // Test distribution percentage updates
    function test_update_distribution_percentages(uint256 treasury, uint256 reward) public {
        // Ensure percentages sum to 100%
        if (treasury + reward != 1e18) {
            if (treasury > 1e18) {
                treasury = 1e18;
                reward = 0;
            } else {
                reward = 1e18 - treasury;
            }
        }
        
        // Update distribution percentages
        feeProcessor.updateDistributionPercentages(treasury, reward);
        
        // Verify updates
        assert(feeProcessor.treasuryPercentage() == treasury);
        assert(feeProcessor.rewardPercentage() == reward);
    }
}