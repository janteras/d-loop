// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ProposalTracker.sol";
import "../oracles/IPriceOracle.sol";

/**
 * @title ProtocolDAOExtension
 * @dev Extension for ProtocolDAO to integrate with oracle-based rewards
 */
contract ProtocolDAOExtension {
    // Core ProtocolDAO contract instance (assumed to be immutable)
    address public immutable protocolDAO;
    
    // ProposalTracker for reward integration
    ProposalTracker public proposalTracker;
    
    // Oracle for price data
    IPriceOracle public priceOracle;
    
    // Asset registry for proposals
    mapping(uint256 => address) public proposalAssets;
    
    // Proposal type registry
    mapping(uint256 => ProposalTracker.ProposalType) public proposalTypes;
    
    // Events
    event ProposalCreatedWithAsset(
        uint256 indexed proposalId,
        address indexed asset,
        ProposalTracker.ProposalType proposalType
    );
    
    event ProposalVotedWithPower(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 votingPower
    );
    
    event ProposalTrackerUpdated(address indexed newTracker);
    event PriceOracleUpdated(address indexed newOracle);
    
    /**
     * @dev Constructor
     * @param _protocolDAO ProtocolDAO address
     * @param _proposalTracker ProposalTracker address
     * @param _priceOracle Price oracle address
     */
    constructor(
        address _protocolDAO,
        address _proposalTracker,
        address _priceOracle
    ) {
        require(_protocolDAO != address(0), "ProtocolDAOExtension: protocolDAO is zero address");
        require(_proposalTracker != address(0), "ProtocolDAOExtension: proposalTracker is zero address");
        require(_priceOracle != address(0), "ProtocolDAOExtension: priceOracle is zero address");
        
        protocolDAO = _protocolDAO;
        proposalTracker = ProposalTracker(_proposalTracker);
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    /**
     * @dev Register a proposal with an asset and type
     * @param proposalId Proposal ID
     * @param asset Asset address associated with the proposal
     * @param proposalType Type of proposal (Invest/Divest)
     */
    function registerProposalWithAsset(
        uint256 proposalId,
        address asset,
        ProposalTracker.ProposalType proposalType
    ) external {
        // Only ProtocolDAO can call this
        require(msg.sender == protocolDAO, "ProtocolDAOExtension: caller is not the ProtocolDAO");
        require(asset != address(0), "ProtocolDAOExtension: asset is zero address");
        
        // Check if asset is supported by the price oracle
        require(priceOracle.isAssetSupported(asset), "ProtocolDAOExtension: asset not supported by oracle");
        
        // Store asset and type for this proposal
        proposalAssets[proposalId] = asset;
        proposalTypes[proposalId] = proposalType;
        
        // Track proposal with the proposal tracker
        proposalTracker.trackProposal(
            proposalId,
            proposalType,
            asset,
            block.timestamp
        );
        
        emit ProposalCreatedWithAsset(proposalId, asset, proposalType);
    }
    
    /**
     * @dev Register a vote with voting power
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @param support Whether the vote is supporting (true) or opposing (false)
     * @param votingPower Voting power used
     */
    function registerVoteWithPower(
        uint256 proposalId,
        address voter,
        bool support,
        uint256 votingPower
    ) external {
        // Only ProtocolDAO can call this
        require(msg.sender == protocolDAO, "ProtocolDAOExtension: caller is not the ProtocolDAO");
        require(voter != address(0), "ProtocolDAOExtension: voter is zero address");
        require(votingPower > 0, "ProtocolDAOExtension: voting power must be positive");
        
        // Map the boolean support to the VoteOption enum (Yes = 0, No = 1)
        ProposalTracker.VoteOption vote = support ? 
            ProposalTracker.VoteOption.Yes : 
            ProposalTracker.VoteOption.No;
        
        // Track vote with the proposal tracker
        proposalTracker.trackVote(
            proposalId,
            voter,
            vote,
            votingPower
        );
        
        emit ProposalVotedWithPower(proposalId, voter, support, votingPower);
    }
    
    /**
     * @dev After a proposal is executed, request evaluation from oracle
     * @param proposalId Proposal ID
     */
    function requestEvaluation(uint256 proposalId) external {
        // Allow any address to trigger evaluation after execution
        // The proposal tracker handles validation internally
        
        proposalTracker.requestEvaluation(proposalId);
    }
    
    /**
     * @dev Update proposal tracker address (admin only)
     * @param newTracker New proposal tracker address
     */
    function updateProposalTracker(address newTracker) external {
        // Only ProtocolDAO can call this
        require(msg.sender == protocolDAO, "ProtocolDAOExtension: caller is not the ProtocolDAO");
        require(newTracker != address(0), "ProtocolDAOExtension: new tracker is zero address");
        
        proposalTracker = ProposalTracker(newTracker);
        
        emit ProposalTrackerUpdated(newTracker);
    }
    
    /**
     * @dev Update price oracle address (admin only)
     * @param newOracle New price oracle address
     */
    function updatePriceOracle(address newOracle) external {
        // Only ProtocolDAO can call this
        require(msg.sender == protocolDAO, "ProtocolDAOExtension: caller is not the ProtocolDAO");
        require(newOracle != address(0), "ProtocolDAOExtension: new oracle is zero address");
        
        priceOracle = IPriceOracle(newOracle);
        
        emit PriceOracleUpdated(newOracle);
    }
    
    /**
     * @dev Get asset associated with a proposal
     * @param proposalId Proposal ID
     * @return Asset address
     */
    function getProposalAsset(uint256 proposalId) external view returns (address) {
        return proposalAssets[proposalId];
    }
    
    /**
     * @dev Get type of a proposal
     * @param proposalId Proposal ID
     * @return Proposal type (Invest/Divest)
     */
    function getProposalType(uint256 proposalId) external view returns (ProposalTracker.ProposalType) {
        return proposalTypes[proposalId];
    }
}