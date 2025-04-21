// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IPriceOracle.sol";

/**
 * @title MultiOracleConsensus
 * @notice Oracle that aggregates multiple price sources with weighted consensus
 * @dev Provides reliable price data by combining multiple oracles
 */
contract MultiOracleConsensus is IPriceOracle, AccessControl, Pausable {
    bytes32 public constant ORACLE_ADMIN_ROLE = keccak256("ORACLE_ADMIN_ROLE");
    bytes32 public constant SOURCE_MANAGER_ROLE = keccak256("SOURCE_MANAGER_ROLE");
    
    struct OracleSource {
        address oracleAddress;       // Address of the price oracle
        string name;                 // Name of the oracle source
        uint8 weight;                // Weight of this oracle (0-100)
        bool active;                 // Whether this oracle is active
    }
    
    struct AssetConfig {
        bool supported;              // Whether the asset is supported
        uint8 minOracleCount;        // Minimum number of oracles required for consensus
        uint8 reliabilityThreshold;  // Minimum reliability score required for an oracle
        mapping(uint256 => address) oracleList; // List of oracles for this asset
        uint8 oracleCount;           // Number of oracles for this asset
        bool active;                 // Whether this asset is active
    }
    
    // Asset => configuration
    mapping(address => AssetConfig) public assetConfigs;
    
    // Oracle address => OracleSource
    mapping(address => OracleSource) public oracleSources;
    
    // List of registered oracle addresses
    address[] public registeredOracles;
    
    // Maximum price deviation percentage (in basis points, 10000 = 100%)
    uint256 public maxPriceDeviation = 1000; // 10% default
    
    // Maximum time threshold for price data (seconds)
    uint256 public maxTimeThreshold = 86400; // 24 hours
    
    // Events
    event OracleSourceAdded(address indexed oracle, string name, uint8 weight);
    event OracleSourceUpdated(address indexed oracle, uint8 weight, bool active);
    event OracleSourceRemoved(address indexed oracle);
    event AssetAdded(address indexed asset, uint8 minOracleCount, uint8 reliabilityThreshold);
    event AssetUpdated(address indexed asset, uint8 minOracleCount, uint8 reliabilityThreshold, bool active);
    event AssetOraclesUpdated(address indexed asset, address[] oracles);
    event MaxDeviationUpdated(uint256 oldDeviation, uint256 newDeviation);
    event MaxTimeThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event ConsensusPriceCalculated(address indexed asset, uint256 price, uint8 oraclesUsed);
    
    /**
     * @notice Constructor for the multi-oracle consensus
     * @param admin Address to grant admin role
     */
    constructor(address admin) {
        require(admin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ADMIN_ROLE, admin);
        _grantRole(SOURCE_MANAGER_ROLE, admin);
    }
    
    /**
     * @notice Adds a new oracle source
     * @param oracle Address of the oracle
     * @param name Name of the oracle source
     * @param weight Weight of the oracle (0-100)
     */
    function addOracleSource(
        address oracle,
        string memory name,
        uint8 weight
    ) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(oracle != address(0), "Invalid oracle address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(weight > 0 && weight <= 100, "Weight must be 1-100");
        require(oracleSources[oracle].oracleAddress == address(0), "Oracle already exists");
        
        // Verify it's a valid oracle by calling interface methods
        IPriceOracle(oracle).getAssetPriceUSD(address(this)); // This will revert if invalid
        
        oracleSources[oracle] = OracleSource({
            oracleAddress: oracle,
            name: name,
            weight: weight,
            active: true
        });
        
        registeredOracles.push(oracle);
        
        emit OracleSourceAdded(oracle, name, weight);
    }
    
    /**
     * @notice Updates an existing oracle source
     * @param oracle Address of the oracle
     * @param weight Weight of the oracle (0-100)
     * @param active Whether the oracle is active
     */
    function updateOracleSource(
        address oracle,
        uint8 weight,
        bool active
    ) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(oracle != address(0), "Invalid oracle address");
        require(weight > 0 && weight <= 100, "Weight must be 1-100");
        require(oracleSources[oracle].oracleAddress != address(0), "Oracle does not exist");
        
        OracleSource storage source = oracleSources[oracle];
        source.weight = weight;
        source.active = active;
        
        emit OracleSourceUpdated(oracle, weight, active);
    }
    
    /**
     * @notice Removes an oracle source
     * @param oracle Address of the oracle to remove
     */
    function removeOracleSource(address oracle) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(oracle != address(0), "Invalid oracle address");
        require(oracleSources[oracle].oracleAddress != address(0), "Oracle does not exist");
        
        // Remove the oracle from the registered list
        for (uint256 i = 0; i < registeredOracles.length; i++) {
            if (registeredOracles[i] == oracle) {
                registeredOracles[i] = registeredOracles[registeredOracles.length - 1];
                registeredOracles.pop();
                break;
            }
        }
        
        // Remove the oracle from all asset configurations
        for (uint256 i = 0; i < registeredOracles.length; i++) {
            address asset = registeredOracles[i];
            AssetConfig storage config = assetConfigs[asset];
            
            if (config.supported) {
                // Check if this oracle is used for this asset
                bool found = false;
                uint256 foundIndex = 0;
                
                for (uint8 j = 0; j < config.oracleCount; j++) {
                    if (config.oracleList[j] == oracle) {
                        found = true;
                        foundIndex = j;
                        break;
                    }
                }
                
                // Remove the oracle from this asset's list
                if (found) {
                    for (uint8 j = uint8(foundIndex); j < config.oracleCount - 1; j++) {
                        config.oracleList[j] = config.oracleList[j + 1];
                    }
                    delete config.oracleList[config.oracleCount - 1];
                    config.oracleCount--;
                }
            }
        }
        
        delete oracleSources[oracle];
        
        emit OracleSourceRemoved(oracle);
    }
    
    /**
     * @notice Adds a new asset
     * @param asset Address of the asset
     * @param minOracleCount Minimum oracles required for consensus
     * @param reliabilityThreshold Minimum reliability score required
     * @param oracles Array of oracle addresses for this asset
     */
    function addAsset(
        address asset,
        uint8 minOracleCount,
        uint8 reliabilityThreshold,
        address[] memory oracles
    ) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(minOracleCount > 0, "Min oracle count must be positive");
        require(reliabilityThreshold > 0 && reliabilityThreshold <= 100, "Threshold must be 1-100");
        require(oracles.length >= minOracleCount, "Not enough oracles provided");
        require(!assetConfigs[asset].supported, "Asset already exists");
        
        // Initialize asset config
        AssetConfig storage config = assetConfigs[asset];
        config.supported = true;
        config.minOracleCount = minOracleCount;
        config.reliabilityThreshold = reliabilityThreshold;
        config.active = true;
        
        // Add oracles to the asset
        for (uint8 i = 0; i < oracles.length; i++) {
            require(oracleSources[oracles[i]].oracleAddress != address(0), "Oracle does not exist");
            config.oracleList[i] = oracles[i];
        }
        
        config.oracleCount = uint8(oracles.length);
        
        emit AssetAdded(asset, minOracleCount, reliabilityThreshold);
        emit AssetOraclesUpdated(asset, oracles);
    }
    
    /**
     * @notice Updates an existing asset
     * @param asset Address of the asset
     * @param minOracleCount Minimum oracles required for consensus
     * @param reliabilityThreshold Minimum reliability score required
     * @param active Whether the asset is active
     */
    function updateAsset(
        address asset,
        uint8 minOracleCount,
        uint8 reliabilityThreshold,
        bool active
    ) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(minOracleCount > 0, "Min oracle count must be positive");
        require(reliabilityThreshold > 0 && reliabilityThreshold <= 100, "Threshold must be 1-100");
        require(assetConfigs[asset].supported, "Asset does not exist");
        
        AssetConfig storage config = assetConfigs[asset];
        config.minOracleCount = minOracleCount;
        config.reliabilityThreshold = reliabilityThreshold;
        config.active = active;
        
        emit AssetUpdated(asset, minOracleCount, reliabilityThreshold, active);
    }
    
    /**
     * @notice Updates the oracles for an asset
     * @param asset Address of the asset
     * @param oracles Array of oracle addresses
     */
    function updateAssetOracles(
        address asset,
        address[] memory oracles
    ) 
        external 
        onlyRole(SOURCE_MANAGER_ROLE) 
    {
        require(asset != address(0), "Invalid asset address");
        require(oracles.length >= assetConfigs[asset].minOracleCount, "Not enough oracles");
        require(assetConfigs[asset].supported, "Asset does not exist");
        
        AssetConfig storage config = assetConfigs[asset];
        
        // Clear existing oracles
        for (uint8 i = 0; i < config.oracleCount; i++) {
            delete config.oracleList[i];
        }
        
        // Add new oracles
        for (uint8 i = 0; i < oracles.length; i++) {
            require(oracleSources[oracles[i]].oracleAddress != address(0), "Oracle does not exist");
            config.oracleList[i] = oracles[i];
        }
        
        config.oracleCount = uint8(oracles.length);
        
        emit AssetOraclesUpdated(asset, oracles);
    }
    
    /**
     * @notice Sets the maximum price deviation percentage
     * @param deviation New maximum deviation in basis points (10000 = 100%)
     */
    function setMaxPriceDeviation(uint256 deviation) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(deviation > 0 && deviation <= 5000, "Deviation must be 1-50%");
        
        uint256 oldDeviation = maxPriceDeviation;
        maxPriceDeviation = deviation;
        
        emit MaxDeviationUpdated(oldDeviation, deviation);
    }
    
    /**
     * @notice Sets the maximum time threshold for price data
     * @param threshold New time threshold in seconds
     */
    function setMaxTimeThreshold(uint256 threshold) 
        external 
        onlyRole(ORACLE_ADMIN_ROLE) 
    {
        require(threshold > 0, "Threshold must be positive");
        
        uint256 oldThreshold = maxTimeThreshold;
        maxTimeThreshold = threshold;
        
        emit MaxTimeThresholdUpdated(oldThreshold, threshold);
    }
    
    /**
     * @notice Pauses the oracle
     */
    function pause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the oracle
     */
    function unpause() external onlyRole(ORACLE_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets the price of an asset in USD with consensus
     * @param asset The address of the asset
     * @return price The consensus price of the asset in USD with 8 decimals
     */
    function getAssetPriceUSD(address asset) 
        external 
        view 
        override 
        whenNotPaused 
        returns (uint256) 
    {
        require(assetConfigs[asset].supported, "Asset not supported");
        require(assetConfigs[asset].active, "Asset not active");
        
        AssetConfig storage config = assetConfigs[asset];
        
        // Get prices from all active oracles for this asset
        uint256[] memory prices = new uint256[](config.oracleCount);
        uint8[] memory weights = new uint8[](config.oracleCount);
        uint8[] memory reliabilities = new uint8[](config.oracleCount);
        bool[] memory includedOracles = new bool[](config.oracleCount);
        
        uint8 validOracleCount = 0;
        
        for (uint8 i = 0; i < config.oracleCount; i++) {
            address oracle = config.oracleList[i];
            
            // Skip inactive oracles
            if (!oracleSources[oracle].active) {
                continue;
            }
            
            try IPriceOracle(oracle).getAssetPriceUSD(asset) returns (uint256 price) {
                // Check price is positive
                if (price == 0) {
                    continue;
                }
                
                // Get reliability score
                uint8 reliability;
                try IPriceOracle(oracle).getReliabilityScore(asset) returns (uint8 score) {
                    reliability = score;
                } catch {
                    reliability = 0;
                }
                
                // Check reliability meets threshold
                if (reliability < config.reliabilityThreshold) {
                    continue;
                }
                
                // Check timestamp is fresh
                uint256 timestamp;
                try IPriceOracle(oracle).getLastUpdateTimestamp(asset) returns (uint256 time) {
                    timestamp = time;
                } catch {
                    continue;
                }
                
                if (block.timestamp - timestamp > maxTimeThreshold) {
                    continue;
                }
                
                // Oracle is valid, save its price and weight
                prices[validOracleCount] = price;
                weights[validOracleCount] = oracleSources[oracle].weight;
                reliabilities[validOracleCount] = reliability;
                includedOracles[validOracleCount] = true;
                validOracleCount++;
                
            } catch {
                // Oracle call failed, skip it
                continue;
            }
        }
        
        // Check we have enough valid oracles
        require(validOracleCount >= config.minOracleCount, "Not enough valid oracles");
        
        // Calculate median price as a reference point for deviation check
        uint256 medianPrice = _calculateMedianPrice(prices, includedOracles, validOracleCount);
        
        // Filter out prices that deviate too much from the median
        for (uint8 i = 0; i < validOracleCount; i++) {
            if (!includedOracles[i]) {
                continue;
            }
            
            uint256 deviation;
            if (prices[i] > medianPrice) {
                deviation = ((prices[i] - medianPrice) * 10000) / medianPrice;
            } else {
                deviation = ((medianPrice - prices[i]) * 10000) / medianPrice;
            }
            
            if (deviation > maxPriceDeviation) {
                includedOracles[i] = false;
                validOracleCount--;
            }
        }
        
        // Check we still have enough valid oracles after filtering
        require(validOracleCount >= config.minOracleCount, "Not enough valid oracles after filtering");
        
        // Calculate weighted average price
        uint256 totalWeight = 0;
        uint256 weightedSum = 0;
        
        for (uint8 i = 0; i < prices.length; i++) {
            if (includedOracles[i]) {
                uint256 adjustedWeight = (uint256(weights[i]) * uint256(reliabilities[i])) / 100;
                totalWeight += adjustedWeight;
                weightedSum += prices[i] * adjustedWeight;
            }
        }
        
        require(totalWeight > 0, "Total weight is zero");
        
        uint256 consensusPrice = weightedSum / totalWeight;
        
        // Emit event but it's a view function, so this isn't actually emitted
        // Only done for documentation purposes
        emit ConsensusPriceCalculated(asset, consensusPrice, validOracleCount);
        
        return consensusPrice;
    }
    
    /**
     * @notice Gets the latest update timestamp for the price of an asset
     * @param asset The address of the asset
     * @return timestamp The timestamp of the most recent valid oracle update
     */
    function getLastUpdateTimestamp(address asset) 
        external 
        view 
        override 
        returns (uint256) 
    {
        require(assetConfigs[asset].supported, "Asset not supported");
        
        AssetConfig storage config = assetConfigs[asset];
        
        uint256 latestTimestamp = 0;
        
        for (uint8 i = 0; i < config.oracleCount; i++) {
            address oracle = config.oracleList[i];
            
            if (!oracleSources[oracle].active) {
                continue;
            }
            
            try IPriceOracle(oracle).getLastUpdateTimestamp(asset) returns (uint256 timestamp) {
                if (timestamp > latestTimestamp) {
                    latestTimestamp = timestamp;
                }
            } catch {
                continue;
            }
        }
        
        return latestTimestamp;
    }
    
    /**
     * @notice Gets the reliability score of the price data
     * @param asset The address of the asset
     * @return score The reliability score (0-100)
     */
    function getReliabilityScore(address asset) 
        external 
        view 
        override 
        returns (uint8) 
    {
        require(assetConfigs[asset].supported, "Asset not supported");
        
        AssetConfig storage config = assetConfigs[asset];
        
        uint16 totalScore = 0;
        uint8 validOracleCount = 0;
        
        for (uint8 i = 0; i < config.oracleCount; i++) {
            address oracle = config.oracleList[i];
            
            if (!oracleSources[oracle].active) {
                continue;
            }
            
            try IPriceOracle(oracle).getReliabilityScore(asset) returns (uint8 score) {
                if (score >= config.reliabilityThreshold) {
                    totalScore += score;
                    validOracleCount++;
                }
            } catch {
                continue;
            }
        }
        
        if (validOracleCount == 0) {
            return 0;
        }
        
        uint8 avgScore = uint8(totalScore / validOracleCount);
        
        // Adjust score based on oracle count
        if (validOracleCount < config.minOracleCount) {
            return 0; // Not enough oracles
        } else {
            // Bonus for having more oracles than required (up to 20% bonus)
            uint8 countBonus = uint8(((validOracleCount - config.minOracleCount) * 20) / config.minOracleCount);
            countBonus = countBonus > 20 ? 20 : countBonus;
            
            uint16 adjustedScore = uint16(avgScore) + uint16(avgScore) * countBonus / 100;
            return adjustedScore > 100 ? 100 : uint8(adjustedScore);
        }
    }
    
    /**
     * @notice Checks if the oracle supports an asset
     * @param asset The address of the asset
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) 
        external 
        view 
        override 
        returns (bool) 
    {
        return assetConfigs[asset].supported && assetConfigs[asset].active;
    }
    
    /**
     * @notice Gets the number of registered oracles
     * @return count Number of registered oracles
     */
    function getRegisteredOracleCount() external view returns (uint256) {
        return registeredOracles.length;
    }
    
    /**
     * @notice Gets the oracles configured for an asset
     * @param asset Address of the asset
     * @return oracles Array of oracle addresses
     */
    function getAssetOracles(address asset) 
        external 
        view 
        returns (address[] memory oracles) 
    {
        require(assetConfigs[asset].supported, "Asset not supported");
        
        AssetConfig storage config = assetConfigs[asset];
        oracles = new address[](config.oracleCount);
        
        for (uint8 i = 0; i < config.oracleCount; i++) {
            oracles[i] = config.oracleList[i];
        }
        
        return oracles;
    }
    
    /**
     * @notice Gets asset configuration details
     * @param asset Address of the asset
     * @return minOracleCount Minimum oracles required
     * @return reliabilityThreshold Minimum reliability required
     * @return oracleCount Number of oracles for this asset
     * @return active Whether the asset is active
     */
    function getAssetConfig(address asset) 
        external 
        view 
        returns (
            uint8 minOracleCount,
            uint8 reliabilityThreshold,
            uint8 oracleCount,
            bool active
        ) 
    {
        require(assetConfigs[asset].supported, "Asset not supported");
        
        AssetConfig storage config = assetConfigs[asset];
        
        return (
            config.minOracleCount,
            config.reliabilityThreshold,
            config.oracleCount,
            config.active
        );
    }
    
    /**
     * @notice Calculates the median price from an array of prices
     * @param prices Array of prices
     * @param includedOracles Array indicating which prices to include
     * @param validCount Number of valid prices
     * @return median The median price
     */
    function _calculateMedianPrice(
        uint256[] memory prices,
        bool[] memory includedOracles,
        uint8 validCount
    ) 
        internal 
        pure 
        returns (uint256) 
    {
        if (validCount == 0) {
            return 0;
        }
        
        // Create a new array with only valid prices
        uint256[] memory validPrices = new uint256[](validCount);
        uint8 index = 0;
        
        for (uint8 i = 0; i < prices.length; i++) {
            if (includedOracles[i]) {
                validPrices[index] = prices[i];
                index++;
            }
        }
        
        // Sort the valid prices (simple bubble sort)
        for (uint8 i = 0; i < validCount - 1; i++) {
            for (uint8 j = 0; j < validCount - i - 1; j++) {
                if (validPrices[j] > validPrices[j + 1]) {
                    uint256 temp = validPrices[j];
                    validPrices[j] = validPrices[j + 1];
                    validPrices[j + 1] = temp;
                }
            }
        }
        
        // Calculate median
        if (validCount % 2 == 0) {
            // Even number of prices, average the middle two
            uint8 midLow = validCount / 2 - 1;
            uint8 midHigh = validCount / 2;
            return (validPrices[midLow] + validPrices[midHigh]) / 2;
        } else {
            // Odd number of prices, take the middle one
            uint8 mid = validCount / 2;
            return validPrices[mid];
        }
    }
}