/**
 * @title Base Token Approval Test Utilities
 * @dev Common utilities for token approval pattern testing
 */
const { ethers } = require("hardhat");
require('../../utils/ethers-v6-compat');

/**
 * Compute a role hash consistent with solidity keccak256 encoding
 * @param {string} role The role name to hash
 * @returns {string} The role hash
 */
function computeRoleHash(role) {
  return ethers.keccak256(ethers.toUtf8Bytes(role));
}

/**
 * Convert token units to wei (or smallest denomination)
 * @param {number|string} amount The amount to convert
 * @returns {BigNumber} The amount in wei
 */
function toWei(amount) {
  return ethers.parseEther(amount.toString());
}

/**
 * Convert wei to token units
 * @param {BigNumber} amount The amount in wei
 * @returns {string} The amount as a formatted string
 */
function fromWei(amount) {
  return ethers.formatEther(amount);
}

/**
 * Deploy a mock ERC20 token for testing
 * @param {string} name Token name
 * @param {string} symbol Token symbol
 * @param {number} decimals Token decimals
 * @param {Signer} deployer Signer to deploy with
 * @returns {Contract} The deployed token contract
 */
async function deployMockToken(name, symbol, decimals, deployer) {
  const TokenFactory = await ethers.getContractFactory("MockToken", deployer);
  const token = await TokenFactory.deploy(name, symbol, decimals);
  await token.deployed();
  return token;
}

/**
 * Get the token allowance between owner and spender
 * @param {Contract} token The token contract
 * @param {string} owner The token owner address
 * @param {string} spender The spender address
 * @returns {BigNumber} The current allowance
 */
async function getTokenAllowance(token, owner, spender) {
  return await token.allowance(owner, spender);
}

/**
 * Get the token balance of an account
 * @param {Contract} token The token contract
 * @param {string} account The account address
 * @returns {BigNumber} The token balance
 */
async function getTokenBalance(token, account) {
  return await token.balanceOf(account);
}

/**
 * Calculate gas used for a transaction
 * @param {TransactionResponse} tx The transaction response
 * @returns {number} Gas used
 */
async function calculateGasUsed(tx) {
  const receipt = await tx.wait();
  return receipt.gasUsed.toNumber();
}

/**
 * Calculate gas savings between two operations
 * @param {number} baselineGas Gas used by baseline operation
 * @param {number} optimizedGas Gas used by optimized operation
 * @returns {object} Gas savings data
 */
function calculateGasSavings(baselineGas, optimizedGas) {
  const savings = baselineGas - optimizedGas;
  const savingsPercent = (savings / baselineGas) * 100;
  
  return {
    baselineGas,
    optimizedGas,
    savings,
    savingsPercent: savingsPercent.toFixed(2) + '%'
  };
}

/**
 * Find an event in a transaction receipt
 * @param {TransactionReceipt} receipt The transaction receipt
 * @param {string} eventName The name of the event to find
 * @returns {object|null} The event object or null if not found
 */
function findEvent(receipt, eventName) {
  for (const event of receipt.events || []) {
    if (event.event === eventName) {
      return event;
    }
  }
  return null;
}

/**
 * Get common role definitions
 * @returns {object} Object containing role hashes
 */
function getRoles() {
  return {
    ADMIN_ROLE: computeRoleHash("ADMIN_ROLE"),
    AUTHORIZED_CONTRACT_ROLE: computeRoleHash("AUTHORIZED_CONTRACT_ROLE"),
    DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000'
  };
}

module.exports = {
  computeRoleHash,
  toWei,
  fromWei,
  deployMockToken,
  getTokenAllowance,
  getTokenBalance,
  calculateGasUsed,
  calculateGasSavings,
  findEvent,
  getRoles
};