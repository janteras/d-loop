// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RewardDistributor
 * @notice Distributes rewards to eligible participants from collected fees
 * @dev Handles reward distribution and participant management
 */
contract RewardDistributor is Initializable, AccessControlUpgradeable, PausableUpgradeable {
    using SafeERC20 for IERC20;
    
    // Access control roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    
    // Reward distribution settings
    uint256 public distributionCycle; // Duration of a distribution cycle in seconds
    uint256 public lastDistributionTimestamp; // Timestamp of the last distribution
    
    // Participant tracking
    struct Participant {
        bool isActive;
        uint256 sharesBPS; // Basis points (10000 = 100%)
        uint256 lastClaimTimestamp;
    }
    mapping(address => Participant) public participants;
    address[] public participantList;
    uint256 public totalSharesBPS; // Total shares allocated (should equal 10000)
    
    // Distribution tracking
    struct DistributionCycle {
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool distributed;
        mapping(address => bool) participantClaimed;
    }
    mapping(uint256 => DistributionCycle) public distributionCycles; // cycle number => cycle data
    uint256 public currentCycleNumber;
    
    // Events
    event ParticipantAdded(address indexed participant, uint256 sharesBPS);
    event ParticipantRemoved(address indexed participant);
    event ParticipantSharesUpdated(address indexed participant, uint256 previousSharesBPS, uint256 newSharesBPS);
    event CycleDistributed(uint256 indexed cycleNumber, uint256 startTimestamp, uint256 endTimestamp);
    event RewardClaimed(address indexed participant, address indexed token, uint256 amount, uint256 cycleNumber);
    event DistributionCycleUpdated(uint256 previousCycle, uint256 newCycle);
    
    /**
     * @notice Initialize the RewardDistributor contract
     * @param _distributionCycle Duration of a distribution cycle in seconds (e.g., 30 days)
     */
    function initialize(uint256 _distributionCycle) public initializer {
        __AccessControl_init();
        __Pausable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);
        
        require(_distributionCycle > 0, "Invalid cycle duration");
        distributionCycle = _distributionCycle;
        lastDistributionTimestamp = block.timestamp;
        currentCycleNumber = 1;
        
        // Initialize first cycle
        DistributionCycle storage cycle = distributionCycles[currentCycleNumber];
        cycle.startTimestamp = block.timestamp;
        cycle.endTimestamp = block.timestamp + distributionCycle;
        cycle.distributed = false;
    }
    
    /**
     * @notice Add a new participant to receive rewards
     * @param participant Address of the participant
     * @param sharesBPS Shares in basis points (10000 = 100%)
     */
    function addParticipant(address participant, uint256 sharesBPS) external onlyRole(GOVERNANCE_ROLE) {
        require(participant != address(0), "Invalid participant address");
        require(sharesBPS > 0, "Shares must be positive");
        require(!participants[participant].isActive, "Participant already exists");
        require(totalSharesBPS + sharesBPS <= 10000, "Total shares exceed 100%");
        
        participants[participant] = Participant({
            isActive: true,
            sharesBPS: sharesBPS,
            lastClaimTimestamp: block.timestamp
        });
        
        participantList.push(participant);
        totalSharesBPS += sharesBPS;
        
        emit ParticipantAdded(participant, sharesBPS);
    }
    
    /**
     * @notice Remove a participant from receiving rewards
     * @param participant Address of the participant
     */
    function removeParticipant(address participant) external onlyRole(GOVERNANCE_ROLE) {
        require(participants[participant].isActive, "Participant doesn't exist");
        
        totalSharesBPS -= participants[participant].sharesBPS;
        
        // Remove from participant list
        uint256 index;
        for (uint256 i = 0; i < participantList.length; i++) {
            if (participantList[i] == participant) {
                index = i;
                break;
            }
        }
        
        // Remove from array (swap with last element and pop)
        participantList[index] = participantList[participantList.length - 1];
        participantList.pop();
        
        // Mark as inactive but keep other data for historical purposes
        participants[participant].isActive = false;
        
        emit ParticipantRemoved(participant);
    }
    
    /**
     * @notice Update a participant's reward shares
     * @param participant Address of the participant
     * @param newSharesBPS New shares in basis points (10000 = 100%)
     */
    function updateParticipantShares(address participant, uint256 newSharesBPS) external onlyRole(GOVERNANCE_ROLE) {
        require(participants[participant].isActive, "Participant doesn't exist");
        require(newSharesBPS > 0, "Shares must be positive");
        
        uint256 previousSharesBPS = participants[participant].sharesBPS;
        totalSharesBPS = totalSharesBPS - previousSharesBPS + newSharesBPS;
        require(totalSharesBPS <= 10000, "Total shares exceed 100%");
        
        participants[participant].sharesBPS = newSharesBPS;
        
        emit ParticipantSharesUpdated(participant, previousSharesBPS, newSharesBPS);
    }
    
    /**
     * @notice Distribute rewards for the current cycle
     */
    function distributeRewards() external whenNotPaused onlyRole(DISTRIBUTOR_ROLE) {
        require(block.timestamp >= distributionCycles[currentCycleNumber].endTimestamp, "Distribution cycle not ended");
        require(!distributionCycles[currentCycleNumber].distributed, "Cycle already distributed");
        
        // Mark current cycle as distributed
        distributionCycles[currentCycleNumber].distributed = true;
        lastDistributionTimestamp = block.timestamp;
        
        // Create next cycle
        currentCycleNumber++;
        DistributionCycle storage nextCycle = distributionCycles[currentCycleNumber];
        nextCycle.startTimestamp = block.timestamp;
        nextCycle.endTimestamp = block.timestamp + distributionCycle;
        nextCycle.distributed = false;
        
        emit CycleDistributed(
            currentCycleNumber - 1,
            distributionCycles[currentCycleNumber - 1].startTimestamp,
            distributionCycles[currentCycleNumber - 1].endTimestamp
        );
    }
    
    /**
     * @notice Claim rewards for a specific token and cycle
     * @param token Token address to claim rewards for
     * @param cycleNumber Cycle number to claim rewards for
     */
    function claimRewards(address token, uint256 cycleNumber) external whenNotPaused {
        require(participants[msg.sender].isActive, "Not an active participant");
        require(cycleNumber < currentCycleNumber, "Cycle not distributed yet");
        require(distributionCycles[cycleNumber].distributed, "Cycle not yet distributed");
        require(!distributionCycles[cycleNumber].participantClaimed[msg.sender], "Already claimed for this cycle");
        
        // Mark as claimed
        distributionCycles[cycleNumber].participantClaimed[msg.sender] = true;
        
        // Calculate reward amount
        uint256 totalTokenBalance = IERC20(token).balanceOf(address(this));
        uint256 participantShare = participants[msg.sender].sharesBPS;
        uint256 rewardAmount = (totalTokenBalance * participantShare) / 10000;
        
        // Transfer reward to participant
        if (rewardAmount > 0) {
            IERC20(token).safeTransfer(msg.sender, rewardAmount);
            participants[msg.sender].lastClaimTimestamp = block.timestamp;
            
            emit RewardClaimed(msg.sender, token, rewardAmount, cycleNumber);
        }
    }
    
    /**
     * @notice Update the distribution cycle duration
     * @param _distributionCycle New cycle duration in seconds
     */
    function updateDistributionCycle(uint256 _distributionCycle) external onlyRole(GOVERNANCE_ROLE) {
        require(_distributionCycle > 0, "Invalid cycle duration");
        
        uint256 previousCycle = distributionCycle;
        distributionCycle = _distributionCycle;
        
        // Update end timestamp of current cycle
        distributionCycles[currentCycleNumber].endTimestamp = distributionCycles[currentCycleNumber].startTimestamp + _distributionCycle;
        
        emit DistributionCycleUpdated(previousCycle, _distributionCycle);
    }
    
    /**
     * @notice Get all participants
     * @return Array of participant addresses
     */
    function getAllParticipants() external view returns (address[] memory) {
        return participantList;
    }
    
    /**
     * @notice Get participant details
     * @param participant Participant address
     * @return isActive Whether the participant is active
     * @return sharesBPS Participant's share in basis points
     * @return lastClaimTimestamp Last time the participant claimed rewards
     */
    function getParticipantDetails(address participant) external view returns (
        bool isActive,
        uint256 sharesBPS,
        uint256 lastClaimTimestamp
    ) {
        Participant memory p = participants[participant];
        return (p.isActive, p.sharesBPS, p.lastClaimTimestamp);
    }
    
    /**
     * @notice Get information about a distribution cycle
     * @param cycleNumber Cycle number
     * @return startTimestamp Cycle start timestamp
     * @return endTimestamp Cycle end timestamp
     * @return distributed Whether rewards have been distributed for this cycle
     */
    function getCycleInfo(uint256 cycleNumber) external view returns (
        uint256 startTimestamp,
        uint256 endTimestamp,
        bool distributed
    ) {
        DistributionCycle storage cycle = distributionCycles[cycleNumber];
        return (cycle.startTimestamp, cycle.endTimestamp, cycle.distributed);
    }
    
    /**
     * @notice Check if a participant has claimed rewards for a specific cycle
     * @param participant Participant address
     * @param cycleNumber Cycle number
     * @return Whether the participant has claimed rewards for the cycle
     */
    function hasClaimedForCycle(address participant, uint256 cycleNumber) external view returns (bool) {
        return distributionCycles[cycleNumber].participantClaimed[participant];
    }
    
    /**
     * @notice Get time until next distribution
     * @return Time in seconds until the next distribution can be executed
     */
    function getTimeUntilNextDistribution() external view returns (uint256) {
        uint256 endTime = distributionCycles[currentCycleNumber].endTimestamp;
        if (block.timestamp >= endTime) {
            return 0;
        }
        return endTime - block.timestamp;
    }
    
    /**
     * @notice Pause the RewardDistributor (emergency only)
     */
    function pause() external onlyRole(EMERGENCY_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the RewardDistributor
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}