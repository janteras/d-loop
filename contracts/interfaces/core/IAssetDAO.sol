// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IAssetDAO
 * @dev Interface for the AssetDAO contract which manages AI assets
 * @notice This interface defines the standard functions for AI asset governance and management
 */
interface IAssetDAO {
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
    
    // Proposal states
    enum ProposalState {
        Pending,
        Active,
        Rejected,
        Approved,
        Executed,
        Canceled
    }

    // Events
    event AssetCreated(uint256 indexed assetId, address indexed creator, string name, uint256 targetFunding);
    event AssetStateChanged(uint256 indexed assetId, AssetState oldState, AssetState newState);
    event InvestmentMade(uint256 indexed assetId, address indexed investor, uint256 amount, uint256 shares);
    event DivestmentMade(uint256 indexed assetId, address indexed investor, uint256 amount, uint256 shares);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed assetId, address indexed proposer, ProposalType proposalType);
    event ProposalStateChanged(uint256 indexed proposalId, ProposalState oldState, ProposalState newState);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ParameterUpdated(string indexed paramName, uint256 oldValue, uint256 newValue);
    event FeeCollected(uint256 indexed assetId, uint256 amount, string feeType);
    event RageQuit(uint256 indexed assetId, address indexed investor, uint256 shares, uint256 refundAmount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Create a new asset
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
    ) external returns (uint256 assetId);

    /**
     * @dev Invest in an asset
     * @param assetId ID of the asset
     * @param amount Amount to invest
     * @return shares Number of shares received
     */
    function invest(uint256 assetId, uint256 amount) external returns (uint256 shares);

    /**
     * @dev Divest from an asset
     * @param assetId ID of the asset
     * @param shares Number of shares to divest
     * @return amount Amount received
     */
    function divest(uint256 assetId, uint256 shares) external returns (uint256 amount);

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
    ) external returns (uint256 proposalId);

    /**
     * @dev Vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether to support the proposal
     */
    function vote(uint256 proposalId, bool support) external;

    /**
     * @dev Execute a proposal
     * @param proposalId ID of the proposal
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @dev Cancel a proposal
     * @param proposalId ID of the proposal
     */
    function cancelProposal(uint256 proposalId) external;

    /**
     * @dev Rage quit from an asset (emergency withdrawal)
     * @param assetId ID of the asset
     * @param shares Number of shares to withdraw
     */
    function rageQuit(uint256 assetId, uint256 shares) external;

    /**
     * @dev Update asset state
     * @param assetId ID of the asset
     * @param newState New state of the asset
     */
    function updateAssetState(uint256 assetId, AssetState newState) external;

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
    );

    /**
     * @dev Get investor shares in an asset
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @return shares Number of shares owned
     */
    function getInvestorShares(uint256 assetId, address investor) external view returns (uint256 shares);

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
    );

    /**
     * @dev Check if an address has voted on a proposal
     * @param proposalId ID of the proposal
     * @param voter Address of the voter
     * @return hasVoted Whether the address has voted
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool hasVoted);

    /**
     * @dev Pause the contract
     */
    function pause() external;

    /**
     * @dev Unpause the contract
     */
    function unpause() external;

    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external;
}
