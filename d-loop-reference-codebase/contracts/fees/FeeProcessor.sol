// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IFeeProcessor.sol";

/**
 * @title FeeProcessor
 * @notice Processes fees by distributing them to Treasury and RewardDistributor
 * @dev Implements the IFeeProcessor interface
 */
contract FeeProcessor is IFeeProcessor, Initializable, AccessControlUpgradeable {
    using SafeERC20 for IERC20;
    
    // Access control roles
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ASSET_DAO_ROLE = keccak256("ASSET_DAO_ROLE");
    
    // Fee distribution
    uint256 public treasuryShare; // Scaled by 1e18 (70% = 0.7 * 1e18)
    uint256 public rewardsShare;  // Scaled by 1e18 (30% = 0.3 * 1e18)
    
    // Distribution addresses
    address public treasury;
    address public rewardDistributor;
    
    // Events
    event FeeProcessed(
        address indexed token,
        uint256 totalAmount,
        uint256 treasuryAmount,
        uint256 rewardsAmount
    );
    event DistributionUpdated(
        uint256 previousTreasuryShare,
        uint256 newTreasuryShare,
        uint256 previousRewardsShare,
        uint256 newRewardsShare
    );
    event DistributionAddressesUpdated(
        address previousTreasury,
        address newTreasury,
        address previousRewardDistributor,
        address newRewardDistributor
    );
    
    /**
     * @notice Initialize the FeeProcessor contract
     * @param _treasuryShare Treasury's share of fees (scaled by 1e18)
     * @param _rewardsShare RewardDistributor's share of fees (scaled by 1e18)
     * @param _treasury Address of the Treasury contract
     * @param _rewardDistributor Address of the RewardDistributor contract
     */
    function initialize(
        uint256 _treasuryShare,
        uint256 _rewardsShare,
        address _treasury,
        address _rewardDistributor
    ) public initializer {
        __AccessControl_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        require(_treasuryShare + _rewardsShare == 1e18, "Shares must equal 100%");
        require(_treasury != address(0), "Invalid treasury address");
        require(_rewardDistributor != address(0), "Invalid reward distributor address");
        
        treasuryShare = _treasuryShare;
        rewardsShare = _rewardsShare;
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
    }
    
    /**
     * @notice Process a collected fee
     * @param token Address of the token being processed
     * @param amount Amount of the fee to process
     */
    function processFee(address token, uint256 amount) external override onlyRole(ASSET_DAO_ROLE) {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be positive");
        
        // Calculate distribution amounts
        uint256 treasuryAmount = (amount * treasuryShare) / 1e18;
        uint256 rewardsAmount = amount - treasuryAmount; // Use subtraction to avoid rounding errors
        
        // Transfer to Treasury
        if (treasuryAmount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, treasury, treasuryAmount);
        }
        
        // Transfer to RewardDistributor
        if (rewardsAmount > 0) {
            IERC20(token).safeTransferFrom(msg.sender, rewardDistributor, rewardsAmount);
        }
        
        emit FeeProcessed(token, amount, treasuryAmount, rewardsAmount);
    }
    
    /**
     * @notice Update the fee distribution shares
     * @param _treasuryShare New Treasury share (scaled by 1e18)
     * @param _rewardsShare New RewardDistributor share (scaled by 1e18)
     */
    function updateDistribution(
        uint256 _treasuryShare,
        uint256 _rewardsShare
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(_treasuryShare + _rewardsShare == 1e18, "Shares must equal 100%");
        
        uint256 previousTreasuryShare = treasuryShare;
        uint256 previousRewardsShare = rewardsShare;
        
        treasuryShare = _treasuryShare;
        rewardsShare = _rewardsShare;
        
        emit DistributionUpdated(
            previousTreasuryShare,
            _treasuryShare,
            previousRewardsShare,
            _rewardsShare
        );
    }
    
    /**
     * @notice Update the distribution addresses
     * @param _treasury New Treasury address
     * @param _rewardDistributor New RewardDistributor address
     */
    function updateDistributionAddresses(
        address _treasury,
        address _rewardDistributor
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(_treasury != address(0), "Invalid treasury address");
        require(_rewardDistributor != address(0), "Invalid reward distributor address");
        
        address previousTreasury = treasury;
        address previousRewardDistributor = rewardDistributor;
        
        treasury = _treasury;
        rewardDistributor = _rewardDistributor;
        
        emit DistributionAddressesUpdated(
            previousTreasury,
            _treasury,
            previousRewardDistributor,
            _rewardDistributor
        );
    }
    
    /**
     * @notice Grant the ASSET_DAO_ROLE to a contract
     * @param assetDAO Address of the AssetDAO contract
     */
    function grantAssetDAORole(address assetDAO) external onlyRole(GOVERNANCE_ROLE) {
        require(assetDAO != address(0), "Invalid AssetDAO address");
        _grantRole(ASSET_DAO_ROLE, assetDAO);
    }
    
    /**
     * @notice Get the current fee distribution breakdown
     * @return _treasuryShare Percentage of fees going to Treasury (scaled by 1e18)
     * @return _rewardsShare Percentage of fees going to RewardDistributor (scaled by 1e18)
     */
    function getFeeDistribution() external view override returns (
        uint256 _treasuryShare,
        uint256 _rewardsShare
    ) {
        return (treasuryShare, rewardsShare);
    }
    
    /**
     * @notice Get the addresses of the Treasury and RewardDistributor
     * @return _treasury Address of the Treasury contract
     * @return _rewardDistributor Address of the RewardDistributor contract
     */
    function getDistributionAddresses() external view override returns (
        address _treasury,
        address _rewardDistributor
    ) {
        return (treasury, rewardDistributor);
    }
}