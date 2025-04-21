// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../libraries/Errors.sol";

/**
 * @title GovernanceTracker
 * @notice Tracks governance participation and activity for reward calculation
 * @dev Records votes, proposals, and evaluates performance for rewards
 */
contract GovernanceTracker is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    // Governance record for a user
    struct ParticipationRecord {
        uint256 totalProposals;         // Total proposals created
        uint256 totalVotes;             // Total votes cast
        uint256 correctVotes;           // Votes that aligned with outcome
        uint256 totalParticipation;     // Overall participation score
        uint256 lastActivityTime;       // Last governance action timestamp
    }
    
    // Proposal tracking for outcome evaluation
    struct ProposalOutcome {
        bool evaluated;                 // Whether the proposal has been evaluated
        bool wasSuccessful;             // Whether the proposal was successful
        bool hadPositiveOutcome;        // Whether the proposal had positive impact (oracle)
        uint256 evaluationTime;         // When the proposal was evaluated
        mapping(address => bool) votedYes; // Who voted yes
        mapping(address => bool) votedNo;  // Who voted no
        address[] voters;               // All voters
    }
    
    // Period structure for time-based calculations
    struct RewardPeriod {
        uint256 startTime;              // Start timestamp
        uint256 endTime;                // End timestamp
        bool finalized;                 // Whether rewards are finalized
        uint256 totalParticipationScore; // Total participation across all users
    }
    
    // Mappings
    mapping(address => ParticipationRecord) public participationRecords;
    mapping(uint256 => ProposalOutcome) public proposalOutcomes; // proposalId => outcome
    mapping(uint256 => mapping(address => uint256)) public periodScores; // periodId => user => score
    
    // Reward periods
    RewardPeriod[] public rewardPeriods;
    uint256 public currentPeriodId;
    uint256 public periodDuration;       // Duration of each reward period in seconds
    
    // Performance scoring weights (in basis points, 100 = 1%)
    uint256 public proposalCreationWeight;
    uint256 public voteParticipationWeight;
    uint256 public voteAccuracyWeight;
    
    // Events
    event ProposalCreated(address indexed creator, uint256 indexed proposalId, uint256 timestamp);
    event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 timestamp);
    event ProposalEvaluated(uint256 indexed proposalId, bool hadPositiveOutcome, uint256 timestamp);
    event RewardPeriodCreated(uint256 indexed periodId, uint256 startTime, uint256 endTime);
    event RewardPeriodFinalized(uint256 indexed periodId, uint256 totalParticipationScore);
    event ParticipationScoreUpdated(address indexed user, uint256 indexed periodId, uint256 score);
    
    /**
     * @notice Initialize the contract
     * @param _periodDuration Duration of each reward period in seconds
     */
    function initialize(uint256 _periodDuration) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(GOVERNANCE_ROLE, msg.sender);
        
        periodDuration = _periodDuration;
        
        // Set default weights
        proposalCreationWeight = 2000;  // 20%
        voteParticipationWeight = 3000; // 30%
        voteAccuracyWeight = 5000;      // 50%
        
        // Start the first period
        _startNewRewardPeriod();
    }
    
    /**
     * @notice Records a new proposal creation
     * @param _creator Address of the proposal creator
     * @param _proposalId ID of the created proposal
     */
    function recordProposalCreation(address _creator, uint256 _proposalId) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
    {
        if (_creator == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        // Update participation record
        ParticipationRecord storage record = participationRecords[_creator];
        record.totalProposals += 1;
        record.lastActivityTime = block.timestamp;
        
        // Check if we need to start a new period
        _checkAndUpdatePeriod();
        
        // Update total participation score based on proposal creation
        uint256 proposalScore = proposalCreationWeight;
        record.totalParticipation += proposalScore;
        
        // Update period score
        periodScores[currentPeriodId][_creator] += proposalScore;
        
        emit ProposalCreated(_creator, _proposalId, block.timestamp);
    }
    
    /**
     * @notice Records a vote cast on a proposal
     * @param _voter Address of the voter
     * @param _proposalId ID of the proposal
     * @param _support Whether the vote is in support of the proposal
     */
    function recordVote(address _voter, uint256 _proposalId, bool _support) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
    {
        if (_voter == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        // Update participation record
        ParticipationRecord storage record = participationRecords[_voter];
        record.totalVotes += 1;
        record.lastActivityTime = block.timestamp;
        
        // Initialize proposal outcome if needed
        _initializeProposalIfNeeded(_proposalId);
        
        // Record the vote
        ProposalOutcome storage outcome = proposalOutcomes[_proposalId];
        
        // Only count if user hasn't already voted on this proposal
        if (!outcome.votedYes[_voter] && !outcome.votedNo[_voter]) {
            if (_support) {
                outcome.votedYes[_voter] = true;
            } else {
                outcome.votedNo[_voter] = true;
            }
            outcome.voters.push(_voter);
        }
        
        // Check if we need to start a new period
        _checkAndUpdatePeriod();
        
        // Update total participation score based on vote participation
        uint256 voteScore = voteParticipationWeight;
        record.totalParticipation += voteScore;
        
        // Update period score
        periodScores[currentPeriodId][_voter] += voteScore;
        
        emit VoteCast(_voter, _proposalId, _support, block.timestamp);
    }
    
    /**
     * @notice Records the outcome of a proposal execution
     * @param _proposalId ID of the proposal
     * @param _successful Whether the proposal execution was successful
     */
    function recordProposalOutcome(uint256 _proposalId, bool _successful) 
        external 
        onlyRole(GOVERNANCE_ROLE) 
    {
        _initializeProposalIfNeeded(_proposalId);
        
        ProposalOutcome storage outcome = proposalOutcomes[_proposalId];
        outcome.evaluated = true;
        outcome.wasSuccessful = _successful;
        outcome.evaluationTime = block.timestamp;
    }
    
    /**
     * @notice Evaluates a proposal's impact (called by oracle)
     * @param _proposalId ID of the proposal
     * @param _hadPositiveOutcome Whether the proposal had a positive impact
     */
    function evaluateProposalImpact(uint256 _proposalId, bool _hadPositiveOutcome) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        ProposalOutcome storage outcome = proposalOutcomes[_proposalId];
        
        if (!outcome.evaluated) {
            revert Errors.ProposalNotEvaluated();
        }
        
        outcome.hadPositiveOutcome = _hadPositiveOutcome;
        
        // Reward accurate votes (only for executed proposals)
        if (outcome.wasSuccessful) {
            for (uint i = 0; i < outcome.voters.length; i++) {
                address voter = outcome.voters[i];
                bool votedCorrectly = (outcome.votedYes[voter] && _hadPositiveOutcome) || 
                                     (outcome.votedNo[voter] && !_hadPositiveOutcome);
                
                if (votedCorrectly) {
                    // Update accuracy record
                    participationRecords[voter].correctVotes += 1;
                    
                    // Award additional score for accuracy
                    uint256 accuracyScore = voteAccuracyWeight;
                    participationRecords[voter].totalParticipation += accuracyScore;
                    
                    // Update period score
                    uint256 periodId = _getPeriodIdForTimestamp(outcome.evaluationTime);
                    if (!rewardPeriods[periodId].finalized) {
                        periodScores[periodId][voter] += accuracyScore;
                    }
                }
            }
        }
        
        emit ProposalEvaluated(_proposalId, _hadPositiveOutcome, block.timestamp);
    }
    
    /**
     * @notice Finalizes a reward period, calculating total participation
     * @param _periodId ID of the period to finalize
     * @return totalScore Total participation score for the period
     */
    function finalizeRewardPeriod(uint256 _periodId) 
        external 
        onlyRole(ADMIN_ROLE) 
        returns (uint256 totalScore) 
    {
        if (_periodId >= rewardPeriods.length) {
            revert Errors.InvalidPeriodId();
        }
        
        RewardPeriod storage period = rewardPeriods[_periodId];
        
        if (period.finalized) {
            revert Errors.PeriodAlreadyFinalized();
        }
        
        if (block.timestamp < period.endTime) {
            revert Errors.PeriodNotEnded();
        }
        
        // Mark as finalized
        period.finalized = true;
        
        // Calculate total score (implementation specific to your reward distribution)
        // In this implementation, we keep it simple and sum all participation
        
        // This would be updated with a more comprehensive calculation
        // involving the periodScores mapping
        
        // For now, this is a placeholder
        period.totalParticipationScore = 1000;
        
        emit RewardPeriodFinalized(_periodId, period.totalParticipationScore);
        
        return period.totalParticipationScore;
    }
    
    /**
     * @notice Gets a user's participation score for a specific period
     * @param _user Address of the user
     * @param _periodId ID of the period
     * @return score User's participation score
     */
    function getUserPeriodScore(address _user, uint256 _periodId) 
        external 
        view 
        returns (uint256 score) 
    {
        if (_periodId >= rewardPeriods.length) {
            revert Errors.InvalidPeriodId();
        }
        
        return periodScores[_periodId][_user];
    }
    
    /**
     * @notice Gets a user's participation stats
     * @param _user Address of the user
     * @return proposals Number of proposals created
     * @return votes Number of votes cast
     * @return correctVotes Number of votes that were correct
     * @return totalScore Total participation score
     */
    function getUserStats(address _user) 
        external 
        view 
        returns (
            uint256 proposals,
            uint256 votes,
            uint256 correctVotes,
            uint256 totalScore
        ) 
    {
        ParticipationRecord storage record = participationRecords[_user];
        
        return (
            record.totalProposals,
            record.totalVotes,
            record.correctVotes,
            record.totalParticipation
        );
    }
    
    /**
     * @notice Updates the weights for scoring
     * @param _proposalWeight Weight for proposal creation
     * @param _participationWeight Weight for vote participation
     * @param _accuracyWeight Weight for vote accuracy
     */
    function updateWeights(
        uint256 _proposalWeight,
        uint256 _participationWeight,
        uint256 _accuracyWeight
    ) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        // Check that weights sum to 100%
        if (_proposalWeight + _participationWeight + _accuracyWeight != 10000) {
            revert Errors.InvalidParameters();
        }
        
        proposalCreationWeight = _proposalWeight;
        voteParticipationWeight = _participationWeight;
        voteAccuracyWeight = _accuracyWeight;
    }
    
    /**
     * @notice Updates the period duration
     * @param _newDuration New duration in seconds
     */
    function updatePeriodDuration(uint256 _newDuration) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        periodDuration = _newDuration;
    }
    
    /**
     * @notice Manually starts a new reward period
     * @dev Can only be called by admin, normally periods start automatically
     */
    function manuallyStartNewPeriod() 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _startNewRewardPeriod();
    }
    
    /**
     * @notice Initializes a proposal outcome if not already initialized
     * @param _proposalId ID of the proposal
     */
    function _initializeProposalIfNeeded(uint256 _proposalId) internal {
        // No initialization needed for the struct, just to make sure it exists
        // in the mapping and can be accessed with correct defaults
        // This is a no-op in the current implementation
    }
    
    /**
     * @notice Checks if a new period should be started and updates if needed
     */
    function _checkAndUpdatePeriod() internal {
        if (rewardPeriods.length == 0) {
            _startNewRewardPeriod();
            return;
        }
        
        RewardPeriod storage currentPeriod = rewardPeriods[currentPeriodId];
        
        if (block.timestamp > currentPeriod.endTime) {
            _startNewRewardPeriod();
        }
    }
    
    /**
     * @notice Starts a new reward period
     */
    function _startNewRewardPeriod() internal {
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + periodDuration;
        
        rewardPeriods.push(
            RewardPeriod({
                startTime: startTime,
                endTime: endTime,
                finalized: false,
                totalParticipationScore: 0
            })
        );
        
        currentPeriodId = rewardPeriods.length - 1;
        
        emit RewardPeriodCreated(currentPeriodId, startTime, endTime);
    }
    
    /**
     * @notice Gets the period ID for a given timestamp
     * @param _timestamp Timestamp to check
     * @return periodId Period ID corresponding to the timestamp
     */
    function _getPeriodIdForTimestamp(uint256 _timestamp) internal view returns (uint256 periodId) {
        for (uint256 i = 0; i < rewardPeriods.length; i++) {
            if (_timestamp >= rewardPeriods[i].startTime && _timestamp < rewardPeriods[i].endTime) {
                return i;
            }
        }
        
        // If not found in any period, return current period
        return currentPeriodId;
    }
    
    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}