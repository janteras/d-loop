# Verify hook is active
ls -la .husky/pre-commit
# -rwxr-xr-x  1 user  staff  321 Apr 21 14:21 .husky/pre-commit# D-Loop Protocol Developer Integration Guide

This guide provides essential information for developers integrating with the D-Loop Protocol deployed on the Sepolia testnet.

## Contract Addresses

The following contracts have been deployed to the Sepolia testnet:

| Contract | Address | Etherscan Link |
|----------|---------|----------------|
| SoulboundNFT | `0x97cCBDc8c4Fb46Bf2cB61E076EB7864799203913` | [View on Etherscan](https://sepolia.etherscan.io/address/0x97cCBDc8c4Fb46Bf2cB61E076EB7864799203913#code) |
| DLoopToken | `0x65F8c541502938cF019400a2841d2C87F0bD2B5E` | [View on Etherscan](https://sepolia.etherscan.io/address/0x65F8c541502938cF019400a2841d2C87F0bD2B5E#code) |
| ProtocolDAO | `0xFaA472e6C2353e863CA1Dd38fA6E77f2b3e9A215` | [View on Etherscan](https://sepolia.etherscan.io/address/0xFaA472e6C2353e863CA1Dd38fA6E77f2b3e9A215#code) |
| AINodeRegistry | `0x8D2fbeC846AeAe61b7bD3A5E1d07e9C7912A1F80` | [View on Etherscan](https://sepolia.etherscan.io/address/0x8D2fbeC846AeAe61b7bD3A5E1d07e9C7912A1F80#code) |
| Treasury | `0xf42d1a2c608a4508F22d2a9C42Cea41E3eDe34Fc` | [View on Etherscan](https://sepolia.etherscan.io/address/0xf42d1a2c608a4508F22d2a9C42Cea41E3eDe34Fc#code) |
| GovernanceRewards | `0x4606594957d209fbc2C4B24e47990F6dFDAba69A` | [View on Etherscan](https://sepolia.etherscan.io/address/0x4606594957d209fbc2C4B24e47990F6dFDAba69A#code) |
| PriceOracle | `0x24323B8fE6AC34842Dc5624e9e1729CDdB5e7AB0` | [View on Etherscan](https://sepolia.etherscan.io/address/0x24323B8fE6AC34842Dc5624e9e1729CDdB5e7AB0#code) |

## Contract Relationships

The D-Loop Protocol contracts are interconnected as follows:

1. **ProtocolDAO**: Central governance contract that manages protocol parameters and upgrades
2. **Treasury**: Manages protocol funds and token distributions
3. **DLoopToken**: ERC20 token for the protocol with delegation capabilities
4. **AINodeRegistry**: Manages AI node registration and verification
5. **SoulboundNFT**: Non-transferable NFT for identity verification
6. **GovernanceRewards**: Distributes rewards for governance participation
7. **PriceOracle**: Provides price data for protocol operations

## Integration Examples

### Connecting to the DLoopToken

```javascript
const { ethers } = require('ethers');

// Connect to Sepolia
const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');

// DLoopToken ABI (minimal version for basic interactions)
const dloopTokenAbi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function delegateTokens(address delegatee, uint256 amount) external",
  "function undelegateTokens(address delegatee, uint256 amount) external",
  "function getDelegatedAmount(address delegator, address delegatee) external view returns (uint256)"
];

// Connect to DLoopToken
const dloopTokenAddress = '0x65F8c541502938cF019400a2841d2C87F0bD2B5E';
const dloopToken = new ethers.Contract(dloopTokenAddress, dloopTokenAbi, provider);

// With a signer
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const dloopTokenWithSigner = dloopToken.connect(wallet);

// Example: Check balance
async function checkBalance(address) {
  const balance = await dloopToken.balanceOf(address);
  console.log(`Balance: ${ethers.formatEther(balance)} DLOOP`);
}

// Example: Delegate tokens
async function delegateTokens(delegatee, amount) {
  const tx = await dloopTokenWithSigner.delegateTokens(delegatee, ethers.parseEther(amount));
  await tx.wait();
  console.log(`Successfully delegated ${amount} DLOOP to ${delegatee}`);
}
```

### Interacting with the ProtocolDAO

```javascript
const { ethers } = require('ethers');

// Connect to Sepolia
const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');

// ProtocolDAO ABI (minimal version for basic interactions)
const protocolDAOAbi = [
  "function createProposal(string memory description, address[] memory targets, uint256[] memory values, bytes[] memory calldatas) external returns (uint256)",
  "function castVote(uint256 proposalId, bool support) external",
  "function executeProposal(uint256 proposalId) external",
  "function proposals(uint256) view returns (uint256 id, string description, address proposer, uint256 createdAt, uint256 votingEnds, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled)"
];

// Connect to ProtocolDAO
const protocolDAOAddress = '0xFaA472e6C2353e863CA1Dd38fA6E77f2b3e9A215';
const protocolDAO = new ethers.Contract(protocolDAOAddress, protocolDAOAbi, provider);

// With a signer
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const protocolDAOWithSigner = protocolDAO.connect(wallet);

// Example: Create a proposal
async function createProposal(description, target, value, calldata) {
  const tx = await protocolDAOWithSigner.createProposal(
    description,
    [target],
    [value],
    [calldata]
  );
  const receipt = await tx.wait();
  console.log(`Proposal created with transaction hash: ${receipt.hash}`);
}

// Example: Vote on a proposal
async function voteOnProposal(proposalId, support) {
  const tx = await protocolDAOWithSigner.castVote(proposalId, support);
  await tx.wait();
  console.log(`Vote cast on proposal ${proposalId}`);
}
```

## Obtaining ABIs

Full contract ABIs can be obtained directly from Etherscan using their API:

```javascript
const axios = require('axios');

async function getContractABI(contractAddress) {
  const apiKey = 'HG7DAYXKN5B6AZE35WRDVQRSNN5IDC3ZG6'; // Your Etherscan API key
  const url = `https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
  
  try {
    const response = await axios.get(url);
    if (response.data.status === '1') {
      return JSON.parse(response.data.result);
    } else {
      throw new Error(`Error fetching ABI: ${response.data.result}`);
    }
  } catch (error) {
    console.error('Error fetching contract ABI:', error);
    return null;
  }
}
```

## Testing Integration

Before integrating with the D-Loop Protocol in a production environment, it's recommended to:

1. Use the Sepolia testnet for all initial integration testing
2. Start with read-only operations before performing state-changing transactions
3. Test with small amounts before committing to larger transactions
4. Verify all transaction receipts to ensure operations completed successfully

## Error Handling

The D-Loop Protocol contracts use custom error types for better gas efficiency and error reporting. Common errors include:

- `ZeroAddress()`: Attempted to use the zero address where a valid address is required
- `InvalidAmount()`: Amount specified is invalid (often zero or exceeds a limit)
- `Unauthorized()`: Caller does not have the required permissions
- `ProposalNotFound()`: Referenced proposal does not exist
- `ProposalAlreadyExecuted()`: Attempted to execute an already executed proposal

## Security Considerations

When integrating with the D-Loop Protocol:

1. Never expose private keys in client-side code
2. Implement proper input validation before sending transactions
3. Use the latest version of ethers.js (v6+) for all interactions
4. Implement proper error handling for all contract interactions
5. Consider using hardware wallets or secure key management solutions for production deployments

## Support and Resources

For additional support and resources:

- GitHub Repository: [D-Loop Protocol](https://github.com/dloop-protocol)
- Documentation: [D-Loop Protocol Docs](https://docs.dloop.io)
- Community Forum: [D-Loop Community](https://community.dloop.io)
