#!/bin/bash

# Script to run Echidna tests for D-Loop Protocol
# This script uses npm to install and run Echidna

# Create directory for Echidna corpus if it doesn't exist
mkdir -p echidna-corpus

# Check if Echidna is installed via npm
if ! npm list -g echidna-test > /dev/null 2>&1; then
  echo "Installing Echidna via npm..."
  npm install -g echidna-test
  
  if [ $? -ne 0 ]; then
    echo "Failed to install Echidna via npm. Trying alternative installation..."
    # Try to install using local npm package
    npm install --save-dev echidna-test
    
    if [ $? -ne 0 ]; then
      echo "Failed to install Echidna. Please install it manually:"
      echo "npm install -g echidna-test"
      echo "or"
      echo "npm install --save-dev echidna-test"
      exit 1
    fi
    
    # Use local installation
    ECHIDNA_CMD="npx echidna-test"
  else
    # Use global installation
    ECHIDNA_CMD="echidna-test"
  fi
else
  # Use global installation
  ECHIDNA_CMD="echidna-test"
fi

# Run Echidna tests
echo "Running Echidna tests for TokenDelegation..."
$ECHIDNA_CMD test/security/echidna/TokenDelegation.echidna.sol \
  --config echidna.config.yaml \
  --contract TokenDelegationEchidnaTest \
  --corpus-dir echidna-corpus/token-delegation

echo "Running Echidna tests for Treasury..."
$ECHIDNA_CMD test/security/echidna/Treasury.echidna.sol \
  --config echidna.config.yaml \
  --contract TreasuryEchidnaTest \
  --corpus-dir echidna-corpus/treasury

echo "Echidna tests completed."
