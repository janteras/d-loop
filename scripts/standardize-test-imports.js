#!/usr/bin/env node

/**
 * @fileoverview Script to standardize import paths in test files
 * @description This script fixes import paths for test utility files to ensure consistent testing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import patterns to standardize
const IMPORT_PATTERNS = [
  {
    // Fix BaseApprovalTest imports in approvalPattern directory
    pattern: /require\(['"]\.\.\/\.\.\/utils\/BaseApprovalTest['"]\)/g,
    replacement: "require('../utils/BaseApprovalTest')",
    directories: ['test/approvalPattern']
  },
  {
    // Fix ethers-v6-compat imports in unit tests
    pattern: /require\(['"](?:\.\.\/)+utils\/(?:ethers-v6-shim|unified-ethers-v6-shim|improved-ethers-v6-shim|ethers-v6-shim\.enhanced\.v2)['"]\)/g,
    replacement: "require('../../utils/ethers-v6-compat')",
    directories: ['test/unit']
  },
  {
    // Fix ethers-v6-compat imports in integration tests
    pattern: /require\(['"](?:\.\.\/)+utils\/(?:ethers-v6-shim|unified-ethers-v6-shim|improved-ethers-v6-shim|ethers-v6-shim\.enhanced\.v2)['"]\)/g,
    replacement: "require('../utils/ethers-v6-compat')",
    directories: ['test/integration', 'test/security', 'test/performance', 'test/backward-compatibility', 'test/approvalPattern', 'test/critical', 'test/validation']
  }
];

// Get all JS files in the specified directories
function getJsFilesInDirectories(directories) {
  const files = [];
  
  directories.forEach(dir => {
    try {
      if (fs.existsSync(dir)) {
        const output = execSync(`find ${dir} -type f -name "*.js"`).toString();
        const dirFiles = output.split('\n').filter(file => file.trim() !== '');
        files.push(...dirFiles);
      }
    } catch (error) {
      console.error(`Error finding files in ${dir}:`, error.message);
    }
  });
  
  return files;
}

// Standardize imports in a file
function standardizeImports(filePath, patterns) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    patterns.forEach(pattern => {
      if (pattern.directories.some(dir => filePath.startsWith(dir))) {
        const originalContent = content;
        content = content.replace(pattern.pattern, pattern.replacement);
        
        if (content !== originalContent) {
          modified = true;
          console.log(`Standardized imports in ${filePath}`);
        }
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error standardizing imports in ${filePath}:`, error.message);
    return false;
  }
}

// Main function
function main() {
  // Get all directories to process
  const allDirectories = IMPORT_PATTERNS.reduce((dirs, pattern) => {
    return [...dirs, ...pattern.directories];
  }, []);
  
  // Get unique directories
  const uniqueDirectories = [...new Set(allDirectories)];
  
  // Get all JS files in the directories
  const files = getJsFilesInDirectories(uniqueDirectories);
  
  console.log(`Found ${files.length} JavaScript files to process`);
  
  // Standardize imports in each file
  let standardizedCount = 0;
  
  files.forEach(file => {
    const standardized = standardizeImports(file, IMPORT_PATTERNS);
    if (standardized) {
      standardizedCount++;
    }
  });
  
  console.log(`\nStandardization complete! ${standardizedCount} files were updated.`);
}

main();
