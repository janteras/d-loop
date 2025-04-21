// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../identity/IAINodeIdentifier.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AINodeGovernance
 * @dev Governance contract for AI nodes with special voting rights
 */
contract AINodeGovernance is AccessControl {
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // AI Node Identifier contract
    IAINodeIdentifier public nodeIdentifier;
    
    // AI Node voting parameters
    uint256 public aiNodeVotingPeriod = 1 days;
    uint256 public humanVotingPeriod = 7 days;
    uint256 public aiNodeQuorum = 40; // 40%
    uint256 public humanQuorum = 30; // 30%
    
    // Events
    event NodeIdentifierUpdated(address indexed newIdentifier);
    event VotingParametersUpdated(
        uint256 aiNodeVotingPeriod,
        uint256 humanVotingPeriod,
        uint256 aiNodeQuorum,
        uint256 humanQuorum
    );
    
    constructor(address _nodeIdentifier) {
        require(_nodeIdentifier != address(0), "Zero address");
        nodeIdentifier = IAINodeIdentifier(_nodeIdentifier);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Get the voting period based on whether the sender is an AI node
     * @param sender Address to check
     * @return period Voting period in seconds
     */
    function getVotingPeriod(address sender) public view returns (uint256) {
        return nodeIdentifier.isActiveAINode(sender) ? aiNodeVotingPeriod : humanVotingPeriod;
    }
    
    /**
     * @dev Get the quorum based on voting type
     * @param isAINodeVoting Whether this is an AI node fast-track voting
     * @return quorum Quorum percentage (0-100)
     */
    function getQuorum(bool isAINodeVoting) public view returns (uint256) {
        return isAINodeVoting ? aiNodeQuorum : humanQuorum;
    }
    
    /**
     * @dev Update the node identifier contract
     * @param _nodeIdentifier New node identifier contract address
     */
    function updateNodeIdentifier(address _nodeIdentifier) external onlyRole(ADMIN_ROLE) {
        require(_nodeIdentifier != address(0), "Zero address");
        nodeIdentifier = IAINodeIdentifier(_nodeIdentifier);
        
        emit NodeIdentifierUpdated(_nodeIdentifier);
    }
    
    /**
     * @dev Update voting parameters
     * @param _aiNodeVotingPeriod New AI node voting period
     * @param _humanVotingPeriod New human voting period
     * @param _aiNodeQuorum New AI node quorum
     * @param _humanQuorum New human quorum
     */
    function updateVotingParameters(
        uint256 _aiNodeVotingPeriod,
        uint256 _humanVotingPeriod,
        uint256 _aiNodeQuorum,
        uint256 _humanQuorum
    ) external onlyRole(ADMIN_ROLE) {
        require(_aiNodeVotingPeriod > 0, "Invalid AI node voting period");
        require(_humanVotingPeriod > 0, "Invalid human voting period");
        require(_aiNodeQuorum <= 100, "Invalid AI node quorum");
        require(_humanQuorum <= 100, "Invalid human quorum");
        
        aiNodeVotingPeriod = _aiNodeVotingPeriod;
        humanVotingPeriod = _humanVotingPeriod;
        aiNodeQuorum = _aiNodeQuorum;
        humanQuorum = _humanQuorum;
        
        emit VotingParametersUpdated(
            aiNodeVotingPeriod,
            humanVotingPeriod,
            aiNodeQuorum,
            humanQuorum
        );
    }
}