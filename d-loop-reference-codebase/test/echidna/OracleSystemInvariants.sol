// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/oracles/OracleAdapter.sol";
import "../../contracts/oracles/IOracleProvider.sol";

/**
 * @title MockOracleProvider
 * @dev A mock implementation of IOracleProvider for testing
 */
contract MockOracleProvider is IOracleProvider {
    mapping(string => uint256) private prices;
    mapping(string => uint256) private timestamps;
    string[] private assets;
    bool private active = true;
    
    event AssetAdded(string asset);
    
    constructor() {
        // Initialize with some default assets
        addAsset("BTC", 60000 * 1e18);
        addAsset("ETH", 3000 * 1e18);
        addAsset("USDC", 1 * 1e18);
    }
    
    function addAsset(string memory asset, uint256 price) public {
        bool exists = false;
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            assets.push(asset);
            emit AssetAdded(asset);
        }
        
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function updatePrice(string memory asset, uint256 price) public {
        require(price > 0, "Price must be positive");
        bool found = false;
        
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                found = true;
                break;
            }
        }
        
        require(found, "Asset not supported");
        
        prices[asset] = price;
        timestamps[asset] = block.timestamp;
        emit PriceUpdated(asset, price, block.timestamp);
    }
    
    function getLatestPrice(string calldata asset) external view override returns (uint256 price, uint256 timestamp) {
        bool found = false;
        
        for (uint i = 0; i < assets.length; i++) {
            if (keccak256(bytes(assets[i])) == keccak256(bytes(asset))) {
                found = true;
                break;
            }
        }
        
        require(found, "Asset not supported");
        
        return (prices[asset], timestamps[asset]);
    }
    
    function supportedAssets() external view override returns (string[] memory) {
        return assets;
    }
    
    function isActive() external view override returns (bool status) {
        return active;
    }
    
    function setActive(bool _active) external {
        active = _active;
    }
    
    function decimals() external pure override returns (uint8) {
        return 18;
    }
}

/**
 * @title OracleSystemInvariants
 * @dev Property-based tests for the Oracle system using Echidna
 */
