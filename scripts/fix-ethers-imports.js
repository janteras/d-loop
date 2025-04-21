/**
 * @title Fix Ethers Imports Script
 * @dev Script to standardize ethers imports in test files
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define the replacement pattern
const ETHERS_IMPORT_PATTERN = /require\(['"](\.\.\/)*(?:ethers-v6-shim(?:\.enhanced\.v2)?|unified-ethers-v6-shim|improved-ethers-v6-shim)['"]\)/g;

// Process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Calculate the relative path to utils directory
    const relativePath = path.relative(path.dirname(filePath), path.join(path.dirname(filePath), '..', 'utils'));
    const replacement = `require("${relativePath}/ethers-v6-compat")`;
    
    // Replace the import
    const updatedContent = content.replace(ETHERS_IMPORT_PATTERN, replacement);
    
    // Only write if changes were made
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      console.log(`Updated imports in ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Find all JS files with ethers-v6-shim imports
const output = execSync('find test -name "*.js" -exec grep -l "ethers-v6-shim\\|unified-ethers-v6-shim\\|improved-ethers-v6-shim" {} \\;').toString();
const files = output.split('\n').filter(file => file.trim() !== '');

console.log(`Found ${files.length} files to process`);

// Process each file
let updatedCount = 0;
files.forEach(file => {
  if (processFile(file)) {
    updatedCount++;
  }
});

console.log(`\nUpdate complete! ${updatedCount} files were updated.`);
