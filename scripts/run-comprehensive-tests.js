/**
 * @title Comprehensive Test Runner
 * @dev Executes all test suites and generates detailed reports
 * @notice This script runs unit, integration, security, and performance tests
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { table } = require('table');

async function runComprehensiveTests() {
    console.log('========== D-LOOP PROTOCOL COMPREHENSIVE TEST SUITE ==========\n');

    // Create output directories
    const outputDir = path.join(__dirname, '../reports');
    const performanceDir = path.join(outputDir, 'performance');
    const coverageDir = path.join(outputDir, 'coverage');
    const solhintDir = path.join(outputDir, 'solhint');
    
    [outputDir, performanceDir, coverageDir, solhintDir].forEach(dir => {
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

        // Step 2: Run unit tests
        console.log('\n2. Running unit tests...');
        try {
            const unitOutput = execSync(
                'npx hardhat test test/unit/*.test.js',
                { encoding: 'utf8' }
            );
            console.log('Unit tests completed successfully.');
            fs.writeFileSync(path.join(outputDir, `unit-test-report-${timestamp}.txt`), unitOutput);
        } catch (error) {
            console.error('Unit tests failed:', error.stdout);
            fs.writeFileSync(path.join(outputDir, `unit-test-report-${timestamp}.txt`), error.stdout);
        }

        // Step 3: Run integration tests
        console.log('\n3. Running integration tests...');
        try {
            const integrationOutput = execSync(
                'npx hardhat test test/integration/*.test.js',
                { encoding: 'utf8' }
            );
            console.log('Integration tests completed successfully.');
            fs.writeFileSync(path.join(outputDir, `integration-test-report-${timestamp}.txt`), integrationOutput);
        } catch (error) {
            console.error('Integration tests failed:', error.stdout);
            fs.writeFileSync(path.join(outputDir, `integration-test-report-${timestamp}.txt`), error.stdout);
        }

        // Step 4: Run performance tests
        console.log('\n4. Running performance tests...');
        // Run tests with gas reporter enabled
        const gasReporterEnv = {
            REPORT_GAS: 'true',
            GASREPORTER_OUTPUT: path.join(performanceDir, `gas-report-${timestamp}.txt`)
        };
        
        try {
            const performanceOutput = execSync(
                'npx hardhat test test/performance/*.test.js',
                { encoding: 'utf8', env: {...process.env, ...gasReporterEnv} }
            );
            console.log('Performance tests completed successfully.');
            fs.writeFileSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`), performanceOutput);
        } catch (error) {
            console.error('Performance tests failed:', error.stdout);
            fs.writeFileSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`), error.stdout);
        }

        // Step 5: Run benchmark tests
        console.log('\n5. Running benchmark tests...');
        try {
            const benchmarkOutput = execSync(
                'npx hardhat test test/performance/*.benchmark.js',
                { encoding: 'utf8' }
            );
            console.log('Benchmark tests completed successfully.');
            fs.writeFileSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`), benchmarkOutput);
        } catch (error) {
            console.error('Benchmark tests failed:', error.stdout);
            fs.writeFileSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`), error.stdout);
        }

        // Step 6: Generate coverage report
        console.log('\n6. Generating coverage report...');
        try {
            execSync(
                'npx hardhat coverage',
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

        // Step 7: Generate combined report
        console.log('\n7. Generating comprehensive report...');
        
        // Extract and display key metrics from performance tests
        const performanceLines = fs.existsSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`)) 
            ? fs.readFileSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`), 'utf8').split('\n')
            : [];
            
        const gasMetrics = performanceLines.filter(line => 
            line.includes('Gas used for') || 
            line.includes('gas used') ||
            line.includes('Gas: ') ||
            line.includes('Gas Used:')
        );

        // Create a formatted table of key gas metrics
        const gasTableData = [
            ['Operation', 'Gas Used']
        ];
        
        gasMetrics.forEach(metric => {
            const parts = metric.trim().split(':');
            if (parts.length === 2) {
                gasTableData.push([parts[0].trim(), parts[1].trim()]);
            }
        });
        
        // Extract benchmark metrics
        const benchmarkLines = fs.existsSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`)) 
            ? fs.readFileSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`), 'utf8').split('\n')
            : [];
            
        const benchmarkMetrics = benchmarkLines.filter(line => 
            line.includes('Average gas') || 
            line.includes('Avg ') ||
            line.includes('Efficiency ratio')
        );

        // Create a formatted table of key benchmark metrics
        const benchmarkTableData = [
            ['Metric', 'Value']
        ];
        
        benchmarkMetrics.forEach(metric => {
            const parts = metric.trim().split(':');
            if (parts.length === 2) {
                benchmarkTableData.push([parts[0].trim(), parts[1].trim()]);
            }
        });

        // Generate summary report
        const summaryReport = `
D-LOOP PROTOCOL COMPREHENSIVE TEST REPORT
${new Date().toISOString()}

=== TEST SUMMARY ===
- Solhint Analysis: ${fs.existsSync(path.join(solhintDir, `solhint-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}
- Unit Tests: ${fs.existsSync(path.join(outputDir, `unit-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}
- Integration Tests: ${fs.existsSync(path.join(outputDir, `integration-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}
- Performance Tests: ${fs.existsSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}
- Benchmark Tests: ${fs.existsSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}
- Coverage Report: ${fs.existsSync('coverage/index.html') ? 'Generated' : 'Failed'}

=== PERFORMANCE HIGHLIGHTS ===
${gasTableData.length > 1 ? table(gasTableData) : 'No gas metrics available.'}

=== BENCHMARK HIGHLIGHTS ===
${benchmarkTableData.length > 1 ? table(benchmarkTableData) : 'No benchmark metrics available.'}

=== REPORT LOCATIONS ===
- Solhint Report: ${path.join(solhintDir, `solhint-report-${timestamp}.txt`)}
- Unit Test Report: ${path.join(outputDir, `unit-test-report-${timestamp}.txt`)}
- Integration Test Report: ${path.join(outputDir, `integration-test-report-${timestamp}.txt`)}
- Performance Test Report: ${path.join(performanceDir, `performance-test-report-${timestamp}.txt`)}
- Benchmark Report: ${path.join(performanceDir, `benchmark-report-${timestamp}.txt`)}
- Coverage Report: coverage/index.html
- Gas Report: ${path.join(performanceDir, `gas-report-${timestamp}.txt`)}
`;

        fs.writeFileSync(path.join(outputDir, `comprehensive-report-${timestamp}.txt`), summaryReport);
        console.log(`\nComprehensive test report saved to: ${path.join(outputDir, `comprehensive-report-${timestamp}.txt`)}`);
        
        // Print summary to console
        console.log('\n=== TEST SUMMARY ===');
        console.log(`- Solhint Analysis: ${fs.existsSync(path.join(solhintDir, `solhint-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}`);
        console.log(`- Unit Tests: ${fs.existsSync(path.join(outputDir, `unit-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}`);
        console.log(`- Integration Tests: ${fs.existsSync(path.join(outputDir, `integration-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}`);
        console.log(`- Performance Tests: ${fs.existsSync(path.join(performanceDir, `performance-test-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}`);
        console.log(`- Benchmark Tests: ${fs.existsSync(path.join(performanceDir, `benchmark-report-${timestamp}.txt`)) ? 'Completed' : 'Failed'}`);
        console.log(`- Coverage Report: ${fs.existsSync('coverage/index.html') ? 'Generated' : 'Failed'}`);
        
        if (gasTableData.length > 1) {
            console.log('\n=== PERFORMANCE HIGHLIGHTS ===');
            console.log(table(gasTableData.slice(0, Math.min(10, gasTableData.length))));
            if (gasTableData.length > 10) {
                console.log(`... and ${gasTableData.length - 10} more metrics (see full report)`);
            }
        }

    } catch (error) {
        console.error('Error running comprehensive tests:', error);
        process.exit(1);
    }
}

runComprehensiveTests().catch(console.error);
