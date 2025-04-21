# D-Loop Protocol Mock Contracts

This directory contains standardized mock implementations of contracts used for testing the D-Loop Protocol.

## Mock Contract Standards

All mock contracts in this directory follow these standards:

1. **Naming Convention**: All mock contracts are prefixed with `Mock` (e.g., `MockPriceOracle`, not `StandardMockPriceOracle`). For specialized versions, use the format `Mock{Type}{Contract}` (e.g., `MockStandardPriceOracle`, `MockPreviousPriceOracle`).
2. **Base Implementation**: All mocks MUST extend `BaseMock.sol` to provide consistent tracking and testing functionality.
3. **Function Call Tracking**: All mock contracts track function calls, callers, and parameters for testing verification.
4. **Event Emissions**: Mock contracts emit appropriate events to simulate real contract behavior.
5. **Documentation**: All mock contracts MUST include comprehensive documentation explaining their purpose and usage.

## BaseMock.sol

The `BaseMock.sol` contract provides the following functionality:

- Function call tracking (count, caller, parameters)
- State reset capabilities
- Initialization tracking
- Event emission for mock interactions

## Mock Contract Interfaces

### Core Governance Mocks

#### MockProtocolDAO
Implements the core governance functionality for testing protocol-level decisions.
- Interface: `IProtocolDAO`
- Key Functions: `propose`, `vote`, `execute`, `getProposal`

#### MockAINodeGovernance
Simulates the AI node governance system for testing node-specific governance.
- Interface: `IAINodeGovernance`
- Key Functions: `proposeNodeAction`, `voteOnNodeAction`, `executeNodeAction`

#### MockAINodeRegistry
Mocks the registry of AI nodes for testing node registration and management.
- Interface: `IAINodeRegistry`
- Key Functions: `registerNode`, `deactivateNode`, `getNodeInfo`, `updateNodeState`

### Token Mocks

#### MockERC20
Generic ERC20 token implementation for testing token interactions.
- Interface: `IERC20`
- Key Functions: `transfer`, `approve`, `transferFrom`, `balanceOf`

#### MockGovernanceToken
Mocks the governance token with delegation capabilities.
- Interface: `IGovernanceToken`
- Key Functions: `delegate`, `undelegate`, `getVotes`

#### MockSoulboundNFT
Implements the non-transferable identity token for testing identity verification.
- Interface: `ISoulboundNFT`
- Key Functions: `mint`, `revoke`, `tokenURI`

### Financial Mocks

#### MockPriceOracle
Mocks the price oracle for testing price feed integrations.
- Interface: `IPriceOracle`
- Key Functions: `getPrice`, `updatePrice`

#### MockStandardPriceOracle
Specialized version of the price oracle with standardized price formats.
- Interface: `IPriceOracle`
- Key Functions: `getStandardizedPrice`, `updateStandardizedPrice`

#### MockTreasury
Mocks the treasury contract for testing fund management.
- Interface: `ITreasury`
- Key Functions: `deposit`, `withdraw`, `getBalance`

### Utility Mocks

#### MockTokenApprovalOptimizer
Mocks the approval optimization logic for testing gas-efficient approvals.
- Interface: `ITokenApprovalOptimizer`
- Key Functions: `optimizeApproval`, `revokeApproval`

#### MockReentrancyAttacker
Simulates reentrancy attacks for security testing.
- No specific interface
- Key Functions: `attack`, `receiveCallback`

## Usage Guidelines

### In Unit Tests

