// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../bridge/IBridge.sol";
import "./IPriceOracle.sol";

/**
 * @title CrossChainOracleAdapter
 * @dev Adapter for accessing and aggregating oracle data across different chains
 */
contract CrossChainOracleAdapter is AccessControl, Pausable, IPriceOracle {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    
    // Bridge contract for cross-chain communication
    IBridge public bridge;
    
    // Local oracle for current chain
    IPriceOracle public localOracle;
    
    // Cross-chain oracles
    struct RemoteOracle {
        uint256 chainId;
        address oracleAddress;
        bool trusted;
    }
    
    // Remote oracle registry
    mapping(uint256 => RemoteOracle) public remoteOracles;
    uint256[] public supportedChains;
    
    // Cross-chain price cache
    struct PricePoint {
        uint256 price;
        uint256 timestamp;
        uint256 sourceChainId;
    }
    
    // Asset price cache
    mapping(address => PricePoint) public latestPrices;
    mapping(address => mapping(uint256 => PricePoint)) public historicalPrices; // asset -> timestamp -> price
    
    // Message tracking
    mapping(bytes32 => bool) public pendingRequests;
    
    // Events
    event RemoteOracleAdded(uint256 indexed chainId, address indexed oracleAddress);
    event RemoteOracleRemoved(uint256 indexed chainId);
    event PriceRequested(address indexed asset, uint256 indexed targetChainId, bytes32 indexed messageId);
    event PriceReceived(address indexed asset, uint256 price, uint256 timestamp, uint256 indexed sourceChainId);
    event LocalOracleUpdated(address indexed newOracle);
    event BridgeUpdated(address indexed newBridge);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param _localOracle Local oracle address
     * @param _bridge Bridge address
     */
    constructor(
        address admin,
        address _localOracle,
        address _bridge
    ) {
        require(admin != address(0), "CrossChainOracleAdapter: admin is zero address");
        require(_localOracle != address(0), "CrossChainOracleAdapter: oracle is zero address");
        require(_bridge != address(0), "CrossChainOracleAdapter: bridge is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, _localOracle);
        _grantRole(BRIDGE_ROLE, _bridge);
        
        localOracle = IPriceOracle(_localOracle);
        bridge = IBridge(_bridge);
    }
    
    /**
     * @dev Gets the latest price of an asset
     * @param asset Asset address
     * @return price The latest price with 18 decimals
     * @return updatedAt Timestamp when the price was last updated
     */
    function getLatestPrice(address asset) external view override returns (uint256 price, uint256 updatedAt) {
        // Try local oracle first
        if (localOracle.isAssetSupported(asset)) {
            return localOracle.getLatestPrice(asset);
        }
        
        // Check cache for cross-chain prices
        PricePoint memory cachedPrice = latestPrices[asset];
        if (cachedPrice.timestamp > 0) {
            return (cachedPrice.price, cachedPrice.timestamp);
        }
        
        revert("CrossChainOracleAdapter: price not available");
    }
    
    /**
     * @dev Gets the price of an asset at a specific time (or closest available)
     * @param asset Asset address
     * @param timestamp Timestamp to get price at
     * @return price The price at the specified time
     * @return actualTimestamp The actual timestamp of the returned price
     */
    function getPriceAt(
        address asset,
        uint256 timestamp
    ) external view override returns (uint256 price, uint256 actualTimestamp) {
        // Try local oracle first
        if (localOracle.isAssetSupported(asset)) {
            return localOracle.getPriceAt(asset, timestamp);
        }
        
        // Check cache for cross-chain prices
        PricePoint memory cachedPrice = historicalPrices[asset][timestamp];
        if (cachedPrice.timestamp > 0) {
            return (cachedPrice.price, cachedPrice.timestamp);
        }
        
        // If not exact match, find closest timestamp
        uint256 closestTimestamp = 0;
        uint256 closestDiff = type(uint256).max;
        
        // This is inefficient but necessary for view function
        // In production, we'd use a more efficient data structure
        for (uint256 i = timestamp - 1 days; i <= timestamp + 1 days; i += 1 hours) {
            PricePoint memory potentialPrice = historicalPrices[asset][i];
            if (potentialPrice.timestamp > 0) {
                uint256 diff = i > timestamp ? i - timestamp : timestamp - i;
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestTimestamp = i;
                }
            }
        }
        
        if (closestTimestamp > 0) {
            PricePoint memory bestPrice = historicalPrices[asset][closestTimestamp];
            return (bestPrice.price, bestPrice.timestamp);
        }
        
        revert("CrossChainOracleAdapter: historical price not available");
    }
    
    /**
     * @dev Checks if an asset is supported by the oracle
     * @param asset Asset address
     * @return Whether the asset is supported
     */
    function isAssetSupported(address asset) external view override returns (bool) {
        // Check local oracle
        if (localOracle.isAssetSupported(asset)) {
            return true;
        }
        
        // Check if we have any cached price data
        return latestPrices[asset].timestamp > 0;
    }
    
    /**
     * @dev Gets the percentage price change between two timestamps
     * @param asset Asset address
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return percentage The percentage change (positive for increase, negative for decrease)
     * @return isIncrease Whether the price increased
     */
    function getPriceChangePercentage(
        address asset,
        uint256 startTime,
        uint256 endTime
    ) external view override returns (uint256 percentage, bool isIncrease) {
        require(startTime < endTime, "CrossChainOracleAdapter: start time must be before end time");
        
        // Try local oracle first
        if (localOracle.isAssetSupported(asset)) {
            return localOracle.getPriceChangePercentage(asset, startTime, endTime);
        }
        
        // Get prices from our cache
        (uint256 startPrice, ) = this.getPriceAt(asset, startTime);
        (uint256 endPrice, ) = this.getPriceAt(asset, endTime);
        
        // Calculate percentage change
        if (startPrice == endPrice) {
            return (0, true); // No change
        } else if (endPrice > startPrice) {
            // Price increased
            percentage = ((endPrice - startPrice) * 1e18) / startPrice;
            return (percentage, true);
        } else {
            // Price decreased
            percentage = ((startPrice - endPrice) * 1e18) / startPrice;
            return (percentage, false);
        }
    }
    
    /**
     * @dev Request a price update from a remote chain
     * @param asset Asset address
     * @param chainId Remote chain ID
     * @return success Whether the request was sent successfully
     */
    function requestRemotePrice(address asset, uint256 chainId) external whenNotPaused onlyRole(ADMIN_ROLE) returns (bool success) {
        require(asset != address(0), "CrossChainOracleAdapter: asset is zero address");
        require(remoteOracles[chainId].trusted, "CrossChainOracleAdapter: chain not supported");
        
        // Encode the price request message
        bytes memory message = abi.encode(
            asset,
            block.timestamp,
            "price_request"
        );
        
        // Send message through the bridge
        bytes32 messageId = bridge.sendMessage(
            chainId,
            remoteOracles[chainId].oracleAddress,
            message
        );
        
        // Track the pending request
        pendingRequests[messageId] = true;
        
        emit PriceRequested(asset, chainId, messageId);
        
        return true;
    }
    
    /**
     * @dev Handle a price update from a remote chain
     * @param sourceChainId Source chain ID
     * @param asset Asset address
     * @param price Price value
     * @param timestamp Timestamp of the price
     */
    function receiveRemotePrice(
        uint256 sourceChainId,
        address asset,
        uint256 price,
        uint256 timestamp
    ) external whenNotPaused onlyRole(BRIDGE_ROLE) {
        require(asset != address(0), "CrossChainOracleAdapter: asset is zero address");
        require(remoteOracles[sourceChainId].trusted, "CrossChainOracleAdapter: chain not trusted");
        require(price > 0, "CrossChainOracleAdapter: price is zero");
        
        // Update the price cache
        latestPrices[asset] = PricePoint({
            price: price,
            timestamp: timestamp,
            sourceChainId: sourceChainId
        });
        
        // Store in historical prices as well
        historicalPrices[asset][timestamp] = PricePoint({
            price: price,
            timestamp: timestamp,
            sourceChainId: sourceChainId
        });
        
        emit PriceReceived(asset, price, timestamp, sourceChainId);
    }
    
    /**
     * @dev Handle a message received from the bridge
     * @param sourceChainId Source chain ID
     * @param sourceAddress Source address
     * @param message Message data
     */
    function onMessageReceived(
        uint256 sourceChainId,
        address sourceAddress,
        bytes calldata message
    ) external whenNotPaused onlyRole(BRIDGE_ROLE) {
        require(remoteOracles[sourceChainId].trusted, "CrossChainOracleAdapter: chain not trusted");
        require(sourceAddress == remoteOracles[sourceChainId].oracleAddress, "CrossChainOracleAdapter: untrusted source");
        
        // Decode the message
        (string memory messageType, bytes memory data) = abi.decode(message, (string, bytes));
        
        if (keccak256(abi.encodePacked(messageType)) == keccak256(abi.encodePacked("price_update"))) {
            // Handle price update
            (address asset, uint256 price, uint256 timestamp) = abi.decode(data, (address, uint256, uint256));
            
            // Update the price cache
            receiveRemotePrice(sourceChainId, asset, price, timestamp);
        } else if (keccak256(abi.encodePacked(messageType)) == keccak256(abi.encodePacked("price_request"))) {
            // Handle price request - respond with local price
            (address asset, uint256 requestTimestamp) = abi.decode(data, (address, uint256));
            
            // Only respond if the asset is supported locally
            if (localOracle.isAssetSupported(asset)) {
                (uint256 price, uint256 timestamp) = localOracle.getLatestPrice(asset);
                
                // Send the price back through the bridge
                bytes memory response = abi.encode(
                    "price_update",
                    abi.encode(asset, price, timestamp)
                );
                
                bridge.sendMessage(
                    sourceChainId,
                    sourceAddress,
                    response
                );
            }
        }
    }
    
    /**
     * @dev Add a remote oracle
     * @param chainId Chain ID
     * @param oracleAddress Oracle address on the remote chain
     */
    function addRemoteOracle(uint256 chainId, address oracleAddress) external onlyRole(ADMIN_ROLE) {
        require(chainId != bridge.getChainId(), "CrossChainOracleAdapter: cannot add local chain");
        require(oracleAddress != address(0), "CrossChainOracleAdapter: oracle is zero address");
        require(!remoteOracles[chainId].trusted, "CrossChainOracleAdapter: oracle already added");
        
        // Add to registry
        remoteOracles[chainId] = RemoteOracle({
            chainId: chainId,
            oracleAddress: oracleAddress,
            trusted: true
        });
        
        // Add to supported chains list
        supportedChains.push(chainId);
        
        emit RemoteOracleAdded(chainId, oracleAddress);
    }
    
    /**
     * @dev Remove a remote oracle
     * @param chainId Chain ID
     */
    function removeRemoteOracle(uint256 chainId) external onlyRole(ADMIN_ROLE) {
        require(remoteOracles[chainId].trusted, "CrossChainOracleAdapter: oracle not found");
        
        // Remove from registry
        remoteOracles[chainId].trusted = false;
        
        // Remove from supported chains list (inefficient but rarely used)
        for (uint256 i = 0; i < supportedChains.length; i++) {
            if (supportedChains[i] == chainId) {
                supportedChains[i] = supportedChains[supportedChains.length - 1];
                supportedChains.pop();
                break;
            }
        }
        
        emit RemoteOracleRemoved(chainId);
    }
    
    /**
     * @dev Update the local oracle
     * @param newOracle New local oracle address
     */
    function updateLocalOracle(address newOracle) external onlyRole(ADMIN_ROLE) {
        require(newOracle != address(0), "CrossChainOracleAdapter: oracle is zero address");
        
        // Update oracle
        localOracle = IPriceOracle(newOracle);
        
        // Update role
        _revokeRole(ORACLE_ROLE, address(localOracle));
        _grantRole(ORACLE_ROLE, newOracle);
        
        emit LocalOracleUpdated(newOracle);
    }
    
    /**
     * @dev Update the bridge
     * @param newBridge New bridge address
     */
    function updateBridge(address newBridge) external onlyRole(ADMIN_ROLE) {
        require(newBridge != address(0), "CrossChainOracleAdapter: bridge is zero address");
        
        // Update bridge
        bridge = IBridge(newBridge);
        
        // Update role
        _revokeRole(BRIDGE_ROLE, address(bridge));
        _grantRole(BRIDGE_ROLE, newBridge);
        
        emit BridgeUpdated(newBridge);
    }
    
    /**
     * @dev Pause the adapter
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the adapter
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get all supported remote chains
     * @return chains Array of supported chain IDs
     */
    function getSupportedChains() external view returns (uint256[] memory chains) {
        return supportedChains;
    }
    
    /**
     * @dev Check if a remote chain is supported
     * @param chainId Chain ID
     * @return isSupported Whether the chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool isSupported) {
        return remoteOracles[chainId].trusted;
    }
    
    /**
     * @dev Get the oracle address for a remote chain
     * @param chainId Chain ID
     * @return oracleAddress Oracle address
     */
    function getRemoteOracle(uint256 chainId) external view returns (address oracleAddress) {
        require(remoteOracles[chainId].trusted, "CrossChainOracleAdapter: chain not supported");
        return remoteOracles[chainId].oracleAddress;
    }
    
    /**
     * @dev Gets the latest cached price for an asset
     * @param asset Asset address
     * @return price Price value
     * @return timestamp Price timestamp
     * @return sourceChainId Source chain ID
     */
    function getLatestCachedPrice(address asset) external view returns (uint256 price, uint256 timestamp, uint256 sourceChainId) {
        PricePoint memory cachedPrice = latestPrices[asset];
        require(cachedPrice.timestamp > 0, "CrossChainOracleAdapter: no cached price");
        
        return (cachedPrice.price, cachedPrice.timestamp, cachedPrice.sourceChainId);
    }
}