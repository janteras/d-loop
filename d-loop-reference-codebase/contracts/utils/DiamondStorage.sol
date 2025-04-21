// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DiamondStorage
 * @dev Library providing structured storage patterns for the DLOOP protocol.
 *      Based on the Diamond Storage pattern for upgradeable contracts.
 */
library DiamondStorage {
    
    // Governance storage location
    bytes32 constant GOVERNANCE_STORAGE_POSITION = keccak256("DLOOP.Governance.Storage");
    
    // Treasury storage location
    bytes32 constant TREASURY_STORAGE_POSITION = keccak256("DLOOP.Treasury.Storage");
    
    // Fee operation types
    enum FeeOperationType { INVEST, DIVEST, RAGEQUIT }
    
    // Fee Event structure - Moved outside of FeeStorage for proper compilation
    struct FeeEvent {
        address user;
        FeeOperationType operationType;
        uint256 amount;
        uint256 feeAmount;
        uint256 timestamp;
    }
    
    // Fee System Storage - Phase 2
    struct FeeStorage {
        // Fee rates (in basis points, 100 = 1%)
        mapping(FeeOperationType => uint256) feeRates; // Fee rates by operation type
        
        // Fee collection tracking
        uint256 totalFeesCollected;               // Lifetime fees collected
        mapping(address => uint256) feesPaidByUser; // Fees paid by user
        
        // Fee distribution
        address treasury;                  // Treasury address for fee distribution
        address rewardDistributor;         // Reward distributor address

        // Fee distribution ratios (in basis points)
        uint256 treasuryShare;             // Treasury's share of fees (7000 = 70%)
        uint256 rewardDistributorShare;    // RewardDistributor's share (3000 = 30%)
        
        // Fee history
        FeeEvent[] feeHistory;
    }
    
    // Governance Storage Structure
    struct GovernanceStorage {
        // Token settings
        address tokenAddress;  // D-AI token address
        uint256 votingDelay;   // Delay before voting starts (in blocks)
        uint256 votingPeriod;  // Duration of voting (in blocks)
        uint256 proposalThreshold; // Min tokens to propose
        
        // Proposal tracking
        mapping(uint256 => Proposal) proposals;
        uint256 proposalCount;
        
        // Timelock
        uint256 timelockDelay; // Delay before execution (in seconds)
        
        // Integration points
        address assetDAOController;  // For coordinating with AssetDAOs
        address upgradeExecutor;     // For executing upgrades
        
        // AI Node identification - Phase 2
        bool aiNodeVotingEnabled;    // Flag to enable/disable AI node specific voting
        address aiNodeRegistry;      // Registry of authorized AI nodes
        uint256 aiVotingPeriod;      // Special voting period for AI nodes (1 day vs 7 days)
    }
    
    // Proposal Structure
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool canceled;
        bool isAIVoting;          // Whether this is an AI node voting proposal
        mapping(address => Receipt) receipts;
        
        // Execution data
        address[] targets;
        uint256[] values;
        string[] signatures;
        bytes[] calldatas;
        
        // Queuing timestamp for timelock
        uint256 eta;
    }
    
    // Vote Receipt
    struct Receipt {
        bool hasVoted;
        bool support;
        uint256 votes;
    }
    
    /**
     * @dev Returns the governance storage.
     */
    function governanceStorage() internal pure returns (GovernanceStorage storage gs) {
        bytes32 position = GOVERNANCE_STORAGE_POSITION;
        assembly {
            gs.slot := position
        }
    }
    
    // Fee storage location
    bytes32 constant FEE_STORAGE_POSITION = keccak256("DLOOP.Fee.Storage");
    
    /**
     * @dev Returns the fee system storage.
     */
    function feeStorage() internal pure returns (FeeStorage storage fs) {
        bytes32 position = FEE_STORAGE_POSITION;
        assembly {
            fs.slot := position
        }
    }
    
    // Treasury storage
    struct TreasuryStorage {
        // Asset tracking
        mapping(address => uint256) tokenBalances;  // Token address => balance
        address[] supportedTokens;                 // List of supported tokens
        
        // Access control
        address governance;             // Governance contract address
        mapping(address => bool) whitelistedSpenders; // Authorized spenders
        
        // Treasury activity history
        TreasuryAction[] actionHistory;
        
        // Fee distribution - Phase 2
        uint256 feeReserve;              // Portion of fees held for future distribution
        mapping(address => uint256) pendingRewardsByAddress; // Rewards pending distribution
    }
    
    // Treasury action types
    enum ActionType { DEPOSIT, WITHDRAW, ALLOCATE }
    
    // Treasury action record
    struct TreasuryAction {
        ActionType actionType;
        address token;
        uint256 amount;
        address initiator;
        uint256 timestamp;
        string description;
    }
    
    /**
     * @dev Returns the treasury storage.
     */
    function treasuryStorage() internal pure returns (TreasuryStorage storage ts) {
        bytes32 position = TREASURY_STORAGE_POSITION;
        assembly {
            ts.slot := position
        }
    }
}