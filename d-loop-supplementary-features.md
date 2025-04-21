This is a comprehensive plan to access the DLOOP project.

Please find the initial code base here: https://github.com/janteras/smart-contracts1.0.git

Phase 1. Architecture and analysis. During this phase modifications to the contacts (.sol files )
are disallowed, rather indepth tests are required to i) assess the viability of the contract code,
test files deployment scripts etc… ii) document the architecture iii) conduct a development plan

Phase 2. Once the above is fully understood and thorough testing and analysis has been done
using a variety of web3 testing tools, we analysis additional requirements, and create a
comprehensive end-to-end plan including architecture and functional specs

a)  DLOOP Asset Governance Rewards (see below)
b)  Protocol DAO (see below)
c)  Asset DAO Fees (See below)
d)  Hedera Testnet Support for dual Ethereum Sepolia and Hedera Testnet
e)  Differentiating AI Governance Nodes from Regular Users in DLOOP

Phase 2 In this phase we will implement the following requirements

i) fix the current code base
ii) implement the phase ii requirements
iii) test thoroughly against functional specs
iv) hardhat and other web3 smart contact tests

A.  DLOOP Asset Governance Rewards

DLOOP Asset Governance Rewards Overview

1.  Purpose: Users are rewarded with DLOOP tokens for making good governance

decisions (Invest/Divest) on assets.

2.  Reward Conditions:

○

Invest Yes Vote: If the asset price increases within a deﬁned time period,
the user is rewarded.

○

Invest No Vote: If the asset price decreases within a deﬁned time period,
the user is rewarded (for avoiding loss).

○  Divest No Vote: If the asset price increases within a deﬁned time period,

the user is rewarded (for preserving proﬁt).

○  Divest Yes Vote: If the asset price decreases within a deﬁned time period,

the user is rewarded (for avoiding loss).

○  No Change: If the asset price remains the same, no rewards are issued.

3.  Token Distribution:

○  Total supply of  DLOOP tokens: 100 million.
○  Asset Governance rewards pool: 20,016,000 DLOOP (20.016% of total

supply).

○  Distribution period: 2160 days (~6 years).
○  Linear distribution: 278,000 DLOOP tokens every 30 days.

Examples with ETH, LINK, and WBTC

Scenario 1: Invest Yes Vote on ETH

●  User Action: Votes "Yes" to invest in ETH.
●  Outcome: ETH price increases by 10% within the deﬁned time period.
●  Result: User is rewarded with DLOOP tokens for making a proﬁtable decision.

Scenario 2: Invest No Vote on LINK

●  User Action: Votes "No" to invest in LINK.
●  Outcome: LINK price decreases by 15% within the deﬁned time period.
●  Result: User is rewarded with DLOOP tokens for avoiding a loss.

Scenario 3: Divest No Vote on WBTC

●  User Action: Votes "No" to divest from WBTC.
●  Outcome: WBTC price increases by 5% within the deﬁned time period.
●  Result: User is rewarded with DLOOP tokens for preserving proﬁt.

Scenario 4: Divest Yes Vote on ETH

●  User Action: Votes "Yes" to divest from ETH.
●  Outcome: ETH price decreases by 8% within the deﬁned time period.
●  Result: User is rewarded with DLOOP tokens for avoiding further loss.

Scenario 5: No Change in Price

●  User Action: Votes "Yes" to invest in LINK.

●  Outcome: LINK price remains the same within the deﬁned time period.
●  Result: No rewards are issued.

If more gas eﬃcient, we calculate the rewards monthly instead of every 30 days in the
solidity implementation. This is an example only.

