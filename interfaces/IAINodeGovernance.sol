// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IAINodeGovernance
 * @dev Interface for the AINodeGovernance contract which manages governance for AI nodes
 */
interface IAINodeGovernance {
    /**
     * @dev Struct representing a governance proposal
     */
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
        mapping(address => bool) hasVoted;
    }

    /**
     * @dev Emitted when a new proposal is created
     */
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 startTime,
        uint256 endTime
    );

    /**
     * @dev Emitted when a vote is cast on a proposal
     */
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        bool support,
        uint256 weight
    );

    /**
     * @dev Emitted when a proposal is executed
     */
    event ProposalExecuted(uint256 indexed proposalId);

    /**
     * @dev Emitted when a proposal is canceled
     */
    event ProposalCanceled(uint256 indexed proposalId);

    /**
     * @dev Creates a new governance proposal
     * @param description Description of the proposal
     * @return proposalId The ID of the newly created proposal
     */
    function createProposal(string memory description) external returns (uint256 proposalId);

    /**
     * @dev Casts a vote on a proposal
     * @param proposalId ID of the proposal
     * @param support Whether to support the proposal or not
     */
    function castVote(uint256 proposalId, bool support) external;

    /**
     * @dev Executes a proposal that has passed voting
     * @param proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) external;

    /**
     * @dev Cancels a proposal
     * @param proposalId ID of the proposal to cancel
     */
    function cancelProposal(uint256 proposalId) external;

    /**
     * @dev Gets the current state of a proposal
     * @param proposalId ID of the proposal
     * @return state The current state of the proposal
     */
    function getProposalState(uint256 proposalId) external view returns (uint8);

    /**
     * @dev Gets the details of a proposal
     * @param proposalId ID of the proposal
     * @return proposer The address that created the proposal
     * @return description Description of the proposal
     * @return startTime Start time of the voting period
     * @return endTime End time of the voting period
     * @return forVotes Number of votes in favor
     * @return againstVotes Number of votes against
     * @return executed Whether the proposal has been executed
     * @return canceled Whether the proposal has been canceled
     */
    function getProposalDetails(uint256 proposalId) external view returns (
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
     * @dev Checks if an account has voted on a proposal
     * @param proposalId ID of the proposal
     * @param account Address to check
     * @return hasVoted Whether the account has voted on the proposal
     */
    function hasVoted(uint256 proposalId, address account) external view returns (bool);
}
