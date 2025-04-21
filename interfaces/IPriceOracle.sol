// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IPriceOracle
 * @dev Interface for the PriceOracle contract.
 * Provides price data for assets in the protocol.
 */
interface IPriceOracle {
    /**
     * @dev Gets the price of an asset
     * @param _asset Address of the asset
     * @return The price of the asset
     */
    function getAssetPrice(address _asset) external view returns (uint256);

    /**
     * @dev Gets the decimals for an asset price
     * @param _asset Address of the asset
     * @return The number of decimals
     */
    function getAssetDecimals(address _asset) external view returns (uint8);
}
