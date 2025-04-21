// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title D-AI Token (D-Loop Asset Index Token)
 * @notice ERC-20 token representing the D-Loop Asset Index.
 * @dev This is NOT the MakerDAO DAI token - it's the native asset index token of the D-Loop Protocol.
 * Distinguished by:
 * - Symbol: D-AI (vs MakerDAO's DAI)
 * - Contract name: DAIToken (vs MakerDAO's DAI)
 * - Different deployment addresses
 * - Specific role-based permissions for the D-Loop ecosystem
 * - Integrated with D-Loop's governance and asset management systems
 */
contract DAIToken is ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @dev Initializes the D-AI token with name "D-AI Token" and symbol "DAI"
     * @notice This token uses the symbol "DAI" but is NOT the MakerDAO DAI stablecoin
     * @dev Sets up initial roles for the deployer (admin, minter, pauser)
     */
    constructor() ERC20("D-AI Token", "DAI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @dev Mints new D-AI tokens to the specified address
     * @notice Creates new D-Loop Asset Index tokens (not MakerDAO DAI)
     * @param to Address receiving the minted D-AI tokens
     * @param amount Amount of D-AI tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
