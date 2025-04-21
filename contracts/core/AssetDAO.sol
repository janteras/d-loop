// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../utils/Errors.sol";


import { IFeeProcessor } from "../interfaces/fees/IFeeProcessor.sol";
import { IProtocolDAO } from "../interfaces/governance/IProtocolDAO.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPriceOracle } from "../interfaces/oracle/IPriceOracle.sol";

/**
 * @title AssetDAO
 * @dev DAO for managing AI assets in the D-Loop Protocol
 * @notice This contract handles the governance and management of AI asset pools using the D-AI token
 * @custom:security-contact security@d-loop.io
 * @custom:protocol D-Loop Protocol
 */
/**
 * [TESTNET] This contract is configured for Sepolia testnet deployment.
 * - Only deployer/admin controls all roles (no multisig, no external admin contracts)
 * - Proposal, voting, and execution flows use simplified parameters (shorter periods, lower quorum)
 * - Mint/burn logic is simplified (1:1 with test assets, no mainnet restrictions)
 * - No cross-chain or Hedera checks present
 * - Timelocks on parameter changes are disabled or minimal
 * - All testnet-specific logic is clearly marked with [TESTNET] comments
 */
contract AssetDAO is AccessControl {
    // Constants
    // [TESTNET] Role management: Only deployer/admin controls all roles (no multisig, no external admin contracts)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant AUTHORIZED_CONTRACT_ROLE = keccak256("AUTHORIZED_CONTRACT_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    
    // Asset states
    enum AssetState {
        Inactive,
        Active,
        Liquidating,
        Closed
    }
    
    // Proposal types
    enum ProposalType {
        Investment,
        Divestment,
        ParameterChange,
        Other
    }
    
    // [TESTNET] Timelocks on parameter changes are disabled or minimal for rapid iteration
    // Proposal states
    enum ProposalState {
        Pending,
        Active,
        Rejected,
        Approved,
        Executed,
        Canceled
    }
    
    // [TESTNET] Mint/burn logic is simplified (1:1 with test assets, no mainnet restrictions)
    // Asset structure
    struct Asset {
        uint256 id;
        string name;
        string description;
        address creator;
        uint256 createdAt;
        AssetState state;
        uint256 totalInvestment;
        uint256 totalShares;
        address[] investors;
        mapping(address => uint256) investorShares;
    }
    
    // [TESTNET] Proposal, voting, and execution flows use simplified parameters (shorter periods, lower quorum)
    // Proposal structure
    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address assetAddress;
        uint256 amount;
        string description;
        address proposer;
        uint256 createdAt;
        uint256 votingEnds;
        uint256 timelockEnds; // When the timelock period ends
        uint256 yesVotes;
        uint256 noVotes;
        ProposalState status;
        bool executed;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) lastVoteTime; // Track when each user last voted
    }
    
    // Structure for returning proposal details to avoid stack too deep errors
    struct ProposalDetails {
        uint256 id;
        ProposalType proposalType;
        address assetAddress;
        uint256 amount;
        string description;
        address proposer;
        uint256 createdAt;
        uint256 votingEnds;
        uint256 yesVotes;
        uint256 noVotes;
        ProposalState status;
        bool executed;
    }
    
    // Addresses
    address private _owner;
    address private _admin;
    address public daiToken;
    address public dloopToken;
    address public priceOracle;

    /**
     * @dev Internal function to get the normalized price (18 decimals) for an asset from the oracle
     * @param asset Address of the asset
     * @return price Normalized price (18 decimals)
     */
    function _getAssetPrice(address asset) internal view returns (uint256 price) {
        if (priceOracle == address(0)) revert ZeroAddress();
        return IPriceOracle(priceOracle).getAssetPrice(asset);
    }

    /**
     * @dev Internal function to get the decimals for an asset from the oracle (should always be 18)
     * @param asset Address of the asset
     * @return decimals Always returns 18
     */
    function _getAssetDecimals(address asset) internal view returns (uint8 decimals) {
        if (priceOracle == address(0)) revert ZeroAddress();
        return IPriceOracle(priceOracle).getAssetDecimals(asset);
    }
    address public feeProcessor;
    address public protocolDAO;
    
    // Governance parameters
    uint256 public quorum = 1000; // 10% in basis points (10000 = 100%)
    uint256 public votingPeriod = 3 days;
    uint256 public executionDelay = 1 days;
    uint256 public minProposalStake = 1000 * 10**18; // 1000 DLOOP tokens
    uint256 public minVotingBuffer = 6 hours; // Minimum time before a vote can be changed
    uint256 public timelockPeriod = 1 days; // Period for timelock on proposal execution
    
    // Pause state
    bool public paused = false;
    
    // Supported assets
    mapping(address => bool) public supportedAssets;
    address[] private supportedAssetsList;
    
    // Asset tracking
    mapping(uint256 => Asset) private assets;
    uint256 private assetCounter;
    
    // Events
    event AssetCreated(uint256 indexed assetId, string name, address indexed creator);
    event AssetStateUpdated(uint256 indexed assetId, AssetState oldState, AssetState newState);
    event InvestmentMade(uint256 indexed assetId, address indexed investor, uint256 amount, uint256 shares);
    event DivestmentMade(uint256 indexed assetId, address indexed investor, uint256 amount, uint256 shares);
    event AdminUpdated(address indexed oldAdmin, address indexed newAdmin);
    event FeeProcessorUpdated(address indexed oldFeeProcessor, address indexed newFeeProcessor);
    event PriceOracleUpdated(address indexed oldPriceOracle, address indexed newPriceOracle);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event WhitelistCheckFailed(address indexed token);
    
    /**
     * @dev Modifier to restrict access to owner
     */
    modifier onlyOwner() {
        if (msg.sender != _owner) revert CallerNotOwner();
        _;
    }
    
    /**
     * @dev Modifier to restrict access to admin
     */
    modifier onlyAdmin() {
        if (msg.sender != _admin && msg.sender != _owner) revert CallerNotAdmin();
        _;
    }
    
    /**
     * @dev Returns the address of the current owner
     */
    function owner() public view returns (address) {
        return _owner;
    }
    
    /**
     * @dev Returns the address of the current admin
     */
    function admin() public view returns (address) {
        return _admin;
    }
    
    /**
     * @dev Constructor to initialize the AssetDAO contract
     * @param daiToken_ Address of D-Loop's Asset Index token (D-AI)
     * @notice D-AI is the D-Loop Asset Index token, distinct from MakerDAO's DAI token
     * @dev See DAIToken.sol for D-AI implementation details
     * @param dloopToken_ Address of the governance token (DLOOP)
     * @param priceOracle_ Address of the price oracle contract
     * @param feeProcessor_ Address of the fee distribution handler
     * @param protocolDAO_ Address of the ProtocolDAO contract
     * @custom:security The D-AI token address must be verified to ensure it's not MakerDAO's DAI
     */
    constructor(
        address daiToken_,
        address dloopToken_,
        address priceOracle_,
        address feeProcessor_,
        address protocolDAO_
    ) {
        if (daiToken_ == address(0) || dloopToken_ == address(0) || 
            priceOracle_ == address(0) || feeProcessor_ == address(0) ||
            protocolDAO_ == address(0))
            revert ZeroAddress();
        
        _owner = msg.sender;
        _admin = msg.sender;
        daiToken = daiToken_;
        dloopToken = dloopToken_;
        priceOracle = priceOracle_;
        feeProcessor = feeProcessor_;
        protocolDAO = protocolDAO_;
        
        // Initialize asset counter
        assetCounter = 0;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OWNER_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(AUTHORIZED_CONTRACT_ROLE, feeProcessor_);
    }
    
    /**
     * @dev Creates a new asset
     * @param name Name of the asset
     * @param description Description of the asset
     * @return assetId The ID of the created asset
     */
    function createAsset(
        string memory name,
        string memory description
    ) external returns (uint256) {
        // Increment asset counter
        assetCounter++;
        uint256 assetId = assetCounter;
        
        // Create new asset
        Asset storage asset = assets[assetId];
        asset.id = assetId;
        asset.name = name;
        asset.description = description;
        asset.creator = msg.sender;
        asset.createdAt = block.timestamp;
        asset.state = AssetState.Active;
        asset.totalInvestment = 0;
        asset.totalShares = 0;
        
        // Add creator as initial investor with 0 shares
        asset.investors.push(msg.sender);
        asset.investorShares[msg.sender] = 0;
        
        // Emit creation event
        emit AssetCreated(assetId, name, msg.sender);
        
        return assetId;
    }
    
    /**
     * @dev Updates the state of an asset
     * @param assetId ID of the asset
     * @param newState New state of the asset
     */
    function updateAssetState(uint256 assetId, AssetState newState) external onlyAdmin {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        

        AssetState oldState = asset.state;
        asset.state = newState;
        emit AssetStateUpdated(assetId, oldState, newState);
    }
    
    /**
     * @dev Gets the details of an asset
     * @param assetId ID of the asset
     * @return id ID of the asset
     * @return name Name of the asset
     * @return description Description of the asset
     * @return creator Address of the creator
     * @return createdAt Creation timestamp
     * @return state State of the asset
     * @return totalInvestment Total investment in the asset
     * @return totalShares Total shares of the asset
     */
    function getAssetDetails(uint256 assetId) external view returns (
        uint256 id,
        string memory name,
        string memory description,
        address creator,
        uint256 createdAt,
        AssetState state,
        uint256 totalInvestment,
        uint256 totalShares
    ) {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        
        return (
            asset.id,
            asset.name,
            asset.description,
            asset.creator,
            asset.createdAt,
            asset.state,
            asset.totalInvestment,
            asset.totalShares
        );
    }
    
    /**
     * @dev Gets the investors of an asset
     * @param assetId ID of the asset
     * @return investors Addresses of the investors
     */
    function getAssetInvestors(uint256 assetId) external view returns (address[] memory) {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        
        return asset.investors;
    }
    
    /**
     * @dev Gets the shares of an investor in an asset
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @return shares Number of shares
     */
    function getInvestorShares(uint256 assetId, address investor) external view returns (uint256) {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        
        return asset.investorShares[investor];
    }
    
    /**
     * @dev Invests in an asset
     * @param assetId ID of the asset
     * @param amount Amount to invest
     */
    function invest(uint256 assetId, uint256 amount) external whenNotPaused {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        if (asset.state != AssetState.Active) revert InvalidAssetState();
        if (amount == 0) revert InvalidAmount();
        
        // Calculate and collect invest fee
        uint256 feeAmount = 0;
        
        // Collect fee through FeeProcessor
        try IFeeProcessor(feeProcessor).collectInvestFee(daiToken, amount) returns (uint256 fee) {
            feeAmount = fee;
        } catch {
            // If fee collection fails, revert
            revert OperationFailed();
        }
        
        // Calculate net investment amount after fees
        uint256 netAmount = amount - feeAmount;
        
        // Calculate shares (simplified: 1 token = 1 share)
        uint256 shares = netAmount;
        
        // Update asset state
        asset.totalInvestment += netAmount;
        asset.totalShares += shares;
        
        // Update investor state
        if (asset.investorShares[msg.sender] == 0) {
            asset.investors.push(msg.sender);
        }
        asset.investorShares[msg.sender] += shares;
        
        // Transfer tokens to the asset (from user)
        IERC20(daiToken).transferFrom(msg.sender, address(this), netAmount);
        
        // Emit investment event
        emit InvestmentMade(assetId, msg.sender, netAmount, shares);
    }
    
    /**
     * @dev Divests from an asset
     * @param assetId ID of the asset
     * @param shares Number of shares to divest
     */
    function divest(uint256 assetId, uint256 shares) external whenNotPaused {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        if (
    asset.state != AssetState.Active &&
    asset.state != AssetState.Liquidating
) revert InvalidAssetState();
        if (shares == 0) revert InvalidAmount();
        if (asset.investorShares[msg.sender] < shares) revert InsufficientFunds();
        
        // Calculate amount based on shares (simplified: 1 token = 1 share)
        uint256 grossAmount = shares;
        
        // Calculate and collect divest fee
        uint256 feeAmount = 0;
        
        // Collect fee through FeeProcessor
        try IFeeProcessor(feeProcessor).collectDivestFee(daiToken, grossAmount) returns (uint256 fee) {
            feeAmount = fee;
        } catch {
            // If fee collection fails, revert
            revert OperationFailed();
        }
        
        // Calculate net amount after fees
        uint256 netAmount = grossAmount - feeAmount;
        
        // Update asset state
        asset.totalInvestment -= grossAmount;
        asset.totalShares -= shares;
        
        // Update investor state
        asset.investorShares[msg.sender] -= shares;
        
        // Transfer tokens to the user from the asset
        IERC20(daiToken).transfer(msg.sender, netAmount);
        
        // Emit divestment event
        emit DivestmentMade(assetId, msg.sender, netAmount, shares);
    }
    
    /**
     * @dev Allows investor to execute an emergency withdrawal (rage quit) from an asset
     *      with validation of token whitelist and appropriate fee collection.
     *      Emergency withdrawal from an asset with whitelist verification.
     * @param assetId ID of the asset to withdraw from
     * @param shares Number of shares to withdraw
     * @notice This function charges a higher fee than normal divestment
     * @notice For Sepolia testnet: maintains simplified assetId/shares interface 
     *         instead of token/amount in whitepaper
     */
    function rageQuit(uint256 assetId, uint256 shares) external whenNotPaused {
        Asset storage asset = assets[assetId];
        
        // Validate the request
        if (asset.creator == address(0)) revert AssetNotFound();
        if (shares == 0) revert InvalidAmount();
        if (asset.investorShares[msg.sender] < shares) revert InsufficientFunds();
        
        // Calculate amount based on shares (simplified: 1 token = 1 share)
        uint256 grossAmount = shares;
        
        // Check if the token is whitelisted in ProtocolDAO 
        // For Sepolia: We're using a fixed daiToken, but in mainnet this would be more dynamic
        try IProtocolDAO(protocolDAO).isTokenWhitelisted(daiToken) returns (bool isWhitelisted) {
            if (!isWhitelisted) revert TokenNotWhitelisted();
        } catch {
            // If the check fails, continue but log the event
            emit WhitelistCheckFailed(daiToken);
        }
        
        // Calculate and collect ragequit fee
        uint256 feeAmount = 0;
        
        // Collect fee through FeeProcessor
        try IFeeProcessor(feeProcessor).collectRagequitFee(daiToken, grossAmount) returns (uint256 fee) {
            feeAmount = fee;
        } catch {
            // If fee collection fails, revert
            revert OperationFailed();
        }
        
        // Calculate net amount after fees
        uint256 netAmount = grossAmount - feeAmount;
        
        // Update asset state
        asset.totalInvestment -= grossAmount;
        asset.totalShares -= shares;
        
        // Update investor state
        asset.investorShares[msg.sender] -= shares;
        
        // Transfer tokens to the user from the asset
        IERC20(daiToken).transfer(msg.sender, netAmount);
        
        // Emit divestment event with ragequit flag
        emit DivestmentMade(assetId, msg.sender, netAmount, shares);
    }
    
    /**
     * @dev Gets the asset count
     * @return count Number of assets created
     */
    function getAssetCount() external view returns (uint256) {
        return assetCounter;
    }
    
    /**
     * @dev Updates the admin address
     * @param _newAdmin Address of the new admin
     */
    function updateAdmin(address _newAdmin) external onlyOwner {
        if (_newAdmin == address(0)) revert ZeroAddress();
        
        address oldAdmin = _admin;
        _admin = _newAdmin;
        
        // Update role
        _revokeRole(ADMIN_ROLE, oldAdmin);
        _revokeRole(GOVERNANCE_ROLE, oldAdmin);
        _grantRole(ADMIN_ROLE, _newAdmin);
        _grantRole(GOVERNANCE_ROLE, _newAdmin);
        
        emit AdminUpdated(oldAdmin, _newAdmin);
    }
    
    /**
     * @dev Updates the fee processor address
     * @param _newFeeProcessor Address of the new fee processor
     */
    function updateFeeProcessor(address _newFeeProcessor) external onlyOwner {
        if (_newFeeProcessor == address(0)) revert ZeroAddress();
        
        address oldFeeProcessor = feeProcessor;
        feeProcessor = _newFeeProcessor;
        
        // Update role
        _revokeRole(AUTHORIZED_CONTRACT_ROLE, oldFeeProcessor);
        _grantRole(AUTHORIZED_CONTRACT_ROLE, _newFeeProcessor);
        
        emit FeeProcessorUpdated(oldFeeProcessor, _newFeeProcessor);
    }
    
    /**
     * @dev Updates the price oracle address
     * @param _newPriceOracle Address of the new price oracle
     */
    function updatePriceOracle(address _newPriceOracle) external onlyOwner {
        if (_newPriceOracle == address(0)) revert ZeroAddress();
        
        address oldPriceOracle = priceOracle;
        priceOracle = _newPriceOracle;
        
        emit PriceOracleUpdated(oldPriceOracle, _newPriceOracle);
    }
    
    /**
     * @dev Approves a token for transfer from this contract
     * @param token Address of the token to approve
     * @param spender Address that will be allowed to transfer the tokens
     * @param amount Amount of tokens to approve
     */
    function allowTokenTransfer(address token, address spender, uint256 amount) external onlyOwner {
        if (token == address(0) || spender == address(0)) revert ZeroAddress();
        IERC20(token).approve(spender, amount);
    }
    
    /**
     * @dev Transfers ownership of the contract
     * @param _newOwner Address of the new owner
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = _owner;
        _owner = _newOwner;
        
        // Update role
        _revokeRole(DEFAULT_ADMIN_ROLE, oldOwner);
        _revokeRole(OWNER_ROLE, oldOwner);
        _revokeRole(GOVERNANCE_ROLE, oldOwner);
        _grantRole(DEFAULT_ADMIN_ROLE, _newOwner);
        _grantRole(OWNER_ROLE, _newOwner);
        _grantRole(GOVERNANCE_ROLE, _newOwner);
        
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    /**
     * @dev Checks if an asset exists
     * @param assetId ID of the asset
     * @return exists Whether the asset exists
     */
    function assetExists(uint256 assetId) external view returns (bool) {
        return assets[assetId].creator != address(0);
    }
    
    /**
     * @dev Gets the asset state
     * @param assetId ID of the asset
     * @return state State of the asset
     */
    function getAssetState(uint256 assetId) external view returns (AssetState) {
        Asset storage asset = assets[assetId];
        
        if (asset.creator == address(0)) revert AssetNotFound();
        
        return asset.state;
    }

    // Governance Functions

    // Storage for proposals
    mapping(uint256 => Proposal) private proposals;
    uint256 public proposalCounter;

    // Events for governance
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);
    event QuorumChanged(uint256 oldQuorum, uint256 newQuorum);
    event VotingPeriodChanged(uint256 oldVotingPeriod, uint256 newVotingPeriod);
    event ExecutionDelayChanged(uint256 oldExecutionDelay, uint256 newExecutionDelay);
    event MinStakeChanged(uint256 oldMinStake, uint256 newMinStake);

    /**
     * @dev Modifier to check if a proposal exists
     * @param proposalId ID of the proposal
     */
    modifier proposalExists(uint256 proposalId) {
        if (proposals[proposalId].proposer == address(0)) revert ProposalNotFound();
        _;
    }

    /**
     * @dev Modifier to check if contract is not paused
     */
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /**
     * @dev Creates a new proposal
     * @param proposalType Type of the proposal
     * @param assetAddress Address related to the proposal (if applicable)
     * @param amount Amount related to the proposal (if applicable)
     * @param description Description of the proposal
     * @return proposalId ID of the created proposal
     */
    function createProposal(
        ProposalType proposalType,
        address assetAddress,
        uint256 amount,
        string memory description
    ) external whenNotPaused returns (uint256) {
        // Check if sender has enough tokens staked (would use actual token check in production)
        // if (dloopToken balance < minProposalStake) revert Errors.InsufficientStake()
        
        // Increment proposal counter
        proposalCounter++;
        uint256 proposalId = proposalCounter;
        
        // Create new proposal
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposalType = proposalType;
        proposal.assetAddress = assetAddress;
        proposal.amount = amount;
        proposal.description = description;
        proposal.proposer = msg.sender;
        
        // Use block.timestamp as a base, but enforce minimum time periods
        // to prevent exploitation of timestamp manipulation
        uint256 currentTimestamp = block.timestamp;
        proposal.createdAt = currentTimestamp;
        proposal.votingEnds = currentTimestamp + votingPeriod;
        proposal.timelockEnds = proposal.votingEnds + timelockPeriod;
        
        proposal.yesVotes = 0;
        proposal.noVotes = 0;
        proposal.status = ProposalState.Active;
        proposal.executed = false;
        
        // Emit creation event
        emit ProposalCreated(proposalId, msg.sender, description);
        
        return proposalId;
    }
    
    /**
     * @dev Votes on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether the voter supports the proposal
     */
    function vote(uint256 proposalId, bool support) external whenNotPaused proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        // Check if voting period is active
        if (block.timestamp > proposal.votingEnds) revert VotingPeriodEnded();
        
        // Check if proposal is active
        if (proposal.status != ProposalState.Active) revert InvalidProposalState();
        
        // Check if voter has already voted
        bool hasVotedBefore = proposal.hasVoted[msg.sender];
        
        // If voter has voted recently, enforce a buffer period to prevent rapid vote changes
        // that could potentially be used in frontrunning attacks
        if (hasVotedBefore) {
            uint256 lastVoteTime = proposal.lastVoteTime[msg.sender];
            if (block.timestamp < lastVoteTime + minVotingBuffer) {
                revert VotingBufferNotElapsed();
            }
        }
        
        // Get voting power before any state changes to prevent reentrancy
        uint256 votingPower = ERC20(dloopToken).balanceOf(msg.sender);
        
        // If already voted, remove previous vote before adding new one
        if (hasVotedBefore) {
            // This isn't a perfect solution since their voting power may have changed,
            // but it's better than allowing rapid vote changes
            if (support) {
                proposal.noVotes -= votingPower;
                proposal.yesVotes += votingPower;
            } else {
                proposal.yesVotes -= votingPower;
                proposal.noVotes += votingPower;
            }
        } else {
            // First time voting
            proposal.hasVoted[msg.sender] = true;
            
            if (support) {
                proposal.yesVotes += votingPower;
            } else {
                proposal.noVotes += votingPower;
            }
        }
        
        // Update last vote time
        proposal.lastVoteTime[msg.sender] = block.timestamp;
        
        // Emit event
        emit VoteCast(proposalId, msg.sender, support);
    }
    
    /**
     * @dev Executes a proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(uint256 proposalId) external whenNotPaused proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        // Check if voting period has ended
        if (block.timestamp <= proposal.votingEnds) revert VotingPeriodNotEnded();
        
        // Check if timelock period has elapsed
        // This enforces a delay between voting end and execution to prevent last-minute attacks
        if (block.timestamp < proposal.timelockEnds) revert TimelockPeriodNotElapsed();
        
        // Check if proposal has not been executed
        if (proposal.executed) revert ProposalAlreadyExecuted();
        
        // Check if quorum is reached
        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        uint256 quorumVotes = (totalVotes * quorum) / 10000; // 10000 basis points = 100%
        if (proposal.yesVotes < quorumVotes) revert QuorumNotReached();
        
        // Check if proposal has majority support
        if (proposal.yesVotes <= proposal.noVotes) revert MajorityNotReached();
        
        // Mark proposal as executed
        proposal.executed = true;
        proposal.status = ProposalState.Executed;
        
        // Execute proposal logic based on type
        if (proposal.proposalType == ProposalType.Investment) {
            // Investment logic would be implemented here
        } else if (proposal.proposalType == ProposalType.Divestment) {
            // Divestment logic would be implemented here
        } else if (proposal.proposalType == ProposalType.ParameterChange) {
            // Parameter change logic would be implemented here
        }
        
        // Emit event
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @dev Cancels a proposal (only proposer or admin)
     * @param proposalId ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        // Check if caller is proposer or admin
        if (msg.sender != proposal.proposer && msg.sender != _admin && msg.sender != _owner)
            revert NotAuthorized();
        
        // Check if proposal has not been executed
        if (proposal.executed) revert ProposalAlreadyExecuted();
        
        // Mark proposal as canceled
        proposal.status = ProposalState.Canceled;
        
        // Emit event
        emit ProposalCanceled(proposalId);
    }
    
    /**
     * @dev Checks if an address has voted on a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     * @return hasVoted Whether the address has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view proposalExists(proposalId) returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }
    
    /**
     * @dev Updates the quorum required for proposal execution
     * @param _newQuorum New quorum value in basis points (e.g., 1000 = 10%)
     */
    function updateQuorum(uint256 _newQuorum) external onlyAdmin {
        if (_newQuorum == 0 || _newQuorum > 10000) revert InvalidParameter();
        
        uint256 oldQuorum = quorum;
        quorum = _newQuorum;
        
        emit QuorumChanged(oldQuorum, _newQuorum);
    }
    
    /**
     * @dev Updates the voting period duration
     * @param _newVotingPeriod New voting period in seconds
     */
    function updateVotingPeriod(uint256 _newVotingPeriod) external onlyAdmin {
        if (_newVotingPeriod == 0) revert InvalidParameter();
        
        uint256 oldVotingPeriod = votingPeriod;
        votingPeriod = _newVotingPeriod;
        
        emit VotingPeriodChanged(oldVotingPeriod, _newVotingPeriod);
    }
    
    /**
     * @dev Updates the execution delay
     * @param _newExecutionDelay New execution delay in seconds
     */
    function updateExecutionDelay(uint256 _newExecutionDelay) external onlyAdmin {
        uint256 oldExecutionDelay = executionDelay;
        executionDelay = _newExecutionDelay;
        
        emit ExecutionDelayChanged(oldExecutionDelay, _newExecutionDelay);
    }
    
    /**
     * @dev Updates the minimum stake required to create proposals
     * @param _newMinStake New minimum stake
     */
    function updateMinStake(uint256 _newMinStake) external onlyAdmin {
        if (_newMinStake == 0) revert InvalidParameter();
        
        uint256 oldMinStake = minProposalStake;
        minProposalStake = _newMinStake;
        
        emit MinStakeChanged(oldMinStake, _newMinStake);
    }
    
    /**
     * @dev Pauses or unpauses the contract
     * @param _paused Whether the contract should be paused
     */
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
    }
    
    /**
     * @dev Gets the proposal count
     * @return count Number of proposals created
     */
    function getProposalCount() external view returns (uint256) {
        return proposalCounter;
    }
    
    /**
     * @dev Gets the details of a proposal
     * @param proposalId ID of the proposal
     * @return details A struct containing all proposal details including id, type, addresses, and voting data
     */
    function getProposalDetails(uint256 proposalId) internal view proposalExists(proposalId) returns (
        ProposalDetails memory details
    ) {
        Proposal storage proposal = proposals[proposalId];
        
        details = ProposalDetails({
            id: proposal.id,
            proposalType: proposal.proposalType,
            assetAddress: proposal.assetAddress,
            amount: proposal.amount,
            description: proposal.description,
            proposer: proposal.proposer,
            createdAt: proposal.createdAt,
            votingEnds: proposal.votingEnds,
            yesVotes: proposal.yesVotes,
            noVotes: proposal.noVotes,
            status: proposal.status,
            executed: proposal.executed
        });
        
        return details;
    }
    
    /**
     * @dev Gets a proposal (alias for getProposalDetails for test compatibility)
     * @param proposalId ID of the proposal
     * @return id ID of the proposal
     * @return proposalType Type of the proposal
     * @return assetAddress Address related to the proposal
     * @return amount Amount related to the proposal
     * @return description Description of the proposal
     * @return proposer Address of the proposer
     * @return createdAt Creation timestamp
     * @return votingEnds Timestamp when voting ends
     * @return yesVotes Number of yes votes
     * @return noVotes Number of no votes
     * @return status Status of the proposal
     * @return executed Whether the proposal has been executed
     */
    function getProposal(uint256 proposalId) external view proposalExists(proposalId) returns (
        uint256 id,
        ProposalType proposalType,
        address assetAddress,
        uint256 amount,
        string memory description,
        address proposer,
        uint256 createdAt,
        uint256 votingEnds,
        uint256 yesVotes,
        uint256 noVotes,
        ProposalState status,
        bool executed
    ) {
        ProposalDetails memory details = getProposalDetails(proposalId);
        
        return (
            details.id,
            details.proposalType,
            details.assetAddress,
            details.amount,
            details.description,
            details.proposer,
            details.createdAt,
            details.votingEnds,
            details.yesVotes,
            details.noVotes,
            details.status,
            details.executed
        );
    }
    
    /**
     * @dev Adds an asset to the supported assets list
     * @param assetAddress Address of the asset
     */
    function addSupportedAsset(address assetAddress) external onlyAdmin {
        if (assetAddress == address(0)) revert ZeroAddress();
        if (supportedAssets[assetAddress]) return; // Already supported
        
        supportedAssets[assetAddress] = true;
        supportedAssetsList.push(assetAddress);
    }
    
    /**
     * @dev Removes an asset from the supported assets list
     * @param assetAddress Address of the asset
     */
    function removeSupportedAsset(address assetAddress) external onlyAdmin {
        if (!supportedAssets[assetAddress]) return; // Not supported
        
        supportedAssets[assetAddress] = false;
        
        // Find and remove from the list (simplified version)
        for (uint256 i = 0; i < supportedAssetsList.length; i++) {
            if (supportedAssetsList[i] == assetAddress) {
                supportedAssetsList[i] = supportedAssetsList[supportedAssetsList.length - 1];
                supportedAssetsList.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Gets the list of supported assets
     * @return assets List of supported asset addresses
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssetsList;
    }
    
    /**
     * @dev Updates governance parameters (combined function for tests)
     * @param _quorum New quorum value
     * @param _votingPeriod New voting period
     * @param _executionDelay New execution delay
     * @param _minStake New minimum stake
     */
    function updateGovernanceParameters(
        uint256 _quorum,
        uint256 _votingPeriod,
        uint256 _executionDelay,
        uint256 _minStake
    ) external onlyAdmin {
        // Update quorum
        uint256 oldQuorum = quorum;
        if (_quorum > 0 && _quorum <= 10000) {
            quorum = _quorum;
            emit QuorumChanged(oldQuorum, _quorum);
        }
        
        // Update voting period
        uint256 oldVotingPeriod = votingPeriod;
        if (_votingPeriod > 0) {
            votingPeriod = _votingPeriod;
            emit VotingPeriodChanged(oldVotingPeriod, _votingPeriod);
        }
        
        // Update execution delay
        uint256 oldExecutionDelay = executionDelay;
        executionDelay = _executionDelay;
        emit ExecutionDelayChanged(oldExecutionDelay, _executionDelay);
        
        // Update min stake
        uint256 oldMinStake = minProposalStake;
        if (_minStake > 0) {
            minProposalStake = _minStake;
            emit MinStakeChanged(oldMinStake, _minStake);
        }
    }
    
    /**
     * @dev Pauses the contract
     */
    function pause() external onlyAdmin {
        paused = true;
    }
    
    /**
     * @dev Unpauses the contract
     */
    function unpause() external onlyAdmin {
        paused = false;
    }

    /**
     * @dev Withdraws tokens from the contract
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyAdmin {
        IERC20(token).transfer(msg.sender, amount);
    }
}