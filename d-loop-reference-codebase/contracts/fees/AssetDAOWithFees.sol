// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../fees/FeeCalculator.sol";
import "../oracles/IPriceOracle.sol";

/**
 * @title AssetDAOWithFees
 * @notice DAO for asset management with fee structure integration
 * @dev Upgradeable contract that handles asset investments with fee calculations
 */
contract AssetDAOWithFees is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;
    
    bytes32 public constant ASSET_ADMIN_ROLE = keccak256("ASSET_ADMIN_ROLE");
    bytes32 public constant INVESTMENT_ROLE = keccak256("INVESTMENT_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Core token (D-AI)
    IERC20 public daiToken;
    
    // Fee calculator
    FeeCalculator public feeCalculator;
    
    // Treasury address
    address public treasury;
    
    // Price oracle for token valuations
    IPriceOracle public priceOracle;
    
    // Asset structure
    struct Asset {
        address tokenAddress;        // ERC20 token address
        string name;                 // Asset name
        string symbol;               // Asset symbol
        bool isActive;               // Is this asset active for investments
        uint256 totalInvested;       // Total amount invested
        uint256 availableCapital;    // Capital available for investments
        uint256 totalFeesPaid;       // Total fees paid
        uint256 minInvestmentAmount; // Minimum investment amount
    }
    
    // Investment structure
    struct Investment {
        address investor;            // Investor address
        address assetToken;          // Asset token address
        uint256 amount;              // Investment amount
        uint256 sharesIssued;        // Shares issued to the investor
        uint256 timestamp;           // Investment timestamp
        uint256 feePaid;             // Fee paid for this investment
    }
    
    // Divestment structure
    struct Divestment {
        address investor;            // Investor address
        address assetToken;          // Asset token address
        uint256 amount;              // Divestment amount
        uint256 sharesReturned;      // Shares returned by the investor
        uint256 timestamp;           // Divestment timestamp
        uint256 feePaid;             // Fee paid for this divestment
        bool isRagequit;             // Whether this was a ragequit
    }
    
    // Mappings
    mapping(address => Asset) public assets;                      // Asset token => Asset data
    mapping(address => bool) public supportedAssets;              // Supported asset tokens
    mapping(address => uint256) public investorShares;            // Investor => total shares across all assets
    mapping(address => mapping(address => uint256)) public investorAssetShares; // Investor => Asset token => shares
    mapping(uint256 => Investment) public investments;            // Investment ID => Investment data
    mapping(uint256 => Divestment) public divestments;            // Divestment ID => Divestment data
    
    // Counters
    uint256 public investmentCounter;
    uint256 public divestmentCounter;
    uint256 public assetCount;
    
    // Events
    event AssetAdded(address indexed tokenAddress, string name, string symbol);
    event AssetUpdated(address indexed tokenAddress, bool isActive, uint256 minInvestmentAmount);
    event InvestmentMade(
        uint256 indexed investmentId,
        address indexed investor,
        address indexed assetToken,
        uint256 amount,
        uint256 sharesIssued,
        uint256 feePaid
    );
    event DivestmentMade(
        uint256 indexed divestmentId,
        address indexed investor,
        address indexed assetToken,
        uint256 amount,
        uint256 sharesReturned,
        uint256 feePaid,
        bool isRagequit
    );
    event FeeCalculatorUpdated(address oldCalculator, address newCalculator);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    
    /**
     * @notice Initializer function (replaces constructor in upgradeable contracts)
     * @param _daiToken Address of the DAI token
     * @param _feeCalculator Address of the fee calculator
     * @param _treasury Address of the treasury
     * @param _priceOracle Address of the price oracle
     */
    function initialize(
        address _daiToken,
        address _feeCalculator,
        address _treasury,
        address _priceOracle
    ) public initializer {
        require(_daiToken != address(0), "Invalid DAI token address");
        require(_feeCalculator != address(0), "Invalid fee calculator address");
        require(_treasury != address(0), "Invalid treasury address");
        require(_priceOracle != address(0), "Invalid price oracle address");
        
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ASSET_ADMIN_ROLE, msg.sender);
        _grantRole(INVESTMENT_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        
        daiToken = IERC20(_daiToken);
        feeCalculator = FeeCalculator(_feeCalculator);
        treasury = _treasury;
        priceOracle = IPriceOracle(_priceOracle);
        
        investmentCounter = 0;
        divestmentCounter = 0;
        assetCount = 0;
    }
    
    /**
     * @notice Adds a new asset
     * @param tokenAddress Address of the asset token
     * @param name Name of the asset
     * @param symbol Symbol of the asset
     * @param minInvestmentAmount Minimum investment amount
     */
    function addAsset(
        address tokenAddress,
        string memory name,
        string memory symbol,
        uint256 minInvestmentAmount
    ) 
        external 
        onlyRole(ASSET_ADMIN_ROLE) 
    {
        require(tokenAddress != address(0), "Invalid token address");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(minInvestmentAmount > 0, "Minimum investment must be positive");
        require(!supportedAssets[tokenAddress], "Asset already exists");
        
        assets[tokenAddress] = Asset({
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            isActive: true,
            totalInvested: 0,
            availableCapital: 0,
            totalFeesPaid: 0,
            minInvestmentAmount: minInvestmentAmount
        });
        
        supportedAssets[tokenAddress] = true;
        assetCount++;
        
        emit AssetAdded(tokenAddress, name, symbol);
    }
    
    /**
     * @notice Updates an existing asset
     * @param tokenAddress Address of the asset token
     * @param isActive Whether the asset is active
     * @param minInvestmentAmount Minimum investment amount
     */
    function updateAsset(
        address tokenAddress,
        bool isActive,
        uint256 minInvestmentAmount
    ) 
        external 
        onlyRole(ASSET_ADMIN_ROLE) 
    {
        require(supportedAssets[tokenAddress], "Asset does not exist");
        require(minInvestmentAmount > 0, "Minimum investment must be positive");
        
        Asset storage asset = assets[tokenAddress];
        asset.isActive = isActive;
        asset.minInvestmentAmount = minInvestmentAmount;
        
        emit AssetUpdated(tokenAddress, isActive, minInvestmentAmount);
    }
    
    /**
     * @notice Invests in an asset
     * @param assetToken Address of the asset token
     * @param amount Amount to invest
     */
    function invest(address assetToken, uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(supportedAssets[assetToken], "Asset not supported");
        require(assets[assetToken].isActive, "Asset not active");
        require(amount >= assets[assetToken].minInvestmentAmount, "Below minimum investment");
        
        // Calculate fee
        uint256 fee = feeCalculator.calculateInvestFee(assetToken, amount, msg.sender);
        uint256 netAmount = amount - fee;
        
        // Transfer tokens from investor
        daiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Transfer fee to treasury
        if (fee > 0) {
            daiToken.safeTransfer(treasury, fee);
        }
        
        // Update asset data
        Asset storage asset = assets[assetToken];
        asset.totalInvested += netAmount;
        asset.availableCapital += netAmount;
        asset.totalFeesPaid += fee;
        
        // Calculate shares (1:1 ratio for simplicity)
        uint256 sharesIssued = netAmount;
        
        // Update investor shares
        investorShares[msg.sender] += sharesIssued;
        investorAssetShares[msg.sender][assetToken] += sharesIssued;
        
        // Record investment
        investmentCounter++;
        investments[investmentCounter] = Investment({
            investor: msg.sender,
            assetToken: assetToken,
            amount: amount,
            sharesIssued: sharesIssued,
            timestamp: block.timestamp,
            feePaid: fee
        });
        
        emit InvestmentMade(
            investmentCounter,
            msg.sender,
            assetToken,
            amount,
            sharesIssued,
            fee
        );
    }
    
    /**
     * @notice Divests from an asset
     * @param assetToken Address of the asset token
     * @param shareAmount Amount of shares to divest
     * @param isRagequit Whether this is a ragequit (emergency withdrawal)
     */
    function divest(
        address assetToken, 
        uint256 shareAmount, 
        bool isRagequit
    ) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(supportedAssets[assetToken], "Asset not supported");
        require(shareAmount > 0, "Amount must be positive");
        require(
            investorAssetShares[msg.sender][assetToken] >= shareAmount,
            "Insufficient shares"
        );
        
        // Calculate withdrawal amount (1:1 ratio for simplicity)
        uint256 withdrawalAmount = shareAmount;
        
        // Check if asset has enough available capital
        require(
            assets[assetToken].availableCapital >= withdrawalAmount,
            "Insufficient available capital"
        );
        
        // Calculate fee based on divestment type
        uint256 fee;
        if (isRagequit) {
            fee = feeCalculator.calculateRagequitFee(assetToken, withdrawalAmount, msg.sender);
        } else {
            fee = feeCalculator.calculateDivestFee(assetToken, withdrawalAmount, msg.sender);
        }
        
        uint256 netAmount = withdrawalAmount - fee;
        
        // Update asset data
        Asset storage asset = assets[assetToken];
        asset.totalInvested -= withdrawalAmount;
        asset.availableCapital -= withdrawalAmount;
        asset.totalFeesPaid += fee;
        
        // Update investor shares
        investorShares[msg.sender] -= shareAmount;
        investorAssetShares[msg.sender][assetToken] -= shareAmount;
        
        // Transfer net amount to investor
        daiToken.safeTransfer(msg.sender, netAmount);
        
        // Transfer fee to treasury
        if (fee > 0) {
            daiToken.safeTransfer(treasury, fee);
        }
        
        // Record divestment
        divestmentCounter++;
        divestments[divestmentCounter] = Divestment({
            investor: msg.sender,
            assetToken: assetToken,
            amount: withdrawalAmount,
            sharesReturned: shareAmount,
            timestamp: block.timestamp,
            feePaid: fee,
            isRagequit: isRagequit
        });
        
        emit DivestmentMade(
            divestmentCounter,
            msg.sender,
            assetToken,
            withdrawalAmount,
            shareAmount,
            fee,
            isRagequit
        );
    }
    
    /**
     * @notice Updates the fee calculator
     * @param _feeCalculator New fee calculator address
     */
    function updateFeeCalculator(address _feeCalculator) 
        external 
        onlyRole(ASSET_ADMIN_ROLE) 
    {
        require(_feeCalculator != address(0), "Invalid fee calculator address");
        
        address oldCalculator = address(feeCalculator);
        feeCalculator = FeeCalculator(_feeCalculator);
        
        emit FeeCalculatorUpdated(oldCalculator, _feeCalculator);
    }
    
    /**
     * @notice Updates the treasury address
     * @param _treasury New treasury address
     */
    function updateTreasury(address _treasury) 
        external 
        onlyRole(ASSET_ADMIN_ROLE) 
    {
        require(_treasury != address(0), "Invalid treasury address");
        
        address oldTreasury = treasury;
        treasury = _treasury;
        
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /**
     * @notice Pauses the contract
     */
    function pause() external onlyRole(ASSET_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses the contract
     */
    function unpause() external onlyRole(ASSET_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Gets asset details
     * @param assetToken Address of the asset token
     * @return name Asset name
     * @return symbol Asset symbol
     * @return isActive Whether the asset is active
     * @return totalInvested Total invested amount
     * @return availableCapital Available capital
     * @return totalFeesPaid Total fees paid
     * @return minInvestmentAmount Minimum investment amount
     */
    function getAssetDetails(address assetToken) 
        external 
        view 
        returns (
            string memory name,
            string memory symbol,
            bool isActive,
            uint256 totalInvested,
            uint256 availableCapital,
            uint256 totalFeesPaid,
            uint256 minInvestmentAmount
        ) 
    {
        require(supportedAssets[assetToken], "Asset not supported");
        
        Asset storage asset = assets[assetToken];
        
        return (
            asset.name,
            asset.symbol,
            asset.isActive,
            asset.totalInvested,
            asset.availableCapital,
            asset.totalFeesPaid,
            asset.minInvestmentAmount
        );
    }
    
    /**
     * @notice Gets investor shares for an asset
     * @param investor Address of the investor
     * @param assetToken Address of the asset token
     * @return shares Investor's shares for the asset
     */
    function getInvestorAssetShares(address investor, address assetToken) 
        external 
        view 
        returns (uint256) 
    {
        return investorAssetShares[investor][assetToken];
    }
    
    /**
     * @notice Gets total investor shares across all assets
     * @param investor Address of the investor
     * @return shares Total investor shares
     */
    function getTotalInvestorShares(address investor) 
        external 
        view 
        returns (uint256) 
    {
        return investorShares[investor];
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
}