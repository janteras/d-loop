// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../../contracts/adapters/PriceOracleAdapter.sol";
import "../../../contracts/oracles/PriceOracle.sol";
import "../../../contracts/token/DLoopToken.sol";

/**
 * @title PriceOracleAdapter Fuzz Test
 * @dev Property-based tests for the PriceOracleAdapter contract
 * 
 * This test focuses on:
 * 1. Price retrieval consistency with the underlying oracle
 * 2. Decimals handling for various assets
 * 3. Edge cases in price and decimal operations
 */
contract PriceOracleAdapterTest is Test {
    // Contracts
    PriceOracleAdapter public adapter;
    PriceOracle public oracle;
    DLoopToken public dloopToken;
    
    // Test accounts
    address public owner;
    address public admin;
    address public user;
    
    // Test assets
    address[] public assets;
    
    function setUp() public {
        // Setup accounts
        owner = makeAddr("owner");
        admin = makeAddr("admin");
        user = makeAddr("user");
        
        vm.startPrank(owner);
        
        // Deploy token for testing
        dloopToken = new DLoopToken(
            "D-Loop Token",
            "DLOOP",
            1_000_000 ether,
            18,
            1_000_000_000 ether,
            owner
        );
        
        // Deploy oracle
        oracle = new PriceOracle();
        
        // Deploy adapter
        adapter = new PriceOracleAdapter(address(oracle));
        
        // Setup test assets
        assets = new address[](5);
        for (uint8 i = 0; i < 5; i++) {
            assets[i] = address(uint160(uint256(keccak256(abi.encodePacked("asset", i)))));
        }
        
        // Add dloopToken as a test asset
        assets.push(address(dloopToken));
        
        // Set initial prices in the oracle
        for (uint8 i = 0; i < assets.length; i++) {
            oracle.setPrice(assets[i], (i + 1) * 100 * 10**8); // $100, $200, etc. with 8 decimals
        }
        
        vm.stopPrank();
    }
    
    /**
     * @dev Fuzz test for price retrieval consistency
     * @param assetIndex Index to select an asset
     * @param price New price to set
     */
    function testFuzz_PriceConsistency(uint8 assetIndex, uint256 price) public {
        // Bound inputs
        assetIndex = uint8(bound(assetIndex, 0, assets.length - 1));
        price = bound(price, 1, 1_000_000_000 * 10**8); // $0.00000001 to $1,000,000,000
        
        address asset = assets[assetIndex];
        
        // Set price in the oracle
        vm.prank(owner);
        oracle.setPrice(asset, price);
        
        // Verify adapter returns the same price
        assertEq(adapter.getAssetPrice(asset), price, "Adapter should return the same price as oracle");
    }
    
    /**
     * @dev Fuzz test for decimals handling
     * @param assetIndex Index to select an asset
     * @param decimals Custom decimals to set
     */
    function testFuzz_DecimalsHandling(uint8 assetIndex, uint8 decimals) public {
        // Bound inputs
        assetIndex = uint8(bound(assetIndex, 0, assets.length - 1));
        decimals = uint8(bound(decimals, 1, 36)); // 1 to 36 decimals
        
        address asset = assets[assetIndex];
        
        // Check default decimals
        assertEq(adapter.getAssetDecimals(asset), 8, "Default decimals should be 8");
        
        // Set custom decimals
        vm.prank(owner);
        adapter.setAssetDecimals(asset, decimals);
        
        // Verify custom decimals
        assertEq(adapter.getAssetDecimals(asset), decimals, "Adapter should return custom decimals when set");
    }
    
    /**
     * @dev Fuzz test for price updates
     * @param assetIndex Index to select an asset
     * @param initialPrice Initial price to set
     * @param updatedPrice Updated price to set
     */
    function testFuzz_PriceUpdates(uint8 assetIndex, uint256 initialPrice, uint256 updatedPrice) public {
        // Bound inputs
        assetIndex = uint8(bound(assetIndex, 0, assets.length - 1));
        initialPrice = bound(initialPrice, 1, 1_000_000 * 10**8); // $0.00000001 to $1,000,000
        updatedPrice = bound(updatedPrice, 1, 1_000_000 * 10**8); // $0.00000001 to $1,000,000
        vm.assume(initialPrice != updatedPrice); // Ensure prices are different
        
        address asset = assets[assetIndex];
        
        // Set initial price
        vm.prank(owner);
        oracle.setPrice(asset, initialPrice);
        
        // Verify initial price through adapter
        assertEq(adapter.getAssetPrice(asset), initialPrice, "Adapter should return initial price");
        
        // Update price
        vm.prank(owner);
        oracle.setPrice(asset, updatedPrice);
        
        // Verify updated price through adapter
        assertEq(adapter.getAssetPrice(asset), updatedPrice, "Adapter should return updated price");
    }
    
    /**
     * @dev Fuzz test for multiple asset prices
     * @param priceMultipliers Array of multipliers for prices
     */
    function testFuzz_MultipleAssetPrices(uint256[] calldata priceMultipliers) public {
        // Bound input array length
        vm.assume(priceMultipliers.length > 0 && priceMultipliers.length <= assets.length);
        
        // Set prices for multiple assets
        for (uint8 i = 0; i < priceMultipliers.length; i++) {
            // Bound price multiplier
            uint256 multiplier = bound(priceMultipliers[i], 1, 1000);
            uint256 price = multiplier * 10**8; // $1 to $1000 with 8 decimals
            
            vm.prank(owner);
            oracle.setPrice(assets[i], price);
        }
        
        // Verify all prices through adapter
        for (uint8 i = 0; i < priceMultipliers.length; i++) {
            uint256 expectedPrice = oracle.getPrice(assets[i]);
            assertEq(adapter.getAssetPrice(assets[i]), expectedPrice, "Adapter should return correct price for each asset");
        }
    }
    
    /**
     * @dev Fuzz test for zero address handling
     * @param price Price to set for zero address
     */
    function testFuzz_ZeroAddressHandling(uint256 price) public {
        // Bound price
        price = bound(price, 1, 1_000_000 * 10**8); // $0.00000001 to $1,000,000
        
        // Try to set price for zero address in oracle
        vm.prank(owner);
        vm.expectRevert();
        oracle.setPrice(address(0), price);
        
        // Try to get price for zero address through adapter
        // This should not revert but return 0 or the default value
        uint256 zeroAddressPrice = adapter.getAssetPrice(address(0));
        assertEq(zeroAddressPrice, 0, "Adapter should handle zero address gracefully");
    }
    
    /**
     * @dev Fuzz test for decimals edge cases
     * @param assetIndex Index to select an asset
     * @param decimals Decimals to set
     */
    function testFuzz_DecimalsEdgeCases(uint8 assetIndex, uint8 decimals) public {
        // Bound inputs
        assetIndex = uint8(bound(assetIndex, 0, assets.length - 1));
        
        address asset = assets[assetIndex];
        
        // Test with zero decimals
        vm.prank(owner);
        adapter.setAssetDecimals(asset, 0);
        
        // Zero decimals should result in default decimals (8)
        assertEq(adapter.getAssetDecimals(asset), 8, "Zero decimals should result in default decimals");
        
        // Test with very high decimals
        decimals = uint8(bound(decimals, 30, 255)); // Very high decimals
        
        vm.prank(owner);
        adapter.setAssetDecimals(asset, decimals);
        
        // Verify high decimals
        assertEq(adapter.getAssetDecimals(asset), decimals, "Adapter should handle high decimals correctly");
    }
}