Sample code

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DLOOPGovernanceRewards {
    // State variables
    uint256 public constant TOTAL_REWARDS = 20_016_000 * 1e18; // Total rewards in DLOOP
(with 18 decimals)
    uint256 public constant MONTHLY_REWARDS = 278_000 * 1e18; // Monthly rewards in
DLOOP
    uint256 public constant DISTRIBUTION_PERIOD = 2160 days; // Total distribution period
    uint256 public startTime; // Timestamp when distribution starts
    uint256 public currentMonth; // Current month of distribution

    // Track correct decisions for each user
    mapping(address => uint256) public userCorrectDecisions;
    uint256 public totalCorrectDecisions; // Total correct decisions in the current month

    // Events
    event RewardsDistributed(address indexed user, uint256 amount);
    event DecisionRecorded(address indexed user, bool isCorrect);

    // Constructor
    constructor() {
        startTime = block.timestamp;
        currentMonth = 0;
    }

    // Modifier to ensure monthly distribution
    modifier onlyAfterMonthEnd() {
        require(block.timestamp >= startTime + (currentMonth + 1) * 30 days, "Distribution not yet
due");
        _;
    }

    // Function to record a user's correct decision
    function recordDecision(address user, bool isCorrect) external {
        if (isCorrect) {
            userCorrectDecisions[user]++;
            totalCorrectDecisions++;
        }
        emit DecisionRecorded(user, isCorrect);
    }

    // Function to distribute rewards for the current month
    function distributeRewards() external onlyAfterMonthEnd {
        require(totalCorrectDecisions > 0, "No correct decisions this month");

        // Calculate rewards for each user
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 userReward = (userCorrectDecisions[user] * MONTHLY_REWARDS) /
totalCorrectDecisions;

            // Transfer rewards (assuming DLOOP tokens are ERC-20)
            require(IERC20(dloopToken).transfer(user, userReward), "Transfer failed");
            emit RewardsDistributed(user, userReward);

            // Reset user's correct decisions for the next month
            userCorrectDecisions[user] = 0;
        }

        // Reset total correct decisions for the next month
        totalCorrectDecisions = 0;

        // Increment the current month
        currentMonth++;
    }

    // Helper function to get the list of users (to be implemented)
    function getUsers() internal view returns (address[] memory) {
        // Return the list of users who made decisions this month
        // This can be implemented using an array or a more efficient data structure
    }
}

// Minimal ERC-20 interface for DLOOP token
interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);

}

B. ProtocolDAO

ProtocolDAO Minimalist Design

Core Principles

1.  Lightweight: Only essential functions (no complex storage patterns).
2.  AI-Optimized: Shorter voting for AI nodes, longer for humans.
3.  AssetDAO-Centric: ProtocolDAO only handles upgrades/parameters, not assets.

Key Borrowed Concepts & Simpliﬁcations

From
Governance.sol

Proposal struct

Adaptation for ProtocolDAO

Rationale

Keep but remove executer (use ﬁxed
Governance contract)

Simpler
execution

submitProposal()  Only allow whitelisted contracts (e.g.,

UpgradeExecutor)

Prevents
arbitrary calls

voteProposal()

AI nodes auto-vote if human quorum isn’t met
in 24h

Faster decisions

executeProposal()  Remove admin toggle (use onlyGovernance

More secure

modiﬁer)

