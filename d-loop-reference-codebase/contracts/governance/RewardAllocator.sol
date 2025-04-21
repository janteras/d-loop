// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/Errors.sol";
import "./GovernanceTracker.sol";
import "../fees/RewardDistributor.sol";

/**
 * @title RewardAllocator
 * @notice Allocates rewards based on governance participation
 * @dev Integrates GovernanceTracker with RewardDistributor
 */
contract RewardAllocator is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable 
{
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");
    
    // Contracts
    GovernanceTracker public governanceTracker;
    RewardDistributor public rewardDistributor;
    
    // Token => Pool ID mapping
    mapping(address => uint256) public rewardPools;
    
    // Period allocation records
    struct AllocationRecord {
        bool allocated;                  // Whether the period has been allocated
        uint256 totalAllocated;          // Total amount allocated for this period
        mapping(address => bool) claimed; // Whether a user has claimed for this period
    }
    
    // Period => Token => Allocation Record
    mapping(uint256 => mapping(address => AllocationRecord)) public allocations;
    
    // Events
    event RewardsAllocated(uint256 indexed periodId, address indexed token, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed periodId, address indexed token, uint256 amount);
    event RewardPoolRegistered(address indexed token, uint256 poolId);
    
    /**
     * @notice Initialize the contract
     * @param _governanceTracker Address of the GovernanceTracker contract
     * @param _rewardDistributor Address of the RewardDistributor contract
     */
    function initialize(
        address _governanceTracker,
        address _rewardDistributor
    ) 
        public 
        initializer 
    {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(ALLOCATOR_ROLE, msg.sender);
        
        if (_governanceTracker == address(0) || _rewardDistributor == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        governanceTracker = GovernanceTracker(_governanceTracker);
        rewardDistributor = RewardDistributor(_rewardDistributor);
    }
    
    /**
     * @notice Registers a new reward pool
     * @param _token Address of the reward token
     * @param _poolId Pool ID in the RewardDistributor
     */
    function registerRewardPool(address _token, uint256 _poolId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_token == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        rewardPools[_token] = _poolId;
        
        emit RewardPoolRegistered(_token, _poolId);
    }
    
    /**
     * @notice Allocates rewards for a specific period
     * @param _periodId ID of the period to allocate rewards for
     * @param _token Address of the reward token
     * @param _amount Total amount to allocate
     */
    function allocateRewards(
        uint256 _periodId,
        address _token,
        uint256 _amount
    ) 
        external 
        onlyRole(ALLOCATOR_ROLE) 
    {
        if (_token == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        if (_amount == 0) {
            revert Errors.InvalidAmount();
        }
        
        // Check if this period exists in the governance tracker
        if (_periodId >= governanceTracker.rewardPeriods.length) {
            revert Errors.InvalidPeriodId();
        }
        
        // Check if the period is finalized
        (uint256 startTime, uint256 endTime, bool finalized, ) = governanceTracker.rewardPeriods(_periodId);
        
        if (!finalized) {
            revert Errors.PeriodNotFinalized();
        }
        
        // Check if we've already allocated for this period and token
        if (allocations[_periodId][_token].allocated) {
            revert Errors.AlreadyAllocated();
        }
        
        // Transfer tokens from sender to this contract
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        
        // Mark as allocated
        allocations[_periodId][_token].allocated = true;
        allocations[_periodId][_token].totalAllocated = _amount;
        
        emit RewardsAllocated(_periodId, _token, _amount);
    }
    
    /**
     * @notice Claims rewards for a specific period
     * @param _periodId ID of the period to claim rewards for
     * @param _token Address of the reward token
     */
    function claimRewards(uint256 _periodId, address _token) 
        external 
    {
        if (_token == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        // Check if this period has been allocated
        if (!allocations[_periodId][_token].allocated) {
            revert Errors.NotAllocated();
        }
        
        // Check if user has already claimed
        if (allocations[_periodId][_token].claimed[msg.sender]) {
            revert Errors.AlreadyClaimed();
        }
        
        // Get user's score for the period
        uint256 userScore = governanceTracker.getUserPeriodScore(msg.sender, _periodId);
        
        if (userScore == 0) {
            revert Errors.NoRewardsToClaim();
        }
        
        // Get total score for the period
        (, , , uint256 totalScore) = governanceTracker.rewardPeriods(_periodId);
        
        if (totalScore == 0) {
            revert Errors.NoRewardsToClaim();
        }
        
        // Calculate user's share of rewards
        uint256 totalAllocated = allocations[_periodId][_token].totalAllocated;
        uint256 userReward = (totalAllocated * userScore) / totalScore;
        
        if (userReward == 0) {
            revert Errors.NoRewardsToClaim();
        }
        
        // Mark as claimed
        allocations[_periodId][_token].claimed[msg.sender] = true;
        
        // Transfer rewards directly to user
        IERC20(_token).safeTransfer(msg.sender, userReward);
        
        emit RewardClaimed(msg.sender, _periodId, _token, userReward);
    }
    
    /**
     * @notice Forwards rewards to the RewardDistributor
     * @param _periodId ID of the period to allocate rewards for
     * @param _token Address of the reward token
     * @param _amount Total amount to allocate
     */
    function forwardToRewardDistributor(
        uint256 _periodId,
        address _token,
        uint256 _amount
    ) 
        external 
        onlyRole(ALLOCATOR_ROLE) 
    {
        if (_token == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        if (_amount == 0) {
            revert Errors.InvalidAmount();
        }
        
        // Check if we have a registered pool for this token
        uint256 poolId = rewardPools[_token];
        
        if (poolId == 0) {
            revert Errors.PoolNotRegistered();
        }
        
        // Check if this period exists in the governance tracker
        if (_periodId >= governanceTracker.rewardPeriods.length) {
            revert Errors.InvalidPeriodId();
        }
        
        // Transfer tokens from sender to this contract
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        
        // Approve RewardDistributor to spend tokens
        IERC20(_token).approve(address(rewardDistributor), _amount);
        
        // Forward to RewardDistributor
        rewardDistributor.collectReward(poolId - 1, _amount);
        
        emit RewardsAllocated(_periodId, _token, _amount);
    }
    
    /**
     * @notice Gets the reward amount for a user for a specific period
     * @param _user Address of the user
     * @param _periodId ID of the period
     * @param _token Address of the reward token
     * @return amount Reward amount
     * @return claimed Whether the reward has been claimed
     */
    function getUserReward(
        address _user,
        uint256 _periodId,
        address _token
    ) 
        external 
        view 
        returns (uint256 amount, bool claimed) 
    {
        if (_token == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        // Check if this period has been allocated
        if (!allocations[_periodId][_token].allocated) {
            return (0, false);
        }
        
        // Check if user has already claimed
        if (allocations[_periodId][_token].claimed[_user]) {
            return (0, true);
        }
        
        // Get user's score for the period
        uint256 userScore = governanceTracker.getUserPeriodScore(_user, _periodId);
        
        if (userScore == 0) {
            return (0, false);
        }
        
        // Get total score for the period
        (, , , uint256 totalScore) = governanceTracker.rewardPeriods(_periodId);
        
        if (totalScore == 0) {
            return (0, false);
        }
        
        // Calculate user's share of rewards
        uint256 totalAllocated = allocations[_periodId][_token].totalAllocated;
        uint256 userReward = (totalAllocated * userScore) / totalScore;
        
        return (userReward, false);
    }
    
    /**
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract.
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}