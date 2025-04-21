/**
 * @title Performance Test Runner
 * @dev Executes performance tests and benchmarks for the D-Loop Protocol
 * @notice This script follows the project's directory structure and best practices
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { table } = require('table');

async function runPerformanceTests() {
    console.log('========== D-LOOP PROTOCOL PERFORMANCE TEST SUITE ==========\n');

    // Create output directories
    const outputDir = path.join(__dirname, '../../../reports/performance');
    const gasReportDir = path.join(outputDir, 'gas-reports');
    const benchmarkDir = path.join(outputDir, 'benchmarks');
    const solhintDir = path.join(outputDir, 'solhint');
    
    [outputDir, gasReportDir, benchmarkDir, solhintDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
        // Step 1: Run Solhint analysis
        console.log('1. Running Solhint analysis...');
        try {
            const solhintOutput = execSync(
                'npx solhint "contracts/**/*.sol"',
                { encoding: 'utf8' }
            );
            console.log('Solhint analysis completed successfully.');
            fs.writeFileSync(path.join(solhintDir, `solhint-report-${timestamp}.txt`), solhintOutput);
        } catch (error) {
            console.log('Solhint found issues that need to be addressed:');
            fs.writeFileSync(path.join(solhintDir, `solhint-report-${timestamp}.txt`), error.stdout);
            console.log(error.stdout);
        }

        // Step 2: Run performance tests by category
        const categories = ['governance', 'core', 'fees', 'identity', 'oracles', 'rewards'];
        const categoryResults = {};
        
        for (const category of categories) {
            console.log(`\n2. Running ${category} performance tests...`);
            const categoryDir = path.join(__dirname, category);
            
            if (!fs.existsSync(categoryDir)) {
                console.log(`No tests found for ${category} category.`);
                continue;
            }
            
            // Find all performance test files in the category directory
            const testFiles = fs.readdirSync(categoryDir)
                .filter(file => file.endsWith('.performance.test.js'))
                .map(file => path.join(categoryDir, file));
                
            if (testFiles.length === 0) {
                console.log(`No performance tests found for ${category} category.`);
                continue;
            }
            
            // Run tests with gas reporter enabled
            const gasReporterEnv = {
                REPORT_GAS: 'true',
                GASREPORTER_OUTPUT: path.join(gasReportDir, `gas-report-${category}-${timestamp}.txt`)
            };
            
            try {
                const testFilePaths = testFiles.join(' ');
                const performanceOutput = execSync(
                    `npx hardhat test ${testFilePaths}`,
                    { encoding: 'utf8', env: {...process.env, ...gasReporterEnv} }
                );
                console.log(`${category} performance tests completed successfully.`);
                
                const outputFile = path.join(outputDir, `${category}-performance-test-report-${timestamp}.txt`);
                fs.writeFileSync(outputFile, performanceOutput);
                categoryResults[category] = { success: true, output: performanceOutput };
            } catch (error) {
                console.error(`${category} performance tests failed:`, error.message);
                const outputFile = path.join(outputDir, `${category}-performance-test-report-${timestamp}.txt`);
                fs.writeFileSync(outputFile, error.stdout || error.message);
                categoryResults[category] = { success: false, output: error.stdout || error.message };
            }
        }

        // Step 3: Run benchmark tests by category
        console.log(`\n3. Running benchmark tests...`);
        for (const category of categories) {
            const categoryDir = path.join(__dirname, category);
            
            if (!fs.existsSync(categoryDir)) {
                continue;
            }
            
            // Find all benchmark files in the category directory
            const benchmarkFiles = fs.readdirSync(categoryDir)
                .filter(file => file.endsWith('.benchmark.js'))
                .map(file => path.join(categoryDir, file));
                
            if (benchmarkFiles.length === 0) {
                console.log(`No benchmark tests found for ${category} category.`);
                continue;
            }
            
            console.log(`Running ${category} benchmark tests...`);
            try {
                const benchmarkFilePaths = benchmarkFiles.join(' ');
                const benchmarkOutput = execSync(
                    `npx hardhat test ${benchmarkFilePaths}`,
                    { encoding: 'utf8' }
                );
                console.log(`${category} benchmark tests completed successfully.`);
                
                const outputFile = path.join(benchmarkDir, `${category}-benchmark-report-${timestamp}.txt`);
                fs.writeFileSync(outputFile, benchmarkOutput);
                
                if (!categoryResults[category]) {
                    categoryResults[category] = { success: true, benchmarkOutput };
                } else {
                    categoryResults[category].benchmarkOutput = benchmarkOutput;
                }
            } catch (error) {
                console.error(`${category} benchmark tests failed:`, error.message);
                const outputFile = path.join(benchmarkDir, `${category}-benchmark-report-${timestamp}.txt`);
                fs.writeFileSync(outputFile, error.stdout || error.message);
                
                if (!categoryResults[category]) {
                    categoryResults[category] = { success: false, benchmarkOutput: error.stdout || error.message };
                } else {
                    categoryResults[category].benchmarkSuccess = false;
                    categoryResults[category].benchmarkOutput = error.stdout || error.message;
                }
            }
        }

        // Step 4: Generate coverage report for performance tests
        console.log('\n4. Generating coverage report for performance tests...');
        try {
            execSync(
                'npx hardhat coverage --testfiles "test/scripts/performance/**/*.test.js" --report-file reports/performance/coverage-report.json',
                { encoding: 'utf8' }
            );
            console.log('Coverage report generated successfully.');
            
            // Generate HTML report
            execSync(
                'npx istanbul report html',
                { encoding: 'utf8' }
            );
            console.log('HTML coverage report generated successfully.');
        } catch (error) {
            console.error('Coverage report generation failed:', error.message);
        }

        // Step 5: Generate combined report
        console.log('\n5. Generating comprehensive performance report...');
        
        // Extract key metrics from all performance tests
        const allMetrics = [];
        for (const [category, result] of Object.entries(categoryResults)) {
            if (result.output) {
                const lines = result.output.split('\n');
                const metrics = lines.filter(line => 
                    line.includes('Gas used for') || 
                    line.includes('gas used') ||
                    line.includes('Gas: ') ||
                    line.includes('Gas Used:')
                );
                
                metrics.forEach(metric => {
                    const parts = metric.trim().split(':');
                    if (parts.length === 2) {
                        allMetrics.push([`[${category}] ${parts[0].trim()}`, parts[1].trim()]);
                    }
                });
            }
            
            if (result.benchmarkOutput) {
                const lines = result.benchmarkOutput.split('\n');
                const metrics = lines.filter(line => 
                    line.includes('Average gas') || 
                    line.includes('Avg ') ||
                    line.includes('Efficiency ratio')
                );
                
                metrics.forEach(metric => {
                    const parts = metric.trim().split(':');
                    if (parts.length === 2) {
                        allMetrics.push([`[${category}] ${parts[0].trim()}`, parts[1].trim()]);
                    }
                });
            }
        }
        
        // Create a formatted table of key metrics
        const metricsTableData = [
            ['Operation', 'Gas Used']
        ];
        
        allMetrics.forEach(metric => {
            metricsTableData.push(metric);
        });
        
        // Generate summary report
        const summaryReport = `
D-LOOP PROTOCOL PERFORMANCE TEST REPORT
${new Date().toISOString()}

=== TEST SUMMARY ===
${categories.map(category => {
    const result = categoryResults[category] || {};
    return `- ${category} Performance Tests: ${result.success ? 'Completed' : 'Failed or Not Run'}`;
}).join('\n')}
${categories.map(category => {
    const result = categoryResults[category] || {};
    return `- ${category} Benchmark Tests: ${result.benchmarkSuccess !== false ? (result.benchmarkOutput ? 'Completed' : 'Not Run') : 'Failed'}`;
}).join('\n')}
- Coverage Report: ${fs.existsSync('coverage/index.html') ? 'Generated' : 'Failed'}

=== PERFORMANCE HIGHLIGHTS ===
${metricsTableData.length > 1 ? table(metricsTableData) : 'No performance metrics available.'}

=== REPORT LOCATIONS ===
- Performance Test Reports: ${outputDir}
- Benchmark Reports: ${benchmarkDir}
- Gas Reports: ${gasReportDir}
- Coverage Report: coverage/index.html
- Solhint Report: ${path.join(solhintDir, `solhint-report-${timestamp}.txt`)}
`;

        fs.writeFileSync(path.join(outputDir, `comprehensive-report-${timestamp}.txt`), summaryReport);
        console.log(`\nComprehensive performance report saved to: ${path.join(outputDir, `comprehensive-report-${timestamp}.txt`)}`);
        
        // Print summary to console
        console.log('\n=== TEST SUMMARY ===');
        for (const category of categories) {
            const result = categoryResults[category] || {};
            console.log(`- ${category} Performance Tests: ${result.success ? 'Completed' : 'Failed or Not Run'}`);
            console.log(`- ${category} Benchmark Tests: ${result.benchmarkSuccess !== false ? (result.benchmarkOutput ? 'Completed' : 'Not Run') : 'Failed'}`);
        }
        console.log(`- Coverage Report: ${fs.existsSync('coverage/index.html') ? 'Generated' : 'Failed'}`);
        
        if (metricsTableData.length > 1) {
            console.log('\n=== PERFORMANCE HIGHLIGHTS ===');
            console.log(table(metricsTableData.slice(0, Math.min(10, metricsTableData.length))));
            if (metricsTableData.length > 10) {
                console.log(`... and ${metricsTableData.length - 10} more metrics (see full report)`);
            }
        }

    } catch (error) {
        console.error('Error running performance tests:', error);
        process.exit(1);
    }
}

runPerformanceTests().catch(console.error);
