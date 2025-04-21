/**
 * @title Unified Test Helper
 * @dev Common test utilities standardized across all test files
 * @notice This helper addresses ethers.js compatibility issues and standardizes test patterns
 */

// Constants
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Converts token amount to wei representation (with 18 decimals)
 * @param {number|string} amount - The token amount in standard units 
 * @returns {string} - Token amount in wei (18 decimals)
 */
function toWei(amount) {
  // For 18 decimals, multiply by 10^18
  const decimals = 18;
  const weiAmount = typeof amount === 'string' 
    ? amount.includes('.') 
      ? amount.replace('.', '').padEnd(amount.length - amount.indexOf('.') + decimals, '0')
      : amount + '0'.repeat(decimals)
    : String(amount * Math.pow(10, decimals));
  
  return weiAmount;
}

/**
 * Computes keccak256 hash of a role string for AccessControl
 * @param {string} role - The role string 
 * @returns {string} - Computed role hash
 */
function computeRoleHash(role) {
  // Use native Node.js crypto for consistent hashing
  const crypto = require('crypto');
  const hash = crypto.createHash('sha3-256').update(role).digest('hex');
  return '0x' + hash;
}

/**
 * Measures gas usage of a transaction
 * @param {Promise<Transaction>} txPromise - Promise returning a transaction 
 * @returns {Promise<number>} - Gas used by the transaction
 */
async function measureGas(txPromise) {
  const tx = await txPromise;
  const receipt = await tx.wait();
  return Number(receipt.gasUsed);
}

/**
 * Creates a standardized test token deployment
 * @param {Object} factory - The contract factory 
 * @param {string} name - Token name
 * @param {string} symbol - Token symbol
 * @param {number} decimals - Token decimals
 * @returns {Promise<Contract>} - Deployed token contract
 */
async function deployTestToken(factory, name = "Test Token", symbol = "TEST", decimals = 18) {
  const token = await factory.deploy(name, symbol, decimals);
  await token.waitForDeployment();
  return token;
}

/**
 * Logs the token balance of an account
 * @param {Contract} token - The token contract
 * @param {string} account - The account address
 * @param {string} label - Optional label for the log
 * @returns {Promise<string>} - The token balance
 */
async function logTokenBalance(token, account, label = "Balance") {
  const balance = await token.balanceOf(account);
  console.log(`${label}: ${balance.toString()}`);
  return balance.toString();
}

/**
 * Logs the token allowance between accounts
 * @param {Contract} token - The token contract
 * @param {string} owner - The token owner
 * @param {string} spender - The token spender
 * @param {string} label - Optional label for the log
 * @returns {Promise<string>} - The token allowance
 */
async function logTokenAllowance(token, owner, spender, label = "Allowance") {
  const allowance = await token.allowance(owner, spender);
  console.log(`${label}: ${allowance.toString()}`);
  return allowance.toString();
}

module.exports = {
  ZERO_ADDRESS,
  toWei,
  computeRoleHash,
  measureGas,
  deployTestToken,
  logTokenBalance,
  logTokenAllowance
};