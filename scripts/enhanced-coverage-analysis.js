/**
 * D-Loop Protocol - Enhanced Coverage Analysis Script
 * 
 * This script provides a detailed analysis of test coverage for D-Loop Protocol contracts,
 * with special focus on mock contracts and interface implementations.
 * 
 * Features:
 * - Identifies contracts with low coverage
 * - Checks interface implementation coverage
 * - Validates mock contract function coverage
 * - Generates detailed reports by contract category
 * - Suggests test improvements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const COVERAGE_THRESHOLD = 80; // Minimum acceptable coverage percentage
const CRITICAL_COVERAGE_THRESHOLD = 90; // Threshold for critical contracts
const COVERAGE_FILE_PATH = path.join(__dirname, '../coverage/coverage.json');
const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const MOCKS_DIR = path.join(__dirname, '../test/mocks');
const INTERFACES_DIR = path.join(__dirname, '../contracts/interfaces');

// Contract categories for reporting
const CONTRACT_CATEGORIES = {
  CORE: 'Core',
  GOVERNANCE: 'Governance',
  TOKEN: 'Token',
  FEES: 'Fees',
  IDENTITY: 'Identity',
  MOCKS: 'Mocks',
  OTHER: 'Other'
};

// Critical contracts that require higher coverage
const CRITICAL_CONTRACTS = [
  'AssetDAO',
  'ProtocolDAO',
  'AINodeGovernance',
  'Treasury',
  'FeeCalculator',
  'TokenApprovalOptimizer'
];

/**
 * Determines the category of a contract based on its path
 * @param {string} contractPath - Path to the contract file
 * @returns {string} - Contract category
 */
function getContractCategory(contractPath) {
  if (contractPath.includes('/mocks/')) {
    return CONTRACT_CATEGORIES.MOCKS;
  } else if (contractPath.includes('/core/')) {
    return CONTRACT_CATEGORIES.CORE;
  } else if (contractPath.includes('/governance/')) {
    return CONTRACT_CATEGORIES.GOVERNANCE;
  } else if (contractPath.includes('/token/')) {
    return CONTRACT_CATEGORIES.TOKEN;
  } else if (contractPath.includes('/fees/')) {
    return CONTRACT_CATEGORIES.FEES;
  } else if (contractPath.includes('/identity/')) {
    return CONTRACT_CATEGORIES.IDENTITY;
  } else {
    return CONTRACT_CATEGORIES.OTHER;
  }
}

/**
 * Checks if a contract is considered critical
 * @param {string} contractName - Name of the contract
 * @returns {boolean} - Whether the contract is critical
 */
function isCriticalContract(contractName) {
  return CRITICAL_CONTRACTS.some(criticalContract => 
    contractName.includes(criticalContract));
}

/**
 * Gets the threshold for a specific contract
 * @param {string} contractName - Name of the contract
 * @returns {number} - Coverage threshold for the contract
 */
function getThresholdForContract(contractName) {
  if (isCriticalContract(contractName)) {
    return CRITICAL_COVERAGE_THRESHOLD;
  }
  return COVERAGE_THRESHOLD;
}

/**
 * Analyzes the coverage data and generates a report
 */
