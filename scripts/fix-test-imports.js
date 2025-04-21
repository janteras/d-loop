// Script to fix import paths in test files
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all test files
const testFiles = execSync('find /Users/apple/Downloads/windsurf-dloop/test -name "*.test.js"')
  .toString()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${testFiles.length} test files to process.`);

// Process each file
let fixedFiles = 0;
testFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Fix ethers-v6-shim import
    content = content.replace(
      /require\(['"]\.\/ethers-v6-shim['"]\)/g, 
      "require('../utils/ethers-v6-shim')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/ethers-v6-shim['"]\)/g, 
      "require('../utils/ethers-v6-shim')"
    );
    
    // Fix BaseApprovalTest import
    content = content.replace(
      /require\(['"]\.\/BaseApprovalTest['"]\)/g, 
      "require('../utils/BaseApprovalTest')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/BaseApprovalTest['"]\)/g, 
      "require('../utils/BaseApprovalTest')"
    );
    
    // Fix other common imports
    content = content.replace(
      /require\(['"]\.\.\/mocks\/(.*)['"]\)/g, 
      "require('../../mocks/$1')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/\.\.\/mocks\/(.*)['"]\)/g, 
      "require('../../mocks/$1')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/utils\/(.*)['"]\)/g, 
      "require('../../utils/$1')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/\.\.\/utils\/(.*)['"]\)/g, 
      "require('../../utils/$1')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/helpers\/(.*)['"]\)/g, 
      "require('../../helpers/$1')"
    );
    
    content = content.replace(
      /require\(['"]\.\.\/\.\.\/helpers\/(.*)['"]\)/g, 
      "require('../../helpers/$1')"
    );
    
    // Write back if changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      fixedFiles++;
      console.log(`Fixed imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
});

console.log(`\nFixed imports in ${fixedFiles} files.`);
console.log('Import path fixing completed successfully!');
