#!/bin/bash

# Create directories if they don't exist
mkdir -p echidna-corpus

# Compile contracts using Hardhat
echo "Compiling contracts..."
npx hardhat compile

# Run Echidna property tests
echo "Running Echidna property tests..."
echidna-test test/echidna/DLoopPropertyTests.sol --config echidna.config.yaml

# Check exit status
if [ $? -eq 0 ]; then
  echo "✅ Echidna tests passed"
else
  echo "❌ Echidna tests failed"
  exit 1
fi