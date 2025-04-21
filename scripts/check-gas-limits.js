/**
 * @title Gas Limits Checker
 * @dev Script to check gas usage against predefined limits and generate reports
 * @notice This script reads gas usage data from test runs and compares against thresholds
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk'); // You may need to install this: npm install chalk

// Define gas limits for critical functions
const GAS_LIMITS = {
  // D-AI Token operations
  daiTransfer: 55000,
  daiApprove: 48000,
  daiMint: 75000,
  
  // AssetDAO operations
  assetCreation: 250000,
  assetInvestment: 180000,
  assetWithdrawal: 120000,
  proposalCreation: 200000,
  proposalVoting: 80000,
  
  // Treasury operations
  treasuryDeposit: 100000,
  treasuryWithdrawal: 90000,
  
  // AINodeRegistry operations
  nodeRegistration: 300000,
  nodeDeregistration: 150000
};

// Define acceptable percentage increase from previous measurements
const ACCEPTABLE_INCREASE = 3.2; // 3.2% increase is acceptable

// Path to gas report from current run
const CURRENT_GAS_REPORT_PATH = path.join(__dirname, '../gas-reports/latest.json');

// Path to gas report from previous run (baseline)
const BASELINE_GAS_REPORT_PATH = path.join(__dirname, '../gas-reports/baseline.json');

/**
 * Load gas report from file
 * @param {string} filePath Path to the gas report JSON file
 * @returns {Object} Gas report data or empty object if file doesn't exist
 */
function loadGasReport(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading gas report from ${filePath}:`, error);
  }
  
  return {};
}

/**
 * Check if gas usage is within acceptable limits
 * @param {Object} currentReport Current gas usage report
 * @param {Object} baselineReport Baseline gas usage report
 * @returns {boolean} True if all functions are within limits, false otherwise
 */
function checkGasLimits(currentReport, baselineReport) {
  let allWithinLimits = true;
  const results = {
    exceedingHardLimit: [],
    exceedingBaselineLimit: [],
    withinLimits: []
  };
  
  console.log(chalk.blue('=== Gas Usage Analysis ==='));
  console.log(chalk.blue('Function                 | Current | Baseline | % Change | Hard Limit | Status'));
  console.log(chalk.blue('----------------------------------------------------------------------------------'));
  
  // Check each function in the current report
  Object.entries(currentReport).forEach(([functionName, gasUsed]) => {
    const hardLimit = GAS_LIMITS[functionName] || Infinity;
    const baseline = baselineReport[functionName] || gasUsed;
    const percentChange = ((gasUsed - baseline) / baseline * 100).toFixed(2);
    const percentOfLimit = ((gasUsed / hardLimit) * 100).toFixed(2);
    
    let status;
    let statusColor;
    
    // Check if exceeding hard limit
    if (gasUsed > hardLimit) {
      status = `EXCEEDS LIMIT (${percentOfLimit}%)`;
      statusColor = chalk.red;
      allWithinLimits = false;
      results.exceedingHardLimit.push(functionName);
    } 
    // Check if exceeding baseline by more than acceptable increase
    else if (baselineReport[functionName] && percentChange > ACCEPTABLE_INCREASE) {
      status = `EXCEEDS BASELINE (+${percentChange}%)`;
      statusColor = chalk.yellow;
      allWithinLimits = false;
      results.exceedingBaselineLimit.push(functionName);
    } 
    // Within limits
    else {
      status = 'OK';
      statusColor = chalk.green;
      results.withinLimits.push(functionName);
    }
    
    // Format the output
    const formattedFunction = functionName.padEnd(25);
    const formattedCurrent = String(gasUsed).padStart(8);
    const formattedBaseline = String(baseline).padStart(9);
    const formattedChange = String(percentChange + '%').padStart(9);
    const formattedLimit = String(hardLimit).padStart(11);
    
    console.log(
      `${formattedFunction}| ${formattedCurrent} | ${formattedBaseline} | ${formattedChange} | ${formattedLimit} | ${statusColor(status)}`
    );
  });
  
  console.log(chalk.blue('----------------------------------------------------------------------------------'));
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Total functions checked: ${Object.keys(currentReport).length}`);
  console.log(`Functions within limits: ${results.withinLimits.length}`);
  console.log(`Functions exceeding baseline: ${results.exceedingBaselineLimit.length}`);
  console.log(`Functions exceeding hard limit: ${results.exceedingHardLimit.length}`);
  
  if (results.exceedingHardLimit.length > 0) {
    console.log(chalk.red('\nFunctions exceeding hard limits:'));
    results.exceedingHardLimit.forEach(func => console.log(chalk.red(`- ${func}`)));
  }
  
  if (results.exceedingBaselineLimit.length > 0) {
    console.log(chalk.yellow('\nFunctions exceeding baseline by more than acceptable increase:'));
    results.exceedingBaselineLimit.forEach(func => console.log(chalk.yellow(`- ${func}`)));
  }
  
  return allWithinLimits;
}

// Main execution
try {
  // Create gas-reports directory if it doesn't exist
  const reportsDir = path.join(__dirname, '../gas-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Load reports
  const currentReport = loadGasReport(CURRENT_GAS_REPORT_PATH);
  const baselineReport = loadGasReport(BASELINE_GAS_REPORT_PATH);
  
  // Check if we have current report data
  if (Object.keys(currentReport).length === 0) {
    console.error(chalk.red('No current gas report found. Run gas profiling tests first.'));
    process.exit(1);
  }
  
  // Check gas limits
  const allWithinLimits = checkGasLimits(currentReport, baselineReport);
  
  // Exit with appropriate code
  if (!allWithinLimits) {
    console.log(chalk.yellow('\nSome functions exceed gas limits or have significant increases.'));
    console.log(chalk.yellow('Review the report and optimize the identified functions.'));
    process.exit(1);
  } else {
    console.log(chalk.green('\nAll functions are within acceptable gas limits.'));
    process.exit(0);
  }
} catch (error) {
  console.error(chalk.red('Error running gas limits check:'), error);
  process.exit(1);
}
