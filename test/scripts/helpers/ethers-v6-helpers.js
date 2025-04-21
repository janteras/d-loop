/**
 * Ethers v6 Helper Functions
 * 
 * Common utility functions for use with Ethereum tests
 */

// Use our unified ethers v6 compatibility layer
const ethers = require('./unified-ethers-v6-shim');

/**
 * Compute the keccak256 hash of a role string and format it as bytes32
 * This simulates the behavior of keccak256(abi.encodePacked(role)) in Solidity
 * @param {string} role The role name
 * @return {string} The bytes32 role hash
 */
function computeRoleHash(role) {
    if (!ethers.utils || !ethers.utils.keccak256) {
        if (ethers.keccak256) {
            return ethers.keccak256(ethers.toUtf8Bytes(role));
        } else {
            console.warn("keccak256 not available, using fallback");
            // Simple fallback (not cryptographically secure)
            return "0x" + Array.from(role)
                .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('').padEnd(64, '0');
        }
    }
    
    // Use ethers v6 utilities with UTF8 encoding
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes ?
        ethers.utils.toUtf8Bytes(role) :
        Buffer.from(role)
    );
}

/**
 * Convert token units to wei (ethers)
 * @param {string|number} amount Amount to convert
 * @param {number} decimals Decimal places (default: 18)
 * @return {BigNumber|bigint} The converted amount
 */
function toWei(amount, decimals = 18) {
    return ethers.parseUnits(amount.toString(), decimals);
}

/**
 * Convert wei to token units (ethers)
 * @param {string|number|BigNumber|bigint} amount Amount to convert
 * @param {number} decimals Decimal places (default: 18)
 * @return {string} The converted amount as string
 */
function fromWei(amount, decimals = 18) {
    return ethers.formatUnits(amount.toString(), decimals);
}

// Export helper functions
module.exports = {
    computeRoleHash,
    toWei,
    fromWei
};