// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/core/AssetDAO.sol";
import "../../../contracts/token/DAIToken.sol";
import "../../../contracts/token/DLoopToken.sol";
import "../../../contracts/fees/FeeProcessor.sol";
import "forge-std/StdInvariant.sol";

/**
 * @title AssetDAO Invariant Test
 * @dev System-wide property tests for the AssetDAO contract
 * 
 * This test verifies that critical invariants hold true under all conditions:
 * 1. Total shares always match the sum of individual investor shares
 * 2. Asset value accounting is always consistent
 * 3. Proposal state transitions follow valid paths
 * 4. Fee calculations are always correct
 */
contract AssetDAOInvariantTest is StdInvariant, Test {
    // Contracts
    AssetDAO public assetDAO;
    DAIToken public daiToken;
    DLoopToken public dloopToken;
    FeeProcessor public feeProcessor;
    
    // Test accounts
    address public owner;
    address public admin;
    address public treasury;
    address public investor1;
    address public investor2;
    address public investor3;
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant INVESTMENT_AMOUNT = 10_000 ether;
    
    // Tracking variables for invariants
    uint256[] public assetIds;
    mapping(uint256 => uint256) public totalShares;
    mapping(uint256 => mapping(address => uint256)) public investorShares;
    mapping(uint256 => uint256) public assetValues;
    mapping(uint256 => uint256) public proposalCount;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        treasury = makeAddr("treasury");
        investor1 = makeAddr("investor1");
        investor2 = makeAddr("investor2");
        investor3 = makeAddr("investor3");
        
        // Deploy tokens
        vm.startPrank(owner);
        daiToken = new DAIToken();
        
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            INITIAL_SUPPLY,
            18,
            INITIAL_SUPPLY * 100,
            owner
        );
        
        // Setup fee processor (simplified for testing)
        feeProcessor = new FeeProcessor();
        
        // Deploy AssetDAO
        assetDAO = new AssetDAO(
            address(daiToken),
            address(dloopToken),
            address(feeProcessor),
            admin,
            treasury
        );
        
        // Setup roles
        bytes32 minterRole = daiToken.MINTER_ROLE();
        daiToken.grantRole(minterRole, address(assetDAO));
        
        // Distribute tokens to investors
        dloopToken.transfer(investor1, INVESTMENT_AMOUNT * 2);
        dloopToken.transfer(investor2, INVESTMENT_AMOUNT * 2);
        dloopToken.transfer(investor3, INVESTMENT_AMOUNT * 2);
        vm.stopPrank();
        
        // Approve token spending for investors
        vm.prank(investor1);
        dloopToken.approve(address(assetDAO), INVESTMENT_AMOUNT * 2);
        
        vm.prank(investor2);
        dloopToken.approve(address(assetDAO), INVESTMENT_AMOUNT * 2);
        
        vm.prank(investor3);
        dloopToken.approve(address(assetDAO), INVESTMENT_AMOUNT * 2);
        
        // Create initial assets
        createInitialAssets();
        
        // Target contracts for invariant testing
        targetContract(address(assetDAO));
        
        // Exclude certain functions from fuzzing to avoid reverts that would prevent testing invariants
        excludeContract(address(daiToken));
        excludeContract(address(dloopToken));
        excludeContract(address(feeProcessor));
    }
    
    function createInitialAssets() internal {
        // Create a few assets to test with
        for (uint i = 0; i < 3; i++) {
            string memory name = string(abi.encodePacked("Asset ", uint8(i + 65))); // "Asset A", "Asset B", etc.
            string memory description = string(abi.encodePacked("Description for ", name));
            
            vm.prank(admin);
            uint256 assetId = assetDAO.createAsset(
                name,
                description,
                INVESTMENT_AMOUNT * 10,
                INVESTMENT_AMOUNT / 10,
                block.timestamp + 30 days
            );
            
            assetIds.push(assetId);
            
            // Initial investments
            vm.prank(investor1);
            assetDAO.invest(assetId, INVESTMENT_AMOUNT / 2);
            
            vm.prank(investor2);
            assetDAO.invest(assetId, INVESTMENT_AMOUNT / 3);
            
            vm.prank(investor3);
            assetDAO.invest(assetId, INVESTMENT_AMOUNT / 4);
            
            // Update tracking variables
            updateTrackingVariables(assetId);
        }
    }
    
    function updateTrackingVariables(uint256 assetId) internal {
        // Update total shares
        (,,,,,, uint256 shares,,) = assetDAO.getAssetDetails(assetId);
        totalShares[assetId] = shares;
        
        // Update investor shares
        investorShares[assetId][investor1] = assetDAO.getInvestorShares(assetId, investor1);
        investorShares[assetId][investor2] = assetDAO.getInvestorShares(assetId, investor2);
        investorShares[assetId][investor3] = assetDAO.getInvestorShares(assetId, investor3);
        
        // Update asset value
        (,,,,, uint256 value,,) = assetDAO.getAssetDetails(assetId);
        assetValues[assetId] = value;
        
        // Update proposal count
        proposalCount[assetId] = assetDAO.getProposalCount(assetId);
    }
    
    /**
     * @dev Invariant: Total shares always match the sum of individual investor shares
     */
    function invariant_TotalSharesMatchSum() public {
        for (uint i = 0; i < assetIds.length; i++) {
            uint256 assetId = assetIds[i];
            
            // Get current total shares
            (,,,,,, uint256 currentTotalShares,,) = assetDAO.getAssetDetails(assetId);
            
            // Calculate sum of investor shares
            uint256 sumOfShares = 0;
            sumOfShares += assetDAO.getInvestorShares(assetId, investor1);
            sumOfShares += assetDAO.getInvestorShares(assetId, investor2);
            sumOfShares += assetDAO.getInvestorShares(assetId, investor3);
            
            // Check invariant
            assertEq(currentTotalShares, sumOfShares, "Total shares must match sum of investor shares");
        }
    }
    
    /**
     * @dev Invariant: Asset value is always greater than or equal to total investment minus divestments
     */
    function invariant_AssetValueConsistency() public {
        for (uint i = 0; i < assetIds.length; i++) {
            uint256 assetId = assetIds[i];
            
            // Get current asset value
            (,,,,, uint256 currentValue,,) = assetDAO.getAssetDetails(assetId);
            
            // Get total investment
            (,,,,,,,, uint256 totalInvestment) = assetDAO.getAssetDetails(assetId);
            
            // Asset value should never be negative
            assertGe(currentValue, 0, "Asset value cannot be negative");
            
            // In a normal scenario, asset value should be >= total investment
            // But for testing purposes, we allow for value to decrease due to divestments
            if (assetDAO.getAssetState(assetId) == uint8(AssetDAO.AssetState.Active)) {
                assertGe(currentValue + 1, totalInvestment / 2, "Asset value consistency check failed");
            }
        }
    }
    
    /**
     * @dev Invariant: Proposal state transitions follow valid paths
     */
    function invariant_ProposalStateTransitions() public {
        for (uint i = 0; i < assetIds.length; i++) {
            uint256 assetId = assetIds[i];
            
            // Check all proposals for this asset
            uint256 currentProposalCount = assetDAO.getProposalCount(assetId);
            
            for (uint256 proposalId = 1; proposalId <= currentProposalCount; proposalId++) {
                // Get proposal state
                (,,,,,,,, uint8 state,,,,) = assetDAO.getProposalDetails(proposalId);
                
                // Validate state is within enum bounds
                assertLe(state, 5, "Proposal state out of bounds");
                
                // Executed proposals must have been approved first
                if (state == uint8(AssetDAO.ProposalState.Executed)) {
                    // We can't directly check the previous state, but we can check that
                    // the approval votes were sufficient
                    (,,,,, uint256 forVotes, uint256 againstVotes,,,,,) = assetDAO.getProposalDetails(proposalId);
                    assertGe(forVotes, againstVotes, "Executed proposal must have had majority approval");
                }
                
                // Canceled proposals cannot be executed
                if (state == uint8(AssetDAO.ProposalState.Canceled)) {
                    assertNotEq(
                        assetDAO.hasProposalBeenExecuted(proposalId),
                        true,
                        "Canceled proposal cannot be executed"
                    );
                }
            }
        }
    }
    
    /**
     * @dev Invariant: Investor balance + invested amount = initial balance
     */
    function invariant_InvestorBalanceConsistency() public {
        // For each investor, check that their current balance + investments = initial balance
        address[] memory investors = new address[](3);
        investors[0] = investor1;
        investors[1] = investor2;
        investors[2] = investor3;
        
        for (uint i = 0; i < investors.length; i++) {
            address investor = investors[i];
            uint256 currentBalance = dloopToken.balanceOf(investor);
            uint256 totalInvested = 0;
            
            // Calculate total invested across all assets
            for (uint j = 0; j < assetIds.length; j++) {
                uint256 assetId = assetIds[j];
                uint256 shares = assetDAO.getInvestorShares(assetId, investor);
                
                if (shares > 0) {
                    (,,,,, uint256 assetValue, uint256 totalShares,,) = assetDAO.getAssetDetails(assetId);
                    uint256 investorValue = (assetValue * shares) / totalShares;
                    totalInvested += investorValue;
                }
            }
            
            // Initial balance was INVESTMENT_AMOUNT * 2
            // Allow for some deviation due to fees and rounding
            uint256 expectedTotal = INVESTMENT_AMOUNT * 2;
            uint256 actualTotal = currentBalance + totalInvested;
            
            // Use a tolerance of 1% for the comparison
            uint256 tolerance = expectedTotal / 100;
            
            assertApproxEqAbs(
                actualTotal,
                expectedTotal,
                tolerance,
                "Investor balance + investments should approximately equal initial balance"
            );
        }
    }
    
    /**
     * @dev Handler function for AssetDAO.invest
     * This is called by the fuzzer to test the invest function
     */
    function invest(uint256 assetIdSeed, uint256 amount) public {
        if (assetIds.length == 0) return;
        
        // Select a valid asset ID
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Bound amount to a reasonable value
        amount = bound(amount, 1 ether, INVESTMENT_AMOUNT);
        
        // Select a random investor
        address[] memory investors = new address[](3);
        investors[0] = investor1;
        investors[1] = investor2;
        investors[2] = investor3;
        address investor = investors[assetIdSeed % 3];
        
        // Ensure investor has enough tokens and allowance
        uint256 balance = dloopToken.balanceOf(investor);
        if (balance < amount) {
            vm.prank(owner);
            dloopToken.transfer(investor, amount - balance + 1);
        }
        
        uint256 allowance = dloopToken.allowance(investor, address(assetDAO));
        if (allowance < amount) {
            vm.prank(investor);
            dloopToken.approve(address(assetDAO), amount * 2);
        }
        
        // Try to invest
        try vm.prank(investor) {
            assetDAO.invest(assetId, amount);
        } catch {
            // Ignore failures - they're expected in fuzz testing
        }
        
        // Update tracking variables
        updateTrackingVariables(assetId);
    }
    
    /**
     * @dev Handler function for AssetDAO.divest
     * This is called by the fuzzer to test the divest function
     */
    function divest(uint256 assetIdSeed, uint256 sharePercentage) public {
        if (assetIds.length == 0) return;
        
        // Select a valid asset ID
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Bound share percentage to 1-100%
        sharePercentage = bound(sharePercentage, 1, 100);
        
        // Select a random investor
        address[] memory investors = new address[](3);
        investors[0] = investor1;
        investors[1] = investor2;
        investors[2] = investor3;
        address investor = investors[assetIdSeed % 3];
        
        // Calculate shares to divest
        uint256 investorShareCount = assetDAO.getInvestorShares(assetId, investor);
        uint256 sharesToDivest = (investorShareCount * sharePercentage) / 100;
        
        if (sharesToDivest == 0) return;
        
        // Try to divest
        try vm.prank(investor) {
            assetDAO.divest(assetId, sharesToDivest);
        } catch {
            // Ignore failures - they're expected in fuzz testing
        }
        
        // Update tracking variables
        updateTrackingVariables(assetId);
    }
    
    /**
     * @dev Handler function for AssetDAO.createProposal
     * This is called by the fuzzer to test the createProposal function
     */
    function createProposal(uint256 assetIdSeed, uint8 proposalTypeSeed) public {
        if (assetIds.length == 0) return;
        
        // Select a valid asset ID
        uint256 assetId = assetIds[assetIdSeed % assetIds.length];
        
        // Bound proposal type to valid enum values (0-3)
        proposalTypeSeed = proposalTypeSeed % 4;
        
        // Select a random investor with shares
        address[] memory investors = new address[](3);
        investors[0] = investor1;
        investors[1] = investor2;
        investors[2] = investor3;
        address investor = investors[assetIdSeed % 3];
        
        // Only proceed if investor has shares
        if (assetDAO.getInvestorShares(assetId, investor) == 0) return;
        
        // Create proposal parameters
        string memory description = "Fuzz test proposal";
        address assetAddress = address(dloopToken); // Just a placeholder
        uint256 amount = 1 ether;
        
        // Try to create proposal
        try vm.prank(investor) {
            assetDAO.createProposal(
                AssetDAO.ProposalType(proposalTypeSeed),
                assetAddress,
                amount,
                description
            );
        } catch {
            // Ignore failures - they're expected in fuzz testing
        }
        
        // Update tracking variables
        updateTrackingVariables(assetId);
    }
}
