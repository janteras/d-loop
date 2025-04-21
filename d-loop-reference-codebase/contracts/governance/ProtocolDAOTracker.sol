// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../protocol/ProtocolDAO.sol";
import "./GovernanceTracker.sol";
import "../libraries/Errors.sol";

/**
 * @title ProtocolDAOTracker
 * @notice Enhanced ProtocolDAO with governance tracking functionality
 * @dev Extends ProtocolDAO to record governance activity for rewards
 */
contract ProtocolDAOTracker is ProtocolDAO {
    // GovernanceTracker contract
    GovernanceTracker public governanceTracker;
    
    // Events
    event GovernanceTrackerSet(address indexed tracker);
    
    /**
     * @notice Sets the governance tracker contract
     * @param _governanceTracker Address of the GovernanceTracker contract
     */
    function setGovernanceTracker(address _governanceTracker) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_governanceTracker == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        governanceTracker = GovernanceTracker(_governanceTracker);
        
        emit GovernanceTrackerSet(_governanceTracker);
    }
    
    /**
     * @notice Submit a proposal to the DAO
     * @param _executor Address of the executor contract
     * @param _description Description of the proposal
     * @return proposalId ID of the created proposal
     */
    function submitProposal(address _executor, string memory _description) 
        public 
        override 
        returns (uint256 proposalId) 
    {
        // Call parent implementation
        proposalId = super.submitProposal(_executor, _description);
        
        // Track the proposal creation
        if (address(governanceTracker) != address(0)) {
            governanceTracker.recordProposalCreation(msg.sender, proposalId);
        }
        
        return proposalId;
    }
    
    /**
     * @notice Vote on a proposal
     * @param _proposalId ID of the proposal
     * @param _support Whether to support the proposal
     */
    function voteProposal(uint256 _proposalId, bool _support) 
        public 
        override 
    {
        // Call parent implementation
        super.voteProposal(_proposalId, _support);
        
        // Track the vote
        if (address(governanceTracker) != address(0)) {
            governanceTracker.recordVote(msg.sender, _proposalId, _support);
        }
    }
    
    /**
     * @notice Execute a proposal that has passed
     * @param _proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 _proposalId) 
        public 
        override 
    {
        // Get proposal details before execution
        Proposal storage proposal = proposals[_proposalId];
        
        // Call parent implementation
        super.executeProposal(_proposalId);
        
        // Record proposal outcome after execution
        if (address(governanceTracker) != address(0)) {
            // Proposal was successful if we got here (no revert)
            governanceTracker.recordProposalOutcome(_proposalId, true);
        }
    }
}