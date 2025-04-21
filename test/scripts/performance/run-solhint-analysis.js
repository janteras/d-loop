/**
 * @title Solhint Analysis Runner
 * @dev Executes Solhint analysis on all smart contracts and generates detailed reports
 * @notice This script follows D-Loop Protocol's testing best practices
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runSolhintAnalysis() {
    console.log('========== D-LOOP PROTOCOL SOLHINT ANALYSIS ==========\n');

    // Create output directories
    const outputDir = path.join(__dirname, '../../../reports/solhint');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(outputDir, `solhint-report-${timestamp}.txt`);
    const jsonReportFile = path.join(outputDir, `solhint-report-${timestamp}.json`);
    
    try {
        // Step 1: Run Solhint analysis with standard output
        console.log('1. Running Solhint analysis on all contracts...');
        try {
            const solhintOutput = execSync(
                'npx solhint "contracts/**/*.sol"',
                { encoding: 'utf8' }
            );
            console.log('Solhint analysis completed successfully.');
            fs.writeFileSync(reportFile, solhintOutput);
            console.log(`Report saved to: ${reportFile}`);
        } catch (error) {
            console.log('Solhint found issues that need to be addressed:');
            fs.writeFileSync(reportFile, error.stdout || error.message);
            console.log(error.stdout);
            console.log(`Report saved to: ${reportFile}`);
        }

        // Step 2: Run Solhint with JSON output for further processing
        console.log('\n2. Generating JSON report for detailed analysis...');
        try {
            // Run solhint with JSON output and redirect stderr to stdout
            const jsonOutput = execSync(
                'npx solhint "contracts/**/*.sol" --formatter json 2>&1',
                { encoding: 'utf8' }
            );
            
            // Save the raw output
            fs.writeFileSync(jsonReportFile, jsonOutput);
            console.log(`JSON report saved to: ${jsonReportFile}`);
            
            // Try to extract JSON from the output
            let issues = [];
            
            // Look for JSON array pattern in the output
            const jsonMatch = jsonOutput.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
                try {
                    issues = JSON.parse(jsonMatch[0]);
                    analyzeIssues(issues, outputDir, timestamp);
                } catch (parseError) {
                    console.error(`Error parsing JSON: ${parseError.message}`);
                    // Fallback to empty issues array
                    analyzeIssues([], outputDir, timestamp);
                }
            } else {
                console.log('No issues found or invalid JSON format.');
                analyzeIssues([], outputDir, timestamp);
            }
        } catch (error) {
            console.error('Error running Solhint analysis:', error.message);
            
            // Try to extract any output that might be in error.stdout
            if (error.stdout) {
                fs.writeFileSync(jsonReportFile, error.stdout);
                console.log(`Partial output saved to: ${jsonReportFile}`);
                
                // Try to find JSON in the error output
                const jsonMatch = error.stdout.match(/\[\s*\{.*\}\s*\]/s);
                if (jsonMatch) {
                    try {
                        const issues = JSON.parse(jsonMatch[0]);
                        analyzeIssues(issues, outputDir, timestamp);
                    } catch (parseError) {
                        console.error(`Error parsing JSON from error output: ${parseError.message}`);
                        analyzeIssues([], outputDir, timestamp);
                    }
                } else {
                    analyzeIssues([], outputDir, timestamp);
                }
            } else {
                analyzeIssues([], outputDir, timestamp);
            }
        }
    } catch (error) {
        console.error('Error running Solhint analysis:', error.message);
    }
}

/**
 * Analyzes Solhint issues and generates categorized reports
 * @param {Array} issues Array of Solhint issues
 * @param {string} outputDir Directory to save reports
 * @param {string} timestamp Timestamp for report filenames
 */