Example code

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProtocolDAO {
    // Whitelisted executer contracts (e.g., UpgradeExecutor, ParameterAdjuster)
    mapping(address => bool) public whitelistedExecuters;

    struct Proposal {

        address submitter;
        address executer;  // Target contract for execution
        uint128 yes;
        uint128 no;
        uint64 expires;
        uint64 timelockEnd;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;

    event ProposalCreated(uint256 id, address executer);
    event ProposalExecuted(uint256 id, address executer);

    // Admin adds/removes executers (governance-controlled)
    function updateExecuter(address executer, bool isWhitelisted) external onlyGovernance {
        whitelistedExecuters[executer] = isWhitelisted;
    }

    function submitProposal(address executer) external {
        require(whitelistedExecuters[executer], "Invalid executer");

        proposals[proposalCount] = Proposal({
            submitter: msg.sender,
            executer: executer,
            yes: 0,
            no: 0,
            expires: block.timestamp + getVotingPeriod(msg.sender),
            timelockEnd: block.timestamp + getVotingPeriod(msg.sender) + 24 hours,
            executed: false
        });
        emit ProposalCreated(proposalCount++, executer);
    }

    function executeProposal(uint256 id) external {
        Proposal storage p = proposals[id];
        require(!p.executed, "Executed");
        require(block.timestamp > p.timelockEnd, "Timelock active");
        require(p.yes > p.no && p.yes >= getQuorum(p.expires), "Not passed");

        (bool success, ) = p.executer.call(abi.encodeWithSignature("execute()"));
        require(success, "Execution failed");
        p.executed = true;

        emit ProposalExecuted(id, p.executer);
    }

    // Flexible quorum (40% for AI-fast-track, 30% for standard)
    function getQuorum(uint64 expiry) public view returns (uint256) {
        return (expiry - block.timestamp) <= 1 days ? 40 : 30;
    }

    // Shorter voting for AI nodes (detected via submitter address)
    function getVotingPeriod(address submitter) internal pure returns (uint64) {
        return isAI(submitter) ? 1 days : 7 days;
    }

    function isAI(address submitter) internal pure returns (bool) {
        // Implement AI whitelist logic (e.g., EOA list or NFT-based)
        return submitter == address(0x123...);
    }
}

Why This Works for D-Loop

1.  Decentralized Execution:

○  Anyone can trigger execution of passed proposals, reducing reliance on a

central team.

○  Executer contracts are whitelisted and audited (e.g., only

upgrade/parameter contracts).

2.  AI/Human Flexibility:

○  AI nodes get faster votes (1 day) but higher quorum (40%).
○  Humans get standard votes (7 days, 30% quorum).

3.  Safety:

○  24-hour timelock prevents rushed malicious actions.
○  Executer contracts are limited to speciﬁc actions (e.g., no direct fund

transfers).

 Executer Contracts

1.  UpgradeExecuter.sol:

○  Upgrades proxy contracts via upgradeTo().

2.  ParameterAdjuster.sol:

○  Modiﬁes fees/quorums in AssetDAO.

3.  EmergencyPauser.sol:

○  Halts system during attacks (e.g., oracle failure).

1. Executer Contracts

UpgradeExecuter.sol

Example code

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";

contract UpgradeExecuter {
    address public immutable proxyAddress;

    constructor(address _proxy) {
        proxyAddress = _proxy;
    }

    function execute() external {
        // Only allow upgrades to pre-audited implementations
        ERC1967Upgrade.upgradeToAndCall(
            proxyAddress,
            address(0xNEW_IMPL),
            abi.encodeWithSignature("initialize()")
        );
    }
}

Purpose:

●  Upgrades proxy contracts (e.g., AssetDAO) to new implementations.
●  Whitelist Requirement: Only callable by ProtocolDAO with a 24h timelock.

ParameterAdjuster.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ParameterAdjuster {
    address public immutable assetDAO;

    constructor(address _assetDAO) {
        assetDAO = _assetDAO;
    }

    function execute() external {
        IAssetDAO(assetDAO).setParameters(
            0.1e18, // newInvestFee (10%)
            0.05e18, // newDivestFee (5%)
            0.3e18   // newRagequitFee (30%)
        );
    }
}

Purpose:

●  Adjusts AssetDAO fees/parameters via governance votes.
●  Safety: Parameter ranges enforced in AssetDAO.sol.

EmergencyPauser.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EmergencyPauser {
    address public immutable assetDAO;

    constructor(address _assetDAO) {
        assetDAO = _assetDAO;
    }

    function execute() external {
        IAssetDAO(assetDAO).toggleEmergencyPause(true);

    }
}

Purpose:

●  Pauses AssetDAO during oracle failures/hacks.
●  Bypasses Timelock: Add onlyEmergencyRole modiﬁer if needed.

# ProtocolDAO System Architecture

## Overview
The ProtocolDAO coordinates upgrades and parameter changes via **decentralized
execution**:
1. **Proposal Creation**: Users submit proposals with a pre-audited `executer` contract.
2. **Voting**: AI/humans vote (1-7 days, dynamic quorum).
3. **Execution**: Anyone triggers the `executer` after approval.

## Contracts
| Contract               | Purpose                          | Controlled Parameters          |
|------------------------|----------------------------------|--------------------------------|
| `ProtocolDAO.sol`      | Proposal voting/execution        | Quorum, timelock, executers    |
| `UpgradeExecuter.sol`  | Upgrade proxy implementations    | Proxy address, new logic       |
| `ParameterAdjuster.sol`| Adjust AssetDAO fees             | Invest/divest/ragequit fees    |
| `EmergencyPauser.sol`  | Emergency system pauses          | N/A (instant execution)        |

## Workflow
```mermaid
sequenceDiagram
    participant User
    participant ProtocolDAO
    participant Executer
    participant AssetDAO

    User->>ProtocolDAO: submitProposal(executer)
    ProtocolDAO->>ProtocolDAO: Start vote (1-7 days)
    AI/Humans->>ProtocolDAO: Vote
    ProtocolDAO->>ProtocolDAO: Check quorum
    User->>Executer: executeProposal()
    Executer->>AssetDAO: Upgrade/Adjust/Pause

C Asset DAO Fees

Developers' Fees

A percentage of transaction value funds ongoing platform development through these
mechanisms:

Action

Fee Structure

Funds Source

Add Asset Proposal

0.1% of minted DLOOP (min
10, max 100)

Tokens minted for proposer

Remove Asset Proposal

0.1% of redeemed DLOOP

Tokens burned during
redemption

Proposal Execution

0.05% of affected assets

Treasury reserves

Ragequit

0.3% (0.1% during
emergencies)

Withdrawn asset value

Governance Control:

Fees are adjustable via proposals, allowing votes to:

●  Modify rates (±0.05% per epoch)
●  Temporarily reduce/waive fees (e.g., during volatility)
●  Redirect funds (e.g., 50% treasury / 30% voters / 20% burns)

E Differentiating AI Governance Nodes from Regular Users in DLOOP

Since AI nodes have different governance privileges (e.g., faster voting periods, higher
quorum requirements), the smart contracts must reliably distinguish them from regular
users. Below is the suggested mechanism to use

1. NFT-Based AI Node Identiﬁcation

Mechanism:

●  AI nodes are assigned a non-transferable NFT (e.g., AIGovernanceNFT.sol).
●  The ProtocolDAO and AssetDAO checks for NFT ownership to grant AI privileges.

1. Decentralized AI Node NFT Factory

Concept:

●  A dedicated AINodeFactory.sol contract mints soulbound NFTs

(non-transferable) to AI nodes.

●  Governed by a multisig or DAO vote (not ProtocolDAO directly).
●  Other contracts (ProtocolDAO, AssetDAO) check NFT ownership for privileges.

This is an Example only to be improved upon

// SPDX-License-Identiﬁer: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract AINodeNFT is ERC721 {

    address public factory;

    uint256 public nextTokenId;

    constructor() ERC721("AI Governance Node", "AI-NFT") {

        factory = msg.sender; // Deployed by AINodeFactory

    }

    // Only the factory can mint (called after governance approval)

    function mint(address aiNode) external {

        require(msg.sender == factory, "Only Factory");

        _safeMint(aiNode, nextTokenId++);

    }

    // Override transfers to make NFTs soulbound (non-transferable)

    function _transfer(address, address, uint256) internal pure override {

        revert("AI NFTs are non-transferable");

    }

}

contract AINodeFactory {

    AINodeNFT public immutable aiNFT;

    address public governance;

    constructor(address _governance) {

        governance = _governance;

        aiNFT = new AINodeNFT();

    }

    // Governance (multisig/DAO) proposes new AI nodes

    function mintAINode(address aiNode) external {

        require(msg.sender == governance, "Only Governance");

        aiNFT.mint(aiNode);

    }

}

2. How Contracts Check AI Status

Both ProtocolDAO and AssetDAO can check NFT ownership without modiﬁcation by
querying the AINodeNFT contract:

// In ProtocolDAO.sol (no changes to governance logic)

function getVotingPeriod(address voter) external view returns (uint64) {

    return aiNFT.balanceOf(voter) > 0 ? 1 days : 7 days; // AI: 1 day, Human: 7 days

}

// In AssetDAO.sol (for higher quorums)

function getQuorum(address voter) external view returns (uint256) {

    return aiNFT.balanceOf(voter) > 0 ? 40 : 30; // AI: 40%, Human: 30%

}

3. Key Advantages

1.  ProtocolDAO Remains Unchanged

○  No minting logic or governance overhead.
○  Simply reads from the AINodeNFT contract.

2.  Cross-DAO Compatibility

○  AssetDAO, ProtocolDAO, and future contracts reuse the same NFT for

permissions.

3.  Decentralized & Secure

○  Soulbound NFTs prevent privilege resale.
○  Factory contract can be upgraded/governed separately.

4.  Flexible Privileges

○  Add new AI perks (e.g., fee discounts) by checking aiNFT.balanceOf().

4. Workﬂow Example

1.  Governance Approves AI Node

○  Multisig/DAO calls AINodeFactory.mintAINode(aiAddress).

2.  NFT is Minted

○  AINodeNFT assigns a non-transferable NFT to the AI node.

3.  ProtocolDAO/AssetDAO Apply Privileges

○  Contracts check aiNFT.balanceOf(aiAddress) for:
■  Shorter voting periods (ProtocolDAO).
■  Higher quorums (AssetDAO).