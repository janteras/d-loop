// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IFeeSystem
 * @dev Interface for fee calculations and processing
 * @notice This interface defines the standard functions for fee management
 */
interface IFeeSystem {
    /**
     * @dev Event emitted when a fee is collected
     * @param feeType Type of fee (Invest, Divest, Ragequit)
     * @param token Address of the token used for the fee
     * @param totalFee Total fee amount
     * @param treasuryFee Portion of the fee sent to the treasury
     * @param rewardFee Portion of the fee used for rewards
     */
    event FeeCollected(
        string feeType,
        address indexed token,
        uint256 totalFee,
        uint256 treasuryFee,
        uint256 rewardFee
    );
    
    /**
     * @dev Event emitted when a fee parameter is updated
     * @param feeType Type of fee (Invest, Divest, Ragequit)
     * @param oldPercentage Previous percentage value
     * @param newPercentage New percentage value
     */
    event FeeParameterUpdated(
        string feeType,
        uint256 oldPercentage,
        uint256 newPercentage
    );
    /**
     * @dev Calculates the investment fee for a given amount
     * @param amount Amount to calculate fee for
     * @return fee The calculated fee
     */
    function calculateInvestFee(uint256 amount) external view returns (uint256);
    
    /**
     * @dev Calculates the divestment fee for a given amount
     * @param amount Amount to calculate fee for
     * @return fee The calculated fee
     */
    function calculateDivestFee(uint256 amount) external view returns (uint256);
    
    /**
     * @dev Calculates the ragequit fee for a given amount
     * @param amount Amount to calculate fee for
     * @return fee The calculated fee
     */
    function calculateRagequitFee(uint256 amount) external view returns (uint256);
    
    /**
     * @dev Processes an investment fee
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @param amount Amount of the investment
     * @return feeAmount The fee amount processed
     */
    function processInvestFee(uint256 assetId, address investor, uint256 amount) external returns (uint256);
    
    /**
     * @dev Processes a divestment fee
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @param amount Amount of the divestment
     * @return feeAmount The fee amount processed
     */
    function processDivestFee(uint256 assetId, address investor, uint256 amount) external returns (uint256);
    
    /**
     * @dev Processes a ragequit fee
     * @param assetId ID of the asset
     * @param investor Address of the investor
     * @param amount Amount of the ragequit
     * @return feeAmount The fee amount processed
     */
    function processRagequitFee(uint256 assetId, address investor, uint256 amount) external returns (uint256);
    
    /**
     * @dev Gets the current investment fee percentage
     * @return percentage The investment fee percentage (in basis points, where 10000 = 100%)
     */
    function getInvestFeePercentage() external view returns (uint256);
    
    /**
     * @dev Gets the current divestment fee percentage
     * @return percentage The divestment fee percentage (in basis points, where 10000 = 100%)
     */
    function getDivestFeePercentage() external view returns (uint256);
    
    /**
     * @dev Gets the current ragequit fee percentage
     * @return percentage The ragequit fee percentage (in basis points, where 10000 = 100%)
     */
    function getRagequitFeePercentage() external view returns (uint256);
}