contract OracleSystemInvariants {
    MockOracleProvider private mockOracle;
    OracleAdapter private oracleAdapter;
    
    address private constant ADMIN = address(0x1);
    address private constant USER1 = address(0x2);
    address private constant USER2 = address(0x3);
    
    address private constant BTC_TOKEN = address(0x100);
    address private constant ETH_TOKEN = address(0x101);
    address private constant USDC_TOKEN = address(0x102);
    
    constructor() {
        // Setup mock oracle and adapter
        mockOracle = new MockOracleProvider();
        oracleAdapter = new OracleAdapter(ADMIN, address(mockOracle));
        
        // Setup initial asset mappings
        vm_startPrank(ADMIN);
        oracleAdapter.mapAsset(BTC_TOKEN, "BTC");
        oracleAdapter.mapAsset(ETH_TOKEN, "ETH");
        oracleAdapter.mapAsset(USDC_TOKEN, "USDC");
        vm_stopPrank();
    }
    
    // Echidna helper functions (required for prank)
    function vm_startPrank(address sender) internal pure {
        // This would be replaced by the actual implementation in Echidna
    }
    
    function vm_stopPrank() internal pure {
        // This would be replaced by the actual implementation in Echidna
    }
    
    /**
     * @dev Verify that prices returned by the adapter match those in the original oracle
     */
    function echidna_price_consistency() public view returns (bool) {
        (uint256 btcPriceAdapter, uint256 btcTimestampAdapter) = oracleAdapter.getAssetPrice(BTC_TOKEN);
        (uint256 btcPriceOracle, uint256 btcTimestampOracle) = mockOracle.getLatestPrice("BTC");
        
        (uint256 ethPriceAdapter, uint256 ethTimestampAdapter) = oracleAdapter.getAssetPrice(ETH_TOKEN);
        (uint256 ethPriceOracle, uint256 ethTimestampOracle) = mockOracle.getLatestPrice("ETH");
        
        (uint256 usdcPriceAdapter, uint256 usdcTimestampAdapter) = oracleAdapter.getAssetPrice(USDC_TOKEN);
        (uint256 usdcPriceOracle, uint256 usdcTimestampOracle) = mockOracle.getLatestPrice("USDC");
        
        return btcPriceAdapter == btcPriceOracle && 
               btcTimestampAdapter == btcTimestampOracle &&
               ethPriceAdapter == ethPriceOracle &&
               ethTimestampAdapter == ethTimestampOracle &&
               usdcPriceAdapter == usdcPriceOracle &&
               usdcTimestampAdapter == usdcTimestampOracle;
    }
    
    /**
     * @dev Verify that supported assets in the adapter match those that are mapped
     */
    function echidna_supported_assets_consistency() public view returns (bool) {
        address[] memory adapterAssets = oracleAdapter.getSupportedAssets();
        bool btcFound = false;
        bool ethFound = false;
        bool usdcFound = false;
        
        for (uint i = 0; i < adapterAssets.length; i++) {
            if (adapterAssets[i] == BTC_TOKEN) btcFound = true;
            if (adapterAssets[i] == ETH_TOKEN) ethFound = true;
            if (adapterAssets[i] == USDC_TOKEN) usdcFound = true;
        }
        
        return btcFound && ethFound && usdcFound && adapterAssets.length == 3;
    }
    
    /**
     * @dev Verify that only authorized admins can map assets
     * This function will be called with different msg.sender values by Echidna
     */
    function mapNewAsset(address token, string calldata identifier) public {
        try oracleAdapter.mapAsset(token, identifier) {
            // If we get here, the function call succeeded.
            // The call should only succeed if the caller is ADMIN.
            assert(msg.sender == ADMIN);
        } catch {
            // If we get here, the function call failed.
            // The call should fail if the caller is not ADMIN.
            assert(msg.sender != ADMIN);
        }
    }
    
    /**
     * @dev Verify that asset mapping is correctly reflected in price queries
     */
    function echidna_asset_mapping_reflected_in_prices() public returns (bool) {
        // Add a new asset to the mock oracle
        string memory newAsset = "XRP";
        address newToken = address(0x103);
        uint256 newPrice = 1 * 1e18;
        
        mockOracle.addAsset(newAsset, newPrice);
        
        // Map the asset in the adapter (requires ADMIN)
        vm_startPrank(ADMIN);
        oracleAdapter.mapAsset(newToken, newAsset);
        vm_stopPrank();
        
        // Check if the asset is now accessible through the adapter
        (uint256 adapterPrice, ) = oracleAdapter.getAssetPrice(newToken);
        
        return adapterPrice == newPrice;
    }
    
    /**
     * @dev Verify that unmapped assets are not reported as supported
     */
    function echidna_unmapped_assets_not_supported() public view returns (bool) {
        address unmappedToken = address(0x999);
        return !oracleAdapter.isAssetSupported(unmappedToken);
    }
    
    /**
     * @dev Verify that non-existant assets in the original oracle can't be mapped
     */
    function echidna_invalid_assets_not_mappable() public returns (bool) {
        address newToken = address(0x104);
        string memory nonExistentAsset = "NONEXISTENT";
        
        // Try to map a non-existent asset
        vm_startPrank(ADMIN);
        try oracleAdapter.mapAsset(newToken, nonExistentAsset) {
            vm_stopPrank();
            
            // Check if the mapping appears to work
            bool supported = oracleAdapter.isAssetSupported(newToken);
            
            // If the mapping worked, verify it's not actually returning valid prices
            if (supported) {
                try oracleAdapter.getAssetPrice(newToken) returns (uint256, uint256) {
                    // If we get here, the price check succeeded, which shouldn't happen
                    return false;
                } catch {
                    // Expected: price check should fail for non-existent assets
                    return true;
                }
            }
            
            return true;
        } catch {
            vm_stopPrank();
            // Also acceptable: mapping fails immediately
            return true;
        }
    }
    
    /**
     * @dev Verify that price updates in the oracle are reflected in the adapter
     */
    function echidna_price_updates_reflected() public returns (bool) {
        // Update a price in the mock oracle
        uint256 newBtcPrice = 65000 * 1e18;
        mockOracle.updatePrice("BTC", newBtcPrice);
        
        // Check if the price is updated in the adapter
        (uint256 updatedPrice, ) = oracleAdapter.getAssetPrice(BTC_TOKEN);
        
        return updatedPrice == newBtcPrice;
    }
}