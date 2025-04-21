// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../../contracts/interfaces/governance/IGovernanceRewards.sol";

/**
 * @title MockGovernanceRewardsStateMigrator
 * @dev Mock contract for migrating state between different versions of GovernanceRewards
 * @notice This contract simulates a state migration tool for testing backward compatibility
 */
contract MockGovernanceRewardsStateMigrator is BaseMock {
    // The source (previous version) GovernanceRewards contract
    IGovernanceRewards public sourceGovernanceRewards;
    
    // The target (current version) GovernanceRewards contract
    IGovernanceRewards public targetGovernanceRewards;
    
    // Events
    event StateMigrated(address user, uint256 rewardsAmount);
    event MigrationFailed(address user, string reason);
    
    /**
     * @dev Constructor
     * @param _sourceGovernanceRewards Address of the source (previous) GovernanceRewards contract
     * @param _targetGovernanceRewards Address of the target (current) GovernanceRewards contract
     */
    constructor(
        address _sourceGovernanceRewards,
        address _targetGovernanceRewards
    ) BaseMock() {
        sourceGovernanceRewards = IGovernanceRewards(_sourceGovernanceRewards);
        targetGovernanceRewards = IGovernanceRewards(_targetGovernanceRewards);
    }
    
    /**
     * @dev Migrates state for a specific user from source to target contract
     * @param user Address of the user to migrate state for
     * @return success Whether the migration was successful
     */
    function migrateState(address user) external returns (bool success) {
        _recordFunctionCall(
            "migrateState",
            abi.encode(user)
        );
        
        // This is a simplified mock implementation that simulates state migration
        // In a real migration, we would:
        // 1. Read state from the source contract
        // 2. Write state to the target contract
        // 3. Validate the migration
        
        try this.simulateMigration(user) {
            emit StateMigrated(user, 0); // Amount is not known in this mock
            return true;
        } catch Error(string memory reason) {
            emit MigrationFailed(user, reason);
            return false;
        } catch {
            emit MigrationFailed(user, "Unknown error during migration");
            return false;
        }
    }
    
    /**
     * @dev Migrates state for multiple users from source to target contract
     * @param users Array of user addresses to migrate state for
     * @return successCount Number of successful migrations
     */
    function migrateMultipleStates(address[] calldata users) external returns (uint256 successCount) {
        _recordFunctionCall(
            "migrateMultipleStates",
            abi.encode(users)
        );
        
        for (uint256 i = 0; i < users.length; i++) {
            bool success = this.migrateState(users[i]);
            if (success) {
                successCount++;
            }
        }
        
        return successCount;
    }
    
    /**
     * @dev Internal function to simulate the actual migration logic
     * @param user Address of the user to migrate state for
     */
    function simulateMigration(address user) external view {
        // This function simulates the actual migration logic
        // It's separate to allow for try/catch in the migrateState function
        
        // Check if the source contract has the expected state
        if (sourceGovernanceRewards.totalRewardsEarned(user) < 0) revert("Source state invalid");
        
        // In a real migration, we would now write to the target contract
        // But since this is a mock, we just validate that the target contract exists
        require(
            address(targetGovernanceRewards) != address(0),
            "Target contract is not set"
        );
        
        // Additional validation could be performed here
    }
    
    /**
     * @dev Updates the source GovernanceRewards contract address
     * @param _newSourceGovernanceRewards New source GovernanceRewards contract address
     */
    function updateSourceGovernanceRewards(address _newSourceGovernanceRewards) external {
        _recordFunctionCall(
            "updateSourceGovernanceRewards",
            abi.encode(_newSourceGovernanceRewards)
        );
        
        sourceGovernanceRewards = IGovernanceRewards(_newSourceGovernanceRewards);
    }
    
    /**
     * @dev Updates the target GovernanceRewards contract address
     * @param _newTargetGovernanceRewards New target GovernanceRewards contract address
     */
    function updateTargetGovernanceRewards(address _newTargetGovernanceRewards) external {
        _recordFunctionCall(
            "updateTargetGovernanceRewards",
            abi.encode(_newTargetGovernanceRewards)
        );
        
        targetGovernanceRewards = IGovernanceRewards(_newTargetGovernanceRewards);
    }
}