```solidity
- Role-based access control
- Standard events for mock interactions

## Available Mock Contracts

| Mock Contract | Description | Interface | Base Contract |
|---------------|-------------|-----------|---------------|
| MockPriceOracle | Standard price oracle for testing | IPriceOracle | BaseMock |
| MockStandardPriceOracle | Enhanced price oracle with additional features | IPriceOracle | BaseMock |
| MockPreviousPriceOracle | Previous version of price oracle for backward compatibility testing | IPriceOracle | BaseMock |
| MockDAIToken | DAI stablecoin implementation | IERC20 | BaseMock |
| MockDLoopToken | D-Loop governance token | IDLoopToken | BaseMock |
| MockAssetDAO | Asset DAO implementation | IAssetDAO | BaseMock |
| MockProtocolDAO | Protocol governance implementation | IProtocolDAO | BaseMock |
| MockAINodeRegistry | AI Node registry for testing | IAINodeRegistry | BaseMock |
| MockGovernanceRewards | Governance rewards distribution | IGovernanceRewards | BaseMock |
| MockPreviousGovernanceRewards | Previous version for backward compatibility | IGovernanceRewards | BaseMock |
| MockFeeProcessor | Fee processing implementation | IFeeProcessor | BaseMock |
| MockFeeCalculator | Fee calculation logic | IFeeCalculator | BaseMock |
| MockSoulboundNFT | Soulbound NFT implementation | ISoulboundNFT | BaseMock |
| MockTokenApprovalOptimizer | Token approval optimization | ITokenApprovalOptimizer | BaseMock |

## Naming Standardization

As part of our ongoing standardization efforts, we've updated the naming conventions for mock contracts. The following changes have been made:

| Old Name | New Name | Reason |
|----------|----------|--------|
| StandardMockPriceOracle | MockStandardPriceOracle | Consistent prefix-based naming |
| MockStandardizedPriceOracle | MockStandardPriceOracle | Simplified naming |

All new mock contracts should follow the `Mock{Contract}` naming pattern, with specialized versions using `Mock{Type}{Contract}`.

## Using Mock Contracts in Tests

### JavaScript Tests

```javascript
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Protocol Tests", function() {
  async function deployMocksFixture() {
    // Deploy mock contracts
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const mockPriceOracle = await MockPriceOracle.deploy();
    await mockPriceOracle.initialize();
    
    const MockDAIToken = await ethers.getContractFactory("MockDAIToken");
    const mockDAIToken = await MockDAIToken.deploy();
    await mockDAIToken.initialize();
    
    return { mockPriceOracle, mockDAIToken };
  }
  
  it("should interact with mock contracts", async function() {
    const { mockPriceOracle, mockDAIToken } = await loadFixture(deployMocksFixture);
    
    // Use mock functions
    await mockPriceOracle.setAssetPrice(mockDAIToken.address, ethers.utils.parseUnits("1", 8));
    
    // Verify mock interactions
    expect(await mockPriceOracle.getAssetPrice(mockDAIToken.address)).to.equal(ethers.utils.parseUnits("1", 8));
    expect(await mockPriceOracle.functionCallCount("setAssetPrice")).to.equal(1);
  });
});
```

### Foundry Tests

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../../mocks/MockPriceOracle.sol";
import "../../mocks/MockDAIToken.sol";

contract PriceOracleTest is Test {
    MockPriceOracle public mockPriceOracle;
    MockDAIToken public mockDAIToken;
    
    function setUp() public {
        mockPriceOracle = new MockPriceOracle();
        mockPriceOracle.initialize();
        
        mockDAIToken = new MockDAIToken();
        mockDAIToken.initialize();
    }
    
    function testPriceOracle() public {
        mockPriceOracle.setAssetPrice(address(mockDAIToken), 100 * 10**8);
        assertEq(mockPriceOracle.getAssetPrice(address(mockDAIToken)), 100 * 10**8);
        assertEq(mockPriceOracle.functionCallCount("setAssetPrice"), 1);
    }
}
```
    const MockToken = await ethers.getContractFactory("MockToken");
    mockToken = await MockToken.deploy("Mock Token", "MOCK", 18);
    
    const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    mockPriceOracle = await MockPriceOracle.deploy();
    
    // Initialize mocks
    await mockToken.initialize();
    await mockPriceOracle.initialize();
  });
  
  it("should track function calls", async function() {
    // Perform operations
    await mockToken.mint(user1.address, 1000);
    
    // Verify function was called
    expect(await mockToken.wasFunctionCalled("mint")).to.be.true;
    
    // Get call details
    const [count, caller, data] = await mockToken.getFunctionCallHistory("mint");
    expect(count).to.equal(1);
  });
});
```

## Extending Mock Contracts

When creating new mock contracts, follow these guidelines:

1. Extend `BaseMock.sol` where applicable
2. Use the `_recordFunctionCall` method to track function calls
3. Follow the naming convention (prefix with `Mock`)
4. Implement all necessary interfaces for testing
5. Add comprehensive documentation
