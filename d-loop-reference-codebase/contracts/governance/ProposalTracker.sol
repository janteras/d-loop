// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../rewards/GovernanceRewards.sol";

/**
 * @title ProposalTracker
 * @dev Tracks proposals and votes for governance rewards
 */
contract ProposalTracker is AccessControl, Pausable {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROTOCOL_DAO_ROLE = keccak256("PROTOCOL_DAO_ROLE");
    
    // Proposal types (matching GovernanceRewards.ProposalType)
    enum ProposalType { Invest, Divest }
    
    // Vote options (matching GovernanceRewards.VoteOption)
    enum VoteOption { Yes, No }
    
    // Interfaces
    GovernanceRewards public rewardsContract;
    
    // Mapping to track asset for each proposal
    mapping(uint256 => address) public proposalAssets;
    
    // Events
    event ProposalTracked(uint256 indexed proposalId, ProposalType proposalType, address indexed asset);
    event VoteTracked(uint256 indexed proposalId, address indexed voter, VoteOption vote, uint256 votingPower);
    event RewardsContractUpdated(address indexed rewardsContract);
    
    /**
     * @dev Constructor
     * @param admin Admin address
     * @param protocolDAO Protocol DAO address
     * @param _rewardsContract Governance rewards contract address
     */
    constructor(
        address admin,
        address protocolDAO,
        address _rewardsContract
    ) {
        require(admin != address(0), "ProposalTracker: admin is zero address");
        require(protocolDAO != address(0), "ProposalTracker: protocolDAO is zero address");
        require(_rewardsContract != address(0), "ProposalTracker: rewardsContract is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PROTOCOL_DAO_ROLE, protocolDAO);
        
        rewardsContract = GovernanceRewards(_rewardsContract);
    }
    
    /**
     * @dev Track a new proposal for reward evaluation
     * @param proposalId Proposal ID
     * @param proposalType Type of proposal (Invest/Divest)
     * @param asset Asset address
     * @param proposalTime Proposal creation time
     */
    function trackProposal(
        uint256 proposalId,
        ProposalType proposalType,
        address asset,
        uint256 proposalTime
    ) external whenNotPaused onlyRole(PROTOCOL_DAO_ROLE) {
        require(asset != address(0), "ProposalTracker: asset is zero address");
        require(proposalAssets[proposalId] == address(0), "ProposalTracker: proposal already tracked");
        
        // Store asset address for this proposal
        proposalAssets[proposalId] = asset;
        
        // Register proposal with rewards contract
        rewardsContract.registerProposal(
            proposalId,
            GovernanceRewards.ProposalType(uint8(proposalType)),
            asset,
            proposalTime
        );
        
        emit ProposalTracked(proposalId, proposalType, asset);
    }
    
    /**
     * @dev Track a vote for reward evaluation
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @param vote Vote option (Yes/No)
     * @param votingPower Voting power used
     */
    function trackVote(
        uint256 proposalId,
        address voter,
        VoteOption vote,
        uint256 votingPower
    ) external whenNotPaused onlyRole(PROTOCOL_DAO_ROLE) {
        require(voter != address(0), "ProposalTracker: voter is zero address");
        require(votingPower > 0, "ProposalTracker: votingPower must be positive");
        require(proposalAssets[proposalId] != address(0), "ProposalTracker: proposal not tracked");
        
        // Register vote with rewards contract
        rewardsContract.registerVote(
            proposalId,
            voter,
            GovernanceRewards.VoteOption(uint8(vote)),
            votingPower
        );
        
        emit VoteTracked(proposalId, voter, vote, votingPower);
    }
    
    /**
     * @dev Request evaluation of a proposal
     * @param proposalId Proposal ID
     */
    function requestEvaluation(uint256 proposalId) external {
        require(proposalAssets[proposalId] != address(0), "ProposalTracker: proposal not tracked");
        
        // Call evaluate function in rewards contract
        rewardsContract.evaluateProposal(proposalId);
    }
    
    /**
     * @dev Update the rewards contract address
     * @param newRewardsContract New rewards contract address
     */
    function updateRewardsContract(address newRewardsContract) external onlyRole(ADMIN_ROLE) {
        require(newRewardsContract != address(0), "ProposalTracker: new rewards contract is zero address");
        
        rewardsContract = GovernanceRewards(newRewardsContract);
        
        emit RewardsContractUpdated(newRewardsContract);
    }
    
    /**
     * @dev Add a protocol DAO role
     * @param protocolDAO Protocol DAO address
     */
    function addProtocolDAORole(address protocolDAO) external onlyRole(ADMIN_ROLE) {
        require(protocolDAO != address(0), "ProposalTracker: protocolDAO is zero address");
        
        _grantRole(PROTOCOL_DAO_ROLE, protocolDAO);
    }
    
    /**
     * @dev Revoke protocol DAO role
     * @param protocolDAO Protocol DAO address
     */
    function revokeProtocolDAORole(address protocolDAO) external onlyRole(ADMIN_ROLE) {
        _revokeRole(PROTOCOL_DAO_ROLE, protocolDAO);
    }
    
    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get the asset associated with a proposal
     * @param proposalId Proposal ID
     * @return Asset address
     */
    function getProposalAsset(uint256 proposalId) external view returns (address) {
        return proposalAssets[proposalId];
    }
    
    /**
     * @dev Check if a proposal is tracked
     * @param proposalId Proposal ID
     * @return Whether the proposal is tracked
     */
    function isProposalTracked(uint256 proposalId) external view returns (bool) {
        return proposalAssets[proposalId] != address(0);
    }
}