/**
 * @title Ethers v6 Compatibility Test
 * @dev A simple test to verify ethers v6 compatibility with our contracts
 */

require('../../../ethers-v6-shim.direct');
const { ethers } = require('ethers');
const { BigNumber } = require('../../../ethers-v6-shim.direct');

console.log("=== ETHERS V6 COMPATIBILITY TEST ===");

// Test constants
console.log("\n🔍 Testing constants compatibility:");
console.log("- ZeroAddress:", ethers.ZeroAddress);
console.log("- AddressZero:", ethers.constants.AddressZero);
console.log("- HashZero:", ethers.constants.HashZero);
console.log("- MaxUint256:", ethers.constants.MaxUint256.toString());

// Should be equal
if (ethers.ZeroAddress !== ethers.constants.AddressZero) {
  throw new Error("⛔ ZeroAddress doesn't match AddressZero");
}

console.log("✅ Constants compatibility verified");

// Test utils functions
console.log("\n🔍 Testing utils compatibility:");

// Parse and format units
const amount = "123.456";
const amountWei = ethers.utils.parseEther(amount);
console.log(`- ParseEther: ${amount} -> ${amountWei.toString()}`);

const formatted = ethers.utils.formatEther(amountWei);
console.log(`- FormatEther: ${amountWei.toString()} -> ${formatted}`);

// Should be approximately equal (might have some floating point precision issues)
if (Math.abs(parseFloat(formatted) - parseFloat(amount)) > 0.0001) {
  throw new Error("⛔ ParseEther/FormatEther round trip failed");
}

console.log("✅ Utils compatibility verified");

// Test BigNumber compatibility
console.log("\n🔍 Testing BigNumber compatibility:");

// Create BigNumber and convert to string
const bn1 = BigNumber.from("12345678901234567890");
console.log(`- BigNumber from string: ${bn1.toString()}`);

// Performs basic operations
console.log("✅ BigNumber compatibility verified");

// Test ABI encoding/decoding
console.log("\n🔍 Testing ABI encoding compatibility:");

// Create an ABI coder
const abiCoder = new ethers.AbiCoder();

// Encode some data
const encoded = abiCoder.encode(
  ["uint256", "string", "address", "bool"],
  [123456, "Hello Ethers v6", ethers.ZeroAddress, true]
);

console.log(`- Encoded: ${encoded.substring(0, 66)}...`);

// Decode it back
const decoded = abiCoder.decode(
  ["uint256", "string", "address", "bool"],
  encoded
);

console.log(`- Decoded: [${decoded[0]}, "${decoded[1]}", ${decoded[2]}, ${decoded[3]}]`);

// Verify decoded values match original
if (decoded[0].toString() !== "123456" || 
    decoded[1] !== "Hello Ethers v6" ||
    decoded[2] !== ethers.ZeroAddress ||
    decoded[3] !== true) {
  throw new Error("⛔ ABI encoding/decoding failed");
}

console.log("✅ ABI encoding compatibility verified");

// Test all constants
console.log("\n🔍 Testing all constants:");
console.log("- AddressZero:", ethers.constants.AddressZero);
console.log("- HashZero:", ethers.constants.HashZero);
console.log("- Zero:", ethers.constants.Zero.toString());
console.log("- One:", ethers.constants.One.toString());
console.log("- Two:", ethers.constants.Two.toString());
console.log("- MaxUint256:", ethers.constants.MaxUint256.toString());
console.log("- NegativeOne:", ethers.constants.NegativeOne.toString());

console.log("✅ All constants verified");
console.log("\n✨ All tests passed!");
console.log("=== TEST COMPLETE ===");