function analyzeCoverage() {
  console.log('Analyzing test coverage for D-Loop Protocol contracts...');
  
  try {
    // Check if coverage file exists
    if (!fs.existsSync(COVERAGE_FILE_PATH)) {
      console.error('Coverage file not found. Run "npx hardhat coverage" first.');
      return;
    }
    
    // Load coverage data
    const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE_PATH, 'utf8'));
    
    // Initialize results by category
    const results = {
      totalContracts: 0,
      belowThreshold: 0,
      categorySummary: {},
      contractDetails: []
    };
    
    // Initialize category summaries
    Object.values(CONTRACT_CATEGORIES).forEach(category => {
      results.categorySummary[category] = {
        totalContracts: 0,
        belowThreshold: 0,
        averageCoverage: 0,
        totalCoverage: 0
      };
    });
    
    // Process each contract
    for (const filePath in coverageData) {
      const contractData = coverageData[filePath];
      const contractName = path.basename(filePath);
      const category = getContractCategory(filePath);
      const threshold = getThresholdForContract(contractName);
      
      // Calculate statement coverage
      const totalStatements = contractData.s.total;
      const coveredStatements = contractData.s.covered;
      const coverage = totalStatements === 0 ? 100 : (coveredStatements / totalStatements) * 100;
      
      // Calculate function coverage
      const totalFunctions = contractData.f.total;
      const coveredFunctions = contractData.f.covered;
      const functionCoverage = totalFunctions === 0 ? 100 : (coveredFunctions / totalFunctions) * 100;
      
      // Calculate branch coverage
      const totalBranches = contractData.b.total;
      const coveredBranches = contractData.b.covered;
      const branchCoverage = totalBranches === 0 ? 100 : (coveredBranches / totalBranches) * 100;
      
      // Calculate line coverage
      const totalLines = contractData.l.total;
      const coveredLines = contractData.l.covered;
      const lineCoverage = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;
      
      // Determine if coverage is below threshold
      const isBelowThreshold = coverage < threshold;
      
      // Update category summary
      results.categorySummary[category].totalContracts++;
      results.categorySummary[category].totalCoverage += coverage;
      if (isBelowThreshold) {
        results.categorySummary[category].belowThreshold++;
      }
      
      // Add contract details
      results.contractDetails.push({
        name: contractName,
        path: filePath,
        category,
        coverage: coverage.toFixed(2),
        functionCoverage: functionCoverage.toFixed(2),
        branchCoverage: branchCoverage.toFixed(2),
        lineCoverage: lineCoverage.toFixed(2),
        threshold,
        isBelowThreshold,
        isCritical: isCriticalContract(contractName),
        uncoveredFunctions: contractData.f.uncovered,
        uncoveredStatements: contractData.s.uncovered,
        uncoveredBranches: contractData.b.uncovered,
        uncoveredLines: contractData.l.uncovered
      });
      
      // Update totals
      results.totalContracts++;
      if (isBelowThreshold) {
        results.belowThreshold++;
      }
    }
    
    // Calculate average coverage for each category
    Object.keys(results.categorySummary).forEach(category => {
      const categorySummary = results.categorySummary[category];
      if (categorySummary.totalContracts > 0) {
        categorySummary.averageCoverage = (
          categorySummary.totalCoverage / categorySummary.totalContracts
        ).toFixed(2);
      }
    });
    
    // Sort contracts by coverage (ascending)
    results.contractDetails.sort((a, b) => parseFloat(a.coverage) - parseFloat(b.coverage));
    
    // Generate report
    generateReport(results);
    
    // Check mock implementations against interfaces
    checkMockImplementations();
    
  } catch (error) {
    console.error('Error analyzing coverage:', error);
  }
}

/**
 * Generates a detailed coverage report
 * @param {Object} results - Coverage analysis results
 */
function generateReport(results) {
  console.log('\n=== D-Loop Protocol Coverage Report ===\n');
  
  // Overall summary
  console.log(`Total Contracts: ${results.totalContracts}`);
  console.log(`Contracts Below Threshold: ${results.belowThreshold}`);
  console.log(`Overall Coverage: ${(
    results.contractDetails.reduce((sum, contract) => sum + parseFloat(contract.coverage), 0) / 
    results.totalContracts
  ).toFixed(2)}%`);
  
  // Category summaries
  console.log('\n--- Coverage by Category ---\n');
  Object.entries(results.categorySummary)
    .filter(([_, summary]) => summary.totalContracts > 0)
    .forEach(([category, summary]) => {
      console.log(`${category}:`);
      console.log(`  Total Contracts: ${summary.totalContracts}`);
      console.log(`  Below Threshold: ${summary.belowThreshold}`);
      console.log(`  Average Coverage: ${summary.averageCoverage}%`);
      console.log('');
    });
  
  // Contracts below threshold
  if (results.belowThreshold > 0) {
    console.log('\n--- Contracts Below Threshold ---\n');
    results.contractDetails
      .filter(contract => contract.isBelowThreshold)
      .forEach(contract => {
        console.log(`${contract.name} (${contract.category}):`);
        console.log(`  Path: ${contract.path}`);
        console.log(`  Coverage: ${contract.coverage}% (Threshold: ${contract.threshold}%)`);
        console.log(`  Function Coverage: ${contract.functionCoverage}%`);
        console.log(`  Branch Coverage: ${contract.branchCoverage}%`);
        console.log(`  Line Coverage: ${contract.lineCoverage}%`);
        
        if (contract.isCritical) {
          console.log('  ⚠️ CRITICAL CONTRACT - Requires immediate attention');
        }
        
        console.log('');
      });
  }
  
  // Critical contracts with good coverage
  console.log('\n--- Critical Contracts Coverage ---\n');
  results.contractDetails
    .filter(contract => contract.isCritical)
    .forEach(contract => {
      const status = contract.isBelowThreshold ? '❌ Below Threshold' : '✅ Good Coverage';
      console.log(`${contract.name}: ${contract.coverage}% - ${status}`);
    });
  
  // Mock contracts coverage
  console.log('\n--- Mock Contracts Coverage ---\n');
  const mockContracts = results.contractDetails.filter(
    contract => contract.category === CONTRACT_CATEGORIES.MOCKS
  );
  
  if (mockContracts.length > 0) {
    mockContracts.forEach(contract => {
      const status = contract.isBelowThreshold ? '❌ Below Threshold' : '✅ Good Coverage';
      console.log(`${contract.name}: ${contract.coverage}% - ${status}`);
    });
  } else {
    console.log('No mock contracts found in coverage data.');
  }
  
  // Recommendations
  console.log('\n--- Recommendations ---\n');
  
  if (results.belowThreshold > 0) {
    console.log('1. Focus on improving test coverage for the following contracts:');
    results.contractDetails
      .filter(contract => contract.isBelowThreshold)
      .slice(0, 5)
      .forEach(contract => {
        console.log(`   - ${contract.name} (${contract.coverage}%)`);
      });
  } else {
    console.log('✅ All contracts meet the coverage threshold.');
  }
  
  if (results.categorySummary[CONTRACT_CATEGORIES.MOCKS].belowThreshold > 0) {
    console.log('\n2. Improve test coverage for mock contracts to ensure they properly implement interfaces.');
  }
  
  console.log('\n3. Consider adding more tests for uncovered branches and edge cases.');
  
  console.log('\n=== End of Coverage Report ===\n');
}

