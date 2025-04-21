/**
 * @title PerformanceHelper
 * @dev Utility class for measuring gas usage, benchmarking functions, and analyzing contract performance
 * @notice This helper follows D-Loop Protocol's testing best practices
 */
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

class PerformanceHelper {
    constructor(options = {}) {
        this.gasUsage = {};
        this.benchmarks = {};
        this.throughputTests = {};
        this.optimizationTests = {};
        this.reportDir = options.reportDir || path.join(__dirname, '../../../../reports/performance');
        
        // Create report directory if it doesn't exist
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }

    async measureGas(tx) {
        const receipt = await tx.wait();
        return receipt.gasUsed;
    }

    async benchmarkFunction(name, contract, method, args, iterations = 1) {
        let totalGas = ethers.getBigInt(0);
        const gasUsageArray = [];

        console.log(`\nBenchmarking ${name}...`);
        for (let i = 0; i < iterations; i++) {
            const tx = await contract[method](...args);
            const gas = await this.measureGas(tx);
            totalGas += gas;
            gasUsageArray.push(Number(gas));
        }

        const avgGas = totalGas / BigInt(iterations);
        const minGas = Math.min(...gasUsageArray);
        const maxGas = Math.max(...gasUsageArray);
        
        this.benchmarks[name] = {
            average: avgGas,
            minimum: minGas,
            maximum: maxGas,
            iterations
        };

        return {
            average: avgGas,
            minimum: minGas,
            maximum: maxGas
        };
    }

    async compareImplementations(name, implementations) {
        console.log(`\nComparing implementations for ${name}...`);
        const results = {};

        for (const [implName, impl] of Object.entries(implementations)) {
            const { method, contract, args } = impl;
            results[implName] = await this.benchmarkFunction(
                `${name}_${implName}`,
                contract,
                method,
                args
            );
        }

        return results;
    }

    /**
     * @dev Prints a comprehensive performance report to the console and saves it to a file
     * @param testSuite Name of the test suite for the report file
     */
    printReport(testSuite = 'benchmark') {
        console.log("\n=== Performance Benchmark Report ===\n");
        
        let reportContent = "=== D-LOOP PROTOCOL PERFORMANCE BENCHMARK REPORT ===\n";
        reportContent += `Generated: ${new Date().toISOString()}\n\n`;
        reportContent += "=== FUNCTION BENCHMARKS ===\n\n";
        
        // Format benchmark data for console and report file
        Object.entries(this.benchmarks).forEach(([name, data]) => {
            const benchmarkInfo = `${name}:\n` +
                `  Average Gas: ${data.average.toString()}\n` +
                `  Min Gas: ${data.minimum}\n` +
                `  Max Gas: ${data.maximum}\n` +
                `  Iterations: ${data.iterations}\n`;
                
            console.log(benchmarkInfo);
            reportContent += benchmarkInfo;
        });
        
        // Add throughput test results if any
        if (Object.keys(this.throughputTests).length > 0) {
            console.log("\n=== Throughput Tests ===\n");
            reportContent += "\n=== THROUGHPUT TESTS ===\n\n";
            
            Object.entries(this.throughputTests).forEach(([name, data]) => {
                const throughputInfo = `${name}:\n` +
                    Object.entries(data).map(([batchSize, metrics]) => 
                        `  Batch Size ${batchSize}:\n` +
                        `    Gas Used: ${metrics.gasUsed.toString()}\n` +
                        `    Time (ms): ${metrics.timeMs}\n` +
                        `    Gas Per Item: ${metrics.gasPerItem.toString()}\n`
                    ).join('');
                    
                console.log(throughputInfo);
                reportContent += throughputInfo;
            });
        }
        
        // Add optimization test results if any
        if (Object.keys(this.optimizationTests).length > 0) {
            console.log("\n=== Optimization Comparisons ===\n");
            reportContent += "\n=== OPTIMIZATION COMPARISONS ===\n\n";
            
            Object.entries(this.optimizationTests).forEach(([name, data]) => {
                const optimizationInfo = `${name}:\n` +
                    Object.entries(data).map(([impl, metrics]) => 
                        `  Implementation: ${impl}\n` +
                        `    Gas Used: ${metrics.average.toString()}\n` +
                        `    Efficiency Ratio: ${metrics.efficiencyRatio || 'N/A'}\n`
                    ).join('');
                    
                console.log(optimizationInfo);
                reportContent += optimizationInfo;
            });
        }
        
        // Save report to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(this.reportDir, `${testSuite}-report-${timestamp}.txt`);
        fs.writeFileSync(reportPath, reportContent);
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return reportContent;
    }

    /**
     * @dev Measures throughput for batch operations with different batch sizes
     * @param name Name of the throughput test
     * @param contract Contract instance to test
     * @param method Method name to call
     * @param batchSizes Array of batch sizes to test
     * @param args Additional arguments to pass to the method
     * @returns Object containing throughput metrics for each batch size
     */
    async measureBatchThroughput(name, contract, method, batchSizes, args = []) {
        console.log(`\nMeasuring batch throughput for ${name}...`);
        const results = {};
        
        for (const size of batchSizes) {
            console.log(`Testing batch size: ${size}`);
            const start = Date.now();
            const tx = await contract[method](size, ...args);
            const receipt = await tx.wait();
            const end = Date.now();

            results[size] = {
                gasUsed: receipt.gasUsed,
                timeMs: end - start,
                gasPerItem: receipt.gasUsed / BigInt(size),
                txHash: receipt.hash
            };
            
            console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`  Time: ${end - start}ms`);
            console.log(`  Gas per item: ${(receipt.gasUsed / BigInt(size)).toString()}`);
        }
        
        // Store results for reporting
        this.throughputTests[name] = results;

        return results;
    }
    
    /**
     * @dev Compares gas efficiency between different optimization strategies
     * @param name Name of the optimization test
     * @param baselineImpl The baseline implementation to compare against
     * @param optimizedImpls Object containing optimized implementations
     * @returns Comparison results with efficiency ratios
     */
    async compareOptimizations(name, baselineImpl, optimizedImpls) {
        console.log(`\nComparing optimizations for ${name}...`);
        
        // First benchmark the baseline implementation
        const { contract: baseContract, method: baseMethod, args: baseArgs } = baselineImpl;
        const baselineResult = await this.benchmarkFunction(
            `${name}_baseline`,
            baseContract,
            baseMethod,
            baseArgs,
            3 // Run 3 iterations for more accurate comparison
        );
        
        const results = {
            baseline: {
                ...baselineResult,
                efficiencyRatio: 1.0 // Baseline is always 1.0
            }
        };
        
        // Benchmark each optimized implementation
        for (const [implName, impl] of Object.entries(optimizedImpls)) {
            const { contract, method, args } = impl;
            const optimizedResult = await this.benchmarkFunction(
                `${name}_${implName}`,
                contract,
                method,
                args,
                3 // Run 3 iterations for more accurate comparison
            );
            
            // Calculate efficiency ratio (baseline gas / optimized gas)
            // Higher ratio means more efficient (uses less gas compared to baseline)
            const efficiencyRatio = Number(baselineResult.average) / Number(optimizedResult.average);
            
            results[implName] = {
                ...optimizedResult,
                efficiencyRatio: parseFloat(efficiencyRatio.toFixed(2))
            };
            
            console.log(`${implName} efficiency ratio: ${efficiencyRatio.toFixed(2)}x`);
        }
        
        // Store results for reporting
        this.optimizationTests[name] = results;
        
        return results;
    }
}

module.exports = PerformanceHelper;
