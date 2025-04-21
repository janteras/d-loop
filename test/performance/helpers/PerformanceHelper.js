const { ethers } = require("hardhat");

class PerformanceHelper {
    constructor() {
        this.gasUsage = {};
        this.benchmarks = {};
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

    printReport() {
        console.log("\n=== Performance Benchmark Report ===\n");
        
        Object.entries(this.benchmarks).forEach(([name, data]) => {
            console.log(`${name}:`);
            console.log(`  Average Gas: ${data.average.toString()}`);
            console.log(`  Min Gas: ${data.minimum}`);
            console.log(`  Max Gas: ${data.maximum}`);
            console.log(`  Iterations: ${data.iterations}\n`);
        });
    }

    async measureBatchThroughput(contract, method, batchSizes, args) {
        const results = {};
        
        for (const size of batchSizes) {
            const start = Date.now();
            const tx = await contract[method](size, ...args);
            const receipt = await tx.wait();
            const end = Date.now();

            results[size] = {
                gasUsed: receipt.gasUsed,
                timeMs: end - start,
                gasPerItem: receipt.gasUsed / BigInt(size)
            };
        }

        return results;
    }
}

module.exports = PerformanceHelper;
