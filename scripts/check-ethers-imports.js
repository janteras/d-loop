#!/usr/bin/env node

/**
 * @fileoverview Script to check for non-compliant ethers imports
 * @description This script checks JavaScript files for non-compliant ethers-v6-shim imports
 * and suggests the correct relative path to ethers-v6-compat.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns to detect non-compliant imports
const PATTERNS = [
  /require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\)/g,
  /import\s+(?:\*\s+as\s+)?(?:ethers|{\s*.*\s*})\s+from\s+['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]/g
];

// Files to exclude from checking
const EXCLUDED_FILES = [
  'ethers-v6-compat.js',
  'register-ethers-shim.js',
  'ethers-shim-migration-v2.js'
];

// Get staged JS files
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR "*.js"').toString();
    return output.split('\n').filter(file => file.trim() !== '');
  } catch (error) {
    console.error('Error getting staged files:', error.message);
    return [];
  }
}

// Get all JS files in the test directory
function getAllTestFiles() {
  try {
    const output = execSync('find test -type f -name "*.js"').toString();
    return output.split('\n').filter(file => file.trim() !== '');
  } catch (error) {
    console.error('Error getting test files:', error.message);
    return [];
  }
}

// Check if a file contains non-compliant imports
function checkFile(filePath) {
  // Skip excluded files
  if (EXCLUDED_FILES.some(excluded => filePath.includes(excluded))) {
    return { hasViolations: false };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];

    for (const pattern of PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push(...matches);
      }
    }

    if (violations.length > 0) {
      // Determine the correct relative path based on file location
      const relativePath = getCorrectRelativePath(filePath);
      
      return {
        hasViolations: true,
        violations,
        suggestion: `Use relative path to ethers-v6-compat.js: require("${relativePath}")`
      };
    }

    return { hasViolations: false };
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error.message);
    return { hasViolations: false };
  }
}

// Get the correct relative path to ethers-v6-compat.js based on file location
function getCorrectRelativePath(filePath) {
  const fileDir = path.dirname(filePath);
  const testDir = 'test';
  
  if (fileDir.startsWith(`${testDir}/unit/`) || 
      fileDir.startsWith(`${testDir}/scripts/`) ||
      fileDir.includes('/unit/') ||
      fileDir.includes('/scripts/')) {
    return '../../utils/ethers-v6-compat';
  } else if (fileDir === testDir || 
             fileDir.startsWith(`${testDir}/integration/`) ||
             fileDir.startsWith(`${testDir}/security/`) ||
             fileDir.startsWith(`${testDir}/performance/`) ||
             fileDir.startsWith(`${testDir}/backward-compatibility/`) ||
             fileDir.startsWith(`${testDir}/approvalPattern/`) ||
             fileDir.startsWith(`${testDir}/critical/`) ||
             fileDir.startsWith(`${testDir}/validation/`)) {
    return '../utils/ethers-v6-compat';
  } else if (fileDir === `${testDir}/utils`) {
    return './ethers-v6-compat';
  } else {
    // Default to a relative path based on directory depth
    const depth = fileDir.split('/').length - 1;
    return '../'.repeat(depth) + 'test/utils/ethers-v6-compat';
  }
}

// Main function
function main() {
  const isPreCommit = process.argv.includes('--pre-commit');
  const isFullCheck = process.argv.includes('--full-check');
  
  const filesToCheck = isPreCommit ? getStagedFiles() : 
                      isFullCheck ? getAllTestFiles() : 
                      process.argv.slice(2);
  
  let hasViolations = false;
  
  filesToCheck.forEach(file => {
    if (!file.endsWith('.js')) return;
    
    const result = checkFile(file);
    if (result.hasViolations) {
      hasViolations = true;
      console.error(`\x1b[31mNon-compliant ethers imports found in ${file}:\x1b[0m`);
      console.error(`  ${result.violations.join('\n  ')}`);
      console.error(`\x1b[32mSuggestion: ${result.suggestion}\x1b[0m`);
      console.error();
    }
  });
  
  if (hasViolations) {
    console.error('\x1b[31mPlease fix the non-compliant ethers imports before committing.\x1b[0m');
    process.exit(1);
  } else if (filesToCheck.length > 0) {
    console.log('\x1b[32mAll ethers imports are compliant!\x1b[0m');
  } else {
    console.log('No JavaScript files to check.');
  }
}

main();
