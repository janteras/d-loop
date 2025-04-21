// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./AssetDAO.sol";

/**
 * @title DAOIntegrator
 * @dev Integrates Protocol DAO and Asset DAO, allowing governance decisions to affect Asset DAO
 */
contract DAOIntegrator is AccessControl, Pausable, Initializable {
    bytes32 public constant PROTOCOL_DAO_ROLE = keccak256("PROTOCOL_DAO_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Associated contracts
    AssetDAO public assetDAO;
    
    // Execution tracking
    mapping(bytes32 => bool) public executedActions;
    
    // Action types for Asset DAO
    enum ActionType {
        None,
        UpdateParameters,
        UpdateAssetWeight,
        TogglePause
    }
    
    // Events
    event ActionExecuted(bytes32 indexed actionId, ActionType actionType);
    event AssetDAOUpdated(address indexed newAssetDAO);
    
    /**
     * @dev Constructor is disabled in favor of initialize for upgradeable contracts
     */
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initializes the contract with initial roles and parameters
     * @param admin Admin address
     * @param protocolDAO Protocol DAO address
     * @param _assetDAO Asset DAO address
     */
    function initialize(
        address admin,
        address protocolDAO,
        address _assetDAO
    ) external initializer {
        require(admin != address(0), "DAOIntegrator: admin is zero address");
        require(protocolDAO != address(0), "DAOIntegrator: protocol DAO is zero address");
        require(_assetDAO != address(0), "DAOIntegrator: asset DAO is zero address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROTOCOL_DAO_ROLE, protocolDAO);
        _grantRole(GOVERNANCE_ROLE, admin);
        
        assetDAO = AssetDAO(_assetDAO);
    }
    
    /**
     * @dev Executes an action on the Asset DAO based on Protocol DAO decision
     * @param actionType Type of action to execute
     * @param data ABI-encoded parameters for the action
     * @return success Whether the action was executed successfully
     */
    function executeAction(
        ActionType actionType,
        bytes calldata data
    ) external onlyRole(PROTOCOL_DAO_ROLE) whenNotPaused returns (bool success) {
        // Generate a unique action ID
        bytes32 actionId = keccak256(abi.encodePacked(actionType, data, block.timestamp, msg.sender));
        
        // Ensure action hasn't been executed before
        require(!executedActions[actionId], "DAOIntegrator: action already executed");
        
        // Execute the action based on type
        if (actionType == ActionType.UpdateParameters) {
            (uint256 newQuorum, uint256 newVotingPeriod, uint256 newExecutionDelay) = 
                abi.decode(data, (uint256, uint256, uint256));
            
            assetDAO.updateParameters(newQuorum, newVotingPeriod, newExecutionDelay);
        } else if (actionType == ActionType.UpdateAssetWeight) {
            (address asset, uint256 newWeight) = abi.decode(data, (address, uint256));
            
            assetDAO.updateAssetWeight(asset, newWeight);
        } else if (actionType == ActionType.TogglePause) {
            (bool paused) = abi.decode(data, (bool));
            
            assetDAO.togglePause(paused);
        } else {
            revert("DAOIntegrator: invalid action type");
        }
        
        // Mark action as executed
        executedActions[actionId] = true;
        
        emit ActionExecuted(actionId, actionType);
        
        return true;
    }
    
    /**
     * @dev Updates the Asset DAO address
     * @param newAssetDAO New Asset DAO address
     */
    function updateAssetDAO(address newAssetDAO) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAssetDAO != address(0), "DAOIntegrator: new asset DAO is zero address");
        
        assetDAO = AssetDAO(newAssetDAO);
        
        emit AssetDAOUpdated(newAssetDAO);
    }
    
    /**
     * @dev Pauses the integrator
     */
    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses the integrator
     */
    function unpause() external onlyRole(GOVERNANCE_ROLE) {
        _unpause();
    }
}