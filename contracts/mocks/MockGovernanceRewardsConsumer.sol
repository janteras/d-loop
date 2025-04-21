// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./base/BaseMock.sol";
import "../../contracts/interfaces/governance/IGovernanceRewards.sol";

/**
 * @title MockGovernanceRewardsConsumer
 * @dev Mock consumer contract that interacts with GovernanceRewards
 * @notice This contract simulates a consumer of the GovernanceRewards interface
 * to test backward compatibility
 */
contract MockGovernanceRewardsConsumer is BaseMock {
    // The GovernanceRewards contract this consumer interacts with
    IGovernanceRewards public governanceRewards;
    
    // Events
    event RewardsDistributed(address[] recipients, uint256[] amounts);
    event RewardsClaimed(address user, uint256 amount);
    
    /**
     * @dev Constructor
     * @param _governanceRewards Address of the GovernanceRewards contract
     */
    constructor(address _governanceRewards) BaseMock() {
        governanceRewards = IGovernanceRewards(_governanceRewards);
    }
    
    /**
     * @dev Distributes rewards to participants through the GovernanceRewards contract
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     */
    function distributeRewardsToParticipants(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        _recordFunctionCall(
            "distributeRewardsToParticipants",
            abi.encode(recipients, amounts)
        );
        
        // Try to call the distributeRewards function with the expected signature
        // This simulates how a consumer would have called the previous version
        try governanceRewards.distributeRewards(recipients, amounts) {
            emit RewardsDistributed(recipients, amounts);
        } catch {
            // If the above fails, try the newer signature
            try governanceRewards.distributeRewards(
                1, // proposalId
                recipients,
                amounts,
                "Rewards distributed by consumer"
            ) {
                emit RewardsDistributed(recipients, amounts);
            } catch Error(string memory reason) {
                revert(string(abi.encodePacked("GovernanceRewards call failed: ", reason)));
            } catch {
                revert("GovernanceRewards call failed with unknown error");
            }
        }
    }
    
    /**
     * @dev Claims rewards for a user through the GovernanceRewards contract
     * @param user Address of the user to claim rewards for
     */
    function claimRewardsForUser(address user) external {
        _recordFunctionCall(
            "claimRewardsForUser",
            abi.encode(user)
        );
        
        // This would typically be called by the user directly,
        // but for testing we simulate it through this consumer
        
        // Store the current balance to calculate rewards received
        uint256 balanceBefore = IERC20(governanceRewards.rewardToken()).balanceOf(user);
        
        // Try to call the claimRewards function
        try governanceRewards.claimRewards() {
            uint256 balanceAfter = IERC20(governanceRewards.rewardToken()).balanceOf(user);
            uint256 amountClaimed = balanceAfter - balanceBefore;
            
            emit RewardsClaimed(user, amountClaimed);
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("ClaimRewards call failed: ", reason)));
        } catch {
            revert("ClaimRewards call failed with unknown error");
        }
    }
    
    /**
     * @dev Updates the GovernanceRewards contract address
     * @param _newGovernanceRewards New GovernanceRewards contract address
     */
    function updateGovernanceRewards(address _newGovernanceRewards) external {
        _recordFunctionCall(
            "updateGovernanceRewards",
            abi.encode(_newGovernanceRewards)
        );
        
        governanceRewards = IGovernanceRewards(_newGovernanceRewards);
    }
}

/**
 * @dev Minimal IERC20 interface needed for the consumer
 */
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}
