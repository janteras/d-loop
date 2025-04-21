d-loop Whitepaper Pre-release

d-loop DAO | AI-Powered Decentralized Digital Asset Management

Abstract

This whitepaper will show insight into how the d-loop protocol functions on a technical level
while introducing new features unique to the d-loop governance model. We aim to showcase the
d-loop governance model, protocol, its design function and calculus used. We introduce new
concepts and incentive layers for both investors and liquidity providers (LP's).

Disclaimer

All of the information presented in this whitepaper is tentative and is subject to change at any
time. None of the information herein should be construed as legal, accounting, or investment
advice of any kind. This document does not represent a solicitation for investment, nor does it
represent an offering or sale, public or private, of any kind of financial instrument, security or
otherwise, in any jurisdiction. This whitepaper is provided as-is, for informational purposes only,
with the intention to describe d-loop’s prospective protocol and governance model.

Introduction
D-AI Digital Currency
Asset DAO Specifications
Protocol DAO Specifications
D-AI Token and Asset Pool Mechanics
Governance Mechanisms

AI-Driven Governance: The Role of AI Voting Agents
Proposal and Voting Process
Governance Flexibility & Evolution

Delegated Voting: AI and Human Governance

Delegation Options
Key Benefits of Delegated Voting

Asset Addition (Invest) Proposals
Asset Removal (Divest) Proposals
DLOOP Token Rewards System

Reward Conditions
Reward Distribution
DLOOP Cross-Chain Interoperability
Governance Nodes: Technical Overview

Core Functionality
Smart Contracts
AI Architecture
Integration with EigenLayer
Tools and Technologies
D-AI DAO Token Modeling

Portfolio Value and Asset Variations
Investment Nodes and Token Modeling
Governance of the Investment Pool
Decision-Making Process

AI Agents in d-loop Protocol

Governance Nodes
Investment Nodes
Incentives for Deploying AI Agents

Technical Overview of EigenLayer Architecture for AI Agents

Governance Node AI Agents
Investment Nodes
Institutional Participation
Regulatory Compliance
Benefits of Institutional Participation

Exiting the Asset DAO
Governance Proposals
Developers' Fees
Key Management
Tokenomics
Conclusion

4
6
6
7
8
9
9
10
11
11
11
11
12
12
12
13
13
14
15
15
15
16
16
17
17
17
18
19
19
20
20
20
21
21
21
22
23
23
24
24
24
25
27
27
29

Introduction

D-Loop is a decentralized protocol and DAO designed to create and manage D-AI, a fully
collateralized asset-backed currency, through AI-optimized DAO governance.

D-AI operates as both a stable medium of exchange and a TokenShare, granting holders
direct ownership in the collateral pool while enabling seamless transactions.

By integrating AI-powered nodes with decentralized governance, the protocol ensures
continuous stabilization and optimization of D-AI’s underlying asset pool. At its core, D-AI
functions as:

●  A stable medium of exchange, backed 1:1 by transparent reserves (USDC, WBTC,

PAXG)

●  A TokenShare representing direct ownership in the collateral pool
●  A self-governing monetary instrument powered by decentralized decision-making

The protocol achieves this through its unique dual-layer architecture:

1.  AI Automation: Continuous portfolio optimization through AI-powered nodes that

analyze and execute invest/divest proposals

2.  Community Governance: Decentralized voting mechanisms that ensure transparent

oversight and alignment with holder interests

By merging these elements, D-Loop creates a next-generation currency system that maintains
price stability while adapting to market conditions - offering users the confidence of traditional
asset-backed currencies with the innovation of decentralized finance.

Initially, D-Loop will deploy two types of AI-powered nodes:

1.  Governance Nodes – Autonomous agents that propose and vote on asset rebalancing

2.

(invest/divest) to maintain D-AI’s stability and redeemability.
Investment Nodes – Execute real-time portfolio adjustments, ensuring the currency’s
value is always backed 1:1 by transparent reserves.

D-Loop introduces two new assets to the Hedera and Ethereum blockchains:

●  DLOOP – An ERC-223 or HTS governance token used for invest/divest proposals and

other key voting mechanisms within the DAO. DLOOP holders earn merit-based rewards
based on their historical voting performance, incentivizing informed decision-making.

●  D-AI –  The D-Loop Asset Index token, is a stable, redeemable asset-backed

currency that combines the stability of a reserve-backed monetary instrument with the
flexibility of a TokenShare and transactional utility.

The DAO has two main components:

1.  Asset DAO – Responsible for governing investing/divesting decisions

2.  Protocol DAO – Responsible for community-controlled protocol governance

DLOOP token holders are incentivized to delegate their tokens to Governance Nodes, allowing
AI-driven decision-making to optimize asset management within the DAO. This delegation
mechanism helps ensure active participation and efficient governance while rewarding holders
based on their contributions.

Regulated entities can participate in D-Loop’s ecosystem in two ways:

1.  Investment Nodes – Institutions may deposit funds into these AI-powered nodes, which

autonomously execute investment strategies within the DAO.

2.  Direct DAO Participation – Entities can engage directly by submitting invest/divest

proposals, shaping the asset index through decentralized governance.

This structure encourages a seamless integration of AI automation, decentralized governance,
and institutional investment.

The D-Loop protocol functions similarly to a real-world asset index, ensuring stability and
efficiency through its AI-driven governance model. All TokenShares, represented as D-AI
tokens, are fully backed basketcoins, secured by a diversified pool of assets locked as
collateral within the DAO’s treasury. This backing ensures the tangible value of D-AI while
maintaining a transparent and verifiable reserve.

By leveraging AI-powered decision-making, D-Loop optimizes asset pool performance,
dynamically adjusting allocations to maximize returns and reduce risk. The protocol employs

AI-driven rebalancing to maintain D-AI’s stability as a currency, automatically adjusting asset
weights (e.g., USDC, WBTC, PAXG) via invest/divest proposals. This minimizes volatility risks
while preserving capital efficiency and redeemability guarantees..

This AI-governed model bridges the gap between decentralized finance (DeFi) and traditional
asset management, offering an innovative, self-optimizing approach to index-based investing in
the blockchain ecosystem.

D-AI Digital Currency

D-AI is D-Loop’s asset-backed currency – a stable, redeemable digital asset that merges the
reliability of traditional reserve-backed money with the innovation of decentralized finance. Each
D-AI token represents:

●  A Stable Medium of Exchange

○  Fully collateralized 1:1 by transparent reserves (USDC, WBTC, PAXG)
○  Enables seamless, low-volatility transactions

●  A TokenShare with Utility

○  Grants direct ownership in the DAO’s reserve pool
○  Supports three core financial functions:

■  Stable exchanges: Trade with price predictability
■  Volatility hedging: Mitigate crypto market risks
■  Portfolio exposure: Access a dynamically optimized basket of

high-liquidity assets

This dual design ensures D-AI operates as both a practical currency and a capital-efficient
investment vehicle, governed by AI-driven optimization and decentralized voting.

Asset DAO Specifications

D-Loop’s asset pool is governed by a Decentralized Autonomous Organization (DAO),
represented by a smart contract on the Ethereum and Hedera blockchains. The DAO is
responsible for holding the asset pool’s reserves, processing voting proposals, and executing
governance decisions in a fully transparent and autonomous manner.

Bootstrapping Mechanism

The Asset DAO is initialized via a Bootstrapping Proposal, where founding members or AI
Governance Nodes propose the first supported assets (e.g., USDC, WBTC) and mint the initial
D-AI index tokens. This proposal requires

●  A minimum quorum of token holder votes.
●  Price oracle integrations for all proposed assets.
●  Smart contract logic to mint the initial D-AI tokens 1:1 against deposited collateral.

Asset DAO Operations

The Asset DAO maintains an internal price for D-AI tokens, calculated as:

D-AI Price = Total D-AI Tokens Minted /

                    ∑(Supported Asset Quantities×Oracle Prices)

This price is used for:

●  Minting/burning D-AI tokens without oracle dependencies.
●  Auditing reserve balances.

Protocol DAO Specifications

The Protocol DAO is responsible for specific governance decisions around protocol upgrades,
asset support, and platform parameters. It processes voting proposals, executes governance
decisions, and ensures the platform remains adaptable to evolving market conditions.

Key Decisions:

1.  Adding New Assets: Proposing and approving new assets to be supported by the

platform.

2.  Smart Contract Upgrades: Voting on upgrades to improve security, efficiency, or

functionality.

3.  Parameter Adjustments: Modifying platform parameters, such as reward distribution

rates or fee structures.

Key Features

1.  Self-Executing Proposals:

○  Once a proposal passes a quorum of 51%, it is automatically executed by the

smart contract.

○  No manual intervention is required, ensuring transparency and efficiency.

2.  Reduced Feature Set:

○  Focuses on three core decisions:

1.  Adding New Assets: Proposing and approving new assets to be

supported by the platform.

2.  Smart Contract Upgrades: Voting on upgrades to improve security,

efficiency, or functionality.

3.  Parameter Adjustments: Modifying specific platform parameters (e.g.,

reward distribution rates, fee structures).

3.  Reputation-Based Proposals:

○  Anyone can submit a proposal
○  Only high-reputation proposers can submit reward generating proposals
○  Rewards are issued only if the proposal is submitted by a high-reputation

proposer and passes the vote.

4.  Simplified Voting:

○  Voting is binary: YES or NO.
○  Proposals require a quorum and a majority vote to pass.

Proposal Structure

Each proposal includes the following details:

●  Proposed By: The address of the proposer (must have a high reputation score).
●  Details: The address or hash of the proposal details (e.g., smart contract address, asset

details).

●  Description: A brief description of the proposal (e.g., "Add the BASE token").
●  Vote: A binary YES/NO vote.

The Protocol DAO is designed to ensure the platform remains secure, adaptable, and aligned
with community interests. By leveraging AI-operated governance nodes and linear reward
distribution, the DAO encourages active participation by AIs and Community members alike to
ensure active participation and high-quality decision-making.

D-AI Token and Asset Pool Mechanics

D-AI tokens function as both a transactional currency and a store of value, backed 1:1 by the
DAO’s reserve assets. These ERC-223 tokens or HTS tokens in the case of the Hedera
blockchain, are minted only when investment proposals are approved by the DAO.

The smart contract ensures that only the DAO has permission to mint new D-AI tokens,
reinforcing a strict supply-control mechanism.

The asset pool guarantees instant redemptions at par value, enabling holders to exchange
D-AI tokens 1:1 for their share of the reserve assets (USDC, WBTC, PAXG), ensuring stability
akin to traditional currencies.

This mechanism guarantees that D-AI remains fully backed by tangible reserves, ensuring
verifiable value preservation and stability.

Example Calculation:

●  Total D-AI Supply: 1,000 tokens
●  Asset Pool Reserves:

○  10,000 USDC ($10,000)
○  0.5 WBTC ($10,000)
○  5 PAXG ($10,000)
○  Total Pool Value: $30,000

●  D-AI Price per Token: $30

This model ensures strict 1:1 collateralization, eliminating inflationary risks while enabling

transparent, trustless redemptions via the DAO’s smart contracts

Governance Mechanisms

D-Loop employs a decentralized governance model, where DLOOP tokens serve as voting
tokens for protocol proposals. Governance operates through a quorum-based, snapshot voting
system, ensuring transparency and security. Token holders can delegate their voting rights to
AI-powered Governance Nodes, preventing voter apathy and improving participation.

AI-Driven Governance: The Role of AI Voting Agents

What sets D-Loop apart is the integration of AI Voting Agents—autonomous AI-driven
participants that optimize invest/divest decisions while complementing human governance.
These agents analyze market conditions, execute data-driven voting strategies, and enhance
decision-making efficiency.

By leveraging AI, D-Loop ensures:

●  Continuous asset pool optimization through dynamic rebalancing
●  Reduced governance inefficiencies by mitigating inactive voting

●  AI-human synergy, where AI handles routine decision-making while human voters

engage in higher-level governance

Proposal and Voting Process

1. Submitting Proposals

●  Any DLOOP holder can submit a proposal to modify the asset pool (e.g., add/remove

assets).

●  Proposals specify:

○  Proposal type (e.g., invest or divest)
○  Asset amount requested
○  D-AI token payout or exchange rate

●  A deposit is required upon submission to prevent spam. The deposit is refunded upon

execution or expiration of the proposal.

2. Voting Process

●  Voting is conducted via a token-based voting system, where each DLOOP token

represents one vote.

●  Delegated voting allows token holders to assign their voting power to AI Governance

Nodes for automated decision-making.

●  Governance Token holders can vote "Yes" or "No", and their vote weight is proportional

to their DLOOP holdings.

●  Snapshot voting ensures fairness by using token balances at “proposal block - 1”,

preventing flash loan attacks or vote manipulation.

3. Passing and Executing Proposals

●  For a proposal to pass, it must meet two conditions:

○  A quorum threshold (e.g., 30% of the total DLOOP supply must vote)
○  More “Yes” votes than “No” votes after the voting deadline

●  Governance Token holders can change or cancel their vote anytime before the

deadline.

●  Passed proposals enter a cooldown period before execution, allowing dissenting

token holders to exit the system if necessary.

●  The proposal submitter executes the transaction, triggering the DAO to process

payments and asset transfers.

●  Time limits prevent indefinite proposal execution; expired proposals are voided.

Governance Flexibility & Evolution

Governance parameters, including quorum thresholds, voting deadlines, execution delays, and
proposal expiration times, can be adjusted through governance proposals, ensuring that D-Loop
remains adaptable as it evolves.

This AI-powered governance model ensures efficient, decentralized, and transparent
decision-making, merging human oversight with autonomous AI optimization to create a
next-generation asset index DAO.

Delegated Voting: AI and Human Governance

D-Loop’s delegated voting system allows DLOOP Governance Token holders to assign their
voting rights to other participants, ensuring active governance and informed decision-making.
This feature benefits holders who want to participate in governance without directly voting on
every proposal.

Delegation Options

DLOOP holders can delegate their voting rights to:

1.  Other DLOOP token holders – Experienced members who actively participate in

governance.

2.  AI Voting Agents – Autonomous AI-powered decision-makers that optimize voting

strategies based on market data and historical governance performance.

The D-Loop UI clearly distinguishes AI Voting Agents from human delegates, helping
token holders make informed delegation decisions.

Key Benefits of Delegated Voting

●  Prevents voter apathy – Ensures that proposals reach quorum thresholds, even if

some holders remain inactive.

●  Encourages expert-led decision-making – Supports the rise of "Asset Pool

Managers", individuals or specialist AI who research proposals in depth and vote on
behalf of delegators.

●  Enhances governance efficiency – By combining human oversight with AI-powered
automation, D-Loop ensures a balanced and optimized governance process.

Asset Addition (Invest) Proposals

An Asset Addition (Invest) proposal allows the DAO to acquire a digital asset in exchange for
newly minted D-AI tokens. The asset must conform to one of the supported Ethereum token
standards, which include both fungible and non-fungible tokens, such as ERC-20, ERC-223,
and ERC-721.

Process:

1.  A proposal is submitted specifying the asset type and quantity to be acquired.
2.  If the proposal passes voting, the executor of the proposal sends the asset to the DAO’s

smart contract.

3.  The received asset is secured within the DAO’s treasury.
4.  The DAO mints new D-AI tokens equivalent to the asset’s value and transfers them to

the executor of the proposal.

This mechanism expands the DAO’s asset pool while ensuring that newly issued D-AI tokens
are fully backed by real assets.

Asset Removal (Divest) Proposals

An Asset Removal (Divest) proposal enables the DAO to release a digital asset in exchange
for D-AI tokens, effectively removing the asset from the DAO’s treasury.

Process:

1.  A proposal is submitted specifying the asset type and quantity to be withdrawn.
2.  If the proposal passes voting, the executor sends the required D-AI tokens to the DAO.
3.  The DAO burns the received D-AI tokens, reducing the circulating supply.
4.  The DAO releases the requested asset to the executor of the proposal.

This divestment mechanism ensures that asset allocations remain balanced while maintaining
the intrinsic value of D-AI tokens within the ecosystem.

DLOOP Token Rewards System

The DLOOP Token Rewards System incentivizes governance participation by rewarding token
holders based on the profitability of their votes on investment (invest/divest) proposals. Rewards
are calculated using Chainlink Price Oracles, which track real-time market prices for all
supported assets, ensuring accurate and reliable price data for reward calculations.

Reward Conditions

Rewards are distributed based on the outcome of user decisions within a defined epoch (30-day
period). The conditions for earning rewards are as follows:

1.

Invest Decisions:

○  Yes Vote: If the price of the asset increases after an "Invest Yes" vote, the user is

rewarded for generating profit.

○  No Vote: If the price of the asset decreases after an "Invest No" vote, the user is

rewarded for avoiding loss.

2.  Divest Decisions:

○  No Vote: If the price of the asset increases after a "Divest No" vote, the user is

rewarded for preserving profit.

○  Yes Vote: If the price of the asset decreases after a "Divest Yes" vote, the user is

rewarded for avoiding further loss.

3.  No Change: If the price of the asset remains unchanged, no rewards are issued.

Reward Distribution

A total of 20,016,000 DLOOP tokens (~20% of the total supply) are allocated for governance
rewards. These tokens are distributed linearly over a period of 2160 days (6 years), with
278,000 DLOOP tokens issued per epoch (30 day peroid).

Rewards are distributed proportionally to users based on their contribution to correct decisions.
The formula for calculating a user's reward is:

Where:

●  User Correct Decisions: The number of correct decisions made by the user in the

current epoch.

●  Total Correct Decisions: The total number of correct decisions made by all users in the

current epoch.

●  Epoch Reward Pool: 278,000 DLOOP tokens.

Example Rewards Scenarios

Invest Yes Vote on WBTC:

●  A user votes "Yes" to invest in WBTC.
●  WBTC price increases by 10% within the defined epoch.
●  The user is rewarded with DLOOP tokens for generating profit.

Invest No Vote on PAXG:

●  A user votes "No" to invest in PAXG.
●  PAXG price decreases by 5% within the defined epoch.
●  The user is rewarded with DLOOP tokens for avoiding loss.

Divest No Vote on WBTC:

●  A user votes "No" to divest from WBTC.
●  WBTC price increases by 8% within the defined epoch.
●  The user is rewarded with DLOOP tokens for preserving profit.

Divest Yes Vote on PAXG:

●  A user votes "Yes" to divest from PAXG.
●  PAXG price decreases by 3% within the defined epoch.
●  The user is rewarded with DLOOP tokens for avoiding further loss.

The DLOOP Token Rewards System is designed to align incentives and produce high-quality
governance decisions. By rewarding users for decisions that generate profit or prevent loss, the
system ensures active and thoughtful participation in the governance process. The use of Price
Oracles, combined with a linear distribution model and proportional reward calculation, makes
the system transparent and sustainable over the long term.

DLOOP Cross-Chain Interoperability

For cross-chain interoperability, DLOOP utilizes HashPort's non-custodial bridge, enabling
seamless transfers between Hedera and Ethereum networks. See HashPort Portal for technical
details.

Process Flow:

1.  Locking: Users deposit DLOOP tokens into Hedera's bridge smart contract, triggering a

cryptographic proof.

2.  Minting: The proof verifies on Ethereum, minting 1:1 wrapped DLOOP (wDLOOP)

ERC-20 tokens.

3.  Redemption: Burning wDLOOP on Ethereum releases native DLOOP on Hedera.

Governance Nodes: Technical Overview

Core Functionality

AI Governance Nodes autonomously analyze and vote on proposals to optimize D-Loop’s asset
pool. Key functions include:

●  Proposal Analysis: Evaluate invest/divest proposals using market data, historical

trends, and risk assessments.

●  Voting: Cast votes aligned with optimization criteria (e.g., maximizing returns, minimizing

risk).

●  Quorum Assurance: Ensure active governance during low voter engagement.
●  Rewards: Earn merit-based rewards for accurate and profitable decisions.

Smart Contracts

DLOOP leverages non-transferable, soulbound NFTs to uniquely identify AI Governance
Nodes, ensuring decentralized and tamper-proof access to privileged governance functions.
Each AI node is issued a permanent, non-tradable NFT that grants:

●  Faster voting periods (e.g., 1 day vs. 7 days for humans).
●  Higher quorum requirements (e.g., 40% vs. 30%).
●  Cross-DAO privileges (consistent rules in ProtocolDAO, AssetDAO, and future

modules).

Key Advantages

○  Verifiable Legitimacy: On-chain NFT ownership provides cryptographic proof of

AI node status

○  Cross-Chain Interoperability: Single NFT verification works across Ethereum

and Hedera networks

○  Attack Resistance: Non-transferable NFTs prevent privilege trading or Sybil

attacks

○  Transparent Governance: All whitelist changes are recorded on-chain with

proposal histories

AI Architecture

Built as Python-based modules on decentralized infrastructure like EigenLayer, the nodes
comprise:

1.  Data Ingestion Layer:

○  Fetch real-time market data (e.g., Chainlink oracles, CoinGecko APIs).
○  Retrieve proposal details via Ethereum RPC or Hedera Mirror Node queries.
○  Access historical voting outcomes for informed decision-making.

2.  Decision-Making Engine:

○  Use supervised and reinforcement learning models to predict proposal

profitability.

○  Apply portfolio optimization (e.g., Markowitz mean-variance) and risk assessment

(e.g., VaR, Sharpe Ratio).

3.  Voting Layer:
○
○  Dynamically adjust voting strategies based on market conditions.

Interact with D-Loop smart contracts using Web3.py (Ethereum) or Hedera SDK.

4.  Reward Mechanism:

○  Track proposal performance via Chainlink oracles.
○  Allocate points for profitable votes and distribute DLOOP tokens proportionally.

5.  Security:

○  Use cryptographic signatures for transaction authentication.
○
○  Maintain audit trails for transparency.

Implement slashing conditions for malicious behavior.

Integration with EigenLayer

●  Deployment: AI nodes run as Python scripts on EigenLayer, leveraging its modular and

secure execution environment.

●  Cross-Chain Compatibility: Operate on Ethereum and Hedera, ensuring scalability and

interoperability.

Example Workflow

1.  Data Collection: Fetch market and proposal data.
2.  Proposal Analysis: Evaluate impact using ML models and optimization algorithms.

3.  Voting: Cast votes and submit via smart contracts.
4.  Rewards: Earn DLOOP tokens based on voting performance.

Tools and Technologies

●  Languages: Python (data analysis, ML), Solidity (smart contracts).
●  Frameworks: TensorFlow/PyTorch (ML), Scikit-learn (optimization).
●  Blockchain: Web3.py (Ethereum), Hedera SDK.
●

Infrastructure: EigenLayer (deployment), Docker (containerization), Chainlink (data
feeds).

AI Governance Nodes combine machine learning, blockchain technology, and
decentralized infrastructure to enable efficient, data-driven governance. By leveraging
EigenLayer and Python, these nodes ensure transparency, security, and scalability, positioning
D-Loop as a leader in AI-powered decentralized finance.

D-AI DAO Token Modeling

This section summarizes the portfolio theory and outlines the process for determining and
updating the value of the DAO’s investment pool.  The value of the portfolio is dynamic and
influenced by the changing values of the various assets it holds, making it a time-varying
function.

Portfolio Value and Asset Variations

The portfolio’s value evolves over time due to fluctuations in asset prices
and it is a time varying function.

,

The portfolio's value (1) changes as consequence of assets' prices variations

Estimated returns are defined as follows:

(1)

(2)

(3)

where

 and

.

Since the variations in prices of assets are stochastic, one can consider statistical mean value
and variance of estimated returns:

The weights

 can be calculated introducing a Lagrangian function F:

(4)

(5)

(6)

Optimal  weights

 can be calculated by setting the partial derivatives of (6) with respect to

 ,

 and

 to zero and solving the linear system of (n+2) equations.

Investment Nodes and Token Modeling

The  investment  nodes  play  a  central  role  in  the  d-loop DAO's token modeling. These nodes
are responsible for the automated execution of investment and divestment proposals, ensuring
that the assets in the portfolio are actively managed to achieve steady growth and stability.

Individuals can join the investment pool by exchanging any crypto asset for the mTokens (D-AI
tokens) representing shares in the asset pool. These tokens are designed to reflect the value of

the  underlying  portfolio  and  allow  token  holders  to  participate  in  governance  and  reward
mechanisms.

The value of the portfolio at any given time is directly tied to the performance of the assets in the
pool.  The  price  of  the  D-AI  token  corresponds  to  its  intrinsic value, which is calculated by the
following equation:

Initialization  of  (7)  is  at  some extent arbitrary and depends on initial number of tokens   issued

 (7)

and chosen price

.

Governance of the Investment Pool

The  DAO  Governance  Token  holders  control  the  investment  decisions  through  voting  on
proposals. Each proposal requires a majority vote to either invest (acquire new assets) or divest
(sell  assets).  The  governance  model  allows  for  active  participation  in  the  decision-making
process, ensuring that only sound and profitable decisions are executed.

●

Investment Proposals: Involves purchasing a specified quantity of a digital asset in
exchange for a share of the asset pool.

●  Divestment Proposals: Involves selling a specified quantity of an asset held in the pool,

and returning a share of the pool to the investor.

Whenever  new DAO tokens are issued or burned, the portfolio must be rebalanced according
to the following equation:

 (8)

Where

 and

Decision-Making Process

The  decision-making  process,  supported by mathematical models, helps identify the optimal
choices  and  in  the  d-loop  DAO,  this  approach  is  complemented  by  AI-powered  investment
nodes  that  analyze  and  execute  investment  decisions  using  data-driven  models.  The
collaboration of human expertise and AI-driven optimization ensures that the investment pool is
managed  effectively,  achieving  optimal  outcomes  while  maintaining
the  principles  of
decentralized governance.

The  D-AI  DAO  Token  Modeling  framework  is  designed to combine mathematical optimization,
AI-driven  decision-making,  and  human  optimized  yield  to  ensure  effective  governance  and
steady  growth  of  the  DAO’s  investment  pool. This process ensures that the DAO’s assets are
continuously  optimized,  while  providing  opportunities  for  token  holders  to  participate  in
governance decisions and earn rewards based on the success of those decisions.

AI Agents in d-loop Protocol

The d-loop protocol integrates AI agents, deployable on EigenLayer nodes on the Ethereum
Network (with a separate model for Hedera), to enhance governance efficiency and facilitate
institutional participation. These agents are divided into two types: Governance Nodes and
Investment Nodes.

Governance Nodes

AI Governance Nodes autonomously participate in the DAO’s governance by voting on
Invest/Divest proposals. These agents complement human voters by analyzing market
conditions and proposal contexts to make data-driven decisions. Governance nodes are
incentivized with merit-based rewards, maintaining active governance even during periods of
low human voter engagement.

Benefits:

●
Increased participation in governance, helping achieve quorum.
●  Data-driven decision-making ensures consistency and accuracy.
●  Reduces voter apathy during low engagement periods.

Investment Nodes

Investment Nodes facilitate institutional access to D-AI tokens by automating the investment
and divestment processes. Institutional investors can indirectly engage with the DAO after
completing KYC/AML procedures through DLOOP Ventures. These nodes manage

Invest/Divest proposals and execute transactions on behalf of clients without requiring direct
governance participation.

Use Case: An institutional investor places an order for 5,000 D-AI tokens via a broker’s API.
The AI Investment Node processes the order, creating and executing the corresponding
invest/divest proposals (e.g., buying 5 WBTC, 2000 PAXG ). After DAO approval, the tokens are
transferred back to the broker, completing the transaction.

Benefits:

●  Seamless, compliance-friendly access to decentralized assets.
●  Scalable, automated asset management.
●  Enables institutions to engage in DeFi without direct interaction with the DAO.

Incentives for Deploying AI Agents

Operators who deploy AI Voting Nodes or Investment Nodes on EigenLayer are rewarded
with DLOOP tokens. This ensures a decentralized, automated system for governance and
asset management.

Technical Overview of EigenLayer Architecture for AI Agents

The d-loop protocol leverages EigenLayer’s decentralized infrastructure to deploy AI agent
modules for enhanced governance and operational capabilities. These agents run as
Python-based scripts on EigenLayer nodes, benefiting from EigenLayer’s secure, modular
environment.

Governance Node AI Agents

Purpose: Governance Nodes autonomously vote on Invest/Divest proposals, complementing
human voters. They contribute to quorum achievement and improve decision-making efficiency.

Architecture:

●  AI Model Deployment: Each Governance Node is a Python module running on an
EigenLayer node, analyzing proposal data, historical market trends, and potential
outcomes to cast informed votes.

●  Smart Contract Interaction: The agent interacts with d-loop’s smart contracts using

Ethereum RPC calls to fetch proposals and submit votes.

●  Reward Mechanism: AI Governance Nodes are rewarded based on voting
performance, using the same merit-based reward logic as human voters.

●  Security: Cryptographic signatures authenticate the nodes on EigenLayer, ensuring

secure and auditable voting.

Key Components:

Interaction with smart contracts via Web3.py

●  Python-based decision-making algorithm
●
●  Data ingestion (market and proposal data)
●  EigenLayer’s secure node execution

Investment Nodes

Purpose: Investment Nodes automate institutional interactions with the d-loop DAO by
executing Invest/Divest proposals for institutional clients that have completed KYC/AML
checks through DLOOP Ventures.

Architecture:

●  KYC/AML Compliance: Before executing any orders, the Investment Node verifies

institutional investor compliance through a secure API, ensuring only authorized access
to the D-AI token.

●  Order Processing: Upon receiving an order (e.g., 5,000 D-AI tokens), the node

determines the necessary crypto purchases (e.g., 5 WBTC, 2,000 PAXG) and submits
the required proposals to the DAO for approval.

●  Transaction Execution: After the DAO votes on the proposal, the AI Investment Node

finalizes the transaction, distributing the tokens to the institutional investor via the broker
API.

Key Components:

●  KYC/AML verification module
●  Python-based order execution logic
●
●  EigenLayer’s decentralized execution and security layer

Interaction with d-loop smart contracts

EigenLayer Execution Environment

●  Modularity and Flexibility: Both Governance and Investment Nodes are executed on

EigenLayer’s modular platform, providing a flexible runtime environment for
Python-based decentralized applications (dApps).

●  Security and Decentralization: EigenLayer utilizes slashing conditions and staking
mechanisms to ensure nodes comply with protocol rules. Malicious or faulty node
behavior results in penalties, enhancing the reliability of the system.

●  Scalability: The system can scale with demand, allowing multiple AI agents to run
concurrently across separate nodes, ensuring parallel processing and preventing
bottlenecks.

This integration of AI agents and decentralized infrastructure on EigenLayer optimizes
governance, increases institutional accessibility, and ensures the stability and scalability of the
d-loop protocol.

Institutional Participation

D-Loop’s AI Investment Nodes are designed to facilitate seamless and compliant participation
by institutional investors. These nodes operate in two modes, each tailored to meet the unique
needs of institutional players:

1.

Institutional Order Processing Mode:

○  Converts institutional deposits (e.g., USDC) into D-AI tokens, enabling exposure

to the D-Loop asset pool.

○  Automates the creation and execution of Invest Proposals, ensuring efficient

and timely order processing.

2.  Autonomous Asset Management Mode:

○  Delegates portfolio management to the AI Investment Node, which autonomously
executes Invest and Divest Proposals based on predefined goals and risk
parameters.

○  Ensures dynamic portfolio optimization and risk management.

Regulatory Compliance

To address regulatory challenges and ensure institutional participation is compliant, D-Loop
implements the following measures:

●  KYC/AML Integration: Institutional investors must complete KYC/AML checks via

DLOOP Ventures, a compliant gateway for institutional access.

●  Compliant Broker APIs: Institutions interact with the ecosystem through regulated

broker APIs, ensuring adherence to local laws.

●  Transparent Reporting: All transactions and trades are logged and auditable, providing

transparency for regulators and investors.

Benefits of Institutional Participation

●

Increased Liquidity: Institutional participation brings significant capital to the D-Loop
ecosystem, enhancing liquidity and stability.

●  Credibility and Trust: Institutional involvement lends credibility to the protocol, driving

broader adoption and mainstream acceptance.

●  Scalability: AI Investment Nodes enable efficient handling of large orders and complex

portfolios, ensuring the ecosystem can scale with demand.

By integrating institutional participation into its governance and asset management framework,
D-Loop is paving the way for a more inclusive and sustainable decentralized future.

Exiting the Asset DAO

D-AI token holders can exit the asset pool at any time, without requiring a vote. This ensures
flexibility for participants, enabling them to exit when needed. However, to prevent malicious
behavior—such as sabotaging a proposal and immediately exiting—the following condition
applies:

●  Exit Restriction: If a token holder voted yes on a non-expired proposal, they are

restricted from exiting the asset pool until the proposal has been executed or expired.
This prevents actions that could undermine the integrity of the DAO’s decision-making
process.

When exiting, participants send their D-AI tokens to the DAO in exchange for their proportional
share of the assets held by the DAO. Upon exit, the D-AI tokens are burned (permanently
destroyed), reducing the circulating supply and preserving the value of remaining tokens.

Governance Proposals

Governance proposals modify the operational parameters of the DAO through the same voting
and execution framework as Invest/Divest proposals. This system ensures dynamic and
responsive protocol management.

Key Adjustable Parameters:

●  Quorum threshold (e.g., 30%)
●  Voting duration (e.g., 7 days)
●  Delay between vote expiration and execution (e.g., 2 days)
●  Execution window duration (e.g., 7 days)

●  Developer fee rates (e.g., 0.1% creation / 0.05% execution / 0.3% ragequit)
●  Developer fee payment address

AssetDAO voting periods range from 24 hours (for time-sensitive actions) to 7 days (complex
proposals). Quorum scales inversely with duration:

●  24-48h votes: 40% quorum.
●  3-7 day votes: 30% quorum.

AI Governance Nodes enable shorter voting durations without compromising security.

AI Governance Node Role:

AI Nodes evaluate proposals using predefined criteria (long-term sustainability, profitability, and
risk analysis) to:

1.  Automatically vote when human participation is low
2.  Contribute to quorum requirements
3.  Flag malicious proposals

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

Project Fee Structure

Action

Fee

Purpose

Invest/Divest Proposal

0.1% volume (min 10 DLOOP,
max 100)

Spam prevention + participation

Proposal Execution

0.05% of assets

Gas cost coverage

Ragequit

0.3% (0.1% emergency)

Discourage panic exits

Summary of Income

The protocol maintains sustainability through decentralized income streams:

Primary Revenue:

●  Minting/Burning Fees: 0.5% on DLOOP mint/burn transactions
●  Unexecuted Proposals: Fees from canceled/expired proposals

Fund Allocation:

●  70% Development: Smart contract audits, feature upgrades
●  20% Community: Incentivize community initiatives, DAOs and voter participation
●  10% Treasury Reserves: Emergency funds and insurance

Key Management

In the initial stages of the d-loop protocol’s launch, contract management and feature launch
strategies will be managed using a multi-signature Gnosis Safe. This ensures secure and
transparent management of the platform’s resources.

As the protocol grows, governance will progressively decentralize, moving towards a fully
decentralized model. This approach is designed to prevent governance capture and maintain
the integrity of the system, ensuring that the community has a direct role in decision-making and
future developments.

Tokenomics

The DLOOP token is designed to incentivize participation in the platform's governance and
reward users for contributing to its success. The total supply of DLOOP tokens is 100 million ,
distributed across various categories. Both Asset Governance Rewards and Protocol
Governance Rewards are distributed on linear distribution over 6 years.

Token Allocation

Category

Tokens

Percentage

Purpose

Asset Governance
Rewards

20,016,000 DLOOP

20.00%

Incentivizes users for making profitable
invest/divest decisions.

Protocol Governance
Rewards

2,000,000 DLOOP

2.00%

Rewards participants for voting on platform
upgrades and operational decisions.

Private Sale

15,000,000 DLOOP

15.00%

Early-stage funding from private investors.

IDO (Initial DEX
Offering)

10,000,000 DLOOP

10.00%

Public sale on decentralized exchanges to
distribute tokens widely.

Team & Advisors

10,000,000 DLOOP

10.00%

Compensation for the core team and
advisors, subject to vesting.

Ecosystem
Development

15,000,000 DLOOP

15.00%

Funds for partnerships, integrations, and
ecosystem growth.

Liquidity Provision

10,000,000 DLOOP

10.00%

Ensures sufficient liquidity on DEXs

Community Incentives  10,000,000 DLOOP

10.00%

Airdrops, grants, and other initiatives to
engage the community.

Reserve Fund

7,984,000 DLOOP

8.00%

Reserved for future opportunities,
emergencies, or strategic initiatives.

Total

100,000,000 DLOOP  100.00%

1.  Governance Rewards:

○  Asset Governance Rewards (20.016%): Distributed linearly over 2160 days (6
years), with 278,000 DLOOP tokens issued every 30-day epoch. Rewards
users for making profitable invest/divest decisions.

○  Protocol Governance Rewards (2.00%): Distributed linearly over 6 years, with
27,778 DLOOP tokens issued every 30-day epoch. Incentivizes voting on
platform upgrades and operational decisions.

2.  Funding and Distribution:

○  Private Sale (15.00%): Early-stage funding from private investors, subject to a

○

12-24 month vesting period.
IDO (10.00%): Public sale on decentralized exchanges to ensure wide
distribution and community ownership.

3.  Team and Ecosystem:

○  Team & Advisors (10.00%): Compensation for the core team and advisors,

subject to a 36-month vesting period.

○  Ecosystem Development (15.00%): Funds for partnerships, integrations, and

ecosystem growth.

○  Community Incentives (10.00%): Airdrops, grants, and initiatives to engage and

grow the community.

4.  Liquidity and Reserves:

○  Liquidity Provision (10.00%): Ensures sufficient liquidity on decentralized

exchanges.

○  Reserve Fund (7.984%): Reserved for future opportunities, emergencies, or

strategic initiatives.

Conclusion

The d-loop protocol is a DAO designed to create and manage D-AI - a self-governing,
asset-backed currency powered by a unique fusion of AI automation and community
governance. By combining decentralized decision-making with intelligent portfolio optimization,
d-loop establishes a next-generation currency system that delivers both stability and flexibility.

Each D-AI token is fully collateralized 1:1 by transparent reserves (USDC, WBTC, PAXG), with
the underlying asset mix continuously optimized through AI-driven invest/divest proposals and
community voting

Key innovations like Governance Nodes (for stability-focused voting) and Investment Nodes
(for real-time rebalancing) ensure D-AI maintains its peg while offering holders redeemability
and transactional utility. Meanwhile, the DLOOP token incentivizes high-quality governance,
aligning all participants around the shared goal of sustaining D-AI’s value as a decentralized
monetary instrument.

This framework bridges the reliability of traditional finance with the efficiency of DeFi, offering:

●  For users: A trustworthy, asset-backed currency for payments, hedging, or exposure to

a managed portfolio.

●  For institutions: Compliant access to decentralized liquidity via KYC-integrated

Investment Nodes.

●  For the ecosystem: A scalable model where AI and humans collaboratively govern

monetary policy.

Leveraging AI agents deployed on EigenLayer (or a suitable alternative on Hedera), d-loop
ensures continuous, data-driven governance that adapts to evolving market conditions and user
needs. The protocol simplifies access to decentralized finance by introducing two key assets to
the Hedera and Ethereum blockchains:

●  DLOOP: An ERC-223 governance token (or HTS on Hedera) used for invest/divest

proposals and governance-related votes. DLOOP holders earn merit-based rewards tied
to their voting performance, incentivizing informed participation.

●  D-AI: A fully collateralized, asset-backed currency representing ownership in d-loop’s
diversified reserve pool (initially backed by USDC, WBTC, and PAXG). D-AI combines
the stability of reserve-backed money with the flexibility of a blockchain-native asset,
enabling seamless transactions, redemptions, and exposure to a dynamically optimized
portfolio.

AI Governance Nodes play a crucial role in the ecosystem, autonomously analyzing market
trends, participating in voting, and maintaining quorum during periods of low human
engagement. These nodes safeguard the protocol against voter apathy while ensuring
transparent, active governance.

Meanwhile, Investment Nodes bridge traditional finance and DeFi by enabling compliant
institutional participation through KYC/AML integration. Together, these components create a
fair and transparent system where token issuance, governance adjustments, and fee allocations
are guided by data-driven insights and collective participation.

We envision D-AI becoming a cornerstone of the AI-driven economy—a currency that evolves
with market demands while maintaining rigorous collateralization. By decentralizing the
management of asset-backed money, d-loop lays the foundation for a more transparent,
inclusive, and resilient financial future.