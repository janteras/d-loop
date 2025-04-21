/**
 * @title Solidity Coverage Configuration
 * @dev Comprehensive coverage configuration for the D-Loop Protocol
 * @notice This configuration is optimized for the pre-deployment checklist requirements
 * @custom:updated Enhanced for D-AI token flow verification and cross-contract integration tests
 */
module.exports = {
    // Skip only mock contracts and test helpers from coverage
    // Include interfaces in coverage to ensure proper implementation
    skipFiles: [
        'mocks/',
        'test/',
        'contracts/utils/Errors.sol' // Skip error definitions as they're just constants
    ],
    
    // Define minimum coverage thresholds
    // These values ensure high test coverage for critical components
    threshold: {
        statements: 90,
        branches: 85,
        functions: 95,
        lines: 90
    },
    
    // Configure the Yul optimizer for accurate coverage
    configureYulOptimizer: true,
    solcOptimizerDetails: {
        peephole: false,
        jumpdestRemover: false,
        orderLiterals: true,
        deduplicate: false,
        cse: false,
        constantOptimizer: false,
        yul: false,
    },
    
    // Mocha configuration for coverage
    mocha: {
        grep: "@skip-on-coverage", // Find everything with this tag
        invert: true,              // Run the grep's inverse set
        timeout: 120000            // Extended timeout for coverage tests
    },
    
    // Output configuration
    reporter: ['html', 'text', 'json-summary'],
    reporterOptions: {
        html: {
            outdir: './reports/coverage/html'
        },
        json: {
            outdir: './reports/coverage/json'
        },
        'json-summary': {
            outdir: './reports/coverage/summary'
        }
    },
    
    // Coverage thresholds for CI/CD pipeline
    coverageThreshold: {
        global: {
            statements: 95,
            branches: 90,
            functions: 95,
            lines: 95
        },
        // Critical contracts require higher coverage
        './contracts/governance/': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100
        },
        './contracts/token/': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100
        }
    },
    
    // Coverage measurement configuration
    measureBranches: true,
    measureFunctions: true,
    measureLines: true,
    measureStatements: true,
    
    // Instrumentation configuration
    istanbulFolder: './reports/coverage',
    istanbulReporter: ['html', 'text', 'json-summary'],
    
    // Increase timeout since coverage testing takes longer
    timeout: 120000,
    
    // Custom hooks for pre/post coverage
    onPreCompileComplete: async function() {
        console.log('Coverage instrumentation complete');
    },
    onCompileComplete: async function() {
        console.log('Compilation complete');
    },
    onTestsComplete: async function(summary) {
        console.log(`Coverage summary: ${summary.pct}% covered`);
    }
};
