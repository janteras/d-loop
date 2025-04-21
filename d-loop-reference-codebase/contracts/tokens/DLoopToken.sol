// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title DLoopToken
 * @notice Governance token for the D-Loop Protocol
 * @dev Implements ERC20 with voting capabilities
 */
contract DLoopToken is ERC20, ERC20Burnable, ERC20Snapshot, AccessControl, Pausable, ERC20Votes {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");
    
    uint8 private _decimals = 18;
    uint256 public constant MAX_SUPPLY = 100000000 * 10**18; // 100 million tokens
    
    // Token release schedule
    uint256 public immutable releaseStart;
    uint256 public constant RELEASE_DURATION = 6 * 365 days; // 6 years
    uint256 public initialSupply;
    uint256 public totalReleased;
    
    // Events
    event TokensReleased(address indexed to, uint256 amount);
    event VotingDelegated(address indexed delegator, address indexed delegatee);
    
    /**
     * @notice Constructor for DLoopToken
     * @param admin Address of the admin who will control the token
     * @param initialSupplyAmount Initial amount of tokens to mint
     */
    constructor(address admin, uint256 initialSupplyAmount) 
        ERC20("D-Loop Protocol Token", "D-AI") 
        ERC20Permit("D-Loop Protocol Token")
    {
        require(admin != address(0), "Invalid admin address");
        require(initialSupplyAmount <= MAX_SUPPLY, "Initial supply exceeds max supply");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(SNAPSHOT_ROLE, admin);
        
        releaseStart = block.timestamp;
        initialSupply = initialSupplyAmount;
        
        // Mint initial tokens to admin
        _mint(admin, initialSupplyAmount);
    }
    
    /**
     * @notice Mints new tokens
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     * @dev Only callable by addresses with MINTER_ROLE
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, amount);
    }
    
    /**
     * @notice Creates a new snapshot of token balances
     * @return The id of the snapshot
     * @dev Only callable by addresses with SNAPSHOT_ROLE
     */
    function snapshot() external onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        return _snapshot();
    }
    
    /**
     * @notice Pauses token transfers
     * @dev Only callable by addresses with PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses token transfers
     * @dev Only callable by addresses with PAUSER_ROLE
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Releases vested tokens to a recipient
     * @param recipient Address to receive vested tokens
     * @param amount Amount of tokens to release
     * @dev Only callable by addresses with MINTER_ROLE
     */
    function releaseTokens(address recipient, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(recipient != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be positive");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        
        _mint(recipient, amount);
        totalReleased += amount;
        
        emit TokensReleased(recipient, amount);
    }
    
    /**
     * @notice Calculate available tokens for release based on vesting schedule
     * @return Available tokens for release
     */
    function availableToRelease() external view returns (uint256) {
        if (block.timestamp <= releaseStart) {
            return 0;
        }
        
        uint256 elapsedTime = block.timestamp - releaseStart;
        
        if (elapsedTime >= RELEASE_DURATION) {
            // All tokens available
            return MAX_SUPPLY - initialSupply - totalReleased;
        }
        
        uint256 totalVestingAmount = MAX_SUPPLY - initialSupply;
        uint256 linearRelease = (totalVestingAmount * elapsedTime) / RELEASE_DURATION;
        
        // Available = Linear release minus already released
        return linearRelease > totalReleased ? linearRelease - totalReleased : 0;
    }
    
    /**
     * @notice Delegate voting power to another address
     * @param delegatee Address to receive voting power
     */
    function delegate(address delegatee) public override {
        super.delegate(delegatee);
        emit VotingDelegated(msg.sender, delegatee);
    }
    
    /**
     * @notice Returns the number of decimals for the token
     * @return The number of decimals
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    // Required overrides
    
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }
}