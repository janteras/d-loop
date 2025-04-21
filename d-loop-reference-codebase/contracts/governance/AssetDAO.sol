// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../tokens/IDAIToken.sol";
import "../fees/IFeeCalculator.sol";
import "../oracles/IPriceOracle.sol";

/**
 * @title AssetDAO
 * @dev Implementation of the Asset DAO contract for DLOOP
 * Handles investments, divestments, proposals, and asset management
 */
contract AssetDAO is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // Roles for access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant PROPOSAL_MANAGER_ROLE = keccak256("PROPOSAL_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Asset DAO state variables
    IDAIToken public daiToken;
    IFeeCalculator public feeCalculator;
    IPriceOracle public priceOracle;
    address public treasury;
    
    // Investment settings
    uint256 public minInvestmentAmount;
    uint256 public maxInvestmentAmount;
    uint256 public investmentWindow;
    bool public investmentsOpen;
    
    // Supported assets for investment
    mapping(address => bool) public supportedAssets;
    address[] private _supportedAssetList;
    
    // Investment tracking
    mapping(address => mapping(address => uint256)) public investorAssetAmounts;
    mapping(address => uint256) public totalInvestedByAsset;
    
    // Proposal tracking
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    // Divestment settings
    uint256 public minDivestmentPeriod;
    
    // Ragequit settings
    uint256 public rageQuitDelay;
    
    // Assets under management
    uint256 public totalValueLocked;
    
    // Proposal struct
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 amount;
        address token;
        address recipient;
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool passed;
        mapping(address => bool) voted;
    }
    
    // Events
    event AssetAdded(address indexed asset);
    event AssetRemoved(address indexed asset);
    event InvestmentReceived(address indexed investor, address indexed asset, uint256 amount, uint256 daiTokensMinted);
    event DivestmentProcessed(address indexed investor, address indexed asset, uint256 amount, uint256 daiTokensBurned);
    event RageQuitProcessed(address indexed investor, address[] assets, uint256[] amounts, uint256 daiTokensBurned);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool vote);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);
    event InvestmentWindowSet(uint256 newWindow);
    event InvestmentStatusChanged(bool isOpen);
    event MinMaxInvestmentSet(uint256 minAmount, uint256 maxAmount);
    event FeesUpdated(address indexed calculator);
    event OracleUpdated(address indexed oracle);
    event TreasuryUpdated(address indexed treasury);
    
    /**
     * @dev Constructor is disabled in favor of initialize for upgradeable contracts
     */
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the AssetDAO contract with initial state
     * @param admin Admin address
     * @param _daiToken DAI Token address
     * @param _feeCalculator Fee Calculator address
     * @param _priceOracle Price Oracle address
     * @param _treasury Treasury address
     */
    function initialize(
        address admin,
        address _daiToken,
        address _feeCalculator,
        address _priceOracle,
        address _treasury
    ) external initializer {
        require(admin != address(0), "AssetDAO: admin is zero address");
        require(_daiToken != address(0), "AssetDAO: token is zero address");
        require(_feeCalculator != address(0), "AssetDAO: fee calculator is zero address");
        require(_priceOracle != address(0), "AssetDAO: price oracle is zero address");
        require(_treasury != address(0), "AssetDAO: treasury is zero address");
        
        // Initialize parent contracts
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ASSET_MANAGER_ROLE, admin);
        _grantRole(PROPOSAL_MANAGER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        
        // Set up state variables
        daiToken = IDAIToken(_daiToken);
        feeCalculator = IFeeCalculator(_feeCalculator);
        priceOracle = IPriceOracle(_priceOracle);
        treasury = _treasury;
        
        // Set default parameters
        minInvestmentAmount = 100 * 10**18; // 100 USDC
        maxInvestmentAmount = 1000000 * 10**18; // 1M USDC
        investmentWindow = 7 days;
        investmentsOpen = true;
        minDivestmentPeriod = 30 days;
        rageQuitDelay = 3 days;
        
        proposalCount = 0;
        totalValueLocked = 0;
    }
    
    /**
     * @dev Adds a supported asset
     * @param asset Asset address
     */
    function addSupportedAsset(address asset) external onlyRole(ASSET_MANAGER_ROLE) {
        require(asset != address(0), "AssetDAO: asset is zero address");
        require(!supportedAssets[asset], "AssetDAO: asset already supported");
        require(priceOracle.isAssetSupported(asset), "AssetDAO: price oracle doesn't support asset");
        
        supportedAssets[asset] = true;
        _supportedAssetList.push(asset);
        
        emit AssetAdded(asset);
    }
    
    /**
     * @dev Removes a supported asset
     * @param asset Asset address
     */
    function removeSupportedAsset(address asset) external onlyRole(ASSET_MANAGER_ROLE) {
        require(supportedAssets[asset], "AssetDAO: asset not supported");
        require(totalInvestedByAsset[asset] == 0, "AssetDAO: asset still has investments");
        
        supportedAssets[asset] = false;
        
        // Remove from list
        for (uint256 i = 0; i < _supportedAssetList.length; i++) {
            if (_supportedAssetList[i] == asset) {
                _supportedAssetList[i] = _supportedAssetList[_supportedAssetList.length - 1];
                _supportedAssetList.pop();
                break;
            }
        }
        
        emit AssetRemoved(asset);
    }
    
    /**
     * @dev Gets all supported assets
     * @return List of supported asset addresses
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return _supportedAssetList;
    }
    
    /**
     * @dev Allows an investor to invest assets and receive D-AI tokens
     * @param asset Asset address
     * @param amount Amount to invest
     */
    function invest(address asset, uint256 amount) external whenNotPaused nonReentrant {
        require(investmentsOpen, "AssetDAO: investments closed");
        require(supportedAssets[asset], "AssetDAO: asset not supported");
        require(amount >= minInvestmentAmount, "AssetDAO: below min investment");
        require(amount <= maxInvestmentAmount, "AssetDAO: above max investment");
        
        // Calculate investment value in USD (8 decimals precision)
        int256 assetPrice = priceOracle.getLatestPrice(asset);
        require(assetPrice > 0, "AssetDAO: invalid asset price");
        
        // Transfer asset from investor to Asset DAO
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate fee
        uint256 fee = feeCalculator.calculateInvestmentFee(amount);
        
        // Transfer fee to fee calculator for processing
        if (fee > 0) {
            IERC20(asset).safeTransfer(address(feeCalculator), fee);
            feeCalculator.processFee(fee);
        }
        
        // Calculate net amount after fee
        uint256 netAmount = amount - fee;
        
        // Update investor asset amounts
        investorAssetAmounts[msg.sender][asset] += netAmount;
        totalInvestedByAsset[asset] += netAmount;
        
        // Update total value locked (convert to 18 decimals for consistent accounting)
        uint256 valueInUsd = (uint256(assetPrice) * netAmount) / 10**8;
        totalValueLocked += valueInUsd;
        
        // Mint D-AI tokens to investor (1:1 with USD value)
        daiToken.mint(msg.sender, valueInUsd);
        
        emit InvestmentReceived(msg.sender, asset, amount, valueInUsd);
    }
    
    /**
     * @dev Allows an investor to divest assets
     * @param asset Asset address
     * @param daiTokenAmount Amount of D-AI tokens to burn
     */
    function divest(address asset, uint256 daiTokenAmount) external whenNotPaused nonReentrant {
        require(supportedAssets[asset], "AssetDAO: asset not supported");
        require(daiTokenAmount > 0, "AssetDAO: zero amount");
        require(daiToken.balanceOf(msg.sender) >= daiTokenAmount, "AssetDAO: insufficient D-AI balance");
        
        // Burn D-AI tokens from investor
        daiToken.burn(msg.sender, daiTokenAmount);
        
        // Calculate asset amount based on current price
        int256 assetPrice = priceOracle.getLatestPrice(asset);
        require(assetPrice > 0, "AssetDAO: invalid asset price");
        
        // Convert D-AI tokens to asset amount (accounting for price)
        // daiTokenAmount is in 18 decimals, assetPrice is in 8 decimals
        uint256 assetAmount = (daiTokenAmount * 10**8) / uint256(assetPrice);
        
        // Calculate fee
        uint256 fee = feeCalculator.calculateDivestmentFee(assetAmount);
        
        // Calculate net amount
        uint256 netAmount = assetAmount - fee;
        
        // Update investor asset amounts
        require(investorAssetAmounts[msg.sender][asset] >= netAmount, "AssetDAO: insufficient investment");
        investorAssetAmounts[msg.sender][asset] -= netAmount;
        totalInvestedByAsset[asset] -= netAmount;
        
        // Update total value locked
        totalValueLocked -= daiTokenAmount;
        
        // Process fee
        if (fee > 0) {
            IERC20(asset).safeTransfer(address(feeCalculator), fee);
            feeCalculator.processFee(fee);
        }
        
        // Transfer asset to investor
        IERC20(asset).safeTransfer(msg.sender, netAmount);
        
        emit DivestmentProcessed(msg.sender, asset, assetAmount, daiTokenAmount);
    }
    
    /**
     * @dev Allows an investor to rage quit (emergency withdrawal) with all assets
     */
    function rageQuit() external whenNotPaused nonReentrant {
        uint256 daiBalance = daiToken.balanceOf(msg.sender);
        require(daiBalance > 0, "AssetDAO: no D-AI tokens");
        
        // Burn all D-AI tokens
        daiToken.burn(msg.sender, daiBalance);
        
        // Prepare arrays for assets and amounts
        address[] memory assets = new address[](_supportedAssetList.length);
        uint256[] memory amounts = new uint256[](_supportedAssetList.length);
        uint256 count = 0;
        
        // Process each supported asset
        for (uint256 i = 0; i < _supportedAssetList.length; i++) {
            address asset = _supportedAssetList[i];
            uint256 investedAmount = investorAssetAmounts[msg.sender][asset];
            
            if (investedAmount > 0) {
                // Calculate fee (higher for rage quit)
                uint256 fee = feeCalculator.calculateRageQuitFee(investedAmount);
                uint256 netAmount = investedAmount - fee;
                
                // Update state
                investorAssetAmounts[msg.sender][asset] = 0;
                totalInvestedByAsset[asset] -= investedAmount;
                
                // Process fee
                if (fee > 0) {
                    IERC20(asset).safeTransfer(address(feeCalculator), fee);
                    feeCalculator.processFee(fee);
                }
                
                // Transfer asset
                IERC20(asset).safeTransfer(msg.sender, netAmount);
                
                // Record for event
                assets[count] = asset;
                amounts[count] = netAmount;
                count++;
            }
        }
        
        // Update total value locked
        totalValueLocked -= daiBalance;
        
        // Emit event with actual counts
        address[] memory finalAssets = new address[](count);
        uint256[] memory finalAmounts = new uint256[](count);
        
        for (uint256 i = 0; i < count; i++) {
            finalAssets[i] = assets[i];
            finalAmounts[i] = amounts[i];
        }
        
        emit RageQuitProcessed(msg.sender, finalAssets, finalAmounts, daiBalance);
    }
    
    /**
     * @dev Creates a new proposal
     * @param description Proposal description
     * @param amount Token amount
     * @param token Token address
     * @param recipient Recipient address
     * @param deadline Voting deadline
     */
    function createProposal(
        string memory description,
        uint256 amount,
        address token,
        address recipient,
        uint256 deadline
    ) external onlyRole(PROPOSAL_MANAGER_ROLE) {
        require(bytes(description).length > 0, "AssetDAO: empty description");
        require(amount > 0, "AssetDAO: zero amount");
        require(token != address(0), "AssetDAO: token is zero address");
        require(recipient != address(0), "AssetDAO: recipient is zero address");
        require(deadline > block.timestamp, "AssetDAO: deadline in past");
        
        // Create new proposal
        uint256 proposalId = proposalCount;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.amount = amount;
        proposal.token = token;
        proposal.recipient = recipient;
        proposal.deadline = deadline;
        proposal.yesVotes = 0;
        proposal.noVotes = 0;
        proposal.executed = false;
        proposal.passed = false;
        
        proposalCount++;
        
        emit ProposalCreated(proposalId, msg.sender, description);
    }
    
    /**
     * @dev Votes on a proposal
     * @param proposalId Proposal ID
     * @param voteYes Whether to vote yes
     */
    function vote(uint256 proposalId, bool voteYes) external {
        require(proposalId < proposalCount, "AssetDAO: invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.deadline, "AssetDAO: voting closed");
        require(!proposal.executed, "AssetDAO: already executed");
        require(!proposal.voted[msg.sender], "AssetDAO: already voted");
        require(daiToken.balanceOf(msg.sender) > 0, "AssetDAO: not a tokenholder");
        
        proposal.voted[msg.sender] = true;
        
        if (voteYes) {
            proposal.yesVotes += daiToken.balanceOf(msg.sender);
        } else {
            proposal.noVotes += daiToken.balanceOf(msg.sender);
        }
        
        emit ProposalVoted(proposalId, msg.sender, voteYes);
    }
    
    /**
     * @dev Executes a proposal after voting is complete
     * @param proposalId Proposal ID
     */
    function executeProposal(uint256 proposalId) external onlyRole(PROPOSAL_MANAGER_ROLE) {
        require(proposalId < proposalCount, "AssetDAO: invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp > proposal.deadline, "AssetDAO: voting still open");
        require(!proposal.executed, "AssetDAO: already executed");
        
        proposal.executed = true;
        
        // Check if proposal passed
        if (proposal.yesVotes > proposal.noVotes) {
            proposal.passed = true;
            
            // Execute the proposal
            IERC20(proposal.token).safeTransfer(proposal.recipient, proposal.amount);
        }
        
        emit ProposalExecuted(proposalId, proposal.passed);
    }
    
    /**
     * @dev Sets the investment window duration
     * @param newWindow New investment window in seconds
     */
    function setInvestmentWindow(uint256 newWindow) external onlyRole(ADMIN_ROLE) {
        investmentWindow = newWindow;
        emit InvestmentWindowSet(newWindow);
    }
    
    /**
     * @dev Opens or closes investments
     * @param isOpen Whether investments are open
     */
    function setInvestmentsOpen(bool isOpen) external onlyRole(ADMIN_ROLE) {
        investmentsOpen = isOpen;
        emit InvestmentStatusChanged(isOpen);
    }
    
    /**
     * @dev Sets minimum and maximum investment amounts
     * @param minAmount Minimum investment amount
     * @param maxAmount Maximum investment amount
     */
    function setMinMaxInvestment(uint256 minAmount, uint256 maxAmount) external onlyRole(ADMIN_ROLE) {
        require(minAmount < maxAmount, "AssetDAO: min must be less than max");
        minInvestmentAmount = minAmount;
        maxInvestmentAmount = maxAmount;
        emit MinMaxInvestmentSet(minAmount, maxAmount);
    }
    
    /**
     * @dev Updates the fee calculator
     * @param newCalculator New fee calculator address
     */
    function setFeeCalculator(address newCalculator) external onlyRole(ADMIN_ROLE) {
        require(newCalculator != address(0), "AssetDAO: calculator is zero address");
        feeCalculator = IFeeCalculator(newCalculator);
        emit FeesUpdated(newCalculator);
    }
    
    /**
     * @dev Updates the price oracle
     * @param newOracle New price oracle address
     */
    function setPriceOracle(address newOracle) external onlyRole(ADMIN_ROLE) {
        require(newOracle != address(0), "AssetDAO: oracle is zero address");
        priceOracle = IPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }
    
    /**
     * @dev Updates the treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        require(newTreasury != address(0), "AssetDAO: treasury is zero address");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Function that authorizes an upgrade
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}