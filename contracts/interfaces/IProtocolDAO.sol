// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IProtocolDAO
 * @dev Interface for the Protocol DAO functionality
 */
interface IProtocolDAO {
    struct ProtocolConfig {
        uint256 quorumThreshold;
        uint256 votingPeriod;
        uint256 executionDelay;
        uint256 minProposalStake;
    }

    struct Proposal {
        bytes32 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
    }

    /**
     * @dev Submit a new protocol proposal
     * @param description Description of the proposal
     * @param data Encoded function call data
     * @return bytes32 The proposal ID
     */
    function submitProposal(string calldata description, bytes calldata data) external returns (bytes32);

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId The ID of the proposal
     * @param support True for support, false against
     */
    function castVote(bytes32 proposalId, bool support) external;

    /**
     * @dev Execute a passed proposal
     * @param proposalId The ID of the proposal to execute
     */
    function executeProposal(bytes32 proposalId) external;

    /**
     * @dev Get the current protocol configuration
     * @return ProtocolConfig The current configuration
     */
    function getConfig() external view returns (ProtocolConfig memory);

    /**
     * @dev Get information about a specific proposal
     * @param proposalId The ID of the proposal
     * @return Proposal The proposal information
     */
    function getProposal(bytes32 proposalId) external view returns (Proposal memory);

    /**
     * @dev Check if an address has voted on a proposal
     * @param proposalId The ID of the proposal
     * @param voter The address to check
     * @return bool True if the address has voted
     */
    function hasVoted(bytes32 proposalId, address voter) external view returns (bool);

    /**
     * @dev Event emitted when a new proposal is created
     */
    event ProposalCreated(bytes32 indexed proposalId, address indexed proposer, string description);

    /**
     * @dev Event emitted when a vote is cast
     */
    event VoteCast(bytes32 indexed proposalId, address indexed voter, bool support, uint256 weight);

    /**
     * @dev Event emitted when a proposal is executed
     */
    event ProposalExecuted(bytes32 indexed proposalId);

    /**
     * @dev Event emitted when protocol configuration is updated
     */
    event ConfigUpdated(ProtocolConfig config);
}
