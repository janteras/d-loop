// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../utils/Errors.sol";
import "./base/BaseMock.sol";

/**
 * @title MockReentrancyAttacker
 * @dev A contract to test reentrancy protection in Treasury functions
 * @notice This contract follows the standard mock pattern using BaseMock
 */
contract MockReentrancyAttacker is BaseMock {
    address public targetContract;
    bytes public attackData;
    bool public isReentrant;
    uint256 public attackCount;
    uint256 public maxAttacks = 3;
    
    event AttackAttempted(address target, uint256 count);
    event EtherReceived(address sender, uint256 amount);
    
    /**
     * @dev Constructor for MockReentrancyAttacker
     */
    constructor() BaseMock() {
        isReentrant = false;
        attackCount = 0;
    }
    
    /**
     * @dev Sets the target contract and attack data
     * @param _target The contract to attack
     * @param _data The calldata to use for the attack
     */
    function setAttackData(address _target, bytes memory _data) external {
        _recordFunctionCall(
            "setAttackData",
            abi.encode(_target, _data)
        );
        targetContract = _target;
        attackData = _data;
    }
    
    /**
     * @dev Sets whether this contract should attempt reentrancy
     * @param _isReentrant Whether to attempt reentrancy
     */
    function setReentrant(bool _isReentrant) external {
        _recordFunctionCall(
            "setReentrant",
            abi.encode(_isReentrant)
        );
        isReentrant = _isReentrant;
    }
    
    /**
     * @dev Sets the maximum number of attacks to attempt
     * @param _maxAttacks The maximum number of attacks
     */
    function setMaxAttacks(uint256 _maxAttacks) external {
        _recordFunctionCall(
            "setMaxAttacks",
            abi.encode(_maxAttacks)
        );
        maxAttacks = _maxAttacks;
    }
    
    /**
     * @dev Resets the attack counter
     */
    function resetAttackCount() external {
        _recordFunctionCall(
            "resetAttackCount",
            abi.encode()
        );
        attackCount = 0;
    }
    
    /**
     * @dev Executes an attack on the Treasury
     */
    function executeAttack() external {
        _recordFunctionCall(
            "executeAttack",
            abi.encode()
        );
        require(targetContract != address(0), "No target set");
        require(attackData.length > 0, "No attack data set");
        
        // Reset attack counter for a fresh attack
        attackCount = 0;
        
        // Call the target with the attack data
        (bool success, ) = targetContract.call(attackData);
        
        // If the attack failed, emit that it was attempted but unsuccessful
        if (!success) {
            emit AttackAttempted(targetContract, 0);
        }
    }
    
    /**
     * @dev Fallback to receive ETH and potentially attempt reentrancy
     */
    receive() external payable {
        emit EtherReceived(msg.sender, msg.value);
        
        // If we're set to attempt reentrancy and haven't reached max attacks
        if (isReentrant && attackCount < maxAttacks) {
            attackCount++;
            emit AttackAttempted(targetContract, attackCount);
            
            // Try to call the target with our attack data again
            (bool callSuccess, ) = targetContract.call(attackData);
            
            // Ignore result - this is just to see if we can reenter
        }
    }
    
    /**
     * @dev Function to be called by ERC20 token transfers
     * Used to attempt reentrancy on token-based functions
     */
    function onTokenTransfer(address sender, uint256 amount) external {
        _recordFunctionCall(
            "onTokenTransfer",
            abi.encode(sender, amount)
        );
        // If we're set to attempt reentrancy and haven't reached max attacks
        if (isReentrant && attackCount < maxAttacks) {
            attackCount++;
            emit AttackAttempted(targetContract, attackCount);
            
            // Try to call the target with our attack data again
            (bool callSuccess, ) = targetContract.call(attackData);
            
            // Ignore result - this is just to see if we can reenter
        }
    }
    
    /**
     * @dev Helper function to execute a direct call to a target
     * @param _target Address of the target contract
     * @param callData Encoded call data for the function call
     */
    function directCall(address _target, bytes memory callData) external {
        _recordFunctionCall(
            "directCall",
            abi.encode(_target, callData)
        );
        (bool success, ) = targetContract.call(callData);
    }
    
    /**
     * @dev Attempts to perform a reentrancy attack on the target contract
     * @param _target The contract to attack
     * @param _functionSignature The function signature to call recursively (e.g. "executeProposal(uint256)")
     */
    function attemptReentrancy(address _target, string memory _functionSignature) external {
        _recordFunctionCall(
            "attemptReentrancy",
            abi.encode(_target, _functionSignature)
        );
        targetContract = _target;
        isReentrant = true;
        attackCount = 0;
        maxAttacks = 3;
        
        // Generate attack data from function signature
        if (bytes(_functionSignature).length > 0) {
            bytes4 functionSelector = bytes4(keccak256(bytes(_functionSignature)));
            attackData = abi.encodeWithSelector(functionSelector, 1); // Assuming parameter is uint256 proposalId = 1
        }
        
        emit AttackAttempted(_target, 0);
    }
    
    /**
     * @dev Withdraw ERC20 tokens from this contract
     * @param token The token to withdraw
     * @param to The recipient address
     * @param amount The amount to withdraw
     */
    function withdrawToken(address token, address to, uint256 amount) external {
        _recordFunctionCall(
            "withdrawToken",
            abi.encode(token, to, amount)
        );
        IERC20(token).transfer(to, amount);
    }
    
    /**
     * @dev Withdraw ETH from this contract
     * @param to The recipient address
     * @param amount The amount to withdraw
     */
    function withdrawETH(address payable to, uint256 amount) external {
        _recordFunctionCall(
            "withdrawETH",
            abi.encode(to, amount)
        );
        to.transfer(amount);
    }
}