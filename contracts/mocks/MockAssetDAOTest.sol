// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../utils/Errors.sol";
import "./MockFeeProcessor.sol";
import "./base/BaseMock.sol";

/**
 * @title MockAssetDAOTest
 * @dev Mock implementation of the AssetDAO contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockAssetDAOTest is AccessControl, BaseMock {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ASSET_OPERATOR_ROLE = keccak256("ASSET_OPERATOR_ROLE");
    
    // Token addresses
    address public immutable daiToken;
    address public immutable dloopToken;
    
    // External contract addresses
    address public immutable priceOracle;
    address public immutable feeProcessor;
    
    // Asset data structure
    struct Asset {
        uint256 id;
        string name;
        string description;
        address[] investors;
        mapping(address => uint256) investorShares;
        uint256 totalShares;
        bool active;
    }
    
    // Asset storage
    mapping(uint256 => Asset) public assets;
    uint256 public assetCount;
    
    // Events
    event AssetCreated(uint256 indexed assetId, string name, string description);
    event InvestmentMade(uint256 indexed assetId, address indexed investor, uint256 amount, uint256 shares);
    event DivestmentMade(uint256 indexed assetId, address indexed investor, uint256 shares, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _daiToken DAI token address
     * @param _dloopToken DLOOP token address
     * @param _priceOracle Price oracle address
     * @param _feeProcessor Fee processor address
     */
    constructor(
        address _daiToken,
        address _dloopToken,
        address _priceOracle,
        address _feeProcessor
    ) BaseMock() {
        if (_daiToken == address(0) ||
            _dloopToken == address(0) ||
            _priceOracle == address(0) ||
            _feeProcessor == address(0)) revert ZeroAddress();
        
        daiToken = _daiToken;
        dloopToken = _dloopToken;
        priceOracle = _priceOracle;
        feeProcessor = _feeProcessor;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ASSET_OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Creates a new asset
     * @param name Name of the asset
     * @param description Description of the asset
     * @return assetId ID of the created asset
     */
    function createAsset(
        string memory name,
        string memory description
    ) external onlyRole(ADMIN_ROLE) returns (uint256 assetId) {
        _recordFunctionCall(
            "createAsset",
            abi.encode(name, description)
        );
        assetId = ++assetCount;
        
        Asset storage asset = assets[assetId];
        asset.id = assetId;
        asset.name = name;
        asset.description = description;
        asset.active = true;
        
        emit AssetCreated(assetId, name, description);
    }
    
    /**
     * @dev Invests in an asset
     * @param assetId ID of the asset to invest in
     * @param amount Amount of DAI to invest
     * @return shares Number of shares received
     */
    function invest(uint256 assetId, uint256 amount) external returns (uint256 shares) {
        _recordFunctionCall(
            "invest",
            abi.encode(assetId, amount)
        );
        // Validate input
        if (amount == 0) revert InvalidAmount();
        
        Asset storage asset = assets[assetId];
        if (!asset.active) revert AssetNotActive();
        
        // Calculate fee first
        uint256 fee = MockFeeProcessor(feeProcessor).collectInvestFee(daiToken, amount);
        uint256 netAmount = amount - fee;
        
        // Calculate shares (1:1 for simplicity)
        shares = netAmount;
        
        // Update investor state
        if (asset.investorShares[msg.sender] == 0) {
            asset.investors.push(msg.sender);
        }
        asset.investorShares[msg.sender] += shares;
        asset.totalShares += shares;
        
        // Transfer tokens to the asset (from user)
        bool success = IERC20(daiToken).transferFrom(msg.sender, address(this), amount);
        if (!success) revert TokenTransferFailed();
        
        // Emit investment event
        emit InvestmentMade(assetId, msg.sender, netAmount, shares);
    }
    
    /**
     * @dev Divests from an asset
     * @param assetId ID of the asset to divest from
     * @param shareAmount Number of shares to divest
     * @return amount Amount of DAI received
     */
    function divest(uint256 assetId, uint256 shareAmount) external returns (uint256 amount) {
        _recordFunctionCall(
            "divest",
            abi.encode(assetId, shareAmount)
        );
        // Validate input
        if (shareAmount == 0) revert InvalidAmount();
        
        Asset storage asset = assets[assetId];
        if (!asset.active) revert AssetNotActive();
        
        // Check if investor has enough shares
        if (asset.investorShares[msg.sender] < shareAmount) revert InsufficientShares();
        
        // Calculate amount (1:1 for simplicity)
        amount = shareAmount;
        
        // Calculate fee
        uint256 fee = MockFeeProcessor(feeProcessor).collectDivestFee(daiToken, amount);
        uint256 netAmount = amount - fee;
        
        // Update investor state
        asset.investorShares[msg.sender] -= shareAmount;
        asset.totalShares -= shareAmount;
        
        // Transfer tokens to investor
        bool success = IERC20(daiToken).transfer(msg.sender, netAmount);
        if (!success) revert TokenTransferFailed();
        
        // Emit divestment event
        emit DivestmentMade(assetId, msg.sender, shareAmount, netAmount);
    }
    
    /**
     * @dev Gets investor shares in an asset
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @return shares Number of shares owned by the investor
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getInvestorShares(uint256 assetId, address investor) external view returns (uint256 shares) {
        return assets[assetId].investorShares[investor];
    }
    
    /**
     * @dev Gets total shares in an asset
     * @param assetId ID of the asset
     * @return totalShares Total number of shares in the asset
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getTotalShares(uint256 assetId) external view returns (uint256 totalShares) {
        return assets[assetId].totalShares;
    }
    
    /**
     * @dev Gets investors in an asset
     * @param assetId ID of the asset
     * @return investors Array of investor addresses
     */
    // NOTE: _recordFunctionCall removed to preserve view function purity (no state modification allowed)
    function getInvestors(uint256 assetId) external view returns (address[] memory investors) {
        return assets[assetId].investors;
    }
    
    /**
     * @dev Approves token transfers
     * @param token Token address
     * @param spender Address that will be allowed to spend tokens
     * @param amount Amount of tokens to approve
     * @return success True if the approval was successful
     */
    function allowTokenTransfer(
        address token,
        address spender,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) returns (bool success) {
        _recordFunctionCall(
            "allowTokenTransfer",
            abi.encode(token, spender, amount)
        );
        // Check if token is supported
        if (token == address(0)) revert ZeroAddress();
        
        // Approve token spending
        success = IERC20(token).approve(spender, amount);
        if (!success) revert OperationFailed();
        
        return success;
    }
}