function analyzeIssues(issues, outputDir, timestamp) {
    console.log('\n3. Analyzing Solhint issues...');
    
    // Categorize issues
    const categories = {
        'gas-optimization': [],
        'security': [],
        'code-quality': [],
        'style': [],
        'other': []
    };
    
    // Count severity
    const severityCounts = {
        error: 0,
        warning: 0,
        info: 0
    };
    
    // Count issues by contract
    const contractIssues = {};
    
    issues.forEach(issue => {
        // Count by severity
        severityCounts[issue.severity] = (severityCounts[issue.severity] || 0) + 1;
        
        // Count by contract
        const contractName = path.basename(issue.filePath);
        if (!contractIssues[contractName]) {
            contractIssues[contractName] = { error: 0, warning: 0, info: 0 };
        }
        contractIssues[contractName][issue.severity] += 1;
        
        // Categorize by rule type
        if (issue.ruleId.includes('gas') || issue.ruleId.includes('avoid-') || issue.ruleId.includes('no-loop')) {
            categories['gas-optimization'].push(issue);
        } else if (issue.ruleId.includes('security') || issue.ruleId.includes('reentrancy') || issue.ruleId.includes('send')) {
            categories['security'].push(issue);
        } else if (issue.ruleId.includes('complexity') || issue.ruleId.includes('max-') || issue.ruleId.includes('func-')) {
            categories['code-quality'].push(issue);
        } else if (issue.ruleId.includes('name') || issue.ruleId.includes('ordering') || issue.ruleId.includes('visibility')) {
            categories['style'].push(issue);
        } else {
            categories['other'].push(issue);
        }
    });
    
    // Generate summary report
    let summaryReport = `
D-LOOP PROTOCOL SOLHINT ANALYSIS SUMMARY
${new Date().toISOString()}

=== ISSUE COUNTS BY SEVERITY ===
Errors: ${severityCounts.error}
Warnings: ${severityCounts.warning}
Info: ${severityCounts.info}
Total: ${issues.length}

=== ISSUE COUNTS BY CATEGORY ===
Gas Optimization: ${categories['gas-optimization'].length}
Security: ${categories['security'].length}
Code Quality: ${categories['code-quality'].length}
Style: ${categories['style'].length}
Other: ${categories['other'].length}

=== CONTRACTS WITH MOST ISSUES ===
${Object.entries(contractIssues)
    .sort((a, b) => (b[1].error + b[1].warning) - (a[1].error + a[1].warning))
    .slice(0, 10)
    .map(([contract, counts]) => `${contract}: ${counts.error} errors, ${counts.warning} warnings`)
    .join('\n')}

=== GAS OPTIMIZATION ISSUES ===
${categories['gas-optimization']
    .map(issue => `[${issue.severity.toUpperCase()}] ${issue.filePath}:${issue.line} - ${issue.ruleId}: ${issue.message}`)
    .join('\n')}

=== SECURITY ISSUES ===
${categories['security']
    .map(issue => `[${issue.severity.toUpperCase()}] ${issue.filePath}:${issue.line} - ${issue.ruleId}: ${issue.message}`)
    .join('\n')}

=== RECOMMENDATIONS ===
1. Address all security issues immediately
2. Optimize gas usage in contracts with high gas-related warnings
3. Improve code quality in contracts with the most issues
4. Standardize naming conventions and code style across all contracts
`;

    // Save summary report
    const summaryFile = path.join(outputDir, `solhint-summary-${timestamp}.txt`);
    fs.writeFileSync(summaryFile, summaryReport);
    console.log(`Summary report saved to: ${summaryFile}`);
    
    // Print summary to console
    console.log('\n=== SOLHINT ANALYSIS SUMMARY ===');
    console.log(`Total issues: ${issues.length} (${severityCounts.error} errors, ${severityCounts.warning} warnings)`);
    console.log(`Gas optimization issues: ${categories['gas-optimization'].length}`);
    console.log(`Security issues: ${categories['security'].length}`);
    console.log(`Code quality issues: ${categories['code-quality'].length}`);
    
    if (severityCounts.error > 0) {
        console.log('\n⚠️ CRITICAL: There are security or gas optimization errors that must be fixed before deployment.');
    }
}

// Run the analysis
runSolhintAnalysis()
    .then(() => console.log('\nSolhint analysis completed.'))
    .catch(error => console.error('Error:', error));
