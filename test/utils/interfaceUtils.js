const { expect } = require('chai');
const { ethers } = require('hardhat');

// Validates function signatures in contract ABI
function validateFunctionSignatures(contract, expectedFunctions) {
  const abi = contract.interface.fragments;
  
  expectedFunctions.forEach(expectedFn => {
    const found = abi.find(
      fragment => 
        fragment.type === 'function' && 
        fragment.name === expectedFn.name &&
        fragment.inputs.length === expectedFn.params.length
    );
    
    expect(found, `Function ${expectedFn.name} with ${expectedFn.params.length} params not found`).to.exist;
  });
}

// Validates event signatures in contract ABI
function validateEventSignatures(contract, expectedEvents) {
  const abi = contract.interface.fragments;
  
  expectedEvents.forEach(expectedEvent => {
    const found = abi.find(
      fragment => 
        fragment.type === 'event' && 
        fragment.name === expectedEvent.name
    );
    
    expect(found, `Event ${expectedEvent.name} not found`).to.exist;
  });
}

module.exports = {
  validateFunctionSignatures,
  validateEventSignatures
};
