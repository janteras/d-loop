/**
 * D-Loop Protocol - Ethers Shim Migration Script
 * 
 * This script standardizes all ethers-v6-shim imports across the codebase
 * to use the new unified @ethers-shim approach.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
 * Update import statements in a file
 */
function updateImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let fileImportsUpdated = 0;
    
    // Define regex patterns for matching various ethers-v6-shim imports
    const patterns = [
      // Simple require statements
      {
        regex: /require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: "require('@ethers-shim');"
      },
      
      // const ethers = require statements
      {
        regex: /const ethers = require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: "const ethers = require('@ethers-shim');"
      },
      
      // module.exports statements
      {
        regex: /module\.exports = require\(['"](?:\.\.\/)*(?:utils\/)?(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\);/g,
        replacement: "module.exports = require('@ethers-shim');"
      },
      
      // Handle @shim alias from previous attempts
      {
        regex: /require\(['"]@shim['"]\);/g,
        replacement: "require('@ethers-shim');"
      },
      {
        regex: /const ethers = require\(['"]@shim['"]\);/g,
        replacement: "const ethers = require('@ethers-shim');"
      },
      {
        regex: /module\.exports = require\(['"]@shim['"]\);/g,
        replacement: "module.exports = require('@ethers-shim');"
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
        console.log(`Would update ${fileImportsUpdated} imports in ${filePath}`);
      } else {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${fileImportsUpdated} imports in ${filePath}`);
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
