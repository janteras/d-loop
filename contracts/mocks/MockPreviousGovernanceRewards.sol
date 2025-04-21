// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../utils/Errors.sol";
import "./base/BaseMock.sol";
import "../interfaces/governance/IGovernanceRewards.sol";
import "../interfaces/tokens/IERC20.sol";

/**
 * @title MockPreviousGovernanceRewards
 * @dev This is a minimal implementation of a previous version of GovernanceRewards
 * @notice Only implements functions directly required for backward compatibility testing
 */
abstract contract MockPreviousGovernanceRewards is AccessControl, BaseMock, IGovernanceRewards {

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
    
    // Previous version had a simpler reward record structure
    struct OldRewardRecord {
        uint256 id;
        address[] recipients;
        uint256[] amounts;
        uint256 timestamp;
    }
    
    OldRewardRecord[] public oldRewardHistory;
    
    uint256 public rewardCooldown;
    uint256 public rewardsDistributed;
    uint256 public nextRewardId;

    /**
     * @dev Constructor
     * @param _rewardToken Address of the token used for rewards
     * @param _admin Address of the admin
     */
    constructor(address _rewardToken, address _admin) BaseMock() {
        rewardToken = _rewardToken;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(DISTRIBUTOR_ROLE, _admin);
        
        rewardConfig = RewardConfig({
            baseReward: 100 ether,
            votingParticipationBonus: 20, // 20%
            proposalQualityMultiplier: 10000, // 1x
            aiNodeMultiplier: 12000, // 1.2x
            rewardCap: 1000 ether
        });
        
        rewardCooldown = 1 days;
        nextRewardId = 1;
    }
    
    /**
     * @dev Mock implementation of IERC165 supportsInterface
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return 
            interfaceId == 0x01ffc9a7 || // IERC165 interface ID
            interfaceId == 0x4b6e7f18;   // IGovernanceRewards interface ID
    }
    
    /**
     * @dev Distributes rewards to recipients (previous version signature)
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     */

    
    /**
     * @dev Distributes rewards to recipients (newer version signature)
     *  ID of the proposal
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     *  Description of the reward distribution
     */
    function distributeRewards(address[] memory recipients, uint256[] memory amounts) public {
        _recordFunctionCall("distributeRewards", abi.encode(recipients, amounts));
        emit RewardsDistributed(recipients, amounts);
    }

    function distributeRewards(
        uint256 proposalId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata description
    ) external {
        _recordFunctionCall(
            "distributeRewards",
            abi.encode(proposalId, recipients, amounts, description)
        );
        // This is a fallback to the simpler version for backward compatibility
        distributeRewards(recipients, amounts);
    }
    
    /**
     * @dev Claims rewards for the caller
     * @return amount The amount of rewards claimed
     */
    function claimRewards() external returns (uint256 amount) {
        _recordFunctionCall(
            "claimRewards",
            abi.encode()
        );
        
        // This is a mock implementation that doesn't actually do anything
        // In a real implementation, this would transfer tokens to the caller
        return 0;
    }
    
    /**
     * @dev Gets the reward config
     * @return config The reward config
     */
    function getRewardConfig() external view returns (RewardConfig memory config) {
        return rewardConfig;
    }
    
    /**
     * @dev Updates the reward config
     * @param _baseReward Base reward amount
     * @param _votingParticipationBonus Bonus for voting participation
     * @param _proposalQualityMultiplier Multiplier for proposal quality
     * @param _aiNodeMultiplier Multiplier for AI node operators
     * @param _rewardCap Maximum reward cap
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
        
        if (!hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        
        rewardConfig = RewardConfig({
            baseReward: _baseReward,
            votingParticipationBonus: _votingParticipationBonus,
            proposalQualityMultiplier: _proposalQualityMultiplier,
            aiNodeMultiplier: _aiNodeMultiplier,
            rewardCap: _rewardCap
        });
    }
    
    /**
     * @dev Checks if an account has a role
     * @param role Role to check
     * @param account Account to check
     * @return bool Whether the account has the role
     */
    function hasRole(bytes32 role, address account) public view override(AccessControl, IGovernanceRewards) returns (bool) {
        return _roles[role][account];
    }
    
    /**
     * @dev Grants a role to an account
     * @param role Role to grant
     * @param account Account to grant the role to
     */
    function grantRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "grantRole",
            abi.encode(role, account)
        );
        
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        _grantRole(role, account);
    }
    
    /**
     * @dev Revokes a role from an account
     * @param role Role to revoke
     * @param account Account to revoke the role from
     */
    function revokeRole(bytes32 role, address account) public override(AccessControl) {
        _recordFunctionCall(
            "revokeRole",
            abi.encode(role, account)
        );
        
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        _roles[role][account] = false;
    }
    
    /**
     * @dev Internal function to grant a role
     * @param role Role to grant
     * @param account Account to grant the role to
     */
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        _roles[role][account] = true;
        return true;
    }
}
