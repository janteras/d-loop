// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IDLoopToken } from "../../interfaces/IDLoopToken.sol"; // already named import, no change needed

/**
 * @title DLoopToken
 * @dev ERC20 Token for the DLOOP protocol
 * Implements role-based access control for minting and burning
 * Adds delegation functionality for governance
 */
contract DLoopToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, IDLoopToken {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 public immutable max_supply;
    uint8 private immutable _decimals;
    
    // Custom errors
    error ZeroAddress();
    error CannotDelegateToSelf();
    error AmountMustBeGreaterThanZero();
    error InsufficientBalanceForDelegation(uint256 balance, uint256 totalDelegated, uint256 requestedAmount);
    error InsufficientDelegatedAmount(uint256 available, uint256 requested);
    error ExceedsMaxSupply(uint256 currentSupply, uint256 amount, uint256 maxSupply);
    error InitialSupplyExceedsMaxSupply(uint256 initialSupply, uint256 maxSupply);
    error CannotBurnWithActiveDelegations(uint256 delegatedAmount);
    error DelegationDoesNotExist();
    error DelegationAlreadyExists();
    error InvalidDelegationOperation();
    
    // Optimized delegation storage structure
    struct DelegationInfo {
        uint224 amount;     // Delegation amount (224 bits is more than enough for token amounts)
        uint32 index;      // Index in the delegatees/delegators array for efficient removal
    }
    
    // Delegation mapping: delegator => delegatee => DelegationInfo
    mapping(address => mapping(address => DelegationInfo)) private _delegationInfo;
    
    // Total delegated by an address - packed for gas efficiency
    mapping(address => uint256) private _totalDelegatedByAddress;
    
    // Total delegated to an address - packed for gas efficiency
    mapping(address => uint256) private _totalDelegatedToAddress;
    
    // Delegators for each delegatee - stores addresses that have delegated to this address
    mapping(address => address[]) private _delegatorsForDelegatee;
    
    // Delegatees for each delegator - stores addresses this address has delegated to
    mapping(address => address[]) private _delegateesForDelegator;
    
    // Delegation events are defined in IDLoopToken interface
    
    /**
     * @dev Constructor matching the required test parameters
     * @param name Name of the token
     * @param symbol Symbol of the token
     * @param initialSupply Initial token supply to mint to the deployer
     * @param tokenDecimals Number of decimals for the token
     * @param maxSupply Maximum token supply
     * @param admin Initial admin address for the token
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 tokenDecimals,
        uint256 maxSupply,
        address admin
    ) ERC20(name, symbol) {
        if (initialSupply > maxSupply) revert InitialSupplyExceedsMaxSupply(initialSupply, maxSupply);
        if (admin == address(0)) revert ZeroAddress();
        
        _decimals = tokenDecimals;
        max_supply = maxSupply;
        
        // Always assign roles to msg.sender (the deployer) first
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Then, if admin is different from deployer, grant roles to admin too
        if (admin != msg.sender) {
            _grantRole(DEFAULT_ADMIN_ROLE, admin);
            _grantRole(MINTER_ROLE, admin);
            _grantRole(PAUSER_ROLE, admin);
        }
        
        // Initial tokens go to the deployer for simplicity
        _mint(msg.sender, initialSupply);
    }
    
    /**
     * @dev Mint new tokens
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        // Check if minting would exceed max supply
        uint256 currentSupply = totalSupply();
        if (currentSupply + amount > max_supply) revert ExceedsMaxSupply(currentSupply, amount, max_supply);
        _mint(to, amount);
    }
    
    /**
     * @dev Override burn function to check for delegations
     * @param value Amount of tokens to burn
     */
    function burn(uint256 value) public override {
        uint256 delegatedAmount = _totalDelegatedByAddress[msg.sender];
        if (delegatedAmount > 0 && balanceOf(msg.sender) - value < delegatedAmount) {
            revert CannotBurnWithActiveDelegations(delegatedAmount);
        }
        super.burn(value);
    }
    
    /**
     * @dev Pause token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Hook override to implement ERC20Pausable
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, amount);
    }
    
    /**
     * @dev Returns the number of decimals used for token amounts
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Delegates tokens to another address with optimized storage and gas usage
     * @param delegatee Address to delegate tokens to
     * @param amount Amount of tokens to delegate
     */
    function delegateTokens(address delegatee, uint256 amount) external {
        _validateDelegationInput(delegatee, amount);
        _checkDelegationBalance(msg.sender, amount);
        _updateDelegation(msg.sender, delegatee, amount);
        emit TokensDelegated(msg.sender, delegatee, amount);
    }

    function _validateDelegationInput(address delegatee, uint256 amount) private view {
        if (delegatee == address(0)) revert ZeroAddress();
        if (delegatee == msg.sender) revert CannotDelegateToSelf();
        if (amount == 0) revert AmountMustBeGreaterThanZero();
    }

    function _checkDelegationBalance(address delegator, uint256 amount) private view {
        uint256 balance = balanceOf(delegator);
        uint256 totalDelegated = _totalDelegatedByAddress[delegator];
        if (balance < amount + totalDelegated) {
            revert InsufficientBalanceForDelegation(balance, totalDelegated, amount);
        }
    }

    function _updateDelegation(address delegator, address delegatee, uint256 amount) private {
        DelegationInfo storage info = _delegationInfo[delegator][delegatee];
        bool isNewDelegation = info.amount == 0;
        if (isNewDelegation) {
            uint32 delegatorIndex = uint32(_delegatorsForDelegatee[delegatee].length);
            _delegatorsForDelegatee[delegatee].push(delegator);
            _delegateesForDelegator[delegator].push(delegatee);
            info.index = delegatorIndex;
            info.amount = uint224(amount);
        } else {
            info.amount = uint224(uint256(info.amount) + amount);
        }
        _totalDelegatedByAddress[delegator] += amount;
        _totalDelegatedToAddress[delegatee] += amount;
    }
    
    /**
     * @dev Withdraws delegation from an address with optimized gas usage
     * @param delegatee Address to withdraw delegation from
     * @param amount Amount of tokens to withdraw
     */
    function withdrawDelegation(address delegatee, uint256 amount) external {
        // Input validation
        if (delegatee == address(0)) revert ZeroAddress();
        if (amount == 0) revert AmountMustBeGreaterThanZero();
        
        // Get current delegation info
        DelegationInfo storage info = _delegationInfo[msg.sender][delegatee];
        uint256 delegatedAmount = info.amount;
        if (delegatedAmount == 0) revert DelegationDoesNotExist();
        if (delegatedAmount < amount) revert InsufficientDelegatedAmount(delegatedAmount, amount);
        
        // Update delegation amounts
        if (delegatedAmount == amount) {
            // Complete withdrawal - remove the delegation relationship
            _removeDelegationRelationship(msg.sender, delegatee, info.index);
            delete _delegationInfo[msg.sender][delegatee];
        } else {
            // Partial withdrawal - update the amount
            info.amount = uint224(delegatedAmount - amount);
        }
        
        // Update totals
        _totalDelegatedByAddress[msg.sender] -= amount;
        _totalDelegatedToAddress[delegatee] -= amount;
        
        emit DelegationWithdrawn(msg.sender, delegatee, amount);
    }
    
    /**
     * @dev Gets the amount of tokens delegated from one address to another
     * @param delegator Address that delegated tokens
     * @param delegatee Address that received delegation
     * @return amount The amount of delegated tokens
     */
    function getDelegatedAmount(address delegator, address delegatee) external view returns (uint256) {
        return _delegationInfo[delegator][delegatee].amount;
    }
    
    /**
     * @dev Internal helper to remove a delegation relationship
     * @param delegator The address that delegated tokens
     * @param delegatee The address that received the delegation
     * @param delegatorIndex The index of the delegator in the delegatee's list
     */
    function _removeDelegationRelationship(address delegator, address delegatee, uint32 delegatorIndex) internal {
        // Remove delegator from delegatee's list using the stored index for O(1) removal
        uint256 lastIndex = _delegatorsForDelegatee[delegatee].length - 1;
        if (delegatorIndex != lastIndex) {
            address lastDelegator = _delegatorsForDelegatee[delegatee][lastIndex];
            _delegatorsForDelegatee[delegatee][delegatorIndex] = lastDelegator;
            // Update the index for the moved delegator
            _delegationInfo[lastDelegator][delegatee].index = delegatorIndex;
        }
        _delegatorsForDelegatee[delegatee].pop();
        
        // Remove delegatee from delegator's list - need to find the index first
        for (uint256 i = 0; i < _delegateesForDelegator[delegator].length; i++) {
            if (_delegateesForDelegator[delegator][i] == delegatee) {
                lastIndex = _delegateesForDelegator[delegator].length - 1;
                if (i != lastIndex) {
                    _delegateesForDelegator[delegator][i] = _delegateesForDelegator[delegator][lastIndex];
                }
                _delegateesForDelegator[delegator].pop();
                break;
            }
        }
    }
    
    /**
     * @dev Gets the total amount of tokens delegated by an address
     * @param delegator Address that delegated tokens
     * @return amount The total amount of delegated tokens
     */
    function getTotalDelegatedAmount(address delegator) external view returns (uint256) {
        return _totalDelegatedByAddress[delegator];
    }
    
    /**
     * @dev Gets the total amount of tokens delegated to an address
     * @param delegatee Address that received delegation
     * @return amount The total amount of tokens delegated to the address
     */
    function getTotalDelegatedToAmount(address delegatee) external view returns (uint256) {
        return _totalDelegatedToAddress[delegatee];
    }
    
    /**
     * @dev Gets the addresses that have delegated tokens to an address
     * @param delegatee Address to check
     * @return delegators The addresses that have delegated tokens to the address
     */
    function getDelegators(address delegatee) external view returns (address[] memory) {
        return _delegatorsForDelegatee[delegatee];
    }
    
    /**
     * @dev Gets the addresses that an address has delegated tokens to
     * @param delegator Address to check
     * @return delegatees The addresses that the address has delegated tokens to
     */
    function getDelegatees(address delegator) external view returns (address[] memory) {
        return _delegateesForDelegator[delegator];
    }
}