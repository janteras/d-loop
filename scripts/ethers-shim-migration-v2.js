/**
 * D-Loop Protocol - Ethers Shim Migration Script (v2)
 * 
 * This script standardizes all ethers-v6-shim imports across the codebase
 * to use the centralized ethers-v6-compat.js file with proper relative paths.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DIR = path.resolve(__dirname, '../test');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Stats tracking
let stats = {
  filesScanned: 0,
  filesModified: 0,
  importsUpdated: 0,
  errors: 0
};

/**
 * Find all JavaScript files in a directory recursively
 */
function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Calculate the relative path from a file to the ethers-v6-compat.js file
 */
function getRelativePath(filePath) {
  const targetDir = path.dirname(filePath);
  const shimPath = path.resolve(__dirname, '../test/utils/ethers-v6-compat.js');
  const shimDir = path.dirname(shimPath);
  
  // Calculate relative path from file to shim
  let relativePath = path.relative(targetDir, shimDir);
  
  // Handle same directory case
  if (relativePath === '') {
    relativePath = '.';
  }
  
  // Ensure proper path format
  return relativePath.replace(/\\/g, '/') + '/ethers-v6-compat';
}

/**
 * Update import statements in a file
 */
function updateImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileImportsUpdated = 0;
    
    // Calculate the relative path to ethers-v6-compat.js
    const relativePath = getRelativePath(filePath);
    
    // Define regex patterns for matching various ethers-v6-shim imports
    const patterns = [
      // Simple require statements
      {
        regex: /require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: `require('${relativePath}');`
      },
      
      // const ethers = require statements
      {
        regex: /const ethers = require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: `const ethers = require('${relativePath}');`
      },
      
      // module.exports statements
      {
        regex: /module\.exports = require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: `module.exports = require('${relativePath}');`
      },
      
      // Handle @shim alias
      {
        regex: /require\(['"]@shim['"]\);/g,
        replacement: `require('${relativePath}');`
      },
      {
        regex: /const ethers = require\(['"]@shim['"]\);/g,
        replacement: `const ethers = require('${relativePath}');`
      },
      {
        regex: /module\.exports = require\(['"]@shim['"]\);/g,
        replacement: `module.exports = require('${relativePath}');`
      },
      
      // Handle @ethers-shim alias
      {
        regex: /require\(['"]@ethers-shim['"]\);/g,
        replacement: `require('${relativePath}');`
      },
      {
        regex: /const ethers = require\(['"]@ethers-shim['"]\);/g,
        replacement: `const ethers = require('${relativePath}');`
      },
      {
        regex: /module\.exports = require\(['"]@ethers-shim['"]\);/g,
        replacement: `module.exports = require('${relativePath}');`
      }
    ];
    
    // Apply each pattern
    patterns.forEach(pattern => {
      const matches = content.match(pattern.regex);
      if (matches) {
        content = content.replace(pattern.regex, pattern.replacement);
        fileImportsUpdated += matches.length;
      }
    });
    
    if (fileImportsUpdated > 0) {
      if (DRY_RUN) {
        console.log(`Would update ${fileImportsUpdated} imports in ${filePath} to use ${relativePath}`);
      } else {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${fileImportsUpdated} imports in ${filePath} to use ${relativePath}`);
      }
      stats.filesModified++;
      stats.importsUpdated += fileImportsUpdated;
    } else if (VERBOSE) {
      console.log(`No imports to update in ${filePath}`);
    }
    
    return fileImportsUpdated > 0;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    stats.errors++;
    return false;
  }
}

/**
 * Main function
 */
function main() {
  console.log('Standardizing ethers imports...');
  console.log(`Mode: ${DRY_RUN ? 'Dry Run' : 'Live'}`);
  
  // Find all JS files
  const jsFiles = findJsFiles(TEST_DIR);
  stats.filesScanned = jsFiles.length;
  
  console.log(`Found ${jsFiles.length} JavaScript files to scan`);
  
  // Update imports in each file
  jsFiles.forEach(file => {
    updateImports(file);
  });
  
  // Print summary
  console.log('\nSummary:');
  console.log(`Files scanned: ${stats.filesScanned}`);
  console.log(`Files modified: ${stats.filesModified}`);
  console.log(`Imports updated: ${stats.importsUpdated}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (DRY_RUN) {
    console.log('\nThis was a dry run. No files were actually modified.');
    console.log('Run without --dry-run to apply changes.');
  }
}

// Run the script
main();