/**
 * Checks if mock implementations properly cover their interfaces
 */
function checkMockImplementations() {
  console.log('\n=== Mock Implementation Analysis ===\n');
  
  try {
    // Get all mock contracts
    const mockFiles = fs.readdirSync(MOCKS_DIR)
      .filter(file => file.endsWith('.sol') && file.startsWith('Mock'));
    
    // Get all interfaces
    const interfaceFiles = [];
    function findInterfaces(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(dirent => {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
          findInterfaces(fullPath);
        } else if (dirent.name.endsWith('.sol') && dirent.name.startsWith('I')) {
          interfaceFiles.push(fullPath);
        }
      });
    }
    findInterfaces(INTERFACES_DIR);
    
    console.log(`Found ${mockFiles.length} mock contracts and ${interfaceFiles.length} interfaces.`);
    
    // Check each mock contract against its potential interface
    mockFiles.forEach(mockFile => {
      const mockName = mockFile.replace('Mock', '').replace('.sol', '');
      const interfaceFile = interfaceFiles.find(file => 
        path.basename(file) === `I${mockName}.sol`
      );
      
      if (interfaceFile) {
        console.log(`\nAnalyzing ${mockFile} against ${path.basename(interfaceFile)}...`);
        
        // Read mock and interface files
        const mockContent = fs.readFileSync(path.join(MOCKS_DIR, mockFile), 'utf8');
        const interfaceContent = fs.readFileSync(interfaceFile, 'utf8');
        
        // Extract function signatures from interface
        const interfaceFunctions = extractFunctionSignatures(interfaceContent);
        
        // Check if mock implements all interface functions
        const missingFunctions = [];
        interfaceFunctions.forEach(funcSig => {
          if (!mockContent.includes(funcSig)) {
            missingFunctions.push(funcSig);
          }
        });
        
        if (missingFunctions.length > 0) {
          console.log(`❌ ${mockFile} is missing ${missingFunctions.length} interface functions:`);
          missingFunctions.forEach(func => console.log(`   - ${func}`));
        } else {
          console.log(`✅ ${mockFile} implements all interface functions.`);
        }
      } else {
        console.log(`⚠️ No matching interface found for ${mockFile}.`);
      }
    });
    
    console.log('\n=== End of Mock Implementation Analysis ===\n');
  } catch (error) {
    console.error('Error checking mock implementations:', error);
  }
}

/**
 * Extracts function signatures from interface content
 * @param {string} content - Interface file content
 * @returns {Array<string>} - Array of function signatures
 */
function extractFunctionSignatures(content) {
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*external\s+([^;{]*)/g;
  const signatures = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const funcName = match[1];
    const params = match[2].trim();
    signatures.push(`function ${funcName}(${params})`);
  }
  
  return signatures;
}

// Run the coverage analysis
analyzeCoverage();
