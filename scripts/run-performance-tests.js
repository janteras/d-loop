const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { table } = require('table');

/**
 * @title Performance Test Runner
 * @dev Executes all performance tests and benchmarks, generating comprehensive reports
 * @notice This script runs both standard performance tests and detailed benchmarks
 */

async function runPerformanceTests() {
    console.log('========== D-LOOP PROTOCOL PERFORMANCE TEST SUITE ==========\n');

    // Create output directories
    const outputDir = path.join(__dirname, '../reports/performance');
    const gasReportDir = path.join(outputDir, 'gas-reports');
    const benchmarkDir = path.join(outputDir, 'benchmarks');
    
    [outputDir, gasReportDir, benchmarkDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `performance-report-${timestamp}.txt`);
    const gasReportFile = path.join(gasReportDir, `gas-report-${timestamp}.txt`);
    const benchmarkFile = path.join(benchmarkDir, `benchmark-${timestamp}.txt`);

    try {
        console.log('1. Running Solhint analysis...');
        try {
            const solhintOutput = execSync(
                'npx solhint "contracts/**/*.sol"',
                { encoding: 'utf8' }
            );
            console.log('Solhint analysis completed successfully.');
            fs.writeFileSync(path.join(outputDir, `solhint-report-${timestamp}.txt`), solhintOutput);
        } catch (error) {
            console.log('Solhint found issues that need to be addressed:');
            fs.writeFileSync(path.join(outputDir, `solhint-report-${timestamp}.txt`), error.stdout);
            console.log(error.stdout);
        }

        console.log('\n2. Running standard performance tests...');
        // Run tests with gas reporter enabled
        const gasReporterEnv = {
            REPORT_GAS: 'true',
            GASREPORTER_OUTPUT: gasReportFile
        };
        
        const output = execSync(
            'npx hardhat test test/performance/*.test.js',
            { encoding: 'utf8', env: {...process.env, ...gasReporterEnv} }
        );

        // Save output to file
        fs.writeFileSync(outputFile, output);

        console.log(`\n3. Running detailed benchmarks...`);
        const benchmarkOutput = execSync(
            'npx hardhat test test/performance/*.benchmark.js',
            { encoding: 'utf8' }
        );
        
        fs.writeFileSync(benchmarkFile, benchmarkOutput);

        // Combine reports
        console.log('\n4. Generating comprehensive performance report...');
        const combinedReport = `D-LOOP PROTOCOL PERFORMANCE REPORT
${timestamp}

` +
            `===== PERFORMANCE TEST RESULTS =====\n${output}\n\n` +
            `===== BENCHMARK RESULTS =====\n${benchmarkOutput}`;
            
        fs.writeFileSync(path.join(outputDir, `combined-report-${timestamp}.txt`), combinedReport);

        console.log(`\nPerformance test results saved to: ${outputFile}`);
        console.log(`Benchmark results saved to: ${benchmarkFile}`);
        console.log(`Combined report saved to: ${path.join(outputDir, `combined-report-${timestamp}.txt`)}`);
        
        console.log('\nPerformance Highlights:');
        
        // Extract and display key metrics
        const lines = output.split('\n');
        const metrics = lines.filter(line => 
            line.includes('Gas used for') || 
            line.includes('gas used') ||
            line.includes('Gas: ') ||
            line.includes('Gas Used:') || 
            line.includes('Average Gas:') ||
            line.includes('Gas per Item:')
        );

        // Create a formatted table of key metrics
        const tableData = [
            ['Operation', 'Gas Used']
        ];
        
        metrics.forEach(metric => {
            const parts = metric.trim().split(':');
            if (parts.length === 2) {
                tableData.push([parts[0].trim(), parts[1].trim()]);
            }
        });
        
        if (tableData.length > 1) {
            console.log(table(tableData.slice(0, 11)));
            if (metrics.length > 10) {
                console.log(`... and ${metrics.length - 10} more metrics (see full report)`);
            }
        }
        
        // Run a coverage report for performance tests
        console.log('\n5. Generating coverage report for performance tests...');
        try {
            execSync(
                'npx hardhat coverage --testfiles "test/performance/*.test.js" --report-file reports/performance/coverage-report.json',
                { encoding: 'utf8' }
            );
            console.log('Coverage report generated successfully.');
        } catch (error) {
            console.log('Error generating coverage report:', error.message);
        }

    } catch (error) {
        console.error('Error running performance tests:', error);
        process.exit(1);
    }
}

runPerformanceTests().catch(console.error);
