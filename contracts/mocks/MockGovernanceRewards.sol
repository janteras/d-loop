// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../utils/Errors.sol";
import "../../contracts/interfaces/governance/IGovernanceRewards.sol";

/**
 * @title MockGovernanceRewards
 * @dev Mock implementation of the GovernanceRewards contract for testing
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockGovernanceRewards is BaseMock, IGovernanceRewards {
    // Roles
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // Role management mapping
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // State variables
    address public rewardToken;


    RewardConfig public rewardConfig;
    
    mapping(address => uint256) public totalRewardsEarned;
    mapping(address => uint256) public lastRewardTimestamp;
    mapping(address => uint256) public reputationScores;
    
    RewardRecord[] public rewardHistory;
    
    uint256 public rewardCooldown;
    uint256 public rewardsDistributed;
    uint256 public rewardPeriodStart;
    uint256 public epochId;

    /**
     * @dev Constructor
     */
    constructor() BaseMock() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        
        rewardConfig = RewardConfig({
            baseReward: 100 ether,
            votingParticipationBonus: 20, // 20%
            proposalQualityMultiplier: 10000, // 1x
            aiNodeMultiplier: 12000, // 1.2x
            rewardCap: 1000 ether
        });
        
        rewardCooldown = 1 days;
        rewardPeriodStart = block.timestamp;
        epochId = 1;
    }

    /**
     * @dev Distribute rewards to a participant
     * @param _recipient Address of the reward recipient
     * @param _amount Amount of tokens to distribute
     * @param _reason Reason for the reward
     */
    function distributeReward(address _recipient, uint256 _amount, string memory _reason) external {
        _recordFunctionCall(
            "distributeReward",
            abi.encode(_recipient, _amount, _reason)
        );
        
        if (!_hasRole(DISTRIBUTOR_ROLE, msg.sender)) revert OperationFailed();
        if (_recipient == address(0)) revert ZeroAddress();
        if (_amount == 0) revert InvalidAmount();
        if (_amount > rewardConfig.rewardCap) revert AmountExceedsCap();
        
        totalRewardsEarned[_recipient] += _amount;
        lastRewardTimestamp[_recipient] = block.timestamp;
        rewardsDistributed += _amount;
        
        rewardHistory.push(RewardRecord({
            recipient: _recipient,
            amount: _amount,
            timestamp: block.timestamp,
            reason: _reason
        }));
        
        emit RewardDistributed(_recipient, _amount, _reason);
    }

    /**
     * @dev Distribute rewards to multiple recipients (legacy signature for backward compatibility)
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     */
    function distributeRewards(address[] memory recipients, uint256[] memory amounts) public override {
        _recordFunctionCall("distributeRewards", abi.encode(recipients, amounts));
        // In a real implementation, this would transfer tokens. For the mock, just emit an event.
        emit RewardsDistributed(recipients, amounts);
    }

    /**
     * @dev Distribute rewards to multiple recipients (newer signature for backward compatibility)
     * @param proposalId ID of the proposal
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param description Description of the reward distribution
     */
    function distributeRewards(uint256 proposalId, address[] calldata recipients, uint256[] calldata amounts, string calldata description) external override {
        _recordFunctionCall("distributeRewards", abi.encode(proposalId, recipients, amounts, description));
        // This is a fallback to the simpler version for backward compatibility
        distributeRewards(recipients, amounts);
    }

    /**
     * @dev Claims rewards for the caller (for backward compatibility)
     * @return amount The amount of rewards claimed
     */
    function claimRewards() external override returns (uint256 amount) {
        _recordFunctionCall("claimRewards", abi.encode());
        // This is a mock implementation that doesn't actually do anything
        return 0;
    }

    /**
     * @dev Distribute rewards for a proposal
     * @param _proposer Address of the proposal creator
     * @param _proposalId ID of the proposal
     * @param _quality Quality score of the proposal (0-100)
     * @param _voterParticipation Percentage of voters who participated (0-100)
     */
    function distributeProposalReward(
        address _proposer,
        uint256 _proposalId,
        uint256 _quality,
        uint256 _voterParticipation
    ) external {
        _recordFunctionCall(
            "distributeProposalReward",
            abi.encode(_proposer, _proposalId, _quality, _voterParticipation)
        );
        
        if (!_hasRole(DISTRIBUTOR_ROLE, msg.sender)) revert OperationFailed();
        if (_proposer == address(0)) revert ZeroAddress();
        if (_quality > 100) revert InvalidQuality();
        if (_voterParticipation > 100) revert InvalidParticipation();
        if (block.timestamp < lastRewardTimestamp[_proposer] + rewardCooldown) revert CooldownPeriodNotMet();
        
        // Calculate reward
        uint256 baseReward = rewardConfig.baseReward;
        uint256 participationBonus = baseReward * rewardConfig.votingParticipationBonus * _voterParticipation / 10000;
        uint256 qualityMultiplier = rewardConfig.proposalQualityMultiplier * _quality / 100;
        
        uint256 totalReward = (baseReward + participationBonus) * qualityMultiplier / 10000;
        
        if (totalReward > rewardConfig.rewardCap) {
            totalReward = rewardConfig.rewardCap;
        }
        
        // Distribute reward
        totalRewardsEarned[_proposer] += totalReward;
        lastRewardTimestamp[_proposer] = block.timestamp;
        rewardsDistributed += totalReward;
        
        rewardHistory.push(RewardRecord({
            recipient: _proposer,
            amount: totalReward,
            timestamp: block.timestamp,
            reason: string(abi.encodePacked("Proposal reward: ", _proposalId))
        }));
        
        emit RewardDistributed(_proposer, totalReward, string(abi.encodePacked("Proposal reward: ", _proposalId)));
    }

    /**
     * @dev Distribute epoch rewards to all participants
     * @param _epochId ID of the epoch
     * @return totalDistributed Total amount distributed
     */
    function distributeEpochRewards(uint256 _epochId) external returns (uint256 totalDistributed) {
        _recordFunctionCall(
            "distributeEpochRewards",
            abi.encode(_epochId)
        );
        
        if (!_hasRole(DISTRIBUTOR_ROLE, msg.sender)) revert OperationFailed();
        if (_epochId != epochId) revert InvalidEpochId();
        
        // Mock implementation - in a real contract, this would distribute rewards to all participants
        totalDistributed = 1000 ether;
        rewardsDistributed += totalDistributed;
        epochId++;
        
        emit EpochRewarded(_epochId, totalDistributed, 10); // Mock 10 participants
        
        return totalDistributed;
    }

    /**
     * @dev Update the reward configuration
     * @param _baseReward Base reward amount
     * @param _votingParticipationBonus Bonus for high voting participation
     * @param _proposalQualityMultiplier Multiplier for high-quality proposals
     * @param _aiNodeMultiplier Multiplier for AI nodes
     * @param _rewardCap Maximum reward per distribution
     */
    function updateRewardConfig(
        uint256 _baseReward,
        uint256 _votingParticipationBonus,
        uint256 _proposalQualityMultiplier,
        uint256 _aiNodeMultiplier,
        uint256 _rewardCap
    ) external {
        _recordFunctionCall(
            "updateRewardConfig",
            abi.encode(_baseReward, _votingParticipationBonus, _proposalQualityMultiplier, _aiNodeMultiplier, _rewardCap)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        rewardConfig.baseReward = _baseReward;
        rewardConfig.votingParticipationBonus = _votingParticipationBonus;
        rewardConfig.proposalQualityMultiplier = _proposalQualityMultiplier;
        rewardConfig.aiNodeMultiplier = _aiNodeMultiplier;
        rewardConfig.rewardCap = _rewardCap;
        
        emit RewardConfigUpdated(
            _baseReward,
            _votingParticipationBonus,
            _proposalQualityMultiplier,
            _aiNodeMultiplier,
            _rewardCap
        );
    }

    /**
     * @dev Register a participant for rewards
     * @param _participant Address of the participant
     * @param _initialReputation Initial reputation score
     */
    function registerParticipant(address _participant, uint256 _initialReputation) external {
        _recordFunctionCall(
            "registerParticipant",
            abi.encode(_participant, _initialReputation)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        if (_participant == address(0)) revert ZeroAddress();
        
        reputationScores[_participant] = _initialReputation;
        
        emit ParticipantRegistered(_participant, _initialReputation);
    }

    /**
     * @dev Update a participant's reputation
     * @param _participant Address of the participant
     * @param _newReputation New reputation score
     */
    function updateReputation(address _participant, uint256 _newReputation) external {
        _recordFunctionCall(
            "updateReputation",
            abi.encode(_participant, _newReputation)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        if (_participant == address(0)) revert ZeroAddress();
        
        uint256 oldReputation = reputationScores[_participant];
        reputationScores[_participant] = _newReputation;
        
        emit ReputationUpdated(_participant, oldReputation, _newReputation);
    }

    /**
     * @dev Calculate reward for a participant
     * @param _participant Address of the participant
     * @return reward Amount of reward tokens
     */
    function calculateReward(address _participant) external view returns (uint256 reward) {
        if (_participant == address(0)) revert ZeroAddress();
        
        // Mock calculation based on reputation
        uint256 reputation = reputationScores[_participant];
        reward = rewardConfig.baseReward * reputation / 100;
        
        if (reward > rewardConfig.rewardCap) {
            reward = rewardConfig.rewardCap;
        }
        
        return reward;
    }

    /**
     * @dev Get the current reward configuration
     * @return config Reward configuration
     */
    function getRewardConfig() external view returns (RewardConfig memory config) {
        return rewardConfig;
    }

    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view override(AccessControl, IGovernanceRewards) returns (bool) {
        return _roles[role][account];
    }

    /**
     * @dev Grant a role to an account (test helper)
     * @param role Role to grant
     * @param account Account to receive the role
     */
    function grantRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "grantRole",
            abi.encode(role, account)
        );
        
        require(_hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        _roles[role][account] = true;
        
        emit RoleGranted(role, account, msg.sender);
    }

    /**
     * @dev Revoke a role from an account (test helper)
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "revokeRole",
            abi.encode(role, account)
        );
        
        require(_hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        _roles[role][account] = false;
        
        emit RoleRevoked(role, account, msg.sender);
    }

    /**
     * @dev Set reward token (test helper)
     * @param _rewardToken Address of the reward token
     */
    function setRewardToken(address _rewardToken) external {
        _recordFunctionCall(
            "setRewardToken",
            abi.encode(_rewardToken)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        rewardToken = _rewardToken;
    }

    /**
     * @dev Set reward cooldown (test helper)
     * @param _rewardCooldown New reward cooldown period
     */
    function setRewardCooldown(uint256 _rewardCooldown) external {
        _recordFunctionCall(
            "setRewardCooldown",
            abi.encode(_rewardCooldown)
        );
        
        require(_hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        
        rewardCooldown = _rewardCooldown;
    }
    
    /**
     * @dev Check if an account has a specific role
     * @param role The role to check
     * @param account The account to check
     * @return bool True if the account has the role
     */
    /**
     * @dev Internal function to check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function _hasRole(bytes32 role, address account) internal view returns (bool) {
        return _roles[role][account];
    }
    
    /**
     * @dev Check if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */

    /**
     * @dev Check if a user is eligible for rewards
     * @param _user Address of the user
     * @return bool Whether the user is eligible for rewards
     */
    function isEligibleForRewards(address _user) external view returns (bool) {
        return block.timestamp >= lastRewardTimestamp[_user] + rewardCooldown;
    }
}
