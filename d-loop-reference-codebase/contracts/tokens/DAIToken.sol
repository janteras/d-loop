// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./IDAIToken.sol";

/**
 * @title DAIToken
 * @dev Implementation of the D-AI TokenShare representing ownership in the Asset DAO pool
 * This token is fully backed by assets in the Asset DAO treasury
 */
contract DAIToken is IDAIToken, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ASSET_DAO_ROLE = keccak256("ASSET_DAO_ROLE");
    
    // Treasury address
    address public treasury;
    
    // Minting cap
    uint256 public mintingCap;
    
    // Events
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event MintingCapUpdated(uint256 previousCap, uint256 newCap);
    
    /**
     * @dev Constructor is disabled in favor of initialize for upgradeable contracts
     */
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the contract with initial roles and parameters
     * @param admin Admin address
     * @param assetDAO Asset DAO address for minting/burning
     * @param _treasury Treasury address
     * @param _mintingCap Initial minting cap
     */
    function initialize(
        address admin,
        address assetDAO,
        address _treasury,
        uint256 _mintingCap
    ) external initializer {
        require(admin != address(0), "DAIToken: admin is zero address");
        require(assetDAO != address(0), "DAIToken: asset DAO is zero address");
        require(_treasury != address(0), "DAIToken: treasury is zero address");
        
        // Initialize parent contracts
        __ERC20_init("D-AI Token", "D-AI");
        __ERC20Burnable_init();
        __Pausable_init();
        __AccessControl_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(ASSET_DAO_ROLE, assetDAO);
        _grantRole(MINTER_ROLE, assetDAO);
        
        treasury = _treasury;
        mintingCap = _mintingCap;
    }
    
    /**
     * @dev Mints new tokens (only callable by Asset DAO)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= mintingCap, "DAIToken: minting cap exceeded");
        _mint(to, amount);
    }
    
    /**
     * @dev Burns tokens from a specific address (only callable by Asset DAO)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external override onlyRole(ASSET_DAO_ROLE) whenNotPaused {
        super.burnFrom(from, amount);
    }
    
    /**
     * @dev Pauses token transfers, minting, and burning
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses token transfers, minting, and burning
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Updates the treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "DAIToken: new treasury is zero address");
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @dev Updates the minting cap
     * @param newCap New minting cap
     */
    function setMintingCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newCap >= totalSupply(), "DAIToken: cap cannot be less than current supply");
        
        uint256 oldCap = mintingCap;
        mintingCap = newCap;
        
        emit MintingCapUpdated(oldCap, newCap);
    }
    
    /**
     * @dev Hook that is called before any transfer of tokens
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}