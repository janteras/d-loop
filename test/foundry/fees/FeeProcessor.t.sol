// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/fees/FeeProcessor.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/token/DAIToken.sol";

/**
 * @title FeeProcessor Fuzz Test
 * @dev Property-based tests for the FeeProcessor contract
 * 
 * This test focuses on:
 * 1. Fee calculation with various amounts and percentages
 * 2. Fee distribution to treasury and reward distributor
 * 3. Batch token approval mechanisms
 * 4. Edge cases in fee processing
 */
contract FeeProcessorTest is Test {
    // Contracts
    FeeProcessor public feeProcessor;
    DLoopToken public dloopToken;
    DAIToken public daiToken;
    
    // Test accounts
    address public owner;
    address public admin;
    address public treasury;
    address public rewardDistributor;
    address public user1;
    address public user2;
    address public authorizedContract;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant DEFAULT_TREASURY_PERCENTAGE = 7000; // 70%
    uint256 public constant DEFAULT_REWARD_PERCENTAGE = 3000; // 30%
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Events to test
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
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        rewardDistributor = makeAddr("rewardDistributor");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        authorizedContract = makeAddr("authorizedContract");
        
        // Deploy tokens
        vm.startPrank(owner);
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            owner
        );
        
        daiToken = new DAIToken();
        
        // Deploy FeeProcessor
        feeProcessor = new FeeProcessor();
        
        // Initialize FeeProcessor
        feeProcessor.initialize(
            admin,
            treasury,
            rewardDistributor,
            DEFAULT_TREASURY_PERCENTAGE,
            DEFAULT_REWARD_PERCENTAGE
        );
        
        // Grant roles
        bytes32 authorizedRole = feeProcessor.AUTHORIZED_CONTRACT_ROLE();
        feeProcessor.grantRole(authorizedRole, authorizedContract);
        
        // Distribute tokens
        dloopToken.transfer(user1, 100_000 ether);
        dloopToken.transfer(user2, 100_000 ether);
        dloopToken.transfer(authorizedContract, 100_000 ether);
        
        // Mint DAI tokens
        bytes32 minterRole = daiToken.MINTER_ROLE();
        daiToken.grantRole(minterRole, owner);
        daiToken.mint(user1, 100_000 ether);
        daiToken.mint(user2, 100_000 ether);
        daiToken.mint(authorizedContract, 100_000 ether);
        vm.stopPrank();
        
        // Approve tokens for fee processor
        vm.prank(authorizedContract);
        dloopToken.approve(address(feeProcessor), type(uint256).max);
        
        vm.prank(authorizedContract);
        daiToken.approve(address(feeProcessor), type(uint256).max);
    }
    
    /**
     * @dev Fuzz test for fee collection with various amounts and fee types
     * @param amount Amount on which to calculate the fee
     * @param feePercentage Fee percentage to set (in basis points)
     * @param feeTypeIndex Index to select fee type
     * @param tokenIndex Index to select token
     */
    function testFuzz_FeeCollection(
        uint256 amount,
        uint16 feePercentage,
        uint8 feeTypeIndex,
        bool tokenIndex
    ) public {
        // Bound inputs to realistic values
        amount = bound(amount, 1 ether, 1_000_000 ether);
        feePercentage = uint16(bound(feePercentage, 50, 2000)); // 0.5% to 20%
        
        // Set fee percentage
        vm.prank(admin);
        feeProcessor.setFeePercentage(feePercentage);
        
        // Select fee type
        string memory feeType;
        if (feeTypeIndex % 3 == 0) {
            feeType = "investment";
        } else if (feeTypeIndex % 3 == 1) {
            feeType = "divestment";
        } else {
            feeType = "transaction";
        }
        
        // Select token
        address token = tokenIndex ? address(dloopToken) : address(daiToken);
        
        // Initial balances
        uint256 initialTreasuryBalance = IERC20(token).balanceOf(treasury);
        uint256 initialRewardBalance = IERC20(token).balanceOf(rewardDistributor);
        
        // Collect fee
        vm.startPrank(authorizedContract);
        vm.expectEmit(true, true, false, true);
        
        // Calculate expected fees
        uint256 expectedTotalFee = (amount * feePercentage) / BASIS_POINTS;
        uint256 expectedTreasuryFee = (expectedTotalFee * DEFAULT_TREASURY_PERCENTAGE) / BASIS_POINTS;
        uint256 expectedRewardFee = (expectedTotalFee * DEFAULT_REWARD_PERCENTAGE) / BASIS_POINTS;
        
        emit FeeCollected(
            feeType,
            token,
            expectedTotalFee,
            expectedTreasuryFee,
            expectedRewardFee
        );
        
        uint256 actualTotalFee;
        if (keccak256(bytes(feeType)) == keccak256(bytes("investment"))) {
            actualTotalFee = feeProcessor.collectInvestmentFee(token, amount);
        } else if (keccak256(bytes(feeType)) == keccak256(bytes("divestment"))) {
            actualTotalFee = feeProcessor.collectDivestmentFee(token, amount);
        } else {
            actualTotalFee = feeProcessor.collectTransactionFee(token, amount);
        }
        vm.stopPrank();
        
        // Verify fee amounts
        assertEq(actualTotalFee, expectedTotalFee, "Total fee amount mismatch");
        
        // Verify balances
        uint256 finalTreasuryBalance = IERC20(token).balanceOf(treasury);
        uint256 finalRewardBalance = IERC20(token).balanceOf(rewardDistributor);
        
        assertEq(finalTreasuryBalance - initialTreasuryBalance, expectedTreasuryFee, "Treasury fee mismatch");
        assertEq(finalRewardBalance - initialRewardBalance, expectedRewardFee, "Reward fee mismatch");
    }
    
    /**
     * @dev Fuzz test for distribution parameter updates
     * @param newTreasuryPercentage New treasury percentage
     * @param newRewardPercentage New reward percentage
     */
    function testFuzz_DistributionParameterUpdates(
        uint256 newTreasuryPercentage,
        uint256 newRewardPercentage
    ) public {
        // Bound inputs to realistic values
        newTreasuryPercentage = bound(newTreasuryPercentage, 1000, 9000); // 10% to 90%
        
        // Ensure percentages sum to 10000 (100%)
        newRewardPercentage = BASIS_POINTS - newTreasuryPercentage;
        
        // Update distribution parameters
        vm.prank(admin);
        vm.expectEmit(true, true, true, true);
        emit DistributionParametersUpdated(
            DEFAULT_TREASURY_PERCENTAGE,
            DEFAULT_REWARD_PERCENTAGE,
            newTreasuryPercentage,
            newRewardPercentage
        );
        feeProcessor.updateDistributionParameters(newTreasuryPercentage, newRewardPercentage);
        
        // Verify parameters were updated
        assertEq(feeProcessor.treasuryPercentage(), newTreasuryPercentage, "Treasury percentage not updated");
        assertEq(feeProcessor.rewardDistPercentage(), newRewardPercentage, "Reward percentage not updated");
        
        // Test fee collection with new parameters
        uint256 amount = 1000 ether;
        uint256 feePercentage = 500; // 5%
        
        vm.prank(admin);
        feeProcessor.setFeePercentage(feePercentage);
        
        // Initial balances
        uint256 initialTreasuryBalance = dloopToken.balanceOf(treasury);
        uint256 initialRewardBalance = dloopToken.balanceOf(rewardDistributor);
        
        // Collect fee
        vm.prank(authorizedContract);
        uint256 totalFee = feeProcessor.collectInvestmentFee(address(dloopToken), amount);
        
        // Calculate expected fees with new distribution
        uint256 expectedTreasuryFee = (totalFee * newTreasuryPercentage) / BASIS_POINTS;
        uint256 expectedRewardFee = (totalFee * newRewardPercentage) / BASIS_POINTS;
        
        // Verify balances
        uint256 finalTreasuryBalance = dloopToken.balanceOf(treasury);
        uint256 finalRewardBalance = dloopToken.balanceOf(rewardDistributor);
        
        assertEq(finalTreasuryBalance - initialTreasuryBalance, expectedTreasuryFee, "Treasury fee with new parameters mismatch");
        assertEq(finalRewardBalance - initialRewardBalance, expectedRewardFee, "Reward fee with new parameters mismatch");
    }
    
    /**
     * @dev Fuzz test for batch token approval mechanisms
     * @param tokenCount Number of tokens to approve
     * @param amountMultiplier Multiplier for approval amounts
     */
    function testFuzz_BatchTokenApproval(
        uint8 tokenCount,
        uint256 amountMultiplier
    ) public {
        // Bound inputs to realistic values
        tokenCount = uint8(bound(tokenCount, 1, 10));
        amountMultiplier = bound(amountMultiplier, 1, 1000);
        
        // Generate token addresses and amounts
        address[] memory tokens = new address[](tokenCount);
        uint256[] memory amounts = new uint256[](tokenCount);
        
        for (uint8 i = 0; i < tokenCount; i++) {
            // Alternate between real tokens and mock tokens
            if (i % 2 == 0) {
                tokens[i] = address(dloopToken);
            } else {
                tokens[i] = address(daiToken);
            }
            
            amounts[i] = 1000 ether * amountMultiplier;
        }
        
        // Test batch approval
        vm.prank(authorizedContract);
        feeProcessor.batchApprove(tokens, amounts, user1);
        
        // Verify approvals
        for (uint8 i = 0; i < tokenCount; i++) {
            uint256 allowance = IERC20(tokens[i]).allowance(address(feeProcessor), user1);
            assertEq(allowance, amounts[i], "Approval amount mismatch");
        }
        
        // Test batch decrease allowance
        uint256[] memory decreaseAmounts = new uint256[](tokenCount);
        for (uint8 i = 0; i < tokenCount; i++) {
            decreaseAmounts[i] = amounts[i] / 2;
        }
        
        vm.prank(authorizedContract);
        feeProcessor.batchDecreaseAllowance(tokens, decreaseAmounts, user1);
        
        // Verify decreased allowances
        for (uint8 i = 0; i < tokenCount; i++) {
            uint256 allowance = IERC20(tokens[i]).allowance(address(feeProcessor), user1);
            assertEq(allowance, amounts[i] - decreaseAmounts[i], "Decreased allowance mismatch");
        }
    }
    
    /**
     * @dev Fuzz test for edge cases in fee processing
     * @param amount Amount on which to calculate the fee
     * @param feePercentage Fee percentage (in basis points)
     * @param treasuryPercentage Treasury percentage (in basis points)
     */
    function testFuzz_FeeProcessingEdgeCases(
        uint256 amount,
        uint16 feePercentage,
        uint16 treasuryPercentage
    ) public {
        // Bound inputs to include edge cases
        amount = bound(amount, 1, 1_000_000 ether);
        feePercentage = uint16(bound(feePercentage, 1, 9999)); // 0.01% to 99.99%
        treasuryPercentage = uint16(bound(treasuryPercentage, 1, 9999)); // 0.01% to 99.99%
        
        // Ensure percentages sum to 10000 (100%)
        uint256 rewardPercentage = BASIS_POINTS - treasuryPercentage;
        
        // Update parameters
        vm.startPrank(admin);
        feeProcessor.setFeePercentage(feePercentage);
        feeProcessor.updateDistributionParameters(treasuryPercentage, rewardPercentage);
        vm.stopPrank();
        
        // Calculate expected fees
        uint256 expectedTotalFee = (amount * feePercentage) / BASIS_POINTS;
        uint256 expectedTreasuryFee = (expectedTotalFee * treasuryPercentage) / BASIS_POINTS;
        uint256 expectedRewardFee = (expectedTotalFee * rewardPercentage) / BASIS_POINTS;
        
        // Handle rounding errors
        uint256 dustAmount = expectedTotalFee - (expectedTreasuryFee + expectedRewardFee);
        
        // Collect fee
        vm.prank(authorizedContract);
        uint256 actualTotalFee = feeProcessor.collectInvestmentFee(address(dloopToken), amount);
        
        // Verify total fee
        assertEq(actualTotalFee, expectedTotalFee, "Total fee amount mismatch");
        
        // Verify distribution (allow for 1 wei rounding error)
        uint256 actualTreasuryFee = dloopToken.balanceOf(treasury);
        uint256 actualRewardFee = dloopToken.balanceOf(rewardDistributor);
        
        // Check if the sum of distributed fees equals the total fee (accounting for dust)
        assertApproxEqAbs(
            actualTreasuryFee + actualRewardFee,
            expectedTotalFee,
            dustAmount,
            "Sum of distributed fees should equal total fee"
        );
    }
    
    /**
     * @dev Fuzz test for pausing and unpausing fee collection
     * @param amount Amount on which to calculate the fee
     * @param pauseFirst Whether to pause first or unpause first
     */
    function testFuzz_PauseUnpauseFeeCollection(
        uint256 amount,
        bool pauseFirst
    ) public {
        // Bound inputs
        amount = bound(amount, 1 ether, 1000 ether);
        
        if (pauseFirst) {
            // Pause fee collection
            vm.prank(admin);
            feeProcessor.pause();
            
            // Attempt to collect fee while paused (should revert)
            vm.prank(authorizedContract);
            vm.expectRevert();
            feeProcessor.collectInvestmentFee(address(dloopToken), amount);
            
            // Unpause fee collection
            vm.prank(admin);
            feeProcessor.unpause();
        } else {
            // Verify fee collection works when not paused
            vm.prank(authorizedContract);
            uint256 totalFee = feeProcessor.collectInvestmentFee(address(dloopToken), amount);
            assertGt(totalFee, 0, "Fee should be collected when not paused");
            
            // Pause fee collection
            vm.prank(admin);
            feeProcessor.pause();
            
            // Attempt to collect fee while paused (should revert)
            vm.prank(authorizedContract);
            vm.expectRevert();
            feeProcessor.collectInvestmentFee(address(dloopToken), amount);
        }
        
        // Final verification that fee collection works after unpausing
        if (pauseFirst || !pauseFirst) {
            // Ensure we're unpaused for the final test
            if (!pauseFirst) {
                vm.prank(admin);
                feeProcessor.unpause();
            }
            
            // Collect fee
            vm.prank(authorizedContract);
            uint256 totalFee = feeProcessor.collectInvestmentFee(address(dloopToken), amount);
            assertGt(totalFee, 0, "Fee should be collected after unpausing");
        }
    }
}
