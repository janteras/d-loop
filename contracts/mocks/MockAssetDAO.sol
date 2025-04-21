// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./base/BaseMock.sol";

import { IAssetDAO } from "../../contracts/interfaces/core/IAssetDAO.sol";
import "./MockFeeProcessor.sol";

/**
 * @title MockAssetDAO
 * @dev Comprehensive mock implementation of the AssetDAO contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock and implements core AssetDAO functionality
 */
contract MockAssetDAO is AccessControl, BaseMock, IAssetDAO {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    

    // Asset data structure
    struct Asset {
        uint256 id;
        string name;
        string description;
        address creator;
        address[] investors;
        mapping(address => uint256) investorShares;
        uint256 totalShares;
        AssetState state;
    }
    
    // Token addresses
    address public immutable DAI_TOKEN;
    address public immutable DLOOP_TOKEN;
    
    // External contract addresses
    address public immutable PRICE_ORACLE;
    address public immutable FEE_PROCESSOR;
    
    // Asset storage
    mapping(uint256 => Asset) public assets;
    uint256 public assetCount;
    
    // Events
    event AssetCreated(uint256 indexed assetId, address indexed creator, string name, string description);

    event AssetStateChanged(uint256 indexed assetId, AssetState newState);
    
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
        
        DAI_TOKEN = _daiToken;
        DLOOP_TOKEN = _dloopToken;
        PRICE_ORACLE = _priceOracle;
        FEE_PROCESSOR = _feeProcessor;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
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
    ) external returns (uint256 assetId) {
        _recordFunctionCall(
            "createAsset",
            abi.encode(name, description)
        );
        
        assetId = ++assetCount;
        
        Asset storage asset = assets[assetId];
        asset.id = assetId;
        asset.name = name;
        asset.description = description;
        asset.creator = msg.sender;
        asset.state = AssetState.Active;
        
        emit AssetCreated(assetId, msg.sender, name, description);
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
        if (asset.state != AssetState.Active) revert AssetNotActive();
        
        // Calculate fee (mocked to 5% for simplicity)
        uint256 fee = amount * 5 / 100;
        uint256 netAmount = amount - fee;
        
        // Calculate shares (1:1 for simplicity)
        shares = netAmount;
        
        // Update investor state
        if (asset.investorShares[msg.sender] == 0) {
            asset.investors.push(msg.sender);
        }
        asset.investorShares[msg.sender] += shares;
        asset.totalShares += shares;
        
        // Transfer tokens to the asset (from user) - mocked
        
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
        if (asset.state != AssetState.Active && asset.state != AssetState.Liquidating) 
            revert InvalidAssetState();
        
        // Check if investor has enough shares
        if (asset.investorShares[msg.sender] < shareAmount) revert InsufficientShares();
        
        // Calculate amount (1:1 for simplicity)
        amount = shareAmount;
        
        // Calculate fee (mocked to 3% for simplicity)
        uint256 fee = amount * 3 / 100;
        uint256 netAmount = amount - fee;
        
        // Update investor state
        asset.investorShares[msg.sender] -= shareAmount;
        asset.totalShares -= shareAmount;
        
        // Emit divestment event
        emit DivestmentMade(assetId, msg.sender, shareAmount, netAmount);
    }
    
    /**
     * @dev Gets investor shares in an asset
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @return shares Number of shares owned by the investor
     */
    function getInvestorShares(uint256 assetId, address investor) external view override returns (uint256 shares) {
        return assets[assetId].investorShares[investor];
    }
    
    /**
     * @dev Gets total shares in an asset
     * @param assetId ID of the asset
     * @return totalShares Total number of shares in the asset
     */
    function getTotalShares(uint256 assetId) external view returns (uint256 totalShares) {
        return assets[assetId].totalShares;
    }
    
    /**
     * @dev Gets investors in an asset
     * @param assetId ID of the asset
     * @return investors Array of investor addresses
     */
    function getInvestors(uint256 assetId) external view returns (address[] memory investors) {
        return assets[assetId].investors;
    }
    
    /**
     * @dev Changes the state of an asset
     * @param assetId ID of the asset
     * @param newState New state of the asset
     */
    function changeAssetState(uint256 assetId, AssetState newState) external onlyRole(ADMIN_ROLE) {
        _recordFunctionCall(
            "changeAssetState",
            abi.encode(assetId, newState)
        );
        
        Asset storage asset = assets[assetId];
        asset.state = newState;
        
        emit AssetStateChanged(assetId, newState);
    }
    
    /**
     * @dev Gets the state of an asset
     * @param assetId ID of the asset
     * @return state State of the asset
     */
    function getAssetState(uint256 assetId) external view returns (AssetState state) {
        return assets[assetId].state;
    }

    /**
     * @dev Create a new asset with extended parameters
     * @param name Name of the asset
     * @param description Description of the asset
     * @param targetFunding Target funding amount
     * @param minInvestment Minimum investment amount
     * @param maxInvestment Maximum investment amount
     * @param fundingPeriod Funding period in seconds
     * @param metadata Additional metadata URI
     * @return assetId ID of the created asset
     */
    function createAsset(
        string memory name,
        string memory description,
        uint256 targetFunding,
        uint256 minInvestment,
        uint256 maxInvestment,
        uint256 fundingPeriod,
        string memory metadata
    ) external returns (uint256 assetId) {
        _recordFunctionCall(
            "createAssetExtended",
            abi.encode(name, description, targetFunding, minInvestment, maxInvestment, fundingPeriod, metadata)
        );
        
        assetId = ++assetCount;
        
        Asset storage asset = assets[assetId];
        asset.id = assetId;
        asset.name = name;
        asset.description = description;
        asset.creator = msg.sender;
        asset.state = AssetState.Active;
        
        emit AssetCreated(assetId, msg.sender, name, description);
        return assetId;
    }

    /**
     * @dev Create a proposal for an asset
     * @param assetId ID of the asset
     * @param proposalType Type of the proposal
     * @param description Description of the proposal
     * @param targets Target addresses for calls
     * @param values ETH values for calls
     * @param calldatas Calldata for calls
     * @return proposalId ID of the created proposal
     */
    function createProposal(
        uint256 assetId,
        ProposalType proposalType,
        string memory description,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) external returns (uint256 proposalId) {
        _recordFunctionCall(
            "createProposal",
            abi.encode(assetId, proposalType, description, targets, values, calldatas)
        );
        
        // Mock implementation
        proposalId = 1;
        
        emit ProposalCreated(proposalId, assetId, msg.sender, proposalType);
        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether to support the proposal
     */
    function vote(uint256 proposalId, bool support) external {
        _recordFunctionCall(
            "vote",
            abi.encode(proposalId, support)
        );
        
        emit VoteCast(proposalId, msg.sender, support, 1);
    }

    /**
     * @dev Execute a proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(uint256 proposalId) external {
        _recordFunctionCall(
            "executeProposal",
            abi.encode(proposalId)
        );
        
        emit ProposalStateChanged(proposalId, ProposalState.Active, ProposalState.Executed);
    }

    /**
     * @dev Cancel a proposal
     * @param proposalId ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external {
        _recordFunctionCall(
            "cancelProposal",
            abi.encode(proposalId)
        );
        
        emit ProposalStateChanged(proposalId, ProposalState.Active, ProposalState.Canceled);
    }

    /**
     * @dev Rage quit from an asset (emergency withdrawal)
     * @param assetId ID of the asset
     * @param shares Number of shares to withdraw
     */
    function rageQuit(uint256 assetId, uint256 shares) external {
        _recordFunctionCall(
            "rageQuit",
            abi.encode(assetId, shares)
        );
        
        Asset storage asset = assets[assetId];
        if (asset.investorShares[msg.sender] < shares) revert InsufficientShares();
        
        asset.investorShares[msg.sender] -= shares;
        asset.totalShares -= shares;
        
        // Mock refund amount (1:1 for simplicity)
        uint256 refundAmount = shares;
        
        emit RageQuit(assetId, msg.sender, shares, refundAmount);
    }

    /**
     * @dev Update asset state
     * @param assetId ID of the asset
     * @param newState New state of the asset
     */
    function updateAssetState(uint256 assetId, AssetState newState) external {
        _recordFunctionCall(
            "updateAssetState",
            abi.encode(assetId, newState)
        );
        
        Asset storage asset = assets[assetId];
        AssetState oldState = asset.state;
        asset.state = newState;
        
        emit AssetStateChanged(assetId, newState);
    }

    /**
     * @dev Get asset details
     * @param assetId ID of the asset
     * @return name Name of the asset
     * @return description Description of the asset
     * @return creator Address of the creator
     * @return targetFunding Target funding amount
     * @return currentFunding Current funding amount
     * @return state State of the asset
     * @return createdAt Creation timestamp
     * @return fundingEnds Funding end timestamp
     */
    function getAsset(uint256 assetId) external view returns (
        string memory name,
        string memory description,
        address creator,
        uint256 targetFunding,
        uint256 currentFunding,
        AssetState state,
        uint256 createdAt,
        uint256 fundingEnds
    ) {
        Asset storage asset = assets[assetId];
        
        return (
            asset.name,
            asset.description,
            asset.creator,
            0, // Mock target funding
            asset.totalShares, // Mock current funding
            asset.state,
            block.timestamp - 1 days, // Mock creation timestamp
            block.timestamp + 30 days // Mock funding end timestamp
        );
    }

    /**
     * @dev Get proposal details
     * @param proposalId ID of the proposal
     * @return id Proposal ID
     * @return assetId Asset ID
     * @return proposer Proposer address
     * @return proposalType Proposal type
     * @return description Proposal description
     * @return state Proposal state
     * @return createdAt Creation timestamp
     * @return votingEnds Voting end timestamp
     * @return forVotes Votes in favor
     * @return againstVotes Votes against
     */
    function getProposalDetails(uint256 proposalId) external view returns (
        uint256 id,
        uint256 assetId,
        address proposer,
        ProposalType proposalType,
        string memory description,
        ProposalState state,
        uint256 createdAt,
        uint256 votingEnds,
        uint256 forVotes,
        uint256 againstVotes
    ) {
        // Mock implementation
        return (
            proposalId,
            1, // Mock asset ID
            address(0x123), // Mock proposer
            ProposalType.Investment, // Mock proposal type
            "Mock proposal", // Mock description
            ProposalState.Active, // Mock state
            block.timestamp - 1 days, // Mock creation timestamp
            block.timestamp + 2 days, // Mock voting end timestamp
            10, // Mock for votes
            5 // Mock against votes
        );
    }

    /**
     * @dev Check if an address has voted on a proposal
     * @return hasVoted Whether the address has voted
     */
    function hasVoted(uint256, address) external pure override returns (bool) {
        // Mock implementation
        return false;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external {
        _recordFunctionCall("pause", "");
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external {
        _recordFunctionCall("unpause", "");
    }

    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external {
        _recordFunctionCall(
            "transferOwnership",
            abi.encode(newOwner)
        );
    }

    // Test helper functions

    /**
     * @dev Set investor shares directly (test helper)
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @param shares Number of shares to set
     */
    function setInvestorShares(uint256 assetId, address investor, uint256 shares) external {
        _recordFunctionCall(
            "setInvestorShares",
            abi.encode(assetId, investor, shares)
        );
        
        Asset storage asset = assets[assetId];
        
        // If investor doesn't exist and shares > 0, add them
        if (asset.investorShares[investor] == 0 && shares > 0) {
            asset.investors.push(investor);
        }
        
        // Update total shares
        asset.totalShares = asset.totalShares - asset.investorShares[investor] + shares;
        
        // Set new shares
        asset.investorShares[investor] = shares;
    }

    /**
     * @dev Force set asset state (test helper)
     * @param assetId ID of the asset
     * @param newState New state to set
     */
    function forceSetAssetState(uint256 assetId, AssetState newState) external {
        _recordFunctionCall(
            "forceSetAssetState",
            abi.encode(assetId, newState)
        );
        
        Asset storage asset = assets[assetId];
        asset.state = newState;
    }
}
