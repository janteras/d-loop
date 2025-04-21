// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAssetDAO
 * @dev Interface for the AssetDAO contract which manages digital assets in the D-Loop Protocol
 */
interface IAssetDAO {
    /**
     * @dev Struct representing an asset
     */
    struct Asset {
        uint256 id;
        string name;
        string metadata;
        address owner;
        uint256 creationTime;
        uint256 lastUpdateTime;
        bool isActive;
    }

    /**
     * @dev Struct representing a proposal for asset management
     */
    struct AssetProposal {
        uint256 id;
        uint256 assetId;
        address proposer;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
    }

    /**
     * @dev Emitted when a new asset is created
     */
    event AssetCreated(
        uint256 indexed assetId,
        address indexed owner,
        string name
    );

    /**
     * @dev Emitted when an asset is updated
     */
    event AssetUpdated(
        uint256 indexed assetId,
        string name,
        string metadata
    );

    /**
     * @dev Emitted when an asset's ownership is transferred
     */
    event AssetTransferred(
        uint256 indexed assetId,
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev Emitted when an asset is deactivated
     */
    event AssetDeactivated(uint256 indexed assetId);

    /**
     * @dev Emitted when an asset is reactivated
     */
    event AssetReactivated(uint256 indexed assetId);

    /**
     * @dev Emitted when a new asset proposal is created
     */
    event AssetProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed assetId,
        address indexed proposer,
        string description
    );

    /**
     * @dev Emitted when a vote is cast on an asset proposal
     */
    event AssetProposalVoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        bool support,
        uint256 weight
    );

    /**
     * @dev Emitted when an asset proposal is executed
     */
    event AssetProposalExecuted(uint256 indexed proposalId);

    /**
     * @dev Emitted when an asset proposal is canceled
     */
    event AssetProposalCanceled(uint256 indexed proposalId);

    /**
     * @dev Creates a new asset
     * @param name Name of the asset
     * @param metadata Metadata of the asset
     * @return assetId The ID of the newly created asset
     */
    function createAsset(string memory name, string memory metadata) external returns (uint256 assetId);

    /**
     * @dev Updates an existing asset
     * @param assetId ID of the asset to update
     * @param name New name of the asset
     * @param metadata New metadata of the asset
     */
    function updateAsset(uint256 assetId, string memory name, string memory metadata) external;

    /**
     * @dev Transfers ownership of an asset
     * @param assetId ID of the asset to transfer
     * @param newOwner Address of the new owner
     */
    function transferAsset(uint256 assetId, address newOwner) external;

    /**
     * @dev Deactivates an asset
     * @param assetId ID of the asset to deactivate
     */
    function deactivateAsset(uint256 assetId) external;

    /**
     * @dev Reactivates an asset
     * @param assetId ID of the asset to reactivate
     */
    function reactivateAsset(uint256 assetId) external;

    /**
     * @dev Creates a new asset proposal
     * @param assetId ID of the asset the proposal is for
     * @param description Description of the proposal
     * @return proposalId The ID of the newly created proposal
     */
    function createAssetProposal(uint256 assetId, string memory description) external returns (uint256 proposalId);

    /**
     * @dev Casts a vote on an asset proposal
     * @param proposalId ID of the proposal
     * @param support Whether to support the proposal or not
     */
    function castVoteOnAssetProposal(uint256 proposalId, bool support) external;

    /**
     * @dev Executes an asset proposal that has passed voting
     * @param proposalId ID of the proposal to execute
     */
    function executeAssetProposal(uint256 proposalId) external;

    /**
     * @dev Cancels an asset proposal
     * @param proposalId ID of the proposal to cancel
     */
    function cancelAssetProposal(uint256 proposalId) external;

    /**
     * @dev Gets the details of an asset
     * @param assetId ID of the asset
     * @return asset The asset details
     */
    function getAsset(uint256 assetId) external view returns (
        uint256 id,
        string memory name,
        string memory metadata,
        address owner,
        uint256 creationTime,
        uint256 lastUpdateTime,
        bool isActive
    );

    /**
     * @dev Gets the details of an asset proposal
     * @param proposalId ID of the proposal
     * @return proposal The proposal details
     */
    function getAssetProposal(uint256 proposalId) external view returns (
        uint256 id,
        uint256 assetId,
        address proposer,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed,
        bool canceled
    );

    /**
     * @dev Gets the number of assets owned by an address
     * @param owner Address of the owner
     * @return count The number of assets owned
     */
    function getAssetCountByOwner(address owner) external view returns (uint256 count);

    /**
     * @dev Gets the IDs of assets owned by an address
     * @param owner Address of the owner
     * @return assetIds The IDs of assets owned
     */
    function getAssetsByOwner(address owner) external view returns (uint256[] memory assetIds);

    /**
     * @dev Checks if an account has voted on an asset proposal
     * @param proposalId ID of the proposal
     * @param account Address to check
     * @return hasVoted Whether the account has voted on the proposal
     */
    function hasVotedOnAssetProposal(uint256 proposalId, address account) external view returns (bool hasVoted);
}
