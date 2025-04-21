#!/bin/bash

# Script to run Manticore analysis for D-Loop Protocol
# This script assumes Python 3 and pip are installed

# Create directory for Manticore results if it doesn't exist
mkdir -p manticore-results

# Check if we should use a virtual environment
USE_VENV=true
if [ "$1" == "--no-venv" ]; then
  USE_VENV=false
fi

# Function to install dependencies
install_dependencies() {
  echo "Installing dependencies..."
  pip install pysha3==1.0.2 --no-build-isolation
  pip install z3-solver==4.8.12
  pip install manticore==0.3.7
  
  # Check if installation succeeded
  if ! pip show manticore > /dev/null; then
    echo "Failed to install Manticore. Trying alternative approach..."
    pip install manticore-ethereum
    
    if ! pip show manticore-ethereum > /dev/null; then
      echo "Failed to install Manticore. Please install it manually:"
      echo "pip install manticore==0.3.7"
      return 1
    fi
  fi
  
  return 0
}

if [ "$USE_VENV" = true ]; then
  # Create virtual environment if it doesn't exist
  if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
  fi

  # Activate virtual environment
  echo "Activating virtual environment..."
  source venv/bin/activate

  # Install Manticore if not already installed
  if ! pip show manticore > /dev/null; then
    install_dependencies
    if [ $? -ne 0 ]; then
      echo "Continuing without Manticore installation..."
    fi
  fi
else
  # Install globally if not already installed
  if ! pip show manticore > /dev/null; then
    install_dependencies
    if [ $? -ne 0 ]; then
      echo "Continuing without Manticore installation..."
    fi
  fi
fi

# Check if Manticore is installed before running analysis
if pip show manticore > /dev/null || pip show manticore-ethereum > /dev/null; then
  # Run Manticore analysis
  echo "Running Manticore analysis for Treasury..."
  python3 test/security/manticore/analyze_treasury.py

  echo "Running Manticore analysis for AINodeRegistry..."
  python3 test/security/manticore/analyze_node_registry.py

  echo "Manticore analysis completed."
else
  echo "WARNING: Manticore is not installed. Skipping analysis."
  echo "Please install Manticore manually to run the security analysis."
  echo "You can try: pip install manticore==0.3.7"
fi

# Deactivate virtual environment if we're using one
if [ "$USE_VENV" = true ]; then
  deactivate
fi
