// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Treasury
 * @notice Treasury for managing fees collected in the D-Loop ecosystem
 * @dev Distributes fees to various recipients according to configured allocations
 */
contract Treasury is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    
    bytes32 public constant TREASURY_ADMIN_ROLE = keccak256("TREASURY_ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RECIPIENT_MANAGER_ROLE = keccak256("RECIPIENT_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Distribution recipient
    struct Recipient {
        string name;                // Name of the recipient
        address recipientAddress;   // Address of the recipient
        uint256 allocationPercentage; // Percentage in basis points (10000 = 100%)
        bool isActive;              // Whether the recipient is active
    }
    
    // Fee collection history
    struct FeeCollection {
        address token;              // Token address
        uint256 amount;             // Amount collected
        uint256 timestamp;          // When collected
        string source;              // Source of the fee (e.g., "AssetDAO", "Invest")
    }
    
    // Distribution history
    struct Distribution {
        address token;              // Token address
        uint256 totalAmount;        // Total amount distributed
        uint256 timestamp;          // When distributed
        address executor;           // Who executed the distribution
    }
    
    // Recipient history
    struct RecipientDistribution {
        address recipient;          // Recipient address
        address token;              // Token address
        uint256 amount;             // Amount distributed
        uint256 timestamp;          // When distributed
        uint256 distributionId;     // ID of the parent distribution
    }
    
    // Mappings
    mapping(uint256 => Recipient) public recipients;
    mapping(address => uint256) public tokenBalances;
    mapping(uint256 => FeeCollection) public feeCollections;
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => RecipientDistribution) public recipientDistributions;
    
    // Counters
    uint256 public recipientCount;
    uint256 public feeCollectionCount;
    uint256 public distributionCount;
    uint256 public recipientDistributionCount;
    
    // Distribution configuration
    uint256 public totalAllocationPercentage; // Total of all allocations in basis points
    uint256 public minDistributionAmount; // Minimum amount to distribute
    uint256 public distributionThreshold; // Balance threshold that triggers automatic distribution
    
    // Distribution frequency control
    uint256 public lastDistributionTimestamp;
    uint256 public distributionCooldown; // Minimum time between distributions
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;
    address[] public supportedTokenList;
    
    // Events
    event FeeReceived(address indexed token, uint256 amount, string source);
    event RecipientAdded(uint256 indexed recipientId, address indexed recipientAddress, uint256 allocationPercentage);
    event RecipientUpdated(uint256 indexed recipientId, address indexed recipientAddress, uint256 allocationPercentage, bool isActive);
    event RecipientRemoved(uint256 indexed recipientId, address indexed recipientAddress);
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event DistributionExecuted(uint256 indexed distributionId, address indexed token, uint256 totalAmount);
    event RecipientDistributionExecuted(
        uint256 indexed distributionId,
        uint256 indexed recipientDistributionId,
        address indexed recipient,
        address token,
        uint256 amount
    );
    event DistributionConfigUpdated(uint256 minDistributionAmount, uint256 distributionThreshold, uint256 distributionCooldown);
    
    /**
     * @notice Initializer function (replaces constructor in upgradeable contracts)
     * @param admin Address of the admin who will control the treasury
     * @param initialSupportedTokens Array of initially supported token addresses
     */
    function initialize(
        address admin,
        address[] memory initialSupportedTokens
    ) public initializer {
        require(admin != address(0), "Invalid admin address");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TREASURY_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_ROLE, admin);
        _grantRole(RECIPIENT_MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        // Initialize counters
        recipientCount = 0;
        feeCollectionCount = 0;
        distributionCount = 0;
        recipientDistributionCount = 0;
        
        // Set default distribution configuration
        minDistributionAmount = 100 * 10**18; // 100 tokens with 18 decimals
        distributionThreshold = 1000 * 10**18; // 1000 tokens with 18 decimals
        distributionCooldown = 7 days; // 1 week between distributions
        
        // Add supported tokens
        for (uint256 i = 0; i < initialSupportedTokens.length; i++) {
            _addSupportedToken(initialSupportedTokens[i]);
        }
    }
    
    /**
     * @notice Receives fees in a supported token
     * @param token Address of the token
     * @param amount Amount of tokens to receive
     * @param source Source of the fee (e.g., "AssetDAO", "Invest")
     */
    function receiveFees(
        address token,
        uint256 amount,
        string memory source
    ) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be positive");
        
        // Transfer tokens from sender
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Update balance
        tokenBalances[token] += amount;
        
        // Record fee collection
        feeCollectionCount++;
        feeCollections[feeCollectionCount] = FeeCollection({
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            source: source
        });
        
        emit FeeReceived(token, amount, source);
        
        // Check if automatic distribution should be triggered
        if (tokenBalances[token] >= distributionThreshold && 
            block.timestamp >= lastDistributionTimestamp + distributionCooldown) {
            _distribute(token);
        }
    }
    
    /**
     * @notice Manually distributes a token to all active recipients
     * @param token Address of the token to distribute
     */
    function distribute(address token) 
        external 
        onlyRole(DISTRIBUTOR_ROLE) 
        nonReentrant 
        whenNotPaused 
    {
        require(supportedTokens[token], "Token not supported");
        require(
            block.timestamp >= lastDistributionTimestamp + distributionCooldown,
            "Distribution cooldown active"
        );
        require(tokenBalances[token] >= minDistributionAmount, "Insufficient balance");
        
        _distribute(token);
    }
    
    /**
     * @notice Adds a new recipient
     * @param name Name of the recipient
     * @param recipientAddress Address of the recipient
     * @param allocationPercentage Percentage allocation in basis points (10000 = 100%)
     */
    function addRecipient(
        string memory name,
        address recipientAddress,
        uint256 allocationPercentage
    ) 
        external 
        onlyRole(RECIPIENT_MANAGER_ROLE) 
    {
        require(recipientAddress != address(0), "Invalid recipient address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(allocationPercentage > 0, "Allocation must be positive");
        require(
            totalAllocationPercentage + allocationPercentage <= 10000,
            "Total allocation exceeds 100%"
        );
        
        // Create new recipient
        recipientCount++;
        recipients[recipientCount] = Recipient({
            name: name,
            recipientAddress: recipientAddress,
            allocationPercentage: allocationPercentage,
            isActive: true
        });
        
        // Update total allocation
        totalAllocationPercentage += allocationPercentage;
        
        emit RecipientAdded(recipientCount, recipientAddress, allocationPercentage);
    }
    
    /**
     * @notice Updates an existing recipient
     * @param recipientId ID of the recipient to update
     * @param newRecipientAddress New address of the recipient
     * @param newAllocationPercentage New allocation percentage in basis points
     * @param isActive Whether the recipient is active
     */
    function updateRecipient(
        uint256 recipientId,
        address newRecipientAddress,
        uint256 newAllocationPercentage,
        bool isActive
    ) 
        external 
        onlyRole(RECIPIENT_MANAGER_ROLE) 
    {
        require(recipientId > 0 && recipientId <= recipientCount, "Invalid recipient ID");
        require(newRecipientAddress != address(0), "Invalid recipient address");
        require(newAllocationPercentage > 0, "Allocation must be positive");
        
        Recipient storage recipient = recipients[recipientId];
        
        // Calculate new total allocation
        uint256 newTotalAllocation = totalAllocationPercentage - recipient.allocationPercentage + newAllocationPercentage;
        require(newTotalAllocation <= 10000, "Total allocation exceeds 100%");
        
        // Update recipient
        totalAllocationPercentage = newTotalAllocation;
        recipient.recipientAddress = newRecipientAddress;
        recipient.allocationPercentage = newAllocationPercentage;
        recipient.isActive = isActive;
        
        emit RecipientUpdated(recipientId, newRecipientAddress, newAllocationPercentage, isActive);
    }
    
    /**
     * @notice Removes a recipient
     * @param recipientId ID of the recipient to remove
     */
    function removeRecipient(uint256 recipientId) 
        external 
        onlyRole(RECIPIENT_MANAGER_ROLE) 
    {
        require(recipientId > 0 && recipientId <= recipientCount, "Invalid recipient ID");
        
        Recipient storage recipient = recipients[recipientId];
        require(recipient.isActive, "Recipient already inactive");
        
        // Update total allocation
        totalAllocationPercentage -= recipient.allocationPercentage;
        
        // Mark as inactive
        recipient.isActive = false;
        
        emit RecipientRemoved(recipientId, recipient.recipientAddress);
    }
    
    /**
     * @notice Adds a supported token
     * @param token Address of the token to add
     */
    function addSupportedToken(address token) 
        external 
        onlyRole(TREASURY_ADMIN_ROLE) 
    {
        _addSupportedToken(token);
    }
    
    /**
     * @notice Removes a supported token
     * @param token Address of the token to remove
     */
    function removeSupportedToken(address token) 
        external 
        onlyRole(TREASURY_ADMIN_ROLE) 
    {
        require(supportedTokens[token], "Token not supported");
        
        // Remove from mapping
        supportedTokens[token] = false;
        
        // Remove from list
        for (uint256 i = 0; i < supportedTokenList.length; i++) {
            if (supportedTokenList[i] == token) {
                supportedTokenList[i] = supportedTokenList[supportedTokenList.length - 1];
                supportedTokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(token);
    }
    
    /**
     * @notice Updates the distribution configuration
     * @param _minDistributionAmount New minimum distribution amount
     * @param _distributionThreshold New distribution threshold
     * @param _distributionCooldown New distribution cooldown (in seconds)
     */
    function updateDistributionConfig(
        uint256 _minDistributionAmount,
        uint256 _distributionThreshold,
        uint256 _distributionCooldown
    ) 
        external 
        onlyRole(TREASURY_ADMIN_ROLE) 
    {
        require(_minDistributionAmount > 0, "Min amount must be positive");
        require(_distributionThreshold >= _minDistributionAmount, "Threshold too low");
        
        minDistributionAmount = _minDistributionAmount;
        distributionThreshold = _distributionThreshold;
        distributionCooldown = _distributionCooldown;
        
        emit DistributionConfigUpdated(_minDistributionAmount, _distributionThreshold, _distributionCooldown);
    }
    
    /**
     * @notice Recovers tokens not meant for distribution
     * @param token Address of the token to recover
     * @param amount Amount to recover
     * @param to Address to send tokens to
     */
    function recoverToken(
        address token,
        uint256 amount,
        address to
    ) 
        external 
        onlyRole(TREASURY_ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be positive");
        
        // If it's a tracked token, adjust the balance
        if (supportedTokens[token]) {
            require(amount <= tokenBalances[token], "Insufficient balance");
            tokenBalances[token] -= amount;
        }
        
        // Transfer tokens
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @notice Recovers ETH not meant for distribution
     * @param amount Amount to recover
     * @param to Address to send ETH to
     */
    function recoverETH(
        uint256 amount,
        address payable to
    ) 
        external 
        onlyRole(TREASURY_ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be positive");
        require(amount <= address(this).balance, "Insufficient balance");
        
        to.transfer(amount);
    }
    
    /**
     * @notice Gets the list of supported tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() 
        external 
        view 
        returns (address[] memory) 
    {
        return supportedTokenList;
    }
    
    /**
     * @notice Gets recipient details
     * @param recipientId ID of the recipient
     * @return name Name of the recipient
     * @return recipientAddress Address of the recipient
     * @return allocationPercentage Allocation percentage in basis points
     * @return isActive Whether the recipient is active
     */
    function getRecipient(uint256 recipientId) 
        external 
        view 
        returns (
            string memory name,
            address recipientAddress,
            uint256 allocationPercentage,
            bool isActive
        ) 
    {
        require(recipientId > 0 && recipientId <= recipientCount, "Invalid recipient ID");
        
        Recipient storage recipient = recipients[recipientId];
        
        return (
            recipient.name,
            recipient.recipientAddress,
            recipient.allocationPercentage,
            recipient.isActive
        );
    }
    
    /**
     * @notice Gets the list of active recipients
     * @return recipientIds Array of active recipient IDs
     */
    function getActiveRecipients() 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory activeIds = new uint256[](recipientCount);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= recipientCount; i++) {
            if (recipients[i].isActive) {
                activeIds[count] = i;
                count++;
            }
        }
        
        // Resize array to fit actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeIds[i];
        }
        
        return result;
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(TREASURY_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(TREASURY_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Required by UUPS pattern
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(UPGRADER_ROLE)
        override
    {}
    
    /**
     * @notice Internal function to add a supported token
     * @param token Address of the token to add
     */
    function _addSupportedToken(address token) internal {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Token already supported");
        
        // Verify it's a valid ERC20 token
        IERC20 tokenContract = IERC20(token);
        tokenContract.totalSupply(); // Will revert if not ERC20
        
        // Add to mappings
        supportedTokens[token] = true;
        supportedTokenList.push(token);
        
        emit TokenAdded(token);
    }
    
    /**
     * @notice Internal function to distribute tokens to all active recipients
     * @param token Address of the token to distribute
     */
    function _distribute(address token) internal {
        uint256 balance = tokenBalances[token];
        require(balance >= minDistributionAmount, "Insufficient balance");
        
        // Create distribution record
        distributionCount++;
        distributions[distributionCount] = Distribution({
            token: token,
            totalAmount: balance,
            timestamp: block.timestamp,
            executor: msg.sender
        });
        
        // Reset token balance
        tokenBalances[token] = 0;
        
        // Update last distribution timestamp
        lastDistributionTimestamp = block.timestamp;
        
        // Emit distribution event
        emit DistributionExecuted(distributionCount, token, balance);
        
        // Distribute to recipients
        uint256 totalDistributed = 0;
        
        for (uint256 i = 1; i <= recipientCount; i++) {
            Recipient storage recipient = recipients[i];
            
            if (recipient.isActive) {
                uint256 amount = (balance * recipient.allocationPercentage) / 10000;
                
                if (amount > 0) {
                    totalDistributed += amount;
                    
                    // Record recipient distribution
                    recipientDistributionCount++;
                    recipientDistributions[recipientDistributionCount] = RecipientDistribution({
                        recipient: recipient.recipientAddress,
                        token: token,
                        amount: amount,
                        timestamp: block.timestamp,
                        distributionId: distributionCount
                    });
                    
                    // Transfer tokens to recipient
                    IERC20(token).safeTransfer(recipient.recipientAddress, amount);
                    
                    emit RecipientDistributionExecuted(
                        distributionCount,
                        recipientDistributionCount,
                        recipient.recipientAddress,
                        token,
                        amount
                    );
                }
            }
        }
        
        // If there's any remainder due to rounding, keep it for next distribution
        if (totalDistributed < balance) {
            tokenBalances[token] = balance - totalDistributed;
        }
    }
    
    /**
     * @notice Receive function to allow receiving ETH
     */
    receive() external payable {}
}