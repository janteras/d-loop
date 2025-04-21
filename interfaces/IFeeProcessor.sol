// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IFeeProcessor
 * @dev Interface for the FeeProcessor contract.
 * Processes collected fees and distributes them.
 */
interface IFeeProcessor {
    /**
     * @dev Collects investment fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectInvestFee(address token, uint256 amount) external returns (uint256);

    /**
     * @dev Collects divestment fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectDivestFee(address token, uint256 amount) external returns (uint256);

    /**
     * @dev Collects ragequit fees and distributes them
     * @param token Address of the token being collected
     * @param amount Amount on which to calculate the fee
     * @return totalFee The total fee amount collected
     */
    function collectRagequitFee(address token, uint256 amount) external returns (uint256);
    
    /**
     * @dev Gets the current distribution percentages
     * @return _treasuryPercentage The current treasury percentage (in basis points)
     * @return _rewardDistPercentage The current reward distributor percentage (in basis points)
     */
    function getDistributionPercentages() external view returns (
        uint256 _treasuryPercentage,
        uint256 _rewardDistPercentage
    );
}
