/**
 * D-Loop Protocol - ESLint Configuration
 * 
 * This configuration enforces consistent import patterns for ethers-v6-compat.js
 * and other code quality standards across the test suite.
 */

module.exports = {
  env: {
    node: true,
    mocha: true,
    es2021: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: [
    'import'
  ],
  rules: {
    // General code quality rules
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off',
    'no-debugger': 'warn',
    
    // Import rules
    'import/no-unresolved': 'off', // Disable since we're using relative paths
    
    // Custom rule for ethers-v6-shim imports
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/ethers-v6-shim*',
              '**/unified-ethers-v6-shim*',
              '**/improved-ethers-v6-shim*'
            ],
            message: 'Use relative path to ethers-v6-compat.js instead (e.g., require("../utils/ethers-v6-compat"))'
          }
        ]
      }
    ],
    
    // Custom rule for ethers-v6-shim requires
    'no-restricted-modules': [
      'error',
      {
        patterns: [
          {
            group: [
              '**/ethers-v6-shim*',
              '**/unified-ethers-v6-shim*',
              '**/improved-ethers-v6-shim*'
            ],
            message: 'Use relative path to ethers-v6-compat.js instead (e.g., require("../utils/ethers-v6-compat"))'
          }
        ]
      }
    ]
  },
  overrides: [
    {
      // Allow certain patterns in the ethers-v6-compat.js file itself
      files: ['**/ethers-v6-compat.js', '**/ethers-shim-migration*.js'],
      rules: {
        'no-restricted-imports': 'off',
        'no-restricted-modules': 'off'
      }
    }
  ]
};
