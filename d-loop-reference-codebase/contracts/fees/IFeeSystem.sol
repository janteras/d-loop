// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../libraries/DiamondStorage.sol";

/**
 * @title IFeeSystem
 * @dev Interface for the D-Loop fee calculation and collection system.
 * This interface defines the functions needed for fee management in the protocol.
 */
interface IFeeSystem {
    // ================ Events ================

    /**
     * @dev Emitted when a fee is collected
     */
    event FeeCollected(
        address indexed user,
        uint8 indexed operationType,
        uint256 amount,
        uint256 feeAmount,
        uint256 timestamp
    );

    /**
     * @dev Emitted when a fee is distributed
     */
    event FeeDistributed(
        address indexed treasury,
        address indexed rewardDistributor,
        uint256 treasuryAmount,
        uint256 rewardAmount,
        uint256 timestamp
    );

    /**
     * @dev Emitted when fee rates are updated
     */
    event FeeRateUpdated(
        uint8 indexed operationType,
        uint256 oldRate,
        uint256 newRate
    );

    /**
     * @dev Emitted when fee distribution shares are updated
     */
    event FeeSharesUpdated(
        uint256 treasuryShare,
        uint256 rewardDistributorShare
    );

    // ================ Fee Calculation ================

    /**
     * @dev Calculate fee for a specified operation
     * @param operationType Type of operation (invest, divest, ragequit, etc.)
     * @param amount Amount of tokens involved in the operation
     * @return Fee amount to be collected
     */
    function calculateFee(
        DiamondStorage.FeeOperationType operationType,
        uint256 amount
    ) external view returns (uint256);

    /**
     * @dev Get the current fee rate for an operation type
     * @param operationType Type of operation
     * @return Fee rate in basis points (100 = 1%)
     */
    function getFeeRate(DiamondStorage.FeeOperationType operationType) external view returns (uint256);

    /**
     * @dev Set fee rate for an operation type
     * @param operationType Type of operation
     * @param feeRate New fee rate in basis points (100 = 1%)
     */
    function setFeeRate(DiamondStorage.FeeOperationType operationType, uint256 feeRate) external;

    // ================ Fee Collection ================

    /**
     * @dev Collect fee for an operation
     * @param user Address of the user performing the operation
     * @param operationType Type of operation
     * @param token Address of the token being used
     * @param amount Amount of tokens involved in operation
     * @return feeAmount Amount of fee collected
     */
    function collectFee(
        address user,
        DiamondStorage.FeeOperationType operationType,
        address token,
        uint256 amount
    ) external returns (uint256 feeAmount);

    /**
     * @dev Distribute collected fees to treasury and reward distributor
     * @return treasuryAmount Amount sent to treasury
     * @return rewardAmount Amount sent to reward distributor
     */
    function distributeFees() external returns (uint256 treasuryAmount, uint256 rewardAmount);

    // ================ Fee Configuration ================

    /**
     * @dev Set fee distribution shares
     * @param treasuryShare Treasury's share in basis points (7000 = 70%)
     * @param rewardDistributorShare RewardDistributor's share in basis points (3000 = 30%)
     */
    function setFeeShares(uint256 treasuryShare, uint256 rewardDistributorShare) external;

    /**
     * @dev Set treasury address
     * @param treasury New treasury address
     */
    function setTreasury(address treasury) external;

    /**
     * @dev Set reward distributor address
     * @param rewardDistributor New reward distributor address
     */
    function setRewardDistributor(address rewardDistributor) external;

    // ================ Fee Reporting ================

    /**
     * @dev Get total fees collected
     * @return Total fees collected
     */
    function getTotalFeesCollected() external view returns (uint256);

    /**
     * @dev Get fees collected by operation type
     * @param operationType Type of operation
     * @return Total fees collected for this operation type
     */
    function getFeesByType(DiamondStorage.FeeOperationType operationType) external view returns (uint256);

    /**
     * @dev Get fees paid by user
     * @param user Address of the user
     * @return Total fees paid by this user
     */
    function getFeesPaidByUser(address user) external view returns (uint256);
}