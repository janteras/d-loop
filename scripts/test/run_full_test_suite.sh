#!/bin/bash

# Script to run the full D-Loop Protocol test suite
# This script runs all tests and generates coverage reports

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create directory for test results
mkdir -p test-results

# Function to run tests and track results
run_test_group() {
  local test_name=$1
  local test_command=$2
  
  echo -e "${BLUE}Running $test_name tests...${NC}"
  
  # Run the test command and capture output
  start_time=$(date +%s)
  $test_command > test-results/$test_name.log 2>&1
  exit_code=$?
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  # Check if tests passed
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ $test_name tests passed (${duration}s)${NC}"
    return 0
  else
    echo -e "${RED}✗ $test_name tests failed (${duration}s)${NC}"
    echo -e "${YELLOW}See test-results/$test_name.log for details${NC}"
    return 1
  fi
}

# Track overall success
all_tests_passed=true

# Run unit tests
run_test_group "unit" "npx hardhat test test/critical/*.test.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run integration tests
run_test_group "integration" "npx hardhat test test/integration/**/*.test.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run validation tests
run_test_group "validation" "npx hardhat test test/backward-compatibility/*.test.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run security tests
run_test_group "security" "npx hardhat test test/integration/security/**/*.test.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run performance tests
run_test_group "performance" "npx hardhat test test/performance/**/*.test.js --config hardhat.config.performance.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run deployment tests
run_test_group "deployment" "npx hardhat test test/deployment/**/*.test.js"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Run foundry tests
run_test_group "foundry" "forge test --match-path 'test/foundry/**/*.sol'"
if [ $? -ne 0 ]; then
  all_tests_passed=false
fi

# Generate coverage report
echo -e "${BLUE}Generating coverage report...${NC}"
npx hardhat coverage --temp artifacts-coverage > test-results/coverage.log 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Coverage report generated successfully${NC}"
else
  echo -e "${RED}✗ Failed to generate coverage report${NC}"
  echo -e "${YELLOW}See test-results/coverage.log for details${NC}"
  all_tests_passed=false
fi

# Run security tools if available
echo -e "${BLUE}Running security tools...${NC}"
./scripts/security/run_echidna.sh > test-results/echidna.log 2>&1
echo -e "${YELLOW}Echidna results saved to test-results/echidna.log${NC}"

./scripts/security/run_manticore.sh --no-venv > test-results/manticore.log 2>&1
echo -e "${YELLOW}Manticore results saved to test-results/manticore.log${NC}"

# Print summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
if [ "$all_tests_passed" = true ]; then
  echo -e "${GREEN}All tests passed successfully!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Check the logs for details.${NC}"
  exit 1
fi
