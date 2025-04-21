#!/bin/bash

# D-Loop Protocol Full Test Suite Runner
# This script runs all test categories in sequence to ensure complete protocol validation

# Set colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Create logs directory if it doesn't exist
LOGS_DIR="./test-logs"
mkdir -p $LOGS_DIR
LOG_FILE="$LOGS_DIR/full-test-suite-$(date +%Y-%m-%d-%H-%M-%S).log"

# Helper function to run tests and log results
run_test_category() {
    local category=$1
    local pattern=$2
    local description=$3
    
    echo -e "\n${BLUE}==============================================${NC}"
    echo -e "${BLUE}Running $description Tests${NC}"
    echo -e "${BLUE}==============================================${NC}"
    
    echo "Running $description Tests" >> $LOG_FILE
    echo "Test pattern: $pattern" >> $LOG_FILE
    echo "----------------------------------------" >> $LOG_FILE
    
    # Run the tests and capture output
    if npx hardhat test $pattern --network hardhat | tee -a $LOG_FILE; then
        echo -e "${GREEN}✓ $description Tests PASSED${NC}"
        echo "✓ $description Tests PASSED" >> $LOG_FILE
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ $description Tests FAILED${NC}"
        echo "✗ $description Tests FAILED" >> $LOG_FILE
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}==============================================${NC}\n"
    echo "============================================" >> $LOG_FILE
}

# Print header
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}      D-Loop Protocol Full Test Suite        ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo "D-Loop Protocol Full Test Suite" > $LOG_FILE
echo "Started at: $(date)" >> $LOG_FILE
echo "=============================================" >> $LOG_FILE

# Compile contracts first
echo -e "\n${YELLOW}Compiling contracts...${NC}"
npx hardhat compile
echo "Contracts compiled successfully" >> $LOG_FILE

# 1. Run unit tests
run_test_category "unit" "test/unit/**/*.test.js" "Unit"

# 2. Run integration tests
run_test_category "integration" "test/integration/**/*.test.js" "Integration"

# 3. Run validation tests (ABI compatibility)
run_test_category "validation" "test/validation/**/*.test.js" "Validation"

# 4. Run security tests
run_test_category "security" "test/security/**/*.test.js" "Security"

# 5. Run performance tests (gas profiling)
run_test_category "performance" "test/performance/**/*.test.js" "Performance"

# 6. Run deployment tests
run_test_category "deployment" "test/deployment/**/*.test.js" "Deployment"

# 7. Run privilege escalation tests
run_test_category "privilege" "test/security/*Privilege*.test.js" "Privilege Escalation"

# 8. Run backward compatibility tests
run_test_category "backward" "test/backward-compatibility/**/*.test.js" "Backward Compatibility"

# Run security tools if requested
if [ "$1" == "--with-security-tools" ]; then
    echo -e "\n${PURPLE}Running security analysis tools...${NC}"
    echo "Running security analysis tools..." >> $LOG_FILE
    
    # Run Echidna
    echo -e "\n${YELLOW}Running Echidna fuzzing...${NC}"
    if bash ./scripts/security/run_echidna.sh >> $LOG_FILE 2>&1; then
        echo -e "${GREEN}✓ Echidna analysis completed${NC}"
    else
        echo -e "${RED}✗ Echidna analysis failed${NC}"
    fi
    
    # Run Manticore
    echo -e "\n${YELLOW}Running Manticore analysis...${NC}"
    if bash ./scripts/security/run_manticore.sh >> $LOG_FILE 2>&1; then
        echo -e "${GREEN}✓ Manticore analysis completed${NC}"
    else
        echo -e "${RED}✗ Manticore analysis failed${NC}"
    fi
fi

# Print summary
echo -e "\n${CYAN}=============================================${NC}"
echo -e "${CYAN}              Test Suite Summary              ${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "Total test categories: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "${CYAN}=============================================${NC}"

echo "=============================================" >> $LOG_FILE
echo "Test Suite Summary" >> $LOG_FILE
echo "Total test categories: $TOTAL_TESTS" >> $LOG_FILE
echo "Passed: $PASSED_TESTS" >> $LOG_FILE
echo "Failed: $FAILED_TESTS" >> $LOG_FILE
echo "Ended at: $(date)" >> $LOG_FILE
echo "=============================================" >> $LOG_FILE

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed successfully!${NC}"
    echo "All tests passed successfully!" >> $LOG_FILE
    exit 0
else
    echo -e "\n${RED}Some tests failed. Check the log file for details: $LOG_FILE${NC}"
    echo "Some tests failed." >> $LOG_FILE
    exit 1
fi
